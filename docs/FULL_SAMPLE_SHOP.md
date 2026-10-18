# Functional sample shop and dashboard layout

Use **Owner Settings → Full sample shop → Open sample shop**. Confirm to open a separate temporary sample database. A persistent DEMO banner identifies the current workspace; Return to my shop closes it. Normal shop data is not replaced, imported into the sample, merged with it or reset. A real shop with no transactions correctly remains zero; the nonzero example is an explicitly selected sample workspace.

The initial sample contains 100 distinct products: 40 purchased second-hand phones with approved DEMO identifiers (no fabricated real IMEIs), and 60 priced accessories with positive costs. It includes a supplier, 12 customers, 40 posted phone purchases, 12 sales with full/partial Cash/Bank collections, 30-day warranties, six repair jobs including paid/completed jobs, a shop expense, opening capital and clearly labeled practice exchange rates. Data is synthetic; no real customer dataset is used.

Dashboard values come from normal ShopService/MoneyLedger transactions, not hardcoded dashboard overrides: sale revenue **2,730,000 MMK**, sale gross profit **600,000 MMK**, available phones **28**, plus nonzero collections/repairs and five low-stock products. The user can practice normal business operations inside the sample. Practice changes are discarded on exit or app restart, not backed up as shop records. Stock-only legacy demo add/remove tools remain separate and do not create sales history.

## Isolation and authorization

Only an authenticated Owner can enter. Repeated enter is idempotent. The live service/database is retained, while the sample uses a new in-memory SQLite database. Android persistence explicitly skips the sample workspace. Exit returns the original live service and closes the sample database. Expired sample sessions return to authentication without replaying a practice mutation against live records. Backup/restore/export, identity/security changes, photo imports and external support are unavailable in the sample. Clear or hold the active cart before switching; the interface never silently carries product IDs between shops.

No schema migration, application-ID or live database-path change is needed. Shop credentials are not copied into the sample; its temporary Owner is bootstrapped with a generated, unexposed credential. Screenshots/test data use fictional DEMO names.

## Mobile UI

Sales history and low-stock panels stack vertically on narrow screens. Their cells and repair cells wrap instead of truncating; stat values can wrap and scale. Empty-row colspans now match actual columns instead of creating a phantom column. Android 15+ main content reserves system-bar/cutout insets, so scrolled content is kept below the status bar and above navigation controls.

## Checks

76 shared tests, TypeScript and desktop workflow passed. Tests verify exact sample counts/revenue/profit, real posting/integrity, strict Owner entry, idempotence, practice-write isolation and preservation of an existing live expense. A focused Android-browser workflow passed sample navigation, stacked panel bounds, practice expense isolation, guarded backup, explicit exit, reload into unchanged live data, currency/refund/rollback and backup restoration. The Myanmar night-mode nonzero dashboard and stacked tables were visually inspected. Full browser regression passed all 27 language/width/page layout combinations, actual sample mode entry/exit, practice isolation, reload into live data and the existing business workflows.

Physical device/system-bar/keyboard/ARM behavior, physical printer output, external share receiving-app delivery, production signing and differently signed upgrades remain pending. Debug-signed APKs require an external backup before updates; do not uninstall to bypass signature mismatch.

## Verified release

Published [android-v0.2.0-test.19](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/tag/android-v0.2.0-test.19), source `896ef10`, app **0.2.0-android.11**. [Workflow 39139909620](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/actions/runs/39139909620) succeeded in **6m28s**, including 76 tests, actual API35 APK installation, nonzero sample counts/revenue/profit, stacked table geometry, practice expense isolation, guarded backup, explicit exit, force-stop while in the sample and authentication into unchanged live business data. Before restarting, the native live SQLite file was compared byte-for-byte before sample entry and after practice/explicit exit and matched. The subsequent login correctly creates normal authentication audit events; no sample business records were merged. Normal currency checkout, receipt/JPEG, Back/Exit/reopening, same-APK reinstall and schema9/integrity checks also passed. Publication was confirmed.

Full public APK download returned HTTP200: **11,012,401 bytes**, SHA256 `e758adf7901c1bb9f4ff854f678e921c60fa621a95f01c9646aa14f4fedcf7c6`, matching checksum and verification JSON (sampleWorkspace true). Synthetic receipt JPEG download/hash also matched metadata (720×2496, 157,267 bytes). Windows was not rebuilt or newly installation-tested. Signing remains Android debug test signing.

Settings-only entry: removed the Dashboard introduction card. Typecheck and a focused Android-browser workflow passed, asserting no Dashboard entry, opening from Owner Settings, nonzero sample reports, exit/reentry and restart isolation. Existing global sample-mode banner/return action remains available. This UI change has not yet been packaged and verified in a new APK.
