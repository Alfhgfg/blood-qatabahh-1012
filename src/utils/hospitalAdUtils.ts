import { HospitalAd } from '../types';

export interface OptimizedBannerResult {
  dataUrl: string;
  width: number;
  height: number;
  originalBytes: number;
  optimizedBytes: number;
}

export function getLocalTodayDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isHospitalAdCurrentlyVisible(ad: HospitalAd, referenceDate = new Date()): boolean {
  if (!ad || !ad.isActive || !ad.imageUrl) return false;
  const today = getLocalTodayDateString(referenceDate);
  if (ad.startDate && today < ad.startDate) return false;
  if (ad.endDate && today > ad.endDate) return false;
  return true;
}

export type HospitalAdStatus = 'active' | 'scheduled' | 'expired' | 'paused';

export function getHospitalAdStatus(
  ad: HospitalAd,
  referenceDate = new Date()
): { status: HospitalAdStatus; label: string } {
  if (!ad.isActive) {
    return { status: 'paused', label: 'متوقف' };
  }
  const today = getLocalTodayDateString(referenceDate);
  if (ad.startDate && today < ad.startDate) {
    return { status: 'scheduled', label: 'مجدول' };
  }
  if (ad.endDate && today > ad.endDate) {
    return { status: 'expired', label: 'منتهي' };
  }
  return { status: 'active', label: 'نشط الآن' };
}

export function sortHospitalAds(ads: HospitalAd[]): HospitalAd[] {
  return [...ads].sort((a, b) => {
    const orderA = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : 9999;
    const orderB = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : 9999;
    if (orderA !== orderB) return orderA - orderB;
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
}

export function sanitizeWebsiteUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  let trimmed = rawUrl.trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return '';
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    // Allow domain-like inputs such as www.example.com or hospital.ye
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#].*)?$/i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    } else {
      return '';
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

export function isValidImageSource(src?: string): boolean {
  if (!src) return false;
  const trimmed = src.trim();
  if (!trimmed) return false;
  if (/^data:image\/(webp|jpeg|jpg|png|gif);base64,/i.test(trimmed)) {
    return trimmed.length <= 300000;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function formatReadableSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function optimizeBannerImage(file: File): Promise<OptimizedBannerResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('حجم الصورة كبير جداً (الحد الأقصى 15 ميجابايت)');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('تعذر معالجة الصورة المختارة'));
    el.src = rawDataUrl;
  });

  const MAX_WIDTH = 760;
  const MAX_HEIGHT = 420;
  const MAX_DATA_URL_LENGTH = 185000;

  let scale = Math.min(MAX_WIDTH / img.width, MAX_HEIGHT / img.height, 1);
  let targetW = Math.max(1, Math.round(img.width * scale));
  let targetH = Math.max(1, Math.round(img.height * scale));

  const renderToDataUrl = (w: number, h: number, mimeType: string, quality: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('تعذر تهيئة أداة ضغط الصور في المتصفح');
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL(mimeType, quality);
  };

  // Prefer WebP for minimal mobile bandwidth, fallback to JPEG if browser lacks WebP encoder
  let mimeType = 'image/webp';
  let testWebp = renderToDataUrl(Math.min(32, targetW), Math.min(32, targetH), 'image/webp', 0.8);
  if (!testWebp.startsWith('data:image/webp')) {
    mimeType = 'image/jpeg';
  }

  let dataUrl = renderToDataUrl(targetW, targetH, mimeType, 0.8);
  const qualities = [0.72, 0.62, 0.52];
  for (const q of qualities) {
    if (dataUrl.length <= MAX_DATA_URL_LENGTH) break;
    dataUrl = renderToDataUrl(targetW, targetH, mimeType, q);
  }

  // If still large (e.g. very complex high-detail image), reduce dimensions slightly
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    targetW = Math.max(320, Math.round(targetW * 0.75));
    targetH = Math.max(90, Math.round(targetH * 0.75));
    dataUrl = renderToDataUrl(targetW, targetH, mimeType, 0.65);
  }

  if (dataUrl.length > 290000) {
    throw new Error('حجم الصورة بعد الضغط لا يزال كبيراً، يرجى اختيار صورة أصغر أو أقل تعقيداً.');
  }

  const base64Part = dataUrl.split(',')[1] || '';
  const optimizedBytes = Math.round((base64Part.length * 3) / 4);

  return {
    dataUrl,
    width: targetW,
    height: targetH,
    originalBytes: file.size,
    optimizedBytes
  };
}
