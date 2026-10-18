import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const afterPack = createRequire(import.meta.url)("../scripts/after-pack.cjs");
test("uninstall manifest removes only packaged files and empty directories, preserving user files", async () => {
  const root = mkdtempSync(join(tmpdir(), "pos-installer-"));
  const out = join(root, "package");
  mkdirSync(join(root, "build"));
  mkdirSync(join(out, "resources"), { recursive: true });
  writeFileSync(join(out, "app.exe"), "fixture");
  writeFileSync(join(out, "resources", "app.asar"), "fixture");
  await afterPack({
    electronPlatformName: "win32",
    appOutDir: out,
    packager: { projectDir: root },
  });
  const manifest = readFileSync(
    join(root, "build", "uninstall-files.nsh"),
    "utf8",
  );
  assert.match(manifest, /Delete "\$INSTDIR\\app.exe"/);
  assert.match(manifest, /Delete "\$INSTDIR\\resources\\app.asar"/);
  assert.match(manifest, /RMDir "\$INSTDIR\\resources"/);
  assert.ok(!manifest.includes("/r"));
  assert.ok(!manifest.includes("*"));
  assert.ok(!manifest.includes("business.sqlite"));
  rmSync(root, { recursive: true });
});
