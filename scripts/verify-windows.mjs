// Structural verification only. This does not execute Windows binaries.
import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { join, resolve, relative, basename, normalize } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { extractFile, listPackage } from "@electron/asar";
const seven = process.argv[2] || "7zz";
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const installer = resolve(`release/Phone Second Shop POS Setup ${version}.exe`);
const scratch = mkdtempSync(join(tmpdir(), "pos-windows-verify-"));
const hash = (b) => createHash("sha256").update(b).digest("hex");
function pe(path) {
  const b = readFileSync(path);
  assert.equal(b.subarray(0, 2).toString(), "MZ");
  const p = b.readUInt32LE(0x3c);
  assert.equal(b.subarray(p, p + 4).toString(), "PE\0\0");
  const opt = p + 24;
  const plus = b.readUInt16LE(opt) === 0x20b;
  const certificate = opt + (plus ? 112 : 96) + 4 * 8;
  return {
    machine: b.readUInt16LE(p + 4).toString(16),
    format: plus ? "PE32+" : "PE32",
    certificateBytes: b.readUInt32LE(certificate + 4),
  };
}
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}
try {
  execFileSync(seven, ["t", installer], { stdio: "pipe" });
  execFileSync(seven, ["x", installer, `-o${scratch}`, "-y"], {
    stdio: "pipe",
  });
  const payload = walk(scratch).find((f) => basename(f) === "app.7z");
  assert.ok(payload, "embedded application archive");
  execFileSync(seven, ["t", payload], { stdio: "pipe" });
  const appdir = join(scratch, "app");
  execFileSync(seven, ["x", payload, `-o${appdir}`, "-y"], { stdio: "pipe" });
  const asar = join(appdir, "resources/app.asar");
  assert.equal(JSON.parse(extractFile(asar, "package.json")).version, version);
  const expected = [
    "dist-electron/main.cjs",
    "dist-electron/preload.cjs",
    ...walk("dist").map((f) => relative(".", f).replaceAll("\\", "/")),
  ];
  for (const f of expected)
    assert.equal(
      hash(extractFile(asar, normalize(f))),
      hash(readFileSync(f)),
      `packaged file differs: ${f}`,
    );
  const files = listPackage(asar);
  assert.ok(!files.some((f) => /^[/\\](tests|scripts)[/\\]/.test(f)));
  assert.ok(
    !files.some((f) =>
      /node_modules[/\\](electron-builder|playwright|typescript)[/\\]/.test(f),
    ),
  );
  const bytes = readFileSync(installer);
  const sha256 = hash(bytes);
  writeFileSync(installer + ".sha256", `${sha256}  ${basename(installer)}\n`);
  const result = {
    version,
    installer,
    bytes: bytes.length,
    sha256,
    installerPE: pe(installer),
    applicationPE: pe(join(appdir, "Phone Second Shop POS.exe")),
    archiveIntegrity: "PASS",
    packagedFilesCompared: expected.length,
    productionContents: "PASS",
    nativeWindowsExecution: "PENDING",
    cleanInstall: "PENDING",
    upgrade: "PENDING",
    uninstall: "PENDING",
    smartScreen: "NOT OBSERVED: Windows unavailable",
  };
  assert.equal(result.applicationPE.machine, "8664");
  writeFileSync(
    "test-results/windows-artifact.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
