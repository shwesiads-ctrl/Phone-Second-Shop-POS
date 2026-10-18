import { money, type Currency } from "./contracts";

export const productLabelQuery = (kind: string) =>
  kind === "phone"
    ? "SELECT COALESCE(NULLIF(imei1,''),NULLIF(alternate,''),NULLIF(imei2,'')) identifier,brand || ' ' || model name,price,currency FROM phones WHERE id=?"
    : "SELECT COALESCE(NULLIF(barcode,''),sku) identifier,name,price,currency FROM accessories WHERE id=?";

const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export function productLabelHTML(
  item: { name: string; price: number; currency: Currency },
  barcode: string,
  language = "en-US",
) {
  return `<!doctype html><html lang="${escape(language)}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src file:; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Product barcode</title><style>
  @font-face{font-family:Myanmar;src:url('../dist/assets/receipt-myanmar.woff2')}@font-face{font-family:Thai;src:url('../dist/assets/receipt-thai.woff2')}
  *{box-sizing:border-box}body{font-family:Myanmar,Thai,sans-serif;background:white;color:#111;text-align:center;max-width:70mm;margin:8mm auto;padding:0 3mm;line-height:1.6}p{overflow-wrap:anywhere;margin:4mm 0}img{display:block;width:100%;height:auto;margin:4mm auto}.price{font-weight:bold;font-size:18px}@media print{@page{size:80mm auto;margin:4mm}body{margin:0 auto}}
  </style></head><body><p class="product-name">${escape(item.name)}</p><img alt="Barcode" src="${escape(barcode)}"><p class="price">${escape(money(item.price, item.currency, language))}</p></body></html>`;
}
