import { Doctor, Hospital } from '../types';

export interface OptimizedImageResult {
  dataUrl: string;
  width: number;
  height: number;
  originalBytes: number;
  optimizedBytes: number;
}

export function sortHospitals(hospitals: Hospital[]): Hospital[] {
  return [...hospitals].sort((a, b) => {
    const orderA = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : 9999;
    const orderB = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : 9999;
    if (orderA !== orderB) return orderA - orderB;
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
}

export function sortDoctors(doctors: Doctor[]): Doctor[] {
  return [...doctors].sort((a, b) => {
    const orderA = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : 9999;
    const orderB = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : 9999;
    if (orderA !== orderB) return orderA - orderB;
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeA - timeB;
  });
}

export function isValidDirectoryImageSource(src?: string, allowEmpty = false): boolean {
  if (!src || !src.trim()) {
    return allowEmpty;
  }
  const trimmed = src.trim();
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

export function formatImageBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function optimizeImageWithBounds(
  file: File,
  maxWidth: number,
  maxHeight: number,
  maxDataUrlLength: number
): Promise<OptimizedImageResult> {
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

  const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
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

  let mimeType = 'image/webp';
  const testWebp = renderToDataUrl(Math.min(32, targetW), Math.min(32, targetH), 'image/webp', 0.82);
  if (!testWebp.startsWith('data:image/webp')) {
    mimeType = 'image/jpeg';
  }

  let dataUrl = renderToDataUrl(targetW, targetH, mimeType, 0.84);
  const qualities = [0.76, 0.68, 0.58];
  for (const q of qualities) {
    if (dataUrl.length <= maxDataUrlLength) break;
    dataUrl = renderToDataUrl(targetW, targetH, mimeType, q);
  }

  if (dataUrl.length > maxDataUrlLength) {
    targetW = Math.max(240, Math.round(targetW * 0.78));
    targetH = Math.max(180, Math.round(targetH * 0.78));
    dataUrl = renderToDataUrl(targetW, targetH, mimeType, 0.65);
  }

  if (dataUrl.length > 290000) {
    throw new Error('حجم الصورة بعد الضغط لا يزال كبيراً، يرجى اختيار صورة أصغر.');
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

export async function optimizeHospitalCardImage(file: File): Promise<OptimizedImageResult> {
  return optimizeImageWithBounds(file, 820, 560, 195000);
}

export async function optimizeDoctorPortraitImage(file: File): Promise<OptimizedImageResult> {
  return optimizeImageWithBounds(file, 520, 520, 165000);
}
