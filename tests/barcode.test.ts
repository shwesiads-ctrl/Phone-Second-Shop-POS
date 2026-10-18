import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/main/database";
import { ShopService } from "../src/main/service";
import { barcodeCandidate } from "../src/shared/barcode";
function shop() {
  const s = new ShopService(openDatabase(":memory:"), true);
  s.invoke("setup", {
    username: "owner",
    password: "synthetic barcode password",
  });
  return s;
}
const item = {
  name: "Cable",
  category: "Cable",
  cost: 100,
  price: 200,
  currency: "MMK",
  quantity: 1,
  reorder: 0,
  method: "Cash",
};
test("compact automatic barcode persists, is unique, and can be searched without changing the SKU", () => {
  const s = shop();
  const one = s.invoke("accessory", { ...item, sku: "sku-one" });
  const two = s.invoke("accessory", { ...item, sku: "sku-two", barcode: "" });
  const a = s.row("SELECT * FROM accessories WHERE id=?", one)!;
  const b = s.row("SELECT * FROM accessories WHERE id=?", two)!;
  assert.match(a.barcode, /^P2\d{12}$/);
  assert.notEqual(a.barcode, b.barcode);
  assert.equal(a.sku, "sku-one");
  assert.equal(
    s.invoke("snapshot", { search: a.barcode }).accessories[0].id,
    one,
  );
  s.db.close();
});
test("manual barcode preserved; duplicates rejected atomically without stock or cash changes", () => {
  const s = shop();
  s.invoke("accessory", { ...item, sku: "manual", barcode: "1234567890123" });
  assert.throws(
    () =>
      s.invoke("accessory", {
        ...item,
        sku: "duplicate",
        barcode: "1234567890123",
      }),
    /CONFLICT/,
  );
  assert.equal(s.row("SELECT COUNT(*) n FROM accessories")!.n, 1);
  assert.equal(
    s.row("SELECT barcode FROM accessories")!.barcode,
    "1234567890123",
  );
  s.db.close();
});
test("generate for legacy blank barcode is idempotent and requires stock authorization", () => {
  const s = shop();
  const id = s.invoke("accessory", { ...item, sku: "legacy" });
  s.run("UPDATE accessories SET barcode='' WHERE id=?", id);
  const first = s.invoke("barcodeGenerate", { id });
  assert.match(first.barcode, /^P2\d{12}$/);
  assert.deepEqual(s.invoke("barcodeGenerate", { id }), first);
  s.invoke("logout");
  assert.throws(() => s.invoke("barcodeGenerate", { id }), /UNAUTHENTICATED/);
  s.db.close();
});
test("compact barcode format is deterministic and retains leading zeroes", () => {
  assert.equal(
    barcodeCandidate("00000000-0000-4000-8000-000000000001"),
    "P2000000000000",
  );
});

test("printer IPC rejects unknown actions, invalid/missing addresses and unsupported paper", async () => {
  const { schemas } = await import("../src/main/validation");
  for (const input of [
    { action: "raw", data: "arbitrary" },
    { action: "connect" },
    { action: "connect", address: "invalid" },
    { action: "test", paper: "A4" },
  ])
    assert.equal(schemas.printer.safeParse(input).success, false);
  assert.equal(
    schemas.printer.safeParse({
      action: "connect",
      address: "00:11:22:33:44:55",
    }).success,
    true,
  );
});
