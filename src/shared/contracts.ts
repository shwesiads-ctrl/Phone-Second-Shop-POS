export const currencies = ["MMK", "THB", "USD"] as const;
export type Currency = (typeof currencies)[number];
export const roles = [
  "Owner",
  "Admin",
  "Cashier",
  "Stock Manager",
  "Technician",
] as const;
export type Role = (typeof roles)[number];
export type User = { id: number; username: string; role: Role };
export type Row = Record<string, any>;
export type Reply<T = any> =
  { ok: true; data: T } | { ok: false; error: string };
export const operations = [
  "printer",
  "barcodeGenerate",
  "demoInventory",
  "demoDataset",
  "exchange",
  "paymentMethod",
  "inspectionUpdate",
  "wholesale",
  "printers",
  "quote",
  "reportConvert",
  "cashMovement",
  "repairReopen",
  "repairCancel",
  "warrantyUpdate",
  "contactHistory",
  "photo",
  "label",
  "permission",
  "repairPart",
  "replenish",
  "rate",
  "hold",
  "resume",
  "status",
  "setup",
  "login",
  "logout",
  "password",
  "recoveryGenerate",
  "recoveryReset",
  "snapshot",
  "users",
  "contact",
  "purchase",
  "purchaseReverse",
  "accessory",
  "adjust",
  "sale",
  "payment",
  "return",
  "inspect",
  "repair",
  "repairUpdate",
  "warranty",
  "expense",
  "cashSession",
  "settings",
  "backup",
  "restore",
  "receipt",
  "bugExport",
  "support",
  "copy",
  "export",
] as const;
export type Operation = (typeof operations)[number];
export interface Bridge {
  call<T = any>(operation: Operation, input?: unknown): Promise<Reply<T>>;
}
declare global {
  interface Window {
    pos: Bridge;
  }
}
export function money(value: number, currency: Currency, locale = "my-MM") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "MMK" ? 0 : 2,
    maximumFractionDigits: currency === "MMK" ? 0 : 2,
  }).format(value / (currency === "MMK" ? 1 : 100));
}
export function parseMoney(text: string, currency: Currency): number {
  const scale = currency === "MMK" ? 0 : 2;
  if (!new RegExp(`^\\d{1,12}${scale ? "(?:\\.\\d{1,2})?" : ""}$`).test(text))
    throw new Error("INVALID_MONEY");
  const [whole, part = ""] = text.split(".");
  const amount =
    BigInt(whole) * BigInt(scale ? 100 : 1) +
    BigInt(scale ? part.padEnd(2, "0") : 0);
  if (amount > 1_000_000_000_000n) throw new Error("INVALID_MONEY");
  return Number(amount);
}
