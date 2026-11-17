# Security, backup and sync spec (PLAN phase 5)

Date: 2026-11-17. Status: DESIGN ONLY. No code, no rule change, no network service is added by this file.
Basis: code on branch dev (HEAD f554996), docs/PLAN.md, AGENTS.md, docs/SYNTHESIS.md, docs/DECISIONS-LOG.md, docs/PROGRESS.md, docs/v1.2/KEY-SWITCH.md, plus web sources read on 2026-11-17 (cited inline). Anything I could not confirm is marked NOT VERIFIED.

## 0. Short version

1. Today the app lock is a screen gate. It does not encrypt the database. A lost phone with no exported file loses all data.
2. The biggest real-world risk is not an attacker. It is losing the phone with no backup. Fix that first.
3. Android Auto Backup is switched on in the manifest but the rules in the build include only shared preferences, so the database is NOT in Google's backup today (section 2.4).
4. Do not add SQLCipher now. The gain is small for the personas, the migration risk to real data is real, and size and speed on old phones are unmeasured.
5. Build, with no rule change: hardening fixes, encrypted backup files, CSV export, automatic local backups (section 7A).
6. The simplest "survive a lost phone" design with no Khoroch server and no Khoroch account is Android Auto Backup of the database with a client-side-encryption requirement, plus the exported encrypted file. It needs a device test before anyone relies on it (section 5.3).
7. Cloud sync across devices is a different product. It needs the owner to lift AGENTS.md rule 8 and it needs a conflict design. Do not start it.

## 1. Threat model

### 1.1 Who we protect against, and who we do not

| Actor | In scope? | What we can honestly promise |
|---|---|---|
| Someone who picks up the unlocked phone (child, colleague, a quick look) | Yes | App lock with PIN or fingerprint, lock on background timeout, hidden amounts on open, no screenshots or recents preview while lock is on |
| Family member who knows the phone's own screen PIN | Yes, partly | Only if the Khoroch PIN differs from the phone PIN. We cannot enforce that. Fingerprint on the phone may also match a relative's finger if they enrolled it; Khoroch biometric unlock turns itself off when fingerprints change (design in appLock.ts) |
| Lost or stolen phone, powered off or locked | Partly | Android's own storage encryption plus screen lock. Khoroch adds nothing at rest today |
| Lost or stolen phone, thief gets past the screen lock | Partly | App lock slows a casual thief. A skilled one with the unlocked phone can read the database file only on a debug or rooted device, otherwise the app sandbox protects it |
| Repair shop (phone handed over, often with PIN given) | Weak | Treat as "unlocked phone". App lock helps only if the shop does not know the Khoroch PIN. Advice in the app: export a file, then use "Erase all data" before handing over the phone |
| Malicious app on the same phone | Mostly | Android app sandbox. Nothing in Khoroch can stop a rooted phone or a device-admin or accessibility-service malware. Out of scope beyond the sandbox |
| Cloud provider (Google, Supabase and so on) | Today: not applicable, no cloud. If sync is built: yes | Only end-to-end encryption with a key the provider never sees makes this true |
| Government, forensic tools with physical access and unlock exploits | No | Not promised |
| The owner forgetting the PIN or passphrase | Yes (availability) | Forgot-PIN erases all data today. Backup is the recovery path |

### 1.2 What each existing control does, per actor

Legend: Y = effective, P = partial, N = no effect.

| Control (where) | Unlocked phone, casual | Family knows phone PIN | Lost phone, locked | Repair shop | Malicious app | Cloud |
|---|---|---|---|---|---|---|
| PIN gate with back-off (src/security/appLock.ts, pin.ts) | Y | Y if PIN differs | P | P | N | n/a |
| Fingerprint or face via a biometric-protected secret (appLock.ts, biometrics.ts) | Y | P | P | P | N | n/a |
| Lock after background timeout 0, 1, 5 or 15 min (pin.ts TIMEOUT_CHOICES_SEC, LockGate.tsx) | Y | Y | n/a | P | N | n/a |
| Screenshot, recording and recents-preview block while lock is on (screenCapture.ts) | Y | Y | n/a | P | P | n/a |
| Cover view when app leaves the foreground (LockGate.tsx) | Y | Y | n/a | Y | N | n/a |
| PIN hash in Keystore-backed secure store, never in SQLite or backups (appLock.ts) | n/a | n/a | Y | Y | Y | Y |
| Restore never turns lock or privacy settings off (backup.ts restoreBackupPayload) | Y | Y | n/a | Y | n/a | n/a |
| Lock-screen notifications carry no amounts; bill names hidden when lock is on (AGENTS section 5, DECISIONS-LOG) | Y | Y | Y | Y | N | n/a |
| Android storage encryption (OS, not Khoroch) | N | N | Y if screen lock set | N | N | n/a |
| Android sandbox (OS) | n/a | n/a | n/a | n/a | Y | n/a |

### 1.3 Honest gaps

- The PIN is not an encryption key. The database file budget.db is plain SQLite. The lock is enforced by app code. Anything that reads the file (debug build over adb, a rooted phone, a forensic image of an unlocked phone) bypasses it.
- A 4 to 6 digit PIN has at most 1,000,000 values (comment in pin.ts says so). Protection rests on the attempt limit and on the PIN record living in the Keystore-backed store, not on hashing cost.
- Backup files are plain JSON, readable by anyone who gets the file (WhatsApp forward, a shared Downloads folder, a repair shop copying files).
- Forgot-PIN means erase everything (LockScreen.tsx onForgot, LockGate.tsx handleEraseAll, typed confirmation). This is safe against a thief and brutal for the owner without a backup.
- No tamper check on a backup. Anyone can edit a plain file. Validation checks shape and references, not authorship.
- If a device has no screen lock, Android storage encryption gives little protection. We cannot detect this reliably (NOT VERIFIED whether expo-secure-store exposes it).

## 2. Current state (what exists and works, with paths)

### 2.1 App lock, as built

All on branch dev. Reviewed three times. Third review: PASS on code. NOT VERIFIED on a device: the fingerprint path, the since-boot clock path, the top-window fix, every lock screen (docs/PROGRESS.md, 2026-11-17 entries).

| Piece | File | What it does |
|---|---|---|
| PIN format and hashing | src/security/pin.ts | 4 to 6 digits. Salted, iterated SHA-256 (100 rounds, each one awaited native call so the JS thread is not blocked). Round count stored with the hash; older 2,000-round hashes re-hash on unlock. Constant-time compare |
| Back-off | pin.ts | 5 free attempts, then 30 s, doubling, capped at 3,600 s |
| Credential and attempt state | src/security/appLock.ts | Stored only in expo-secure-store (Android Keystore backed): keys khoroch_lock_credential, khoroch_lock_attempts, khoroch_lock_biometric, khoroch_lock_biometric_secret. Attempt is counted and written before the PIN is checked, so killing the app mid-check does not dodge it. A failed storage read never counts as "no lock" |
| Wait clock | src/security/elapsedRealtime.ts | Android SystemClock.elapsedRealtime through a native method on the FinanceCapture module. Survives sleep, cannot be moved by the user. After a reboot the value is smaller than the stored one, so the full wait restarts |
| Biometric | src/security/biometrics.ts, appLock.ts | Unlock reads a random 32-byte secret stored with authentication required (strong biometric). The system destroys the secret when a fingerprint or face is enrolled; the app then turns biometric off and asks for the PIN. It never trusts a yes/no prompt result |
| Screenshot block | src/security/screenCapture.ts | expo-screen-capture secure flag while lock is on or may be on |
| Gate | src/ui/LockGate.tsx, LockScreen.tsx, src/state/LockContext.tsx | App is not mounted until unlocked on cold start. Modal lock after timeout. Cover modal when backgrounded. Failed secure-store read keeps the app locked with Retry; after a failed Retry the erase path is offered |
| Settings UI | src/ui/AppLockSettings.tsx | Turn on, change, timeout, biometric |
| Erase all | src/data/deleteAll.ts, sqliteRepo.ts deleteAllData | Deletes all rows in one transaction, reseeds categories, checkpoints WAL, VACUUM, cancels reminders, clears the secure store entries |

Decisions recorded in docs/DECISIONS-LOG.md (2026-11-17): PIN, hash, salt and attempt counter live in secure storage only, never in SQLite or backups; app lock being on forces "Hide bill names"; restore may turn privacy settings on but never off (hideAmountsOnOpen, billReminders.hideNames); app lock keys are always kept from the device on restore.

Lock is off by default (repo.ts DEFAULT_SETTINGS appLockEnabled: false).

### 2.2 What three security reviews concluded

- Round 3: PASS on code. Not run on a device.
- Known limits the owner has accepted so far:
  1. A debug build's data can be read over adb regardless of the lock. This applies to the dev app. A release build is not debuggable (AGENTS.md section 6 says so).
  2. The wrong-PIN wait restarts in full after a reboot (the since-boot clock resets). This makes the wait longer, not shorter. The attempt counter itself survives.
  3. Forgot-PIN erases all data.
  4. Backups are plain files.
- Earlier round limit, fixed in rounds 2 and 3: moving the clock forward and restarting the app used to shorten the wait.

### 2.3 Backup format, as built (schema 7)

Files: src/data/backup.ts (1,263 lines), src/data/backupFiles.ts, migrations in src/data/migrations.ts (LATEST_SCHEMA_VERSION 7).

- File name: khoroch-backup-YYYY-MM-DD.json. Content: `{ app: "khoroch", schema: 7, exportedAt, data: { categories, accounts, transfers, people, due_entries, recurring_bills, transactions, budgets, settings, day_reviews } }`. Pretty-printed JSON, UTF-8.
- Accepted app ids on import: khoroch, budget-app, lenden.
- Size limit 20 MB (MAX_BACKUP_BYTES), checked on the picked file size and on the text length.
- Validation (parseAndValidateBackup): valid JSON; app id; integer schema at least 1; a schema higher than 7 is refused with "Made by a newer version (schema N). Update Khoroch before restoring this file."; every row is validated by the same domain validators the app uses (amounts are integers within MAX_AMOUNT_MINOR, dates are real dates, currency valid, enums valid); duplicate ids rejected; foreign references must resolve (a transaction pointing at a missing account, category or transfer is rejected, a due pointing at a missing person is rejected); budgets keyed by period and category, no duplicates; settings validated field by field.
- Older schemas 1 to 6 are imported and migrated forward in memory (for example schema 1 icons, a missing fees category, missing people).
- Cleaning on import: unused duplicate wallets are dropped; invalid recurring bills are skipped silently (rows without a valid id, name or amount are dropped, not rejected, which is looser than every other table).
- What is deliberately not exported: dailyWageLast (device-local ids), the PIN and attempt state (secure store), notification ids (explicit settings allow-list in sanitizeSettingsForExport).
- What a restore keeps from the device: appLockEnabled, appLockTimeoutSec, hideAmountsOnOpen when true, billReminders.hideNames when true, and the local dailyWageLast ids that still exist as live entries dated today.
- Restore is one SQLite transaction (sqliteRepo.ts replaceAllDataFromBackup, withTransactionAsync): all old rows deleted and the file's rows inserted, or nothing changes. There is no automatic safety copy of the old data before it is replaced. (Gap, see 2.5.)
- What a restore refuses: not JSON, wrong app id, bad or newer schema, over 20 MB, any invalid or dangling row.
- Sharing: shareBackupFile writes the JSON to the cache directory and opens the system share sheet; the cache file is not deleted afterwards (read from code; gap, see 2.5). saveBackupToDeviceFolder uses the Android Storage Access Framework, so the user picks the folder every time.

### 2.4 How the database is opened, and what Android backs up today

- Opened with `SQLite.openDatabaseAsync('budget.db')` in src/data/db.ts, then runMigrations (WAL mode, foreign keys on). No key, no PRAGMA key. expo-sqlite stores it in the app's files directory under SQLite/ (SQLiteModule.kt defaultDatabaseDirectory = filesDir + /SQLite).
- Migrations are additive in practice (ALTER TABLE ADD COLUMN guarded by PRAGMA table_info, CREATE TABLE IF NOT EXISTS), each in a transaction, version tracked by PRAGMA user_version. Version 5 turns foreign keys off for a table change; that is already shipped.
- app.config.ts uses plugins expo-sqlite (no options), expo-secure-store, expo-local-authentication and ./plugins/withFinanceCapture. It sets no allowBackup option.
- The generated manifest (android/app/src/main/AndroidManifest.xml, prebuilt for the dev variant on 2026-11-17; prod differs by package name only) has `android:allowBackup="true"`, `android:fullBackupContent="@xml/secure_store_backup_rules"` and `android:dataExtractionRules="@xml/secure_store_data_extraction_rules"`. Those two files come from the expo-secure-store package (node_modules/expo-secure-store/android/src/main/res/xml). Both say: include domain sharedpref, exclude sharedpref/SecureStore, for cloud backup and device-transfer.
- Android doc, read 2026-11-17 (https://developer.android.com/identity/data/autobackup): "If you specify an `<include>` element, the system no longer includes any files by default and backs up only the files specified." So the effective result is: Google cloud backup and device-to-device transfer carry shared preferences only. budget.db (files/SQLite/) is NOT included. This is my reading of the doc applied to the generated files. NOT VERIFIED on a device (test: `adb shell bmgr` on the dev app, section 7A task H5).
- Consequence: a new phone restored from a Google backup comes up with an empty Khoroch. The only recovery is an exported file.
- Android doc facts used above: Auto Backup works for apps targeting Android 6 or higher; up to 25 MB per app user; only the latest backup kept; runs about daily when idle and on Wi-Fi with backup enabled; end-to-end encrypted with the screen lock on Android 9 or higher; apps targeting Android 12 or higher use dataExtractionRules; `clientSideEncryption` and `deviceToDeviceTransfer` flags are available on Android 9 or higher in the Android 11-and-lower rules, and `disableIfNoEncryptionCapabilities` in the Android 12-and-higher `cloud-backup` section. Same URL, read 2026-11-17.

### 2.5 Remaining weaknesses, ranked by real-world likelihood for the personas

| Rank | Weakness | Who it hits | Fix in this spec |
|---|---|---|---|
| 1 | Lost, broken or reset phone with no exported file means total data loss. Google backup excludes the database (2.4). | Everyone, especially persona 1 and 2 (cheap phones, frequent loss and repair) | Auto local backups, Auto Backup rules, encrypted backup file |
| 2 | Plain backup file lands in Downloads, WhatsApp or Drive and is read by others | Anyone who shares a file to "keep it safe" | Encrypted backup file |
| 3 | Khoroch PIN equal to the phone PIN, so family who know one know both | Households with shared PINs | Setup hint only; cannot enforce |
| 4 | Repair shop sees the unlocked phone | Persona 1, 2 | Hand-over advice plus "export then erase" |
| 5 | Restore replaces everything with no automatic copy of what was there. A wrong file (older, other person's) overwrites newer data. | Careless restore | Pre-restore snapshot, preview already shows counts and date range |
| 6 | Cache copy of the shared backup stays on the phone | Anyone who shares a backup | Delete after share |
| 7 | pending_drafts (captured SMS and notification drafts) is not in the backup, and a restore deletes the table (sqliteRepo.ts replaceAllDataFromBackup starts with DELETE FROM pending_drafts). Unreviewed inbox items are lost on restore. | Capture users | Decide in H3 (read code first; not confirmed which side effects follow) |
| 8 | Forgot-PIN erases everything | Owner forgets PIN | Tie to backup: warn before turning the lock on if no backup exists |
| 9 | Debug build readable over adb | Dev app only | Accepted; never put real data in the dev app |
| 10 | Wrong-PIN wait restarts on reboot | Nobody useful to an attacker | Accepted |
| 11 | recurring_bills validation drops invalid rows silently instead of rejecting | Edited files | Reject with a count in the preview (small) |

## 3. Local encryption

### 3.1 What Android already does, exactly

Source: https://source.android.com/docs/security/features/encryption/file-based, read 2026-11-17.
- File-based encryption (FBE) exists from Android 7.0. "All devices launching with Android 10 and higher are required to use file-based encryption."
- App data sits in credential-encrypted storage by default, usable after the user unlocks the device after boot.
- Full-disk encryption (FDE) is the older scheme. The page presents it as the predecessor.

What that means for Khoroch's phone range (minSdk 24, Android 7 and up):
- Android 10 and later phones: FBE. With a screen lock set, files are unreadable until the first unlock after boot. After that, any process or tool with the user's access reads them. FBE does not stop someone who has the unlocked phone, and does not hide data from the app's own backups or from `adb` on a debuggable build.
- Android 7 to 9 phones: either FBE or FDE depending on how the device launched and was upgraded. Which one a given phone uses I cannot say. NOT VERIFIED per device; the app cannot reliably read it (NOT VERIFIED whether a safe API exists). Some budget phones in this age range may have no screen lock set at all, in which case storage encryption protects little. I did not find a source for the share of Bangladeshi phones with no screen lock: NOT VERIFIED.
- Plain truth: on every Android version, "encryption at rest" in the OS protects a switched-off or freshly rebooted, screen-locked phone. It does not protect against a thief who gets past the screen lock, against the person holding an unlocked phone, or against a repair shop that is told the PIN.

### 3.2 Options

| Option | What it protects | Cost | Risk to real data | Verdict |
|---|---|---|---|---|
| A. Nothing extra, rely on OS storage encryption plus app lock | Powered-off locked phone (OS). Casual look (app lock) | Zero | None | Baseline. Keep |
| B. SQLCipher for budget.db | A copy of the database file taken without the key (a forensic image of an unlocked phone does not help the attacker if the key is Keystore-bound and the app is closed; a rooted-phone read of the file does not reveal data without the key) | Native library swap (see below); migration of live data; key management; every future migration runs on the encrypted file | Highest of the three: a one-way file conversion on real data | Not now |
| C. Encrypt backup files only | A backup file that leaves the phone | Small; pure new code around existing export | None to live data (it reads, never writes the live DB) | Do now (section 4) |

SQLCipher facts, read 2026-11-17 from https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/:
- Config plugin option `useSQLCipher` on the expo-sqlite plugin, default false, then `npx expo prebuild`. Supported on Android, iOS and macOS. Not in Expo Go.
- The key is set with `PRAGMA key = 'password'` right after opening. `PRAGMA cipher_version` returns a row only when SQLCipher is present.
- Dangerous behaviour, quoted: "If the app binary does not include SQLCipher, `PRAGMA key` has no effect and does not throw an error." The database is then stored unencrypted. So a build that lost the option would silently keep or create plain data. Any migration must check `cipher_version` and abort if it is empty.
- The doc says nothing about APK size or speed. NOT VERIFIED: size increase, startup cost, query speed on a 2 GB Android 7 phone. The local package node_modules/expo-sqlite/vendor/sqlcipher is 10 MB of source (source size, not APK size). Our release APK is 121 MB debug-signed all-ABI today (android/app/build/outputs/apk/debug/app-debug.apk, 121,038,292 bytes); the budget in docs/PLAN.md is under 40 MB per device. SQLCipher cost has to be measured on a real build before any decision. NOT VERIFIED.
- Mixed-mode risk: expo-sqlite uses one native library for the whole app. Turning SQLCipher on changes the library for every database the app opens.

### 3.3 If SQLCipher is ever built: migration that cannot lose data

Do not convert in place. Never run `sqlcipher_export` over the only copy.
1. Preconditions: dev app first, never the owner's app until proven. A verified backup file exists (the app writes one and re-reads and validates it with parseAndValidateBackup before going on).
2. Open the plain budget.db (read). `PRAGMA wal_checkpoint(TRUNCATE)`.
3. Create a new file budget-enc.db. Open with `PRAGMA key`. Check `PRAGMA cipher_version` is non-empty, else abort.
4. Copy all tables (SQLCipher export or table-by-table INSERT inside one transaction). Set the same PRAGMA user_version.
5. Verify: row counts per table equal; the sum of amount_minor over transactions and transfers equal; `PRAGMA integrity_check` returns ok on the new file; run the app's own computeAccountBalance totals on both and compare. Any mismatch aborts and deletes only the new file.
6. Swap: record "migration pending" in a small file, rename budget.db to budget-plain-old.db, rename budget-enc.db to budget.db, reopen with the key, run a read check. If the check fails, rename back.
7. Keep budget-plain-old.db for N days (suggest 14) and for at least until a successful export from the encrypted DB has been validated. Only then delete it with an overwrite pass and VACUUM-free removal. Say in the UI that a copy exists until then, because the point of encryption is lost while it does.
8. Crash safety: the state file tells the next start which step it was in; on start, if both files exist and the state says "swap pending", finish or roll back. Never delete either file at start without the verify step.
9. Android Auto Backup: the encrypted file is useless on a new phone without the key (see 3.4). Keep it out of cloud backup, or accept that restored files need the exported-backup path.

### 3.4 Key management (only if option B is built)

| Event | Design |
|---|---|
| Key creation | 32 random bytes from expo-crypto getRandomBytes, stored with expo-secure-store (Keystore-backed) without per-use authentication, so the app can open its database at boot (a fingerprint prompt before every database open is not workable; the existing lock gate already guards the UI) |
| Is the key derived from the PIN? | No. A 4 to 6 digit PIN would make offline guessing trivial and forgot-PIN would destroy the data permanently. Keystore-bound random key instead |
| Forgot-PIN | Today: erase all (database and key). With option B the same: key deleted, file unreadable. Recovery is a backup file |
| New phone | The key does not travel (excluded from Auto Backup by expo-secure-store rules, 2.4). Restore from an exported backup file. This is correct and must be shown plainly |
| Biometric change | The biometric secret (not the database key) is invalidated by Android. The PIN still unlocks. Database key unaffected |
| Keystore failure or lost key | App cannot open the database. LockGate already has a failed-read path with Retry and a typed erase. With option B it needs a "restore from backup file" button on that screen. Without a backup the data is gone |
| Device without a working Keystore (some old budget phones; NOT VERIFIED how common) | isAppLockSupported already handles "not supported"; option B would have to refuse to enable |

### 3.5 Recommendation

Do option C now. Keep option A. Do not build option B in v1.2 or in the next build cycle. Revisit option B only if (a) the owner decides to ship Business Ledger v2 with other people's data, or (b) a device measurement shows acceptable size and speed on a 2 GB Android 7 phone. Reason: for the personas, the likely loss is the phone, not a forensic read; option B adds a one-way change to the owner's irreplaceable data and an unmeasured cost on the weakest phones.

## 4. Backup and export

### 4.1 Encrypted backup file

Goal: the same schema-7 payload, sealed so a copied file is useless without a secret.

Primitives already in the project: expo-crypto ~58.0.8 ships native AES-GCM (aesEncryptAsync, aesDecryptAsync, AESEncryptionKey with generate and import, node_modules/expo-crypto/build/aes) and getRandomBytes. It has no PBKDF2, scrypt or Argon2 (digestStringAsync only). I read the type declarations; I did not run it. NOT VERIFIED on a device.

Two secret designs:

| Design | How | KDF needed | Forgot-it outcome | Fit |
|---|---|---|---|---|
| R. Generated recovery key | App creates 128 bits or more of random, shows it once as grouped base32 (about 26 characters), user writes or screenshots it into a safe place. File key = that value, used directly or via one HKDF-style hash step | No heavy KDF, because the secret is already high-entropy | File is unrecoverable. Same as any lost key | Best for this app: no new native library, no weak-passphrase risk, works on slow phones |
| P. User passphrase | User types a phrase, app stretches it | Yes: PBKDF2-HMAC-SHA256, scrypt or Argon2id | Unrecoverable | Needs a new library. Weak passphrases ("khoroch123") undermine it |

Recommendation: ship R first (task E2). Offer P later only after a KDF library is measured on the weakest phone.

KDF parameters if P is built (my engineering judgement, NOT VERIFIED on any device; confirm against current OWASP guidance before use):
- Prefer Argon2id or scrypt with memory 16 to 32 MB on a 2 GB phone, tuned so one derivation takes about 0.5 to 1.5 s on the slowest test phone. If only PBKDF2 is available, use HMAC-SHA256 with a high iteration count (hundreds of thousands) measured the same way.
- Doing this through the current digestStringAsync loop (one bridge call per hash) is too slow and is not recommended. A native implementation or a measured pure-JS library is required. Candidates I did not verify on Expo SDK 58 / RN 0.88: react-native-quick-crypto (native, dev build), @noble/hashes (pure JS, speed on Hermes unknown). NOT VERIFIED.
- Random 16-byte salt per file, stored in the header. Parameters stored in the header so they can be raised later.

File format (versioned, plain schema-7 files stay importable):

```
{
  "app": "khoroch",
  "envelope": 1,
  "kind": "encrypted-backup",
  "cipher": "AES-256-GCM",
  "kdf": { "type": "recovery-key" },           // later: { "type":"argon2id", "salt":"b64", "m":.., "t":.., "p":.. }
  "keyCheck": "b64",                           // lets the app say "wrong key" before decrypting everything
  "nonce": "b64",                              // 12 random bytes, never reused with a key
  "innerSchema": 7,                            // copy of the schema inside, readable without the key
  "exportedAt": "ISO",
  "ciphertext": "b64"                          // GCM output incl. tag over the exact UTF-8 bytes of today's plain JSON
}
```

Rules:
- The plaintext is exactly today's `{ app, schema, exportedAt, data }` JSON, so one validator serves both. Decrypt, then run parseAndValidateBackup unchanged. GCM authentication means a flipped bit fails before validation.
- Detection order on import: parse JSON; if `envelope` is present, take the encrypted path; otherwise the plain path as today. A plain schema-7 file never has an `envelope` key, so there is no ambiguity.
- The 20 MB limit applies to the file and to the decrypted text.
- The outer header carries `innerSchema` so a build that is too old can say "Made by a newer version" without the key. An old build (including the owner's main app today) that does not know `envelope` will say the schema is invalid. Acceptable and honest.
- Wrong key: "That key does not open this file", no hint about which byte failed.
- Unknown `cipher` or `kdf.type`: refuse with the version message. Never guess.
- Forgotten key: the file cannot be opened. State this in the export sheet before the user continues, and make "Export without a key" an explicit second choice (plain file, as today), with a line that anyone who gets the file can read it.
- Sensitive memory: the plaintext string and key live in JS memory during export and import; there is no way to wipe a JS string. Accepted.

### 4.2 Automatic local backups

| Question | Design |
|---|---|
| Where | App-private storage first (Paths.document or a Backups folder under the app's files directory, not the cache, since cache is excluded from Auto Backup and may be cleared by the system). Never to a shared folder without consent |
| Shared folder | Only after the user picks a folder once through the system folder picker (the code already uses StorageAccessFramework.requestDirectoryPermissionsAsync in backupFiles.ts). Whether the permission can be kept across app restarts with expo-file-system v58 is NOT VERIFIED; task A3 must check first |
| When | After a change, at most once a day (trigger on app foreground if the last backup is older than 24 hours and data changed). No background service, no exact alarms, no network |
| How many | Keep the 7 newest daily and 4 newest weekly (rolling). Size: today's 3-transaction file is 7,514 bytes (docs/PROGRESS.md Phase 14). At roughly 300 bytes per transaction (my estimate, ASSUMPTION), 5,000 transactions is about 1.5 MB, so 11 copies is under 20 MB. Check actual size on the dev app |
| Encrypted? | Yes, with the recovery key from 4.1 if the user set one; otherwise stored plain in private storage, which is no worse than the database itself. Say which in Settings |
| Before restore | Always write a "pre-restore" copy first and keep the last 3. If the restore throws, tell the user the copy is there |
| Before migrations | Before runMigrations raises the schema on a real phone, write a copy of the last good state (dev first). Today migrations are additive and tested on v1-shaped data; this is a second net |
| Dies with | App uninstall and "clear data" remove private storage. State this plainly. Auto local backups protect against mistakes and bad updates, not against a lost phone |

### 4.3 Export for humans (CSV)

- One file per table the user would open in Excel: Transactions (main), optionally Transfers, People dues, Wallets.
- Encoding UTF-8 with a byte-order mark (EF BB BF) at the start. Reason: without it Excel on Windows often reads a UTF-8 file as the system code page and Bangla text turns into garbage. This is common practice; I did not re-verify it against Microsoft documentation today. NOT VERIFIED. Test with real Bangla names in Excel and in Google Sheets as the done check.
- Line ending CRLF, comma separator, fields containing comma, quote or newline wrapped in double quotes with quotes doubled. Note: some regional Excel installs expect semicolons; offer no option in v1, test in the owner's Excel.
- Amounts as numbers, not text: a decimal column `amount` such as 1500.50 produced from integer poisha by integer division and padding, never by floating point (AGENTS.md rule 6). No currency symbol, no thousands separator, so Excel treats the cell as a number. A separate `type` column (income, expense, transfer). Signed amount column optional (`signed_amount`, expenses negative).
- Dates as YYYY-MM-DD in a date-shaped text column; time as HH:MM in its own column. Bangla digits are not used in CSV.
- Text safety: any cell starting with =, +, - or @ gets a leading apostrophe-safe prefix to stop spreadsheet formula injection from a pasted SMS or note (standard practice; my recommendation).
- Deleted rows excluded by default; header row in English column names so the file is stable across language settings.
- No ellipsis characters in headers or cells (project rule 4b applies to share output).
- Sharing goes through the same share sheet; delete the cache file afterwards (task H1).

### 4.4 Restore safety rules

Already in code (src/data/backup.ts, tests in backup.test.ts): a restore may turn privacy settings on but never off; the app lock keys always stay from the device; hideAmountsOnOpen and billReminders.hideNames stay on if on; one transaction; size and shape validation; refusing newer schemas.

Add:
1. Pre-restore snapshot (4.2).
2. Preview must show counts, date range, exportedAt and "this replaces everything on this phone". It already shows counts and date range; add exportedAt and the current data's counts for comparison.
3. A restore from a file older than the data on the phone asks one extra confirmation ("This file is from 3 March; your phone has entries from 14 November").
4. An encrypted file never silently falls back to a plain parse.
5. Restore never changes the PIN, biometric secret or the lock timeout (already so).
6. After restore: re-sync reminders and recompute every total from rows; do not trust cached figures. The app already derives totals from calc.ts.

### 4.5 Main app versus dev app backup-version gap

Facts (docs/PROGRESS.md, 2026-11-17): the dev app (com.hamim.budgetapp.dev) is schema 7; the owner's main app (com.hamim.budgetapp, installed 16 Nov per docs/PLAN.md) is older and refuses schema-7 backups ("Made by a newer version"). The branches have diverged by one commit each (PLAN.md baseline).
Rules:
1. Never restore a dev-app backup into the main app until the main app has been updated with `adb install -r` (AGENTS.md section 7, Phase 25 only).
2. The reverse direction (main file into dev) is safe: older schemas migrate forward on import.
3. Real data never goes into the dev app. Dev data is sample data only (it is also readable over adb).
4. Add `minReaderSchema` and `writtenBy` (app variant and version) to the envelope header and to the plain backup top level as optional extra keys. Old validators ignore unknown top-level keys today (backup.ts reads only app, schema, exportedAt, data), so adding keys is safe for plain files.
5. Signing-key switch (docs/v1.2/KEY-SWITCH.md): that runbook requires `adb uninstall` and a restore from an exported file. It is the one moment real data depends entirely on a backup file. Encrypted or not, the file must be validated (re-read and parsed) before the uninstall step. Do this before any encryption feature lands, or make sure the main app can read the new format first.

## 5. Optional cloud backup and sync (design only)

Rule check: AGENTS.md rule 8 says no secrets, no network services, no accounts, no backend. Every row marked "breaks rule 8" needs the owner's decision (section 6).

### 5.1 Facts used (all read 2026-11-17)

| Source | Fact |
|---|---|
| https://developers.google.com/workspace/drive/api/guides/appdata | appDataFolder needs the drive.appdata scope; folder "only accessible by your app and its contents are hidden from the user and from other Google Drive apps"; deleted when the user uninstalls the app from their My Drive; created on first file create |
| https://developers.google.com/workspace/drive/api/guides/api-specific-auth | drive.appdata is listed as non-sensitive |
| https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification | Non-sensitive scopes need brand verification: authorized domain verified in Search Console, public home page and privacy policy on the same domain linked from the consent screen. The page does not state the unverified-user cap number. NOT VERIFIED: the cap value |
| https://developers.google.com/workspace/drive/api/guides/limits | Per project per minute 1,000,000 quota units; per user per project per minute 325,000; 1 TB egress per project per day before charges; max upload 5 TB per file. Cost in units per call: NOT VERIFIED (not stated on that page). Our file is about 1 MB; these limits are not a constraint |
| https://supabase.com/pricing | Free: $0, 500 MB database, 1 GB storage, 50,000 monthly active users, 5 GB egress, paused after 1 week of inactivity. Pro: from $25 per month, 8 GB disk per project then $0.125 per GB, 100 GB storage then $0.0213 per GB, 100,000 MAU included |
| https://developers.cloudflare.com/r2/pricing/ | R2 free per month: 10 GB-month storage, 1 million Class A, 10 million Class B operations, egress free. Paid: $0.015 per GB-month, $4.50 per million Class A, $0.36 per million Class B |
| https://developers.cloudflare.com/d1/platform/pricing/ | D1 free: 5 million rows read per day, 100,000 rows written per day, 5 GB storage. Paid: 25 billion rows read and 50 million rows written per month included, then $0.001 per million read and $1.00 per million written; $0.75 per GB-month above 5 GB. Base price of the Workers Paid plan: NOT VERIFIED (not fetched) |
| https://firebase.google.com/pricing | Spark (no cost): Firestore 1 GiB, 20K writes per day, 50K reads per day; Cloud Storage not available on Spark; Authentication 50K MAU. Blaze is pay-as-you-go and needs billing; Firestore per-unit prices not on that page: NOT VERIFIED |
| https://support.google.com/googleplay/android-developer/answer/10787469 | "Collect" means transmitting data off the device; data only processed on device is not declared. Data that is end-to-end encrypted and unreadable by the developer or any intermediary is exempt. The form asks whether data is encrypted in transit and whether users can request deletion. How Play treats a user-initiated upload to the user's own Google Drive: NOT VERIFIED |

Not verified at all today (do not rely): whether Drive appDataFolder bytes count against the user's own Drive quota; whether Google sign-in modules work on Expo SDK 58 with the new architecture; that an Android OAuth client is tied to the package name and signing-certificate SHA-1 (I believe so; it would make the KEY-SWITCH decision a prerequisite for Drive); the share of target phones without Google Play services.

Size assumption for cost rows (ASSUMPTION, my estimate, replace with a measured number): one backup is 1.5 MB before compression for a heavy user (about 5,000 transactions), 3 versions kept, so 4.5 MB per user. A row-sync store holds one copy (1.5 MB) plus indexes (ignored here).

### 5.2 Comparison

| | A. User's Google Drive appDataFolder, one encrypted file | B. E2E-encrypted blob on a simple object store (R2 or Supabase Storage) | C. Hosted database with row sync (Supabase Postgres, Firestore, D1) | D. No cloud, manual file transfer (today, improved) |
|---|---|---|---|---|
| Who can read the data | Nobody but the user if encrypted with a key Google never sees. Google holds the ciphertext | Same: ciphertext only. We run the server | The host reads rows unless every field is encrypted on the phone, which breaks server-side logic | Only whoever has the file |
| Cost at 1 user | $0 to us | $0 (free tiers) | $0 (free tiers) | $0 |
| Cost at 100 users | $0 to us (storage is the user's) | About 450 MB stored (assumption). R2 free 10 GB: $0. Supabase Storage free 1 GB: $0 but project pauses after a week idle | About 150 MB. Supabase free 500 MB: $0 but pauses after 1 week of inactivity, which is wrong for a backup. Firestore Spark limits 20K writes per day are fine at this size | $0 |
| Cost at 10,000 users | $0 to us. Quota questions for Google: not a constraint at about 1 MB per user | R2: 45 GB stored; (45 minus 10 free) x $0.015 is about $0.53 per month; operations (about 300,000 uploads per month at 30 each, assumption) under the 1 million free Class A. Supabase Storage: Pro from $25 per month covers 100 GB | Supabase Pro: 15 GB of rows; $25 plus (15 minus 8) x $0.125 is about $26 per month before compute (compute price NOT VERIFIED). D1 free write cap 100,000 per day is exceeded with row-level sync at this scale, paid plan base price NOT VERIFIED. Firebase needs Blaze, per-unit price NOT VERIFIED | $0 |
| Engineering effort | Medium: Google sign-in module, OAuth setup, Drive REST calls, retry, encryption (already designed in 4.1). No server | Medium to high: we need accounts or tokens per user, a small API (Worker) to authorise uploads, rate limits, abuse handling. We now run a backend | High: schema mapping, per-row ids, sync protocol, conflict rules (5.4), auth, row security, server migrations on every schema bump | Low: already built; add encryption, auto backups, share polish |
| Offline | Works offline; syncs when online; user can always use the local DB | Same | Needs a durable queue of unsent changes; conflicts on reconnect | Fully offline |
| Account requirement | A Google account on the phone (most Android users have one; phones without Google Play services cannot use it, share NOT VERIFIED) | A Khoroch account or anonymous token | A Khoroch account | None |
| Play Data safety impact | Data leaves the device to the user's own Drive. Likely declared as data collected, or arguably exempt as end-to-end encrypted; Play's reading NOT VERIFIED. Must publish a privacy policy and a domain for brand verification | Data collected on our server: declare, deletion mechanism required, retention policy, encryption in transit (https) | Same as B plus per-row personal data readable by us if not encrypted | No change (nothing collected) |
| Breaks AGENTS.md rules? | Yes: rule 8 (network use, a Google Cloud project, an OAuth client, a hosted privacy policy). No Khoroch server and no Khoroch account | Yes: rule 8 fully (backend, accounts, secrets) | Yes: rule 8 fully, and rule 3 style "do not build v2 items" if multi-device is v2 | No |

### 5.3 The simplest design for "my data survives a lost phone" without a Khoroch server or account

Layered, cheapest first. Each layer stands alone.

Layer 1 (no rule change, build now): encrypted backup file plus a persistent nudge. The app already nudges on Home (isBackupDue, 30 days). Make it say what happens if the phone is lost, and make "Save to a folder" the default on first backup so the file lands somewhere that is synced by the user's own cloud app (Google Drive, OneDrive, a laptop) without Khoroch touching any network.

Layer 2 (no Khoroch server, no Khoroch account, uses Google's own mechanism): Android Auto Backup of the database.
- Change the Android backup rules through a config plugin (the app already has custom plugins, plugins/withFinanceCapture.js) so that the cloud-backup section includes `file` domain path SQLite/ (database, WAL and SHM together) and keeps excluding SecureStore, and add `disableIfNoEncryptionCapabilities="true"` so nothing uploads when the phone has no screen lock. For Android 11 and lower use `requireFlags="clientSideEncryption"` (Android 9 and above); Android 7 and 8 phones cannot be required to encrypt, so they would be excluded or accepted by an explicit decision (the Android doc says adding requirements prevents backups on older Android versions).
- Why it fits: free, no sign-in code, Google end-to-end encrypts it with the screen lock on Android 9 or higher (Android doc), 25 MB limit per app is far above our size, no Data safety "collected by developer" data (data goes to the user's own backup; Play's reading NOT VERIFIED).
- Why it is not yet safe to rely on: (1) never tested on a device; (2) the restore puts a database of an older app build on a newer or older install, and the schema must be migrated forward by runMigrations, which it does, but a downgrade is impossible; (3) the PIN does not travel, so a restored app with appLockEnabled true and no credential turns the lock off with a notice (LockGate syncSettingOff); this is acceptable for a restore on the owner's own new phone and must be said in the UI; (4) the backup may carry the PIN-less database to a phone the owner does not control only if the Google account is theirs; (5) a timing risk: the OS backs up when the app is not running, so a half-written WAL is unlikely but not tested.
- Required test before enabling for the owner (dev app only): `adb shell bmgr backupnow` and a restore on a second device or after reinstall, check row counts and totals. The Android testing page covers this procedure but I have not tested it on this app. NOT VERIFIED.
- Real-data risk: this changes what is uploaded, not what is on the phone. It cannot corrupt the live database. It must not be shipped to the owner's app before layers 1 and the pre-restore snapshot exist.

Layer 3 (needs owner decision, rule 8): Drive appDataFolder encrypted file. Only if layers 1 and 2 prove too weak in real use (users who never save a file and whose Auto Backup is off).
- One file per user: khoroch-backup.enc (envelope from 4.1) plus khoroch-backup.prev.enc.
- Sign in with the Google account on the phone, request only the drive.appdata scope (non-sensitive), upload on Wi-Fi after a change, at most daily. Restore on a new phone: sign in, list the folder, download, ask for the recovery key, validate, restore.
- Recovery key is the real secret. If the user loses both the phone and the key, the file is unrecoverable by design.
- Needs: a Google Cloud project owned by the owner, an OAuth consent screen with a verified domain, a home page and a privacy policy (brand verification, section 5.1), Google sign-in native module (NOT VERIFIED on SDK 58), a dev build. The OAuth client for Android is tied to the package name and signing certificate; the dev app (com.hamim.budgetapp.dev) and the main app need separate clients; a key switch means a new client (NOT VERIFIED, see 5.1).

### 5.4 What multi-device sync would additionally need

Multi-device sync is not backup. Do not call it backup. It needs these decisions, in this order, before any server code:

1. Identity of records. Every row already has a string id (transactions, transfers, accounts, people, dues, bills, categories). Ids must be globally unique (random, not counters) so two phones never reuse one. Confirm that all id generation is random before sync. NOT VERIFIED across the code.
2. Deletes. Rows already carry deletedAt (transactions, transfers, dues) and archivedAt (categories, accounts, people). Sync needs tombstones that live long enough for every device to see them, and a rule that a deleted row cannot be resurrected by an old edit.
3. Settings and budgets are keyed rows without a row id (budgets keyed by periodStart and categoryId; settings key-value). They need their own rules.
4. Conflict rule. Options:
   - Last-writer-wins per whole row (updatedAt): simple, silently loses one phone's edit.
   - Last-writer-wins per field: fewer losses, still silent, and mixes two people's edits into a row neither wrote.
   - Operation log (append-only events: create, edit, delete with device id and counter, replayed in a fixed order): keeps every edit and lets the app show "changed on two phones"; costs a new storage model and a migration of existing rows into a first snapshot.
   Recommendation: for an append-mostly ledger, use an operation log or at least keep both versions on conflict. The common case is two phones adding different new rows (no conflict). The rare case is the same row edited on both: show both and let the user choose.
5. Why money apps avoid silent merges. A merged amount that neither person typed can look right and be wrong, and the user will not notice until a balance disagrees. Rules: never merge two edits of the same amount field automatically; surface the conflict; keep the losing version for at least 30 days.
6. Balances. Never sync a stored balance. Sync only the entries and recompute with calc.ts (wallet balances, dues, totals), which is how the app already works (totals come from rows, AGENTS.md rule 6). After each sync, recompute everything and compare to a stored checksum of entries (count plus sum of amounts per account) to detect drift.
7. Clock. Devices disagree about time. Use a per-device counter plus a server or logical timestamp for ordering, not the wall clock.
8. Schema versions. Two phones on different schemas must not sync until both are on the same version. The existing refusal of newer schemas is the model; a sync protocol needs a version handshake.
9. Encryption. With a server that must not read the data, every record is encrypted on the phone; the server stores opaque blobs and ids. Server-side queries are lost; that is the price.
10. Account recovery and device add: new device authorisation, a way to revoke a lost phone, and what happens when the PIN or recovery key is lost.
11. Support burden: someone must answer "my balance is different on my wife's phone".
Cost summary: roughly an order of magnitude more work than layer 3. Not recommended for the personal-use MVP.

## 6. Decisions the owner must make before any of this is built

These change hard rules in AGENTS.md or choose a product direction. At most six.

1. Allow optional network use and a Google account for an encrypted backup (partial lift of AGENTS.md rule 8)? Recommended default: No for now. Build layers 1 and 2 (section 5.3), measure, and decide in a month of real use. Cost of Yes: a Google Cloud project, brand verification (domain, home page, privacy policy), a sign-in module, Play Data safety declarations, and a new failure surface. Cost of No: users who never save a file and have Auto Backup off still lose everything.
2. What secret protects encrypted backups: generated recovery key (recommended) or a typed passphrase? Default: recovery key. Cost of passphrase: a KDF library chosen and measured on a 2 GB phone, a larger app, and weak-passphrase risk. Cost of recovery key: users must store 26 characters safely; a lost key means a lost file.
3. Is "forgot PIN erases everything" acceptable? Default: yes, but require or strongly prompt an encrypted backup before the lock can be turned on, and say so on the forgot screen. Cost of the alternative (a recovery path that keeps the data): a PIN-derived or escrowed key, which weakens the lock or needs a server.
4. Where do automatic backups go? Default: app-private rolling copies (7 daily, 4 weekly) plus an optional one-time folder choice for a visible copy. Cost of private-only: dies with an uninstall or "clear data". Cost of shared folder by default: other apps with storage access may read a plain copy, so only with the user's folder choice and encryption.
5. SQLCipher: not now (default). Cost of doing it now: unmeasured APK size and speed on old phones (the APK is already far above the 40 MB budget in docs/PLAN.md) and a one-way migration of the owner's only copy of real data. Revisit for Business Ledger v2.
6. Order of operations for the owner's real app: decide the signing key (docs/v1.2/KEY-SWITCH.md) and the update path of the main app before any cloud work. Default: update the main app with `adb install -r` to a build that can read schema 7 and the new envelope first, take and verify a backup file, and only then change anything else. Cost of doing cloud first: a Google OAuth client tied to a signing certificate that may change (NOT VERIFIED) and a main app that cannot read new backup files.

## 7. Task lists

Each task is one builder session. Order is build order. Rules for all: no ellipsis in any string; strings through t(); typecheck, tests and lint green; dev app only for any phone test; never touch the owner's app (AGENTS.md sections 6 and 7).

### 7A. No rule change

| ID | Task | Files | Depends on | Done when (runnable) |
|---|---|---|---|---|
| H1 | Delete the cache copy after sharing a backup. Delete in a finally block. | src/data/backupFiles.ts, a test beside it | none | A unit test with a mocked File shows delete is called after share success and after share failure. `npm test` exit 0 |
| H2 | Pre-restore snapshot. Before replaceAllDataFromBackup, write the current export to app-private storage (last 3 kept). If the snapshot write fails, stop the restore and say so. | src/data/backup.ts (restore entry only), a new src/data/localBackups.ts, tests | H1 | Test: restore into a repo with data; snapshot file exists and parses with parseAndValidateBackup; a forced snapshot failure leaves the repo unchanged. On the dev app: restore a file, then restore the snapshot, totals equal |
| H3 | Decide pending_drafts on restore. Read sqliteRepo.ts and the capture code first. Either do not delete pending_drafts on restore, or include them in the backup (additive, schema stays 7 if added as an optional key). Write the decision in docs/DECISIONS-LOG.md. | src/data/sqliteRepo.ts, memoryRepo.ts, backup.ts, tests | H2 | Test: inbox drafts present before a restore are still present after (or round-trip through export and restore). Old files without the key still import |
| H4 | Restore preview upgrades: show exportedAt and current counts, older-file warning, replace-everything line. Reject malformed recurring_bills rows with a count instead of dropping silently. | src/data/backup.ts, restore sheet UI under src/ui or src/app/settings, i18n en and bn | H2 | Tests for the warning rule (file older than newest local entry) and for the recurring_bills rejection. Both languages have the new keys. no-ellipsis test passes |
| E1 | Backup envelope module: encode and decode the format in 4.1 with the recovery-key design, using expo-crypto AES-GCM. Pure functions with injected crypto so Jest can run them. | new src/data/backupCrypto.ts, backupCrypto.test.ts | none (can run in parallel with H tasks) | Tests: round trip; wrong key fails with the "wrong key" result; flipped ciphertext byte fails; unknown cipher refused; nonce differs per call; plain schema-7 fixture still passes parseAndValidateBackup untouched. On the dev app: encrypt and decrypt a real export on the phone (AES module works on the device) |
| E2 | Encrypted export and import UI. Settings backup sheet: "Create recovery key" (shown once with a confirm step), "Export encrypted", "Export without a key" with the warning; import detects `envelope`, asks for the key, then runs the existing preview and restore. | src/app/settings/index.tsx or the backup sheet component, src/data/backupFiles.ts, i18n | E1, H2 | Component test with a mocked crypto for the three paths. Dev app: export encrypted, wipe the dev data with Erase all, import with the key, counts and totals equal. Wrong key shows the message |
| E3 | Header extras: add optional minReaderSchema and writtenBy to plain and encrypted backups. Confirm an old validator ignores them (it reads only app, schema, exportedAt, data). | src/data/backup.ts, tests | E1 | Test: file with the extra keys imports; test that a schema above 7 still gives the newer-version message |
| C1 | CSV export of transactions (and transfers, dues, wallets as separate files). UTF-8 with BOM, CRLF, numeric amount from integer poisha by integer math, formula-injection guard, Bangla text test. | new src/data/csvExport.ts, csvExport.test.ts, share hook in backupFiles.ts, a Settings row, i18n | H1 | Tests: amount 1500.50 from 150050 poisha, a negative or zero case, a Bangla description round-trips, a note starting with `=` is neutralised, BOM bytes present, quotes doubled. Manual: open the file from the dev phone in Excel and Google Sheets; Bangla reads correctly and the amount column sums |
| A1 | Auto local backups engine: daily at most, rolling 7 daily and 4 weekly in private storage, encrypted if a recovery key was set, written atomically (temp file then rename), validated by reading back. | new src/data/autoBackup.ts (extends localBackups.ts), tests, a hook in the root layout that runs on foreground | H2, E1 | Tests with a fake clock and fake file system: rotation counts, no write if nothing changed, a failed validation deletes the temp file and keeps old copies. Dev app: change data, background and foreground, a file appears; the Settings screen lists the copies with dates |
| A2 | Settings screen for auto backups: on or off, list, "Restore this copy" (goes through the normal restore with the snapshot rule), delete copy, plain statement that the copies vanish on uninstall. | src/app/settings (new screen), i18n | A1 | Component tests; dev app screenshot; restore of a listed copy equals totals |
| A3 | Optional visible copy in a folder the user picks once. First check whether expo-file-system v58 can keep the folder permission across restarts; if not, write BLOCKED in PROGRESS.md and stop. | backupFiles.ts, autoBackup.ts, Settings | A1 | Dev app: pick a folder, kill the app, reopen, next auto copy lands in the folder with no prompt. If not possible, the task ends as BLOCKED with the error text |
| H5 | Android backup rules, test only. On the dev app, run `adb shell bmgr` backup of the dev package and inspect what is included, to confirm section 2.4 (database not in the cloud backup today). Write the result into this file under section 2.4 and into DECISIONS-LOG.md. No code change. | docs only | none | A written result: the list of backed-up paths, from the actual command output, or BLOCKED with the reason. Needs the phone unlocked |
| H6 | Hand-over helper: a "Before a repair shop" sheet (export, then Erase all) and a lock-setup hint "use a PIN different from your phone's PIN". | src/ui/AppLockSettings.tsx, new small sheet, i18n | none | Component test; both languages; no ellipsis |
| H7 | Lock-on warning: before turning the app lock on, if no backup file was ever exported (settings.lastBackupAt is null), show a one-time notice that forgot-PIN erases all data and offer to export first. | src/ui/AppLockSettings.tsx, i18n | E2 | Test: notice appears when lastBackupAt is null and not when set |
| T1 | Device test pass for lock, as owed by three reviews: fingerprint path, since-boot clock path, wrong-PIN wait after reboot, lock screens in light and dark and Bangla, 360dp width. Dev app only; record findings, change nothing. | docs/PHONE-TEST.md log only | none | A table of what passed and failed with screenshot paths, from a phone that was unlocked and in front. Say NOT VERIFIED for anything not run |

### 7B. Needs an owner decision first

| ID | Task | Blocked by | Notes |
|---|---|---|---|
| D1 | Auto Backup of the database: config plugin that writes backup rules (cloud-backup includes SQLite/, keeps excluding SecureStore, disableIfNoEncryptionCapabilities, requireFlags for Android 11 and lower), plus the documented restore-on-new-phone flow and the lock-off-after-restore notice. Test with bmgr and a restore on dev first. | Owner question 6 (main app updated first), H5 result, H2 done | Changes no live data. Does touch what Google stores, so the owner should agree. Not a network-service change in app code |
| D2 | Passphrase option with a measured KDF: pick a library, measure derivation time on the slowest available phone, set parameters so one derivation is 0.5 to 1.5 s, add to the envelope. | Owner question 2 | New dependency, needs a dev build rebuild |
| D3 | Drive appDataFolder encrypted backup (layer 3). | Owner questions 1 and 6; brand verification; Google sign-in module check on SDK 58 | Everything in 5.3 layer 3 |
| D4 | SQLCipher build and migration (3.3). | Owner question 5; measured size and speed; a validated backup on the dev app | One-way change to real data; dev app first, then Phase-25-style rollout |
| D5 | Multi-device sync (5.4). | New owner decision on scope; a written protocol spec of its own | Not scoped here |
| D6 | Hosted backend (B or C in 5.2). | Owner question 1 and a hosting, support and privacy-policy plan | Breaks rule 8 fully |

## 8. Sources and verification log

Read on 2026-11-17:
- https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/ (SQLCipher plugin option, PRAGMA key, silent no-op without SQLCipher)
- https://developer.android.com/identity/data/autobackup (include rules, 25 MB, schedule, encryption, flags)
- https://source.android.com/docs/security/features/encryption/file-based (FBE from Android 7, required from Android 10 launches)
- https://developers.google.com/workspace/drive/api/guides/appdata
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- https://developers.google.com/workspace/drive/api/guides/limits
- https://supabase.com/pricing
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://firebase.google.com/pricing
- https://support.google.com/googleplay/android-developer/answer/10787469

Read from the repository on the same day: docs/PLAN.md, AGENTS.md, docs/SYNTHESIS.md, docs/DECISIONS-LOG.md, docs/PROGRESS.md, docs/v1.2/KEY-SWITCH.md, app.config.ts, package.json, android/app/src/main/AndroidManifest.xml, node_modules/expo-secure-store backup rule files, node_modules/expo-sqlite (plugin types, android build.gradle, SQLiteModule.kt), node_modules/expo-crypto type declarations, and the src files named in section 2.

NOT VERIFIED (summary): SQLCipher APK size and speed; Android 7 to 9 encryption type per phone; share of phones with no screen lock or no Google Play services; Excel behaviour with the BOM; KDF library choice and timing; Drive quota accounting for appDataFolder and quota units per call; unverified-OAuth user cap; OAuth client tied to signing key; Play's reading of user-initiated Drive upload; Workers Paid base price and Firestore and Cloud Storage per-unit prices; whether the cloud backup excludes the database in practice (bmgr test); whether the folder permission can persist in expo-file-system v58; whether every id generator in the code is random.
