import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase } from "../src/main/database";
import { ShopService } from "../src/main/service";
import { convertMinor, exactAggregate } from "../src/shared/exchange";
import type { Currency } from "../src/shared/contracts";
const owner = { username: "owner", password: "owner long password" };
function shop() {
  const s = new ShopService(openDatabase(":memory:"));
  s.invoke("setup", owner);
  s.invoke("contact", { name: "Buyer", kind: "customer" });
  return s;
}
function rate(s: ShopService, from: Currency, to: Currency, n = 2100, d = 1) {
  return s.invoke("rate", {
    from,
    to,
    numerator: n,
    denominator: d,
    source: "Approved shop counter quote",
  });
}
function stock(
  s: ShopService,
  currency: Currency = "MMK",
  cost = 1000,
  price = 3000,
) {
  return s.invoke("accessory", {
    sku: randomUUID(),
    name: "Cable",
    category: "Cable",
    cost,
    price,
    currency,
    quantity: 10,
    reorder: 0,
    method: "Cash",
  });
}
function sale(
  s: ShopService,
  items: any[],
  payments: any[],
  currency: Currency = "MMK",
  extra: any = {},
) {
  return s.invoke("sale", {
    request: randomUUID(),
    currency,
    contactId: 1,
    items,
    payments,
    ...extra,
  });
}
function line(id: number, price = 3000, quantity = 1, rateId?: number) {
  return { kind: "accessory", id, price, quantity, rateId };
}
function refund(s: ShopService, id: number, amount: number, items?: any[]) {
  return s.invoke("return", {
    request: randomUUID(),
    id,
    refund: amount,
    items,
    reason: "Customer return",
    method: "Cash",
  });
}
function summary(s: ShopService, c: Currency) {
  return s.invoke("snapshot", {}).reports.find((r: any) => r.currency === c);
}
test("all six currency directions use major-unit rational rates and explicit precision", () => {
  for (const from of ["MMK", "THB", "USD"] as Currency[])
    for (const to of ["MMK", "THB", "USD"] as Currency[]) {
      const source = from === "MMK" ? 10 : 1000;
      const expected = to === "MMK" ? 20 : 2000;
      assert.equal(convertMinor(source, from, to, 2, 1), expected);
    }
  assert.equal(convertMinor(1, "USD", "MMK", 50, 1), 1); // 0.5 kyat => 1
  assert.equal(convertMinor(1, "THB", "USD", 1, 2), 1); // half cent => 1 cent
  assert.equal(convertMinor(1, "MMK", "THB", 1, 3), 33);
  assert.equal(convertMinor(1, "USD", "MMK", 1, 1), 0);
});
test("invalid rates and overflow fail, rate creation requires owner/admin, stored rates are immutable", () => {
  assert.equal(
    exactAggregate(Number.MAX_SAFE_INTEGER, 2, -2),
    Number.MAX_SAFE_INTEGER,
  );
  assert.throws(
    () => exactAggregate(Number.MAX_SAFE_INTEGER, 1),
    /INVALID_MONEY/,
  );
  assert.throws(
    () => exactAggregate(Number.MIN_SAFE_INTEGER, -1),
    /INVALID_MONEY/,
  );
  const s = shop();
  for (const numerator of [0, -1, Infinity, 1.5])
    assert.throws(() => rate(s, "USD", "MMK", numerator));
  assert.throws(() => rate(s, "USD", "USD"));
  assert.throws(
    () => convertMinor(1e12, "MMK", "USD", 1e9, 1),
    /INVALID_MONEY/,
  );
  const id = rate(s, "USD", "MMK");
  assert.throws(
    () => s.run("UPDATE exchange_rates SET numerator=1 WHERE id=?", id),
    /IMMUTABLE_RATE/,
  );
  s.invoke("users", {
    username: "cashier",
    password: "cashier password 123",
    role: "Cashier",
  });
  s.invoke("logout");
  s.invoke("login", { username: "cashier", password: "cashier password 123" });
  assert.throws(() => rate(s, "USD", "MMK"), /FORBIDDEN/);
  s.db.close();
});
test("partial foreign payment stores original tender and immutable rate while ledger stays in invoice units", () => {
  const s = shop();
  const id = stock(s, "MMK", 1000, 5000);
  const invoice = sale(s, [line(id, 5000)], []);
  const rateId = rate(s, "USD", "MMK", 2000);
  const input = {
    request: randomUUID(),
    id: invoice,
    target: "sale",
    currency: "USD",
    amount: 100,
    rateId,
    method: "Cash",
  };
  s.invoke("payment", input);
  s.invoke("payment", input);
  const p = s.row("SELECT * FROM payments")!;
  assert.equal(p.amount, 2000);
  assert.equal(p.original_amount, 100);
  assert.equal(p.original_currency, "USD");
  const fx = JSON.parse(p.fx);
  assert.equal(fx.rate.source, "Approved shop counter quote");
  assert.equal(fx.rate.from, "USD");
  assert.equal(fx.rate.to, "MMK");
  assert.ok(fx.rate.created);
  assert.ok(fx.appliedAt);
  assert.equal(summary(s, "MMK").receivable, 3000);
  assert.equal(summary(s, "USD").cashNet, 100);
  assert.equal(summary(s, "MMK").cashNet, 0);
  const next = rate(s, "USD", "MMK", 3000);
  s.invoke("payment", { ...input, request: randomUUID(), rateId: next });
  assert.equal(s.paid("sale", invoice), 5000);
  assert.equal(
    JSON.parse(s.row("SELECT fx FROM payments ORDER BY id LIMIT 1")!.fx).rate
      .numerator,
    2000,
  );
  s.db.close();
});
test("missing/wrong pairs and conversions rounding to zero cannot silently accept money", () => {
  const s = shop();
  const id = stock(s);
  const invoice = sale(s, [line(id)], []);
  const wrong = rate(s, "THB", "MMK", 60);
  assert.throws(
    () =>
      s.invoke("payment", {
        request: randomUUID(),
        id: invoice,
        target: "sale",
        amount: 100,
        currency: "USD",
        rateId: wrong,
        method: "Cash",
      }),
    /RATE_REQUIRED/,
  );
  const tiny = rate(s, "USD", "MMK", 1);
  assert.throws(
    () =>
      s.invoke("payment", {
        request: randomUUID(),
        id: invoice,
        target: "sale",
        amount: 1,
        currency: "USD",
        rateId: tiny,
        method: "Cash",
      }),
    /ZERO_CONVERSION/,
  );
  assert.equal(s.row("SELECT COUNT(*) n FROM payments")!.n, 0);
  s.db.close();
});
test("mixed-currency cart freezes per-unit original prices/costs and profit in invoice currency", () => {
  const s = shop();
  const id = stock(s, "USD", 100, 200);
  const rateId = rate(s, "USD", "MMK", 2000);
  const invoice = sale(
    s,
    [line(id, 4000, 2, rateId)],
    [{ amount: 8000, method: "Cash" }],
  );
  const stored = s.row("SELECT * FROM sale_items")!;
  assert.equal(stored.cost, 2000);
  assert.equal(JSON.parse(stored.fx).cost.originalAmount, 100);
  assert.equal(summary(s, "MMK").gross, 4000);
  refund(s, invoice, 4000, [
    { saleItem: stored.id, quantity: 1, restock: true },
  ]);
  assert.equal(summary(s, "MMK").revenue, 4000);
  assert.equal(summary(s, "MMK").cogs, 2000);
  s.db.close();
});
test("fractional foreign refunds carry rounding and return every original minor unit at full return", () => {
  const s = shop();
  const item = stock(s, "MMK", 1, 1);
  const rateId = rate(s, "USD", "MMK", 3);
  const invoice = sale(
    s,
    [line(item, 1, 3)],
    [{ amount: 100, currency: "USD", rateId, method: "Cash" }],
  );
  const saleItem = s.row("SELECT id FROM sale_items")!.id;
  refund(s, invoice, 1, [{ saleItem, quantity: 1, restock: true }]);
  assert.equal(summary(s, "USD").cashNet, 67);
  refund(s, invoice, 1, [{ saleItem, quantity: 1, restock: true }]);
  assert.equal(summary(s, "USD").cashNet, 34);
  refund(s, invoice, 1, [{ saleItem, quantity: 1, restock: true }]);
  assert.equal(summary(s, "USD").cashNet, 0);
  assert.equal(s.paid("sale", invoice), 0);
  assert.deepEqual(
    s
      .rows(
        "SELECT original_amount FROM payments WHERE direction='out' ORDER BY id",
      )
      .map((r) => r.original_amount),
    [33, 33, 34],
  );
  s.db.close();
});
test("return reduces debt first, refunds original split tenders and never uses a newer rate", () => {
  const s = shop();
  const id = stock(s, "MMK", 20, 100);
  const rateId = rate(s, "USD", "MMK", 200);
  const invoice = sale(
    s,
    [line(id, 100, 3)],
    [
      { amount: 100, currency: "USD", rateId, method: "Cash" },
      { amount: 50, method: "KBZPay" },
    ],
  );
  rate(s, "USD", "MMK", 99);
  refund(s, invoice, 50, [{ saleItem: 1, quantity: 1, restock: true }]);
  assert.equal(summary(s, "MMK").receivable, 0);
  assert.equal(summary(s, "USD").cashNet, 7500 / 100);
  refund(s, invoice, 200);
  assert.equal(summary(s, "USD").cashNet, 0);
  assert.equal(summary(s, "MMK").actualCollections, 0);
  s.db.close();
});
test("cross-currency purchase, supplier payment and reversal restore original cash and count refurbishment once", () => {
  const s = shop();
  const rateId = rate(s, "USD", "MMK", 2000);
  const purchase = s.invoke("purchase", {
    request: randomUUID(),
    contactId: 1,
    currency: "MMK",
    brand: "Apple",
    model: "Phone",
    imei1: "490154203237518",
    condition: "used",
    grade: "A",
    cost: 4000,
    refurbishment: 500,
    price: 6000,
    paid: 100,
    paidCurrency: "USD",
    paidRateId: rateId,
    method: "Cash",
  });
  assert.equal(s.purchasePaid(purchase), 2500);
  assert.equal(summary(s, "MMK").payable, 2000);
  assert.equal(summary(s, "USD").cashNet, -100);
  assert.equal(summary(s, "MMK").cashNet, -500);
  s.invoke("purchaseReverse", {
    id: purchase,
    request: randomUUID(),
    reason: "Cancelled",
    method: "Cash",
  });
  assert.equal(summary(s, "USD").cashNet, 0);
  assert.equal(summary(s, "MMK").cashNet, 0);
  s.db.close();
});
test("foreign-valued trade-in keeps native acquisition and reverses both original noncash legs", () => {
  const s = shop();
  const id = stock(s, "MMK", 1000, 5000);
  const rateId = rate(s, "USD", "MMK", 2000);
  const invoice = sale(
    s,
    [line(id, 5000)],
    [{ amount: 3000, method: "Cash" }],
    "MMK",
    {
      tradeIn: {
        currency: "USD",
        rateId,
        brand: "Samsung",
        model: "Trade",
        imei1: "356938035643809",
        condition: "used",
        grade: "B",
        cost: 100,
        price: 200,
        minimum: 0,
      },
    },
  );
  const tinyRate = rate(s, "USD", "MMK", 1);
  assert.throws(
    () =>
      sale(s, [line(id, 5000)], [], "MMK", {
        tradeIn: {
          currency: "USD",
          rateId: tinyRate,
          brand: "Test",
          model: "Zero credit",
          imei1: "490154203237518",
          condition: "used",
          grade: "B",
          cost: 1,
          price: 100,
        },
      }),
    /ZERO_CONVERSION/,
  );
  const acquisition = s.row("SELECT * FROM purchases")!;
  assert.equal(acquisition.currency, "USD");
  assert.equal(acquisition.cost, 100);
  assert.equal(s.purchasePaid(acquisition.id), 100);
  assert.equal(summary(s, "MMK").received, 3000);
  assert.equal(summary(s, "USD").cashNet, 0);
  refund(s, invoice, 3000);
  assert.equal(s.purchasePaid(acquisition.id), 0);
  assert.equal(summary(s, "MMK").cashNet, 0);
  s.db.close();
});
test("repair foreign deposit and cancellation refund preserve source units", () => {
  const s = shop();
  const id = s.invoke("repair", {
    contactId: 1,
    device: "Phone",
    identifier: "R1",
    problem: "Screen",
    estimate: 4000,
    currency: "MMK",
  });
  const rateId = rate(s, "THB", "MMK", 50);
  s.invoke("payment", {
    request: randomUUID(),
    target: "repair",
    id,
    amount: 4000,
    currency: "THB",
    rateId,
    method: "Cash",
  });
  assert.equal(s.paid("repair", id), 2000);
  s.invoke("repairCancel", { id, reason: "Cancelled", method: "Cash" });
  assert.equal(summary(s, "THB").cashNet, 0);
  s.db.close();
});
test("changing default preferences never revalues posted invoices; converted report saves original totals and applied rates", () => {
  const s = shop();
  const item = stock(s);
  sale(s, [line(item)], [{ amount: 3000, method: "Cash" }]);
  const prior = s.invoice(1);
  s.invoke("settings", {
    language: "en-US",
    currency: "USD",
    region: "US",
    timezone: "UTC",
    digits: "latn",
    store: "Shop",
    phone: "",
    address: "",
    footer: "",
    receipt: "80mm",
  });
  assert.equal(s.invoice(1).currency, "MMK");
  assert.equal(s.invoice(1).total, prior.total);
  const rateId = rate(s, "MMK", "USD", 1, 2000);
  const report = s.invoke("reportConvert", {
    currency: "USD",
    rates: [rateId],
  });
  assert.equal(report.totals.revenue, "150");
  assert.equal(report.totals.cogs, "50");
  assert.equal(report.totals.net, "100");
  assert.equal(report.converted[0].original.revenue, 3000);
  assert.equal(report.converted[0].rate.id, rateId);
  assert.equal(s.row("SELECT COUNT(*) n FROM report_runs")!.n, 1);
  s.db.close();
});
test("cash received and change preserve source precision without double-counting physical cash", () => {
  const s = shop();
  const id = stock(s, "MMK", 100, 2000);
  const rateId = rate(s, "USD", "MMK", 2000);
  const invoice = sale(
    s,
    [line(id, 2000)],
    [{ amount: 100, received: 200, currency: "USD", rateId, method: "Cash" }],
  );
  const p = s.row("SELECT * FROM payments")!;
  assert.equal(p.received_amount, 200);
  assert.equal(p.change_amount, 100);
  assert.equal(p.original_amount, 100);
  assert.equal(summary(s, "USD").cashNet, 100);
  assert.equal(s.invoice(invoice).paid, 2000);
  s.db.close();
});
test("atomic exchange rolls back the return when replacement stock fails, then links both legs idempotently", () => {
  const s = shop();
  const id = stock(s);
  const original = sale(s, [line(id)], [{ amount: 3000, method: "Cash" }]);
  const request = randomUUID();
  const returned = {
    id: original,
    refund: 3000,
    reason: "Exchange",
    method: "Cash",
  };
  const replacement = {
    currency: "MMK",
    items: [line(999)],
    payments: [{ amount: 3000, method: "Cash" }],
  };
  assert.throws(() =>
    s.invoke("exchange", { request, return: returned, sale: replacement }),
  );
  assert.equal(
    s.row("SELECT status FROM sales WHERE id=?", original)!.status,
    "posted",
  );
  assert.equal(s.row("SELECT COUNT(*) n FROM returns")!.n, 0);
  assert.equal(
    s.row("SELECT quantity FROM accessories WHERE id=?", id)!.quantity,
    9,
  );
  replacement.items = [line(id)];
  const result = s.invoke("exchange", {
    request,
    return: returned,
    sale: replacement,
  });
  assert.deepEqual(
    s.invoke("exchange", { request, return: returned, sale: replacement }),
    result,
  );
  assert.equal(s.row("SELECT COUNT(*) n FROM exchanges")!.n, 1);
  assert.equal(
    s.row("SELECT quantity FROM accessories WHERE id=?", id)!.quantity,
    9,
  );
  assert.equal(summary(s, "MMK").received, 3000);
  s.db.close();
});
test("custom methods are authorized and validated; deactivation preserves historical payments", () => {
  const s = shop();
  const id = stock(s);
  s.invoke("paymentMethod", { name: "PromptPay", active: true });
  const invoice = sale(s, [line(id)], [{ amount: 3000, method: "PromptPay" }]);
  s.invoke("paymentMethod", { name: "PromptPay", active: false });
  assert.throws(
    () => sale(s, [line(id)], [{ amount: 3000, method: "PromptPay" }]),
    /INVALID_METHOD/,
  );
  refund(s, invoice, 3000); // refunds original historical method even after deactivation
  assert.equal(
    s.row(
      "SELECT method FROM payments WHERE target='sale' AND direction='out'",
    )!.method,
    "PromptPay",
  );
  s.invoke("users", {
    username: "cashier",
    password: "cashier long password",
    role: "Cashier",
  });
  s.invoke("logout");
  s.invoke("login", { username: "cashier", password: "cashier long password" });
  assert.throws(
    () => s.invoke("paymentMethod", { name: "Injected", active: true }),
    /FORBIDDEN/,
  );
  s.db.close();
});
test("configured wholesale pricing preserves COGS and owner permission overrides", () => {
  const s = shop();
  const id = s.invoke("accessory", {
    sku: "WHOLE",
    name: "Cable",
    category: "Cable",
    cost: 1000,
    price: 3000,
    wholesale: 2000,
    currency: "MMK",
    quantity: 10,
    reorder: 0,
    method: "Cash",
  });
  sale(
    s,
    [{ ...line(id, 2000), pricingTier: "wholesale" }],
    [{ amount: 2000, method: "Cash" }],
  );
  assert.equal(summary(s, "MMK").gross, 1000);
  s.invoke("users", {
    username: "till",
    password: "cashier long password",
    role: "Cashier",
  });
  s.invoke("logout");
  s.invoke("login", { username: "till", password: "cashier long password" });
  assert.throws(
    () => sale(s, [{ ...line(id, 1900), pricingTier: "wholesale" }], []),
    /DISCOUNT/,
  );
  s.invoke("logout");
  s.invoke("login", owner);
  const absent = stock(s);
  assert.throws(
    () => sale(s, [{ ...line(absent), pricingTier: "wholesale" }], []),
    /WHOLESALE/,
  );
  s.db.close();
});
test("foreign repair parts freeze converted unit cost and retain native cost evidence", () => {
  const s = shop();
  const part = stock(s, "USD", 100, 200);
  const r = rate(s, "USD", "MMK", 3000);
  const ticket = s.invoke("repair", {
    contactId: 1,
    device: "Phone",
    identifier: "PART-R1",
    problem: "Cable",
    estimate: 10000,
    currency: "MMK",
  });
  s.invoke("repairUpdate", {
    id: ticket,
    status: "Diagnosing",
    diagnosis: "Approved work",
    approved: true,
    final: 10000,
    warrantyDays: 0,
    reason: "Manager approval",
  });
  s.invoke("repairPart", {
    request: randomUUID(),
    id: ticket,
    accessoryId: part,
    quantity: 2,
    rateId: r,
  });
  const entry = s.row("SELECT * FROM repair_parts")!;
  assert.equal(entry.cost, 6000);
  assert.equal(entry.currency, "MMK");
  assert.equal(JSON.parse(entry.fx).unit.originalAmount, 100);
  assert.equal(JSON.parse(entry.fx).unit.rate.id, r);
  assert.equal(
    s.row("SELECT quantity FROM accessories WHERE id=?", part)!.quantity,
    8,
  );
  s.db.close();
});
test("historical receivables retain debt before later returns and payments", () => {
  const s = shop();
  const id = stock(s);
  const invoice = sale(s, [line(id)], []);
  s.run(
    "UPDATE sales SET created='2026-01-01T12:00:00.000Z' WHERE id=?",
    invoice,
  );
  const before = s.invoke("snapshot", { from: "2026-01-01", to: "2026-01-01" })
    .reports[0];
  assert.equal(before.receivable, 3000);
  refund(s, invoice, 0);
  assert.equal(summary(s, "MMK").receivable, 0);
  assert.equal(
    s.invoke("snapshot", { to: "2026-01-01" }).reports[0].receivable,
    3000,
  );
  s.db.close();
});
test("structured inspection corrections are audited and blocked after a phone is sold", () => {
  const s = shop();
  s.invoke("purchase", {
    request: randomUUID(),
    contactId: 1,
    currency: "MMK",
    brand: "Test",
    model: "Device",
    imei1: "490154203237518",
    condition: "used",
    grade: "A",
    cost: 1000,
    price: 3000,
    paid: 1000,
    method: "Cash",
  });
  s.invoke("inspectionUpdate", {
    id: 1,
    reason: "Retested",
    inspection: { screen: "working", batteryHealth: 95 },
    details: "Verified",
  });
  assert.equal(
    JSON.parse(s.row("SELECT inspection FROM phones")!.inspection)
      .batteryHealth,
    95,
  );
  assert.equal(
    s.row("SELECT COUNT(*) n FROM audit WHERE action='phone.inspection'")!.n,
    1,
  );
  sale(
    s,
    [{ kind: "phone", id: 1, quantity: 1, price: 3000 }],
    [{ amount: 3000, method: "Cash" }],
  );
  assert.throws(
    () =>
      s.invoke("inspectionUpdate", {
        id: 1,
        reason: "Too late",
        inspection: { screen: "faulty" },
        details: "",
      }),
    /STOCK_UNAVAILABLE/,
  );
  s.db.close();
});
test("supplier balances and purchase reversals are reported as of their own posting dates", () => {
  const s = shop();
  const id = s.invoke("purchase", {
    request: randomUUID(),
    contactId: 1,
    currency: "MMK",
    brand: "Test",
    model: "Device",
    imei1: "490154203237518",
    condition: "used",
    grade: "A",
    cost: 1000,
    price: 3000,
    paid: 0,
    method: "Cash",
  });
  s.run(
    "UPDATE purchases SET created='2026-01-01T12:00:00.000Z' WHERE id=?",
    id,
  );
  s.invoke("purchaseReverse", {
    request: randomUUID(),
    id,
    reason: "Supplier cancelled",
    refund: 0,
    method: "Cash",
  });
  assert.equal(summary(s, "MMK").payable, 0);
  assert.equal(s.invoke("contactHistory", { id: 1 }).purchases[0].balance, 0);
  const old = s.invoke("snapshot", { from: "2026-01-01", to: "2026-01-01" })
    .reports[0];
  assert.equal(old.payable, 1000);
  assert.equal(old.purchases, 1000);
  const later = s.invoke("snapshot", {
    from: new Date().toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  }).reports[0];
  assert.equal(later.purchases, -1000);
  s.db.close();
});
