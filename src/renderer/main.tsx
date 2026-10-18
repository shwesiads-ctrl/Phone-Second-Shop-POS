import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/noto-sans-myanmar/400.css";
import "@fontsource/noto-sans-myanmar/600.css";
import "@fontsource/noto-sans-thai/400.css";
import "./style.css";
import {
  currencies,
  roles,
  money,
  parseMoney,
  type Currency,
  type Operation,
  type Row,
  type User,
} from "../shared/contracts";
import { convertMinor } from "../shared/exchange";
import { translate, type Language } from "./i18n";
type Field = {
  key: string;
  label?: string;
  type?:
    | "text"
    | "password"
    | "number"
    | "money"
    | "textarea"
    | "checkbox"
    | "select";
  options?: string[];
  labels?: Record<string, string>;
  optional?: boolean;
  value?: any;
};
type Editor = {
  title: string;
  op: Operation;
  fields: Field[];
  values?: Row;
  transform?: (v: Row) => Row;
  danger?: boolean;
  readonly?: boolean;
  onSave?: (input: Row) => Promise<any>;
};
const baseMethods = [
  "Cash",
  "KBZPay",
  "WavePay",
  "AYA Pay",
  "Bank transfer",
  "Other",
];
const stages = [
  "Received",
  "Diagnosing",
  "Waiting for Approval",
  "Waiting for Parts",
  "Repairing",
  "Ready for Collection",
  "Delivered",
  "Cancelled",
];
const nav = [
  "dashboard",
  "pos",
  "inventory",
  "accessories",
  "purchasing",
  "sales",
  "contacts",
  "payments",
  "repairs",
  "warranty",
  "accounting",
  "reports",
  "users",
  "settings",
  "about",
  "bug",
];
const field = (
  key: string,
  type: Field["type"] = "text",
  optional = false,
): Field => ({ key, type, optional });
const choose = (key: string, options: string[], optional = false): Field => ({
  key,
  type: "select",
  options,
  optional,
});
function Form({
  config,
  t,
  currency,
  run,
  call,
  setLanguage,
  setEditor,
  busy,
  error,
}: {
  config: Editor;
  t: (key: string) => string;
  currency: Currency;
  run: (fn: () => Promise<any>, reload?: boolean) => Promise<any>;
  call: (op: Operation, input?: unknown) => Promise<any>;
  setLanguage: (v: Language) => void;
  setEditor: (v: Editor | null) => void;
  busy: boolean;
  error: string;
}) {
  const initial = Object.fromEntries(
    config.fields.map((f) => [
      f.key,
      config.values?.[f.key] ??
        f.value ??
        (f.type === "checkbox"
          ? false
          : f.optional
            ? ""
            : f.type === "select"
              ? (f.options?.[0] ?? "")
              : f.type === "number" || f.type === "money"
                ? "0"
                : ""),
    ]),
  );
  const [values, setValues] = useState<Row>(initial);
  const request = useRef(crypto.randomUUID());
  const currentCurrency = (values.currency ||
    config.values?.currency ||
    currency) as Currency;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (config.danger && !window.confirm(t("confirm"))) return;
    const result = await run(async () => {
      let input: Row = { ...values };
      for (const f of config.fields) {
        if (f.optional && input[f.key] === "") {
          delete input[f.key];
          continue;
        }
        if (f.type === "money")
          input[f.key] = parseMoney(
            String(input[f.key]),
            f.key === "paid"
              ? values.paidCurrency || currentCurrency
              : currentCurrency,
          );
        if (
          f.type === "number" ||
          ["contactId", "rateId", "paidRateId"].includes(f.key) ||
          ["rateMMK", "rateTHB", "rateUSD"].includes(f.key)
        )
          input[f.key] = Number(input[f.key]);
      }
      input = { ...config.values, ...input, request: request.current };
      if (config.transform) input = config.transform(input);
      const saved = config.onSave
        ? await config.onSave(input)
        : await call(config.op, input);
      if (config.op === "settings") {
        setLanguage(input.language);
        localStorage.setItem("pos.language", input.language);
      }
      return saved;
    });
    if (result !== undefined && result !== null) setEditor(null);
  }
  return (
    <div className="overlay" role="presentation">
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="section-heading">
          <h2 id="dialog-title">{t(config.title)}</h2>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => setEditor(null)}
          >
            {t("close")}
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            {config.fields.map((f) => (
              <label
                key={f.key}
                className={f.type === "textarea" ? "wide" : ""}
              >
                {t(f.label || f.key)}
                {f.type === "select" ? (
                  <select
                    disabled={config.readonly}
                    aria-label={t(f.label || f.key)}
                    value={values[f.key]}
                    onChange={(e) =>
                      setValues({ ...values, [f.key]: e.target.value })
                    }
                    required={!f.optional}
                  >
                    {f.optional && <option value="">—</option>}
                    {f.options?.map((option) => (
                      <option key={option} value={option}>
                        {f.labels?.[option] ??
                          ([
                            "currency",
                            "language",
                            "grade",
                            "receipt",
                            "method",
                            "target",
                            "contactId",
                            "category",
                            "operation",
                          ].includes(f.key)
                            ? ["target", "method", "category"].includes(
                                f.key,
                              ) &&
                              [
                                "sale",
                                "purchase",
                                "repair",
                                "Cash",
                                "Bank transfer",
                                "Other",
                                "Bug / Error",
                                "UI Problem",
                                "Feature Request",
                              ].includes(option)
                              ? t(option)
                              : option
                            : t(option))}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    value={values[f.key]}
                    onChange={(e) =>
                      setValues({ ...values, [f.key]: e.target.value })
                    }
                    required={!f.optional}
                    maxLength={4000}
                  />
                ) : f.type === "checkbox" ? (
                  <input
                    type="checkbox"
                    checked={!!values[f.key]}
                    onChange={(e) =>
                      setValues({ ...values, [f.key]: e.target.checked })
                    }
                  />
                ) : (
                  <input
                    autoComplete={
                      f.type === "password" ? "new-password" : "off"
                    }
                    type={
                      f.type === "number"
                        ? "number"
                        : f.type === "password"
                          ? "password"
                          : "text"
                    }
                    inputMode={f.type === "money" ? "decimal" : undefined}
                    value={values[f.key]}
                    onChange={(e) =>
                      setValues({ ...values, [f.key]: e.target.value })
                    }
                    required={!f.optional}
                    min={
                      f.type === "number" && f.key !== "delta" ? 0 : undefined
                    }
                    maxLength={f.type === "password" ? 128 : 200}
                  />
                )}
              </label>
            ))}
          </div>
          <p className="form-note">
            {currentCurrency} · {t("paymentNote")}
          </p>
          {error && (
            <p className="error" role="alert">
              {t(error)}
            </p>
          )}
          {!config.readonly && (
            <button disabled={busy}>{busy ? t("busy") : t("save")}</button>
          )}
        </form>
      </section>
    </div>
  );
}

function App() {
  const [language, setLanguage] = useState<Language>(
    (localStorage.getItem("pos.language") as Language) || "my-MM",
  );
  const t = (key: string) => translate(language, key);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [recovered, setRecovered] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<any>(null);
  const methods: string[] = data?.paymentMethods
    ? data.paymentMethods.filter((m: Row) => m.active).map((m: Row) => m.name)
    : baseMethods;
  const [page, setPage] = useState("dashboard");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [pagination, setPagination] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [cart, setCart] = useState<Row[]>([]);
  const [checkoutCurrency, setCheckoutCurrency] = useState<Currency>("MMK");
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState("0");
  const [tenders, setTenders] = useState<Row[]>([
    { amount: "0", method: "Cash" },
  ]);
  const saleRequest = useRef(crypto.randomUUID());
  const [contactHistory, setContactHistory] = useState<any>(null);
  const [convertedReport, setConvertedReport] = useState<Row | null>(null);
  const [tradeIn, setTradeIn] = useState<Row | null>(null);
  const [report, setReport] = useState<Row>({
    category: "Bug / Error",
    subject: "",
    description: "",
    steps: "",
    expected: "",
    actual: "",
  });
  const currency: Currency = data?.settings?.currency || "MMK";
  const m = (value: number, c: Currency = currency) =>
    money(
      value,
      c,
      language + (data?.settings?.digits === "mymr" ? "-u-nu-mymr" : ""),
    );
  const manager = user?.role === "Owner" || user?.role === "Admin";
  const canStock =
    manager ||
    user?.role === "Stock Manager" ||
    data?.permissions?.some(
      (p: Row) =>
        p.user_id === user?.id &&
        p.allowed === 1 &&
        ["purchase", "adjust", "accessory", "inspect"].includes(p.operation),
    );
  const canTill =
    manager ||
    user?.role === "Cashier" ||
    data?.permissions?.some(
      (p: Row) =>
        p.user_id === user?.id &&
        p.allowed === 1 &&
        ["sale", "payment"].includes(p.operation),
    );
  async function call<T = any>(op: Operation, input: unknown = {}): Promise<T> {
    if (!window.pos) throw new Error("DESKTOP_ONLY");
    const reply = await window.pos.call<T>(op, {
      ...(input as Row),
      uiLanguage: language,
    });
    if (!reply.ok) {
      if (
        reply.error === "UNAUTHENTICATED" ||
        reply.error === "STORAGE_FAILED"
      ) {
        setUser(null);
        setData(null);
      }
      throw new Error(reply.error);
    }
    return reply.data;
  }
  async function load() {
    const result = await call("snapshot", {
      search: query,
      page: pagination,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
    setData(result);
  }
  async function run(fn: () => Promise<unknown>, reload = true) {
    if (busy) return;
    setRecoveryKey("");
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await fn();
      if (result !== null) {
        setMessage("success");
        if (reload && user) await load();
      }
      return result;
    } catch (e: any) {
      setError(e.message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setRecoveryKey("");
  }, [page, user]);
  useEffect(() => {
    const clear = () => {
      if (document.hidden) setRecoveryKey("");
    };
    document.addEventListener("visibilitychange", clear);
    return () => document.removeEventListener("visibilitychange", clear);
  }, []);
  async function initialize() {
    try {
      const s = await call("status");
      setStatus(s);
      setUser(s.user);
      if (s.settings.language && !localStorage.getItem("pos.language"))
        setLanguage(s.settings.language);
    } catch {
      setError("DESKTOP_ONLY");
    }
  }
  useEffect(() => {
    void initialize();
  }, []);
  useEffect(() => {
    if (user) void load().catch((e) => setError(e.message));
  }, [user, query, pagination, from, to]);
  useEffect(() => {
    localStorage.setItem("pos.language", language);
    document.documentElement.lang = language;
  }, [language]);
  function edit(value: Editor) {
    setEditor(value);
    setError("");
    setMessage("");
  }
  function moneyFields(...keys: string[]) {
    return keys.map((key) => field(key, "money"));
  }
  function selectCurrency() {
    return { ...choose("currency", [...currencies]), value: currency };
  }
  function Table({
    rows,
    columns,
    actions,
  }: {
    rows: Row[];
    columns: string[];
    actions?: (row: Row) => React.ReactNode;
  }) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((key) => (
                <th key={key}>{t(key)}</th>
              ))}
              {actions && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="empty">
                  {t("noData")}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id ?? index}>
                  {columns.map((key) => (
                    <td key={key}>
                      {[
                        "cost",
                        "price",
                        "minimum",
                        "total",
                        "paid",
                        "original_amount",
                        "total_paid",
                        "capitalized",
                        "refund",
                        "amount",
                        "opening",
                        "counted",
                        "estimate",
                        "final",
                        "balance",
                        "revenue",
                        "cogs",
                        "gross",
                        "expenses",
                        "repairRevenue",
                        "repairCost",
                        "net",
                        "received",
                        "actualCollections",
                        "cashNet",
                        "wholesale",
                        "receivable",
                        "payable",
                        "expected",
                      ].includes(key)
                        ? m(
                            row[key] ?? 0,
                            key === "original_amount"
                              ? row.original_currency
                              : row.currency,
                          )
                        : ["status", "role", "kind", "condition"].includes(key)
                          ? t(row[key])
                          : key === "target"
                            ? t(row[key])
                            : key === "method"
                              ? ["Cash", "Bank transfer", "Other"].includes(
                                  row[key],
                                )
                                ? t(row[key])
                                : row[key]
                              : key === "direction"
                                ? t(row[key])
                                : ["created", "opened", "closed"].includes(
                                      key,
                                    ) && row[key]
                                  ? new Intl.DateTimeFormat(language, {
                                      dateStyle:
                                        data.settings.dateFormat || "medium",
                                      timeStyle: "short",
                                      timeZone:
                                        data.settings.timezone || "Asia/Yangon",
                                      hour12: data.settings.timeFormat === "12",
                                    }).format(new Date(row[key]))
                                  : String(row[key] ?? "—")}
                    </td>
                  ))}
                  {actions && (
                    <td>
                      <div className="row-actions">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }
  function btn(label: string, fn: () => void, danger = false) {
    return (
      <button
        className={danger ? "danger" : "secondary"}
        disabled={busy}
        onClick={fn}
      >
        {t(label)}
      </button>
    );
  }
  function transactionEditor(
    title: string,
    op: Operation,
    fields: Field[],
    values?: Row,
    danger = false,
  ) {
    edit({ title, op, fields, values, danger });
  }
  function rateField(
    key = "rateId",
    optional = true,
    source?: Currency,
    target?: Currency,
  ): Field {
    const rates = (data?.rates || []).filter(
      (r: Row) =>
        (!source || r.source_currency === source) &&
        (!target || r.target_currency === target),
    );
    return {
      ...choose(
        key,
        rates.map((r: Row) => String(r.id)),
        optional,
      ),
      label: "rateId",
      labels: Object.fromEntries(
        rates.map((r: Row) => [
          String(r.id),
          `#${r.id} ${r.source_currency} → ${r.target_currency} · ${r.numerator}/${r.denominator} (${r.basis}) · ${r.source}`,
        ]),
      ),
    };
  }
  function equivalent(
    amount: string,
    source: Currency,
    target: Currency,
    rateId?: string | number,
  ) {
    const value = parseMoney(amount, source);
    if (source === target) return value;
    const r = data.rates.find(
      (r: Row) =>
        r.id === Number(rateId) &&
        r.source_currency === source &&
        r.target_currency === target,
    );
    if (!r) throw new Error("RATE_REQUIRED");
    return convertMinor(
      value,
      source,
      target,
      r.numerator,
      r.denominator,
      r.basis,
    );
  }
  function purchase() {
    transactionEditor("purchasing", "purchase", [
      choose(
        "contactId",
        (data?.contacts || []).map((c: Row) => String(c.id)),
      ),
      selectCurrency(),
      field("brand"),
      field("model"),
      field("imei1", "text", true),
      field("imei2", "text", true),
      field("alternate", "text", true),
      field("alternateApproved", "checkbox"),
      choose("condition", ["used", "new", "refurbished"]),
      choose("grade", ["A", "B", "C"]),
      field("storage", "text", true),
      field("ram", "text", true),
      field("color", "text", true),
      field("network", "text", true),
      field("sim", "text", true),
      field("serial", "text", true),
      field("batteryHealth", "number", true),
      ...["screen", "camera", "faceId", "fingerprint", "sensors"].map((key) =>
        choose(key, ["unknown", "working", "faulty"]),
      ),
      field("included", "text", true),
      field("details", "textarea", true),
      ...moneyFields("cost", "refurbishment", "price", "minimum", "paid"),
      {
        ...choose("paidCurrency", [...currencies], true),
        label: "tenderCurrency",
      },
      rateField("paidRateId"),
      choose("method", methods),
    ]);
  }
  function contact() {
    transactionEditor("contacts", "contact", [
      field("name"),
      field("phone", "text", true),
      field("address", "textarea", true),
      choose("kind", ["customer", "supplier"]),
    ]);
  }
  function accessory() {
    transactionEditor("accessories", "accessory", [
      field("sku"),
      field("barcode", "text", true),
      field("name"),
      field("category"),
      selectCurrency(),
      ...moneyFields("cost", "price"),
      field("wholesale", "money", true),
      field("quantity", "number"),
      field("reorder", "number"),
      choose("method", methods),
    ]);
  }
  function payment() {
    transactionEditor(
      "recordPayment",
      "payment",
      [
        choose("target", ["sale", "purchase", "repair"]),
        selectCurrency(),
        field("id", "number"),
        ...moneyFields("amount"),
        rateField(),
        choose("method", methods),
      ],
      { currency },
    );
  }
  function repair() {
    transactionEditor("repair", "repair", [
      field("contactId", "number"),
      field("device"),
      field("identifier"),
      field("problem"),
      field("inspection", "textarea", true),
      field("technician", "number", true),
      selectCurrency(),
      ...moneyFields("estimate"),
    ]);
  }
  function addCart(item: Row, kind: string) {
    if (cart.some((c) => c.id === item.id && c.kind === kind)) return;
    const foreign = item.currency !== checkoutCurrency;
    const wholesale =
      kind === "accessory" &&
      item.wholesale !== null &&
      item.wholesale !== undefined;
    const add = async (input: Row) => {
      const tier = input.pricingTier || "retail";
      let amount = tier === "wholesale" ? item.wholesale : item.price;
      if (foreign)
        amount = (
          await call("quote", {
            amount,
            currency: item.currency,
            targetCurrency: checkoutCurrency,
            rateId: input.rateId,
          })
        ).amount;
      setCart((previous) => [
        ...previous,
        {
          id: item.id,
          kind,
          name: kind === "phone" ? `${item.brand} ${item.model}` : item.name,
          price: String(amount / (checkoutCurrency === "MMK" ? 1 : 100)),
          currency: checkoutCurrency,
          originalCurrency: item.currency,
          rateId: input.rateId,
          pricingTier: tier,
          quantity: 1,
          warrantyType: "shop",
          warrantyDays: 0,
        },
      ]);
      return true;
    };
    if (foreign || wholesale)
      edit({
        title: "convertItem",
        op: "quote",
        fields: [
          ...(wholesale
            ? [choose("pricingTier", ["retail", "wholesale"])]
            : []),
          ...(foreign
            ? [rateField("rateId", false, item.currency, checkoutCurrency)]
            : []),
        ],
        onSave: add,
      });
    else void add({});
  }
  function saleInput() {
    const items = cart.map((item) => ({
      kind: item.kind,
      id: item.id,
      quantity: Number(item.quantity),
      rateId: item.rateId,
      pricingTier: item.pricingTier,
      price: parseMoney(item.price, checkoutCurrency),
      warrantyType: item.warrantyType || "shop",
      warrantyDays: Number(item.warrantyDays),
    }));
    const payments = tenders
      .filter((p) => p.amount !== "0" && p.amount !== "")
      .map((p) => ({
        amount: parseMoney(p.amount, p.currency || checkoutCurrency),
        currency: p.currency || checkoutCurrency,
        received: p.received
          ? parseMoney(p.received, p.currency || checkoutCurrency)
          : undefined,
        rateId: p.rateId ? Number(p.rateId) : undefined,
        method: p.method,
      }));
    return {
      request: saleRequest.current,
      currency: checkoutCurrency,
      ...(customer ? { contactId: Number(customer) } : {}),
      items,
      ...(tradeIn ? { tradeIn } : {}),
      discount: parseMoney(discount, checkoutCurrency),
      payments,
    };
  }
  function finishSale() {
    setCart([]);
    setTradeIn(null);
    setDiscount("0");
    setTenders([{ amount: "0", method: "Cash" }]);
    saleRequest.current = crypto.randomUUID();
    setPage("sales");
  }
  async function checkout() {
    await run(async () => {
      const result = await call("sale", saleInput());
      finishSale();
      return result;
    });
  }
  function exchange() {
    edit({
      title: "exchange",
      op: "exchange",
      fields: [
        field("id", "number"),
        selectCurrency(),
        field("refund", "money"),
        field("reason"),
        choose("method", methods),
      ],
      onSave: async (input) => {
        const result = await call("exchange", {
          request: saleRequest.current,
          return: input,
          sale: saleInput(),
        });
        finishSale();
        return result;
      },
    });
  }
  function preferences() {
    const s = data.settings;
    transactionEditor(
      "settings",
      "settings",
      [
        choose("language", ["my-MM", "th-TH", "en-US"]),
        selectCurrency(),
        field("region"),
        field("timezone"),
        choose("digits", ["latn", "mymr"]),
        choose("dateFormat", ["short", "medium", "long"]),
        choose("timeFormat", ["12", "24"]),
        field("firstDay", "number"),
        field("store"),
        field("phone", "text", true),
        field("address", "textarea", true),
        field("footer", "textarea", true),
        { ...choose("receipt", ["A4", "80mm", "58mm"]), label: "receiptSize" },
        field("printer", "text", true),
      ],
      {
        language: language,
        currency: s.currency || "MMK",
        region: s.region || "MM",
        timezone: s.timezone || "Asia/Yangon",
        dateFormat: s.dateFormat || "medium",
        timeFormat: s.timeFormat || "24",
        firstDay: s.firstDay || 1,
        digits: s.digits || "latn",
        store: s.store || "Phone Second Shop POS",
        phone: s.phone || "",
        address: s.address || "",
        footer: s.footer || "",
        receipt: s.receipt || "80mm",
        printer: s.printer || "",
      },
    );
  }
  const languageSelector = (
    <select
      aria-label={t("language")}
      value={language}
      onChange={(e) => setLanguage(e.target.value as Language)}
    >
      <option value="my-MM">မြန်မာ</option>
      <option value="th-TH">ไทย</option>
      <option value="en-US">English</option>
    </select>
  );
  if (!user)
    return (
      <main className="auth">
        <div className="auth-card">
          <div className="logo">
            P<span>2</span>
          </div>
          <h1>{t("app")}</h1>
          <p>{t("offline")}</p>
          {status?.ownerOnly && <p>{t("freeOwner")}</p>}
          {recovered && <p role="status">{t("recoverySuccess")}</p>}
          {languageSelector}
          <h2>
            {t(
              recoveryMode
                ? "recoverAccount"
                : status?.initialized
                  ? "login"
                  : "setup",
            )}
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formElement = e.currentTarget;
              const form = new FormData(formElement);
              void run(async () => {
                if (recoveryMode) {
                  await call("recoveryReset", {
                    username: form.get("username"),
                    key: form.get("recoveryKey"),
                    password: form.get("password"),
                  });
                  formElement.reset();
                  setRecoveryMode(false);
                  setRecovered(true);
                  return true;
                }
                const u = await call(status?.initialized ? "login" : "setup", {
                  username: form.get("username"),
                  password: form.get("password"),
                });
                setUser(u);
                setStatus({ ...status, initialized: true });
                return u;
              }, false);
            }}
          >
            <label>
              {t("username")}
              <input
                name="username"
                required
                autoComplete="username"
                minLength={3}
              />
            </label>
            <label>
              {t(recoveryMode ? "newPassword" : "password")}
              <input
                name="password"
                required
                autoComplete={
                  status?.initialized && !recoveryMode
                    ? "current-password"
                    : "new-password"
                }
                type="password"
                minLength={status?.initialized && !recoveryMode ? 1 : 10}
                maxLength={128}
              />
            </label>
            {recoveryMode && (
              <label>
                {t("recoveryKey")}
                <input
                  name="recoveryKey"
                  required
                  type="password"
                  autoComplete="off"
                  maxLength={100}
                />
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {t(error)}
              </p>
            )}
            <button disabled={busy || !status}>
              {busy
                ? t("busy")
                : t(
                    recoveryMode
                      ? "recoverAccount"
                      : status?.initialized
                        ? "login"
                        : "setup",
                  )}
            </button>
          </form>
          {status?.initialized && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                setRecoveryMode(!recoveryMode);
                setError("");
                setRecovered(false);
              }}
            >
              {t(recoveryMode ? "login" : "forgotPassword")}
            </button>
          )}
        </div>
      </main>
    );
  if (!data)
    return (
      <main className="auth">
        <p role="alert">{error || t("busy")}</p>
        {btn("refresh", () => void run(load, false))}
        {btn(
          "logout",
          () =>
            void run(async () => {
              await call("logout");
              setUser(null);
              return true;
            }, false),
        )}
      </main>
    );
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <div className="logo small">
            P<span>2</span>
          </div>
          <div>
            <strong>Phone Second Shop</strong>
            <small>
              {status?.ownerOnly ? t("freeOwner") : "POINT OF SALE"}
            </small>
          </div>
        </div>
        <nav>
          {nav
            .filter(
              (key) =>
                !(
                  key === "users" &&
                  (status?.ownerOnly || user.role !== "Owner")
                ),
            )
            .map((key, index) => (
              <button
                key={key}
                className={page === key ? "active" : ""}
                onClick={() => {
                  setPage(key);
                  setError("");
                  setMessage("");
                }}
              >
                <span className="nav-icon" aria-hidden="true">
                  {
                    [
                      "◈",
                      "▦",
                      "▤",
                      "▧",
                      "↓",
                      "≡",
                      "♙",
                      "↔",
                      "⚒",
                      "◇",
                      "▣",
                      "▥",
                      "♧",
                      "⚙",
                      "ⓘ",
                      "!",
                    ][index]
                  }
                </span>
                {t(key)}
              </button>
            ))}
        </nav>
        <div className="sidebar-footer">
          <span className="online-dot" />
          {t("offline")}
        </div>
      </aside>
      <div className="workspace">
        <header>
          <div>
            <small>{t("app")}</small>
            <h1>{t(page)}</h1>
          </div>
          <div className="header-actions">
            {languageSelector}
            <span className="user-badge">
              {user.username}
              <small>{t(user.role)}</small>
            </span>
            {btn(
              "logout",
              () =>
                void run(async () => {
                  await call("logout");
                  setUser(null);
                  setData(null);
                  setCart([]);
                  return true;
                }, false),
            )}
          </div>
        </header>
        <main className="content">
          {error && (
            <div className="error" role="alert">
              {t(error)}
            </div>
          )}
          {message && (
            <div className="success" role="status">
              {t(message)}
            </div>
          )}
          <div className="toolbar">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(search);
                setPagination(0);
              }}
            >
              <input
                aria-label={t("search")}
                placeholder={t("search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className="secondary">⌕</button>
            </form>
            <label>
              {t("from")}
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPagination(0);
                }}
              />
            </label>
            <label>
              {t("to")}
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPagination(0);
                }}
              />
            </label>
            {btn("refresh", () => void run(load, false))}
          </div>
          {page === "dashboard" && (
            <>
              <div className="section-heading">
                <h2>{t("dashboard")}</h2>
                <span className="pill">{currency}</span>
              </div>
              <div className="stats">
                {[
                  [
                    "revenue",
                    data.reports.find((r: Row) => r.currency === currency)
                      .revenue,
                  ],
                  [
                    "gross",
                    data.reports.find((r: Row) => r.currency === currency)
                      .gross,
                  ],
                  [
                    "received",
                    data.reports.find((r: Row) => r.currency === currency)
                      .received,
                  ],
                  ["inventoryCount", data.inventory],
                ].map(([key, value], i) => (
                  <section className={"stat stat-" + i} key={key}>
                    <small>{t(key as string)}</small>
                    <strong>{i === 3 ? value : m(value as number)}</strong>
                    <span>{t(i === 3 ? "inventory" : "reports")} ↗</span>
                  </section>
                ))}
              </div>
              <div className="two-columns">
                <section className="panel">
                  <h2>{t("sales")}</h2>
                  <Table
                    rows={data.sales.slice(0, 6)}
                    columns={["invoice", "total", "status"]}
                  />
                </section>
                <section className="panel">
                  <h2>{t("lowStock")}</h2>
                  <Table
                    rows={data.lowStock}
                    columns={["name", "quantity", "reorder"]}
                  />
                </section>
              </div>
              <section className="panel">
                <h2>{t("repairs")}</h2>
                <Table
                  rows={data.repairs.slice(0, 6)}
                  columns={["id", "device", "status", "estimate"]}
                />
              </section>
            </>
          )}
          {page === "inventory" && (
            <section className="panel">
              <div className="section-heading">
                <h2>{t("inventory")}</h2>
                {canStock && btn("purchasing", purchase)}
              </div>
              <Table
                rows={data.phones}
                columns={[
                  "id",
                  "brand",
                  "model",
                  "imei1",
                  "alternate",
                  "condition",
                  "grade",
                  "price",
                  "status",
                ]}
                actions={(r) => (
                  <>
                    {btn(
                      "label",
                      () =>
                        void run(
                          () => call("label", { kind: "phone", id: r.id }),
                          false,
                        ),
                    )}
                    {canStock &&
                      btn("photo", () => {
                        if (window.confirm(t("photoConsent")))
                          void run(() =>
                            call("photo", {
                              kind: "phone",
                              id: r.id,
                              consent: true,
                            }),
                          );
                      })}
                    {canStock &&
                      ["available", "inspection"].includes(r.status) &&
                      btn("inspectionUpdate", () =>
                        edit({
                          title: "inspectionUpdate",
                          op: "inspectionUpdate",
                          fields: [
                            ...[
                              "storage",
                              "ram",
                              "color",
                              "network",
                              "sim",
                              "serial",
                              "included",
                            ].map((k) => field(k, "text", true)),
                            field("batteryHealth", "number", true),
                            ...[
                              "screen",
                              "camera",
                              "faceId",
                              "fingerprint",
                              "sensors",
                            ].map((k) =>
                              choose(k, ["unknown", "working", "faulty"]),
                            ),
                            field("details", "textarea", true),
                            field("reason"),
                          ],
                          values: {
                            ...JSON.parse(r.inspection),
                            id: r.id,
                            details: r.details,
                          },
                          transform: ({
                            id,
                            reason,
                            details,
                            ...inspection
                          }) => ({ id, reason, details, inspection }),
                        }),
                      )}
                    {canStock &&
                      r.status === "inspection" &&
                      btn("inspect", () =>
                        transactionEditor(
                          "inspect",
                          "inspect",
                          [field("reason")],
                          { id: r.id },
                          true,
                        ),
                      )}
                  </>
                )}
              />
            </section>
          )}
          {page === "contacts" && (
            <section className="panel">
              <div className="section-heading">
                <h2>{t("contacts")}</h2>
                {btn("add", contact)}
              </div>
              <Table
                rows={data.contacts}
                columns={["id", "name", "kind", "phone", "address"]}
                actions={(row) =>
                  btn(
                    "history",
                    () =>
                      void run(async () => {
                        setContactHistory(
                          await call("contactHistory", { id: row.id }),
                        );
                        return null;
                      }, false),
                  )
                }
              />
              {manager &&
                btn(
                  "export",
                  () =>
                    void run(
                      () => call("export", { table: "contacts" }),
                      false,
                    ),
                )}
            </section>
          )}
          {page === "contacts" && contactHistory && (
            <section className="panel">
              <div className="section-heading">
                <h2>
                  {contactHistory.contact.name} · {t("history")}
                </h2>
                {btn("close", () => setContactHistory(null))}
              </div>
              <h3>{t("sales")}</h3>
              <Table
                rows={contactHistory.sales}
                columns={["invoice", "total", "balance", "status", "created"]}
              />
              <h3>{t("purchasing")}</h3>
              <Table
                rows={contactHistory.purchases}
                columns={["id", "cost", "balance", "status", "created"]}
              />
              <h3>{t("repairs")}</h3>
              <Table
                rows={contactHistory.repairs}
                columns={["id", "device", "status", "final"]}
              />
              <h3>{t("payments")}</h3>
              <Table
                rows={contactHistory.payments}
                columns={["id", "amount", "method", "created"]}
              />
            </section>
          )}
          {page === "accessories" && (
            <section className="panel">
              <div className="section-heading">
                <h2>{t("accessories")}</h2>
                {canStock && btn("add", accessory)}
              </div>
              <Table
                rows={data.accessories}
                columns={[
                  "id",
                  "sku",
                  "name",
                  "category",
                  "quantity",
                  "price",
                  "reorder",
                ]}
                actions={(r) =>
                  canStock && (
                    <>
                      {btn(
                        "label",
                        () =>
                          void run(
                            () =>
                              call("label", { kind: "accessory", id: r.id }),
                            false,
                          ),
                      )}
                      {btn("adjust", () =>
                        transactionEditor(
                          "adjust",
                          "adjust",
                          [field("delta", "number"), field("reason")],
                          { id: r.id },
                        ),
                      )}
                      {btn("replenish", () =>
                        transactionEditor(
                          "replenish",
                          "replenish",
                          [
                            field("contactId", "number"),
                            field("quantity", "number"),
                            ...moneyFields("unitCost"),
                            choose("method", methods),
                          ],
                          { id: r.id, currency: r.currency },
                        ),
                      )}
                    </>
                  )
                }
              />
            </section>
          )}
          {page === "purchasing" && (
            <section className="panel">
              <div className="section-heading">
                <h2>{t("purchasing")}</h2>
                {canStock && btn("add", purchase)}
              </div>
              <Table
                rows={data.purchases.map((p: Row) => ({
                  ...p,
                  paid: p.total_paid,
                  balance:
                    p.status === "posted" ? p.capitalized - p.total_paid : 0,
                }))}
                columns={[
                  "id",
                  "contact_id",
                  "cost",
                  "capitalized",
                  "paid",
                  "balance",
                  "status",
                  "created",
                ]}
                actions={(r) => (
                  <>
                    {btn(
                      "receipt",
                      () =>
                        void run(
                          () =>
                            call("receipt", {
                              id: r.id,
                              kind: "purchase",
                              language,
                              preview: true,
                            }),
                          false,
                        ),
                    )}
                    {manager &&
                      r.status === "posted" &&
                      btn(
                        "reverse",
                        () =>
                          transactionEditor(
                            "reverse",
                            "purchaseReverse",
                            [
                              ...moneyFields("refund"),
                              field("reason"),
                              choose("method", methods),
                            ],
                            {
                              id: r.id,
                              currency: r.currency,
                              refund: String(
                                r.total_paid / (r.currency === "MMK" ? 1 : 100),
                              ),
                            },
                            true,
                          ),
                        true,
                      )}
                  </>
                )}
              />
            </section>
          )}
          {page === "pos" && (
            <>
              {data.heldCarts.length > 0 && (
                <section className="panel">
                  <h2>{t("hold")}</h2>
                  {data.heldCarts.map((held: Row) => (
                    <button
                      key={held.id}
                      className="secondary"
                      onClick={() => {
                        if (cart.length && !window.confirm(t("confirm")))
                          return;
                        void run(async () => {
                          const result = await call("resume", { id: held.id });
                          setCart(result.cart);
                          setCheckoutCurrency(result.checkoutCurrency);
                          setCustomer(result.customer);
                          setDiscount(result.discount);
                          setTenders(result.tenders);
                          setTradeIn(result.tradeIn);
                          saleRequest.current = crypto.randomUUID();
                          return true;
                        });
                      }}
                    >
                      {held.label} ↗
                    </button>
                  ))}
                </section>
              )}
              <p className="info">{t("paymentNote")}</p>
              <div className="pos-grid">
                <section className="panel">
                  <div className="section-heading">
                    <h2>{t("inventory")}</h2>
                    <select
                      aria-label={t("currency")}
                      value={checkoutCurrency}
                      onChange={(e) => {
                        if (
                          cart.length &&
                          !window.confirm(t("currencyCartReset"))
                        )
                          return;
                        setCheckoutCurrency(e.target.value as Currency);
                        setCart([]);
                        setTradeIn(null);
                        setTenders([{ amount: "0", method: "Cash" }]);
                        setDiscount("0");
                      }}
                    >
                      {currencies.map((c) => (
                        <option key={c} value={c}>
                          {t(c)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="product-grid">
                    {[
                      ...data.phones
                        .filter((p: Row) => p.status === "available")
                        .map((p: Row) => ({
                          ...p,
                          kind: "phone",
                          name: `${p.brand} ${p.model}`,
                        })),
                      ...data.accessories
                        .filter((a: Row) => a.quantity > 0)
                        .map((a: Row) => ({ ...a, kind: "accessory" })),
                    ].map((p) => (
                      <button
                        className="product"
                        key={p.kind + p.id}
                        onClick={() => addCart(p, p.kind)}
                      >
                        {data.photos.find(
                          (photo: Row) =>
                            photo.kind === "phone" && photo.record_id === p.id,
                        ) && p.kind === "phone" ? (
                          <img
                            className="product-photo"
                            alt={p.name}
                            src={
                              data.photos.find(
                                (photo: Row) =>
                                  photo.kind === "phone" &&
                                  photo.record_id === p.id,
                              ).content
                            }
                          />
                        ) : (
                          <span className="device-icon">
                            {p.kind === "phone" ? "▯" : "▧"}
                          </span>
                        )}
                        <strong>{p.name}</strong>
                        <small>{p.imei1 || p.sku || p.alternate}</small>
                        <b>{m(p.price, p.currency)}</b>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="panel cart">
                  <h2>
                    {t("cart")} <span className="pill">{cart.length}</span>
                  </h2>
                  <div className="export-actions">
                    {manager &&
                      btn("tradeIn", () =>
                        edit({
                          title: "tradeIn",
                          op: "sale",
                          fields: [
                            selectCurrency(),
                            rateField(),
                            field("brand"),
                            field("model"),
                            field("imei1", "text", true),
                            field("imei2", "text", true),
                            field("alternate", "text", true),
                            field("alternateApproved", "checkbox"),
                            choose("condition", ["used", "new", "refurbished"]),
                            choose("grade", ["A", "B", "C"]),
                            field("details", "textarea", true),
                            ...moneyFields("cost", "price", "minimum"),
                          ],
                          values: { currency: checkoutCurrency },
                          onSave: async (input) => {
                            setTradeIn(input);
                            return true;
                          },
                        }),
                      )}
                    {cart.length > 0 &&
                      btn("hold", () => {
                        const label = window.prompt(t("name"));
                        if (label)
                          void run(async () => {
                            const result = await call("hold", {
                              label,
                              content: JSON.stringify({
                                cart,
                                checkoutCurrency,
                                customer,
                                discount,
                                tenders,
                                tradeIn,
                              }),
                            });
                            setCart([]);
                            setTradeIn(null);
                            return result;
                          });
                      })}
                  </div>
                  {tradeIn && (
                    <p className="info">
                      {t("tradeIn")}: {tradeIn.brand} {tradeIn.model} ·{" "}
                      {m(tradeIn.cost, tradeIn.currency || checkoutCurrency)}{" "}
                      {btn("remove", () => setTradeIn(null))}
                    </p>
                  )}
                  {cart.length === 0 && (
                    <div className="empty">{t("noData")}</div>
                  )}
                  {cart.map((item, index) => (
                    <div className="cart-line" key={item.kind + item.id}>
                      <strong>
                        {item.name} <small>{item.currency}</small>
                      </strong>
                      <div className="form-grid">
                        <label>
                          {t("quantity")}
                          <input
                            type="number"
                            min={1}
                            max={item.kind === "phone" ? 1 : 10000}
                            value={item.quantity}
                            onChange={(e) =>
                              setCart(
                                cart.map((c, i) =>
                                  i === index
                                    ? { ...c, quantity: e.target.value }
                                    : c,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          {t("price")}
                          <input
                            value={item.price}
                            onChange={(e) =>
                              setCart(
                                cart.map((c, i) =>
                                  i === index
                                    ? { ...c, price: e.target.value }
                                    : c,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          {t("warrantyType")}
                          <select
                            value={item.warrantyType || "shop"}
                            onChange={(e) =>
                              setCart(
                                cart.map((c, i) =>
                                  i === index
                                    ? { ...c, warrantyType: e.target.value }
                                    : c,
                                ),
                              )
                            }
                          >
                            {["none", "shop", "manufacturer"].map((value) => (
                              <option key={value} value={value}>
                                {t(value)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          {t("warrantyDays")}
                          <input
                            type="number"
                            min={0}
                            max={3650}
                            value={item.warrantyDays}
                            onChange={(e) =>
                              setCart(
                                cart.map((c, i) =>
                                  i === index
                                    ? { ...c, warrantyDays: e.target.value }
                                    : c,
                                ),
                              )
                            }
                          />
                        </label>
                        {btn("remove", () =>
                          setCart(cart.filter((_, i) => i !== index)),
                        )}
                      </div>
                    </div>
                  ))}
                  <label>
                    {t("customer")}
                    <select
                      value={customer}
                      onChange={(e) => setCustomer(e.target.value)}
                    >
                      <option value="">—</option>
                      {data.contacts
                        .filter((c: Row) => c.kind === "customer")
                        .map((c: Row) => (
                          <option key={c.id} value={c.id}>
                            {c.id} · {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    {t("discount")}
                    <input
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                    />
                  </label>
                  {tenders.map((p, index) => (
                    <div className="tender" key={index}>
                      <label>
                        {t("tenderCurrency")}
                        <select
                          aria-label={t("tenderCurrency")}
                          value={p.currency || checkoutCurrency}
                          onChange={(e) =>
                            setTenders(
                              tenders.map((v, i) =>
                                i === index
                                  ? {
                                      ...v,
                                      currency: e.target.value,
                                      rateId: undefined,
                                    }
                                  : v,
                              ),
                            )
                          }
                        >
                          {currencies.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                      {(p.currency || checkoutCurrency) !==
                        checkoutCurrency && (
                        <label>
                          {t("rateId")}
                          <select
                            aria-label={t("rateId")}
                            value={p.rateId || ""}
                            onChange={(e) =>
                              setTenders(
                                tenders.map((v, i) =>
                                  i === index
                                    ? { ...v, rateId: e.target.value }
                                    : v,
                                ),
                              )
                            }
                          >
                            <option value="">—</option>
                            {data.rates
                              .filter(
                                (r: Row) =>
                                  r.source_currency === p.currency &&
                                  r.target_currency === checkoutCurrency,
                              )
                              .map((r: Row) => (
                                <option key={r.id} value={r.id}>
                                  #{r.id} {r.numerator}/{r.denominator} ·{" "}
                                  {r.source}
                                </option>
                              ))}
                          </select>
                        </label>
                      )}

                      <label>
                        {t("method")}
                        <select
                          value={p.method}
                          onChange={(e) =>
                            setTenders(
                              tenders.map((v, i) =>
                                i === index
                                  ? { ...v, method: e.target.value }
                                  : v,
                              ),
                            )
                          }
                        >
                          {methods.map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t("amount")}
                        <input
                          value={p.amount}
                          onChange={(e) =>
                            setTenders(
                              tenders.map((v, i) =>
                                i === index
                                  ? { ...v, amount: e.target.value }
                                  : v,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        {t("cashReceived")}
                        <input
                          aria-label={t("cashReceived")}
                          value={p.received || ""}
                          onChange={(e) =>
                            setTenders(
                              tenders.map((v, i) =>
                                i === index
                                  ? { ...v, received: e.target.value }
                                  : v,
                              ),
                            )
                          }
                        />
                      </label>
                      <small>
                        {t("equivalent")}:{" "}
                        {(() => {
                          try {
                            return m(
                              equivalent(
                                p.amount,
                                p.currency || checkoutCurrency,
                                checkoutCurrency,
                                p.rateId,
                              ),
                              checkoutCurrency,
                            );
                          } catch {
                            return "—";
                          }
                        })()}
                      </small>
                    </div>
                  ))}
                  {btn("add", () =>
                    setTenders([...tenders, { amount: "0", method: "Cash" }]),
                  )}
                  <div className="cart-total">
                    <span>{t("total")}</span>
                    <strong>
                      {(() => {
                        try {
                          return m(
                            cart.reduce(
                              (n, c) =>
                                n +
                                parseMoney(c.price, checkoutCurrency) *
                                  Number(c.quantity),
                              0,
                            ) - parseMoney(discount, checkoutCurrency),
                            checkoutCurrency,
                          );
                        } catch {
                          return "—";
                        }
                      })()}
                    </strong>
                  </div>
                  {manager && cart.length > 0 && btn("exchange", exchange)}
                  <button
                    className="full"
                    disabled={busy || !cart.length || !canTill}
                    onClick={() => void checkout()}
                  >
                    {busy ? t("busy") : t("checkout")} →
                  </button>
                </section>
              </div>
            </>
          )}
          {(page === "sales" || page === "warranty") && (
            <section className="panel">
              <h2>{t("sales")}</h2>
              <p className="info">{t("returnPolicy")}</p>
              {manager &&
                btn("partialReturn", () =>
                  edit({
                    title: "partialReturn",
                    op: "return",
                    fields: [
                      field("id", "number"),
                      field("saleItem", "number"),
                      field("quantity", "number"),
                      field("restock", "checkbox"),
                      selectCurrency(),
                      ...moneyFields("refund"),
                      field("reason"),
                      choose("method", methods),
                    ],
                    danger: true,
                    transform: (input) => ({
                      ...input,
                      items: [
                        {
                          saleItem: input.saleItem,
                          quantity: input.quantity,
                          restock: input.restock,
                        },
                      ],
                    }),
                  }),
                )}
              <Table
                rows={data.sales.map((s: Row) => ({
                  ...s,
                  balance:
                    s.status === "returned"
                      ? 0
                      : s.total - s.paid - (s.returned_total ?? 0),
                }))}
                columns={[
                  "id",
                  "invoice",
                  "total",
                  "paid",
                  "balance",
                  "status",
                  "created",
                ]}
                actions={(r) => (
                  <>
                    {btn(
                      "receipt",
                      () =>
                        void run(
                          () =>
                            call("receipt", {
                              id: r.id,
                              preview: true,
                              language,
                            }),
                          false,
                        ),
                    )}
                    {btn(
                      "print",
                      () =>
                        void run(
                          () =>
                            call("receipt", {
                              id: r.id,
                              preview: false,
                              language,
                            }),
                          false,
                        ),
                    )}
                    {manager &&
                      ["posted", "partially_returned"].includes(r.status) &&
                      btn(
                        "return",
                        () =>
                          transactionEditor(
                            "return",
                            "return",
                            [
                              ...moneyFields("refund"),
                              field("reason"),
                              choose("method", methods),
                            ],
                            {
                              id: r.id,
                              currency: r.currency,
                              refund: String(
                                (r.paid -
                                  (data.tradeIns.find(
                                    (trade: Row) => trade.sale_id === r.id,
                                  )?.credit ?? 0)) /
                                  (r.currency === "MMK" ? 1 : 100),
                              ),
                            },
                            true,
                          ),
                        true,
                      )}
                  </>
                )}
              />
            </section>
          )}
          {page === "warranty" && (
            <>
              <section className="panel">
                <div className="section-heading">
                  <h2>{t("warranty")}</h2>
                  {canTill &&
                    btn("claim", () =>
                      transactionEditor("claim", "warranty", [
                        field("saleItem", "number"),
                        field("reason"),
                      ]),
                    )}
                </div>
                <Table
                  rows={data.warranties.map((r: Row) => ({
                    ...r,
                    warrantyDays: r.warranty_days,
                  }))}
                  columns={[
                    "id",
                    "invoice",
                    "name",
                    "identifier",
                    "warrantyDays",
                    "created",
                  ]}
                />
              </section>
              <section className="panel">
                <div className="section-heading">
                  <h2>{t("claim")}</h2>
                  {canTill &&
                    btn("repairWarranty", () =>
                      transactionEditor("repairWarranty", "warranty", [
                        field("repairId", "number"),
                        field("reason"),
                      ]),
                    )}
                  {manager &&
                    btn("resolve", () =>
                      transactionEditor("resolve", "warrantyUpdate", [
                        field("id", "number"),
                        choose("status", ["approved", "rejected", "resolved"]),
                        field("resolution", "textarea"),
                      ]),
                    )}
                </div>
                <Table
                  rows={data.claims}
                  columns={["id", "sale_item", "reason", "status", "created"]}
                />
              </section>
            </>
          )}
          {page === "sales" && (
            <section className="panel">
              <h2>{t("saleItems")}</h2>
              <Table
                rows={data.saleItems}
                columns={["id", "sale_id", "name", "quantity", "price"]}
              />
            </section>
          )}
          {page === "payments" && (
            <section className="panel">
              <div className="section-heading">
                <h2>{t("payments")}</h2>
                {canTill && btn("recordPayment", payment)}
              </div>
              <p className="info">{t("paymentNote")}</p>
              <Table
                rows={data.payments}
                columns={[
                  "id",
                  "target",
                  "target_id",
                  "original_amount",
                  "original_currency",
                  "amount",
                  "currency",
                  "method",
                  "direction",
                  "created",
                ]}
              />
            </section>
          )}
          {page === "repairs" && (
            <section className="panel">
              <div className="section-heading">
                <h2>{t("repairs")}</h2>
                {btn("add", repair)}
              </div>
              <Table
                rows={data.repairs}
                columns={[
                  "id",
                  "ticket",
                  "device",
                  "identifier",
                  "status",
                  "estimate",
                  "final",
                  "paid",
                ]}
                actions={(r) =>
                  (manager || user.role === "Technician") && (
                    <>
                      {btn(
                        "receipt",
                        () =>
                          void run(
                            () =>
                              call("receipt", {
                                id: r.id,
                                kind: "repair",
                                language,
                                preview: true,
                              }),
                            false,
                          ),
                      )}
                      {manager &&
                        ["Delivered", "Cancelled"].includes(r.status) &&
                        btn("reopen", () =>
                          transactionEditor(
                            "reopen",
                            "repairReopen",
                            [field("reason")],
                            { id: r.id },
                            true,
                          ),
                        )}
                      {manager &&
                        !["Delivered", "Cancelled"].includes(r.status) &&
                        btn(
                          "cancelRepair",
                          () =>
                            transactionEditor(
                              "cancelRepair",
                              "repairCancel",
                              [field("reason"), choose("method", methods)],
                              { id: r.id },
                              true,
                            ),
                          true,
                        )}
                      {btn("photo", () => {
                        if (window.confirm(t("photoConsent")))
                          void run(() =>
                            call("photo", {
                              kind: "repair",
                              id: r.id,
                              consent: true,
                            }),
                          );
                      })}
                      {btn("repairPart", () =>
                        transactionEditor(
                          "repairPart",
                          "repairPart",
                          [
                            field("accessoryId", "number"),
                            field("quantity", "number"),
                            rateField(),
                          ],
                          { id: r.id },
                        ),
                      )}
                      {btn("updateRepair", () =>
                        transactionEditor(
                          "updateRepair",
                          "repairUpdate",
                          [
                            choose("status", stages),
                            field("diagnosis", "textarea", true),
                            field("approved", "checkbox"),
                            ...moneyFields("final"),
                            field("warrantyDays", "number"),
                            field("reason", "textarea", true),
                          ],
                          {
                            id: r.id,
                            currency: r.currency,
                            status: r.status,
                            diagnosis: r.diagnosis,
                            approved: !!r.approved,
                            final: String(
                              r.final / (r.currency === "MMK" ? 1 : 100),
                            ),
                            warrantyDays: r.warranty_days,
                          },
                        ),
                      )}
                    </>
                  )
                }
              />
            </section>
          )}
          {page === "accounting" && (
            <>
              <section className="panel">
                <div className="section-heading">
                  <h2>{t("cashMovement")}</h2>
                  {manager &&
                    btn("add", () =>
                      transactionEditor("cashMovement", "cashMovement", [
                        selectCurrency(),
                        choose("direction", ["in", "out"]),
                        ...moneyFields("amount"),
                        field("reason"),
                      ]),
                    )}
                </div>
                <Table
                  rows={data.cashMovements}
                  columns={[
                    "id",
                    "direction",
                    "amount",
                    "currency",
                    "reason",
                    "created",
                  ]}
                />
              </section>
              <section className="panel">
                <div className="section-heading">
                  <h2>{t("expenses")}</h2>
                  {manager &&
                    btn("expense", () =>
                      transactionEditor("expense", "expense", [
                        field("category"),
                        field("description"),
                        selectCurrency(),
                        ...moneyFields("amount"),
                        choose("method", methods),
                      ]),
                    )}
                </div>
                <Table
                  rows={data.expenses}
                  columns={[
                    "id",
                    "category",
                    "description",
                    "amount",
                    "method",
                    "created",
                  ]}
                />
              </section>
              <section className="panel">
                <div className="section-heading">
                  <h2>{t("cashSession")}</h2>
                  {canTill &&
                    btn("open", () =>
                      transactionEditor(
                        "open",
                        "cashSession",
                        [selectCurrency(), ...moneyFields("opening")],
                        { action: "open" },
                      ),
                    )}
                </div>
                <Table
                  rows={data.cashSessions}
                  columns={[
                    "id",
                    "currency",
                    "opening",
                    "counted",
                    "opened",
                    "closed",
                    "expected",
                  ]}
                  actions={(r) =>
                    !r.closed &&
                    canTill &&
                    btn("closeDrawer", () =>
                      transactionEditor(
                        "closeDrawer",
                        "cashSession",
                        [...moneyFields("counted")],
                        { id: r.id, currency: r.currency, action: "close" },
                        true,
                      ),
                    )
                  }
                />
              </section>
            </>
          )}
          {page === "reports" && (
            <>
              <p className="info">{t("reportNote")}</p>
              <div className="export-actions">
                {[1, 7, 30].map((days) => (
                  <button
                    key={days}
                    className="secondary"
                    onClick={() => {
                      const end = new Date();
                      const start = new Date(end);
                      start.setUTCDate(start.getUTCDate() - days + 1);
                      setFrom(start.toISOString().slice(0, 10));
                      setTo(end.toISOString().slice(0, 10));
                      setPagination(0);
                    }}
                  >
                    {t("lastDays")} {days} · UTC
                  </button>
                ))}
              </div>
              {manager &&
                btn("reportConvert", () =>
                  edit({
                    title: "reportConvert",
                    op: "reportConvert",
                    fields: [
                      selectCurrency(),
                      rateField("rateMMK"),
                      rateField("rateTHB"),
                      rateField("rateUSD"),
                    ],
                    onSave: async (input) => {
                      setConvertedReport(
                        await call("reportConvert", {
                          currency: input.currency,
                          rates: ["rateMMK", "rateTHB", "rateUSD"]
                            .map((k) => Number(input[k]))
                            .filter(Boolean),
                          ...(from ? { from } : {}),
                          ...(to ? { to } : {}),
                        }),
                      );
                      return true;
                    },
                  }),
                )}
              {convertedReport && (
                <section className="panel">
                  <h2>
                    {t("reportConvert")} · {convertedReport.currency} · #
                    {convertedReport.id}
                  </h2>
                  <Table
                    rows={[
                      {
                        ...Object.fromEntries(
                          Object.entries(convertedReport.totals).map(
                            ([k, v]) => [k, Number(v)],
                          ),
                        ),
                        currency: convertedReport.currency,
                      },
                    ]}
                    columns={[
                      "currency",
                      "revenue",
                      "cogs",
                      "gross",
                      "repairRevenue",
                      "repairCost",
                      "expenses",
                      "net",
                      "received",
                      "receivable",
                      "payable",
                    ]}
                  />
                </section>
              )}

              <section className="panel">
                <Table
                  rows={data.reports.map((r: Row) => ({
                    ...r,
                    id: r.currency,
                  }))}
                  columns={[
                    "currency",
                    "revenue",
                    "cogs",
                    "gross",
                    "expenses",
                    "repairRevenue",
                    "repairCost",
                    "net",
                    "received",
                    "actualCollections",
                    "cashNet",
                    "receivable",
                    "payable",
                  ]}
                />
                {manager && (
                  <div className="export-actions">
                    {(
                      [
                        "sales",
                        "purchases",
                        "expenses",
                        "phones",
                        "repairs",
                        "audit",
                      ] as const
                    ).map((table) => (
                      <button
                        key={table}
                        className="secondary"
                        onClick={() =>
                          void run(() => call("export", { table }), false)
                        }
                      >
                        {t("export")} ·{" "}
                        {t(table === "phones" ? "inventory" : table)}
                      </button>
                    ))}
                  </div>
                )}
              </section>
              {manager && (
                <section className="panel">
                  <h2>{t("audit")}</h2>
                  <Table
                    rows={data.audit}
                    columns={["id", "actor", "action", "entity", "created"]}
                  />
                </section>
              )}
            </>
          )}
          {page === "users" && user.role === "Owner" && (
            <section className="panel">
              <div className="section-heading">
                <h2>{t("users")}</h2>
                <div className="export-actions">
                  {btn("add", () =>
                    transactionEditor("users", "users", [
                      field("username"),
                      field("password", "password"),
                      choose("role", [...roles]),
                    ]),
                  )}
                  {btn("permission", () =>
                    transactionEditor("permission", "permission", [
                      field("userId", "number"),
                      choose("operation", [
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
                      field("allowed", "checkbox"),
                    ]),
                  )}
                </div>
              </div>
              <Table rows={data.users} columns={["id", "username", "role"]} />
            </section>
          )}
          {page === "settings" && (
            <>
              {user.role === "Owner" && (
                <section className="panel">
                  <h2>{t("ownerSecurity")}</h2>
                  {status?.ownerOnly && (
                    <p className="info">{t("freeOwner")}</p>
                  )}
                  <p>{t("recoveryWarning")}</p>
                  <form
                    autoComplete="off"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const current = new FormData(form).get("current");
                      void run(async () => {
                        const result = await call("recoveryGenerate", {
                          current,
                        });
                        form.reset();
                        setRecoveryKey(result.key);
                        return true;
                      }, false);
                    }}
                  >
                    <label>
                      {t("current")}
                      <input
                        name="current"
                        type="password"
                        required
                        maxLength={128}
                        autoComplete="current-password"
                      />
                    </label>
                    <button disabled={busy}>{t("generateRecovery")}</button>
                  </form>
                  {recoveryKey && (
                    <div className="recovery-secret" role="status">
                      <p>{t("recoveryWarning")}</p>
                      <code>{recoveryKey}</code>
                      <button
                        className="secondary"
                        onClick={() => setRecoveryKey("")}
                      >
                        {t("keySaved")}
                      </button>
                    </div>
                  )}
                </section>
              )}
              <section className="panel">
                <h2>{t("settings")}</h2>
                <p className="info">{t("fxPolicy")}</p>
                <Table
                  rows={data.paymentMethods}
                  columns={["name", "active"]}
                />
                {manager &&
                  btn("paymentMethod", () =>
                    transactionEditor(
                      "paymentMethod",
                      "paymentMethod",
                      [field("name"), field("active", "checkbox")],
                      { active: true },
                    ),
                  )}
                {btn(
                  "printers",
                  () =>
                    void run(async () => {
                      const devices = await call("printers", {});
                      window.alert(
                        devices.length
                          ? devices
                              .map((d: Row) => d.displayName + " · " + d.name)
                              .join("\n")
                          : t("PRINTER_UNAVAILABLE"),
                      );
                      return true;
                    }, false),
                )}
                <Table
                  rows={data.rates}
                  columns={[
                    "id",
                    "source_currency",
                    "target_currency",
                    "numerator",
                    "denominator",
                    "basis",
                    "source",
                    "created",
                  ]}
                />

                {manager &&
                  btn("logo", () => {
                    if (window.confirm(t("photoConsent")))
                      void run(() =>
                        call("photo", { kind: "store", id: 1, consent: true }),
                      );
                  })}
                <div className="export-actions">
                  {manager &&
                    btn("rate", () =>
                      transactionEditor("rate", "rate", [
                        choose("from", [...currencies]),
                        choose("to", [...currencies]),
                        field("numerator", "number"),
                        field("denominator", "number"),
                        field("source"),
                      ]),
                    )}
                </div>
                <dl>
                  {[
                    "language",
                    "currency",
                    "region",
                    "timezone",
                    "digits",
                    "store",
                    "receipt",
                    "printer",
                  ].map((k) => (
                    <React.Fragment key={k}>
                      <dt>{t(k === "receipt" ? "receiptSize" : k)}</dt>
                      <dd>{String(data.settings[k] || "—")}</dd>
                    </React.Fragment>
                  ))}
                </dl>
                <div className="export-actions">
                  {manager && btn("settings", preferences)}
                  {manager &&
                    btn("defaults", () => {
                      const locale = status.locale || "my-MM";
                      const mapped = locale.startsWith("th")
                        ? { language: "th-TH", region: "TH", currency: "THB" }
                        : locale.startsWith("en-US")
                          ? { language: "en-US", region: "US", currency: "USD" }
                          : {
                              language: "my-MM",
                              region: "MM",
                              currency: "MMK",
                            };
                      if (window.confirm(t("confirm")))
                        void run(() =>
                          call("settings", {
                            ...{
                              language,
                              currency,
                              region: "MM",
                              digits: "latn",
                              store: "Phone Second Shop POS",
                              phone: "",
                              address: "",
                              footer: "",
                              receipt: "80mm",
                              printer: "",
                            },
                            ...data.settings,
                            ...mapped,
                            timezone: status.timezone || "Asia/Yangon",
                          }),
                        );
                    })}
                  {manager &&
                    btn("reset", () => {
                      if (window.confirm(t("confirm")))
                        void run(() =>
                          call("settings", {
                            ...data.settings,
                            language: "my-MM",
                            currency: "MMK",
                            region: "MM",
                            timezone: "Asia/Yangon",
                            digits: "latn",
                            dateFormat: "medium",
                            timeFormat: "24",
                            firstDay: 1,
                            store:
                              data.settings.store || "Phone Second Shop POS",
                            phone: data.settings.phone || "",
                            address: data.settings.address || "",
                            footer: data.settings.footer || "",
                            receipt: "80mm",
                            printer: "",
                          }),
                        );
                    })}
                  {btn("changePassword", () =>
                    transactionEditor("changePassword", "password", [
                      field("current", "password"),
                      field("password", "password"),
                    ]),
                  )}
                </div>
              </section>
              <section className="panel">
                <h2>{t("backup")}</h2>
                <div className="export-actions">
                  {manager &&
                    btn("backup", () => void run(() => call("backup"), false))}
                  {user.role === "Owner" &&
                    btn(
                      "restore",
                      () =>
                        void run(async () => {
                          const result = await call("restore");
                          if (result) {
                            setUser(null);
                            setData(null);
                            await initialize();
                          }
                          return result;
                        }, false),
                      true,
                    )}
                </div>
              </section>
            </>
          )}
          {page === "about" && (
            <section className="panel about">
              <div className="logo">
                P<span>2</span>
              </div>
              <h2>Phone Second Shop POS</h2>
              <p>
                {t("version")}: {status.version} · {t("platform")}:{" "}
                {status.platform}
              </p>
              <p>{t("developer")}: Myominaung</p>
              <p>မြန်မာ · ไทย · English</p>
              {btn(
                "contactDeveloper",
                () => void run(() => call("support"), false),
              )}
              <hr />
              <h2>{t("support")}</h2>
              <p>KBZPay (KPay) · 09256060722</p>
              <p>Telegram · @kominit</p>
              {btn(
                "copyKpay",
                () =>
                  void run(async () => {
                    await call("copy", { text: "09256060722" });
                    setMessage("copied");
                    return null;
                  }, false),
              )}
              <p className="muted">{t("noVerification")}</p>
            </section>
          )}
          {page === "bug" && (
            <section className="panel">
              <h2>{t("bug")}</h2>
              <p className="info">{t("bugPrivacy")}</p>
              <div className="form-grid">
                {Object.keys(report)
                  .filter((key) => !["screenshot", "diagnostics"].includes(key))
                  .map((key) => (
                    <label key={key}>
                      {t(key)}
                      {key === "category" ? (
                        <select
                          value={report[key]}
                          onChange={(e) =>
                            setReport({ ...report, [key]: e.target.value })
                          }
                        >
                          {[
                            "Bug / Error",
                            "UI Problem",
                            "Feature Request",
                            "Other",
                          ].map((c) => (
                            <option key={c} value={c}>
                              {t(c)}
                            </option>
                          ))}
                        </select>
                      ) : key === "subject" ? (
                        <input
                          value={report[key]}
                          onChange={(e) =>
                            setReport({ ...report, [key]: e.target.value })
                          }
                        />
                      ) : (
                        <textarea
                          value={report[key]}
                          onChange={(e) =>
                            setReport({ ...report, [key]: e.target.value })
                          }
                        />
                      )}
                    </label>
                  ))}
              </div>
              <label>
                {t("screenshot")}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5_000_000) {
                      setError("INVALID_INPUT");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () =>
                      setReport({
                        ...report,
                        screenshot: reader.result as string,
                      });
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!report.diagnostics}
                  onChange={(e) =>
                    setReport({ ...report, diagnostics: e.target.checked })
                  }
                />
                {t("diagnostics")}
              </label>
              {report.screenshot && (
                <div>
                  <img
                    className="screenshot-preview"
                    src={report.screenshot}
                    alt={t("screenshot")}
                  />
                  {btn("remove", () => {
                    const updated = { ...report };
                    delete updated.screenshot;
                    setReport(updated);
                  })}
                </div>
              )}
              <h3>{t("preview")}</h3>
              <pre>
                {`Phone Second Shop POS ${status.version}\n${status.platform}\n\n` +
                  Object.entries(report)
                    .filter(([k]) => !["screenshot", "diagnostics"].includes(k))
                    .map(([k, v]) => `${t(k)}:\n${v}`)
                    .join("\n\n")}
              </pre>
              <div className="export-actions">
                {btn(
                  "exportReport",
                  () => void run(() => call("bugExport", report), false),
                )}
                {btn(
                  "copyReport",
                  () =>
                    void run(async () => {
                      if (!report.subject || !report.description)
                        throw new Error("INVALID_INPUT");
                      await call("copy", {
                        text:
                          `Phone Second Shop POS ${status.version}\n${status.platform}\n` +
                          Object.entries(report)
                            .filter(
                              ([k]) =>
                                !["screenshot", "diagnostics"].includes(k),
                            )
                            .map(([k, v]) => `${t(k)}: ${v}`)
                            .join("\n"),
                      });
                      setMessage("copied");
                      return null;
                    }, false),
                )}
                {btn(
                  "contactDeveloper",
                  () => void run(() => call("support"), false),
                )}
              </div>
            </section>
          )}
          {["inventory", "repairs"].includes(page) &&
            data.photos.filter(
              (photo: Row) =>
                photo.kind === (page === "inventory" ? "phone" : "repair"),
            ).length > 0 && (
              <section className="panel">
                <h2>{t("photo")}</h2>
                <div className="product-grid">
                  {data.photos
                    .filter(
                      (photo: Row) =>
                        photo.kind ===
                        (page === "inventory" ? "phone" : "repair"),
                    )
                    .map((photo: Row) => (
                      <figure key={photo.id}>
                        <img
                          className="screenshot-preview"
                          src={photo.content}
                          alt={`${t("id")} ${photo.record_id}`}
                        />
                        <figcaption>
                          {t("id")} {photo.record_id}
                        </figcaption>
                      </figure>
                    ))}
                </div>
              </section>
            )}
          <footer className="pagination">
            <button
              className="secondary"
              disabled={pagination === 0 || busy}
              onClick={() => setPagination(Math.max(0, pagination - 1))}
            >
              {t("previous")}
            </button>
            <span>
              {t("page")} {pagination + 1} · 50
            </span>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setPagination(pagination + 1)}
            >
              {t("next")}
            </button>
          </footer>
        </main>
      </div>
      {editor && (
        <Form
          config={editor}
          t={t}
          currency={currency}
          run={run}
          call={call}
          setLanguage={setLanguage}
          setEditor={setEditor}
          busy={busy}
          error={error}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
