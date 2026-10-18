# Security, privacy and backup

## Trust boundary

The main process owns SQLite. Renderer windows use context isolation, disabled Node integration, sandboxing and a restrictive CSP. Preload exposes only the enumerated `pos.call` operations. Main-process schemas validate all inputs, the handler checks the sender and main frame, and service permissions guard mutations. The renderer receives neither an arbitrary SQL endpoint nor arbitrary filesystem access. A single-instance lock prevents a second UI instance editing the same business database.

Passwords use per-account random salts and scrypt hashes; no production password is supplied. Login failures cause exponentially increasing delays (up to 60 seconds per running instance). Sessions expire after 30 minutes of inactivity and do not persist across application restarts. Owner-only user management and restore remain protected. Owner can set per-operation permission overrides for other accounts. Database audit events record important actions without plaintext passwords or raw report/customer payloads in application error logs.

A Windows administrator or anyone who can replace application binaries or read/write the user-data directory can bypass local controls. This release does not encrypt the SQLite file, rate-limit across process restarts, sign audit records, or provide cloud account recovery. Use Windows account access controls, drive encryption and protected backups. Forgotten owner credentials require an authorized offline recovery procedure; there is no hidden password.

## Local data

Production data is stored in Electron's user-data folder, normally `%APPDATA%\Phone Second Shop POS\business.sqlite` on Windows. Keep this location outside installation folders and update archives. Photos are held in SQLite and included in backups. Do not store device PINs, passwords, payment secrets or unnecessary personal details in notes or photos.

No core operation requires network access. Opening Telegram is an explicit action and does not send a report or verify a payment. Optional report screenshots are selected by the user and shown for review; they are not automatically captured. Diagnostic export includes app version and OS, not business database contents. Report text redacts common password/token/key patterns and 15-digit identifiers; this is a best-effort safeguard, not a substitute for reviewing all attachments and text. Do not include customer data. Reports are exported locally or copied; no submission service is configured.

## Backups and restore

Settings → Back up database uses SQLite's online backup API and validates SQLite integrity, foreign keys, schema version and required tables. Choose a separate folder or external drive. Timestamped default filenames avoid accidental overwrite; rotate backups and protect them as business data.

Owner-only restore validates the selected file and requires confirmation. A timestamped `before-restore-*.sqlite` safety backup is saved in user-data before replacement. Restore logs out all current app access. Older supported backups are validated, copied to a staging file and transactionally migrated before replacement; the selected original backup is never upgraded in place. A genuine schema-7 backup is covered by automated restoration tests. Future schema versions are rejected. Never open a newer-version database with an older application.

Do not copy only `business.sqlite` while the app is running: recent transactions can reside in WAL sidecars. Use the backup feature, or close the app completely before manually copying the database. Uninstall retains business data and backups; delete them only as a separate explicit owner action after verifying an external backup.

## Release review (0.2.0)

Reviewed main-window and receipt/label window sandbox/context isolation/Node settings; enumerated IPC, sender/main-frame checks, Zod validation and role checks; permission denial; navigation/window restrictions; receipt HTML escaping/CSP; CSV formula escaping; backup staging and logging. IPC errors log codes and validation field paths, never raw inputs. No unrestricted SQL/filesystem bridge is exposed. Linux test sandbox flags are confined to headless invocations. Native Windows sandbox behavior still needs acceptance testing.

`npm audit --omit=dev --json`: zero known production advisories at the recorded run. Updated esbuild to 0.28.2 to remove its Windows development-server file-read advisory. Full audit still reports eight moderate build dependency entries tracing to sprintf-js <=1.1.3 via roarr/global-agent/@electron/get/Electron Builder. The registry has no patched sprintf-js version at this run; the audit's proposed Builder downgrade is not a verified repair. Do not automatically downgrade the working packaging toolchain. This is an outstanding release/toolchain risk, not a production dependency clean bill for every development tool. See VALIDATION.md for evidence.

The installer and app are unsigned. See [legitimate code signing](SIGNING.md). Never reuse a cloud proxy TLS certificate as a publisher identity.
