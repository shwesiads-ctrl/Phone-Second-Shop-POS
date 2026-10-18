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
