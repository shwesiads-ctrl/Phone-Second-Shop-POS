import { mkdir, copyFile } from "node:fs/promises";
await mkdir("dist-android/assets", { recursive: true });
for (const [source, name] of [
  [
    "@fontsource/noto-sans-myanmar/files/noto-sans-myanmar-myanmar-400-normal.woff2",
    "receipt-myanmar.woff2",
  ],
  [
    "@fontsource/noto-sans-thai/files/noto-sans-thai-thai-400-normal.woff2",
    "receipt-thai.woff2",
  ],
])
  await copyFile("node_modules/" + source, "dist-android/assets/" + name);

await mkdir("dist-android/licenses", { recursive: true });
for (const [source, name] of [
  ["LICENSE", "APP-AGPL-3.0.txt"],
  [
    "node_modules/@fontsource/noto-sans-myanmar/LICENSE",
    "Noto-Sans-Myanmar-OFL.txt",
  ],
  ["node_modules/@fontsource/noto-sans-thai/LICENSE", "Noto-Sans-Thai-OFL.txt"],
  ["node_modules/bwip-js/LICENSE", "bwip-js.txt"],
  ["node_modules/sql.js/LICENSE", "sql.js.txt"],
  ["node_modules/@noble/hashes/LICENSE", "noble-hashes.txt"],
  ["node_modules/buffer/LICENSE", "buffer.txt"],
  ["node_modules/@capacitor/core/LICENSE", "capacitor.txt"],
])
  await copyFile(source, "dist-android/licenses/" + name);
