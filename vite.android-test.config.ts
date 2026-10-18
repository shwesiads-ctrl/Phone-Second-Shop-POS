import { defineConfig, mergeConfig } from "vite";
import config from "./vite.android.config";
import { resolve } from "node:path";
export default mergeConfig(
  config,
  defineConfig({
    root: resolve("tests/android-web"),
    build: { outDir: resolve("test-results/android-web") },
    server: { host: "127.0.0.1", port: 5174, strictPort: true },
  }),
);
