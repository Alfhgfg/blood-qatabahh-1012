import React, { useState, useRef } from 'react';
import {
  Hospital,
  Upload,
  Plus,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Calendar,
  Phone,
  MapPin,
  Globe,
  CheckCircle2,
  AlertCircle,
  X,
  Image as ImageIcon,
  Save,
  Loader2
} from 'lucide-react';
import { HospitalAd } from '../types';
import { storageService } from '../services/storageService';
import {
  optimizeBannerImage,
  formatReadableSize,
  getHospitalAdStatus,
  getLocalTodayDateString,
  sanitizeWebsiteUrl
} from '../utils/hospitalAdUtils';

interface AdminHospitalAdsTabProps {
  hospitalAds: HospitalAd[];
  onHospitalAdsChange: (ads: HospitalAd[]) => void;
  onRefreshAuditLogs?: () => void;
}

function getDefaultEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return getLocalTodayDateString(d);
}

export const AdminHospitalAdsTab: React.FC<AdminHospitalAdsTabProps> = ({
  hospitalAds,
  onHospitalAdsChange,
  onRefreshAuditLogs
}) => {
  const formRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [editingAd, setEditingAd] = useState<HospitalAd | null>(null);
  const [hospitalName, setHospitalName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [useExternalImageUrl, setUseExternalImageUrl] = useState(false);
  const [startDate, setStartDate] = useState(() => getLocalTodayDateString());
  const [endDate, setEndDate] = useState(() => getDefaultEndDate());
  const [displayOrder, setDisplayOrder] = useState<number>(() => hospitalAds.length + 1);
  const [isActive, setIsActive] = useState(true);

  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [imageSizeInfo, setImageSizeInfo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [busyAdId, setBusyAdId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const resetForm = (nextOrder?: number) => {
    setEditingAd(null);
    setHospitalName('');
    setPhone('');
    setAddress('');
    setWebsiteUrl('');
    setDescription('');
    setImageUrl('');
    setUseExternalImageUrl(false);
    setStartDate(getLocalTodayDateString());
    setEndDate(getDefaultEndDate());
    setDisplayOrder(nextOrder ?? hospitalAds.length + 1);
    setIsActive(true);
    setImageSizeInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartEdit = (ad: HospitalAd) => {
    setEditingAd(ad);
    setHospitalName(ad.hospitalName);
    setPhone(ad.phone);
    setAddress(ad.address);
    setWebsiteUrl(ad.websiteUrl || '');
    setDescription(ad.description || '');
    setImageUrl(ad.imageUrl);
    setUseExternalImageUrl(/^https?:\/\//i.test(ad.imageUrl));
    setStartDate(ad.startDate || getLocalTodayDateString());
    setEndDate(ad.endDate || getDefaultEndDate());
    setDisplayOrder(ad.displayOrder || 1);
    setIsActive(ad.isActive);
    setImageSizeInfo(null);
    setFeedback(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOptimizingImage(true);
    setFeedback(null);
    try {
      const result = await optimizeBannerImage(file);
      setImageUrl(result.dataUrl);
      setImageSizeInfo(
        `تم ضغط الصورة تلقائياً: ${formatReadableSize(result.optimizedBytes)} (بدلاً من ${formatReadableSize(result.originalBytes)}) · ${result.width}×${result.height}`
      );
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'تعذر معالجة الصورة المختارة' });
    } finally {
      setIsOptimizingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSaving(true);

    try {
      const saved = await storageService.saveHospitalAd(
        {
          hospitalName,
          imageUrl,
          phone,
          address,
          websiteUrl,
          description,
          startDate,
          endDate,
          isActive,
          displayOrder
        },
        editingAd
      );

      const refreshed = await storageService.getHospitalAds();
      onHospitalAdsChange(refreshed);
      onRefreshAuditLogs?.();

      setFeedback({
        type: 'success',
        text: editingAd
          ? `تم تحديث إعلان "${saved.hospitalName}" بنجاح ✅`
          : `تمت إضافة إعلان "${saved.hospitalName}" ونشره في قاعدة البيانات بنجاح ✅`
      });
      resetForm(refreshed.length + 1);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'حدث خطأ أثناء حفظ الإعلان'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (ad: HospitalAd) => {
    setBusyAdId(ad.id);
    setFeedback(null);
    try {
      await storageService.saveHospitalAd(
        {
          hospitalName: ad.hospitalName,
          imageUrl: ad.imageUrl,
          phone: ad.phone,
          address: ad.address,
          websiteUrl: ad.websiteUrl,
          description: ad.description,
          startDate: ad.startDate,
          endDate: ad.endDate,
          isActive: !ad.isActive,
          displayOrder: ad.displayOrder
        },
        ad
      );
      const refreshed = await storageService.getHospitalAds();
      onHospitalAdsChange(refreshed);
      onRefreshAuditLogs?.();
      setFeedback({
        type: 'success',
        text: !ad.isActive
          ? `تم تفعيل إعلان "${ad.hospitalName}" بنجاح`
          : `تم إيقاف إعلان "${ad.hospitalName}" مؤقتاً`
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'تعذر تغيير حالة الإعلان' });
    } finally {
      setBusyAdId(null);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= hospitalAds.length) return;

    const nextList = [...hospitalAds];
    const [moved] = nextList.splice(index, 1);
    nextList.splice(targetIndex, 0, moved);

    setBusyAdId(moved.id);
    setFeedback(null);
    try {
      const reordered = await storageService.reorderHospitalAds(nextList);
      onHospitalAdsChange(reordered);
      setFeedback({ type: 'success', text: 'تم تحديث ترتيب ظهور الإعلانات بنجاح' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'تعذر تحديث الترتيب' });
    } finally {
      setBusyAdId(null);
    }
  };

  const handleDelete = async (ad: HospitalAd) => {
    setBusyAdId(ad.id);
    setFeedback(null);
    try {
      await storageService.deleteHospitalAd(ad.id, ad.hospitalName);
      const refreshed = await storageService.getHospitalAds();
      onHospitalAdsChange(refreshed);
      onRefreshAuditLogs?.();
      setConfirmDeleteId(null);
      if (editingAd?.id === ad.id) {
        resetForm(refreshed.length + 1);
      }
      setFeedback({ type: 'success', text: `تم حذف إعلان "${ad.hospitalName}" بنجاح` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'تعذر حذف الإعلان' });
    } finally {
      setBusyAdId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
            aria-label="إغلاق التنبيه"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Create / Edit Hospital Ad Form */}
      <div
        ref={formRef}
        className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 flex items-center justify-center shrink-0">
              <Hospital className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                {editingAd ? `تعديل إعلان: ${editingAd.hospitalName}` : 'إضافة إعلان مستشفى أو مركز طبي جديد'}
              </h3>
              <p className="text-xs text-slate-500">
                يظهر كبانر متحرك في الصفحة الرئيسية مع صفحة تفاصيل كاملة، وتُضغط الصور تلقائياً لتقليل استهلاك الإنترنت
              </p>
            </div>
          </div>

          {editingAd && (
            <button
              type="button"
              onClick={() => resetForm()}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>إلغاء التعديل</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Banner Image Upload & Preview */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-rose-700" />
                <span>صورة البانر الإعلاني (مقاس عرض كامل بارتفاع 85-110 بكسل):</span>
              </label>

              <button
                type="button"
                onClick={() => setUseExternalImageUrl(!useExternalImageUrl)}
                className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
              >
                {useExternalImageUrl ? 'رفع صورة من الجهاز بدلاً من الرابط' : 'أو إدخال رابط صورة مباشر (URL)'}
              </button>
            </div>

            {!useExternalImageUrl ? (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                  id="hospital-ad-image-upload"
                />
                <label
                  htmlFor="hospital-ad-image-upload"
                  className="px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-2 transition-all active:scale-98"
                >
                  {isOptimizingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{isOptimizingImage ? 'جاري ضغط الصورة...' : imageUrl ? 'تغيير صورة الإعلان' : 'اختيار صورة الإعلان'}</span>
                </label>

                {imageSizeInfo && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    {imageSizeInfo}
                  </span>
                )}
              </div>
            ) : (
              <div>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/hospital-banner.webp"
                  dir="ltr"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono focus:outline-hidden focus:border-rose-600"
                />
              </div>
            )}

            {/* Live Banner Proportion Preview */}
            {imageUrl && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 block">
                  معاينة شكل البانر في الصفحة الرئيسية:
                </span>
                <div className="relative w-full h-[96px] sm:h-[108px] rounded-2xl overflow-hidden border border-slate-300/80 bg-slate-900">
                  <img
                    src={imageUrl}
                    alt="معاينة بانر الإعلان"
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 via-slate-950/25 to-transparent px-3 py-1.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-white truncate">
                      {hospitalName || 'اسم المستشفى أو المركز الطبي'}
                    </span>
                    <span className="text-[10px] font-bold text-white bg-rose-700/85 px-2 py-0.5 rounded-md">
                      التفاصيل
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Hospital Details Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم المستشفى أو المركز الطبي <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                placeholder="مثال: مستشفى السلام التخصصي - قعطبة"
                required
                maxLength={150}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم التواصل <span className="text-rose-600">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="مثال: 777123456 أو 02450123"
                required
                dir="ltr"
                maxLength={25}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-sans text-right focus:outline-hidden focus:border-rose-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                العنوان بالتفصيل <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="مثال: مديرية قعطبة - الشارع العام - جوار..."
                required
                maxLength={250}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رابط الموقع الإلكتروني أو الإعلان (اختياري)
              </label>
              <input
                type="text"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://hospital-example.com"
                dir="ltr"
                maxLength={500}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-hidden focus:border-rose-600"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              تفاصيل إضافية عن المستشفى أو الخدمات الطبية (اختياري)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: ساعات الدوام، الأقسام المتوفرة، العروض الطبية، أو خدمات الطوارئ..."
              maxLength={1500}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-600"
            />
          </div>

          {/* Schedule, Order & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ بداية الإعلان</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-sans focus:outline-hidden focus:border-rose-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ نهاية الإعلان</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-sans focus:outline-hidden focus:border-rose-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ترتيب الظهور</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-sans focus:outline-hidden focus:border-rose-600"
              />
            </div>

            <label className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
              <span className="text-xs font-bold text-slate-800">تفعيل الإعلان</span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 accent-rose-700 cursor-pointer"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="submit"
              disabled={isSaving || isOptimizingImage}
              className="px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-md shadow-rose-900/20 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 transition-all active:scale-98"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingAd ? (
                <Save className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>
                {isSaving ? 'جاري الحفظ...' : editingAd ? 'حفظ التعديلات' : 'إضافة ونشر الإعلان'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Existing Hospital Ads Management List */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="font-extrabold text-slate-900 text-sm">
            إعلانات المستشفيات المسجلة ({hospitalAds.length})
          </h4>
          <span className="text-[11px] text-slate-500 font-medium">
            استخدم أسهم الترتيب للتحكم في أولوية عرض الإعلانات بالصفحة الرئيسية
          </span>
        </div>

        {hospitalAds.length === 0 ? (
          <div className="py-10 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-2xl">
            <Hospital className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-semibold">لا توجد إعلانات مستشفيات مضافة حالياً.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {hospitalAds.map((ad, index) => {
              const statusInfo = getHospitalAdStatus(ad);
              const safeWebsite = sanitizeWebsiteUrl(ad.websiteUrl);
              const isBusy = busyAdId === ad.id;

              return (
                <div
                  key={ad.id}
                  className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Thumbnail + Info */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-full sm:w-44 h-[78px] rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shrink-0 relative">
                      <img
                        src={ad.imageUrl}
                        alt={ad.hospitalName}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-1.5 right-1.5 text-[10px] font-black font-sans bg-slate-950/75 text-white px-2 py-0.5 rounded-md">
                        #{ad.displayOrder || index + 1}
                      </span>
                    </div>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className="font-extrabold text-slate-900 text-sm truncate">
                          {ad.hospitalName}
                        </h5>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            statusInfo.status === 'active'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : statusInfo.status === 'scheduled'
                              ? 'bg-sky-50 text-sky-800 border-sky-200'
                              : statusInfo.status === 'expired'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-200 text-slate-700 border-slate-300'
                          }`}
                        >
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                        <span className="inline-flex items-center gap-1 font-sans" dir="ltr">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          {ad.phone}
                        </span>
                        <span className="inline-flex items-center gap-1 truncate max-w-xs">
                          <MapPin className="w-3 h-3 text-rose-600 shrink-0" />
                          <span className="truncate">{ad.address}</span>
                        </span>
                        {safeWebsite && (
                          <span className="inline-flex items-center gap-1 text-sky-700 truncate max-w-[200px]">
                            <Globe className="w-3 h-3 shrink-0" />
                            <span className="truncate" dir="ltr">{safeWebsite}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>
                          من <span className="font-sans font-bold">{ad.startDate}</span> إلى{' '}
                          <span className="font-sans font-bold">{ad.endDate}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Move Up / Down */}
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0 || isBusy}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 cursor-pointer"
                        title="تقديم الإعلان للأعلى"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === hospitalAds.length - 1 || isBusy}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 cursor-pointer"
                        title="تأخير الإعلان للأسفل"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Toggle Active */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(ad)}
                        disabled={isBusy}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                          ad.isActive
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                        title={ad.isActive ? 'إيقاف الإعلان' : 'تفعيل الإعلان'}
                      >
                        {ad.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{ad.isActive ? 'إيقاف' : 'تفعيل'}</span>
                      </button>

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(ad)}
                        disabled={isBusy}
                        className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 cursor-pointer"
                        title="تعديل الإعلان"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(confirmDeleteId === ad.id ? null : ad.id)}
                        disabled={isBusy}
                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 cursor-pointer"
                        title="حذف الإعلان"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* In-app Delete Confirmation */}
                    {confirmDeleteId === ad.id && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl text-[11px] font-bold text-red-900">
                        <span>تأكيد الحذف؟</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(ad)}
                          disabled={isBusy}
                          className="px-2 py-0.5 rounded-md bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                        >
                          {isBusy ? 'جاري...' : 'نعم، احذف'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
