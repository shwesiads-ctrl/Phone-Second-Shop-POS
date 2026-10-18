# Windows 10/11 x64 installation

## Current separate Windows release

[Download Fixer Tools Windows x64 installer](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/releases/download/v0.2.0-ci.7/Fixer-Tools-Windows-Setup-0.2.0.exe), tag `v0.2.0-ci.7`, source `54b0019`. [Windows Actions run 39150492201](https://github.com/shwesiads-ctrl/Phone-Second-Shop-POS/actions/runs/39150492201) passed in 2m20s: shared tests, native Windows source-app Electron workflow, NSIS packaging, archive integrity and 46 packaged-file comparisons. The full public download returned HTTP200, 116,831,974 bytes. SHA256 `c917d3ba25344a7da2b247a526fa11c77b343b08c3425a0a9c0058298a9d3388` matches the checksum and verification JSON. Both installer/application are unsigned.

Packaged executable launch, clean installation, upgrade/uninstall preservation, SmartScreen observation and physical printing remain pending. A successful build is not installer acceptance. Windows and Android use separate offline databases without automatic sync. Existing internal Windows executable name, app ID and data path remain unchanged.

## Build from source on Windows

Install Node.js 24+ x64 and Git. Use PowerShell in the project folder:

```powershell
npm ci
node node_modules/electron/install.js
npm test
npm run test:desktop
npm run dist:win
Get-ChildItem .\release\*.exe
Get-FileHash '.\release\Fixer-Tools-Windows-Setup-0.2.0.exe' -Algorithm SHA256
```

`dist:win` runs tests and builds before invoking Electron Builder. The expected NSIS output is `release\Fixer-Tools-Windows-Setup-0.2.0.exe`; only a successful command plus an actual nonempty artifact establishes that it was created. `release\win-unpacked` is the unpacked application, not the installer. No portable target is enabled in this release.

An application icon, product name/version and per-user assisted custom NSIS installer are configured. The build hook generates an exact uninstall file manifest. Uninstall removes packaged files and empty app directories only; it never recursively removes user-added files. The installer allows choosing an installation directory and creates standard shortcuts. No code-signing certificate is configured: do not describe an unsigned build as verified by Microsoft or a trusted publisher. Use your organization's signing configuration for a distributed production release; never put signing secrets into source control.

## First installation

On an isolated Windows 10/11 x64 test computer, run the installer, launch the app and create an Owner account. Configure the shop and make a small acceptance-test purchase/sale with clearly labelled test data. Confirm Unicode text in all three languages, IMEI search, receipts, credit payments, return inspection, repair flow and backup/restore. A4, 80mm and 58mm output must be tested with the actual printer driver and paper width. Keyboard-wedge scanners should enter their identifier into Search followed by Enter.

The test suite uses isolated application-data directories even on Windows; it must never modify an installed shop's database.

## Upgrade

1. Close the app after creating and verifying an external database backup.
2. Install the newer build over the existing app, retaining the same product name/app ID.
3. Launch it. Versioned migrations run on the user-data database; the installer does not carry a production database.
4. Compare stock, invoice count and balances to the pre-upgrade backup, then make a new backup.

Never downgrade a migrated database without a compatible backup. Test upgrade paths on a copy before deploying to a shop.

## Uninstall

Use Windows Settings → Apps. `deleteAppDataOnUninstall` is false, so the business database and backups are retained. Verify an external backup before manually removing user data. Reinstall and check the retained records during Windows acceptance testing.

## Mandatory Windows acceptance evidence

- Installer launches on clean Windows 10 and Windows 11 x64.
- Setup, login, permissions and offline workflows run with no Node.js installed on the target.
- Upgrade preserves and migrates sample data; uninstall/reinstall retains it.
- Burmese/Thai/English fonts render on screen and on actual printers.
- Cash drawer reconciliation agrees with printed receipts and manually recorded methods.
- Barcode scanner and receipt printer hardware work with their Windows drivers.

These hardware/OS checks cannot be inferred from the Linux cloud build and remain unverified until performed on Windows.

## Current verification boundary

The 0.2.0 artifact was cross-built on Linux; structural checks are recorded separately from execution. A genuine 0.1.0 schema-7 fixture passes migration/restore tests under Node/Electron, but that does not establish native installer upgrade behavior. No supported Windows runner or VM is attached to this session. Clean install, installed executable launch, uninstall/reinstall, registry/shortcut behavior, UAC and SmartScreen observations are pending.

Run the checklist in [RELEASE_READINESS.md](RELEASE_READINESS.md) on a disposable Windows account. Record OS edition/build, installer SHA256, test time, steps, exact warning text/screenshots and outcome. Check the actual data folder returned by Electron/user profile; installations must not assume a fixed profile or delete any existing shop's data. Run with standard user permissions and no Node.js on the target. Close app processes before upgrading; retain verified external backups. Test both 0.1.0 → 0.2.0 on a copy and reinstalling 0.2.0; compare invoices, tender/source amounts, rate history, stock, photos and reports. After uninstall, check the database and safety backups still exist and a user-added installation file was retained; reinstall and verify login/data again. Unsupported Windows versions should be rejected.

Unsigned-distribution behavior: SmartScreen or unknown-publisher warnings are expected possibilities, but none have been observed in this Linux session. Do not report them as observed or bypass them silently in acceptance evidence. See [SIGNING.md](SIGNING.md).
