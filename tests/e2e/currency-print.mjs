import { _electron as electron, expect } from "@playwright/test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
const directory = await mkdtemp(join(tmpdir(), "pos-fx-print-"));
await mkdir("test-results/receipts", { recursive: true });
const application = await electron.launch({
  args: [
    resolve("."),
    ...(process.platform === "linux"
      ? ["--no-sandbox", "--ozone-platform=headless", "--disable-gpu"]
      : []),
  ],
  env: {
    ...process.env,
    POS_TEST_DATA_DIR: directory,
    XDG_CONFIG_HOME: directory,
    XDG_CACHE_HOME: join(directory, "cache"),
  },
});
const results = [];
try {
  const page = await application.firstWindow();
  page.setDefaultTimeout(15000);
  console.log("stage: launched");
  await page.setViewportSize({ width: 1440, height: 960 });
  const call = async (op, input = {}) => {
    const result = await page.evaluate(
      ({ op, input }) => window.pos.call(op, input),
      { op, input },
    );
    expect(result.ok, `${op}: ${result.error || ""}`).toBe(true);
    return result.data;
  };
  console.log("stage: setup");
  await call("setup", {
    username: "print-owner",
    password: "synthetic-test-password",
  });
  await page.reload();
  await page.getByRole("combobox").first().selectOption("en-US");
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }).first(),
  ).toBeVisible();
  const rateId = await call("rate", {
    from: "USD",
    to: "MMK",
    numerator: 1000,
    denominator: 1,
    source: "Approved synthetic rate",
  });
  await call("accessory", {
    sku: "UNICODE-1",
    name: "Cable မြန်မာ ไทย",
    category: "Cable",
    cost: 1000,
    price: 3000,
    currency: "MMK",
    quantity: 2,
    reorder: 0,
    method: "Cash",
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Checkout", exact: true }).click();
  await page.getByRole("button", { name: /Cable မြန်မာ ไทย/ }).click();
  await page.getByLabel("Discount", { exact: true }).fill("100");
  // Native tender is USD 2.90; USD 5.00 received and USD 2.10 change.
  console.log("stage: tender");
  await page.getByLabel("Tender currency", { exact: true }).selectOption("USD");
  await page
    .getByLabel("Authorized exchange rate", { exact: true })
    .selectOption(String(rateId));
  await page.getByLabel("Amount", { exact: true }).fill("2.90");
  await page
    .getByLabel("Cash handed over (optional)", { exact: true })
    .fill("5.00");
  await page.getByRole("button", { name: /Finalize sale/ }).click();
  await expect(
    page.getByRole("cell", { name: "INV-0000001", exact: true }),
  ).toBeVisible();
  console.log("stage: sale");
  const snapshot = await call("snapshot");
  const payment = snapshot.payments.find((p) => p.target === "sale");
  expect(payment.amount).toBe(2900);
  expect(payment.original_amount).toBe(290);
  expect(payment.original_currency).toBe("USD");
  expect(payment.change_amount).toBe(210);
  const printers = await call("printers");
  for (const language of ["en-US", "my-MM", "th-TH"])
    for (const paper of ["58mm", "80mm", "A4"]) {
      const popup = page.context().waitForEvent("page");
      await call("receipt", {
        id: 1,
        kind: "sale",
        preview: true,
        language,
        paper,
      });
      const receipt = await popup;
      await receipt.setViewportSize({ width: 600, height: 850 });
      await receipt.waitForLoadState();
      await receipt.evaluate(async () => {
        await document.fonts.ready;
        await document.fonts.load("12px Myanmar", "မြန်မာ");
        await document.fonts.load("12px Thai", "ไทย");
      });
      const text = await receipt.locator("body").innerText();
      expect(text).toContain("Cable မြန်မာ ไทย");
      expect(text).toContain("#" + rateId);
      expect(
        await receipt.evaluate(
          () =>
            document.fonts.check("12px Myanmar", "မြန်မာ") &&
            document.fonts.check("12px Thai", "ไทย"),
        ),
      ).toBe(true);
      await receipt.screenshot({
        path: `test-results/receipts/${language}-${paper}.png`,
        fullPage: true,
      });
      const bytes = await application.evaluate(async ({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith("/receipt.html"),
        );
        return Array.from(
          await w.webContents.printToPDF({
            printBackground: true,
            preferCSSPageSize: true,
          }),
        );
      });
      const file = `test-results/receipts/${language}-${paper}.pdf`;
      await writeFile(file, Buffer.from(bytes));
      const info = execFileSync("pdfinfo", [file], { encoding: "utf8" });
      const dimensions = info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);
      expect(dimensions).not.toBe(null);
      const width = (Number(dimensions[1]) * 25.4) / 72;
      expect(
        Math.abs(width - (paper === "A4" ? 210 : paper === "58mm" ? 58 : 80)),
      ).toBeLessThan(1);
      const extracted = execFileSync("pdftotext", [file, "-"], {
        encoding: "utf8",
      });
      expect(extracted).toContain("INV-0000001");
      expect(extracted).toContain("Cable");
      expect(extracted).toContain("2,900");
      expect(extracted).toContain("5.00");
      expect(extracted).toContain("2.10");
      expect(extracted).toMatch(/[\u1000-\u109f]/);
      expect(extracted).toMatch(/[\u0e00-\u0e7f]/);
      results.push({
        language,
        paper,
        file,
        widthMM: Number(width.toFixed(2)),
        unicodeFontsLoaded: true,
        pdfTextScriptsVerified: true,
      });
      await receipt.close();
    }
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  const usdReport = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "USD", exact: true }) });
  await expect(usdReport).toContainText("$2.90");
  await writeFile(
    "test-results/receipt-results.json",
    JSON.stringify(
      {
        results,
        detectedPrinters: printers.length,
        physicalPrinting: "PENDING: no hardware tested",
        visualShapingReview: "PENDING: native reader and printer acceptance",
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS: actual Electron checkout MMK invoice/USD tender/discount/change; ${results.length} Unicode PDF receipts, measured 58mm/80mm/A4; ${printers.length} OS printers detected. Physical printing PENDING.`,
  );
} finally {
  await application.close();
  await rm(directory, { recursive: true, force: true });
}
