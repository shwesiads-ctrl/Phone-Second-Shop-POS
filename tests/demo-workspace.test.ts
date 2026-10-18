import test from "node:test";
import assert from "node:assert/strict";
import { sampleShop, DemoWorkspace } from "../src/main/demo-workspace";
import { openDatabase } from "../src/main/database";
import { ShopService } from "../src/main/service";
test("sample shop contains 100 priced products, real posted sales/purchases, collections, repairs and positive dashboard values", () => {
  const s = sampleShop(),
    d = s.invoke("snapshot", {}),
    mmk = d.reports.find((r: any) => r.currency === "MMK");
  assert.equal(s.row("SELECT count(*) n FROM phones")!.n, 40);
  assert.equal(s.row("SELECT count(*) n FROM accessories")!.n, 60);
  assert.equal(s.row("SELECT count(*) n FROM purchases")!.n, 40);
  assert.equal(s.row("SELECT count(*) n FROM sales")!.n, 12);
  assert.equal(d.inventory, 28);
  assert.equal(d.repairs.length, 6);
  assert.equal(d.lowStock.length, 5);
  assert.equal(mmk.revenue, 2730000);
  assert.equal(mmk.gross, 600000);
  assert.ok(mmk.received > 0);
  assert.equal(
    s.row("SELECT count(*) n FROM accessories WHERE cost<=0 OR price<=0")!.n,
    0,
  );
  assert.equal(s.row("PRAGMA integrity_check")!.integrity_check, "ok");
  assert.ok(s.invoice(1).settings.footer.includes("DEMO"));
  s.db.close();
});
test("sandbox enter is idempotent, exit restores the exact live service and never merges practice writes", () => {
  const live = new ShopService(openDatabase(":memory:"), true);
  live.invoke("setup", { username: "owner", password: "live sample password" });
  live.invoke("expense", {
    request: crypto.randomUUID(),
    category: "Real shop",
    description: "Keep this",
    amount: 700,
    currency: "MMK",
    method: "Cash",
  });
  const before = live.rows("SELECT * FROM settings"),
    workspace = new DemoWorkspace();
  const demo = workspace.enter(live);
  assert.equal(workspace.enter(demo), demo);
  assert.equal(workspace.active, true);
  demo.invoke("expense", {
    request: crypto.randomUUID(),
    category: "Demo practice",
    description: "Sandbox only",
    amount: 1000,
    currency: "MMK",
    method: "Cash",
  });
  assert.throws(() => workspace.guard("restore"), /DEMO_RESTRICTED/);
  assert.throws(() => workspace.guard("password"), /DEMO_RESTRICTED/);
  const restored = workspace.leave(demo);
  assert.equal(restored, live);
  assert.equal(workspace.active, false);
  assert.equal(live.row("SELECT count(*) n FROM sales")!.n, 0);
  assert.equal(live.row("SELECT count(*) n FROM expenses")!.n, 1);
  assert.equal(live.row("SELECT amount FROM expenses")!.amount, 700);
  assert.deepEqual(live.rows("SELECT * FROM settings"), before);
  assert.equal(workspace.leave(live), live);
  live.db.close();
});
test("entering sample shop requires an authenticated Owner", () => {
  const live = new ShopService(openDatabase(":memory:"));
  const w = new DemoWorkspace();
  assert.throws(() => w.enter(live), /UNAUTHENTICATED/);
  live.invoke("setup", {
    username: "owner",
    password: "sample owner password",
  });
  live.invoke("users", {
    username: "admin",
    password: "sample admin password",
    role: "Admin",
  });
  live.invoke("logout");
  live.invoke("login", {
    username: "admin",
    password: "sample admin password",
  });
  assert.throws(() => w.enter(live), /FORBIDDEN/);
  live.db.close();
});
