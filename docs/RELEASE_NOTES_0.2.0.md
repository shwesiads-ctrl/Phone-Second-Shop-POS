# Phone Second Shop POS 0.2.0 — unsigned test build

Download the `Phone Second Shop POS Setup 0.2.0.exe` asset below for Windows x64. Use the accompanying SHA256 file to verify the downloaded installer. The source-code ZIP is not the installer.

Windows installer ကို download ဆွဲရန် အောက်ရှိ Assets ထဲက `Phone Second Shop POS Setup 0.2.0.exe` ကို ရွေးပါ။ ဤ build သည် unsigned စမ်းသပ်ဗားရှင်းဖြစ်သည်။

This release adds exact MMK/THB/USD conversion, original tender/rate history, source-unit refunds, schema-8 migration, historical balances, atomic exchanges, wholesale pricing and configurable payment methods. Cloud verification passed 49 tests and nine Unicode PDF receipts. See docs/VALIDATION.md for that original cloud evidence and docs/FEATURES.md for remaining product gaps.

This GitHub workflow rebuilds the installer on Windows and publishes only after unit tests, source-app Electron workflow, build and packaged-content verification pass. Its installer bytes/hash may differ from the earlier Linux cross-build; the attached checksum and windows-artifact.json describe the actual attached file. Workflow success is not a clean installation/upgrade/uninstall test.

Release gates still outstanding: actual clean Windows installation, installer upgrade/uninstall data preservation, physical 58mm/80mm/A4 printing and legitimate code signing. SmartScreen/unknown-publisher warnings may occur; none are claimed observed. Eight moderate development/build-tool audit entries remain; the recorded production audit found zero advisories. No signing certificate or publisher verification is claimed. Back up real shop data before testing.

Cloud environment draft publication is separate from this GitHub release and was not performed. Earlier cloud documents saying source was local/unpushed describe the original verification time; GitHub source publication is the subsequent distribution step.
