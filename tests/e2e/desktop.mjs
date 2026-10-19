import { _electron as electron, expect } from "@playwright/test";
import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const directory = await mkdtemp(join(tmpdir(), "pos-desktop-"));
await mkdir("test-results", { recursive: true });
const cloud = process.platform === "linux";
const application = await electron.launch({
  args: [
    resolve("."),
    ...(cloud
      ? ["--no-sandbox", "--ozone-platform=headless", "--disable-gpu"]
      : []),
  ],
  env: {
    ...process.env,
    POS_TEST_DATA_DIR: directory,
    XDG_CONFIG_HOME: directory,
    XDG_CACHE_HOME: join(directory, "cache"),
  },
  timeout: 30000,
});
application.process().stderr?.on("data", (data) => {
  if (data.toString().includes("POS operation failed"))
    process.stderr.write(data);
});
let completed = false;
try {
  const page = await application.firstWindow();
  await page.setViewportSize({ width: 1440, height: 960 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("combobox").first().selectOption("en-US");
  await page.getByLabel("Username", { exact: true }).fill("test-owner");
  await page
    .getByLabel("Password (10+ characters)", { exact: true })
    .fill("local-test-password-123");
  await page
    .getByRole("button", { name: "Create first owner", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Customers & suppliers", exact: true })
    .click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  let modal = page.getByRole("dialog");
  await modal.getByLabel("Name", { exact: true }).fill("Test Seller");
  await modal.getByLabel("Type", { exact: true }).selectOption("supplier");
  await modal.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Test Seller", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Purchasing", exact: true }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  modal = page.getByRole("dialog");
  await modal.getByLabel("Brand", { exact: true }).fill("Apple");
  await modal.getByLabel("Model", { exact: true }).fill("iPhone Test");
  await modal.getByLabel("IMEI 1", { exact: true }).fill("490154203237518");
  await modal.getByLabel("Purchase cost", { exact: true }).fill("100000");
  await modal.getByLabel("Selling price", { exact: true }).fill("150000");
  await modal.getByLabel("Amount paid", { exact: true }).fill("100000");
  await modal.getByRole("button", { name: "Save", exact: true }).click();
  await expect(modal).not.toBeVisible();
  await page.getByRole("button", { name: "Checkout", exact: true }).click();
  await page.getByRole("button", { name: /Apple iPhone Test/ }).click();
  await page.getByLabel("Amount", { exact: true }).fill("150000");
  await page.getByRole("button", { name: /Finalize sale/ }).click();
  await expect(
    page.getByRole("cell", { name: "INV-0000001", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Posted", exact: true }),
  ).toBeVisible();
  const result = await page.evaluate(() => window.pos.call("snapshot", {}));
  expect(result.ok).toBe(true);
  expect(result.data.phones[0].status).toBe("sold");
  expect(result.data.reports[0].received).toBe(150000);
  const popup = page.context().waitForEvent("page");
  await page
    .getByRole("button", { name: "Receipt preview", exact: true })
    .click();
  const receipt = await popup;
  await receipt.setViewportSize({ width: 600, height: 850 });
  await receipt.waitForLoadState();

  await expect(
    receipt.getByRole("heading", { name: "INV-0000001", exact: true }),
  ).toBeVisible();
  await expect(receipt.locator("body")).toContainText("490154203237518");
  await receipt.evaluate(async () => {
    await document.fonts.load("12px Myanmar", "မြန်မာ");
    await document.fonts.load("12px Thai", "ไทย");
  });
  expect(
    await receipt.evaluate(
      () =>
        document.fonts.check("12px Myanmar", "မြန်မာ") &&
        document.fonts.check("12px Thai", "ไทย"),
    ),
  ).toBe(true);
  await receipt.screenshot({
    path: "test-results/receipt.png",
    fullPage: true,
  });
  const jpegPath = join(directory, "receipt-export.jpg");
  await application.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, jpegPath);
  await receipt.getByRole("button", { name: "Save JPEG", exact: true }).click();
  await expect(receipt.getByRole("status")).toContainText("Saved");
  const jpeg = await readFile(jpegPath);
  expect(jpeg.subarray(0, 3).toString("hex")).toBe("ffd8ff");
  const imageSize = await application.evaluate(
    ({ nativeImage }, path) => nativeImage.createFromPath(path).getSize(),
    jpegPath,
  );
  expect(imageSize.width).toBeGreaterThanOrEqual(480);
  expect(imageSize.height).toBeGreaterThan(400);
  const receiptHeight = await receipt
    .locator("#receipt")
    .evaluate((e) => e.getBoundingClientRect().height);
  expect(imageSize.height).toBeLessThan(receiptHeight + 300);
  await writeFile("test-results/receipt-export.jpg", jpeg);
  await receipt.close();
  const longSale = await page.evaluate(async () => {
    const items = [];
    for (let n = 0; n < 15; n++) {
      const product = await window.pos.call("accessory", {
        sku: "JPEG-LONG-" + n,
        name: "USB-C Charger မြန်မာ ไทย " + n,
        category: "Test",
        cost: 0,
        price: 1000,
        currency: "MMK",
        quantity: 2,
        reorder: 0,
        method: "Cash",
      });
      if (!product.ok) throw new Error(product.error);
      items.push({
        kind: "accessory",
        id: product.data,
        quantity: 1,
        price: 1000,
      });
    }
    const sale = await window.pos.call("sale", {
      request: crypto.randomUUID(),
      currency: "MMK",
      items,
      payments: [{ method: "Cash", amount: 15000 }],
    });
    if (!sale.ok) throw new Error(sale.error);
    return sale.data;
  });
  const longPopup = page.context().waitForEvent("page");
  await page.evaluate(
    (id) =>
      window.pos.call("receipt", { id, language: "en-US", preview: true }),
    longSale,
  );
  const longReceipt = await longPopup;
  await longReceipt.setViewportSize({ width: 600, height: 850 });
  await longReceipt.waitForLoadState();
  await longReceipt
    .getByRole("button", { name: "Save JPEG", exact: true })
    .click();
  await expect(longReceipt.getByRole("status")).toContainText("Saved");
  const longSize = await application.evaluate(
    ({ nativeImage }, path) => nativeImage.createFromPath(path).getSize(),
    jpegPath,
  );
  expect(longSize.height).toBeGreaterThan(900);
  const longHeight = await longReceipt
    .locator("#receipt")
    .evaluate((e) => e.getBoundingClientRect().height);
  expect(Math.abs(longSize.height - longHeight)).toBeLessThan(300);
  await writeFile(
    "test-results/receipt-long-export.jpg",
    await readFile(jpegPath),
  );
  await longReceipt.close();

  const repairId = await page.evaluate(async () => {
    const call = async (op, input) => {
      const r = await window.pos.call(op, input);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    };
    const customer = await call("contact", {
      name: "Customer မြန်မာ ไทย",
      phone: "DEMO-PHONE",
      kind: "customer",
    });
    const repair = await call("repair", {
      contactId: customer,
      device: "OPPO Reno 11",
      identifier: "DEMO-REPAIR-01",
      problem: "No power",
      inspection: "Sample intake",
      estimate: 85000,
      currency: "MMK",
    });
    await call("repairUpdate", {
      id: repair,
      status: "Diagnosing",
      diagnosis: "Power circuit inspection completed",
      approved: false,
      final: 0,
      warrantyDays: 30,
      reason: "",
    });
    await call("payment", {
      request: crypto.randomUUID(),
      target: "repair",
      id: repair,
      amount: 20000,
      currency: "MMK",
      method: "Cash",
    });
    return repair;
  });
  const repairPopup = page.context().waitForEvent("page");
  await page.evaluate(
    (id) =>
      window.pos.call("receipt", {
        id,
        kind: "repair",
        language: "en-US",
        preview: true,
      }),
    repairId,
  );
  const repairReceipt = await repairPopup;
  await repairReceipt.setViewportSize({ width: 600, height: 850 });
  await repairReceipt.waitForLoadState();
  await expect(repairReceipt.locator("#receipt")).toContainText("OPPO Reno 11");
  await expect(repairReceipt.locator("#receipt")).toContainText(
    "Power circuit inspection completed",
  );
  await expect(repairReceipt.locator(".balance")).toContainText("65,000");
  await repairReceipt
    .getByRole("button", { name: "Save JPEG", exact: true })
    .click();
  await expect(repairReceipt.getByRole("status")).toContainText("Saved");
  await writeFile(
    "test-results/receipt-repair-export.jpg",
    await readFile(jpegPath),
  );
  await application.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async () => ({ canceled: true });
  });
  await repairReceipt
    .getByRole("button", { name: "Save JPEG", exact: true })
    .click();
  await expect(
    repairReceipt.getByRole("button", { name: "Save JPEG", exact: true }),
  ).toBeEnabled();
  await expect(repairReceipt.getByRole("status")).toBeEmpty();
  await repairReceipt
    .getByRole("button", { name: "Close", exact: true })
    .click();
  const labelWindow = page.context().waitForEvent("page");
  const labelResult = await page.evaluate(() =>
    window.pos.call("label", { kind: "phone", id: 1 }),
  );
  expect(labelResult.ok).toBe(true);
  const label = await labelWindow;
  await label.setViewportSize({ width: 600, height: 500 });
  await label.waitForLoadState();
  expect(await label.locator("img").count()).toBe(1);
  await expect
    .poll(() =>
      label
        .locator("img")
        .evaluateAll((images) =>
          images.every((img) => img.complete && img.naturalWidth > 0),
        ),
    )
    .toBe(true);
  await expect(label.locator(".product-name")).not.toBeEmpty();
  await expect(label.locator(".price")).toContainText("MMK");
  await label.close();
  const backupPath = join(directory, "checked-backup.sqlite");
  await application.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, backupPath);
  const backupResult = await page.evaluate(() => window.pos.call("backup"));
  expect(backupResult).toEqual({ ok: true, data: true });
  await page.evaluate(() =>
    window.pos.call("contact", { name: "Temporary contact", kind: "customer" }),
  );
  await application.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [filePath],
    });
    dialog.showMessageBox = async () => ({
      response: 1,
      checkboxChecked: false,
    });
  }, backupPath);
  const restoreResult = await page.evaluate(() => window.pos.call("restore"));
  expect(restoreResult.ok).toBe(true);
  expect((await page.evaluate(() => window.pos.call("status"))).data.user).toBe(
    null,
  );
  expect(
    (
      await page.evaluate(() =>
        window.pos.call("login", {
          username: "test-owner",
          password: "local-test-password-123",
        }),
      )
    ).ok,
  ).toBe(true);
  const restored = await page.evaluate(() => window.pos.call("snapshot", {}));
  expect(
    restored.data.contacts.some((c) => c.name === "Temporary contact"),
  ).toBe(false);
  expect(restored.data.sales).toHaveLength(2);
  const bugPath = join(directory, "report.txt");
  await application.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, bugPath);
  expect(
    (
      await page.evaluate(() =>
        window.pos.call("bugExport", {
          category: "Bug / Error",
          subject: "Example",
          description: "password=do-not-export 490154203237518",
          steps: "",
          expected: "",
          actual: "",
          diagnostics: true,
        }),
      )
    ).ok,
  ).toBe(true);
  const exported = await readFile(bugPath, "utf8");
  expect(exported).not.toContain("do-not-export");
  expect(exported).not.toContain("490154203237518");

  await page.screenshot({
    path: "test-results/sales-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("my-MM");
  await expect(
    page.getByRole("heading", { name: "အရောင်းမှတ်တမ်း", exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/sales-myanmar.png",
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "ဘာသာစကား", exact: true })
    .selectOption("th-TH");
  await expect(
    page.getByRole("heading", { name: "ประวัติการขาย", exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "ภาพรวม", exact: true }).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
  // Renderer has no Node or filesystem access.
  expect(await page.evaluate(() => typeof window.require)).toBe("undefined");
  expect(
    await application.evaluate(
      ({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()
          .contextIsolation,
    ),
  ).toBe(true);
  console.log(
    "PASS: Electron owner setup → supplier → phone purchase → paid sale → receipt preview; Myanmar/Thai switching; bundled Unicode fonts; product barcode/name/price; backup/restore; redacted bug export; language persistence; isolated preload.",
  );
  completed = true;
} catch (error) {
  const pages = application.windows();
  if (pages[0]) {
    await pages[0]
      .screenshot({ path: "test-results/desktop-failure.png", fullPage: true })
      .catch(() => {});
    console.error(
      await pages[0]
        .locator("body")
        .innerText()
        .catch(() => ""),
    );
  }
  throw error;
} finally {
  await application.close();
  await rm(directory, { recursive: true, force: true });
  if (!completed) process.exitCode = 1;
}
