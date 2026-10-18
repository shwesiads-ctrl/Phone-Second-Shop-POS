# Phone Second Shop POS — Android test APK

Download `Phone-Second-Shop-POS-Android-0.2.0-test.apk` from the release Assets. Android 10 or later with a current Android System WebView is required. This is an offline Android app using the existing POS business rules, not a connection to your Windows database.

Android APK ကို Assets ထဲက `.apk` ဖိုင်မှ download ဆွဲပါ။ Android 10 နှင့်အထက် လိုအပ်ပါသည်။ စမ်းသပ်ဗားရှင်း ဖြစ်ပါသည်။

The APK uses Android's standard **debug test signing certificate**, not a production publisher key or Play Store release identity. A fresh CI build may have a different test key. Do not uninstall an existing shop installation to bypass a signing mismatch without an external verified backup: **Android uninstall deletes app data**. A legitimate stable release key is required for production updates.

Supported workflows reuse the desktop service: first Owner/login/roles, phones and IMEI, purchases, accessories, checkout, approved MMK/THB/USD rates, payments/change/refunds, trade-ins, repairs/warranty, cashbook and reports. Android adds private atomic SQLite-file persistence, native document-picker backup/restore/CSV/report export, image selection, receipt preview and Android system Print/Save as PDF. No live Windows/Android synchronization or payment-provider verification is provided.

The release workflow must pass shared tests, Android build/signature checks and installation/workflow/persistence tests on an Android API35 x86_64 emulator before publication. Check the attached `apk-verification.json` and workflow for actual results. The native SAF picker workflows, print-service compatibility, physical ARM phones and Bluetooth/USB thermal printer output require further device acceptance; do not infer physical printing success from emulator preview.

Storage uses offline SQLite WASM with the exact same versioned schema. Desktop SQLite backups are interoperable at schema 8; older supported files migrate on a copy. Database size is capped at 32 MiB in this test version, photos at 5 MB each; larger shops require a scalable native SQLite storage implementation. Before restore, an external safety backup must be saved. Android automatic OS backup is disabled; make manual backups outside app storage. Records are not encrypted at rest by this application; protect the phone and exported backups.

This is a separate test app ID (`com.myominaung.phonesecondshoppos.mobile`). No production account, cloud secret, advertising SDK or automatic business-data upload is included. The native bridge only accesses its fixed private database and files explicitly chosen through Android document pickers. Capacitor payload logging is disabled. The WebView uses only bundled assets; release credentials and physical device testing remain outstanding.
