import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { openDatabase, SCHEMA_VERSION } from "../src/main/database";
import { ShopService } from "../src/main/service";
import { prepareRestore, validateBackup } from "../src/main/backup";
import { randomUUID } from "node:crypto";
function fixture(path: string) {
  const db = new DatabaseSync(path);
  db.exec(
    readFileSync(new URL("./fixtures/legacy-v7.sql", import.meta.url), "utf8"),
  );
  db.close();
}
test("genuine v0.1.0 schema7 paid/partially-returned fixture upgrades without changing history or re-refunding old tender units", () => {
  const dir = mkdtempSync(join(tmpdir(), "pos-upgrade-"));
  try {
    const path = join(dir, "v7.sqlite");
    fixture(path);
    const prior = new DatabaseSync(path);
    const history = prior.prepare("SELECT * FROM sales").all();
    const oldPayments = prior
      .prepare("SELECT id,amount,currency,created FROM payments")
      .all();
    prior.close();
    const db = openDatabase(path);
    assert.equal(
      db.prepare("PRAGMA user_version").get()!.user_version,
      SCHEMA_VERSION,
    );
    assert.deepEqual(db.prepare("SELECT * FROM sales").all(), history);
    assert.deepEqual(
      db.prepare("SELECT id,amount,currency,created FROM payments").all(),
      oldPayments,
    );
    const s = new ShopService(db);
    s.invoke("login", {
      username: "legacy-owner",
      password: "legacy-test-password",
    });
    const rate = s.invoke("quote", {
      amount: 100,
      currency: "USD",
      targetCurrency: "MMK",
      rateId: 1,
    });
    assert.equal(rate.amount, 2000);
    assert.equal(rate.rate.basis, "minor");
    s.invoke("return", {
      request: randomUUID(),
      id: 1,
      refund: 200,
      reason: "Remaining legacy return",
      method: "Cash",
    });
    assert.equal(s.invoke("snapshot", {}).reports[0].cashNet, 0);
    assert.equal(s.paid("sale", 1), 0);
    assert.equal(
      s.row(
        "SELECT SUM(original_amount) n FROM payments WHERE direction='out'",
      )!.n,
      300,
    );
    db.close();
    const reopened = openDatabase(path);
    assert.equal(
      reopened.prepare("PRAGMA integrity_check").get()!.integrity_check,
      "ok",
    );
    reopened.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("restore preflight upgrades a copy, preserves the legacy backup bytes and rejects future schemas", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pos-restore-"));
  try {
    const source = join(dir, "legacy.sqlite");
    fixture(source);
    const original = readFileSync(source);
    assert.equal(validateBackup(source).version, 7);
    const preview = await prepareRestore(source, join(dir, "staged.sqlite"));
    assert.equal(preview.version, SCHEMA_VERSION);
    assert.equal(preview.sales, 1);
    assert.ok(readFileSync(source).equals(original));
    const future = new DatabaseSync(join(dir, "future.sqlite"));
    future.exec("PRAGMA user_version=999");
    future.close();
    assert.throws(
      () => validateBackup(join(dir, "future.sqlite")),
      /INVALID_BACKUP/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
