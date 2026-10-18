# Demo visibility and UI typefaces

Android 0.2.0-android.9 addresses a successful demo addition whose result was hard to find: samples live in Accessories, the previous action stayed in Settings, and existing search/date filters could hide the rows. Add now opens Accessories with an empty search/date range and the first page (index 0). The search field itself is cleared too. A selected-language success message says 100 demo accessories are ready; Settings shows the tracked batch count. Existing batches are reused rather than duplicated. The 100 records are paginated, with 50 per page.

Demo confirmation uses an accessible in-app modal rather than window.confirm. Cancel/Escape closes it without changes; Android Back handles the open modal before Exit confirmation. Controls are disabled while saving and failures remain visible in the dialog. Existing Owner-only authorization, tracked cleanup, history guards, cart protection and non-reused item IDs remain intact. No schema migration, application-ID or database-path change is needed.

UI fonts bundle real Noto Sans Myanmar and Noto Sans Thai weights 400, 600 and 700. Previously Myanmar 700 and Thai 600/700 were not imported. Language-appropriate stacks, real heading/table weights, normal letter spacing for complex scripts and generous mobile line height preserve shaping and leave room for combining marks. Controls inherit the app typeface. Fonts are local assets, with no external font download. This change concerns the app UI; receipt font handling remains separate.

## Verification

73 shared tests, TypeScript and the desktop workflow passed. A focused browser workflow passed real in-app confirmation/cancellation (no native-dialog override), clearing old search/date filters, automatically visible demo rows, count/removal/pull refresh, currency sale/refund, durable reload, rollback and backup restoration. Full browser workflow passed all 27 layout combinations and actual bundled Myanmar 700 / Thai 600 font-face loading checks. Fresh Myanmar and Thai UI screenshots were visually inspected.

Physical ARM devices, platform-native picker fonts, physical pull gestures, printer hardware, receiving-app delivery and stable production signing remain pending. The APK is a debug-signed test build. Back up externally before upgrading; do not uninstall to bypass a signing mismatch.

## Published APK verification

[android-v0.2.0-test.17](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/tag/android-v0.2.0-test.17), source `3e4c1df`, app version **0.2.0-android.9**, passed [native workflow 39136328550](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/actions/runs/39136328550) in **5m45s**. The actual API35 APK passed bundled font/layout assertions, real in-app demo confirmation and Android Back cancellation without a window.confirm override, automatic Accessories navigation despite old filters, count/cleanup/pull refresh, Owner recovery/barcode, currency sale/change, receipt/JPEG, Back/Exit/reopening, force-stop persistence, same-APK reinstall and SQLite integrity/schema9 checks. Publication was confirmed by the successful workflow.

The full public APK download returned HTTP200: **11,006,054 bytes**, SHA256 `49b1f9e05a867c00344082447141bc0e6347bcf3af084bb210be4742c6ccbfcd`, matching checksum and verification JSON. The downloaded synthetic receipt JPEG hash also matched metadata (720×2496, 157,028 bytes). This remains a debug-signed test APK. No Windows build or physical hardware installation/printing test is claimed.
