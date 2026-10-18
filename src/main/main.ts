import { DemoWorkspace } from "./demo-workspace";
import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  clipboard,
} from "electron";
import { validateBackup, prepareRestore } from "./backup";
import { randomUUID } from "node:crypto";
import bwipjs from "bwip-js/node";
import { join, resolve, dirname } from "node:path";
import {
  readFileSync,
  renameSync,
  realpathSync,
  rmSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
} from "node:fs";
import { pathToFileURL } from "node:url";
import { backup } from "node:sqlite";
import { platform, release } from "node:os";
import { openDatabase } from "./database";
import { DomainError, ShopService } from "./service";
import { operations, type Operation } from "../shared/contracts";
import { schemas } from "./validation";
import { receiptHTML } from "./receipt";
import { dictionaries } from "../renderer/i18n";
if (!app.isPackaged && process.env.POS_TEST_DATA_DIR)
  app.setPath("userData", resolve(process.env.POS_TEST_DATA_DIR));
if (!app.requestSingleInstanceLock()) app.quit();
let service: ShopService;
const workspace = new DemoWorkspace();
let window: BrowserWindow;
const databasePath = () => join(app.getPath("userData"), "business.sqlite");
const checkDatabase = validateBackup;
async function desktop(operation: Operation, raw: unknown) {
  const input = (schemas[operation] as any).parse(raw ?? {});
  service.require(operation);
  const requested = (raw as any)?.uiLanguage;
  const locale = ["my-MM", "th-TH", "en-US"].includes(requested)
    ? requested
    : service.settings().language || "my-MM";
  const text = (key: string) =>
    dictionaries[locale as keyof typeof dictionaries][key];
  if (operation === "photo") {
    if (input.kind === "phone" && service.user!.role === "Technician")
      throw new DomainError("FORBIDDEN");
    if (
      input.kind === "store" &&
      !["Owner", "Admin"].includes(service.user!.role)
    )
      throw new DomainError("FORBIDDEN");
    const table = input.kind === "phone" ? "phones" : "repairs";
    if (
      input.kind !== "store" &&
      !service.row(`SELECT id FROM ${table} WHERE id=?`, input.id)
    )
      throw new DomainError("NOT_FOUND");
    const result = await dialog.showOpenDialog(window, {
      properties: ["openFile"],
      filters: [{ name: "PNG / JPEG", extensions: ["png", "jpg", "jpeg"] }],
    });
    if (result.canceled) return null;
    const bytes = readFileSync(result.filePaths[0]);
    if (bytes.length > 5_000_000) throw new DomainError("INVALID_INPUT");
    const mime = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "image/png"
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        ? "image/jpeg"
        : null;
    if (!mime) throw new DomainError("INVALID_INPUT");
    service.run(
      "INSERT INTO photos(kind,record_id,content,created) VALUES(?,?,?,?)",
      input.kind,
      input.id,
      `data:${mime};base64,${bytes.toString("base64")}`,
      new Date().toISOString(),
    );
    if (input.kind === "store")
      service.run(
        "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        "logo",
        JSON.stringify(`data:${mime};base64,${bytes.toString("base64")}`),
      );
    service.audit("photo.add", `${input.kind}:${input.id}`);
    return true;
  }
  if (operation === "label") {
    const record = service.row(
      input.kind === "phone"
        ? "SELECT COALESCE(imei1,alternate,imei2) identifier FROM phones WHERE id=?"
        : "SELECT COALESCE(NULLIF(barcode,''),sku) identifier FROM accessories WHERE id=?",
      input.id,
    );
    if (!record) throw new DomainError("NOT_FOUND");
    const qr = bwipjs.toSVG({
      bcid: "qrcode",
      text: record.identifier,
      scale: 3,
    });
    const barcode = bwipjs.toSVG({
      bcid: "code128",
      text: record.identifier,
      scale: 2,
      height: 12,
      includetext: true,
    });
    const label = new BrowserWindow({
      width: 600,
      height: 500,
      parent: window,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    await label.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(
          `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>Barcode / QR</title><style>body{text-align:center;padding:30px}img{max-width:100%;display:block;margin:25px auto}</style></head><body><img alt="QR" src="data:image/svg+xml;base64,${Buffer.from(qr).toString("base64")}"><img alt="Barcode" src="data:image/svg+xml;base64,${Buffer.from(barcode).toString("base64")}"></body></html>`,
        ),
    );
    return true;
  }
  if (operation === "backup") {
    const result = await dialog.showSaveDialog(window, {
      title: text("backup"),
      defaultPath: `POS-backup-${Date.now()}.sqlite`,
      filters: [{ name: "SQLite", extensions: ["sqlite"] }],
    });
    if (result.canceled || !result.filePath) return null;
    await backup(service.db, result.filePath);
    checkDatabase(result.filePath);
    service.audit("backup.create", "database");
    return true;
  }
  if (operation === "printers")
    return (await window.webContents.getPrintersAsync()).map((p) => ({
      name: p.name,
      displayName: p.displayName,
    }));
  if (operation === "restore") {
    const chosen = await dialog.showOpenDialog(window, {
      properties: ["openFile"],
      filters: [{ name: "SQLite backup", extensions: ["sqlite"] }],
    });
    if (chosen.canceled) return null;
    const source = chosen.filePaths[0];
    if (realpathSync(source) === realpathSync(databasePath()))
      throw new DomainError("INVALID_BACKUP");
    const stage = join(
      dirname(databasePath()),
      `restore-stage-${randomUUID()}.sqlite`,
    );
    const preview = await prepareRestore(source, stage);
    try {
      const confirmation = await dialog.showMessageBox(window, {
        type: "warning",
        buttons: [text("cancel"), text("restore")],
        defaultId: 0,
        cancelId: 0,
        message: text("restore"),
        detail: `${text("restoreWarning")}\n${text("sales")}: ${preview.sales} · ${text("inventory")}: ${preview.phones} · Schema ${preview.version}`,
      });
      if (confirmation.response !== 1) return null;
      service.require("restore");
      const safety = join(
        dirname(databasePath()),
        `before-restore-${Date.now()}.sqlite`,
      );
      await backup(service.db, safety);
      checkDatabase(safety);
      service.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      service.db.close();
      try {
        renameSync(stage, databasePath());
        service = new ShopService(openDatabase(databasePath()));
      } catch (error) {
        copyFileSync(safety, databasePath());
        service = new ShopService(openDatabase(databasePath()));
        throw error;
      }
      return { restored: true };
    } finally {
      rmSync(stage, { force: true });
    }
  }
  if (operation === "receipt") {
    const invoice = service.invoice(input.id, input.kind);
    const receiptLocale = input.language || locale;
    invoice.settings = {
      ...invoice.settings,
      language: receiptLocale,
      receipt: input.paper || invoice.settings.receipt,
    };
    const print = new BrowserWindow({
      width: 600,
      height: 850,
      parent: window,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    print.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    // A temporary local HTML file keeps offline bundled fonts usable in preview and print.
    const directory = join(app.getPath("userData"), "print");
    mkdirSync(directory, { recursive: true });
    const html = receiptHTML(
      invoice,
      dictionaries[receiptLocale as keyof typeof dictionaries],
    );
    const fonts = join(__dirname, "../dist/assets");
    const adjusted = html.replaceAll(
      "../dist/assets/",
      pathToFileURL(fonts + "/").href,
    );
    const file = join(directory, "receipt.html");
    writeFileSync(file, adjusted);
    await print.loadFile(file);
    if (!input.preview && invoice.settings.printer) {
      const printers = await print.webContents.getPrintersAsync();
      if (!printers.some((p) => p.name === invoice.settings.printer)) {
        print.close();
        throw new DomainError("PRINTER_UNAVAILABLE");
      }
    }
    if (!input.preview)
      await new Promise<void>((res, rej) =>
        print.webContents.print(
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
          (success, reason) => (success ? res() : rej(new Error(reason))),
        ),
      );
    return true;
  }
  if (operation === "bugExport") {
    const report = [
      `Phone Second Shop POS ${app.getVersion()}`,
      `${platform()} ${release()}`,
      ...Object.entries(input)
        .filter(([key]) => !["screenshot", "diagnostics"].includes(key))
        .map(([key, value]) => `${key}:\n${value}`),
      ...(input.diagnostics
        ? [
            "Diagnostics: local SQLite; offline mode; no database contents attached.",
          ]
        : []),
    ].join("\n\n");
    const redact = report
      .replace(
        /(password|token|api[_ -]?key|secret)\s*[:=]\s*\S+/gi,
        "$1: [REDACTED]",
      )
      .replace(/\b\d{15}\b/g, "[IMEI REDACTED]");
    const result = await dialog.showSaveDialog(window, {
      defaultPath: `POS-report-${Date.now()}.txt`,
      filters: [{ name: "Text", extensions: ["txt"] }],
    });
    if (result.canceled || !result.filePath) return null;
    writeFileSync(result.filePath, redact, "utf8");
    if (input.screenshot) {
      const [header, body] = input.screenshot.split(",");
      writeFileSync(
        result.filePath + (header.includes("png") ? ".png" : ".jpg"),
        Buffer.from(body, "base64"),
      );
    }
    return true;
  }
  if (operation === "support") {
    await shell.openExternal("https://t.me/kominit");
    return true;
  }
  if (operation === "copy") {
    clipboard.writeText(input.text);
    return true;
  }
  if (operation === "export") {
    const rows = service.rows(`SELECT * FROM ${input.table}`);
    const columns = rows.length ? Object.keys(rows[0]) : [];
    const cell = (v: unknown) => {
      let value = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(value)) value = "'" + value;
      return '"' + value.replaceAll('"', '""') + '"';
    };
    const csv =
      "\uFEFF" +
      [
        columns.map(cell).join(","),
        ...rows.map((row) => columns.map((k) => cell(row[k])).join(",")),
      ].join("\r\n");
    const result = await dialog.showSaveDialog(window, {
      defaultPath: `${input.table}-${Date.now()}.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (result.canceled || !result.filePath) return null;
    writeFileSync(result.filePath, csv);
    return true;
  }
  throw new DomainError("INVALID_OPERATION");
}
app.whenReady().then(async () => {
  service = new ShopService(openDatabase(databasePath()));
  const isDev = process.env.POS_DEV === "1" && !app.isPackaged;
  window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1000,
    minHeight: 700,
    title: "Phone Second Shop POS",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  let busy = false;
  ipcMain.handle(
    "pos:call",
    async (event, operation: Operation, input: unknown) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        !operations.includes(operation)
      )
        return { ok: false, error: "FORBIDDEN" };
      if (busy) return { ok: false, error: "BUSY" };
      busy = true;
      try {
        if (operation === "demoDataset") {
          const { action } = schemas.demoDataset.parse(input);
          service =
            action === "enter"
              ? workspace.enter(service)
              : workspace.leave(service);
          return { ok: true, data: { active: workspace.active } };
        }
        if (workspace.active && !service.user) {
          service = workspace.leave(service);
          if (!["status", "logout", "login"].includes(operation))
            throw new DomainError("UNAUTHENTICATED");
        }
        if (operation === "logout" && workspace.active)
          service = workspace.leave(service);
        workspace.guard(operation);
        const desktopOps: Operation[] = [
          "printers",
          "photo",
          "label",
          "backup",
          "restore",
          "receipt",
          "bugExport",
          "support",
          "copy",
          "export",
        ];
        let data = desktopOps.includes(operation)
          ? await desktop(operation, input)
          : service.invoke(operation, input);
        if (operation === "status")
          data = {
            ...data,
            version: app.getVersion(),
            platform: platform(),
            locale: app.getLocale(),
            systemLocale: app.getSystemLocale(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          };
        if (operation === "snapshot" || operation === "status")
          data = { ...data, demoMode: workspace.active };
        return { ok: true, data };
      } catch (error: any) {
        const known = error instanceof DomainError;
        const validation = error?.name === "ZodError";
        const errorCode = known
          ? error.message
          : validation
            ? "INVALID_INPUT"
            : error?.errcode === 19 ||
                /constraint failed/i.test(error?.message || "")
              ? "CONFLICT"
              : "OPERATION_FAILED";
        // Never log arguments, customer records, passwords or raw SQLite errors.
        console.error(
          "POS operation failed:",
          operation,
          errorCode,
          validation
            ? error.issues
                .slice(0, 20)
                .map((i: any) => ({ path: i.path, code: i.code }))
            : [],
        );
        return { ok: false, error: errorCode };
      } finally {
        busy = false;
      }
    },
  );
  if (isDev) await window.loadURL("http://127.0.0.1:5173");
  else await window.loadFile(join(__dirname, "../dist/index.html"));
  app.on("before-quit", () => service.db.close());
});
app.on("second-instance", () => {
  if (window) {
    if (window.isMinimized()) window.restore();
    window.focus();
  }
});
app.on("window-all-closed", () => app.quit());
