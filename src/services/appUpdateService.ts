import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import type {
  AppUpdateConfig,
  InstalledAppInfo,
  UpdateCheckResult,
  UpdateProgressState
} from '../types';
import {
  EXPECTED_ANDROID_PACKAGE_NAME,
  checkUpdateCompatibility,
  validateAndNormalizeAppUpdateConfig
} from '../lib/appUpdateValidator.js';
import { firestoreService } from '../firebase/firestoreService';
import { getAdminAuthHeaders, getApiUrl } from './storageService';

interface AppUpdateNativePlugin {
  getInstalledAppInfo(): Promise<{
    packageName: string;
    versionCode: number;
    versionName: string;
    sdkInt: number;
    signingDigests: string[];
    canRequestPackageInstalls: boolean;
  }>;
  canInstallPackages(): Promise<{ allowed: boolean }>;
  openInstallPermissionSettings(): Promise<{ opened: boolean; alreadyAllowed: boolean }>;
  cancelDownload(): Promise<{ cancelled: boolean }>;
  cleanupUpdateFiles(): Promise<{ cleaned: boolean; deletedCount: number }>;
  downloadAndVerifyApk(options: {
    url: string;
    expectedSha256?: string;
    expectedFileSize?: number;
    expectedVersionCode?: number;
    minSdkVersion?: number;
  }): Promise<{
    verified: boolean;
    fileName: string;
    fileSize: number;
    sha256: string;
    packageName: string;
    versionCode: number;
    versionName: string;
  }>;
  installVerifiedApk(): Promise<{ started: boolean; needsPermission: boolean }>;
  addListener(
    eventName: 'updateDownloadProgress',
    listenerFunc: (data: {
      phase: 'downloading' | 'verifying';
      progress: number;
      downloadedBytes: number;
      totalBytes: number;
    }) => void
  ): Promise<PluginListenerHandle>;
}

const AppUpdateNative = registerPlugin<AppUpdateNativePlugin>('AppUpdate');

const SNOOZE_SESSION_KEY = 'qaatabah_update_snoozed_version_v1';
const APPLIED_WEB_VERSION_KEY = 'qaatabah_applied_web_version_v1';

export function getCompiledVersionInfo(): { versionCode: number; versionName: string } {
  const code = typeof __APP_VERSION_CODE__ === 'number' && __APP_VERSION_CODE__ > 0 ? __APP_VERSION_CODE__ : 1;
  const name = typeof __APP_VERSION_NAME__ === 'string' && __APP_VERSION_NAME__.trim() ? __APP_VERSION_NAME__.trim() : '1.0';
  return { versionCode: code, versionName: name };
}

export function isNativeAndroidPlatform(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

export function formatBytesArabic(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 ميجابايت';
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} ميجابايت`;
}

export function isVersionSnoozedForSession(versionCode: number): boolean {
  try {
    const val = sessionStorage.getItem(SNOOZE_SESSION_KEY);
    return val !== null && Number(val) === Number(versionCode);
  } catch {
    return false;
  }
}

export function snoozeVersionForSession(versionCode: number): void {
  try {
    sessionStorage.setItem(SNOOZE_SESSION_KEY, String(versionCode));
  } catch {}
}

export function clearSnoozedVersion(): void {
  try {
    sessionStorage.removeItem(SNOOZE_SESSION_KEY);
  } catch {}
}

function getEffectiveWebVersion(): { versionCode: number; versionName: string } {
  const compiled = getCompiledVersionInfo();
  try {
    const raw = localStorage.getItem(APPLIED_WEB_VERSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.versionCode === 'number' && parsed.versionCode > compiled.versionCode) {
        return {
          versionCode: parsed.versionCode,
          versionName: String(parsed.versionName || compiled.versionName)
        };
      }
    }
  } catch {}
  return compiled;
}

export const appUpdateService = {
  isNativeAndroid: isNativeAndroidPlatform,

  async getInstalledAppInfo(): Promise<InstalledAppInfo> {
    if (isNativeAndroidPlatform()) {
      try {
        const info = await AppUpdateNative.getInstalledAppInfo();
        return {
          platform: 'android',
          packageName: info.packageName || EXPECTED_ANDROID_PACKAGE_NAME,
          versionCode: Number(info.versionCode) || 1,
          versionName: info.versionName || '1.0',
          sdkInt: Number(info.sdkInt) || undefined,
          signingDigests: Array.isArray(info.signingDigests) ? info.signingDigests : [],
          canRequestPackageInstalls: Boolean(info.canRequestPackageInstalls)
        };
      } catch (err) {
        console.warn('Native getInstalledAppInfo fallback notice:', err);
      }
    }

    const webVer = getEffectiveWebVersion();
    return {
      platform: 'web',
      packageName: EXPECTED_ANDROID_PACKAGE_NAME,
      versionCode: webVer.versionCode,
      versionName: webVer.versionName
    };
  },

  async cleanupNativeUpdateCache(): Promise<void> {
    if (!isNativeAndroidPlatform()) return;
    try {
      await AppUpdateNative.cleanupUpdateFiles();
    } catch {
      // Ignore cleanup errors on startup
    }
  },

  async fetchLatestUpdateConfig(): Promise<{
    config: AppUpdateConfig | null;
    source: 'server' | 'firestore' | 'none';
  }> {
    let serverConfig: AppUpdateConfig | null = null;
    let firestoreConfig: AppUpdateConfig | null = null;

    // 1. Try Express API manifest
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(getApiUrl('/api/app-update/latest'), {
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data && data.config && typeof data.config === 'object') {
          serverConfig = data.config as AppUpdateConfig;
        }
      }
    } catch {
      // Continue cleanly to Firestore fallback
    }

    // 2. Fetch Firestore settings/app_update as cloud source of truth or fallback
    try {
      firestoreConfig = await firestoreService.fetchAppUpdateConfig();
    } catch {
      // Ignore offline/network errors
    }

    if (serverConfig && firestoreConfig) {
      const serverTime = Date.parse(serverConfig.updatedAt || '') || 0;
      const fsTime = Date.parse(firestoreConfig.updatedAt || '') || 0;
      if (fsTime > serverTime && firestoreConfig.enabled) {
        return { config: firestoreConfig, source: 'firestore' };
      }
      if (!serverConfig.enabled && firestoreConfig.enabled) {
        return { config: firestoreConfig, source: 'firestore' };
      }
      return { config: serverConfig, source: 'server' };
    }

    if (serverConfig) return { config: serverConfig, source: 'server' };
    if (firestoreConfig) return { config: firestoreConfig, source: 'firestore' };
    return { config: null, source: 'none' };
  },

  async checkForUpdates(options?: {
    swWaitingReady?: boolean;
  }): Promise<UpdateCheckResult> {
    const installed = await this.getInstalledAppInfo();
    const { config: remoteConfig, source } = await this.fetchLatestUpdateConfig();
    const compatibility = checkUpdateCompatibility(installed, remoteConfig);

    let swUpdateReady = Boolean(options?.swWaitingReady);
    if (!swUpdateReady && installed.platform === 'web' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.waiting && navigator.serviceWorker.controller) {
          swUpdateReady = true;
        }
      } catch {}
    }

    const updateAvailable = compatibility.updateAvailable || (installed.platform === 'web' && swUpdateReady);
    return {
      checked: true,
      updateAvailable,
      compatible: compatibility.compatible,
      platform: installed.platform,
      installed,
      remoteConfig,
      compatibility,
      swUpdateReady,
      source: swUpdateReady && !compatibility.updateAvailable ? 'service_worker' : source
    };
  },

  async canInstallPackages(): Promise<boolean> {
    if (!isNativeAndroidPlatform()) return true;
    try {
      const res = await AppUpdateNative.canInstallPackages();
      return Boolean(res.allowed);
    } catch {
      return false;
    }
  },

  async openInstallPermissionSettings(): Promise<boolean> {
    if (!isNativeAndroidPlatform()) return false;
    try {
      const res = await AppUpdateNative.openInstallPermissionSettings();
      return Boolean(res.opened || res.alreadyAllowed);
    } catch {
      return false;
    }
  },

  async cancelDownload(): Promise<void> {
    if (!isNativeAndroidPlatform()) return;
    try {
      await AppUpdateNative.cancelDownload();
    } catch {}
  },

  async retryInstallAfterPermission(
    onProgress: (state: UpdateProgressState) => void
  ): Promise<{ started: boolean; needsPermission: boolean }> {
    if (!isNativeAndroidPlatform()) {
      return { started: false, needsPermission: false };
    }
    const allowed = await this.canInstallPackages();
    if (!allowed) {
      onProgress({
        phase: 'permission_required',
        progress: 100,
        downloadedBytes: 0,
        totalBytes: 0
      });
      return { started: false, needsPermission: true };
    }

    onProgress({
      phase: 'installing',
      progress: 100,
      downloadedBytes: 0,
      totalBytes: 0
    });
    const res = await AppUpdateNative.installVerifiedApk();
    return { started: Boolean(res.started), needsPermission: Boolean(res.needsPermission) };
  },

  async downloadAndInstallUpdate(
    checkResult: UpdateCheckResult,
    onProgress: (state: UpdateProgressState) => void
  ): Promise<{ started: boolean; needsPermission?: boolean; reloaded?: boolean }> {
    const installed = await this.getInstalledAppInfo();

    // Native Android APK in-place update flow
    if (installed.platform === 'android') {
      const remoteConfig = checkResult.remoteConfig;
      const compatibility = checkUpdateCompatibility(installed, remoteConfig);

      if (!remoteConfig || !compatibility.updateAvailable || !compatibility.compatible) {
        onProgress({
          phase: 'error',
          progress: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          errorCode: compatibility.reasonCode || 'INCOMPATIBLE_UPDATE',
          errorMessage: compatibility.reasonMessage || 'التحديث غير متوافق مع النسخة المثبتة حالياً.'
        });
        return { started: false };
      }

      const target = remoteConfig.android;
      let listenerHandle: PluginListenerHandle | null = null;

      try {
        onProgress({
          phase: 'downloading',
          progress: 0,
          downloadedBytes: 0,
          totalBytes: target.fileSize || 0
        });

        listenerHandle = await AppUpdateNative.addListener('updateDownloadProgress', (evt) => {
          onProgress({
            phase: evt.phase === 'verifying' ? 'verifying' : 'downloading',
            progress: Math.max(0, Math.min(100, Number(evt.progress) || 0)),
            downloadedBytes: Number(evt.downloadedBytes) || 0,
            totalBytes: Number(evt.totalBytes) || target.fileSize || 0
          });
        });

        await AppUpdateNative.downloadAndVerifyApk({
          url: target.downloadUrl,
          expectedSha256: target.sha256,
          expectedFileSize: target.fileSize > 0 ? target.fileSize : undefined,
          expectedVersionCode: target.versionCode,
          minSdkVersion: target.minSdkVersion
        });

        onProgress({
          phase: 'ready_to_install',
          progress: 100,
          downloadedBytes: target.fileSize || 0,
          totalBytes: target.fileSize || 0
        });

        const allowed = await this.canInstallPackages();
        if (!allowed) {
          onProgress({
            phase: 'permission_required',
            progress: 100,
            downloadedBytes: target.fileSize || 0,
            totalBytes: target.fileSize || 0
          });
          return { started: false, needsPermission: true };
        }

        onProgress({
          phase: 'installing',
          progress: 100,
          downloadedBytes: target.fileSize || 0,
          totalBytes: target.fileSize || 0
        });

        const installRes = await AppUpdateNative.installVerifiedApk();
        if (installRes.needsPermission) {
          onProgress({
            phase: 'permission_required',
            progress: 100,
            downloadedBytes: target.fileSize || 0,
            totalBytes: target.fileSize || 0
          });
          return { started: false, needsPermission: true };
        }

        return { started: Boolean(installRes.started), needsPermission: false };
      } catch (err: any) {
        const message =
          err?.message ||
          err?.errorMessage ||
          'تعذر تنزيل التحديث أو التحقق من سلامته. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة.';
        onProgress({
          phase: 'error',
          progress: 0,
          downloadedBytes: 0,
          totalBytes: target.fileSize || 0,
          errorCode: err?.code || 'UPDATE_FAILED',
          errorMessage: message
        });
        return { started: false };
      } finally {
        if (listenerHandle) {
          try {
            await listenerHandle.remove();
          } catch {}
        }
      }
    }

    // Web / PWA seamless update flow (strictly preserves localStorage, sessionStorage & IndexedDB)
    try {
      onProgress({
        phase: 'downloading',
        progress: 25,
        downloadedBytes: 0,
        totalBytes: 0
      });

      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update().catch(() => {});
          onProgress({ phase: 'verifying', progress: 70, downloadedBytes: 0, totalBytes: 0 });

          if (reg.waiting) {
            await new Promise<void>((resolve) => {
              let done = false;
              const onController = () => {
                if (done) return;
                done = true;
                navigator.serviceWorker.removeEventListener('controllerchange', onController);
                resolve();
              };
              navigator.serviceWorker.addEventListener('controllerchange', onController);
              reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
              setTimeout(() => {
                if (!done) {
                  done = true;
                  navigator.serviceWorker.removeEventListener('controllerchange', onController);
                  resolve();
                }
              }, 1500);
            });
          }
        }
      }

      // Record applied web release metadata without modifying user session or registry stores
      if (checkResult.remoteConfig?.web) {
        try {
          localStorage.setItem(
            APPLIED_WEB_VERSION_KEY,
            JSON.stringify({
              versionCode: checkResult.remoteConfig.web.versionCode,
              versionName: checkResult.remoteConfig.web.versionName,
              appliedAt: new Date().toISOString()
            })
          );
        } catch {}
      }

      onProgress({
        phase: 'installing',
        progress: 100,
        downloadedBytes: 0,
        totalBytes: 0
      });

      setTimeout(() => {
        window.location.reload();
      }, 350);

      return { started: true, reloaded: true };
    } catch (err: any) {
      onProgress({
        phase: 'error',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        errorCode: 'WEB_UPDATE_FAILED',
        errorMessage: err?.message || 'تعذر تطبيق تحديث الويب. يرجى المحاولة مرة أخرى.'
      });
      return { started: false };
    }
  },

  async saveUpdateConfig(
    input: AppUpdateConfig,
    actorEmail = 'admin'
  ): Promise<{ success: boolean; config?: AppUpdateConfig; error?: string }> {
    const validated = validateAndNormalizeAppUpdateConfig(input, actorEmail);
    if (!validated.valid) {
      return { success: false, error: validated.error };
    }

    let serverSaved = false;
    let firestoreSaved = false;
    let lastError = '';

    // 1. Save to Express server if authenticated
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(getApiUrl('/api/app-update/config'), {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(validated.config)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        serverSaved = true;
      } else if (data?.error) {
        lastError = data.error;
      }
    } catch (err: any) {
      lastError = err?.message || '';
    }

    // 2. Save directly to Firestore settings/app_update
    try {
      await firestoreService.saveAppUpdateConfig(validated.config);
      firestoreSaved = true;
    } catch (err: any) {
      if (!lastError) {
        lastError = err?.message || 'تعذر الحفظ في قاعدة البيانات السحابية';
      }
    }

    if (serverSaved || firestoreSaved) {
      return { success: true, config: validated.config };
    }
    return {
      success: false,
      error: lastError || 'تعذر حفظ إعدادات التحديث. تأكد من صلاحيات المسؤول واتصال الإنترنت.'
    };
  }
};
