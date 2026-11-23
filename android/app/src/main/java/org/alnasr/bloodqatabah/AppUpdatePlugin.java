package org.alnasr.bloodqatabah;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;
import androidx.core.content.pm.PackageInfoCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Native Capacitor Plugin for safe, in-place Android APK updates.
 * - Verifies packageName, versionCode > installedVersionCode, minSdkVersion,
 *   file size, ZIP/APK magic header, SHA-256 checksum, and signing certificate match.
 * - Installs over the existing app via FileProvider without requiring uninstall,
 *   preserving all user accounts, localStorage, IndexedDB, and active sessions.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    private static final String TAG = "AppUpdatePlugin";
    private static final String UPDATES_SUBDIR = "updates";
    private static final String PART_APK_FILENAME = "blood-qatabah-update.apk.part";
    private static final String VERIFIED_APK_FILENAME = "blood-qatabah-update.apk";
    private static final long MAX_APK_SIZE_BYTES = 250L * 1024L * 1024L; // 250 MB safety cap
    private static final int CONNECT_TIMEOUT_MS = 20000;
    private static final int READ_TIMEOUT_MS = 30000;
    private static final int MAX_REDIRECTS = 5;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean downloadCancelled = new AtomicBoolean(false);
    private final AtomicBoolean downloadInProgress = new AtomicBoolean(false);

    @PluginMethod
    public void getInstalledAppInfo(PluginCall call) {
        try {
            Context context = getContext();
            PackageInfo pkgInfo = getInstalledPackageInfo(context);
            long versionCode = PackageInfoCompat.getLongVersionCode(pkgInfo);
            String versionName = pkgInfo.versionName != null ? pkgInfo.versionName : "1.0";
            List<String> signingDigests = extractSigningDigests(pkgInfo);

            JSArray digestsArr = new JSArray();
            for (String d : signingDigests) {
                digestsArr.put(d);
            }

            JSObject ret = new JSObject();
            ret.put("packageName", context.getPackageName());
            ret.put("versionCode", versionCode);
            ret.put("versionName", versionName);
            ret.put("sdkInt", Build.VERSION.SDK_INT);
            ret.put("signingDigests", digestsArr);
            ret.put("canRequestPackageInstalls", canAppInstallPackages(context));
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "getInstalledAppInfo failed", e);
            call.reject("FAILED_GET_APP_INFO", e.getMessage(), e);
        }
    }

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("allowed", canAppInstallPackages(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        try {
            Context context = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("opened", true);
                ret.put("alreadyAllowed", canAppInstallPackages(context));
                call.resolve(ret);
            } else {
                JSObject ret = new JSObject();
                ret.put("opened", false);
                ret.put("alreadyAllowed", true);
                call.resolve(ret);
            }
        } catch (Exception e) {
            Log.e(TAG, "openInstallPermissionSettings failed", e);
            call.reject("PERMISSION_SETTINGS_ERROR", e.getMessage(), e);
        }
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        downloadCancelled.set(true);
        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void cleanupUpdateFiles(PluginCall call) {
        try {
            File updatesDir = getConfinedUpdatesDir(getContext());
            int deleted = 0;
            if (updatesDir.exists() && updatesDir.isDirectory()) {
                File[] files = updatesDir.listFiles();
                if (files != null) {
                    for (File f : files) {
                        if (f.isFile() && f.delete()) {
                            deleted++;
                        }
                    }
                }
            }
            JSObject ret = new JSObject();
            ret.put("cleaned", true);
            ret.put("deletedCount", deleted);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("CLEANUP_ERROR", e.getMessage(), e);
        }
    }

    @PluginMethod
    public void downloadAndVerifyApk(PluginCall call) {
        String downloadUrl = call.getString("url", "");
        String expectedSha256 = call.getString("expectedSha256", "");
        Long expectedFileSizeObj = call.getLong("expectedFileSize");
        Long expectedVersionCodeObj = call.getLong("expectedVersionCode");
        Integer expectedMinSdkObj = call.getInt("minSdkVersion");

        if (downloadUrl == null || !downloadUrl.trim().toLowerCase(Locale.US).startsWith("https://")) {
            call.reject("INVALID_URL", "يجب أن يكون رابط تنزيل التحديث بصيغة HTTPS آمنة.");
            return;
        }

        if (!downloadInProgress.compareAndSet(false, true)) {
            call.reject("DOWNLOAD_IN_PROGRESS", "عملية تنزيل التحديث قيد التنفيذ بالفعل.");
            return;
        }

        downloadCancelled.set(false);
        final String cleanUrl = downloadUrl.trim();
        final String normExpectedSha = expectedSha256 != null ? expectedSha256.trim().toLowerCase(Locale.US) : "";
        final long expectedFileSize = expectedFileSizeObj != null ? expectedFileSizeObj : 0L;
        final long expectedVersionCode = expectedVersionCodeObj != null ? expectedVersionCodeObj : 0L;
        final int expectedMinSdk = expectedMinSdkObj != null ? expectedMinSdkObj : 0;

        executor.execute(() -> {
            HttpURLConnection conn = null;
            File partFile = null;
            try {
                Context context = getContext();
                File updatesDir = getConfinedUpdatesDir(context);
                if (!updatesDir.exists() && !updatesDir.mkdirs()) {
                    throw new UpdateException("STORAGE_ERROR", "تعذر إنشاء مجلد التخزين المؤقت للتحديث.");
                }

                // Remove any previous update files first
                File existingVerified = new File(updatesDir, VERIFIED_APK_FILENAME);
                if (existingVerified.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    existingVerified.delete();
                }
                partFile = new File(updatesDir, PART_APK_FILENAME);
                if (partFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    partFile.delete();
                }

                verifyCanonicalChild(updatesDir, partFile);
                verifyCanonicalChild(updatesDir, existingVerified);

                emitProgress("downloading", 0, 0L, expectedFileSize);

                conn = openHttpsWithSafeRedirects(cleanUrl, 0);
                int statusCode = conn.getResponseCode();
                if (statusCode != HttpURLConnection.HTTP_OK) {
                    throw new UpdateException("HTTP_ERROR", "فشل تنزيل التحديث من الخادم (رمز الاستجابة " + statusCode + ").");
                }

                long contentLength = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N
                        ? conn.getContentLengthLong()
                        : conn.getContentLength();

                if (contentLength > MAX_APK_SIZE_BYTES) {
                    throw new UpdateException("FILE_TOO_LARGE", "حجم ملف التحديث يتجاوز الحد المسموح به.");
                }
                if (expectedFileSize > 0 && contentLength > 0 && contentLength != expectedFileSize) {
                    throw new UpdateException("FILE_SIZE_MISMATCH", "حجم الملف المستلم لا يطابق الحجم المسجل للتحديث.");
                }

                long totalBytes = contentLength > 0 ? contentLength : expectedFileSize;
                MessageDigest sha256Digest = MessageDigest.getInstance("SHA-256");
                byte[] buffer = new byte[16384];
                long downloadedBytes = 0L;
                long lastEmitTime = 0L;
                int lastEmitPercent = -1;

                try (InputStream in = new BufferedInputStream(conn.getInputStream());
                     FileOutputStream out = new FileOutputStream(partFile, false)) {
                    int bytesRead;
                    while ((bytesRead = in.read(buffer)) != -1) {
                        if (downloadCancelled.get()) {
                            throw new UpdateException("CANCELLED", "تم إلغاء تنزيل التحديث.");
                        }
                        downloadedBytes += bytesRead;
                        if (downloadedBytes > MAX_APK_SIZE_BYTES) {
                            throw new UpdateException("FILE_TOO_LARGE", "تجاوز حجم التنزيل الحد الأقصى المسموح.");
                        }
                        out.write(buffer, 0, bytesRead);
                        sha256Digest.update(buffer, 0, bytesRead);

                        int percent = totalBytes > 0
                                ? (int) Math.min(99L, Math.round((downloadedBytes * 100.0) / totalBytes))
                                : 0;
                        long now = System.currentTimeMillis();
                        if (percent != lastEmitPercent || (now - lastEmitTime) >= 150) {
                            emitProgress("downloading", percent, downloadedBytes, totalBytes);
                            lastEmitPercent = percent;
                            lastEmitTime = now;
                        }
                    }
                    out.getFD().sync();
                }

                emitProgress("verifying", 100, downloadedBytes, totalBytes > 0 ? totalBytes : downloadedBytes);

                // 1. Non-empty check
                long actualSize = partFile.length();
                if (actualSize <= 0) {
                    throw new UpdateException("CORRUPT_APK", "ملف التحديث الذي تم تنزيله فارغ أو غير مكتمل.");
                }

                // 2. Exact size check when specified
                if (expectedFileSize > 0 && actualSize != expectedFileSize) {
                    throw new UpdateException("FILE_SIZE_MISMATCH", "حجم ملف التحديث لا يطابق الحجم المتوقع.");
                }

                // 3. ZIP / APK magic header check (PK\x03\x04)
                if (!hasValidApkMagicHeader(partFile)) {
                    throw new UpdateException("CORRUPT_APK", "ملف التحديث تالف أو ليس حزمة تطبيق أندرويد صالحة.");
                }

                // 4. SHA-256 checksum verification
                String actualSha256 = bytesToHex(sha256Digest.digest());
                if (!normExpectedSha.isEmpty() && !actualSha256.equals(normExpectedSha)) {
                    throw new UpdateException("INTEGRITY_CHECKSUM_MISMATCH", "فشل التحقق من سلامة الملف (عدم تطابق البصمة الرقمية SHA-256).");
                }

                // 5. Package archive metadata, compatibility & signing key verification
                PackageInfo installedPkg = getInstalledPackageInfo(context);
                long installedVersionCode = PackageInfoCompat.getLongVersionCode(installedPkg);
                PackageInfo archivePkg = getArchivePackageInfo(context.getPackageManager(), partFile.getAbsolutePath());

                if (archivePkg == null) {
                    throw new UpdateException("CORRUPT_APK", "تعذر قراءة بيانات حزمة التحديث (APK).");
                }

                if (!context.getPackageName().equals(archivePkg.packageName)) {
                    throw new UpdateException(
                            "PACKAGE_MISMATCH",
                            "ملف التحديث لا يخص هذا التطبيق (" + archivePkg.packageName + ")."
                    );
                }

                long archiveVersionCode = PackageInfoCompat.getLongVersionCode(archivePkg);
                if (archiveVersionCode <= installedVersionCode) {
                    throw new UpdateException(
                            "VERSION_NOT_NEWER",
                            "إصدار الملف (" + archiveVersionCode + ") ليس أحدث من الإصدار المثبت (" + installedVersionCode + ")."
                    );
                }

                if (expectedVersionCode > 0 && archiveVersionCode != expectedVersionCode) {
                    throw new UpdateException(
                            "VERSION_CODE_MISMATCH",
                            "رقم إصدار الحزمة (" + archiveVersionCode + ") لا يطابق الإصدار المعلن (" + expectedVersionCode + ")."
                    );
                }

                int archiveMinSdk = archivePkg.applicationInfo != null ? archivePkg.applicationInfo.minSdkVersion : 0;
                int effectiveMinSdk = Math.max(archiveMinSdk, expectedMinSdk);
                if (effectiveMinSdk > Build.VERSION.SDK_INT) {
                    throw new UpdateException(
                            "INCOMPATIBLE_SDK",
                            "هذا التحديث يتطلب إصدار أندرويد أحدث (SDK " + effectiveMinSdk + ")."
                    );
                }

                // Verify signing certificates match the currently installed app so Android updates in place
                Set<String> installedDigests = new HashSet<>(extractSigningDigests(installedPkg));
                Set<String> archiveDigests = new HashSet<>(extractSigningDigests(archivePkg));

                if (installedDigests.isEmpty() || archiveDigests.isEmpty()) {
                    throw new UpdateException(
                            "SIGNATURE_UNVERIFIED",
                            "تعذر التحقق من شهادة توقيع ملف التحديث."
                    );
                }

                boolean signaturesMatch = false;
                for (String digest : archiveDigests) {
                    if (installedDigests.contains(digest)) {
                        signaturesMatch = true;
                        break;
                    }
                }
                if (!signaturesMatch) {
                    throw new UpdateException(
                            "SIGNATURE_MISMATCH",
                            "توقيع التحديث الرقمي لا يطابق توقيع النسخة المثبتة حالياً. لحماية بياناتك ومنع طلب حذف التطبيق، تم رفض التثبيت."
                    );
                }

                // 6. Atomically promote verified .part file to verified APK file
                if (!partFile.renameTo(existingVerified)) {
                    throw new UpdateException("STORAGE_ERROR", "تعذر تجهيز ملف التحديث الموثق للتثبيت.");
                }

                JSObject result = new JSObject();
                result.put("verified", true);
                result.put("fileName", VERIFIED_APK_FILENAME);
                result.put("fileSize", actualSize);
                result.put("sha256", actualSha256);
                result.put("packageName", archivePkg.packageName);
                result.put("versionCode", archiveVersionCode);
                result.put("versionName", archivePkg.versionName != null ? archivePkg.versionName : "");
                call.resolve(result);
            } catch (UpdateException ue) {
                deleteQuietly(partFile);
                Log.w(TAG, "Update validation failed [" + ue.code + "]: " + ue.getMessage());
                call.reject(ue.code, ue.getMessage());
            } catch (Exception e) {
                deleteQuietly(partFile);
                Log.e(TAG, "Unexpected error during APK download/verification", e);
                call.reject("NETWORK_ERROR", "تعذر تنزيل التحديث أو التحقق منه: " + e.getMessage(), e);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
                downloadInProgress.set(false);
            }
        });
    }

    @PluginMethod
    public void installVerifiedApk(PluginCall call) {
        try {
            Context context = getContext();
            File updatesDir = getConfinedUpdatesDir(context);
            File apkFile = new File(updatesDir, VERIFIED_APK_FILENAME);
            verifyCanonicalChild(updatesDir, apkFile);

            if (!apkFile.exists() || apkFile.length() <= 0) {
                call.reject("APK_NOT_FOUND", "ملف التحديث غير موجود أو انتهت صلاحيته. يرجى إعادة التنزيل.");
                return;
            }

            if (!canAppInstallPackages(context)) {
                JSObject ret = new JSObject();
                ret.put("started", false);
                ret.put("needsPermission", true);
                call.resolve(ret);
                return;
            }

            Uri apkUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    apkFile
            );

            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            installIntent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
            installIntent.putExtra(Intent.EXTRA_RETURN_RESULT, false);

            context.startActivity(installIntent);

            JSObject ret = new JSObject();
            ret.put("started", true);
            ret.put("needsPermission", false);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "installVerifiedApk failed", e);
            call.reject("INSTALL_LAUNCH_FAILED", "تعذر فتح مثبت النظام للتحديث: " + e.getMessage(), e);
        }
    }

    private void emitProgress(String phase, int progress, long downloadedBytes, long totalBytes) {
        JSObject payload = new JSObject();
        payload.put("phase", phase);
        payload.put("progress", progress);
        payload.put("downloadedBytes", downloadedBytes);
        payload.put("totalBytes", totalBytes);
        notifyListeners("updateDownloadProgress", payload);
    }

    private static boolean canAppInstallPackages(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return context.getPackageManager().canRequestPackageInstalls();
        }
        return true;
    }

    private static File getConfinedUpdatesDir(Context context) {
        return new File(context.getCacheDir(), UPDATES_SUBDIR);
    }

    private static void verifyCanonicalChild(File parent, File child) throws IOException, UpdateException {
        String parentCanonical = parent.getCanonicalPath() + File.separator;
        String childCanonical = child.getCanonicalPath();
        if (!childCanonical.startsWith(parentCanonical)) {
            throw new UpdateException("INVALID_PATH", "مسار ملف التحديث غير مصرح به.");
        }
    }

    private static HttpURLConnection openHttpsWithSafeRedirects(String urlString, int depth) throws IOException, UpdateException {
        if (depth > MAX_REDIRECTS) {
            throw new UpdateException("TOO_MANY_REDIRECTS", "تجاوز رابط التحديث الحد الأقصى لإعادة التوجيه.");
        }
        URL url = new URL(urlString);
        if (!"https".equalsIgnoreCase(url.getProtocol())) {
            throw new UpdateException("INSECURE_URL", "يُمنع تنزيل التحديث عبر اتصال غير مشفر.");
        }

        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setInstanceFollowRedirects(false);
        conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
        conn.setReadTimeout(READ_TIMEOUT_MS);
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Accept", "application/vnd.android.package-archive, application/octet-stream, */*");

        int code = conn.getResponseCode();
        if (code == HttpURLConnection.HTTP_MOVED_PERM
                || code == HttpURLConnection.HTTP_MOVED_TEMP
                || code == HttpURLConnection.HTTP_SEE_OTHER
                || code == 307
                || code == 308) {
            String location = conn.getHeaderField("Location");
            conn.disconnect();
            if (location == null || location.trim().isEmpty()) {
                throw new UpdateException("HTTP_ERROR", "رابط إعادة توجيه التحديث غير صالح.");
            }
            URL nextUrl = new URL(url, location.trim());
            return openHttpsWithSafeRedirects(nextUrl.toString(), depth + 1);
        }
        return conn;
    }

    private static boolean hasValidApkMagicHeader(File file) {
        if (file == null || !file.exists() || file.length() < 4) return false;
        byte[] magic = new byte[4];
        try (FileInputStream fis = new FileInputStream(file)) {
            int read = fis.read(magic);
            return read == 4
                    && magic[0] == 0x50
                    && magic[1] == 0x4B
                    && magic[2] == 0x03
                    && magic[3] == 0x04;
        } catch (IOException e) {
            return false;
        }
    }

    @SuppressWarnings("deprecation")
    private static PackageInfo getInstalledPackageInfo(Context context) throws PackageManager.NameNotFoundException {
        PackageManager pm = context.getPackageManager();
        String pkgName = context.getPackageName();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return pm.getPackageInfo(pkgName, PackageManager.GET_SIGNING_CERTIFICATES);
        }
        return pm.getPackageInfo(pkgName, PackageManager.GET_SIGNATURES);
    }

    @SuppressWarnings("deprecation")
    private static PackageInfo getArchivePackageInfo(PackageManager pm, String archivePath) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageInfo info = pm.getPackageArchiveInfo(archivePath, PackageManager.GET_SIGNING_CERTIFICATES);
            if (info != null && info.signingInfo != null) {
                return info;
            }
            // Fallback if OEM archive parser populates legacy signatures only
            PackageInfo legacyInfo = pm.getPackageArchiveInfo(archivePath, PackageManager.GET_SIGNATURES);
            return legacyInfo != null ? legacyInfo : info;
        }
        return pm.getPackageArchiveInfo(archivePath, PackageManager.GET_SIGNATURES);
    }

    @SuppressWarnings("deprecation")
    private static List<String> extractSigningDigests(PackageInfo pkgInfo) throws NoSuchAlgorithmException {
        if (pkgInfo == null) return Collections.emptyList();
        Signature[] signatures = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && pkgInfo.signingInfo != null) {
            SigningInfo signingInfo = pkgInfo.signingInfo;
            if (signingInfo.hasMultipleSigners()) {
                signatures = signingInfo.getApkContentsSigners();
            } else {
                signatures = signingInfo.getSigningCertificateHistory();
            }
        }
        if ((signatures == null || signatures.length == 0) && pkgInfo.signatures != null) {
            signatures = pkgInfo.signatures;
        }
        if (signatures == null || signatures.length == 0) {
            return Collections.emptyList();
        }
        List<String> digests = new ArrayList<>();
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        for (Signature sig : signatures) {
            if (sig == null) continue;
            byte[] hash = md.digest(sig.toByteArray());
            digests.add(bytesToHex(hash));
            md.reset();
        }
        return digests;
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format(Locale.US, "%02x", b & 0xff));
        }
        return sb.toString();
    }

    private static void deleteQuietly(File file) {
        if (file != null && file.exists()) {
            //noinspection ResultOfMethodCallIgnored
            file.delete();
        }
    }

    private static final class UpdateException extends Exception {
        final String code;

        UpdateException(String code, String message) {
            super(message);
            this.code = code;
        }
    }
}
