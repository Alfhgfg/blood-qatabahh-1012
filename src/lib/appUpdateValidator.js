export const EXPECTED_ANDROID_PACKAGE_NAME = 'org.alnasr.bloodqatabah';
export const DEFAULT_MIN_SDK_VERSION = 24;
export const MAX_APK_FILE_SIZE_BYTES = 262144000; // 250 MB

export function createDefaultAppUpdateConfig() {
  return {
    enabled: false,
    android: {
      versionCode: 1,
      versionName: '1.0',
      packageName: EXPECTED_ANDROID_PACKAGE_NAME,
      downloadUrl: '',
      sha256: '',
      fileSize: 0,
      minSdkVersion: DEFAULT_MIN_SDK_VERSION,
      minUpgradeFromVersionCode: 1,
      mandatory: false,
      releaseNotes: '',
      releasedAt: '2026-10-01T00:00:00Z'
    },
    web: {
      versionCode: 1,
      versionName: '1.0',
      mandatory: false,
      releaseNotes: '',
      releasedAt: '2026-10-01T00:00:00Z'
    },
    updatedAt: '2026-10-01T00:00:00Z',
    updatedBy: 'system'
  };
}

/**
 * Checks whether a hostname is a private/loopback/link-local address to prevent SSRF.
 */
export function isPrivateOrInternalHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return true;
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  // IPv4 literal check
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  // IPv6 private/link-local ranges
  if (host.includes(':')) {
    if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80') || host === '::') {
      return true;
    }
  }
  return false;
}

/**
 * Validates that a download URL uses HTTPS and points to a public external host without embedded credentials.
 */
export function validateSafeHttpsDownloadUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'رابط تنزيل التحديث مفقود' };
  }
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: 'رابط تنزيل التحديث فارغ' };
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'صيغة رابط تنزيل التحديث غير صالحة' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'يجب أن يبدأ رابط التحديث ببروتوكول HTTPS الآمن' };
  }
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'غير مسموح بتضمين بيانات دخول داخل رابط التحديث' };
  }
  if (isPrivateOrInternalHost(parsed.hostname)) {
    return { valid: false, error: 'رابط التحديث يشير إلى عنوان شبكة داخلي أو محلي غير مسموح به' };
  }
  return { valid: true, url: parsed.toString() };
}

export function isValidSha256Hex(sha256) {
  return typeof sha256 === 'string' && /^[a-f0-9]{64}$/i.test(sha256.trim());
}

/**
 * Validates and normalizes an incoming AppUpdateConfig payload before persisting.
 */
export function validateAndNormalizeAppUpdateConfig(input, updatedBy = 'admin') {
  const defaults = createDefaultAppUpdateConfig();
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'بيانات إعدادات التحديث غير صالحة' };
  }

  const enabled = Boolean(input.enabled);
  const rawAndroid = input.android && typeof input.android === 'object' ? input.android : {};
  const rawWeb = input.web && typeof input.web === 'object' ? input.web : {};

  const packageName = String(rawAndroid.packageName || EXPECTED_ANDROID_PACKAGE_NAME).trim();
  if (packageName !== EXPECTED_ANDROID_PACKAGE_NAME) {
    return {
      valid: false,
      code: 'PACKAGE_MISMATCH',
      error: `معرّف الحزمة يجب أن يطابق (${EXPECTED_ANDROID_PACKAGE_NAME}) للسماح بالتحديث فوق النسخة الحالية دون حذفها`
    };
  }

  const androidVersionCode = Number(rawAndroid.versionCode ?? defaults.android.versionCode);
  if (!Number.isInteger(androidVersionCode) || androidVersionCode < 1) {
    return { valid: false, error: 'رقم الإصدار البرمجي للأندرويد (versionCode) يجب أن يكون عدداً صحيحاً موجباً' };
  }

  const androidVersionName = String(rawAndroid.versionName || defaults.android.versionName).trim().slice(0, 32);
  if (!androidVersionName) {
    return { valid: false, error: 'اسم إصدار الأندرويد (versionName) مطلوب' };
  }

  const minSdkVersion = Number(rawAndroid.minSdkVersion ?? DEFAULT_MIN_SDK_VERSION);
  if (!Number.isInteger(minSdkVersion) || minSdkVersion < 21 || minSdkVersion > 36) {
    return { valid: false, error: 'الحد الأدنى لنظام أندرويد (minSdkVersion) يجب أن يكون بين 21 و 36' };
  }

  const minUpgradeFromVersionCode = Number(rawAndroid.minUpgradeFromVersionCode ?? 1);
  if (
    !Number.isInteger(minUpgradeFromVersionCode) ||
    minUpgradeFromVersionCode < 1 ||
    minUpgradeFromVersionCode > androidVersionCode
  ) {
    return {
      valid: false,
      error: 'أقل إصدار مؤهل للترقية المباشرة يجب أن يكون بين 1 و versionCode الجديد'
    };
  }

  const fileSize = Number(rawAndroid.fileSize ?? 0);
  if (!Number.isFinite(fileSize) || fileSize < 0 || fileSize > MAX_APK_FILE_SIZE_BYTES || !Number.isInteger(fileSize)) {
    return { valid: false, error: 'حجم ملف APK غير صالح' };
  }

  const rawDownloadUrl = String(rawAndroid.downloadUrl || '').trim();
  let normalizedDownloadUrl = '';
  if (rawDownloadUrl) {
    const urlCheck = validateSafeHttpsDownloadUrl(rawDownloadUrl);
    if (!urlCheck.valid) {
      return { valid: false, code: 'INVALID_DOWNLOAD_URL', error: urlCheck.error };
    }
    normalizedDownloadUrl = urlCheck.url;
  }

  const rawSha256 = String(rawAndroid.sha256 || '').trim().toLowerCase();
  if (rawSha256 && !isValidSha256Hex(rawSha256)) {
    return {
      valid: false,
      code: 'INVALID_CHECKSUM',
      error: 'بصمة التحقق (SHA-256) يجب أن تتكون من 64 محرفاً ست عشرياً (Hex)'
    };
  }

  if (enabled && normalizedDownloadUrl && !rawSha256) {
    return {
      valid: false,
      code: 'MISSING_CHECKSUM',
      error: 'يجب تزويد بصمة SHA-256 لملف APK لضمان التحقق من سلامته قبل التثبيت'
    };
  }

  const webVersionCode = Number(rawWeb.versionCode ?? defaults.web.versionCode);
  if (!Number.isInteger(webVersionCode) || webVersionCode < 1) {
    return { valid: false, error: 'رقم إصدار الويب (versionCode) يجب أن يكون عدداً صحيحاً موجباً' };
  }

  const webVersionName = String(rawWeb.versionName || defaults.web.versionName).trim().slice(0, 32);
  if (!webVersionName) {
    return { valid: false, error: 'اسم إصدار الويب (versionName) مطلوب' };
  }

  const nowIso = new Date().toISOString();
  return {
    valid: true,
    config: {
      enabled,
      android: {
        versionCode: androidVersionCode,
        versionName: androidVersionName,
        packageName: EXPECTED_ANDROID_PACKAGE_NAME,
        downloadUrl: normalizedDownloadUrl,
        sha256: rawSha256,
        fileSize,
        minSdkVersion,
        minUpgradeFromVersionCode,
        mandatory: Boolean(rawAndroid.mandatory),
        releaseNotes: String(rawAndroid.releaseNotes || '').trim().slice(0, 2000),
        releasedAt: String(rawAndroid.releasedAt || nowIso).slice(0, 50)
      },
      web: {
        versionCode: webVersionCode,
        versionName: webVersionName,
        mandatory: Boolean(rawWeb.mandatory),
        releaseNotes: String(rawWeb.releaseNotes || '').trim().slice(0, 2000),
        releasedAt: String(rawWeb.releasedAt || nowIso).slice(0, 50)
      },
      updatedAt: nowIso,
      updatedBy: String(updatedBy || 'admin').slice(0, 150)
    }
  };
}

/**
 * Safely sanitizes stored config from disk, falling back to default on corruption.
 */
export function sanitizeLoadedAppUpdateConfig(raw) {
  if (!raw || typeof raw !== 'object') {
    return createDefaultAppUpdateConfig();
  }
  const checked = validateAndNormalizeAppUpdateConfig(raw, raw.updatedBy || 'system');
  if (checked.valid) {
    return {
      ...checked.config,
      updatedAt: raw.updatedAt || checked.config.updatedAt
    };
  }
  return createDefaultAppUpdateConfig();
}

/**
 * Compares two semantic version strings (e.g. "1.2.0" vs "1.1.9").
 * Returns 1 if a > b, -1 if a < b, 0 if equal.
 */
export function compareVersionStrings(a, b) {
  const partsA = String(a || '0').replace(/^v/i, '').split('.').map((p) => parseInt(p.replace(/\D.*$/, ''), 10) || 0);
  const partsB = String(b || '0').replace(/^v/i, '').split('.').map((p) => parseInt(p.replace(/\D.*$/, ''), 10) || 0);
  const maxLen = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLen; i++) {
    const va = partsA[i] || 0;
    const vb = partsB[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

/**
 * Evaluates compatibility and update availability between the currently installed app and remote config.
 */
export function checkUpdateCompatibility(installed, remoteConfig) {
  if (!remoteConfig || !remoteConfig.enabled) {
    return {
      compatible: true,
      updateAvailable: false,
      reasonCode: 'DISABLED',
      reasonMessage: 'لا توجد تحديثات منشورة حالياً'
    };
  }

  if (installed.platform === 'android') {
    const target = remoteConfig.android;
    if (!target) {
      return {
        compatible: true,
        updateAvailable: false,
        reasonCode: 'UP_TO_DATE',
        reasonMessage: 'أنت تستخدم أحدث إصدار من التطبيق'
      };
    }

    if (target.packageName !== installed.packageName || target.packageName !== EXPECTED_ANDROID_PACKAGE_NAME) {
      return {
        compatible: false,
        updateAvailable: false,
        reasonCode: 'PACKAGE_MISMATCH',
        reasonMessage: 'حزمة التحديث غير متطابقة مع التطبيق المثبت حالياً، تم حظر التحديث لحماية بياناتك.'
      };
    }

    const isNewer =
      target.versionCode > installed.versionCode ||
      (target.versionCode === installed.versionCode && compareVersionStrings(target.versionName, installed.versionName) > 0);

    // For Android in-place APK upgrades, versionCode MUST be strictly greater than installed versionCode
    if (target.versionCode <= installed.versionCode) {
      return {
        compatible: true,
        updateAvailable: false,
        reasonCode: isNewer ? 'VERSION_NOT_SUPPORTED_FOR_UPGRADE' : 'UP_TO_DATE',
        reasonMessage: 'أنت تستخدم أحدث إصدار متاح من التطبيق'
      };
    }

    if (typeof installed.sdkInt === 'number' && target.minSdkVersion > installed.sdkInt) {
      return {
        compatible: false,
        updateAvailable: false,
        reasonCode: 'INCOMPATIBLE_SDK',
        reasonMessage: `هذا الإصدار يتطلب أندرويد بمستوى SDK ${target.minSdkVersion} على الأقل (جهازك: ${installed.sdkInt}).`
      };
    }

    if (target.minUpgradeFromVersionCode > installed.versionCode) {
      return {
        compatible: false,
        updateAvailable: false,
        reasonCode: 'VERSION_NOT_SUPPORTED_FOR_UPGRADE',
        reasonMessage: `الإصدار الحالي (${installed.versionName}) لا يدعم الترقية المباشرة لهذا التحديث.`
      };
    }

    const urlCheck = validateSafeHttpsDownloadUrl(target.downloadUrl);
    if (!urlCheck.valid) {
      return {
        compatible: false,
        updateAvailable: false,
        reasonCode: 'INVALID_DOWNLOAD_URL',
        reasonMessage: urlCheck.error
      };
    }

    if (!isValidSha256Hex(target.sha256)) {
      return {
        compatible: false,
        updateAvailable: false,
        reasonCode: 'MISSING_CHECKSUM',
        reasonMessage: 'ملف التحديث يفتقر إلى بصمة التحقق الرقمية SHA-256 المطلوبة للتحقق من سلامته.'
      };
    }

    return {
      compatible: true,
      updateAvailable: true
    };
  }

  // Web / PWA evaluation
  const webTarget = remoteConfig.web;
  if (!webTarget) {
    return {
      compatible: true,
      updateAvailable: false,
      reasonCode: 'UP_TO_DATE',
      reasonMessage: 'أنت تستخدم أحدث نسخة ويب متاحة'
    };
  }

  const isWebNewer =
    webTarget.versionCode > installed.versionCode ||
    compareVersionStrings(webTarget.versionName, installed.versionName) > 0;

  if (!isWebNewer) {
    return {
      compatible: true,
      updateAvailable: false,
      reasonCode: 'UP_TO_DATE',
      reasonMessage: 'أنت تستخدم أحدث إصدار من التطبيق'
    };
  }

  return {
    compatible: true,
    updateAvailable: true
  };
}
