# 0.2.0 validation evidence

Run date: 2026-10-18, Debian 13 x64 cloud; Node 24.19.0, npm 11.9.0, Electron 44.9.0. Tests create synthetic temporary databases and remove them; no shop data or production account was seeded.

## Automated results

- **49 passed, 0 failed, 0 skipped**: 27 business tests, 19 currency/incremental-feature tests, two legacy migration/restore tests, one exact uninstall-manifest safety test.
- `npm run build`: strict TypeScript, Vite renderer and esbuild main/preload production bundles passed. esbuild is pinned to 0.28.2.
- `node tests/e2e/desktop.mjs`: actual Electron Owner setup → supplier → phone purchase → paid sale → receipt; language switching/persistence, fonts, barcode/QR, backup/restore/safety copy/logout, redacted bug export and isolated preload passed. Native file dialogs are mocked to choose temporary test paths; actual SQLite backup/restore is exercised.
- `node tests/e2e/currency-print.mjs`: actual UI MMK 3,000 cart − 100 discount = 2,900 invoice; USD 2.90 original tender at USD 1 = MMK 1,000; USD 5.00 handed over, USD 2.10 change. Persisted source/credited amounts and Reports USD currency precision verified.
- Nine actual Electron PDF outputs passed: en-US/my-MM/th-TH × 58mm/80mm/A4. `pdfinfo` measured widths about 57.83/80.09/209.89mm; `pdftotext` verified invoice, item, Myanmar/Thai code points, total, received and change. Bundled Myanmar/Thai fonts loaded. The narrow-layout PDF was visually inspected after fixing split totals/quantity wrapping. Sample 58mm receipt fits one 250mm page; arbitrary long invoices/page breaks remain printer acceptance work.
- `bash scripts/setup-cloud.sh`: frozen `npm ci`, explicit Electron runtime install, unit tests, production build and both real Electron suites succeeded on this image. Poppler commands are present. Repeated release builds run the unit/desktop gates before packaging.

Synthetic screenshots/PDFs and machine-readable receipt outcomes are in ignored `test-results/`; source test harnesses are committed-ready in `tests/`.

## Cross-currency coverage

The 19 tests in `tests/currency.test.ts` cover all six direction pairs, precision, HALF_UP ties, invalid/zero/overflow rates, authorization and immutable rates/payments; partial and later foreign collections; wrong/missing rates and conversions to zero; mixed catalogue/COGS; cumulative original-unit refund rounding; debt-first returns and split original tenders; purchase/refurbishment/reversal; native-valued trade-in/reversal; repair deposits/cancellation; preferences/history and converted report snapshots; cash received/change; atomic exchange rollback/idempotency; active custom payment methods and historical refunds; wholesale permissions/COGS; foreign repair-part costs; historical receivables; inspection correction/audit/finalization; and supplier balances/dated reversals.

The genuine 0.1.0 ASAR was used to generate the static synthetic schema-7 fixture (`scripts/capture-legacy-fixture.mjs`, `tests/fixtures/legacy-v7.sql`). Migration preserves original paid/partially-refunded invoice/payment facts, retains legacy minor-unit rate semantics and prevents double refunding. Restore preflight upgrades a copy, preserves original backup bytes and rejects a future schema. This is **database upgrade evidence**, not a Windows installer-upgrade test.

## Windows artifacts

The 0.1.0 installer is retained separately. 0.2.0 is built with the existing Electron Builder/custom native NSIS path and generated exact uninstall manifest, without Wine. The build gates include unit tests, typecheck/build and Electron desktop workflow. `scripts/verify-windows.mjs <7zz-path>` tests the NSIS archive and embedded app archive, compares bundled main/preload and every generated renderer/font/license file to the tested production build, checks package version and PE architecture/signature-directory metadata and writes the final checksum.

Authoritative artifact metadata is saved to `test-results/windows-artifact.json` after verification; final hash/size are recorded below after successful verification. Structural inspection does not execute an installer. A Builder log message mentioning signtool does not establish a valid signature.

Native Windows execution, clean install, first-run database creation, installer upgrade, uninstall/reinstall data preservation, shortcuts/registry cleanup, UAC and SmartScreen **have not been performed**. No Windows runner/VM is attached; this Linux machine has no usable Windows virtualization environment. No SmartScreen warning has been observed here. Both current release binaries are unsigned unless independently signed and verified through the procedure in SIGNING.md.

## Printing boundary

OS printer discovery returned **0 printers**. No physical job was sent. Actual thermal 58mm/80mm and A4 driver/paper output, Unicode shaping on paper, cutter/cash drawer and Windows print-dialog behavior are **pending**. Generated PDFs establish digital rendering and content, not physical printing. Detailed acceptance steps are in RELEASE_READINESS.md.

## Security and environment

`npm audit --omit=dev --json`: **0 known production advisories**. Full audit: **8 moderate, 0 low/high/critical**, after fixing esbuild. Remaining entries trace to sprintf-js ≤1.1.3 through Electron Builder's download/proxy dependency chain; no patched sprintf-js release was available in the registry at inspection. These build-tool advisories remain open. No signing identity was configured or fabricated.

Reviewed sandbox/context isolation/Node integration, IPC schemas/sender/main-frame/role checks, local HTML CSP/escaping, permission denial, backup staging and sensitive-value-free error diagnostics. Windows sandbox acceptance and legitimate signing remain pending; source review is not a penetration-test claim.

Environment draft **revision 2** saved successfully and read back with exact matching setup/start instructions, zero secret requirements and unchanged network/repository settings. Platform returned `requires_publish: true`; **not published**. Review/save in environment settings, then publish. Snapshot/fresh-task restoration has not been tested. Source changes remain local/unpushed; a GitHub-only checkout does not reproduce them yet. See CLOUD.md for setup and RELEASE_READINESS.md for settings and release gates.

## Verified final installer

- Final `npm run dist:win` exited **0** after unit/build/desktop gates passed.
- Artifact: `release/Phone Second Shop POS Setup 0.2.0.exe`.
- Size: **116,574,913 bytes**.
- SHA256: `383ec04e6f720210dd6861a3aa395303d386ea6354834214c24e6672eec00ada` (companion `.exe.sha256` also written).
- `7zz t`: installer and embedded application archive **passed**.
- Embedded version **0.2.0**; **28** generated main/preload/renderer/font/license files match the tested build byte-for-byte.
- NSIS bootstrap: PE32/i386; actual application: PE32+/x64 (`0x8664`). Certificate-table size **0** for both: **unsigned**. Builder explicitly states that its custom NSIS uninstaller is not signed by Electron Builder.
- Production archive checks exclude root test/scripts and development-tool packages. Native Windows execution/installation remains **PENDING**.

The final artifact checksum is recorded after packaging and does not attempt to embed a self-referential installer hash in the installer itself. Build, archive verification, unit, PDF and audit evidence are retained locally in `test-results/evidence/` and the machine-readable result files.
