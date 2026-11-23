import type {
  AppUpdateConfig,
  InstalledAppInfo,
  UpdateCompatibilityResult
} from '../types';

export declare const EXPECTED_ANDROID_PACKAGE_NAME: string;
export declare const DEFAULT_MIN_SDK_VERSION: number;
export declare const MAX_APK_FILE_SIZE_BYTES: number;

export declare function createDefaultAppUpdateConfig(): AppUpdateConfig;
export declare function isPrivateOrInternalHost(hostname: string): boolean;
export declare function validateSafeHttpsDownloadUrl(
  rawUrl: string
): { valid: true; url: string } | { valid: false; error: string };
export declare function isValidSha256Hex(sha256: string): boolean;
export declare function validateAndNormalizeAppUpdateConfig(
  input: unknown,
  updatedBy?: string
): { valid: true; config: AppUpdateConfig } | { valid: false; code?: string; error: string };
export declare function sanitizeLoadedAppUpdateConfig(raw: unknown): AppUpdateConfig;
export declare function compareVersionStrings(a: string, b: string): number;
export declare function checkUpdateCompatibility(
  installed: InstalledAppInfo,
  remoteConfig: AppUpdateConfig | null
): UpdateCompatibilityResult;
