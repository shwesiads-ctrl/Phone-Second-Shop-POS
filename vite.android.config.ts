import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  root: resolve("mobile"),
  base: "./",
  resolve: {
    alias: {
      "node:sqlite": resolve("src/android/sqlite.ts"),
      "node:crypto": resolve("src/android/crypto.ts"),
      "node:fs": resolve("src/android/node-stubs.ts"),
      "node:path": resolve("src/android/node-stubs.ts"),
    },
  },
  build: {
    outDir: resolve("dist-android"),
    emptyOutDir: true,
    target: "es2022",
  },
  define: { global: "globalThis" },
});
