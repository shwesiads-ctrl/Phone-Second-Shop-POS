import { verifySampleShop } from "./sample-shop.mjs";
import { verifyThemePreference, verifySearchIcon } from "./theme-search.mjs";
import { verifyDemoRefresh } from "./demo-refresh.mjs";
import { verifyMobileAdditions } from "./mobile-additions.mjs";
import { verifyOwnerRecovery } from "./owner-recovery.mjs";
import { verifyMobileLayout } from "./mobile-layout.mjs";
import { _electron as electron, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
const directory = await mkdtemp(join(tmpdir(), "pos-android-web-"));
await mkdir("test-results", { recursive: true });
const host = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--config", "vite.android-test.config.ts"],
  { stdio: "ignore" },
);
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch("http://127.0.0.1:5174")).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 100));
}
const main = join(directory, "main.cjs");
await writeFile(
  main,
  `const{app,BrowserWindow}=require('electron');let w;app.whenReady().then(()=>{w=new BrowserWindow({width:420,height:900,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});w.loadURL('http://127.0.0.1:5174');});`,
);
const app = await electron.launch({
  args: [main, "--no-sandbox", "--ozone-platform=headless", "--disable-gpu"],
  env: {
    ...process.env,
    XDG_CONFIG_HOME: directory,
    XDG_CACHE_HOME: join(directory, "cache"),
  },
  timeout: 30000,
});
app.process().stderr?.on("data", (data) => process.stderr.write(data));
try {
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 420, height: 900 });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForFunction(() => !!window.pos);
  await page.getByRole("combobox").first().selectOption("en-US");
  await verifyThemePreference(page);
  await page.getByLabel("Username", { exact: true }).fill("android-owner");
  await page
    .getByLabel("Password (10+ characters)", { exact: true })
    .fill("android test password");
  await page
    .getByRole("button", { name: "Create first owner", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }).first(),
  ).toBeVisible();
  for (const width of [360, 420, 760]) {
    await page.setViewportSize({ width, height: 900 });
    await verifySearchIcon(page);
    await verifyMobileLayout(
      page,
      width === 360 ? "test-results/mobile-layout" : null,
    );
  }
  await page.setViewportSize({ width: 420, height: 900 });
  await verifyOwnerRecovery(page, "android-owner", "android test password");
  await verifyMobileAdditions(page, true);
  await verifyDemoRefresh(page);
  await verifySampleShop(page, {
    username: "android-owner",
    password: "android test password",
  });
  const call = async (op, input = {}) => {
    const reply = await page.evaluate(
      ({ op, input }) => window.pos.call(op, input),
      { op, input },
    );
    expect(reply.ok, op + ": " + reply.error).toBe(true);
    return reply.data;
  };
  const contactId = await call("contact", {
    name: "Mobile buyer",
    kind: "customer",
  });
  const rateId = await call("rate", {
    from: "USD",
    to: "MMK",
    numerator: 3000,
    denominator: 1,
    source: "Authorized test quote",
  });
  const stockId = await call("accessory", {
    sku: "MOBILE-1",
    name: "Cable မြန်မာ ไทย",
    category: "Cable",
    cost: 1000,
    price: 3000,
    currency: "MMK",
    quantity: 3,
    reorder: 0,
    method: "Cash",
  });
  const saleId = await call("sale", {
    request: crypto.randomUUID(),
    currency: "MMK",
    contactId,
    items: [{ kind: "accessory", id: stockId, quantity: 1, price: 3000 }],
    payments: [
      { amount: 100, currency: "USD", rateId, method: "Cash", received: 200 },
    ],
  });
  let snapshot = await call("snapshot");
  expect(snapshot.reports.find((r) => r.currency === "USD").cashNet).toBe(100);
  expect(snapshot.reports[0].gross).toBe(2000);
  await call("receipt", {
    id: saleId,
    preview: true,
    language: "my-MM",
    paper: "58mm",
  });
  expect(
    await page.evaluate(() => window.androidHarness.previews.at(-1).html),
  ).toContain("file:///android_asset/public/assets/receipt-myanmar.woff2");
  await call("label", { kind: "accessory", id: stockId });
  const productLabel = await page.evaluate(() => window.androidHarness.previews.at(-1).html);
  expect((productLabel.match(/<img /g) || []).length).toBe(1);
  expect(productLabel).toContain("Cable မြန်မာ ไทย");
  expect(productLabel).toContain("3,000");
  expect(productLabel).toContain("MMK");
  expect(productLabel).not.toContain("QR");
  expect(productLabel).toContain("file:///android_asset/public/assets/receipt-myanmar.woff2");
  await call("backup");
  const encoded = await page.evaluate(
    () => window.androidHarness.exports.at(-1).data,
  );
  const backupPath = join(directory, "mobile.sqlite");
  await writeFile(backupPath, Buffer.from(encoded, "base64"));
  const db = new DatabaseSync(backupPath, { readOnly: true });
  expect(db.prepare("PRAGMA integrity_check").get().integrity_check).toBe("ok");
  expect(db.prepare("PRAGMA user_version").get().user_version).toBe(9);
  expect(
    db.prepare("SELECT original_amount FROM payments").get().original_amount,
  ).toBe(100);
  db.close();
  await call("logout");
  const invalid = await page.evaluate(() =>
    window.pos.call("login", {
      username: "android-owner",
      password: "incorrect",
    }),
  );
  expect(invalid.error).toBe("LOGIN_FAILED");
  expect(
    (
      await page.evaluate(() =>
        window.pos.call("login", {
          username: "android-owner",
          password: "android test password",
        }),
      )
    ).error,
  ).toBe("LOGIN_DELAY");
  async function savedAuthGuard() {
    const encoded = await page.evaluate(() =>
      localStorage.getItem("test.database"),
    );
    const path = join(directory, "auth-guard.sqlite");
    await writeFile(path, Buffer.from(encoded, "base64"));
    const saved = new DatabaseSync(path, { readOnly: true });
    try {
      return saved
        .prepare("SELECT attempts,retry_at FROM auth_guard WHERE id=1")
        .get();
    } finally {
      saved.close();
    }
  }
  const beforeRestart = await savedAuthGuard();
  expect(beforeRestart.attempts).toBeGreaterThan(0);
  await page.reload();
  await page.waitForFunction(() => !!window.pos);
  const afterRestart = await savedAuthGuard();
  expect(afterRestart).toEqual(beforeRestart);
  await new Promise((r) =>
    setTimeout(r, Math.max(0, afterRestart.retry_at - Date.now()) + 100),
  );
  await call("login", {
    username: "android-owner",
    password: "android test password",
  });
  snapshot = await call("snapshot");
  expect(snapshot.sales).toHaveLength(1);
  await call("return", {
    request: crypto.randomUUID(),
    id: saleId,
    refund: 3000,
    reason: "Original tender refund",
    method: "Cash",
  });
  expect(
    (await call("snapshot")).reports.find((r) => r.currency === "USD").cashNet,
  ).toBe(0);
  // Atomic native save failure reverts the mutation and logs the session out.
  await page.evaluate(() => {
    window.androidHarness.failSave = true;
  });
  const failed = await page.evaluate(() =>
    window.pos.call("contact", { name: "Must not persist", kind: "customer" }),
  );
  expect(failed.error).toBe("STORAGE_FAILED");
  await page.evaluate(() => {
    window.androidHarness.failSave = false;
  });
  await call("login", {
    username: "android-owner",
    password: "android test password",
  });
  expect(
    (await call("snapshot")).contacts.some(
      (c) => c.name === "Must not persist",
    ),
  ).toBe(false);
  const loginSecret = await readFile("tests/fixtures/legacy-v7.sql", "utf8");
  const legacyPath = join(directory, "legacy.sqlite");
  const legacy = new DatabaseSync(legacyPath);
  legacy.exec(loginSecret);
  legacy.close();
  const legacyData = (await readFile(legacyPath)).toString("base64");
  await page.evaluate(() => {
    window.confirm = () => true;
  });
  await page.evaluate((data) => {
    window.androidHarness.importData = data;
  }, legacyData);
  await call("restore");
  await call("login", {
    username: "legacy-owner",
    password: "legacy-test-password",
  });
  expect((await call("snapshot")).sales).toHaveLength(1);
  await page.reload();
  await page.waitForFunction(() => !!window.pos);
  await new Promise((r) => setTimeout(r, 1100));
  await call("login", {
    username: "legacy-owner",
    password: "legacy-test-password",
  });
  await page.reload();
  await page.waitForFunction(() => !!window.pos);
  await page.screenshot({
    path: "test-results/android-web-login.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  console.log(
    "PASS: Android SQLite WASM bridge owner UI, currency sale/change/refund, native-save rollback, login delay, durable reload, desktop-readable backup, schema-7 restore and scrypt compatibility. Browser-native dialogs/storage substituted; Android APK emulator is separate.",
  );
} catch (error) {
  const page = app.windows()[0];
  if (page)
    await page.screenshot({
      path: "test-results/android-web-failure.png",
      fullPage: true,
    });
  throw error;
} finally {
  await app.close();
  host.kill("SIGTERM");
  await rm(directory, { recursive: true, force: true });
}
