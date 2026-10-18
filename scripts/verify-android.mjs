import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
const outcome = JSON.parse(
  readFileSync("test-results/android/emulator-results.json", "utf8"),
);
for (const key of [
  "apkInstalled",
  "firstRunSetup",
  "ownerRecovery",
  "mobileAdditions",
  "backExitConfirmation",
  "automaticBarcode",
  "fixerBranding",
  "receiptJpegSave",
  "receiptJpegShareChooser",
  "offlineSale",
  "originalTender",
  "privatePersistence",
  "sameApkReinstall",
  "nativeReceiptPreview",
  "drawerNavigation",
  "demoInventory",
  "sampleWorkspace",
  "themePreference",
  "searchIcon",
  "pullRefresh",
  "receiptLanguage",
])
  assert.equal(outcome[key], true, key);
const db = new DatabaseSync("test-results/android/emulator-business.sqlite", {
  readOnly: true,
});
assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
assert.equal(db.prepare("PRAGMA user_version").get().user_version, 9);
assert.equal(db.prepare("SELECT COUNT(*) n FROM sales").get().n, 1);
db.close();
const jpeg = readFileSync("test-results/android/receipt-export.jpg");
assert.equal(jpeg.readUInt16BE(0), 0xffd8);
assert.equal(jpeg.readUInt16BE(jpeg.length - 2), 0xffd9);
let dimensions;
for (let offset = 2; offset + 8 < jpeg.length;) {
  assert.equal(jpeg[offset], 255);
  const marker = jpeg[offset + 1];
  if (marker === 0xda) break;
  const size = jpeg.readUInt16BE(offset + 2);
  assert.ok(size >= 2);
  if ([0xc0, 0xc1, 0xc2].includes(marker)) {
    dimensions = {
      width: jpeg.readUInt16BE(offset + 7),
      height: jpeg.readUInt16BE(offset + 5),
    };
    break;
  }
  offset += 2 + size;
}
assert.ok(dimensions);
assert.equal(dimensions.width, 720);
assert.ok(dimensions.height > 500);
assert.ok(jpeg.length > 5000);
const apk = "android/app/build/outputs/apk/debug/app-debug.apk";
const tools = join(
  process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT,
  "build-tools",
);
const newest = readdirSync(tools)
  .filter((n) => /^\d+\./.test(n))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .at(-1);
const badging = execFileSync(
  join(tools, newest, "aapt"),
  ["dump", "badging", apk],
  { encoding: "utf8" },
);
assert.match(badging, /application-label:'Fixer Tools'/);
assert.match(badging, /versionName='0.2.0-android.12'/);
assert.match(
  badging,
  /package: name='com.myominaung.phonesecondshoppos.mobile'/,
);
const signature = execFileSync(
  join(tools, newest, "apksigner"),
  ["verify", "--print-certs", apk],
  { encoding: "utf8" },
);
assert.match(signature, /Android Debug/i);
const entries = execFileSync("unzip", ["-Z1", apk], { encoding: "utf8" });
assert.match(entries, /assets\/public\/assets\/.*\.wasm/);
assert.match(entries, /assets\/public\/assets\/receipt-myanmar\.woff2/);
assert.match(entries, /assets\/public\/assets\/receipt-thai\.woff2/);
const scripts = execFileSync(
  "unzip",
  ["-p", apk, "assets/public/assets/*.js"],
  { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
);
assert.ok(
  !/androidHarness|test\.database|simulated disk full/.test(scripts),
  "test-only native substitutes must not ship",
);
const bytes = readFileSync(apk);
const sha256 = createHash("sha256").update(bytes).digest("hex");
mkdirSync("release", { recursive: true });
const name = "Fixer-Tools-Android-0.2.0-test.apk";
copyFileSync(apk, "release/" + name);
copyFileSync(
  "test-results/android/receipt-export.jpg",
  "release/Fixer-Tools-Sample-Receipt-JPEG.jpg",
);
writeFileSync("release/" + name + ".sha256", `${sha256}  ${name}\n`);
writeFileSync(
  "test-results/android/apk-verification.json",
  JSON.stringify(
    {
      version: "0.2.0-android.12",
      appName: "Fixer Tools",
      jpegExport: {
        ...dimensions,
        bytes: jpeg.length,
        sha256: createHash("sha256").update(jpeg).digest("hex"),
        sample: "Synthetic emulator sale, not real shop data",
      },
      bytes: bytes.length,
      sha256,
      signing:
        "Verified Android debug test certificate; not production release signing",
      tests: outcome,
      sqliteIntegrity: "ok",
      minimumAndroid: "10 (API29)",
      physicalDevice: "PENDING",
      physicalPrinting: "PENDING",
    },
    null,
    2,
  ),
);
console.log(
  "PASS: APK debug signature, emulator checks, persisted native SQLite integrity and SHA256.",
);
