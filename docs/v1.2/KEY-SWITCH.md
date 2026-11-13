# Keystore & Release Signing Cutover Runbook (v1.2)

> **Important:** The currently installed production app on your phone (`com.hamim.budgetapp`) is signed with `debug.keystore`. Android refuses `adb install -r` when the signing certificate changes. **Do not switch signing keys on the production app until you explicitly run this cutover yourself.**

---

## 1. Where the Private Release Keystore Lives

- Keystore path: `C:\Users\hamim\.keystores\budgetapp-release.jks`
- Key alias: `budgetapp`
- Credentials file: `C:\Users\hamim\.gradle\gradle.properties` (`BUDGET_UPLOAD_STORE_FILE`, `BUDGET_UPLOAD_KEY_ALIAS`, `BUDGET_UPLOAD_STORE_PASSWORD`, `BUDGET_UPLOAD_KEY_PASSWORD`)
- Neither the `.jks` file nor `gradle.properties` is ever inside the git repository.

**Back up `C:\Users\hamim\.keystores\budgetapp-release.jks` and `C:\Users\hamim\.gradle\gradle.properties` to your password manager or encrypted cloud vault before proceeding.** If you lose this keystore later, you cannot update an app signed with it in place.

---

## 2. Back Up Your Live App Data First

1. Open **Budget App** (`com.hamim.budgetapp`) on your phone.
2. Open **Settings -> Backup & restore**.
3. Tap **Save to device folder** (or **Share or save backup file**) and save the `.json` file into your **Downloads** folder (and optionally a copy in cloud storage).
4. Verify the exported file exists and is readable before uninstalling the old build.

---

## 3. Build the Properly Signed Release APK

From `C:\Users\hamim\Desktop\budget-app` in PowerShell:

```powershell
$env:BUDGET_RELEASE_SIGNING = "new"
$env:CI = "1"
Remove-Item env:APP_VARIANT -ErrorAction SilentlyContinue
npx expo prebuild -p android --clean

cd android
.\gradlew.bat assembleRelease
```

On Windows, if CMake fails with a path-length error, pass the short-build init script used in dev (`-I <path-to-cmake-path-fix.gradle>`) and remove `android/b` afterwards.

Output APK:
`android\app\build\outputs\apk\release\app-release.apk`

---

## 4. Cut Over on the Phone (Owner Action Only)

```powershell
# Confirm APK is NOT signed with Android Debug key before installing:
keytool -printcert -jarfile android\app\build\outputs\apk\release\app-release.apk

# Remove old debug-signed build ONLY after confirming your JSON backup is safe:
adb uninstall com.hamim.budgetapp

# Install the new release-signed production build:
adb install android\app\build\outputs\apk\release\app-release.apk
```

---

## 5. Restore Your Data

1. Open **Budget App**.
2. Complete the short onboarding step (any placeholder name/currency will be overwritten on restore).
3. Go to **Settings -> Backup & restore -> Restore from backup file**.
4. Pick the JSON backup file saved in Step 2, review the transaction and category count summary, and confirm **Replace and restore**.
5. Confirm all transactions, categories, budgets, and daily check-in history are intact.

---

## 6. Daily Development Continues Safely on `Budget Dev`

Everyday builds and agent phone checks use `APP_VARIANT=dev` (`com.hamim.budgetapp.dev`), which stays side-by-side and never touches `com.hamim.budgetapp`.
