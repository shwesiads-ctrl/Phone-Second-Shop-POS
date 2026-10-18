# Free Owner Android edition

Android 0.2.0-android.3 is free: no subscription, activation key, trial expiration, advertising SDK, or purchase-to-unlock screen. A recovery key is for account recovery, not licensing. Desktop retains its existing multi-role workflow; Android enforces the Owner edition in ShopService, including direct bridge requests.

Only the earliest active Owner account can log in to the Android edition. The Users/role-management screen is removed, and user creation and permission overrides are rejected by the service. Existing staff/other-owner rows are retained for audit and transaction history; they cannot log in on Android. Shop settings are available to that Owner. Existing stock, payments, invoices, refunds and exchange-rate history remain intact.

## Recovery

1. Log in as Owner. Open Settings → Owner security settings.
2. Enter the current password and choose Create / replace recovery key.
3. Privately save the displayed key outside the phone/app, together with the Owner username. It is shown only in the immediate response; it cannot be retrieved later. Select the hide button after saving.
4. If the password is lost, choose Forgot password? on the login screen, enter the username, recovery key and a new password of at least 10 characters.
5. Log in with the new password, then generate and save a fresh key. A successful recovery consumes the old key and does not automatically log in.

Keys contain 256 random bits from the platform cryptographic generator. The database stores only a separately salted scrypt hash. Rotation invalidates the previous key. Authenticated rotation requires password reauthentication. Keys and passwords are not written to audit details or diagnostics; automated key tests do not include secret screenshots or logs. A displayed key is cleared when navigating away, logging out, performing another operation or hiding the app tab. Anyone possessing the key and username can reset the password; keep both safe.

Login, recovery, key generation and password changes share a persistent database-backed exponential failure delay (1–60 seconds). Restarting the app does not clear it. Unknown usernames and invalid/used keys produce the same generic login failure. Invalid requests are schema-validated. Password recovery is atomic with key consumption and the audit event. Active sessions recheck credentials, role and active status; password resets invalidate prior sessions. Logged-out status returns UI language, not shop settings.

There is no developer/master backdoor or online recovery service. Losing both password and recovery key cannot be solved by this offline feature. A database backup includes credential hashes and the recovery state as of that backup. Restoring it may revive a previously consumed/replaced key and old password: after any restore, log in using that backup's credentials and immediately change the password and rotate the key.

## Migration, security boundary and release limits

Schema 9 adds `owner_recovery` and `auth_guard`, without rewriting transactions or removing historical user rows. Schema 7/8 backups migrate on a copy; current schema-9 backups require this version or newer. An older Windows/Android build that only supports schema 8 cannot read a new schema-9 backup. Keep a pre-upgrade external backup.

Android private storage and bundled WebView/validated bridge are used. The business database and exported backups are **not encrypted at rest** by the app. Local role checks do not protect against a rooted device, malicious modified APK, compromised OS or a person who can directly replace/edit the database. Use device screen lock, private backups and a trusted installer. No claim of complete security or an independent penetration test is made.

This remains a debug-signed test APK. CI debug keys can differ between releases; same-APK reinstall tests do not prove that upgrading from an earlier APK will work. Export and verify an external backup before changing installs. Do not uninstall to work around a signature mismatch without a proven restore path: Android uninstall deletes private data. Stable legitimate production signing, physical ARM-device/picker acceptance and physical printing remain outstanding.

## Validation for this change

The 57 automated shared tests include eight new security cases: forbidden staff/user operations, password-authorized Owner-only rotation, salted key storage/redacted audit, rotation and one-use recovery, persisted login/recovery delay, atomic rollback, session invalidation/disabled accounts, logged-out settings privacy, and malformed password hashes (some cases are grouped within tests). TypeScript and desktop Electron setup/purchase/sale/receipt/backup/restore checks passed. Android browser and actual APK emulator evidence is reported in the release verification.

A current full dependency audit reports 11 moderate advisories and zero high/critical. These known build-tool advisories remain outstanding; this change does not represent an independent security audit or resolve every dependency finding.
