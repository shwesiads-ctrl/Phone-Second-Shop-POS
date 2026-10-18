# Selected receipt language and mobile menu

Android 0.2.0-android.6 (feature source `9123bd9`) changes narrow-screen navigation to a slide-in side menu. Use the header menu button or swipe right from the left edge; close with a menu selection, close button, backdrop, left swipe, Escape, or Android Back. Back closes an open menu before showing the existing Exit confirmation. Focus stays inside the open menu and returns to its trigger when closed. The wide desktop sidebar remains visible.

Invoice preview/export uses the currently selected language (or the explicit receipt language requested), including native receipt controls and printer-test labels. Generated labels no longer contain combined Myanmar/Thai/English samples. Customer-entered shop/product/customer text remains unchanged, including mixed-language names; historical invoice amounts and settings snapshots are not rewritten. JPEG/print captures the same localized receipt document. No schema migration or application-ID change is needed.

## Checks

- Local TypeScript and desktop workflow passed.
- 68 local automated tests passed, including selected-language invoice labels in all three languages and 58mm/80mm printer-test labels.
- Full Android-browser workflow passed all 27 layout combinations (360/420/760px × three languages × three pages), Owner recovery, barcode/printer transport mock and currency/persistence checks. A separate 412px probe passed all nine language/page combinations.
- Native APK release `android-v0.2.0-test.12`, source `7524338`, passed [API35 workflow 39124424300](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/actions/runs/39124424300) in 5m32s. Actual installation, all three language layouts, Owner recovery, barcode, current-language native receipt controls, JPEG save/share chooser, drawer Back handling before Exit confirmation, offline foreign-tender sale/change, reopening, same-APK reinstall and SQLite/package checks passed. No external share receiver was selected.
- Earlier runs: 39123716496 failed during layout testing and optional screenshot capture masked the original error. 39124013378 exposed a test-helper race after login. Recording errors before screenshots and waiting for mounted navigation corrected the harness; the complete subsequent native run passed.
- Physical Android devices, Bluetooth printer output, receiving-app delivery, stable production signing and upgrades from different debug signing keys remain pending. Back up externally before upgrading; do not uninstall to bypass a signing mismatch.

## Download verification

Published [android-v0.2.0-test.12](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/tag/android-v0.2.0-test.12). The full public APK download returned HTTP 200: **10,733,147 bytes**, SHA256 `b4015194ad3d8c2a77cee9fc7a4408e07ae488116e413036e49e5ea733865ad8`, matching both the attached checksum and verification JSON.

The downloaded synthetic JPEG is **720×2496**, 156,768 bytes, SHA256 `36ed6e316533bfbacc99fcf0e3c93a5f7430ddea1e5c4ba75a1b7a174e0beab3`, matching metadata. Visually inspected: Burmese generated labels, full invoice/payment/change details, original mixed-language product name, no bottom truncation. The opened side menu was also visually inspected in the browser. Swipe gestures, physical phone/printer output and external share delivery were not manually verified on hardware.
