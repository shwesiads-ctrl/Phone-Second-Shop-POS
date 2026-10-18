# Version 0.2.0 implementation checklist

The original master prompt is retained in [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md). This checklist distinguishes a working first release from every advanced requirement in that prompt.

## Phase 1 — Project and database

- [x] Electron main process, restricted preload, React/TypeScript/Vite renderer and pinned dependencies.
- [x] SQLite in application user-data, versioned transactional migrations (schema 8), foreign keys, WAL and bounded input validation.
- [x] Separate services, validation, database, bridge contracts, localization and receipt generation.
- [x] Automated business integration tests and an Electron desktop acceptance workflow.

## Phase 2 — Login, inventory, IMEI, purchasing and POS

- [x] First-run Owner setup, scrypt passwords, login/logout, password change, session expiry and failed-login delay.
- [x] Owner, Admin, Cashier, Stock Manager, Technician roles and owner-managed operation permission overrides.
- [x] Unit-level phones, dual IMEI checksum validation, cross-slot duplicate protection and approved alternate identifiers; identifiers remain in history after sale/reversal.
- [x] Named inspection fields (storage, RAM, color, serial, battery health, screen, camera, Face ID, fingerprint, sensors, network/SIM and included accessories), notes and consent-based photos.
- [x] Supplier/customer purchasing, capitalized paid refurbishment, partial supplier payment, idempotent purchase recording and audited reversal.
- [x] Accessories, SKUs/barcodes, opening quantity, low-stock alerts, paid replenishment, weighted cost and reasoned adjustments.
- [x] Search/keyboard-wedge scanning, phone/accessory carts, quantities, backend price/minimum checks, authorized discounts, multiple recorded tenders, credit sale, invoice history and held carts.
- [x] Atomic Owner/Admin trade-in purchase + stock intake + sale + noncash credit.
- [x] Barcode/QR labels; sales, purchase and repair receipt previews/reprints.

## Phase 3 — Payments, repairs, warranty, accounting and reports

- [x] Manual Cash/KBZPay/WavePay/AYA Pay/bank/Other records, receivables/payables and later payment collection.
- [x] Full and line/quantity partial returns, deterministic discount allocation, unpaid-debt-first refund policy, restocking decisions and returned-phone quarantine.
- [x] Repair intake, customer/device/inspection notes, optional technician assignment, diagnosis, stages, approval, estimates/final billing, deposits, stock parts, delivery, deposit refunds on cancellation and linked reopening.
- [x] No-warranty/shop/manufacturer sale warranty records by period; repair warranty, expiry checks, claims and manager resolution. Manufacturer claims remain a shop record, not a provider integration.
- [x] Expense records, shop-wide cash drawer opening/closing/reconciliation, explicit cash in/out, immutable payments, audit events and contact transaction history.
- [x] Per-currency operational profit/COGS/repair-cost/collection/balance summaries, UTC date filters, paginated lists and CSV exports with formula-injection protection.
- [x] SQLite online backup, integrity/foreign-key/schema checks, confirmed restore, safety backup and logout.

## Phase 4 — Language, currency, receipt and support

- [x] Burmese/Thai/English dictionaries, live header selection, language persistence, bundled Noto fonts and offline font/receipt testing.
- [x] Applied MMK/THB/USD conversion for mixed inventory, split tenders, later payments, purchases, trade-ins and repair parts; original units and immutable approved rate snapshots retained. Exact BigInt conversion and cumulative original-tender refund allocation.
- [x] Owner/Admin rate entry, report conversion snapshots, cash received/change and native-currency cash reconciliation.
- [x] Atomic return/replacement exchanges, configured active payment methods, accessory retail/wholesale pricing and audited inspection corrections.
- [x] UTC 1/7/30-day shortcuts, dated purchase reversal movements and historical as-of receivable/payable balances.
- [x] Upgrade/restore schema-7 copies without rewriting original invoices or payments; genuine 0.1.0 fixture regression tests.
- [x] Language/region/currency/timezone/digits/date/time/first-day preferences, explicit OS defaults and confirmed POS preference reset.
- [x] Nine Electron PDF language/size combinations verified; A4/80mm/58mm receipt layouts, configurable printer, logo, store/contact/footer terms, IMEI, warranty and historical sale terms snapshot.
- [x] About from real package version/platform, Myominaung attribution and explicit Telegram opening.
- [x] Voluntary support page with supplied KPay details and clipboard feedback, without fabricated verification.
- [x] Reviewed bug-report copy/export, category and reproduction fields, optional screenshot/basic diagnostics and best-effort redaction; no automatic transmission.

## Phase 5 — Validation and packaging

- [x] TypeScript and production renderer/main/preload builds.
- [x] Business tests and real Electron setup/purchase/sale/receipt, font, barcode, backup/restore and report-export checks.
- [x] Windows x64 NSIS artifact built successfully and structurally verified; Electron Builder configuration and per-user custom NSIS installer/uninstaller source. Uninstall removes the exact packaged file manifest and preserves user-data.
- [ ] Windows 10/11 install/run, upgrade, uninstall/reinstall and real-device acceptance evidence — requires Windows.
- [ ] Actual thermal/A4 printers, paper widths, drawer/scanner hardware and Burmese/Thai print output — requires hardware.
- [ ] Code signing — no signing identity has been supplied; any generated installer is unsigned.

## Remaining product gaps and deliberately limited workflows

These are not claimed as complete:

- Repair services inside the merchandise cart; repair billing/collection/receipts use the separate Repair center workflow.
- Optional cashier PIN, a portable target and advanced stock valuation/general-ledger journals.
- Re-intake/buyback of a previously recorded identifier needs a dedicated ownership-cycle workflow and is currently blocked to preserve history.
- Serial/barcode uniqueness policies beyond IMEI/phone identifiers, and barcode-label printing presets (labels can be viewed).
- Calendar-week/month report grouping, automatic FX gain/loss revaluation, and accountant-approved statutory reports. Converted report snapshots use explicit reference rates; they do not post revaluation journals.
- Partial returns on trade-in invoices remain blocked for manager review; full linked reversal is supported.
- Native Windows execution, signing and physical printing remain release gates, regardless of automated PDF success.
- Device photo editing/redaction, encrypted databases and automatic backup scheduling. Protect backups and review attachments manually.

No production readiness claim substitutes for local shop acceptance testing, Windows verification, financial-policy review or actual printer checks. See VALIDATION.md for the commands actually run and artifact outcome.
