import "../renderer/theme";
import { Buffer } from "buffer";
import { initializeSQLite } from "./sqlite";
import wasm from "sql.js/dist/sql-wasm.wasm?url";
import { createAndroidBridge } from "./bridge";
(globalThis as any).Buffer = Buffer;
try {
  await initializeSQLite(wasm);
  window.pos = await createAndroidBridge();
  await import("../renderer/main");
  await import("./mobile.css");
} catch {
  const root = document.getElementById("root")!;
  root.replaceChildren();
  const p = document.createElement("p");
  p.textContent =
    "Database could not be opened. Your data has not been reset. Close and reopen the app, or restore a verified backup through an authorized support procedure.";
  root.append(p);
}
