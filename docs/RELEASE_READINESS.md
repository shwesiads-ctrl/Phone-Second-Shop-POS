# 0.2.0 release readiness

Status: **candidate built/tested in Linux cloud; not approved for a production Windows rollout**. See [VALIDATION.md](VALIDATION.md) for actual results and [FEATURES.md](FEATURES.md) for master-spec coverage. Unchecked items are not claimed complete.

## Completed in this environment

- [x] Inspected existing source, original specification, checklist, build/installer scripts, previous results and saved startup draft.
- [x] Schema 8: original tender units, immutable rate metadata, refund allocation links, stock/repair FX snapshots, converted-report history, methods, wholesale and atomic exchanges.
- [x] MMK/THB/USD explicit precision and rational HALF_UP conversion; explicit authorized rates, no inferred/default rate.
- [x] Mixed inventory, original-currency split/partial payments, later collection, supplier refund/reversal, returns, trade-ins and repair conversions tested.
- [x] Original-tender cumulative refund rounding; newer/default rates do not rewrite invoices or refund values.
- [x] Profit/COGS canonical reconciliation and native cash collections/change; historical receivables/payables and dated reversals tested.
- [x] Incremental working controls: methods/deactivation, wholesale pricing, inspection corrections, atomic exchange, date shortcuts, installed-printer discovery.
- [x] Genuine 0.1.0 schema-7 paid/partially-returned fixture migration and staged backup restore preserve history and source backup bytes.
- [x] Automated business tests, typecheck, production build and actual Electron desktop workflow.
- [x] Actual Electron MMK invoice/USD tender UI workflow; nine PDF receipts: en/my/th × 58mm/80mm/A4, measured widths, embedded fonts/text, discount/payment/change fields.
- [x] Electron/IPC/CSP/backup/log review; esbuild advisory fixed; production dependency audit has zero known advisories at recorded run.
- [x] Frozen dependency install and saved cloud setup/start commands validated; no core application secrets required.

- [x] Final 0.2.0 NSIS cross-build and archive integrity; x64 app/version, 28 generated files and SHA256 verified; installer/app unsigned.

- [x] Source and unsigned installer published to GitHub prerelease v0.2.0-ci.5; Windows Server 2022 unit/source-app/build/archive workflow passed. Public installer download returned HTTP 200.

## Required before production release

- [ ] Windows clean installation on supported Windows 10/11 x64, standard user, no Node runtime installed.
- [ ] Installed EXE launch, first Owner setup, first-run SQLite creation, offline checkout and permissions.
- [ ] Real Windows 0.1.0 → 0.2.0 upgrade on a backed-up sample shop; compare original invoices/payments/rates, current balances, stock/photos and database integrity.
- [ ] Native uninstall/reinstall preserves business data, safety backups and user-added files; exact shortcuts/registry cleanup verified.
- [ ] Record actual SmartScreen/unknown-publisher warnings; none observed here because Windows is unavailable.
- [ ] Physical 58mm/80mm thermal and A4 printing: correct installed driver/device, cut margins, page breaks, alignment, long names, large amounts, IMEI, warranty, shop logo/details and all totals.
- [ ] Burmese/Thai/English physical glyph shaping and readability; verify against preview/PDF and invoice. Browser/PDF font loading does not establish printer output quality.
- [ ] Scanner/cash drawer hardware and native Windows process sandbox acceptance.
- [ ] Legitimate certificate/provider signing integration, including the custom NSIS uninstaller, then final signature/timestamp verification and retesting. Current bytes are unsigned.
- [ ] Resolve or explicitly accept the eight moderate development/build-tool audit entries before a controlled production build.
- [ ] Accountant/shop acceptance of rounding, original-currency refunds, period reports and limits; no automatic FX revaluation/general ledger exists.
- [ ] Review remaining master-spec gaps in FEATURES.md: repair cart services, cashier PIN, re-intake cycles, portable target, stock/general-ledger journals, label presets, encryption/autobackups and photo editing.
- [ ] Review and save the environment draft, then publish through environment settings. Draft persistence is not publication.
- [ ] Independently verify a fresh cloud task restores the environment and reruns setup. Source is now published to GitHub; environment snapshot restoration remains unverified.

## Environment settings checklist

- Existing checkout `/workspace/Phone-Second-Shop-POS`; retain changes and caches in the environment snapshot.
- Node.js >=24, npm lockfile; `npm ci`, explicit Electron runtime install.
- Linux Electron shared libraries/headless capability and Poppler `pdfinfo`/`pdftotext`; present in this image.
- Writable `/workspace/.npm-cache`, `/workspace/.cache`, Electron/Builder cache subfolders.
- Package-manager/GitHub release download presets; session proxy/CA trust retained. No network policy broadening or certificate bypass.
- `NODE_USE_ENV_PROXY=1` for Node downloads; Builder uses `ELECTRON_GET_USE_PROXY=1`. No payment-provider secret/database server required.
- Linux-only `--no-sandbox --ozone-platform=headless --disable-gpu` restricted to cloud test/dev invocation; never Windows production launch.
- Startup follows `docs/CLOUD.md`; tests use isolated synthetic databases. No production data in install folders or test seeds.
- Configuration save/read-back and publication status are separately recorded in VALIDATION.md.

## Android selected-language receipt and drawer update

Android 0.2.0-android.6 / test.12 passed 68 shared tests, desktop and Android-browser workflows, and native API35 installation/drawer/receipt/JPEG/persistence verification. The published APK full download/hash matches metadata. See [exact evidence, failed-run fixes and remaining physical hardware/signing checks](RECEIPT_LANGUAGE_DRAWER.md). No new Windows installer or physical printer test is claimed.

## Android demo inventory and pull-to-refresh

Android 0.2.0-android.8 / test.16 is published and full download/checksum verified. 73 tests, desktop/browser workflows and actual installed API35 demo/refresh/currency/JPEG/reopening/same-APK reinstall checks passed. See [precise evidence and history-preserving cleanup rules](DEMO_REFRESH.md). No schema migration needed. Physical touch/ARM/printer tests, external share delivery, stable production signing and differently signed upgrades remain pending. No new Windows build/installation test is claimed.

## Android demo visibility and typeface fix

Android 0.2.0-android.9 / test.17 is published, full APK download/hash verified. 73 shared tests, desktop, full browser and actual API35 APK checks passed: real demo dialog cancellation/confirmation, auto-navigation/filter clearing, font loading/layout, currency/receipt and reinstall/persistence. See [evidence and physical device/native picker/printer/signing limits](DEMO_VISIBILITY_FONTS.md). No schema migration or new Windows installation test.
