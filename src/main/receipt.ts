import { money, type Currency } from "../shared/contracts";
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function receiptHTML(
  invoice: any,
  labels: Record<string, string> = {},
  controls = false,
) {
  const s = invoice.settings,
    locale = s.language || "my-MM",
    currency = invoice.currency as Currency;
  const f = (n: number) => escape(money(n, currency, locale)),
    l = (k: string) => escape(labels[k] || k);
  const row = (key: string, value: unknown, strong = false) =>
    `<div class="detail${strong ? " strong" : ""}"><span>${l(key)}</span><span>${escape(value)}</span></div>`;
  const totalRow = (key: string, value: number, strong = false) =>
    `<div class="detail${strong ? " balance" : ""}"><span>${l(key)}</span><span>${f(value)}</span></div>`;
  const balance = ["returned", "reversed", "Cancelled"].includes(invoice.status)
    ? 0
    : invoice.total - invoice.paid - (invoice.returnedTotal ?? 0);
  const logo =
    s.logo ||
    "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0f3049"/><text x="32" y="43" text-anchor="middle" fill="white" font-family="sans-serif" font-size="36" font-weight="bold">F</text></svg>',
      );
  return `<!doctype html><html lang="${escape(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src file:; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(invoice.invoice)}</title><style>
 @font-face{font-family:Myanmar;src:url('../dist/assets/receipt-myanmar.woff2')}@font-face{font-family:Thai;src:url('../dist/assets/receipt-thai.woff2')}
 *{box-sizing:border-box}html{background:#fff;color:#111827}body{margin:0;font-family:Arial,Myanmar,Thai,sans-serif;font-size:15px;line-height:1.5}.receipt{width:100%;max-width:480px;margin:0 auto;padding:16px 20px 24px;background:#fff}header{text-align:center;border-bottom:1px solid #cbd5e1;padding-bottom:16px;margin-bottom:16px}.logo{width:64px;height:64px;object-fit:contain}h1{font-size:24px;line-height:1.3;margin:8px 0 4px}h2{font-size:16px;margin:4px 0}h3{font-size:16px;margin:0 0 8px}.muted{color:#64748b;font-size:12px}.card{border:1px solid #d7e2ef;border-radius:10px;padding:12px;margin:12px 0;break-inside:avoid}.detail{display:flex;justify-content:space-between;gap:16px;margin:3px 0}.detail>span:first-child{flex:0 1 42%}.detail>span:last-child{text-align:right;flex:1;min-width:0;font-weight:600;overflow-wrap:anywhere}.strong{font-weight:bold}.balance{font-size:20px;font-weight:800;border-top:1px solid #d7e2ef;padding-top:8px;margin-top:8px}p{margin:6px 0;white-space:pre-wrap;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:10px 4px;border-bottom:1px solid #e2e8f0;text-align:left;overflow-wrap:anywhere;vertical-align:top}th:nth-child(2),td:nth-child(2){width:12%;text-align:center}th:last-child,td:last-child{width:32%;text-align:right;font-weight:600}td small{display:block;margin-top:3px;color:#64748b;font-size:11px;overflow-wrap:anywhere}.totals{margin-top:12px}footer{margin-top:16px;font-size:12px;color:#64748b}.receipt-actions{max-width:480px;margin:0 auto;padding:0 20px 20px;display:flex;gap:8px;flex-wrap:wrap}.receipt-actions button{flex:1;min-width:100px;border:1px solid #d7e2ef;border-radius:8px;padding:12px 8px;background:#fff;color:#111827;font:600 14px Arial,Myanmar,Thai,sans-serif;cursor:pointer}.receipt-actions button:first-child{background:#2563eb;color:#fff;border-color:#2563eb}.receipt-actions button:disabled{opacity:.6;cursor:wait}.receipt-actions [role=status]{width:100%;font-size:13px;overflow-wrap:anywhere}
 @media print{@page{size:${s.receipt === "A4" ? "A4" : s.receipt === "58mm" ? "58mm 250mm" : "80mm 250mm"};margin:4mm}.receipt-actions{display:none}body{font-size:${s.receipt === "58mm" ? "10px" : "12px"}}.receipt{max-width:${s.receipt === "A4" ? "190mm" : s.receipt === "58mm" ? "50mm" : "72mm"};padding:0;margin:0 auto}h1{font-size:18px}.card{padding:6px;margin:8px 0}.detail{gap:5px}.balance{font-size:16px}td,th{padding:6px 2px}.logo{width:48px;height:48px}}
 </style></head><body><main class="receipt" id="receipt"><header><img class="logo" alt="" src="${escape(logo)}"><h1>${escape(s.store || "Fixer Tools")}</h1>${s.address ? `<p class="muted">${escape(s.address)}</p>` : ""}${s.phone ? `<p class="muted">${escape(s.phone)}</p>` : ""}<h2>${escape(invoice.invoice)}</h2><div class="muted">${invoice.typeKey ? l(invoice.typeKey) + " · " : ""}${escape(new Intl.DateTimeFormat(locale, { dateStyle: s.dateFormat || "medium", timeStyle: "short", timeZone: s.timezone || "Asia/Yangon", hour12: s.timeFormat === "12" }).format(new Date(invoice.created)))}</div></header>
 <section class="card">${invoice.customer ? row("customer", invoice.customer) : ""}${invoice.customer_phone ? row("phone", invoice.customer_phone) : ""}${invoice.device ? row("device", invoice.device) : ""}${invoice.device_identifier ? row("identifier", invoice.device_identifier) : ""}${row("cashier", invoice.cashier_name)}${row("status", labels[invoice.status] || invoice.status)}</section>
 ${invoice.problem ? `<section class="card"><h3>${l("problem")}</h3><p>${escape(invoice.problem)}</p>${invoice.diagnosis ? `<h3>${l("diagnosis")}</h3><p>${escape(invoice.diagnosis)}</p>` : ""}</section>` : ""}
 <section class="card"><table><thead><tr><th>${l("item")}</th><th>${l("qty")}</th><th>${l("total")} (${escape(currency)})</th></tr></thead><tbody>${invoice.items.map((i: any) => `<tr><td>${i.nameKey ? l(i.nameKey) : escape(i.name)}${i.identifier ? `<small>${escape(i.identifier)}</small>` : ""}${i.warranty_days > 0 ? `<small>${l("warrantyType")}: ${l(i.warranty_type || "none")} · ${l("receiptWarrantyDays")}: ${escape(i.warranty_days)}</small>` : ""}</td><td>${escape(i.quantity)}</td><td>${f(i.price * i.quantity)}</td></tr>`).join("")}</tbody></table></section>
 ${invoice.parts?.length ? `<section class="card"><h3>${l("repairPart")}</h3>${invoice.parts.map((p: any) => `<p>${escape(p.name)} × ${escape(p.quantity)}</p>`).join("")}</section>` : ""}
 <section class="totals">${totalRow("discount", invoice.discount)}${totalRow("total", invoice.total)}${totalRow("returned", invoice.returnedTotal ?? 0)}${totalRow(invoice.typeKey === "repair" ? "receiptDeposit" : "paid", invoice.paid)}${totalRow("receiptBalance", balance, true)}</section>
 ${invoice.payments.length ? `<section class="card"><h3>${l("payments")}</h3>${invoice.payments.map((p: any) => `<p>${["Cash", "Bank transfer", "Other"].includes(p.method) ? l(p.method) : escape(p.method)} ${p.direction === "out" ? "-" : ""}${f(p.amount)}${p.original_currency && p.original_currency !== currency ? ` (${escape(money(p.original_amount, p.original_currency, locale))} · ${l("rateId")} #${escape(JSON.parse(p.fx || "{}").rate?.id ?? "")})` : ""}${p.direction === "in" && p.method === "Cash" ? `<br><span class="muted">${l("receiptCashReceived")}: ${escape(money(p.received_amount ?? p.original_amount ?? p.amount, p.original_currency || currency, locale))} · ${l("change")}: ${escape(money(p.change_amount ?? 0, p.original_currency || currency, locale))}</span>` : ""}</p>`).join("")}</section>` : ""}<footer>${escape(s.footer)}</footer></main>
 ${controls ? `<nav class="receipt-actions"><button data-receipt-action="print">${l("print")}</button><button data-receipt-action="jpeg">${l("saveJPEG")}</button><button data-receipt-action="close">${l("close")}</button><p role="status" aria-live="polite"></p></nav>` : ""}</body></html>`;
}
