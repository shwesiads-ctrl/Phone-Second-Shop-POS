# Android additions · 0.2.0-android.4

Back at the main POS opens a native Stay / Exit confirmation in English, Burmese and Thai. Stay preserves the current view. Exit removes the task and closes Bluetooth. Unsaved forms/cart are not automatically committed: save or hold the cart before confirming Exit. Back from the receipt Activity returns to the POS; it does not exit the entire app.

Owner Settings → Customization / new feature → Telegram @kominit opens the fixed `https://t.me/kominit` link. No message or business data is sent automatically. Existing About/support links remain available.

## Bluetooth printing

Owner Settings → Bluetooth POS printer:

1. Turn on Bluetooth and pair the printer using Android pairing settings. Android 10/11 discovery also requires location permission and may require the system location switch. Android 12+ requests Nearby devices permissions only after an explicit search/connect action. Denial does not affect ordinary POS operation.
2. Search printers scans for up to 12 seconds, including already paired devices (maximum 50 devices). Bluetooth devices are listed; this is not automatic printer-model detection. Unpaired devices must be paired in system settings before connecting.
3. Select a paired **Classic Bluetooth SPP / ESC-POS** printer and Connect. The connection timeout is 12 seconds. BLE-only printers and proprietary vendor protocols are unsupported. No insecure socket fallback or automatic pairing is used.
4. Select 58mm (384 dots) or 80mm (576 dots), then Test print preview. The fixed test includes English, Burmese, Thai and sample arithmetic; it is marked TEST ONLY and never creates a sale.
5. In the native preview press Bluetooth print. Actual invoices/labels use the same button. The original Android Print / PDF option remains available, including A4. Direct Bluetooth A4 printing is disabled.
6. Unicode text and barcode images are rendered by the bundled-font WebView and sent as monochrome ESC-POS raster strips. The software profiles assume standard 384/576-dot printers; verify the physical printer's printable width and raster support. Long receipts exceeding the 8,000-dot capture bound must use Print / PDF. A write has a 30-second timeout.

A connected socket or a successful send does **not** prove paper output, correct glyphs, printer status or supported commands. There is no paper/status acknowledgement protocol or automatic retry, drawer opening, cut command, silent background printing or reconnection. An error may mean partial output: inspect the printer before repeating a print. Disconnect or Exit closes the socket; no printer address is saved to settings or logs.

**Hardware acceptance remains pending:** real discovery/pairing and permission denial on physical Android 10/11 and 12+; SPP connection/reconnection, out-of-range/power-off and cancellation; 58/80mm Unicode and barcode readability; printer paper-out, long receipt raster output, margins/totals/discount/tender/change; and A4/system print drivers. The emulator cannot prove these. Browser transport substitutes test only UI/control routing and preview HTML.

## Automatic barcodes

New accessories with blank barcode get an internal Code 128 identifier `P2` plus 12 digits, chosen with platform cryptographic randomness and checked against existing barcodes/SKUs inside the stock transaction. Explicit manual barcodes are preserved; duplicate new barcodes are rejected without applying stock/cash changes. No historical record is rewritten.

The inventory form provides Generate barcode buttons for barcode, SKU and phone alternate identifier. Replacing an entered unsaved value asks for confirmation. SKU stays unchanged when generating the barcode field. Existing blank accessory barcodes can be generated from the accessory row; repeating that operation retains the existing barcode. Existing label preview renders Code 128 and QR. These are internal identifiers, not registered GS1/EAN product assignments. Physical scan acceptance is pending.

No database migration or dependency change is needed. The Free Owner policy, one-use recovery and authentication safeguards remain active. This is still a debug-signed test APK; stable production signing, upgrades from differently signed APKs, physical phones and printers remain unverified. Back up externally before changing installations; uninstall deletes app data.

The connection status takes a stable socket snapshot during disconnect/Exit; connection attempts are cancelled by a generation token, and missing system settings or permission/adapter failures return controlled errors. The browser restart test reads the saved authentication guard and waits until its actual persisted retry timestamp; it never clears or weakens login throttling.
