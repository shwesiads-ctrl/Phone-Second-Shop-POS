import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/main/database";
import { ShopService } from "../src/main/service";
const account = { username: "owner", password: "original secure password" };
function shop() {
  const db = openDatabase(":memory:");
  const s = new ShopService(db, true);
  s.invoke("setup", account);
  return s;
}
function elapsed(s: ShopService) {
  s.db.exec("UPDATE auth_guard SET retry_at=0 WHERE id=1");
}
test("free Android edition rejects role management and existing staff without deleting historical accounts", () => {
  const s = shop();
  const desktop = new ShopService(s.db);
  desktop.invoke("login", account);
  desktop.invoke("users", {
    username: "staff",
    password: "staff secure password",
    role: "Cashier",
  });
  assert.throws(
    () =>
      s.invoke("users", {
        username: "other",
        password: "other secure password",
        role: "Owner",
      }),
    /FORBIDDEN/,
  );
  assert.throws(
    () =>
      s.invoke("permission", { userId: 2, operation: "sale", allowed: true }),
    /FORBIDDEN/,
  );
  s.invoke("logout");
  assert.throws(
    () =>
      s.invoke("login", {
        username: "staff",
        password: "staff secure password",
      }),
    /LOGIN_FAILED/,
  );
  assert.equal(s.row("SELECT COUNT(*) n FROM users")!.n, 2);
  assert.equal(s.invoke("status").ownerOnly, true);
  s.db.close();
});
test("recovery requires Owner and password reauthentication; only salted hashes are stored or audited", () => {
  const s = shop();
  assert.throws(
    () =>
      new ShopService(s.db, true).invoke("recoveryGenerate", {
        current: account.password,
      }),
    /UNAUTHENTICATED/,
  );
  assert.throws(
    () => s.invoke("recoveryGenerate", { current: "bad" }),
    /LOGIN_FAILED/,
  );
  elapsed(s);
  const { key } = s.invoke("recoveryGenerate", { current: account.password });
  assert.match(key, /^(?:[A-F0-9]{8}-){7}[A-F0-9]{8}$/);
  assert.ok(
    !JSON.stringify(s.rows("SELECT * FROM owner_recovery")).includes(
      key.replaceAll("-", ""),
    ),
  );
  assert.ok(!JSON.stringify(s.rows("SELECT * FROM audit")).includes(key));
  const d = new ShopService(s.db);
  d.invoke("login", account);
  d.invoke("users", {
    username: "cashier",
    password: "cashier password",
    role: "Cashier",
  });
  d.invoke("logout");
  d.invoke("login", { username: "cashier", password: "cashier password" });
  assert.throws(
    () => d.invoke("recoveryGenerate", { current: "cashier password" }),
    /FORBIDDEN/,
  );
  s.db.close();
});
test("rotated key revoked; one-use recovery resets password, invalidates sessions and never logs in", () => {
  const s = shop();
  const other = new ShopService(s.db, true);
  other.invoke("login", account);
  const first = s.invoke("recoveryGenerate", { current: account.password }).key;
  const second = s.invoke("recoveryGenerate", {
    current: account.password,
  }).key;
  assert.notEqual(first, second);
  assert.throws(
    () =>
      s.invoke("recoveryReset", {
        username: "owner",
        key: first,
        password: "new secure password",
      }),
    /LOGIN_FAILED/,
  );
  elapsed(s);
  assert.equal(
    s.invoke("recoveryReset", {
      username: "OWNER",
      key: second.toLowerCase(),
      password: "new secure password",
    }),
    true,
  );
  assert.equal(s.user, null);
  assert.equal(other.user, null);
  assert.equal(s.row("SELECT COUNT(*) n FROM owner_recovery")!.n, 0);
  assert.throws(
    () =>
      s.invoke("recoveryReset", {
        username: "owner",
        key: second,
        password: "another secure password",
      }),
    /LOGIN_FAILED/,
  );
  elapsed(s);
  assert.throws(() => s.invoke("login", account), /LOGIN_FAILED/);
  elapsed(s);
  assert.equal(
    s.invoke("login", { username: "owner", password: "new secure password" })
      .role,
    "Owner",
  );
  s.db.close();
});
test("login/recovery share a persistent bounded delay across service restarts", () => {
  const s = shop();
  assert.throws(
    () =>
      s.invoke("recoveryReset", {
        username: "missing",
        key: "wrong",
        password: "new secure password",
      }),
    /LOGIN_FAILED/,
  );
  const guard = s.row("SELECT * FROM auth_guard")!;
  assert.equal(guard.attempts, 1);
  assert.ok(guard.retry_at > Date.now());
  const fresh = new ShopService(s.db, true);
  assert.throws(() => fresh.invoke("login", account), /LOGIN_DELAY/);
  assert.throws(
    () =>
      fresh.invoke("recoveryReset", {
        username: "owner",
        key: "wrong",
        password: "new secure password",
      }),
    /LOGIN_DELAY/,
  );
  assert.equal(s.row("SELECT attempts FROM auth_guard")!.attempts, 1);
  s.db.close();
});
test("recovery mutation rolls back password and consumed key if audit fails", () => {
  const s = shop();
  const { key } = s.invoke("recoveryGenerate", { current: account.password });
  s.db.exec(
    "CREATE TRIGGER fail_recovery BEFORE INSERT ON audit WHEN NEW.action='owner.recover' BEGIN SELECT RAISE(ABORT,'test audit failure');END",
  );
  assert.throws(
    () =>
      s.invoke("recoveryReset", {
        username: "owner",
        key,
        password: "new secure password",
      }),
    /test audit failure/,
  );
  assert.equal(s.row("SELECT COUNT(*) n FROM owner_recovery")!.n, 1);
  assert.equal(s.invoke("login", account).role, "Owner");
  s.db.close();
});
test("password changes invalidate other sessions; disabled accounts lose access immediately", () => {
  const s = shop();
  const other = new ShopService(s.db, true);
  other.invoke("login", account);
  s.invoke("password", {
    current: account.password,
    password: "changed secure password",
  });
  assert.equal(s.user?.role, "Owner");
  assert.equal(other.user, null);
  s.db.exec("UPDATE users SET active=0");
  assert.throws(() => s.invoke("snapshot"), /UNAUTHENTICATED/);
  s.db.close();
});

test("logged-out status exposes language only, never shop settings or security credentials", () => {
  const s = shop();
  s.run(
    "INSERT OR REPLACE INTO settings(key,value) VALUES('store',?)",
    JSON.stringify("private shop"),
  );
  const key = s.invoke("recoveryGenerate", { current: account.password }).key;
  s.invoke("logout");
  const result = s.invoke("status");
  assert.deepEqual(Object.keys(result.settings), ["language"]);
  assert.ok(!JSON.stringify(result).includes("private shop"));
  assert.ok(!JSON.stringify(result).includes(key));
  s.db.close();
});
test("malformed stored password hashes produce a generic failure, not raw crypto errors", () => {
  const s = shop();
  s.db.exec("UPDATE users SET password='malformed'");
  assert.throws(() => s.invoke("login", account), /LOGIN_FAILED/);
  s.db.close();
});
