import { verifyThemePreference, verifySearchIcon } from "./theme-search.mjs";
import { verifyDemoRefresh } from "./demo-refresh.mjs";
import { navigateTo, openNavigation, closeNavigation } from "./navigation.mjs";
import { verifyMobileAdditions } from "./mobile-additions.mjs";
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
let device = devices[0];
const results = {
  platform: "Android emulator API 35 x86_64",
  apkInstalled: false,
  firstRunSetup: false,
  ownerRecovery: false,
  mobileAdditions: false,
  fixerBranding: false,
  receiptJpegSave: false,
  receiptJpegShareChooser: false,
  externalShareDelivery: "PENDING: chooser only, no external message sent",
  backExitConfirmation: false,
  automaticBarcode: false,
  bluetoothHardware: "PENDING: no physical printer",
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
      // A force-stop can happen before WebView flushes the selected locale.
      // Choose the test locale on each new login screen before English selectors.
      await p.getByRole("combobox").first().selectOption("en-US");
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

async function nativeDialogButton(prefix) {
  for (let attempt = 0; attempt < 5; attempt++) {
    adb("shell", "uiautomator", "dump", "/sdcard/pos-ui.xml");
    const xml = adb("shell", "cat", "/sdcard/pos-ui.xml");
    const nodes = xml.match(/<node\s[^>]+>/g) || [];
    const node = nodes.find(
      (n) =>
        n.toLowerCase().includes(`text="${prefix.toLowerCase()}`) &&
        n.includes('enabled="true"'),
    );
    const bounds = node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (bounds) {
      adb(
        "shell",
        "input",
        "tap",
        String(Math.round((+bounds[1] + +bounds[3]) / 2)),
        String(Math.round((+bounds[2] + +bounds[4]) / 2)),
      );
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Native exit confirmation button not found");
}

async function call(op, input = {}) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const r = await page.evaluate(
      ({ op, input }) => window.pos.call(op, input),
      { op, input },
    );
    // Startup/login may still be persisting or loading the first snapshot.
    // Only retry read requests explicitly rejected as BUSY; never replay writes.
    if (
      r.error === "BUSY" &&
      ["snapshot", "status"].includes(op) &&
      attempt < 29
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      continue;
    }
    expect(r.ok, op + ": " + r.error).toBe(true);
    return r.data;
  }
}

try {
  page = await connect();
  results.apkInstalled = true;
  await expect(
    page.getByRole("heading", { name: "Fixer Tools", exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox").first().selectOption("en-US");
  await verifyThemePreference(page);
  results.themePreference = true;
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
  // Repeated full-page CDP captures can detach the Android WebView. Geometry
  // assertions still cover every page/language; capture the real display once.
  await verifySearchIcon(page);
  results.searchIcon = true;
  await verifyMobileLayout(page, null);
  await writeFile(
    "test-results/android/layout-native.png",
    await device.screenshot(),
  );
  await verifyOwnerRecovery(page, "apk-owner", "synthetic apk password");
  await verifyMobileAdditions(page, false);
  await verifyDemoRefresh(page, async () => {
    adb("shell", "input", "keyevent", "4");
  });
  results.demoInventory = true;
  results.pullRefresh = true;
  results.mobileAdditions = true;
  results.ownerRecovery = true;
  await openNavigation(page);
  await expect(page.locator(".brand strong")).toHaveText("Fixer Tools");
  await expect(
    page.locator(".brand svg[aria-label='Fixer Tools icon']"),
  ).toBeVisible();
  await closeNavigation(page);
  results.fixerBranding = true;
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
  const stock = (await call("snapshot")).accessories.find(
    (p) => p.sku === "APK-1",
  );
  expect(stock.barcode).toMatch(/^P2\d{12}$/);
  expect((await call("barcodeGenerate", { id: stock.id })).barcode).toBe(
    stock.barcode,
  );
  results.automaticBarcode = true;
  await page.reload();
  await page.waitForFunction(() => !!window.pos);
  await page.getByLabel("Username", { exact: true }).fill("apk-owner");
  await page
    .getByLabel("Password (10+ characters)", { exact: true })
    .fill("synthetic apk password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await navigateTo(page, "Checkout");
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
  adb("shell", "uiautomator", "dump", "/sdcard/pos-ui.xml");
  const receiptControls = adb("shell", "cat", "/sdcard/pos-ui.xml");
  expect(receiptControls).toContain("JPEG သိမ်းရန်");
  expect(receiptControls).not.toContain("Save JPEG");
  expect(receiptControls).not.toContain("บันทึก JPEG");
  results.receiptLanguage = true;
  await nativeDialogButton("JPEG သိမ်းရန်");
  let savedName;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      savedName = adb("shell", "ls", "/sdcard/Pictures/FixerTools")
        .split(/\r?\n/)
        .find((n) => /^FixerTools-Receipt-\d+-[a-f0-9]{8}\.jpg$/.test(n));
    } catch {}
    if (savedName) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  expect(savedName).toBeTruthy();
  const savedJpeg = execFileSync(
    "adb",
    ["exec-out", "cat", "/sdcard/Pictures/FixerTools/" + savedName],
    { maxBuffer: 20 * 1024 * 1024 },
  );
  expect(savedJpeg.subarray(0, 2).toString("hex")).toBe("ffd8");
  expect(savedJpeg.subarray(-2).toString("hex")).toBe("ffd9");
  await writeFile("test-results/android/receipt-export.jpg", savedJpeg);
  results.receiptJpegSave = true;
  await nativeDialogButton("JPEG မျှဝေရန်");
  for (let attempt = 0; attempt < 30; attempt++) {
    const resumed = adb("shell", "dumpsys", "activity", "activities")
      .split("\n")
      .filter((s) => /topResumedActivity|mResumedActivity/.test(s))
      .join("\n");
    if (/ChooserActivity|ResolverActivity/.test(resumed)) break;
    if (attempt === 29) throw new Error("JPEG share chooser did not open");
    await new Promise((r) => setTimeout(r, 500));
  }
  const sharedName = adb("shell", "run-as", pkg, "ls", "cache/receipt-images")
    .split(/\r?\n/)
    .find((n) => /^FixerTools-Receipt-\d+-[a-f0-9]{8}\.jpg$/.test(n));
  expect(sharedName).toBeTruthy();
  const sharedJpeg = execFileSync(
    "adb",
    ["exec-out", "run-as", pkg, "cat", "cache/receipt-images/" + sharedName],
    { maxBuffer: 20 * 1024 * 1024 },
  );
  expect(sharedJpeg.subarray(0, 2).toString("hex")).toBe("ffd8");
  expect(sharedJpeg.subarray(-2).toString("hex")).toBe("ffd9");
  results.receiptJpegShareChooser = true;
  adb("shell", "input", "keyevent", "4");
  await new Promise((r) => setTimeout(r, 500));

  adb("shell", "input", "keyevent", "4");
  await new Promise((r) => setTimeout(r, 500));
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("my-MM");
  await expect(
    page.getByRole("heading", { name: "အရောင်းမှတ်တမ်း", exact: true }).first(),
  ).toBeVisible();
  // After the native receipt Activity, CDP full-page capture can stall on the
  // resumed WebView compositor. Capture the actual Android display instead;
  // the DOM Unicode assertion above remains mandatory.
  await writeFile(
    "test-results/android/myanmar.png",
    await device.screenshot(),
  );
  await page
    .getByRole("combobox", { name: "ဘာသာစကား", exact: true })
    .selectOption("th-TH");
  await expect(
    page.getByRole("heading", { name: "ประวัติการขาย", exact: true }).first(),
  ).toBeVisible();
  await openNavigation(page);
  adb("shell", "input", "keyevent", "4");
  await expect(page.getByTestId("menu-toggle")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  results.drawerNavigation = true;
  adb("shell", "input", "keyevent", "4");
  await nativeDialogButton("Stay");
  expect((await call("snapshot")).sales).toHaveLength(1);
  results.backExitConfirmation = true;
  adb("shell", "am", "force-stop", pkg);
  await device.close();
  device = (await android.devices({ omitDriverInstall: true }))[0];
  expect(device).toBeTruthy();
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
  await device.close();
  device = (await android.devices({ omitDriverInstall: true }))[0];
  expect(device).toBeTruthy();
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
  adb("shell", "input", "keyevent", "4");
  await nativeDialogButton("Exit ·");
  await new Promise((r) => setTimeout(r, 1000));
  expect(
    adb("shell", "dumpsys", "activity", "activities")
      .split("\n")
      .filter((s) => /topResumedActivity|mResumedActivity/.test(s))
      .join("\n"),
  ).not.toContain(pkg);
  // Android keeps the process alive after finishAndRemoveTask. Playwright caches
  // the old WebView page by the same process socket; create a fresh device/CDP
  // connection instead of reusing that closed target. Do not force-stop the app.
  await device.close();
  device = (await android.devices({ omitDriverInstall: true }))[0];
  expect(device).toBeTruthy();
  adb("shell", "am", "start", "-n", `${pkg}/.MainActivity`);
  page = await connect();
  await page.getByLabel("Username", { exact: true }).fill("apk-owner");
  await page
    .getByLabel("Password (10+ characters)", { exact: true })
    .fill("synthetic apk password");
  await page
    .getByRole("button", { name: "Log in", exact: true })
    .first()
    .click();
  expect((await call("snapshot")).sales).toHaveLength(1);
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
  console.error("Original APK test failure:", String(error));
  await writeFile(
    "test-results/android/emulator-results.json",
    JSON.stringify({ ...results, error: String(error) }, null, 2),
  );
  await device
    .screenshot()
    .then((bytes) =>
      writeFile("test-results/android/failure-native.png", bytes),
    )
    .catch(() => {});
  if (page)
    await page
      .screenshot({
        path: "test-results/android/failure-web.png",
        fullPage: true,
      })
      .catch(() => {});
  throw error;
} finally {
  await device.close();
}
