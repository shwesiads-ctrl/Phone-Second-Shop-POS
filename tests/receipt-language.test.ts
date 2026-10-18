import test from "node:test";
import assert from "node:assert/strict";
import { printerTestHTML } from "../src/shared/printer-test";
import { dictionaries, type Language } from "../src/renderer/i18n";
for (const language of ["en-US", "my-MM", "th-TH"] as Language[]) {
  test(`printer receipt uses only selected generated labels: ${language}`, () => {
    for (const paper of ["58mm", "80mm"] as const) {
      const html = printerTestHTML(language, paper);
      const text = html.split("<body>")[1];
      assert.ok(text.includes(dictionaries[language].total));
      assert.ok(text.includes(dictionaries[language].change));
      assert.ok(text.includes("2,500 MMK"));
      if (language !== "my-MM") assert.doesNotMatch(text, /[\u1000-\u109f]/);
      if (language !== "th-TH") assert.doesNotMatch(text, /[\u0e00-\u0e7f]/);
      if (language !== "en-US") assert.ok(!text.includes("Test receipt"));
    }
  });
}

import { receiptHTML } from "../src/main/receipt";
for (const language of ["en-US", "my-MM", "th-TH"] as Language[]) {
  test(`invoice labels follow selected language while customer text survives: ${language}`, () => {
    const html = receiptHTML(
      {
        settings: {
          language,
          store: "Fixer Tools",
          receipt: "58mm",
          footer: "",
        },
        invoice: "INV-TEST",
        created: "2026-10-18T00:00:00Z",
        currency: "MMK",
        cashier_name: "Owner",
        customer: "Customer မြန်မာ ไทย",
        items: [],
        discount: 0,
        total: 3000,
        paid: 3000,
        status: "paid",
        payments: [],
      },
      dictionaries[language],
    );
    assert.ok(html.includes(`lang="${language}"`));
    assert.ok(html.includes(dictionaries[language].cashier));
    assert.ok(html.includes("Customer မြန်မာ ไทย"));
    for (const other of ["en-US", "my-MM", "th-TH"] as Language[]) {
      if (other !== language)
        assert.ok(!html.includes(`${dictionaries[other].cashier}:`));
    }
  });
}
