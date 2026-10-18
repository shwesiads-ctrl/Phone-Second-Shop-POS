import { dictionaries, type Language } from "../renderer/i18n";
export function printerTestHTML(language: Language, paper: "58mm" | "80mm") {
  const labels = dictionaries[language];
  const copy = {
    "en-US": ["Printer test", "Test receipt"],
    "my-MM": ["ပရင်တာ စမ်းသပ်ခြင်း", "ပြေစာစမ်းသပ်မှု"],
    "th-TH": ["ทดสอบเครื่องพิมพ์", "ใบเสร็จทดสอบ"],
  }[language];
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src file:; style-src 'unsafe-inline'"><style>@font-face{font-family:Myanmar;src:url('file:///android_asset/public/assets/receipt-myanmar.woff2')}@font-face{font-family:Thai;src:url('file:///android_asset/public/assets/receipt-thai.woff2')}body{font-family:Myanmar,Thai,sans-serif;font-size:14px;color:black;background:white}p{overflow-wrap:anywhere}</style></head><body><h2>${copy[0]} · ${paper}</h2><p>${copy[1]}</p><p>2 × 1,500 MMK = 3,000 MMK<br>${labels.discount}: 500 MMK<br>${labels.total}: 2,500 MMK<br>${labels.paid}: 3,000 MMK<br>${labels.change}: 500 MMK</p><p>0123456789<br>------------------------</p></body></html>`;
}
