# Day/night appearance and search icon

Android 0.2.0-android.10 adds a sun/moon button next to the language selector on login/setup and in the signed-in header. It switches day/night colors for the shell, navigation, panels, tables, inputs, messages and dialogs. The local device preference is saved as pos.theme; the initial default follows the system color preference when nothing is saved. Theme initialization runs before Android database startup/main UI rendering, and updates the browser theme-color metadata and native-control CSS color scheme.

This is an appearance preference, separate from shop settings and transaction data. It needs no database migration. Receipt/print/JPEG documents keep their separate white-paper styles. Android system bars/native print dialogs and physical device behavior are not inferred from CSS checks.

The search action now renders a 20px SVG with a 2.25-unit rounded stroke instead of a font glyph. Its color follows the current theme, and the button has a selected-language accessible name and at least a 44px touch area. Submission still uses the existing search/filter workflow.

## Checks

73 shared tests, TypeScript and desktop workflow passed. Browser tests passed the theme toggle, dark form/control colors, saving across reload and return to day mode. Night dashboard and demo-modal screenshots were visually inspected. Full Android-browser regression passed all 27 layout combinations, search SVG/touch-area assertions, actual night-mode demo confirmation/cleanup/pull refresh, currency/refund, persistence/rollback and backup restore checks.

Physical ARM/touch/printer tests, external receiving-app delivery, production signing and differently signed upgrades remain pending. This is a debug-signed APK: back up externally before updating and do not uninstall to bypass a signature mismatch.

## Verified release

Published [android-v0.2.0-test.18](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/tag/android-v0.2.0-test.18), source `db98545`, app **0.2.0-android.10**. [Workflow 39137451289](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/actions/runs/39137451289) succeeded in **5m21s**: 73 shared tests, actual API35 APK installation, theme preference/reload and search icon checks, night demo modal/stock/refresh, Owner recovery/barcode, sale/change/receipt/JPEG, Back/Exit/reopening, force-stop persistence, same-APK reinstall and SQLite integrity/schema9. Publication was confirmed by the successful workflow.

The full public APK download returned HTTP200: **11,007,615 bytes**, SHA256 `c78e8cfdc6465f369c6e0333ebfb0bc3086683a2e85328a42eb15cd328dfb1c2`, matching checksum and verification JSON. Metadata explicitly records themePreference and searchIcon as true. The synthetic receipt JPEG hash also matched metadata (720×2496, 156,918 bytes). No new Windows build or physical hardware test is claimed; signing remains Android debug test signing.
