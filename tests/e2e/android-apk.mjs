import { verifyOwnerRecovery } from "./owner-recovery.mjs";
import { verifyMobileLayout } from "./mobile-layout.mjs";
// Actual installed debug APK, Android WebView and private native storage; no mock bridge.
import { _android as android } from "playwright";
import { expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const pkg = "com.myominaung.phonesecondshoppos.mobile";
const apk =
  process.argv[2] || "android/app/build/outputs/apk/debug/app-debug.apk";
const adb = (...args) =>
  execFileSync("adb", args, { encoding: "utf8", timeout: 60000 });
await mkdir("test-results/android", { recursive: true });
adb("install", "-r", apk);
adb("shell", "svc", "wifi", "disable");
adb("shell", "svc", "data", "disable");
adb("shell", "am", "start", "-n", `${pkg}/.MainActivity`);
const devices = await android.devices({ omitDriverInstall: true });
expect(devices.length).toBeGreaterThan(0);
const device = devices[0];
const results = {
  platform: "Android emulator API 35 x86_64",
  apkInstalled: false,
  firstRunSetup: false,
  ownerRecovery: false,
  offlineSale: false,
  originalTender: false,
  privatePersistence: false,
  sameApkReinstall: false,
  nativeReceiptPreview: false,
  physicalPrinting: "PENDING",
  physicalArmDevice: "PENDING",
  signing: "Android debug test certificate; not production signing",
};
let page;
async function connect() {
  await new Promise((r) => setTimeout(r, 1000));
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const view = await device.webView({ pkg }, { timeout: 45000 });
      const p = await view.page();
      p.setDefaultTimeout(30000);
      await p.waitForFunction(() => !!window.pos, {}, { timeout: 60000 });
      return p;
    } catch (error) {
      if (
        attempt === 7 ||
        !/closed|socket|ECONNREFUSED|not found/i.test(String(error))
      )
        throw error;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("Android WebView unavailable");
}

async function call(op, input = {}) {
  const r = await page.evaluate(({ op, input }) => window.pos.call(op, input), {
    op,
    input,
  });
  expect(r.ok, op + ": " + r.error).toBe(true);
  return r.data;
}
try {
  page = await connect();
  results.apkInstalled = true;
  await page.getByRole("combobox").first().selectOption("en-US");
  await page.getByLabel("Username", { exact: true }).fill("apk-owner");
  await page
    .getByLabel("Password (10+ characters)", { exact: true })
    .fill("synthetic apk password");
  await page
    .getByRole("button", { name: "Create first owner", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }).first(),
  ).toBeVisible();
  await verifyMobileLayout(page, "test-results/android/layout");
  await verifyOwnerRecovery(page, "apk-owner", "synthetic apk password");
  results.ownerRecovery = true;
  results.firstRunSetup = true;
  await call("rate", {
    from: "USD",
    to: "MMK",
    numerator: 3000,
    denominator: 1,
    source: "Approved emulator test quote",
  });
  await call("accessory", {
    sku: "APK-1",
    name: "Mobile မြန်မာ ไทย",
    category: "Cable",
    cost: 1000,
    price: 3000,
    currency: "MMK",
    quantity: 3,
    reorder: 0,
    method: "Cash",
  });
  await page.reload();
  await page.waitForFunction(() => !!window.pos);
  await page.getByLabel("Username", { exact: true }).fill("apk-owner");
  await page
    .getByLabel("Password (10+ characters)", { exact: true })
    .fill("synthetic apk password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByRole("button", { name: "Checkout", exact: true }).click();
  await page.getByRole("button", { name: /Mobile မြန်မာ ไทย/ }).click();
  await page.getByLabel("Tender currency", { exact: true }).selectOption("USD");
  await page
    .getByLabel("Authorized exchange rate", { exact: true })
    .selectOption("1");
  await page.getByLabel("Amount", { exact: true }).fill("1.00");
  await page
    .getByLabel("Cash handed over (optional)", { exact: true })
    .fill("2.00");
  await page.getByRole("button", { name: /Finalize sale/ }).click();
  await expect(
    page.getByRole("cell", { name: "INV-0000001", exact: true }),
  ).toBeVisible();
  const snapshot = await call("snapshot");
  expect(snapshot.reports[0].gross).toBe(2000);
  const tender = snapshot.payments.find((p) => p.target === "sale");
  expect(tender.original_currency).toBe("USD");
  expect(tender.original_amount).toBe(100);
  expect(tender.change_amount).toBe(100);
  results.originalTender = true;
  results.offlineSale = true;
  await page.screenshot({
    path: "test-results/android/checkout.png",
    fullPage: true,
  });
  await call("receipt", {
    id: 1,
    preview: true,
    language: "my-MM",
    paper: "58mm",
  });
  await new Promise((r) => setTimeout(r, 2000));
  expect(adb("shell", "dumpsys", "activity", "activities")).toContain(
    ".ReceiptActivity",
  );
  const screen = await device.screenshot();
  await writeFile("test-results/android/receipt-native.png", screen);
  results.nativeReceiptPreview = true;
  adb("shell", "input", "keyevent", "4");
  await new Promise((r) => setTimeout(r, 500));
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("my-MM");
  await expect(
    page.getByRole("heading", { name: "အရောင်းမှတ်တမ်း", exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/android/myanmar.png",
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "ဘာသာစကား", exact: true })
    .selectOption("th-TH");
  await expect(
    page.getByRole("heading", { name: "ประวัติการขาย", exact: true }).first(),
  ).toBeVisible();
  adb("shell", "am", "force-stop", pkg);
  adb("shell", "am", "start", "-n", `${pkg}/.MainActivity`);
  page = await connect();
  await page.getByRole("combobox").first().selectOption("en-US");
  await page.getByLabel("Username", { exact: true }).fill("apk-owner");
  await page
    .getByLabel("Password (10+ characters)", { exact: true })
    .fill("synthetic apk password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  expect((await call("snapshot")).sales).toHaveLength(1);
  results.privatePersistence = true;
  adb("shell", "am", "force-stop", pkg);
  adb("install", "-r", apk);
  adb("shell", "am", "start", "-n", `${pkg}/.MainActivity`);
  page = await connect();
  await page.getByLabel("Username", { exact: true }).fill("apk-owner");
  await page
    .getByLabel("Password (10+ characters)", { exact: true })
    .fill("synthetic apk password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  expect((await call("snapshot")).sales).toHaveLength(1);
  results.sameApkReinstall = true;
  // Export the native app's actual SQLite file through debug-only run-as for integrity checking.
  const database = execFileSync(
    "adb",
    ["exec-out", "run-as", pkg, "cat", "files/business.sqlite"],
    { maxBuffer: 40 * 1024 * 1024 },
  );
  await writeFile("test-results/android/emulator-business.sqlite", database);
  await writeFile(
    "test-results/android/emulator-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    "PASS: actual Android APK clean installation, first owner, offline currency checkout/change, Unicode UI, native receipt preview, force-stop persistence and same-APK data-preserving reinstall. Physical printing and real ARM device pending.",
  );
} catch (error) {
  await writeFile(
    "test-results/android/failure-native.png",
    await device.screenshot(),
  ).catch(() => {});
  if (page)
    await page
      .screenshot({
        path: "test-results/android/failure-web.png",
        fullPage: true,
      })
      .catch(() => {});
  await writeFile(
    "test-results/android/emulator-results.json",
    JSON.stringify({ ...results, error: String(error) }, null, 2),
  );
  throw error;
} finally {
  await device.close();
}
