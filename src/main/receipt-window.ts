import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { receiptHTML } from "./receipt";
const actions = new Map<
  number,
  (action: string) => Promise<{ message?: string }>
>();
ipcMain.handle("receipt:action", async (event, action: unknown) => {
  const handler = actions.get(event.sender.id);
  if (
    !handler ||
    event.senderFrame !== event.sender.mainFrame ||
    typeof action !== "string" ||
    !["jpeg", "print", "close"].includes(action)
  )
    return { message: "FORBIDDEN" };
  try {
    return await handler(String(action));
  } catch {
    return { message: "ERROR" };
  }
});
export async function openReceipt(
  parent: BrowserWindow,
  invoice: any,
  labels: Record<string, string>,
  preview: boolean,
  authorize: () => void,
) {
  const directory = join(app.getPath("userData"), "print", randomUUID());
  mkdirSync(directory, { recursive: true });
  const adjust = (html: string) =>
    html.replaceAll(
      "../dist/assets/",
      pathToFileURL(join(__dirname, "../dist/assets") + "/").href,
    );
  const file = join(directory, "receipt.html"),
    exportFile = join(directory, "image.html");
  writeFileSync(file, adjust(receiptHTML(invoice, labels, true)));
  writeFileSync(exportFile, adjust(receiptHTML(invoice, labels)));
  const receipt = new BrowserWindow({
    width: 530,
    height: 880,
    parent,
    autoHideMenuBar: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "receipt-preload.cjs"),
    },
  });
  receipt.setMenu(null);
  receipt.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  receipt.webContents.on("will-navigate", (e) => e.preventDefault());
  const print = async () => {
    if (invoice.settings.printer) {
      const printers = await receipt.webContents.getPrintersAsync();
      if (!printers.some((p) => p.name === invoice.settings.printer))
        throw new Error("PRINTER_UNAVAILABLE");
    }
    await new Promise<void>((resolve, reject) =>
      receipt.webContents.print(
        {
          silent: false,
          pageSize:
            invoice.settings.receipt === "A4"
              ? "A4"
              : {
                  width: invoice.settings.receipt === "58mm" ? 58000 : 80000,
                  height: 250000,
                },
          deviceName: invoice.settings.printer || undefined,
          printBackground: true,
        },
        (success, reason) => (success ? resolve() : reject(new Error(reason))),
      ),
    );
  };
  let busy = false;
  const id = receipt.webContents.id;
  actions.set(id, async (action) => {
    if (busy) return { message: "BUSY" };
    authorize();
    if (action === "close") {
      receipt.close();
      return {};
    }
    busy = true;
    try {
      if (action === "print") {
        await print();
        return {};
      }
      const destination = await dialog.showSaveDialog(receipt, {
        title: labels.saveJPEG,
        defaultPath: `${String(invoice.invoice).replace(/[^a-zA-Z0-9_-]/g, "_")}.jpg`,
        filters: [{ name: "JPEG", extensions: ["jpg", "jpeg"] }],
      });
      if (destination.canceled || !destination.filePath) return {};
      const imageWindow = new BrowserWindow({
        width: 480,
        height: 900,
        show: false,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: false,
        },
      });
      imageWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      imageWindow.webContents.on("will-navigate", (e) => e.preventDefault());
      try {
        await imageWindow.loadFile(exportFile);
        // Hidden Chromium windows may start at a 1x1 viewport until explicitly resized.
        imageWindow.setContentSize(480, 900);
        const height = await imageWindow.webContents.executeJavaScript(
          `(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return Math.ceil(document.querySelector("#receipt").getBoundingClientRect().height)})()`,
        );
        if (!Number.isSafeInteger(height) || height < 1 || height > 24000)
          throw new Error("RECEIPT_TOO_LARGE");
        imageWindow.setContentSize(480, height);
        await imageWindow.webContents.executeJavaScript(
          "new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))",
        );
        const image = await imageWindow.webContents.capturePage(
          { x: 0, y: 0, width: 480, height },
          { stayHidden: true, stayAwake: true },
        );
        if (image.isEmpty() || image.getSize().height !== height)
          throw new Error("JPEG_CAPTURE_FAILED");
        authorize();
        writeFileSync(
          /\.jpe?g$/i.test(destination.filePath)
            ? destination.filePath
            : destination.filePath + ".jpg",
          image.toJPEG(95),
        );
        return { message: labels.success || "Saved" };
      } finally {
        imageWindow.destroy();
      }
    } catch {
      return { message: labels.receiptExportError || "ERROR" };
    } finally {
      busy = false;
    }
  });
  receipt.once("closed", () => {
    actions.delete(id);
    rmSync(directory, { recursive: true, force: true });
  });
  await receipt.loadFile(file);
  if (!preview) await print();
  return true;
}
