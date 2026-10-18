import { z } from "zod";
import { currencies, roles } from "../shared/contracts";
const text = z.string().trim().min(1).max(200);
const note = z.string().trim().max(4000).default("");
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const amount = z.number().int().min(0).max(1_000_000_000_000);
const currency = z.enum(currencies);
const request = z.string().uuid();
const method = text;
const password = z.string().min(10).max(128);
const username = z
  .string()
  .trim()
  .min(3)
  .max(60)
  .regex(/^[\p{L}\p{N}_. -]+$/u);
const inspectionFields = {
  storage: z.string().max(100).default(""),
  ram: z.string().max(100).default(""),
  color: z.string().max(100).default(""),
  network: z.string().max(100).default(""),
  sim: z.string().max(100).default(""),
  serial: z.string().max(100).default(""),
  batteryHealth: z.number().int().min(0).max(100).optional(),
  screen: z.enum(["working", "faulty", "unknown"]).default("unknown"),
  camera: z.enum(["working", "faulty", "unknown"]).default("unknown"),
  faceId: z.enum(["working", "faulty", "unknown"]).default("unknown"),
  fingerprint: z.enum(["working", "faulty", "unknown"]).default("unknown"),
  sensors: z.enum(["working", "faulty", "unknown"]).default("unknown"),
  included: z.string().max(1000).default(""),
};
export const schemas = {
  wholesale: z.object({}),
  paymentMethod: z.object({ name: text, active: z.boolean() }),
  inspectionUpdate: z.object({
    id,
    reason: text,
    inspection: z.object(inspectionFields),
    details: note,
  }),
  exchange: z.object({ request, return: z.unknown(), sale: z.unknown() }),
  quote: z.object({
    amount,
    currency,
    targetCurrency: currency,
    rateId: id.optional(),
  }),
  reportConvert: z.object({
    currency,
    rates: z.array(id).max(6),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  }),
  cashMovement: z.object({
    request,
    direction: z.enum(["in", "out"]),
    amount: amount.refine((v) => v > 0),
    currency,
    reason: text,
  }),
  repairReopen: z.object({ id, reason: text }),
  repairCancel: z.object({ id, reason: text, method }),
  warrantyUpdate: z.object({
    id,
    status: z.enum(["approved", "rejected", "resolved"]),
    resolution: text,
  }),
  contactHistory: z.object({ id }),
  photo: z.object({
    kind: z.enum(["phone", "repair", "store"]),
    id,
    consent: z.literal(true),
  }),
  label: z.object({ kind: z.enum(["phone", "accessory"]), id }),
  permission: z.object({
    userId: id,
    operation: z.enum([
      "purchase",
      "purchaseReverse",
      "accessory",
      "adjust",
      "sale",
      "wholesale",
      "exchange",
      "inspectionUpdate",
      "payment",
      "return",
      "inspect",
      "repair",
      "repairUpdate",
      "warranty",
      "expense",
      "cashSession",
      "backup",
      "export",
      "settings",
    ]),
    allowed: z.boolean(),
  }),
  repairPart: z.object({
    request,
    id,
    accessoryId: id,
    rateId: id.optional(),
    quantity: z.number().int().min(1).max(10000),
  }),
  replenish: z.object({
    request,
    id,
    contactId: id,
    quantity: z.number().int().min(1).max(100000),
    unitCost: amount,
    method,
  }),
  rate: z.object({
    from: currency,
    to: currency,
    numerator: z.number().int().min(1).max(1_000_000_000),
    denominator: z.number().int().min(1).max(1_000_000_000),
    source: text,
  }),
  hold: z.object({
    label: text,
    content: z
      .string()
      .max(20000)
      .refine((v) => {
        try {
          const data = JSON.parse(v);
          return Array.isArray(data.cart) && data.cart.length <= 100;
        } catch {
          return false;
        }
      }),
  }),
  resume: z.object({ id }),
  status: z.object({}),
  setup: z.object({ username, password }),
  login: z.object({ username, password: z.string().max(128) }),
  logout: z.object({}),
  recoveryGenerate: z.object({ current: z.string().min(1).max(128) }),
  recoveryReset: z.object({
    username,
    key: z.string().min(1).max(100),
    password,
  }),
  password: z.object({ current: z.string().max(128), password }),
  snapshot: z.object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    search: z.string().max(200).default(""),
    page: z.number().int().min(0).max(100000).default(0),
  }),
  users: z.object({ username, password, role: z.enum(roles) }),
  contact: z.object({
    name: text,
    phone: z.string().trim().max(60).default(""),
    address: note,
    kind: z.enum(["customer", "supplier"]),
  }),
  purchase: z.object({
    ...inspectionFields,
    request,
    contactId: id,
    currency,
    brand: text,
    model: text,
    imei1: z.string().trim().max(32).default(""),
    imei2: z.string().trim().max(32).default(""),
    alternate: z.string().trim().max(100).default(""),
    alternateApproved: z.boolean().default(false),
    condition: z.enum(["new", "used", "refurbished"]),
    grade: z.enum(["A", "B", "C"]),
    details: note,
    cost: amount,
    refurbishment: amount.default(0),
    price: amount,
    minimum: amount.default(0),
    paidCurrency: currency.optional(),
    paidRateId: id.optional(),
    paid: amount,
    method,
  }),
  purchaseReverse: z.object({
    id,
    reason: text,
    request,
    refund: amount.optional(),
    method: method.default("Cash"),
  }),
  accessory: z.object({
    wholesale: amount.optional(),
    sku: text,
    barcode: z.string().trim().max(100).default(""),
    name: text,
    category: text,
    cost: amount,
    price: amount,
    currency,
    quantity: z.number().int().min(0).max(100000),
    reorder: z.number().int().min(0).max(100000),
    method,
  }),
  adjust: z.object({
    id,
    delta: z
      .number()
      .int()
      .min(-100000)
      .max(100000)
      .refine((v) => v !== 0),
    reason: text,
  }),
  sale: z.object({
    request,
    contactId: id.optional(),
    currency,
    items: z
      .array(
        z.object({
          pricingTier: z.enum(["retail", "wholesale"]).default("retail"),
          kind: z.enum(["phone", "accessory"]),
          id,
          quantity: z.number().int().min(1).max(10000),
          rateId: id.optional(),
          price: amount,
          warrantyType: z
            .enum(["none", "shop", "manufacturer"])
            .default("shop"),
          warrantyDays: z.number().int().min(0).max(3650).default(0),
        }),
      )
      .min(1)
      .max(100),
    tradeIn: z
      .object({
        currency: currency.optional(),
        rateId: id.optional(),
        brand: text,
        model: text,
        imei1: z.string().max(32).default(""),
        imei2: z.string().max(32).default(""),
        alternate: z.string().max(100).default(""),
        alternateApproved: z.boolean().default(false),
        condition: z.enum(["used", "new", "refurbished"]),
        grade: z.enum(["A", "B", "C"]),
        details: note,
        cost: amount,
        price: amount,
        minimum: amount.default(0),
      })
      .optional(),
    discount: amount.default(0),
    payments: z
      .array(
        z.object({
          amount: amount.refine((v) => v > 0),
          method,
          received: amount.optional(),
          currency: currency.optional(),
          rateId: id.optional(),
        }),
      )
      .max(10)
      .default([]),
  }),
  payment: z.object({
    received: amount.optional(),
    rateId: id.optional(),
    currency: currency.optional(),
    request,
    target: z.enum(["sale", "purchase", "repair"]),
    id,
    amount: amount.refine((v) => v > 0),
    method,
  }),
  return: z.object({
    currency: currency.optional(),
    request,
    id,
    refund: amount,
    reason: text,
    method,
    items: z
      .array(
        z.object({
          saleItem: id,
          quantity: z.number().int().min(1).max(10000),
          restock: z.boolean().default(true),
        }),
      )
      .min(1)
      .max(100)
      .optional(),
  }),
  inspect: z.object({ id, reason: text }),
  repair: z.object({
    contactId: id,
    device: text,
    identifier: text,
    problem: text,
    inspection: note,
    technician: id.optional(),
    estimate: amount,
    currency,
  }),
  repairUpdate: z.object({
    id,
    status: z.enum([
      "Received",
      "Diagnosing",
      "Waiting for Approval",
      "Waiting for Parts",
      "Repairing",
      "Ready for Collection",
      "Delivered",
      "Cancelled",
    ]),
    diagnosis: note,
    approved: z.boolean(),
    final: amount,
    warrantyDays: z.number().int().min(0).max(3650).default(0),
    reason: note,
  }),
  warranty: z
    .object({ saleItem: id.optional(), repairId: id.optional(), reason: text })
    .refine((v) => Boolean(v.saleItem) !== Boolean(v.repairId)),
  expense: z.object({
    request,
    category: text,
    description: text,
    amount: amount.refine((v) => v > 0),
    currency,
    method,
  }),
  cashSession: z.discriminatedUnion("action", [
    z.object({ action: z.literal("open"), currency, opening: amount }),
    z.object({ action: z.literal("close"), id, counted: amount }),
  ]),
  settings: z.object({
    language: z.enum(["my-MM", "th-TH", "en-US"]),
    currency,
    region: z.string().min(2).max(10),
    timezone: z
      .string()
      .min(1)
      .max(100)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }),
    dateFormat: z.enum(["short", "medium", "long"]).default("medium"),
    timeFormat: z.enum(["12", "24"]).default("24"),
    firstDay: z.number().int().min(1).max(7).default(1),
    digits: z.enum(["latn", "mymr"]),
    store: text,
    phone: z.string().max(100),
    address: note,
    footer: note,
    receipt: z.enum(["A4", "80mm", "58mm"]),
    printer: z.string().max(200).default(""),
  }),
  backup: z.object({}),
  restore: z.object({}),
  printers: z.object({}),
  receipt: z.object({
    paper: z.enum(["A4", "80mm", "58mm"]).optional(),
    id,
    kind: z.enum(["sale", "purchase", "repair"]).default("sale"),
    language: z.enum(["my-MM", "th-TH", "en-US"]).optional(),
    preview: z.boolean().default(true),
  }),
  bugExport: z.object({
    category: text,
    subject: text,
    description: note.refine((v) => v.length > 0),
    steps: note,
    expected: note,
    actual: note,
    screenshot: z
      .string()
      .max(7_000_000)
      .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/)
      .optional(),
    diagnostics: z.boolean().default(false),
  }),
  support: z.object({}),
  copy: z.object({ text: z.string().max(20000) }),
  export: z.object({
    table: z.enum([
      "contacts",
      "phones",
      "sales",
      "purchases",
      "expenses",
      "repairs",
      "audit",
    ]),
  }),
};
export function validIMEI(value: string) {
  if (!/^\d{15}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let n = Number(value[i]);
    if (i % 2 === 1) n *= 2;
    sum += Math.floor(n / 10) + (n % 10);
  }
  return sum % 10 === 0;
}
