# Fixer Tools · Android 0.2.0-android.5

The Android launcher/splash, login, navigation, About and diagnostic title now use **Fixer Tools**, with a navy wrench-and-gold-bolt icon. The existing application ID `com.myominaung.phonesecondshoppos.mobile` and private database path are preserved. No database migration is required. New Owner setup defaults the shop name to Fixer Tools; existing shop settings and stored invoice snapshots are preserved. The old Windows installer is not rebuilt by this Android release.

## Receipt JPEG

Open an invoice receipt preview:

- **Save JPEG** writes the full rendered receipt to `Pictures/FixerTools` through Android scoped MediaStore (Android 10+). It needs no broad storage permission. The file becomes visible only after successful JPEG compression/write and MediaStore finalization. A failed write removes its incomplete media entry.
- **Share JPEG** creates a private temporary JPEG and opens the Android share chooser with `image/jpeg` and a read-only content URI. Choose the receiving app yourself; opening the chooser does not send a message or upload data. The app grants access only to the generated image, not the database/cache directory. Temporary share images older than 24 hours are cleaned on a later share; saved Gallery images are not deleted.

Unicode uses the same bundled Myanmar/Thai fonts and HTML totals as receipt preview. Capture resets zoom and renders the complete document onto a white background, then compresses at JPEG quality 92. 58mm exports are 720 pixels wide, 80mm 1080, A4 1440. Height is bounded to 16,000 pixels and 12 million total pixels to avoid excessive memory use. If a receipt exceeds those bounds, export is refused with a Use Print / PDF message; it is never silently cropped. Existing Print/PDF and Bluetooth raster options remain available.

The share chooser is an explicit user action. External-app delivery, messaging/upload confirmation and receiver compatibility cannot be inferred merely from a chooser opening. JPEG images contain invoice/customer/payment details; review them before sharing. JPEG is a rendered copy, not a database backup.

## Verification

The release workflow is gated on actual APK installation, Fixer Tools branding, MediaStore JPEG save and private JPEG/share chooser creation, plus the existing Owner recovery, barcode, Back/Exit, offline currency sale, receipt, persistence and same-APK reinstall checks. It verifies real JPEG signatures/dimensions, packaged launcher label and the unchanged application ID. The release sample JPEG is generated from a **synthetic emulator invoice**, not real shop data.

Physical ARM phones, external receiving-app delivery, physical Bluetooth/printer output, stable production signing and upgrades from a differently signed prior APK remain pending. Debug signing keys can differ between builds: make a verified external backup before changing installations, and do not uninstall merely to bypass a signature mismatch.

## Actual release results

Published [android-v0.2.0-test.9](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/tag/android-v0.2.0-test.9), artifact source `6888779`, [successful Actions run 39122033913](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/actions/runs/39122033913). All 62 shared tests, TypeScript, desktop workflow and full Android-browser workflow (including 27 layout combinations) passed. Actual installed API35 APK tests passed branding/unchanged app ID, native Gallery JPEG save and share-chooser/private JPEG creation, plus Owner recovery, barcode, Back/Exit/reopening, offline sale/change, preview, force-stop/reinstall persistence and SQLite/package checks.

Downloaded APK: HTTP 200, **10,727,914 bytes**, SHA256 `6f4b8ecdfe2b2aa2a944cabb0702df09eba965c8016fc5a09f4d0cf502640ae1`, matching the checksum and metadata. Debug certificate verified; stable production signing remains pending.

The actual exported [synthetic sample JPEG](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/download/android-v0.2.0-test.9/Fixer-Tools-Sample-Receipt-JPEG.jpg) is **720 × 2384**, 156,170 bytes, SHA256 `8ab8c34f8b34fef2e815d0571e4bb3878391202f3e28b397971f9349551538f8`, matching release metadata. Downloaded and visually inspected: Fixer Tools header, full invoice, Burmese and Thai text, totals, original USD tender, cash received and change are visible. Native test exercised the 58mm export profile; 80mm/A4 exports are implemented but not separately exercised on a physical device. A native share chooser opened with a private JPEG; no receiver was selected and no external message/upload was sent. Receiving-app delivery, physical phone/printer quality and differently signed upgrades remain pending.
