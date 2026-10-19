import test from "node:test";
import assert from "node:assert/strict";
import { sampleShop } from "../src/main/demo-workspace";
import { receiptHTML } from "../src/main/receipt";
import { dictionaries } from "../src/renderer/i18n";
test("repair receipt uses recorded contact/device/problem/diagnosis and does not invent a solution or add parts costs to invoice", () => {
  const s = sampleShop();
  const repair = s.row("SELECT * FROM repairs ORDER BY id LIMIT 1")!;
  s.run(
    "UPDATE contacts SET phone=? WHERE id=?",
    "SAMPLE-NUMBER",
    repair.contact_id,
  );
  s.run(
    "UPDATE repairs SET problem=?,diagnosis=? WHERE id=?",
    "No power <script>",
    "Board inspected ไทย မြန်မာ",
    repair.id,
  );
  const invoice = s.invoice(repair.id, "repair");
  assert.equal(invoice.customer_phone, "SAMPLE-NUMBER");
  assert.equal(invoice.device, repair.device);
  const html = receiptHTML(invoice, dictionaries["en-US"], true);
  assert.ok(html.includes("No power &lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("Board inspected ไทย မြန်မာ"));
  assert.ok(html.includes("SAMPLE-NUMBER"));
  assert.ok(html.includes('data-receipt-action="jpeg"'));
  assert.ok(!html.includes("Solution"));
  assert.equal(invoice.total, repair.final || repair.estimate);
  s.db.close();
});
test("export receipt omits action buttons and hides zero-day warranty boilerplate", () => {
  const s = sampleShop(),
    invoice = s.invoice(1);
  invoice.items[0].warranty_days = 0;
  invoice.items[0].warranty_type = "none";
  const html = receiptHTML(invoice, dictionaries["en-US"]);
  assert.ok(!html.includes("data-receipt-action="));
  assert.ok(!html.includes("Warranty days (0 = none): 0"));
  assert.ok(html.includes('id="receipt"'));
  assert.ok(html.includes('class="balance') || html.includes("detail balance"));
  s.db.close();
});
