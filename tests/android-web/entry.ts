// Test-only native substitute. This entry is never included in the APK assets.
import { Buffer } from "buffer";
import { initializeSQLite } from "../../src/android/sqlite";
import wasm from "sql.js/dist/sql-wasm.wasm?url";
import { createAndroidBridge, type NativePOS } from "../../src/android/bridge";
(globalThis as any).Buffer = Buffer;
await initializeSQLite(wasm);
const harness: any = {
  failSave: false,
  exports: [],
  importData: undefined,
  previews: [],
};
const native: NativePOS = {
  load: async () => ({
    data: localStorage.getItem("test.database") || undefined,
  }),
  save: async ({ data }) => {
    if (harness.failSave) throw new Error("simulated disk full");
    localStorage.setItem("test.database", data);
  },
  info: async () => ({
    version: "0.2.0-android.test",
    platform: "Android bridge browser test",
  }),
  exportFile: async (input) => {
    harness.exports.push(input);
    return { saved: true };
  },
  importFile: async () => ({ data: harness.importData }),
  pickImage: async () => ({}),
  preview: async (input) => {
    harness.previews.push(input);
  },
  copy: async () => {},
  support: async () => {},
};
(window as any).androidHarness = harness;
window.pos = await createAndroidBridge(native);
await import("../../src/renderer/main");
await import("../../src/android/mobile.css");
