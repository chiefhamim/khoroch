const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withMainActivity,
  withMainApplication,
} = require('expo/config-plugins');

function buildNotificationServiceKt(pkg) {
  return `package ${pkg}.capture

import android.app.Notification
import android.content.Context
import android.content.pm.PackageManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

class NotificationCaptureService : NotificationListenerService() {
  companion object {
    const val PREFS_NAME = "khoroch_capture_prefs"
    const val KEY_NOTIFICATIONS = "notifications_json"
    private const val MAX_ITEMS = 120
    private val LOCK = Any()

    private val KNOWN_FINANCE_PACKAGES = setOf(
      "com.bKash.customerapp",
      "com.konasl.nagad",
      "com.dbbl.nexus.pay",
      "com.dutchbanglabank.rocket",
      "com.upay.wallet",
      "com.ibbl.cellfin",
      "com.citybank.citytouch",
      "com.bracbank.astha",
      "com.ebl.skybanking",
      "com.primebank.myprime",
      "com.mtb.neo",
      "com.google.android.apps.messaging",
      "com.samsung.android.messaging"
    )

    private val FINANCE_KEYWORD_REGEX = Regex(
      """(bkash|nagad|rocket|upay|cellfin|brac|bbl|ncc|citybank|city\\s*bank|ebl|dbbl|dutch-bangla|islami\\s*bank|pubali|prime\\s*bank|dotinternet|dot\\s*internet|biller|trxid|txn\\s*id|cash\\s*out|cash\\s*in|send\\s*money|add\\s*money|payment\\s*of|bill\\s*successfully\\s*paid|transacted|transferred|debited|credited|deposited|withdrawn|purchase|tk\\.?\\s*[0-9]|bdt\\.?\\s*[0-9]|৳\\s*[0-9]|[0-9]+\\s*tk)""",
      RegexOption.IGNORE_CASE
    )

    private val OTP_OR_NOISE_REGEX = Regex(
      """\\b(?:otp|one\\s*time\\s*password|verification\\s*code|pass\\s*code|valid\\s*for\\s*\\d+\\s*min|account\\s*binding|month-end\\s*balance|your\\s+tq\\s+limit|successfully\\s+enrolled|successfully\\s+registered|home\\s+packages)\\b|অবশিষ্ট\\s*ভলিউম|বিশেষ\\s*অফার|লোনের\\s*যোগ্য|জিতে\\s*নিন\\s*[০-৯0-9,]+\\s*(?:বোনাস|টাকা|রিওয়ার্ড)|বোনাস\\s*রিওয়ার্ড""",
      RegexOption.IGNORE_CASE
    )

    fun drainAll(context: Context): JSONArray {
      synchronized(LOCK) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_NOTIFICATIONS, "[]") ?: "[]"
        prefs.edit().putString(KEY_NOTIFICATIONS, "[]").apply()
        return try {
          JSONArray(raw)
        } catch (_: Exception) {
          JSONArray()
        }
      }
    }
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    val pkgName = sbn.packageName ?: return
    if (pkgName == applicationContext.packageName) return

    val extras = sbn.notification?.extras ?: return
    val title = (extras.getCharSequence(Notification.EXTRA_TITLE) ?: "").toString().trim()
    val bigText = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: "").toString().trim()
    val shortText = (extras.getCharSequence(Notification.EXTRA_TEXT) ?: "").toString().trim()
    val body = if (bigText.length >= shortText.length) bigText else shortText
    val combined = listOf(title, body).filter { it.isNotEmpty() }.joinToString(" - ")
    if (combined.isBlank()) return

    val isKnownPkg = KNOWN_FINANCE_PACKAGES.contains(pkgName)
    if (OTP_OR_NOISE_REGEX.containsMatchIn(combined)) {
      return
    }
    if (!isKnownPkg && !FINANCE_KEYWORD_REGEX.containsMatchIn(combined)) {
      return
    }
    if (isKnownPkg && !FINANCE_KEYWORD_REGEX.containsMatchIn(combined)) {
      return
    }

    val appLabel = try {
      val ai = packageManager.getApplicationInfo(pkgName, 0)
      packageManager.getApplicationLabel(ai).toString()
    } catch (_: PackageManager.NameNotFoundException) {
      pkgName
    }

    val postedAt = sbn.postTime
    val record = JSONObject().apply {
      put("id", "\${pkgName}_\${sbn.id}_\${postedAt}")
      put("packageName", pkgName)
      put("appName", appLabel)
      put("title", title)
      put("text", body)
      put("postedAt", postedAt)
    }

    synchronized(LOCK) {
      val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val existing = try {
        JSONArray(prefs.getString(KEY_NOTIFICATIONS, "[]") ?: "[]")
      } catch (_: Exception) {
        JSONArray()
      }

      // Skip identical notification burst within 15 seconds
      val count = existing.length()
      for (i in 0 until count) {
        val item = existing.optJSONObject(i) ?: continue
        if (item.optString("text") == body &&
          kotlin.math.abs(postedAt - item.optLong("postedAt", 0L)) < 15000L
        ) {
          return
        }
      }

      existing.put(record)
      val trimmed = if (existing.length() > MAX_ITEMS) {
        val next = JSONArray()
        for (i in (existing.length() - MAX_ITEMS) until existing.length()) {
          next.put(existing.get(i))
        }
        next
      } else {
        existing
      }
      prefs.edit().putString(KEY_NOTIFICATIONS, trimmed.toString()).apply()
    }

    FinanceCaptureModule.notifyLiveCapture(combined)
  }
}
`;
}

function buildFinanceCaptureModuleKt(pkg) {
  return `package ${pkg}.capture

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.text.PDFTextStripper
import com.tom_roush.pdfbox.pdmodel.PDDocument
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.concurrent.Executors

object PendingShareStore {
  private var pendingKind: String? = null
  private var pendingValue: String? = null

  @Synchronized
  fun captureFromIntent(context: Context, intent: Intent?) {
    if (intent == null) return
    val action = intent.action ?: return
    val type = intent.type ?: ""
    if (action == Intent.ACTION_SEND) {
      if (type.startsWith("text/")) {
        val text = intent.getStringExtra(Intent.EXTRA_TEXT)
        if (!text.isNullOrBlank()) {
          pendingKind = "text"
          pendingValue = text.trim()
        }
      } else if (type.startsWith("image/")) {
        val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
        if (uri != null) {
          val copied = copyUriToCache(context, uri)
          if (copied != null) {
            pendingKind = "image"
            pendingValue = copied
          }
        }
      }
    }
  }

  private fun copyUriToCache(context: Context, uri: Uri): String? {
    return try {
      val input: InputStream = context.contentResolver.openInputStream(uri) ?: return null
      val outFile = File(context.cacheDir, "shared_capture_\${System.currentTimeMillis()}.jpg")
      input.use { src ->
        FileOutputStream(outFile).use { dst ->
          src.copyTo(dst)
        }
      }
      Uri.fromFile(outFile).toString()
    } catch (_: Exception) {
      uri.toString()
    }
  }

  @Synchronized
  fun consume(): Pair<String, String>? {
    val k = pendingKind ?: return null
    val v = pendingValue ?: return null
    pendingKind = null
    pendingValue = null
    return k to v
  }
}

class FinanceCaptureModule(private val reactCtx: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactCtx) {

  private val executor = Executors.newSingleThreadExecutor()
  @Volatile private var pdfBoxInitialized = false

  init {
    activeInstance = this
  }

  companion object {
    @Volatile
    private var activeInstance: FinanceCaptureModule? = null

    fun notifyLiveCapture(preview: String) {
      val inst = activeInstance ?: return
      try {
        if (inst.reactCtx.hasActiveReactInstance()) {
          val payload = Arguments.createMap().apply {
            putString("preview", preview)
          }
          inst.reactCtx
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("KhorochCaptureEvent", payload)
        }
      } catch (_: Exception) {
      }
    }

    fun notifyShareReady() {
      val inst = activeInstance ?: return
      try {
        if (inst.reactCtx.hasActiveReactInstance()) {
          inst.reactCtx
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("KhorochShareEvent", Arguments.createMap())
        }
      } catch (_: Exception) {
      }
    }
  }

  override fun getName(): String = "FinanceCapture"

  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Int) {}

  /**
   * Milliseconds since boot including deep sleep (SystemClock.elapsedRealtime). The user cannot
   * change it; it restarts only on reboot. The app lock counts its wrong-PIN wait with it.
   */
  @ReactMethod
  fun getElapsedRealtime(promise: Promise) {
    try {
      promise.resolve(android.os.SystemClock.elapsedRealtime().toDouble())
    } catch (e: Exception) {
      promise.reject("E_ELAPSED", e)
    }
  }

  @ReactMethod
  fun isNotificationListenerEnabled(promise: Promise) {
    try {
      val enabled = NotificationManagerCompat.getEnabledListenerPackages(reactCtx)
        .contains(reactCtx.packageName)
      promise.resolve(enabled)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun openNotificationListenerSettings(promise: Promise) {
    try {
      val component = ComponentName(reactCtx, NotificationCaptureService::class.java).flattenToString()
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        putExtra(":settings:fragment_args_key", component)
        putExtra(":settings:show_fragment_args", Bundle().apply {
          putString(":settings:fragment_args_key", component)
        })
      }
      reactCtx.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      try {
        val fallback = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactCtx.startActivity(fallback)
        promise.resolve(true)
      } catch (e2: Exception) {
        promise.reject("E_SETTINGS", e2)
      }
    }
  }

  @ReactMethod
  fun drainCapturedNotifications(promise: Promise) {
    try {
      val items = NotificationCaptureService.drainAll(reactCtx)
      val arr = Arguments.createArray()
      for (i in 0 until items.length()) {
        val obj = items.optJSONObject(i) ?: continue
        val map = Arguments.createMap().apply {
          putString("id", obj.optString("id"))
          putString("packageName", obj.optString("packageName"))
          putString("appName", obj.optString("appName"))
          putString("title", obj.optString("title"))
          putString("text", obj.optString("text"))
          putDouble("postedAt", obj.optLong("postedAt").toDouble())
        }
        arr.pushMap(map)
      }
      promise.resolve(arr)
    } catch (e: Exception) {
      promise.reject("E_DRAIN", e)
    }
  }

  @ReactMethod
  fun consumePendingShare(promise: Promise) {
    try {
      val item = PendingShareStore.consume()
      if (item == null) {
        promise.resolve(null)
        return
      }
      val map = Arguments.createMap().apply {
        putString("kind", item.first)
        putString("value", item.second)
      }
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("E_SHARE", e)
    }
  }

  @ReactMethod
  fun extractPdfText(uriString: String, promise: Promise) {
    executor.execute {
      try {
        if (!pdfBoxInitialized) {
          PDFBoxResourceLoader.init(reactCtx.applicationContext)
          pdfBoxInitialized = true
        }
        val uri = Uri.parse(uriString)
        val input: InputStream? = if (uri.scheme == "file" && uri.path != null) {
          File(uri.path!!).inputStream()
        } else {
          reactCtx.contentResolver.openInputStream(uri)
        }
        if (input == null) {
          promise.reject("E_PDF_OPEN", "Unable to open PDF stream")
          return@execute
        }
        input.use { stream ->
          PDDocument.load(stream).use { doc ->
            val stripper = PDFTextStripper().apply {
              sortByPosition = true
            }
            val text = stripper.getText(doc) ?: ""
            promise.resolve(text)
          }
        }
      } catch (e: Exception) {
        promise.reject("E_PDF_PARSE", e.message ?: "Failed to parse PDF", e)
      }
    }
  }

  @ReactMethod
  fun recognizeImageText(uriString: String, promise: Promise) {
    try {
      val uri = Uri.parse(uriString)
      val image = InputImage.fromFilePath(reactCtx, uri)
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      recognizer.process(image)
        .addOnSuccessListener { visionText ->
          promise.resolve(visionText.text ?: "")
        }
        .addOnFailureListener { exc ->
          promise.reject("E_OCR", exc.message ?: "OCR failed", exc)
        }
    } catch (e: Exception) {
      promise.reject("E_OCR_INIT", e.message ?: "Unable to read image", e)
    }
  }
}
`;
}

function buildFinanceCapturePackageKt(pkg) {
  return `package ${pkg}.capture

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager

class FinanceCapturePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(FinanceCaptureModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<View, ReactShadowNode<*>>> =
    emptyList()
}
`;
}

function withFinanceCapture(config) {
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (!app) return mod;

    app.service = app.service || [];
    const serviceName = '.capture.NotificationCaptureService';
    if (!app.service.some((s) => s.$?.['android:name'] === serviceName)) {
      app.service.push({
        $: {
          'android:name': serviceName,
          'android:label': '@string/app_name',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.service.notification.NotificationListenerService' } },
            ],
          },
        ],
      });
    }

    const mainActivity = app.activity?.find((a) => a.$?.['android:name'] === '.MainActivity');
    if (mainActivity) {
      mainActivity['intent-filter'] = mainActivity['intent-filter'] || [];
      const hasSend = mainActivity['intent-filter'].some((f) =>
        f.action?.some((a) => a.$?.['android:name'] === 'android.intent.action.SEND')
      );
      if (!hasSend) {
        mainActivity['intent-filter'].push(
          {
            action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
            data: [{ $: { 'android:mimeType': 'text/plain' } }],
          },
          {
            action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
            data: [{ $: { 'android:mimeType': 'image/*' } }],
          }
        );
      }
    }

    return mod;
  });

  config = withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;
    if (!contents.includes('com.tom-roush:pdfbox-android')) {
      contents = contents.replace(
        /(dependencies\s*\{)/,
        `$1\n    implementation("com.tom-roush:pdfbox-android:2.0.27.0")\n    implementation("com.google.mlkit:text-recognition:16.0.1")`
      );
    }
    if (!contents.includes('META-INF/DEPENDENCIES')) {
      contents = contents.replace(
        /(android\s*\{)/,
        `$1\n    packaging { resources { excludes += ['META-INF/DEPENDENCIES', 'META-INF/LICENSE*', 'META-INF/NOTICE*'] } }`
      );
    }
    mod.modResults.contents = contents;
    return mod;
  });

  config = withMainApplication(config, (mod) => {
    let contents = mod.modResults.contents;
    const pkgMatch = contents.match(/^package\s+([a-zA-Z0-9_.]+)/m);
    const pkg = pkgMatch ? pkgMatch[1] : config.android?.package || 'com.hamim.budgetapp';

    if (!contents.includes(`${pkg}.capture.FinanceCapturePackage`)) {
      contents = contents.replace(
        /(import expo\.modules\.ExpoReactHostFactory)/,
        `$1\nimport ${pkg}.capture.FinanceCapturePackage`
      );
    }
    if (!contents.includes('add(FinanceCapturePackage())')) {
      contents = contents.replace(
        /(PackageList\(this\)\.packages\.apply\s*\{)/,
        `$1\n          add(FinanceCapturePackage())`
      );
    }
    mod.modResults.contents = contents;
    return mod;
  });

  config = withMainActivity(config, (mod) => {
    let contents = mod.modResults.contents;
    const pkgMatch = contents.match(/^package\s+([a-zA-Z0-9_.]+)/m);
    const pkg = pkgMatch ? pkgMatch[1] : config.android?.package || 'com.hamim.budgetapp';

    if (!contents.includes('import android.content.Intent')) {
      contents = contents.replace(
        /(import android\.os\.Bundle)/,
        `$1\nimport android.content.Intent\nimport ${pkg}.capture.PendingShareStore\nimport ${pkg}.capture.FinanceCaptureModule`
      );
    }
    if (!contents.includes('PendingShareStore.captureFromIntent(this, intent)')) {
      contents = contents.replace(
        /(super\.onCreate\(null\))/,
        `$1\n    PendingShareStore.captureFromIntent(this, intent)`
      );
    }
    if (!contents.includes('override fun onNewIntent(')) {
      contents = contents.replace(
        /(override fun getMainComponentName\(\): String = "main")/,
        `$1\n\n  override fun onNewIntent(intent: Intent) {\n    super.onNewIntent(intent)\n    setIntent(intent)\n    PendingShareStore.captureFromIntent(this, intent)\n    FinanceCaptureModule.notifyShareReady()\n  }`
      );
    }
    mod.modResults.contents = contents;
    return mod;
  });

  config = withDangerousMod(config, [
    'android',
    async (mod) => {
      const javaRoot = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java');
      const mainAppPath = findMainApplicationKt(javaRoot);
      let pkg = config.android?.package || 'com.hamim.budgetapp';
      let captureDir;

      if (mainAppPath) {
        const mainAppText = fs.readFileSync(mainAppPath, 'utf8');
        const pkgMatch = mainAppText.match(/^package\s+([a-zA-Z0-9_.]+)/m);
        if (pkgMatch) pkg = pkgMatch[1];
        captureDir = path.join(path.dirname(mainAppPath), 'capture');
      } else {
        captureDir = path.join(javaRoot, ...pkg.split('.'), 'capture');
      }

      fs.mkdirSync(captureDir, { recursive: true });
      fs.writeFileSync(
        path.join(captureDir, 'NotificationCaptureService.kt'),
        buildNotificationServiceKt(pkg),
        'utf8'
      );
      fs.writeFileSync(
        path.join(captureDir, 'FinanceCaptureModule.kt'),
        buildFinanceCaptureModuleKt(pkg),
        'utf8'
      );
      fs.writeFileSync(
        path.join(captureDir, 'FinanceCapturePackage.kt'),
        buildFinanceCapturePackageKt(pkg),
        'utf8'
      );

      const proguardPath = path.join(mod.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      if (fs.existsSync(proguardPath)) {
        const current = fs.readFileSync(proguardPath, 'utf8');
        const rulesMarker = '# withFinanceCapture keep rules';
        if (!current.includes(rulesMarker)) {
          const addition = `\n${rulesMarker}\n-dontwarn com.gemalto.jp2.**\n-keep class ${pkg}.capture.** { *; }\n`;
          fs.writeFileSync(proguardPath, current + addition, 'utf8');
        }
      }
      return mod;
    },
  ]);

  return config;
}

function findMainApplicationKt(dir) {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const hit = findMainApplicationKt(full);
      if (hit) return hit;
    } else if (entry.name === 'MainApplication.kt') {
      return full;
    }
  }
  return null;
}

module.exports = withFinanceCapture;
