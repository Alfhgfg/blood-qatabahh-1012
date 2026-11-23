import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface SaveFileOptions {
  filename: string;
  data: Uint8Array | ArrayBuffer | string;
  mimeType: string;
  title?: string;
  text?: string;
  dialogTitle?: string;
}

export interface SaveFileResult {
  success: boolean;
  filename: string;
  isNative: boolean;
  savedToDocuments?: boolean;
  shared?: boolean;
  uri?: string;
  error?: string;
}

/**
 * Converts a Uint8Array into a base64 string using chunking to avoid stack limits.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Converts a UTF-8 string into base64.
 */
export function stringToBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Robust cross-platform file saver and exporter.
 * In Android APK (Capacitor Native):
 *   - Writes binary or text files directly to device Cache and Documents storage via @capacitor/filesystem
 *   - Invokes native Android Share sheet via @capacitor/share so user can save to Downloads, Drive, WhatsApp, or open in Excel/Sheets
 * In Web Browser / PWA:
 *   - Uses HTML5 Blob download and Web Share API fallback
 */
export async function saveAndShareFile(options: SaveFileOptions): Promise<SaveFileResult> {
  const { filename, data, mimeType, title, text, dialogTitle } = options;
  const isNative = Capacitor.isNativePlatform();

  try {
    // 1. Prepare Base64 Representation
    let base64Data: string;
    let byteLength = 0;

    if (typeof data === 'string') {
      base64Data = stringToBase64(data);
      byteLength = data.length;
    } else if (data instanceof Uint8Array) {
      base64Data = uint8ArrayToBase64(data);
      byteLength = data.byteLength;
    } else {
      const u8 = new Uint8Array(data);
      base64Data = uint8ArrayToBase64(u8);
      byteLength = u8.byteLength;
    }

    // 2. NATIVE ANDROID / IOS FLOW
    if (isNative) {
      let savedUri = '';
      let savedToDocuments = false;

      // A. Write to device Cache directory (guaranteed writable, usable for Intent sharing)
      try {
        const cacheResult = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true
        });
        savedUri = cacheResult.uri;
      } catch (cacheErr) {
        console.warn('Failed to write to Directory.Cache, trying Data directory:', cacheErr);
        const dataResult = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Data,
          recursive: true
        });
        savedUri = dataResult.uri;
      }

      // B. Also attempt to save permanently in Documents so user can find it in their file manager
      try {
        await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });
        savedToDocuments = true;
      } catch (docErr) {
        console.warn('Could not save secondary copy in Documents directory:', docErr);
      }

      // C. Open native Android Share sheet with the written file
      let shared = false;
      try {
        const canShareRes = await Share.canShare().catch(() => ({ value: true }));
        if (canShareRes.value !== false) {
          await Share.share({
            title: title || filename,
            text: text || `ملف ${filename} (${Math.round(byteLength / 1024)} كيلوبايت)`,
            url: savedUri,
            files: [savedUri],
            dialogTitle: dialogTitle || 'تصدير ومشاركة الملف'
          });
          shared = true;
        }
      } catch (shareErr: any) {
        const isCancelled =
          shareErr?.message?.includes('cancel') ||
          shareErr?.message?.includes('Abort') ||
          shareErr?.name === 'AbortError';
        if (!isCancelled) {
          console.warn('Share dialog dismissed or encountered non-critical error:', shareErr);
        }
      }

      return {
        success: true,
        filename,
        isNative: true,
        savedToDocuments,
        shared,
        uri: savedUri
      };
    }

    // 3. WEB / PWA BROWSER FLOW
    let blob: Blob;
    if (typeof data === 'string') {
      blob = new Blob([data], { type: mimeType });
    } else if (data instanceof Uint8Array) {
      blob = new Blob([data as unknown as BlobPart], { type: mimeType });
    } else {
      blob = new Blob([data], { type: mimeType });
    }

    let handledByWebShare = false;

    // Optional: Web Share API if supported in browser with file
    if (typeof window !== 'undefined' && navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], filename, { type: mimeType });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: title || filename,
            text: text || filename
          });
          handledByWebShare = true;
          return {
            success: true,
            filename,
            isNative: false,
            shared: true
          };
        }
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') {
          return {
            success: true,
            filename,
            isNative: false,
            shared: true
          };
        }
        console.warn('Web Share failed, using standard download fallback:', shareErr);
      }
    }

    // Standard HTML5 download via Blob URL
    if (typeof window !== 'undefined') {
      try {
        const downloadUrl = window.URL.createObjectURL(blob);
        const tempLink = document.createElement('a');
        tempLink.href = downloadUrl;
        tempLink.setAttribute('download', filename);
        tempLink.style.display = 'none';
        document.body.appendChild(tempLink);
        tempLink.click();

        setTimeout(() => {
          try {
            document.body.removeChild(tempLink);
            window.URL.revokeObjectURL(downloadUrl);
          } catch {}
        }, 3000);

        return {
          success: true,
          filename,
          isNative: false
        };
      } catch (blobErr) {
        console.warn('Blob URL download failed, trying data URI:', blobErr);

        // Data URI fallback
        const dataUri = `data:${mimeType};base64,${base64Data}`;
        const dataLink = document.createElement('a');
        dataLink.href = dataUri;
        dataLink.setAttribute('download', filename);
        dataLink.style.display = 'none';
        document.body.appendChild(dataLink);
        dataLink.click();

        setTimeout(() => {
          try {
            document.body.removeChild(dataLink);
          } catch {}
        }, 3000);

        return {
          success: true,
          filename,
          isNative: false
        };
      }
    }

    return {
      success: true,
      filename,
      isNative: false
    };
  } catch (error: any) {
    console.error('saveAndShareFile error:', error);
    return {
      success: false,
      filename,
      isNative,
      error: error?.message || 'فشل حفظ وتصدير الملف'
    };
  }
}
