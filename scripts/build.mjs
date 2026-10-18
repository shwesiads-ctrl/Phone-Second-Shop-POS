import { build } from "esbuild";
await build({
  entryPoints: ["src/main/main.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist-electron/main.cjs",
  external: ["electron"],
  target: "node24",
});
await build({
  entryPoints: ["src/main/preload.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist-electron/preload.cjs",
  external: ["electron"],
  target: "node24",
});
import { copyFile, mkdir } from "node:fs/promises";
await mkdir("dist/assets", { recursive: true });
await copyFile(
  "node_modules/@fontsource/noto-sans-myanmar/files/noto-sans-myanmar-myanmar-400-normal.woff2",
  "dist/assets/receipt-myanmar.woff2",
);
await copyFile(
  "node_modules/@fontsource/noto-sans-thai/files/noto-sans-thai-thai-400-normal.woff2",
  "dist/assets/receipt-thai.woff2",
);

await mkdir("dist/licenses", { recursive: true });
await copyFile(
  "node_modules/@fontsource/noto-sans-myanmar/LICENSE",
  "dist/licenses/Noto-Sans-Myanmar-OFL.txt",
);
await copyFile(
  "node_modules/@fontsource/noto-sans-thai/LICENSE",
  "dist/licenses/Noto-Sans-Thai-OFL.txt",
);
await copyFile("node_modules/bwip-js/LICENSE", "dist/licenses/bwip-js.txt");
