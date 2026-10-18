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
  "offlineSale",
  "originalTender",
  "privatePersistence",
  "sameApkReinstall",
  "nativeReceiptPreview",
])
  assert.equal(outcome[key], true, key);
const db = new DatabaseSync("test-results/android/emulator-business.sqlite", {
  readOnly: true,
});
assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
assert.equal(db.prepare("PRAGMA user_version").get().user_version, 8);
assert.equal(db.prepare("SELECT COUNT(*) n FROM sales").get().n, 1);
db.close();
const apk = "android/app/build/outputs/apk/debug/app-debug.apk";
const tools = join(
  process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT,
  "build-tools",
);
const newest = readdirSync(tools)
  .filter((n) => /^\d+\./.test(n))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .at(-1);
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
const name = "Phone-Second-Shop-POS-Android-0.2.0-test.apk";
copyFileSync(apk, "release/" + name);
writeFileSync("release/" + name + ".sha256", `${sha256}  ${name}\n`);
writeFileSync(
  "test-results/android/apk-verification.json",
  JSON.stringify(
    {
      version: "0.2.0-android.2",
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
