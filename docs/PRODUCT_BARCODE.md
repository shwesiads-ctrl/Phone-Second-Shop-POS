# Product barcode labels

Accessory forms offer one barcode generator on the Barcode field. SKU remains a separate internal reference and is never overwritten by generation. Existing SKU/barcode values and invoice history are preserved; no migration is required. Phone alternate identifiers retain their generator.

Both Android and desktop labels use one Code 128 symbol with its readable identifier, product name and stored selling price/currency. QR output is removed. Accessories use their stored barcode, falling back to legacy SKU only when empty. Phones use the first nonempty IMEI/alternate identifier. Myanmar/Thai bundled fonts, HTML escaping and restrictive CSP apply to labels.

Validation: 78 automated tests passed, including Unicode/escaping, currency precision and SQL identifier fallback; desktop functional workflow passed with one image and populated name/price assertions. Android browser and native APK verification results will be recorded after completion. Physical barcode scanning, Bluetooth printer and paper output remain pending. APK builds remain debug test signed; back up real data externally before changing installations. Do not uninstall to resolve signing conflicts without a verified external backup.
