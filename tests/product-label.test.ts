import test from "node:test";
import assert from "node:assert/strict";
import {
  productLabelHTML,
  productLabelQuery,
} from "../src/shared/product-label";
import { DatabaseSync } from "node:sqlite";

test("product label contains one barcode, escaped Unicode name and currency precision", () => {
  for (const [currency, price, expected] of [
    ["USD", 1234, "12.34"],
    ["THB", 1234, "12.34"],
    ["MMK", 1234, "1,234"],
  ] as const) {
    const html = productLabelHTML(
      { name: "ဖုန်း ไทย <script>alert(1)</script>", price, currency },
      "data:image/svg+xml;base64,AAA",
      "en-US",
    );
    assert.equal((html.match(/<img /g) || []).length, 1);
    assert.ok(html.includes("ဖုန်း ไทย &lt;script&gt;"));
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes(expected));
    assert.ok(
      html.includes(
        currency === "USD" ? "$" : currency === "THB" ? "THB" : "MMK",
      ),
    );
    assert.ok(!html.includes("QR"));
    assert.ok(html.includes("receipt-myanmar.woff2"));
  }
});

test("label selects stored barcode, phone alternate fallback, actual name and price without writes", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE phones(id INTEGER,imei1 TEXT,alternate TEXT,imei2 TEXT,brand TEXT,model TEXT,price INTEGER,currency TEXT); CREATE TABLE accessories(id INTEGER,sku TEXT,barcode TEXT,name TEXT,price INTEGER,currency TEXT);",
  );
  db.prepare("INSERT INTO phones VALUES(1,?,?,?,?,?,?,?)").run(
    "",
    "P2123456789012",
    "",
    "Samsung",
    "A55",
    100000,
    "MMK",
  );
  db.prepare("INSERT INTO accessories VALUES(1,?,?,?,?,?)").run(
    "INTERNAL-SKU",
    "P2987654321012",
    "Case",
    1250,
    "USD",
  );
  const phone = db.prepare(productLabelQuery("phone")).get(1)!;
  assert.equal(phone.identifier, "P2123456789012");
  assert.equal(phone.name, "Samsung A55");
  const item = db.prepare(productLabelQuery("accessory")).get(1)!;
  assert.equal(item.identifier, "P2987654321012");
  assert.equal(item.price, 1250);
  db.exec("UPDATE accessories SET barcode=''");
  assert.equal(
    db.prepare(productLabelQuery("accessory")).get(1)!.identifier,
    "INTERNAL-SKU",
  );
  db.close();
});
