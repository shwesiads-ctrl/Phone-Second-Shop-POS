import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backup } from "node:sqlite";
import { openDatabase } from "../src/main/database";
import { ShopService } from "../src/main/service";
import { validIMEI } from "../src/main/validation";
import { parseMoney, money } from "../src/shared/contracts";
import { receiptHTML } from "../src/main/receipt";
import { dictionaries } from "../src/renderer/i18n";
const owner = { username: "owner", password: "correct horse battery" };
function shop() {
  const s = new ShopService(openDatabase(":memory:"));
  s.invoke("setup", owner);
  return s;
}
function customer(s: ShopService) {
  return s.invoke("contact", { name: "Customer", kind: "customer" });
}
function purchase(s: ShopService, overrides: Record<string, unknown> = {}) {
  return s.invoke("purchase", {
    request: randomUUID(),
    contactId: customer(s),
    currency: "MMK",
    brand: "Apple",
    model: "iPhone",
    imei1: "490154203237518",
    condition: "used",
    grade: "A",
    cost: 100000,
    refurbishment: 10000,
    price: 150000,
    minimum: 120000,
    paid: 50000,
    method: "Cash",
    ...overrides,
  });
}
function sale(s: ShopService, overrides: Record<string, unknown> = {}) {
  return s.invoke("sale", {
    request: randomUUID(),
    currency: "MMK",
    contactId: customer(s),
    items: [
      { kind: "phone", id: 1, quantity: 1, price: 150000, warrantyDays: 30 },
    ],
    discount: 0,
    payments: [{ amount: 70000, method: "Cash" }],
    ...overrides,
  });
}
test("first-run owner, password hashing, login delay, session and RBAC", () => {
  const s = shop();
  assert.match(s.row("SELECT password FROM users")!.password, /^[a-f0-9]{32}:/);
  assert.throws(() => s.invoke("setup", owner), /ALREADY_INITIALIZED/);
  s.invoke("users", {
    username: "cashier",
    password: "another long password",
    role: "Cashier",
  });
  s.invoke("logout");
  assert.throws(() => s.invoke("snapshot", {}), /UNAUTHENTICATED/);
  assert.throws(
    () => s.invoke("login", { ...owner, password: "wrong" }),
    /LOGIN_FAILED/,
  );
  assert.throws(() => s.invoke("login", owner), /LOGIN_DELAY/);
  const fresh = new ShopService(s.db);
  fresh.invoke("login", {
    username: "cashier",
    password: "another long password",
  });
  assert.throws(
    () =>
      fresh.invoke("expense", {
        request: randomUUID(),
        category: "rent",
        description: "rent",
        amount: 10,
        currency: "MMK",
        method: "Cash",
      }),
    /FORBIDDEN/,
  );
  assert.throws(
    () =>
      fresh.invoke("users", {
        username: "other",
        password: "another long password",
        role: "Owner",
      }),
    /FORBIDDEN/,
  );
  s.db.close();
});
test("IMEI checksum, cross-slot uniqueness and explicit alternative approval", () => {
  assert.equal(validIMEI("490154203237518"), true);
  assert.equal(validIMEI("490154203237519"), false);
  const s = shop();
  purchase(s);
  assert.throws(
    () => purchase(s, { imei1: "", imei2: "490154203237518" }),
    /DUPLICATE_IMEI/,
  );
  assert.throws(() => purchase(s, { imei1: "123" }), /INVALID_IMEI/);
  assert.throws(
    () => purchase(s, { imei1: "", alternate: "SHOP-01" }),
    /ALTERNATE_APPROVAL_REQUIRED/,
  );
  purchase(s, { imei1: "", alternate: "SHOP-01", alternateApproved: true });
  assert.equal(s.row("SELECT COUNT(*) n FROM purchases")!.n, 2);
  s.db.close();
});
test("purchase idempotency, capitalized cost, rollback and payment balance", () => {
  const s = shop();
  const request = randomUUID();
  const id = purchase(s, { request });
  assert.equal(purchase(s, { request }), id);
  assert.equal(s.row("SELECT cost FROM phones")!.cost, 110000);
  assert.equal(s.row("SELECT COUNT(*) n FROM purchases")!.n, 1);
  assert.equal(s.invoke("snapshot", {}).reports[0].payable, 50000);
  s.invoke("payment", {
    request: randomUUID(),
    target: "purchase",
    id,
    amount: 50000,
    method: "Cash",
  });
  assert.equal(s.invoke("snapshot", {}).reports[0].payable, 0);
  assert.throws(
    () =>
      s.invoke("payment", {
        request: randomUUID(),
        target: "purchase",
        id,
        amount: 1,
        method: "Cash",
      }),
    /OVERPAYMENT/,
  );
  s.db.close();
});
test("partial payment keeps receivable separate, duplicate sale is idempotent and sold phone cannot be sold twice", () => {
  const s = shop();
  purchase(s);
  const request = randomUUID();
  const id = sale(s, { request });
  assert.equal(sale(s, { request }), id);
  const r = s.invoke("snapshot", {}).reports[0];
  assert.equal(r.revenue, 150000);
  assert.equal(r.received, 70000);
  assert.equal(r.receivable, 80000);
  assert.equal(r.gross, 40000);
  assert.throws(() => sale(s), /OUT_OF_STOCK/);
  const payment = {
    request: randomUUID(),
    target: "sale",
    id,
    amount: 80000,
    method: "KBZPay",
  };
  s.invoke("payment", payment);
  s.invoke("payment", payment);
  assert.equal(s.paid("sale", id), 150000);
  assert.equal(s.row("SELECT COUNT(*) n FROM sales")!.n, 1);
  s.db.close();
});
test("sale rollback on a late stock error and minimum price after invoice discount", () => {
  const s = shop();
  purchase(s);
  assert.throws(
    () =>
      sale(s, {
        items: [
          { kind: "phone", id: 1, quantity: 1, price: 150000 },
          { kind: "accessory", id: 999, quantity: 1, price: 5000 },
        ],
      }),
    /NOT_FOUND/,
  );
  assert.equal(s.row("SELECT status FROM phones")!.status, "available");
  assert.equal(s.row("SELECT COUNT(*) n FROM sales")!.n, 0);
  assert.throws(() => sale(s, { discount: 40000 }), /BELOW_MINIMUM/);
  assert.equal(
    s.row("SELECT COUNT(*) n FROM payments WHERE target='sale'")!.n,
    0,
  );
  s.db.close();
});
test("full returns refund collections, quarantine phones, preserve history and require inspection", () => {
  const s = shop();
  purchase(s);
  const id = sale(s);
  assert.throws(
    () =>
      s.invoke("return", {
        request: randomUUID(),
        id,
        refund: 50000,
        reason: "Return",
        method: "Cash",
      }),
    /FULL_RETURN_REFUND_REQUIRED/,
  );
  s.invoke("return", {
    request: randomUUID(),
    id,
    refund: 70000,
    reason: "Return",
    method: "Cash",
  });
  assert.equal(s.row("SELECT status FROM phones")!.status, "inspection");
  assert.equal(s.paid("sale", id), 0);
  assert.equal(s.row("SELECT COUNT(*) n FROM sale_items")!.n, 1);
  assert.throws(() => sale(s), /OUT_OF_STOCK/);
  s.invoke("inspect", { id: 1, reason: "Screen and battery tested" });
  sale(s);
  assert.equal(s.row("SELECT COUNT(*) n FROM sales")!.n, 2);
  s.db.close();
});
test("purchase reversals retain identifiers and compensate cash", () => {
  const s = shop();
  const id = purchase(s);
  s.invoke("purchaseReverse", {
    request: randomUUID(),
    id,
    reason: "Seller cancellation",
  });
  assert.equal(s.purchasePaid(id), 0);
  assert.equal(s.row("SELECT status FROM purchases")!.status, "reversed");
  assert.equal(s.row("SELECT COUNT(*) n FROM identifiers")!.n, 1);
  assert.throws(() => purchase(s), /DUPLICATE_IMEI/);
  s.db.close();
});
test("accessory sale quantities, adjustments, negative stock prevention", () => {
  const s = shop();
  const id = s.invoke("accessory", {
    sku: "CABLE-1",
    name: "Cable",
    category: "Cable",
    cost: 1000,
    price: 2000,
    currency: "MMK",
    quantity: 3,
    reorder: 1,
    method: "Cash",
  });
  sale(s, {
    items: [{ kind: "accessory", id, quantity: 2, price: 2000 }],
    payments: [{ amount: 4000, method: "Cash" }],
  });
  assert.equal(s.row("SELECT quantity FROM accessories")!.quantity, 1);
  assert.throws(
    () => s.invoke("adjust", { id, delta: -2, reason: "Damaged" }),
    /OUT_OF_STOCK/,
  );
  assert.equal(s.row("SELECT quantity FROM accessories")!.quantity, 1);
  s.db.close();
});
test("repair approval, paid delivery, transition control and real repair revenue", () => {
  const s = shop();
  const id = s.invoke("repair", {
    contactId: customer(s),
    device: "Phone",
    identifier: "Customer device",
    problem: "Screen broken",
    estimate: 20000,
    currency: "MMK",
  });
  assert.throws(
    () =>
      s.invoke("repairUpdate", {
        id,
        status: "Repairing",
        approved: false,
        final: 20000,
        reason: "Skip after inspection",
      }),
    /APPROVAL_REQUIRED/,
  );
  s.invoke("repairUpdate", {
    id,
    status: "Repairing",
    approved: true,
    final: 20000,
    reason: "Customer agreed",
  });
  assert.throws(
    () =>
      s.invoke("repairUpdate", {
        id,
        status: "Delivered",
        approved: true,
        final: 20000,
        reason: "Ready",
      }),
    /BALANCE_DUE/,
  );
  s.invoke("payment", {
    request: randomUUID(),
    target: "repair",
    id,
    amount: 20000,
    method: "Cash",
  });
  s.invoke("repairUpdate", {
    id,
    status: "Delivered",
    approved: true,
    final: 20000,
    reason: "Customer collected",
  });
  assert.equal(s.invoke("snapshot", {}).reports[0].repairRevenue, 20000);
  s.db.close();
});
test("warranty checks use original sale dates", () => {
  const s = shop();
  purchase(s);
  sale(s);
  s.invoke("warranty", { saleItem: 1, reason: "Battery failure" });
  s.run("UPDATE sales SET created=?", "2000-01-01T00:00:00.000Z");
  assert.throws(
    () => s.invoke("warranty", { saleItem: 1, reason: "Expired" }),
    /WARRANTY_EXPIRED/,
  );
  s.db.close();
});
test("cash reconciliation uses collections, purchases and expenses without credit revenue", () => {
  const s = shop();
  const session = s.invoke("cashSession", {
    action: "open",
    currency: "MMK",
    opening: 100000,
  });
  purchase(s);
  sale(s);
  s.invoke("expense", {
    request: randomUUID(),
    category: "Rent",
    description: "Daily rent",
    amount: 5000,
    currency: "MMK",
    method: "Cash",
  });
  const closed = s.invoke("cashSession", {
    action: "close",
    id: session,
    counted: 105000,
  });
  assert.equal(closed.expected, 105000);
  assert.equal(closed.variance, 0);
  s.db.close();
});
test("currency precision, safe arithmetic, mismatch rejection and stable historical currency", () => {
  for (const c of ["MMK", "THB", "USD"] as const) {
    const s = shop();
    const id = purchase(s, { currency: c });
    sale(s, { currency: c });
    assert.equal(
      s.invoke("snapshot", {}).reports.find((r: any) => r.currency === c)
        .revenue,
      150000,
    );
    assert.match(money(150000, c, "en-US"), c === "MMK" ? /150,000/ : /1,500/);
    s.invoke("return", {
      request: randomUUID(),
      id: 1,
      refund: 70000,
      reason: "Test",
      method: "Cash",
    });
    s.db.close();
  }
  assert.equal(parseMoney("12.34", "THB"), 1234);
  assert.equal(parseMoney("12", "MMK"), 12);
  assert.throws(() => parseMoney("12.34", "MMK"));
  assert.throws(() => parseMoney("0.001", "USD"));
  assert.throws(() => parseMoney("1e5", "MMK"));
  const s = shop();
  purchase(s);
  assert.throws(() => sale(s, { currency: "THB" }), /RATE_REQUIRED/);
  s.db.close();
});
test("backup and migrations reopen persistent database with business records intact", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pos-test-"));
  const path = join(dir, "business.sqlite");
  const s = new ShopService(openDatabase(path));
  s.invoke("setup", owner);
  purchase(s);
  await backup(s.db, join(dir, "backup.sqlite"));
  s.db.close();
  const restored = openDatabase(join(dir, "backup.sqlite"));
  assert.equal(
    restored.prepare("PRAGMA integrity_check").get()!.integrity_check,
    "ok",
  );
  assert.equal(restored.prepare("SELECT COUNT(*) n FROM phones").get()!.n, 1);
  assert.equal(restored.prepare("PRAGMA user_version").get()!.user_version, 8);
  restored.close();
  rmSync(dir, { recursive: true });
});
test("receipt escapes untrusted values and includes original invoice and currency", () => {
  const s = shop();
  purchase(s, { brand: "<script>alert(1)</script>" });
  sale(s);
  const html = receiptHTML(s.invoice(1), dictionaries["my-MM"]);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("INV-0000001"));
  assert.ok(html.includes("490154203237518"));
  s.db.close();
});
test("all localized dictionaries contain the same keys", () => {
  const en = Object.keys(dictionaries["en-US"]).sort();
  assert.deepEqual(Object.keys(dictionaries["my-MM"]).sort(), en);
  assert.deepEqual(Object.keys(dictionaries["th-TH"]).sort(), en);
});
test("trade-in posts purchase, sale credit and stock atomically and reverses linked stock", () => {
  const s = shop();
  purchase(s);
  const id = sale(s, {
    payments: [{ amount: 100000, method: "Cash" }],
    tradeIn: {
      brand: "Samsung",
      model: "Trade phone",
      imei1: "356938035643809",
      condition: "used",
      grade: "B",
      cost: 50000,
      price: 80000,
      minimum: 60000,
    },
  });
  assert.equal(s.row("SELECT COUNT(*) n FROM phones")!.n, 2);
  assert.equal(s.paid("sale", id), 150000);
  assert.equal(s.invoke("snapshot", {}).reports[0].received, 100000);
  s.invoke("return", {
    request: randomUUID(),
    id,
    refund: 100000,
    reason: "Trade-in returned together",
    method: "Cash",
  });
  assert.equal(s.paid("sale", id), 0);
  assert.equal(
    s.row("SELECT status FROM phones WHERE id=2")!.status,
    "reversed",
  );
  assert.equal(s.purchasePaid(2), 0);
  s.db.close();
});
test("invalid trade-in rolls back entire sale and outgoing stock", () => {
  const s = shop();
  purchase(s);
  assert.throws(
    () =>
      sale(s, {
        payments: [{ amount: 100000, method: "Cash" }],
        tradeIn: {
          brand: "Samsung",
          model: "Duplicate",
          imei1: "490154203237518",
          condition: "used",
          grade: "B",
          cost: 50000,
          price: 80000,
        },
      }),
    /DUPLICATE_IMEI/,
  );
  assert.equal(s.row("SELECT COUNT(*) n FROM sales")!.n, 0);
  assert.equal(s.row("SELECT status FROM phones")!.status, "available");
  s.db.close();
});
test("repair parts and replenishments preserve stock, cost basis, cash and idempotency", () => {
  const s = shop();
  const supplier = s.invoke("contact", {
    name: "Parts supplier",
    kind: "supplier",
  });
  const accessory = s.invoke("accessory", {
    sku: "SCREEN",
    name: "Screen",
    category: "Part",
    cost: 1000,
    price: 2000,
    currency: "MMK",
    quantity: 2,
    reorder: 1,
    method: "Cash",
  });
  const replenishment = {
    request: randomUUID(),
    id: accessory,
    contactId: supplier,
    quantity: 2,
    unitCost: 2000,
    method: "Cash",
  };
  s.invoke("replenish", replenishment);
  s.invoke("replenish", replenishment);
  assert.equal(s.row("SELECT quantity FROM accessories")!.quantity, 4);
  assert.equal(s.row("SELECT cost FROM accessories")!.cost, 1500);
  const id = s.invoke("repair", {
    contactId: customer(s),
    device: "Phone",
    identifier: "Device",
    problem: "Screen",
    estimate: 10000,
    currency: "MMK",
  });
  const part = {
    request: randomUUID(),
    id,
    accessoryId: accessory,
    quantity: 1,
  };
  assert.throws(() => s.invoke("repairPart", part), /APPROVAL_REQUIRED/);
  s.invoke("repairUpdate", {
    id,
    status: "Repairing",
    approved: true,
    final: 10000,
    reason: "Customer approved",
  });
  s.invoke("repairPart", part);
  s.invoke("repairPart", part);
  assert.equal(s.row("SELECT quantity FROM accessories")!.quantity, 3);
  s.invoke("payment", {
    request: randomUUID(),
    id,
    target: "repair",
    amount: 10000,
    method: "Cash",
  });
  s.invoke("repairUpdate", {
    id,
    status: "Delivered",
    approved: true,
    final: 10000,
    reason: "Collected",
  });
  assert.equal(s.invoke("snapshot", {}).reports[0].repairRevenue, 10000);
  s.db.close();
});
test("owner permission overrides are enforced by backend and cannot grant owner actions", () => {
  const s = shop();
  const id = s.invoke("users", {
    username: "stock-user",
    password: "stock user password",
    role: "Stock Manager",
  });
  s.invoke("permission", { userId: id, operation: "purchase", allowed: false });
  const other = new ShopService(s.db);
  other.invoke("login", {
    username: "stock-user",
    password: "stock user password",
  });
  assert.throws(() => purchase(other), /FORBIDDEN/);
  assert.throws(
    () =>
      other.invoke("permission", {
        userId: 1,
        operation: "settings",
        allowed: true,
      }),
    /FORBIDDEN/,
  );
  s.db.close();
});
test("held carts belong to users, do not reserve stock and are removed when resumed", () => {
  const s = shop();
  const id = s.invoke("hold", {
    label: "Later",
    content: JSON.stringify({ cart: [{ kind: "phone", id: 1 }] }),
  });
  assert.equal(s.invoke("snapshot", {}).heldCarts.length, 1);
  assert.deepEqual(s.invoke("resume", { id }).cart, [{ kind: "phone", id: 1 }]);
  assert.equal(s.invoke("snapshot", {}).heldCarts.length, 0);
  assert.throws(() => s.invoke("resume", { id }), /NOT_FOUND/);
  s.db.close();
});
test("partial returns reduce credit first, refund excess collections, allocate discounts exactly and never over-restock", () => {
  const s = shop();
  const item = s.invoke("accessory", {
    sku: "A",
    name: "Cable",
    category: "Cable",
    cost: 20,
    price: 100,
    currency: "MMK",
    quantity: 3,
    reorder: 0,
    method: "Cash",
  });
  const id = sale(s, {
    items: [{ kind: "accessory", id: item, quantity: 3, price: 100 }],
    discount: 1,
    payments: [{ amount: 150, method: "Cash" }],
  });
  const first = {
    request: randomUUID(),
    id,
    refund: 0,
    reason: "One returned",
    method: "Cash",
    items: [{ saleItem: 1, quantity: 1, restock: true }],
  };
  s.invoke("return", first);
  s.invoke("return", first);
  assert.equal(s.row("SELECT quantity FROM accessories")!.quantity, 1);
  assert.equal(s.invoke("snapshot", {}).reports[0].receivable, 50);
  s.invoke("return", {
    request: randomUUID(),
    id,
    refund: 50,
    reason: "Second returned",
    method: "Cash",
    items: [{ saleItem: 1, quantity: 1, restock: true }],
  });
  assert.equal(s.invoke("snapshot", {}).reports[0].receivable, 0);
  s.invoke("return", {
    request: randomUUID(),
    id,
    refund: 100,
    reason: "Last returned",
    method: "Cash",
    items: [{ saleItem: 1, quantity: 1, restock: true }],
  });
  assert.equal(s.row("SELECT SUM(revenue) n FROM returns")!.n, 299);
  assert.equal(s.paid("sale", id), 0);
  assert.equal(s.row("SELECT quantity FROM accessories")!.quantity, 3);
  assert.equal(s.invoke("snapshot", {}).reports[0].revenue, 0);
  assert.throws(
    () => s.invoke("return", { ...first, request: randomUUID() }),
    /FINALIZED/,
  );
  s.db.close();
});
test("period reports post refunds at return date instead of rewriting original sales period", () => {
  const s = shop();
  purchase(s);
  sale(s);
  s.run("UPDATE sales SET created=?", "2025-01-01T12:00:00.000Z");
  s.invoke("return", {
    request: randomUUID(),
    id: 1,
    refund: 70000,
    reason: "Later return",
    method: "Cash",
  });
  const historic = s.invoke("snapshot", {
    from: "2025-01-01",
    to: "2025-01-01",
  }).reports[0];
  assert.equal(historic.revenue, 150000);
  assert.equal(historic.cogs, 110000);
  assert.equal(s.invoke("snapshot", {}).reports[0].revenue, 0);
  s.db.close();
});
test("repair cancellation refunds deposits, closing is immutable and reopening creates a linked new ticket", () => {
  const s = shop();
  const id = s.invoke("repair", {
    contactId: customer(s),
    device: "Device",
    identifier: "R1",
    problem: "Inspection",
    estimate: 10000,
    currency: "MMK",
  });
  s.invoke("payment", {
    request: randomUUID(),
    target: "repair",
    id,
    amount: 5000,
    method: "Cash",
  });
  s.invoke("repairCancel", {
    id,
    reason: "Customer cancelled",
    method: "Cash",
  });
  assert.equal(s.paid("repair", id), 0);
  assert.throws(
    () =>
      s.invoke("repairUpdate", {
        id,
        status: "Diagnosing",
        approved: false,
        final: 0,
        reason: "Try reopen",
      }),
    /FINALIZED/,
  );
  const linked = s.invoke("repairReopen", { id, reason: "Customer returned" });
  assert.notEqual(linked, id);
  assert.equal(
    s.row("SELECT original_repair FROM repairs WHERE id=?", linked)!
      .original_repair,
    id,
  );
  assert.equal(
    s.row("SELECT status FROM repairs WHERE id=?", id)!.status,
    "Cancelled",
  );
  s.db.close();
});
test("repair warranty claims require an unexpired delivered ticket and manager resolutions are audited", () => {
  const s = shop();
  const id = s.invoke("repair", {
    contactId: customer(s),
    device: "Device",
    identifier: "R2",
    problem: "Inspection",
    estimate: 10000,
    currency: "MMK",
  });
  assert.throws(
    () => s.invoke("warranty", { repairId: id, reason: "Early claim" }),
    /WARRANTY_EXPIRED/,
  );
  s.invoke("repairUpdate", {
    id,
    status: "Delivered",
    approved: true,
    final: 0,
    warrantyDays: 7,
    reason: "Complimentary repair",
  });
  const claim = s.invoke("warranty", { repairId: id, reason: "Repeat issue" });
  s.invoke("warrantyUpdate", {
    id: claim,
    status: "resolved",
    resolution: "Repaired under warranty",
  });
  assert.equal(
    s.row("SELECT status FROM warranty_claims WHERE id=?", claim)!.status,
    "resolved",
  );
  s.db.close();
});
test("structured phone inspection is persisted and historical receipts preserve original store/warranty terms", () => {
  const s = shop();
  s.invoke("settings", {
    language: "my-MM",
    currency: "MMK",
    region: "MM",
    timezone: "Asia/Yangon",
    digits: "latn",
    store: "Original shop",
    phone: "",
    address: "",
    footer: "Original warranty",
    receipt: "80mm",
  });
  purchase(s, {
    storage: "256GB",
    ram: "8GB",
    batteryHealth: 87,
    screen: "working",
    camera: "faulty",
    serial: "SN-123",
  });
  const inspection = JSON.parse(
    s.row("SELECT inspection FROM phones")!.inspection,
  );
  assert.equal(inspection.storage, "256GB");
  assert.equal(inspection.batteryHealth, 87);
  assert.equal(inspection.faceId, "unknown");
  sale(s, {
    items: [
      {
        kind: "phone",
        id: 1,
        quantity: 1,
        price: 150000,
        warrantyDays: 30,
        warrantyType: "manufacturer",
      },
    ],
  });
  assert.equal(
    s.row("SELECT warranty_type FROM sale_items")!.warranty_type,
    "manufacturer",
  );
  s.invoke("settings", {
    language: "th-TH",
    currency: "THB",
    region: "TH",
    timezone: "Asia/Bangkok",
    digits: "latn",
    store: "Renamed shop",
    phone: "",
    address: "",
    footer: "Changed terms",
    receipt: "A4",
  });
  assert.equal(s.invoice(1).settings.store, "Original shop");
  assert.equal(s.invoice(1).settings.footer, "Original warranty");
  assert.equal(s.invoice(1).currency, "MMK");
  s.db.close();
});
test("cash in/out entries reconcile the drawer without affecting profit and repeat requests are idempotent", () => {
  const s = shop();
  const session = s.invoke("cashSession", {
    action: "open",
    currency: "MMK",
    opening: 1000,
  });
  const input = {
    request: randomUUID(),
    direction: "in",
    amount: 500,
    currency: "MMK",
    reason: "Owner float",
  };
  s.invoke("cashMovement", input);
  s.invoke("cashMovement", input);
  s.invoke("cashMovement", {
    request: randomUUID(),
    direction: "out",
    amount: 200,
    currency: "MMK",
    reason: "Owner withdrawal",
  });
  const closed = s.invoke("cashSession", {
    action: "close",
    id: session,
    counted: 1300,
  });
  assert.equal(closed.expected, 1300);
  assert.equal(s.invoke("snapshot", {}).reports[0].net, 0);
  s.db.close();
});
test("purchase shortfall reversals recognize a loss once and purchase/repair receipts use their own ledger", () => {
  const s = shop();
  const session = s.invoke("cashSession", {
    action: "open",
    currency: "MMK",
    opening: 100000,
  });
  const id = purchase(s);
  const purchaseReceipt = s.invoice(id, "purchase");
  assert.equal(purchaseReceipt.total, 110000);
  assert.equal(purchaseReceipt.paid, 60000);
  assert.match(receiptHTML(purchaseReceipt), /PUR-000001/);
  s.invoke("purchaseReverse", {
    request: randomUUID(),
    id,
    refund: 50000,
    method: "Cash",
    reason: "Refurbishment not refunded",
  });
  assert.equal(s.invoke("snapshot", {}).reports[0].net, -10000);
  const closed = s.invoke("cashSession", {
    action: "close",
    id: session,
    counted: 90000,
  });
  assert.equal(closed.expected, 90000);
  const ticket = s.invoke("repair", {
    contactId: customer(s),
    device: "Repair device",
    identifier: "R99",
    problem: "Screen",
    estimate: 5000,
    currency: "MMK",
  });
  assert.match(receiptHTML(s.invoice(ticket, "repair")), /REP-000001/);
  s.db.close();
});
