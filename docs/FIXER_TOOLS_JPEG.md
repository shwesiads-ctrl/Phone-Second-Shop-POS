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
