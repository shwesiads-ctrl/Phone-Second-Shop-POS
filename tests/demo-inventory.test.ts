import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/main/database";
import { ShopService } from "../src/main/service";
function shop() {
  const s = new ShopService(openDatabase(":memory:"), true);
  s.invoke("setup", { username: "owner", password: "synthetic demo password" });
  return s;
}
test("100 demo items are unique, idempotent, removable after reopen and preserve real inventory/cash", () => {
  const s = shop();
  const real = s.invoke("accessory", {
    sku: "REAL",
    name: "Real cable",
    category: "Cable",
    cost: 100,
    price: 200,
    currency: "MMK",
    quantity: 2,
    reorder: 0,
    method: "Cash",
  });
  const before = s.rows("SELECT * FROM payments");
  assert.equal(s.invoke("demoInventory", { action: "add" }).count, 100);
  assert.equal(s.invoke("demoInventory", { action: "add" }).count, 100);
  assert.equal(s.row("SELECT count(*) n FROM accessories")!.n, 101);
  assert.equal(
    s.row(
      "SELECT count(DISTINCT barcode) n FROM accessories WHERE category='DEMO'",
    )!.n,
    100,
  );
  const reopened = new ShopService(s.db, true);
  reopened.invoke("login", {
    username: "owner",
    password: "synthetic demo password",
  });
  assert.equal(
    reopened.invoke("demoInventory", { action: "remove" }).count,
    100,
  );
  assert.equal(reopened.invoke("demoInventory", { action: "remove" }).count, 0);
  assert.equal(reopened.row("SELECT count(*) n FROM accessories")!.n, 1);
  assert.equal(
    reopened.row("SELECT quantity FROM accessories WHERE id=?", real)!.quantity,
    2,
  );
  assert.deepEqual(reopened.rows("SELECT * FROM payments"), before);
  assert.equal(reopened.row("PRAGMA integrity_check")!.integrity_check, "ok");
  s.db.close();
});
test("changed demo stock cancels whole removal and keeps records", () => {
  const s = shop();
  s.invoke("demoInventory", { action: "add" });
  const item = s.row("SELECT * FROM accessories LIMIT 1")!;
  s.invoke("adjust", { id: item.id, delta: -1, reason: "Used sample" });
  assert.throws(
    () => s.invoke("demoInventory", { action: "remove" }),
    /DEMO_IN_USE/,
  );
  assert.equal(s.row("SELECT count(*) n FROM accessories")!.n, 100);
  assert.equal(
    s.row("SELECT quantity FROM accessories WHERE id=?", item.id)!.quantity,
    9,
  );
  s.db.close();
});
test("demo mutation rejects guests, malformed actions and audit failure rolls back all 100 items", () => {
  const s = shop();
  assert.throws(() => s.invoke("demoInventory", { action: "wipe" }));
  s.db.exec(
    "CREATE TRIGGER fail_demo BEFORE INSERT ON audit WHEN NEW.action='demo.add' BEGIN SELECT RAISE(ABORT,'test audit failure');END;",
  );
  assert.throws(() => s.invoke("demoInventory", { action: "add" }));
  assert.equal(s.row("SELECT count(*) n FROM accessories")!.n, 0);
  assert.equal(s.settings().demoInventory, undefined);
  s.invoke("logout");
  assert.throws(
    () => s.invoke("demoInventory", { action: "add" }),
    /UNAUTHENTICATED/,
  );
  s.db.close();
});
test("demo cleanup audit failure rolls back deletions and a custom permission cannot grant non-Owner access", () => {
  const s = shop();
  s.invoke("demoInventory", { action: "add" });
  s.db.exec(
    "CREATE TRIGGER fail_remove BEFORE INSERT ON audit WHEN NEW.action='demo.remove' BEGIN SELECT RAISE(ABORT,'test audit failure');END;",
  );
  assert.throws(() => s.invoke("demoInventory", { action: "remove" }));
  assert.equal(s.row("SELECT count(*) n FROM accessories")!.n, 100);
  assert.equal(s.settings().demoInventory.length, 100);
  const desktop = new ShopService(s.db, false);
  desktop.invoke("login", {
    username: "owner",
    password: "synthetic demo password",
  });
  const admin = desktop.invoke("users", {
    username: "admin",
    password: "synthetic admin password",
    role: "Admin",
  });
  desktop.run(
    "INSERT INTO permissions(user_id,operation,allowed) VALUES(?,?,1)",
    admin,
    "demoInventory",
  );
  desktop.invoke("logout");
  desktop.invoke("login", {
    username: "admin",
    password: "synthetic admin password",
  });
  assert.throws(
    () => desktop.invoke("demoInventory", { action: "add" }),
    /FORBIDDEN/,
  );
  s.db.close();
});
