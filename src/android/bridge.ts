import { registerPlugin } from "@capacitor/core";
import { Buffer } from "buffer";
import bwipjs from "bwip-js/browser";
import { ShopService, DomainError } from "../main/service";
import { openDatabase, SCHEMA_VERSION } from "../main/database";
import { receiptHTML } from "../main/receipt";
import { schemas } from "../main/validation";
import {
  operations,
  type Bridge,
  type Operation,
  type Row,
} from "../shared/contracts";
import { dictionaries } from "../renderer/i18n";
import { useDatabaseBytes, type DatabaseSync } from "./sqlite";
export interface NativePOS {
  load(): Promise<{ data?: string }>;
  save(input: { data: string }): Promise<void>;
  info(): Promise<{ version: string; platform: string }>;
  exportFile(input: {
    name: string;
    mime: string;
    data: string;
  }): Promise<{ saved: boolean }>;
  importFile(): Promise<{ data?: string }>;
  pickImage(): Promise<{ data?: string }>;
  preview(input: {
    html: string;
    paper: string;
    preview: boolean;
  }): Promise<void>;
  copy(input: { text: string }): Promise<void>;
  support(): Promise<void>;
}
const Native = registerPlugin<NativePOS>("PosNative");
const readOnly = new Set<Operation>([
  "status",
  "snapshot",
  "quote",
  "contactHistory",
  "wholesale",
]);
function fromBytes(data?: string) {
  useDatabaseBytes(
    data ? new Uint8Array(Buffer.from(data, "base64")) : undefined,
  );
  return new ShopService(openDatabase(":memory:"), true);
}
function bytes(service: ShopService) {
  return (service.db as unknown as DatabaseSync).export();
}
function errorCode(e: any) {
  if (e instanceof DomainError) return e.message;
  if (e?.name === "ZodError") return "INVALID_INPUT";
  if (/constraint failed/i.test(e?.message || "")) return "CONFLICT";
  if (["INVALID_MONEY", "DATABASE_NEWER"].includes(e?.message))
    return e.message;
  return "OPERATION_FAILED";
}
/** Native app sandbox + bundled-only WebView. No remote account or synchronization. */
export async function createAndroidBridge(
  native: NativePOS = Native,
): Promise<Bridge> {
  const loaded = await native.load();
  let service = fromBytes(loaded.data);
  const info = await native.info();
  let saveFailed = false;
  const persist = async () => {
    try {
      await native.save({
        data: Buffer.from(bytes(service)).toString("base64"),
      });
    } catch {
      saveFailed = true;
      throw new DomainError("STORAGE_FAILED");
    }
  };
  await persist();
  let busy = false;
  async function desktop(operation: Operation, raw: any) {
    const input = (schemas[operation] as any).parse(raw ?? {});
    service.require(operation);
    const language = raw?.uiLanguage || service.settings().language || "my-MM";
    const labels =
      dictionaries[language as keyof typeof dictionaries] ??
      dictionaries["my-MM"];
    if (operation === "printers") return []; // Android uses its system print-service chooser.
    if (operation === "copy") {
      await native.copy(input);
      return true;
    }
    if (operation === "support") {
      await native.support();
      return true;
    }
    if (operation === "backup") {
      const result = await native.exportFile({
        name: `POS-backup-${Date.now()}.sqlite`,
        mime: "application/octet-stream",
        data: Buffer.from(bytes(service)).toString("base64"),
      });
      if (!result.saved) return null;
      service.audit("backup.create", "database");
      await persist();
      return true;
    }
    if (operation === "restore") {
      const chosen = await native.importFile();
      if (!chosen.data) return null;
      let candidate: ShopService | undefined;
      try {
        candidate = fromBytes(chosen.data);
        if (
          candidate.row("PRAGMA integrity_check")?.integrity_check !== "ok" ||
          candidate.rows("PRAGMA foreign_key_check").length
        )
          throw new Error("INVALID_BACKUP");
        for (const name of [
          "users",
          "sales",
          "phones",
          "payments",
          "payment_refunds",
          "report_runs",
        ])
          candidate.rows(`SELECT * FROM ${name} LIMIT 0`);
        if (!window.confirm(labels.confirm)) {
          candidate.db.close();
          return null;
        }
        // Keep a native safety copy before replacing the app database.
        const safety = await native.exportFile({
          name: `POS-before-restore-${Date.now()}.sqlite`,
          mime: "application/octet-stream",
          data: Buffer.from(bytes(service)).toString("base64"),
        });
        if (!safety.saved) {
          candidate.db.close();
          return null;
        }
        await native.save({
          data: Buffer.from(bytes(candidate)).toString("base64"),
        });
        service.db.close();
        service = candidate;
        return { restored: true };
      } catch (e) {
        if (candidate && candidate !== service) candidate.db.close();
        throw new DomainError("INVALID_BACKUP");
      }
    }
    if (operation === "photo") {
      if (
        input.kind === "store" &&
        !["Owner", "Admin"].includes(service.user!.role)
      )
        throw new DomainError("FORBIDDEN");
      if (input.kind === "phone" && service.user!.role === "Technician")
        throw new DomainError("FORBIDDEN");
      if (
        input.kind !== "store" &&
        !service.row(
          `SELECT id FROM ${input.kind === "phone" ? "phones" : "repairs"} WHERE id=?`,
          input.id,
        )
      )
        throw new DomainError("NOT_FOUND");
      const image = await native.pickImage();
      if (!image.data) return null;
      service.run(
        "INSERT INTO photos(kind,record_id,content,created) VALUES(?,?,?,?)",
        input.kind,
        input.id,
        image.data,
        new Date().toISOString(),
      );
      if (input.kind === "store")
        service.run(
          "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          "logo",
          JSON.stringify(image.data),
        );
      service.audit("photo.add", `${input.kind}:${input.id}`);
      await persist();
      return true;
    }
    if (operation === "receipt") {
      const invoice = service.invoice(input.id, input.kind);
      invoice.settings = {
        ...invoice.settings,
        language: input.language || language,
        receipt: input.paper || invoice.settings.receipt,
      };
      const html = receiptHTML(
        invoice,
        dictionaries[invoice.settings.language as keyof typeof dictionaries] ??
          labels,
      ).replaceAll("../dist/assets/", "file:///android_asset/public/assets/");
      await native.preview({
        html,
        paper: invoice.settings.receipt || "80mm",
        preview: input.preview,
      });
      return true;
    }
    if (operation === "label") {
      const item = service.row(
        input.kind === "phone"
          ? "SELECT COALESCE(imei1,alternate,imei2) identifier FROM phones WHERE id=?"
          : "SELECT COALESCE(NULLIF(barcode,''),sku) identifier FROM accessories WHERE id=?",
        input.id,
      );
      if (!item) throw new DomainError("NOT_FOUND");
      const img = (bcid: string) =>
        "data:image/svg+xml;base64," +
        Buffer.from(
          bwipjs.toSVG({
            bcid,
            text: item.identifier,
            scale: 3,
            height: 12,
            includetext: true,
          }),
        ).toString("base64");
      await native.preview({
        html: `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>img{display:block;max-width:100%;margin:12px auto}</style></head><body><img src="${img("qrcode")}"><img src="${img("code128")}"></body></html>`,
        paper: "80mm",
        preview: true,
      });
      return true;
    }
    if (operation === "export") {
      const rows = service.rows(`SELECT * FROM ${input.table}`);
      const columns = rows.length ? Object.keys(rows[0]) : [];
      const cell = (v: unknown) => {
        let s = String(v ?? "");
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return '"' + s.replaceAll('"', '""') + '"';
      };
      const csv =
        "\uFEFF" +
        [
          columns.map(cell).join(","),
          ...rows.map((r) => columns.map((c) => cell(r[c])).join(",")),
        ].join("\r\n");
      const out = await native.exportFile({
        name: `${input.table}-${Date.now()}.csv`,
        mime: "text/csv",
        data: Buffer.from(csv).toString("base64"),
      });
      return out.saved ? true : null;
    }
    if (operation === "bugExport") {
      const text = [
        `Phone Second Shop POS ${info.version}`,
        info.platform,
        ...Object.entries(input)
          .filter(([k]) => !["screenshot", "diagnostics"].includes(k))
          .map(([k, v]) => `${k}:\n${v}`),
        ...(input.diagnostics
          ? [
              `Offline SQLite WASM; schema ${SCHEMA_VERSION}; no business data attached.`,
            ]
          : []),
      ]
        .join("\n\n")
        .replace(
          /(password|token|api[_ -]?key|secret)\s*[:=]\s*\S+/gi,
          "$1: [REDACTED]",
        )
        .replace(/\b\d{15}\b/g, "[IMEI REDACTED]");
      const out = await native.exportFile({
        name: `POS-report-${Date.now()}.txt`,
        mime: "text/plain",
        data: Buffer.from(text).toString("base64"),
      });
      if (out.saved && input.screenshot) {
        const [head, data] = input.screenshot.split(",");
        await native.exportFile({
          name: `POS-screenshot-${Date.now()}.${head.includes("png") ? "png" : "jpg"}`,
          mime: head.includes("png") ? "image/png" : "image/jpeg",
          data,
        });
      }
      return out.saved ? true : null;
    }
    throw new DomainError("INVALID_OPERATION");
  }
  const desktopOps = new Set<Operation>([
    "printers",
    "backup",
    "restore",
    "photo",
    "receipt",
    "label",
    "export",
    "bugExport",
    "support",
    "copy",
  ]);
  return Object.freeze({
    call: async <T>(
      operation: Operation,
      input: unknown = {},
    ): Promise<any> => {
      if (!operations.includes(operation))
        return { ok: false, error: "INVALID_OPERATION" };
      if (busy) return { ok: false, error: "BUSY" };
      busy = true;
      saveFailed = false;
      const prior = bytes(service);
      try {
        const result = desktopOps.has(operation)
          ? await desktop(operation, input)
          : service.invoke(operation, input);
        if (!desktopOps.has(operation) && !readOnly.has(operation))
          await persist();
        return {
          ok: true,
          data:
            operation === "status"
              ? { ...result, ...info, locale: navigator.language }
              : result,
        };
      } catch (e: any) {
        // Failed authentication updates a durable shared throttle, even across app restarts.
        if (!saveFailed && errorCode(e) === "LOGIN_FAILED") {
          try {
            await persist();
          } catch {
            e = new DomainError("STORAGE_FAILED");
          }
        }
        // A failed durable save must not leave a transaction applied only in RAM.
        if (saveFailed) {
          service.db.close();
          service = fromBytes(Buffer.from(prior).toString("base64"));
        }
        return { ok: false, error: errorCode(e) };
      } finally {
        busy = false;
      }
    },
  });
}
