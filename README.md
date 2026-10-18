# Phone Second Shop POS

Offline Electron + React + TypeScript desktop POS for a second-hand phone shop. SQLite stays in Electron's application user-data folder. Default UI: မြန်မာ; other languages: ไทย and English. Developer: Myominaung · [Telegram @kominit](https://t.me/kominit).

This is version **0.2.0**, a test release for shop acceptance testing. Read [feature status](docs/FEATURES.md) and [accounting policy](docs/ACCOUNTING.md) before entering real business data.

## Windows download

[Download Windows x64 installer](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/download/v0.2.0-ci.5/Phone.Second.Shop.POS.Setup.0.2.0.exe) · [Release notes and SHA256](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/tag/v0.2.0-ci.5)

Installer ကို အပေါ်က link မှ download ဆွဲနိုင်ပါသည်။ Unsigned test build ဖြစ်သည်။ Windows clean installation/upgrade/uninstall နှင့် physical printing စမ်းသပ်မှုများ မပြီးသေးပါ။ Source-code ZIP သည် installer မဟုတ်ပါ။

The GitHub Windows build/test/package verification passed. This does not establish clean installation, upgrade/uninstall or physical printer acceptance. Back up real shop data before testing.

## Android APK download

[Download Android test APK](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/download/android-v0.2.0-test.3/Phone-Second-Shop-POS-Android-0.2.0-test.apk) · [Android release notes/checksum](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/tag/android-v0.2.0-test.3)

Android 10+ and an updated Android System WebView are required. This is a debug-signed test build, tested by actual APK installation and workflows on an API35 emulator. Windows and Android keep separate offline databases; no automatic synchronization. Android uninstall deletes app data, so export a verified backup before uninstalling or changing signing keys. Physical phones/printers and native document-picker acceptance remain pending. See [Android scope and limits](docs/ANDROID_RELEASE.md).

## Development

Requires Node.js 24+, npm and Git. Electron 44 embeds Node 24 with `node:sqlite`; no native SQLite driver rebuild is required. Dependencies are pinned in `package.json` and `package-lock.json`.

```sh
npm ci
node node_modules/electron/install.js
npm test
npm run build
npm run dev
```

Electron 44's npm package provides an explicit runtime installer. Run that command after `npm ci`. The runtime download retains its upstream checksum verification. On a proxy-based cloud machine use `NODE_USE_ENV_PROXY=1` and a writable `electron_config_cache` / `XDG_CACHE_HOME` (see [cloud instructions](docs/CLOUD.md)). No secrets or database server are required for core operation.

```sh
npm run test:desktop   # build + real Electron/Playwright workflow, isolated temporary DB
npm run test:print     # 9 Electron PDF checks; requires Poppler pdfinfo/pdftotext
npm start              # launch the production build
npm run dist:win       # unit tests + build + desktop test, then NSIS x64
```

The desktop test uses a temporary application-data directory on every OS. Linux CI uses Chromium headless flags and disables its OS process sandbox **only in the test invocation**, because this cloud machine cannot configure the SUID helper. Normal application startup keeps renderer sandboxing enabled. Never add these CI arguments to the Windows launcher.

## First use

1. Create the first Owner account with your own password (minimum 10 characters); no default account is shipped.
2. Configure store details, receipt terms, language, currency, region and timezone in Settings. Windows Defaults is an explicit action; saved preferences are retained.
3. Add a supplier/previous owner in Customers & suppliers, then record a phone purchase, IMEIs and inspection results. Missing identifiers need Owner/Admin approval and an alternative shop identifier.
4. Add accessories as opening stock or replenish them from a supplier. All monetary inputs are major units: whole MMK, or two decimals for THB/USD.
5. At Checkout, search or scan an identifier into Search, add products, set quantities/warranty, choose a customer for credit, record one or multiple tenders, and finalize. Enter the exact amount credited to the invoice; choose an authorized rate for foreign tenders, and optionally enter cash handed over to record native-currency change.
6. Collect remaining balances on Payments. View/reprint invoices in Sales history. Return entire invoices or individual lines; returned phones must be inspected before resale.
7. Use Repair center, Warranty & returns, Accounting and Reports. Keep external backups through Settings.

Payment methods are manually recorded. KBZPay, WavePay, AYA Pay and bank transfer records do not verify payment with a provider. Cross-currency conversion uses explicitly chosen Owner/Admin rates, with original tender and refund history preserved. No live rate feed, payment verification, automatic report submission, donation verification or update service is configured.

## Project map

- `src/main/database.ts`: versioned schema migrations, foreign keys, WAL and transaction helper.
- `src/main/service.ts`: authentication, permissions, stock, purchases/sales, payments, returns, trade-ins, repairs, warranty and reporting.
- `src/main/validation.ts`: main-process Zod schemas and IMEI validation.
- `src/main/main.ts`: trusted IPC, dialogs, backup/restore, exports, barcode labels and printing.
- `src/main/preload.ts`, `src/shared/contracts.ts`: restricted bridge and shared types/integer money.
- `src/renderer/`: React UI, centralized language dictionaries, bundled fonts.
- `tests/`: business integration tests and a real Electron desktop acceptance workflow.
- `docs/`: installation, accounting, security, feature checklist and original requirements.

See [Windows installation and upgrade instructions](docs/WINDOWS.md), [security and backups](docs/SECURITY.md), and [validation results](docs/VALIDATION.md).
