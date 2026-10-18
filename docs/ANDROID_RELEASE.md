# Fixer Tools — Android test APK

## Current: Android 0.2.0-android.9

[Download verified APK test.17](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/download/android-v0.2.0-test.17/Fixer-Tools-Android-0.2.0-test.apk). Successful demo addition now opens Accessories, clears old search/date filters and resets to the first page; Settings shows the tracked demo count. Confirmation uses the actual in-app dialog. UI bundles Myanmar/Thai 400/600/700 fonts with corrected complex-script spacing. All 73 tests, desktop/browser checks and complete API35 native workflow 39136328550 passed; full download/checksum verified. See [exact results and remaining hardware/signing limitations](DEMO_VISIBILITY_FONTS.md).

## Previous: Android 0.2.0-android.8

[Download verified test APK](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/download/android-v0.2.0-test.16/Fixer-Tools-Android-0.2.0-test.apk): pull-to-refresh and Owner-controlled add/remove of 100 tracked demo accessories, with atomic cleanup/history guards and non-reused inventory IDs. All 73 shared tests, desktop, Android-browser and full actual API35 APK workflow [39129197688](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/actions/runs/39129197688) passed. Full downloaded APK/checksum and synthetic JPEG verified; [evidence and pending hardware/signing items](DEMO_REFRESH.md). Demo sales are real transactions; cleanup refuses used samples. Back up externally before upgrading; do not uninstall to bypass signature mismatch.

## Previous: Android 0.2.0-android.6

[Verified test release android-v0.2.0-test.12](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/tag/android-v0.2.0-test.12) adds selected-language receipt labels/native controls and a sliding mobile navigation drawer. All 68 shared tests, desktop/browser checks and actual installed API35 APK workflow [39124424300](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/actions/runs/39124424300) passed. Full APK download/checksum and synthetic receipt JPEG were verified; see [results and pending hardware/signing items](RECEIPT_LANGUAGE_DRAWER.md). This remains a debug-signed test APK.

## Previous: Fixer Tools · Android 0.2.0-android.5

**Verified published APK:** [android-v0.2.0-test.9](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/tag/android-v0.2.0-test.9), source `6888779`, [successful native workflow 39122033913](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/actions/runs/39122033913). Actual API35 APK passed Fixer Tools launcher/UI branding, native receipt Gallery JPEG save and share chooser, plus all existing workflow/persistence checks. All 62 shared tests, typecheck, desktop and Android-browser checks passed. The full downloaded APK returned HTTP 200, 10,727,914 bytes; SHA256 `6f4b8ecdfe2b2aa2a944cabb0702df09eba965c8016fc5a09f4d0cf502640ae1` matched both attached checksum and verification JSON. The 720×2384 exported synthetic JPEG was downloaded/hash-checked and visually inspected: Unicode, invoice details and payment/change are visible. External receiving-app delivery and physical hardware remain pending; see the linked JPEG validation details.

Renames the Android app and icon to Fixer Tools and adds native receipt Save JPEG / Share JPEG. See [JPEG export, privacy, bounds and verification](FIXER_TOOLS_JPEG.md). The app ID/database path remain unchanged. Existing Owner security, barcodes, Back confirmation and Bluetooth flow remain available. New setup defaults the shop name to Fixer Tools; existing settings/invoice snapshots are preserved. The sample JPEG attached to this release contains only synthetic emulator test data. This remains a debug-signed test APK; stable signing and physical-device/printer acceptance are pending.


## Android additions · 0.2.0-android.4

**Verified published APK:** [android-v0.2.0-test.8](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/tag/android-v0.2.0-test.8), artifact source `742663a`; [Actions 39120557672](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/actions/runs/39120557672) passed. The installed API35 emulator passed Owner recovery, new barcode UI/persistence, customization-link UI, real native Bluetooth status and disconnected-print refusal, Back/Stay/Exit, reopening after Exit with retained data, offline currency sale/change, native receipt preview, force-stop/reinstall persistence, and SQLite/package verification. **No physical printer/radio connection or paper output was tested.**

Full public APK download returned HTTP 200, **10,716,610 bytes**; SHA256 **`99c653c3359777e348434e989ead115193bd8e6525f1079534cc45ffdebd32c7`** matched the attached checksum and verification JSON. All 62 shared tests, typecheck, desktop workflow, 27 browser layout combinations and full Android-browser workflow passed. Mock-transport search/connect/disconnect/test-preview and support routing passed. A subsequent test-only status-completion wait (`09d51e2`) passed a targeted browser rerun; product source is unchanged from the published APK.

Earlier native run 39120110235 reached all feature/persistence assertions but reused a closed automation WebView after task Exit; run 39120403059 hit the intentional BUSY guard because automation requested printing before the native status call completed. They did not publish APK releases. The final run uses a fresh public Android-device connection after Exit (without force-stopping the app), and the test helper now awaits status completion. Functional checks were retained.

Adds native Back/Exit confirmation, Owner customization link to Telegram @kominit, Classic Bluetooth SPP discovery/paired connection/disconnect, 58/80mm Unicode ESC-POS raster printing through receipt/test preview, and automatic internal accessory barcodes. See [setup, supported protocols and pending hardware acceptance](ANDROID_PRINTER_FEATURES.md). No database migration or dependency changes. All 62 shared tests and TypeScript passed, and the desktop workflow passed. Browser/native APK results are gated separately. Hardware printing is explicitly pending; a socket/send is not paper confirmation. The APK remains debug-signed and may not upgrade an older differently signed build. Preserve an external backup before changing installs.


## Free Owner edition · 0.2.0-android.3

**Verified published APK:** [android-v0.2.0-test.5](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/tag/android-v0.2.0-test.5), source `703c30e`; [Actions run 39113483060](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/actions/runs/39113483060) succeeded. All 57 shared/security/migration tests, APK build, real installed Android WebView Owner recovery/UI, offline sale/change, receipt preview, force-stop persistence, same-APK reinstall, schema-9 database integrity and APK signature/package checks passed. Full public download returned HTTP 200, **10,691,998 bytes**; SHA256 **`59d6528853d2d205bd2927f6e93d654edb7be2321b61130f482fe935b0b5be46`** matched the attached checksum and verification JSON. Native screenshots are evidence; physical phones/printers and upgrades from differently signed older APKs remain unverified.

Initial native run 39113103978 built the APK and passed Owner recovery, offline sale and native receipt preview, but timed out taking a CDP full-page screenshot after returning from the native receipt Activity. Persistence/reinstall checks were not reached and no release was published from that run. The test now uses native Android display capture at that point, retaining the Unicode DOM assertions and all subsequent functional checks.

Android now offers the free, single-Owner workflow: no staff-role screen, staff login or user/permission creation. Historical user records and transactions are retained. Owner settings include password-authorized recovery-key creation/rotation and a logged-out one-use password reset. Database schema 9 adds only recovery hashes and persistent authentication throttling. Session credentials/active roles are rechecked and logged-out shop settings are withheld. See [Owner security, recovery instructions and limits](OWNER_SECURITY.md).

Local checks: 57 shared/security/migration tests passed, TypeScript passed, and the desktop Electron workflow passed. The Android-browser workflow also passed all 27 responsive layout combinations and the real settings → key generation → logged-out recovery → replacement-password login → consumed-key rejection UI flow (native dialogs/storage substituted). Native APK results are reported separately by the release workflow and verification JSON. This release remains a debug-signed test APK; stable production signing, physical ARM devices, native document-picker acceptance and printers remain pending.

**Before upgrading:** export a verified external backup. Older schema-8 apps cannot open schema-9 backups. CI signing keys may differ, so preserve the installed app if Android refuses an update. Uninstall deletes private app data. Backup restoration may restore old passwords/recovery keys; rotate both after restoring.


Published UI-fix APK: [android-v0.2.0-test.3](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/tag/android-v0.2.0-test.3), source `b13247a`, [actual APK/emulator workflow](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/actions/runs/39107342666). Build, installed WebView layout checks in all three languages, offline checkout, native receipt preview, persistence, same-APK reinstall and package verification passed. Full public download returned HTTP 200, 10,689,202 bytes; SHA256 `ab23b9a25f8dac17692c482643396548e23c3e3f4b594d45cf45a6495da3eb34` matched checksum and verification JSON. Physical device/printer acceptance and stable production signing remain pending.

## Android UI correction (0.2.0-android.2)

The mobile header now grows with its title and account controls, preventing the language/logout row from overlapping search and date filters. Search occupies a full row, dates use two equal columns, and refresh moves below them. Tables remain horizontally scrollable inside their panels. Touch table text is enlarged. No database migration is required.

Local validation: 49 shared tests passed, typecheck and Android asset sync passed, and the Android-browser workflow passed including all 27 language/page/width layout combinations. Native APK verification also passed in the linked release workflow.

Regression checks exercise actual rendered header/control bounds and page overflow on Dashboard, Checkout and Inventory in Burmese, Thai and English. The browser suite covers 360, 420 and 760 CSS pixels; the release pipeline also runs these checks in the installed Android WebView before publishing. The attached verification and workflow determine whether the new APK passed.

**Updating an existing test install:** CI debug signing keys can differ between builds. First export and verify an external backup. If Android rejects the update due to a signing mismatch, preserve the installed app and its data; do not uninstall until backup/restore has been verified. Same-APK reinstall tests do not prove upgrades from a differently signed older APK.


Download `Fixer-Tools-Android-0.2.0-test.apk` from the release Assets. Android 10 or later with a current Android System WebView is required. This is an offline Android app using the existing POS business rules, not a connection to your Windows database.

Android APK ကို Assets ထဲက `.apk` ဖိုင်မှ download ဆွဲပါ။ Android 10 နှင့်အထက် လိုအပ်ပါသည်။ စမ်းသပ်ဗားရှင်း ဖြစ်ပါသည်။

The APK uses Android's standard **debug test signing certificate**, not a production publisher key or Play Store release identity. A fresh CI build may have a different test key. Do not uninstall an existing shop installation to bypass a signing mismatch without an external verified backup: **Android uninstall deletes app data**. A legitimate stable release key is required for production updates.

Supported workflows reuse the desktop service: first Owner/login, phones and IMEI, purchases, accessories, checkout, approved MMK/THB/USD rates, payments/change/refunds, trade-ins, repairs/warranty, cashbook and reports. Android adds private atomic SQLite-file persistence, native document-picker backup/restore/CSV/report export, image selection, receipt preview and Android system Print/Save as PDF. No live Windows/Android synchronization or payment-provider verification is provided.

The release workflow must pass shared tests, Android build/signature checks and installation/workflow/persistence tests on an Android API35 x86_64 emulator before publication. Check the attached `apk-verification.json` and workflow for actual results. The native SAF picker workflows, print-service compatibility, physical ARM phones and Bluetooth/USB thermal printer output require further device acceptance; do not infer physical printing success from emulator preview.

Storage uses offline SQLite WASM with the exact same versioned schema. Desktop SQLite backups are interoperable at schema 9 with updated desktop source; older supported files migrate on a copy. Database size is capped at 32 MiB in this test version, photos at 5 MB each; larger shops require a scalable native SQLite storage implementation. Before restore, an external safety backup must be saved. Android automatic OS backup is disabled; make manual backups outside app storage. Records are not encrypted at rest by this application; protect the phone and exported backups.

This is a separate test app ID (`com.myominaung.phonesecondshoppos.mobile`). No production account, cloud secret, advertising SDK or automatic business-data upload is included. The native bridge only accesses its fixed private database and files explicitly chosen through Android document pickers. Capacitor payload logging is disabled. The WebView uses only bundled assets; release credentials and physical device testing remain outstanding.

## Verified publication

[Android prerelease](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/tag/android-v0.2.0-test.2) published successfully through [Actions run 39098837448](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/actions/runs/39098837448). The downloaded APK returned **HTTP 200** and its full downloaded bytes were hashed and matched both attached checksum and verification JSON.

- Size: **10,688,918 bytes** (about 10.2 MiB).
- SHA256: `28916ffb1cd8d6dc22b7faa65db800610da7a3b6156470fd4cc737ff35fe3123`.
- Debug certificate verified by Android `apksigner`; installed successfully on Android API35 x86_64.
- Actual APK tests passed: first Owner setup, offline UI checkout with Wi-Fi/mobile data disabled, USD original tender/change on MMK invoice, Burmese/Thai UI switching, native script-disabled receipt preview, force-stop/relaunch persistence and same-APK reinstall preserving the invoice.
- The private SQLite file extracted from the test emulator passed desktop SQLite integrity/schema checks. APK assets contain required WASM/fonts and exclude test-only native substitutes. App/source and third-party license notices are bundled.
- Shared desktop tests: **49 passed**. Existing real Electron workflow and the separate Android-browser bridge suite passed locally. The latter also verifies original-unit refund, storage-failure rollback, failed-login throttling, desktop-readable backup and genuine schema-7 restoration/password compatibility, with document dialogs/storage substituted.
- Full npm audit after adding Android tooling: **11 moderate, zero high/critical**. The three additional entries are Capacitor CLI/xcode/uuid build tooling; they remain unresolved alongside the earlier Electron build-tool entries. This is not a production security certification.

Still pending: physical ARM devices, native photo/document-picker end-to-end acceptance, print-service/PDF-driver and actual paper output, larger data-volume testing, encrypted storage and a stable production signing key. Native document picker and print-service code exists; those pending checks are not counted as passed. Desktop printer-name selection does not select an Android printer; use the native Print / PDF chooser.

The Android SQLite engine/business service runs inside the trusted bundled WebView, with native private-file persistence. Role checks are local application controls, not a remote server boundary. The debug APK permits developer inspection; it is not intended as a hardened production distribution. No cloud-environment draft was published by this APK release.
