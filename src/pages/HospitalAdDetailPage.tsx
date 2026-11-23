import React from 'react';
import {
  ArrowRight,
  Hospital,
  Phone,
  MapPin,
  Globe,
  Calendar,
  Copy,
  ExternalLink,
  Info
} from 'lucide-react';
import { HospitalAd } from '../types';
import { sanitizeWebsiteUrl } from '../utils/hospitalAdUtils';

interface HospitalAdDetailPageProps {
  ad: HospitalAd | null;
  onBack: () => void;
  onTriggerToast?: (msg: string) => void;
  backLabel?: string;
}

export const HospitalAdDetailPage: React.FC<HospitalAdDetailPageProps> = ({
  ad,
  onBack,
  onTriggerToast,
  backLabel = 'العودة إلى الرئيسية'
}) => {
  if (!ad) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xs text-center space-y-4 my-4 font-['Cairo',sans-serif]">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto">
          <Hospital className="w-7 h-7" />
        </div>
        <h2 className="text-base font-black text-slate-900">لم يتم تحديد إعلان مستشفى</h2>
        <p className="text-xs text-slate-500">يمكنك العودة إلى الصفحة الرئيسية لاستعراض إعلانات المستشفيات والمراكز الطبية.</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 rounded-2xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للرئيسية</span>
        </button>
      </div>
    );
  }

  const safeWebsite = sanitizeWebsiteUrl(ad.websiteUrl);

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(ad.phone);
      onTriggerToast?.(`تم نسخ رقم الهاتف (${ad.phone}) بنجاح`);
    } catch {
      onTriggerToast?.(`رقم التواصل: ${ad.phone}`);
    }
  };

  return (
    <div className="space-y-5 pb-24 font-['Cairo',sans-serif]">
      {/* Top Back Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 font-bold text-xs shadow-2xs transition-all active:scale-98 cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 text-rose-700" />
          <span>{backLabel}</span>
        </button>

        <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200/80 px-3 py-1 rounded-xl">
          إعلان طبي معتمد
        </span>
      </div>

      {/* Main Detail Card */}
      <div className="bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.06)]">
        {/* Full Banner Image Preview */}
        <div className="bg-slate-950 w-full flex items-center justify-center overflow-hidden border-b border-slate-200">
          <img
            src={ad.imageUrl}
            alt={ad.hospitalName}
            className="w-full max-h-[260px] sm:max-h-[340px] object-contain block"
            decoding="async"
          />
        </div>

        {/* Details Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-3.5 border-b border-slate-100 pb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-700 to-red-800 text-white flex items-center justify-center shadow-md shadow-rose-900/20 shrink-0">
              <Hospital className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                {ad.hospitalName}
              </h1>
              {(ad.startDate || ad.endDate) && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold mt-1.5">
                  <Calendar className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>
                    فترة الإعلان: من <span className="font-sans font-bold text-slate-700">{ad.startDate}</span> إلى{' '}
                    <span className="font-sans font-bold text-slate-700">{ad.endDate}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Description / Medical Center Details */}
          {ad.description && (
            <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200/70 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                <Info className="w-4 h-4 text-rose-700 shrink-0" />
                <span>تفاصيل المستشفى / المركز الطبي</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {ad.description}
              </p>
            </div>
          )}

          {/* Contact & Location Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Address */}
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-400 block">العنوان والموقع</span>
                <p className="text-xs sm:text-sm font-extrabold text-slate-900 mt-0.5 leading-relaxed">
                  {ad.address}
                </p>
              </div>
            </div>

            {/* Phone */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-bold text-emerald-700/80 block">رقم التواصل</span>
                <p className="text-sm sm:text-base font-black font-sans text-slate-900 mt-0.5" dir="ltr">
                  {ad.phone}
                </p>
              </div>
            </div>
          </div>

          {/* Website Link (if available) */}
          {safeWebsite && (
            <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200/80 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-sky-800/80 block">الموقع الإلكتروني / رابط الإعلان</span>
                  <span className="text-xs font-bold text-sky-900 font-sans truncate block max-w-[240px] sm:max-w-md" dir="ltr">
                    {safeWebsite}
                  </span>
                </div>
              </div>
              <a
                href={safeWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-all active:scale-98"
              >
                <span>زيارة الموقع</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            <a
              href={`tel:${ad.phone}`}
              className="flex-1 min-w-[160px] py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-98"
            >
              <Phone className="w-4 h-4" />
              <span>اتصال مباشر بالمستشفى</span>
            </a>

            <button
              type="button"
              onClick={handleCopyPhone}
              className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Copy className="w-4 h-4 text-slate-600" />
              <span>نسخ الرقم</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
