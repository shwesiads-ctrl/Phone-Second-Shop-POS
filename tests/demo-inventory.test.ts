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
  assert.equal(
    s.invoke("demoInventory", { action: "add", uiLanguage: "en-US" }).count,
    100,
  );
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

test("removed demo IDs are never reassigned to real inventory or another demo batch", () => {
  const s = shop();
  s.invoke("demoInventory", { action: "add" });
  const previous = s.settings().demoInventory.map((v: any) => v.id);
  s.invoke("demoInventory", { action: "remove" });
  const id = s.invoke("accessory", {
    sku: "AFTER",
    name: "Real item",
    category: "Cable",
    cost: 100,
    price: 200,
    currency: "MMK",
    quantity: 2,
    reorder: 0,
    method: "Cash",
  });
  assert.ok(id > Math.max(...previous));
  s.invoke("demoInventory", { action: "add" });
  assert.ok(s.settings().demoInventory.every((v: any) => v.id > id));
  s.db.close();
});

test("named demo adds ten products and fictional customers once, survives reopen and removes only its own rows", () => {
  const s = shop();
  const real = s.invoke("contact", {
    name: "Existing Customer",
    kind: "customer",
  });
  s.invoke("demoInventory", { action: "add" });
  const before = s.rows("SELECT * FROM payments");
  assert.equal(
    s.invoke("demoInventory", { action: "add", preset: "named10" }).count,
    10,
  );
  assert.equal(
    s.invoke("demoInventory", { action: "add", preset: "named10" }).count,
    10,
  );
  assert.equal(s.row("SELECT count(*) n FROM accessories")!.n, 110);
  assert.equal(s.row("SELECT count(*) n FROM contacts")!.n, 11);
  const namedRows = s
    .settings()
    .namedDemoInventory.map((i: { id: number }) =>
      s.row("SELECT * FROM accessories WHERE id=?", i.id)!,
    );
  assert.equal(new Set(namedRows.map((i: any) => i.barcode)).size, 10);
  assert.equal(new Set(namedRows.map((i: any) => i.name)).size, 10);
  assert.ok(namedRows.every((i: any) => i.price > 0));
  const names = s.rows("SELECT name,phone FROM contacts WHERE id<>?", real);
  assert.ok(names.every((c) => c.name.startsWith("[DEMO] ") && c.phone === ""));
  assert.ok(
    s.row(
      "SELECT id FROM accessories WHERE name='[DEMO] Samsung 25W USB-C Charger'",
    ),
  );
  const reopened = new ShopService(s.db, true);
  reopened.invoke("login", {
    username: "owner",
    password: "synthetic demo password",
  });
  assert.equal(
    reopened.invoke("demoInventory", { action: "remove", preset: "named10" })
      .count,
    10,
  );
  assert.equal(s.row("SELECT count(*) n FROM accessories")!.n, 100);
  assert.equal(s.row("SELECT count(*) n FROM contacts")!.n, 1);
  assert.equal(
    s.row("SELECT name FROM contacts WHERE id=?", real)!.name,
    "Existing Customer",
  );
  assert.deepEqual(s.rows("SELECT * FROM payments"), before);
  assert.equal(
    reopened.invoke("demoInventory", { action: "remove", preset: "named10" })
      .count,
    0,
  );
  assert.equal(s.row("PRAGMA foreign_key_check"), undefined);
  s.db.close();
});

test("named demo removal is atomic and refuses used customers or edited products", () => {
  const s = shop();
  s.invoke("demoInventory", { action: "add", preset: "named10" });
  const item = s.settings().namedDemoInventory[0],
    customer = s.settings().namedDemoCustomers[0];
  s.invoke("sale", {
    request: crypto.randomUUID(),
    currency: "MMK",
    contactId: customer.id,
    items: [{ kind: "accessory", id: item.id, quantity: 1, price: 1100 }],
    payments: [{ method: "Cash", amount: 1100 }],
  });
  assert.throws(
    () => s.invoke("demoInventory", { action: "remove", preset: "named10" }),
    /DEMO_IN_USE/,
  );
  assert.equal(s.row("SELECT count(*) n FROM contacts")!.n, 10);
  assert.equal(s.row("SELECT count(*) n FROM accessories")!.n, 10);
  s.db.close();
  const other = shop();
  other.invoke("demoInventory", { action: "add", preset: "named10" });
  other.run(
    "UPDATE accessories SET name=? WHERE id=?",
    "Edited by owner",
    other.settings().namedDemoInventory[0].id,
  );
  assert.throws(
    () =>
      other.invoke("demoInventory", { action: "remove", preset: "named10" }),
    /DEMO_IN_USE/,
  );
  assert.equal(other.row("SELECT count(*) n FROM contacts")!.n, 10);
  other.db.close();
});
