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
