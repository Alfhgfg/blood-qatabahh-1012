import React, { useState } from 'react';
import { X, Phone, MessageCircle, MapPin, Calendar, Heart, ShieldCheck, CheckCircle2, XCircle, Share2, AlertCircle, Edit3 } from 'lucide-react';
import { COMPATIBILITY_MAP, getDonationEligibility } from '../services/storageService';
import { Donor, UserRole } from '../types';

interface DonorProfileModalProps {
  donor: Donor | null;
  onClose: () => void;
  role: UserRole;
  onToggleAvailability: (donor: Donor) => void;
  onEditDonor?: (donor: Donor) => void;
  onDeleteDonor?: (id: string) => void;
}

export const DonorProfileModal: React.FC<DonorProfileModalProps> = ({
  donor,
  onClose,
  role,
  onToggleAvailability,
  onEditDonor,
  onDeleteDonor
}) => {
  if (!donor) return null;

  const [copied, setCopied] = useState(false);
  const compatibility = COMPATIBILITY_MAP[donor.bloodType];
  const eligibility = getDonationEligibility(donor.lastDonationDate);

  const cleanPhone = donor.phone ? donor.phone.replace(/[^0-9]/g, '') : '';
  const yemenPhone = cleanPhone ? (cleanPhone.startsWith('967') ? cleanPhone : `967${cleanPhone.replace(/^0+/, '')}`) : '';

  const handleShare = () => {
    const text = `🩸 متبرع بالدم مسجل في قعطبة:\nالاسم: ${donor.fullName}\nالفصيلة: ${donor.bloodType}\nالمنطقة: ${donor.district} - ${donor.area}\nالهاتف: ${donor.phone}\nالحالة: ${donor.isAvailable ? 'متاح للتبرع' : 'غير متاح حالياً'}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col">
        {/* Header with Blood Badge */}
        <div className="relative bg-gradient-to-br from-rose-950 via-red-900 to-slate-900 p-5 text-white rounded-t-3xl border-b border-red-950/40">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-15 h-15 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs">
                <span className="text-2xl sm:text-3xl font-black font-sans tracking-tight text-white">
                  {donor.bloodType}
                </span>
              </div>
              <div>
                <span className="inline-block text-[11px] font-semibold bg-white/15 backdrop-blur-sm px-2.5 py-0.5 rounded-full mb-1 text-rose-100">
                  ملف متبرع مسجل
                </span>
                <h3 className="text-lg sm:text-xl font-bold leading-tight">{donor.fullName}</h3>
                <p className="text-xs text-slate-300 mt-0.5 font-sans" dir="ltr">
                  {donor.phone}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Action Call / WhatsApp Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={`tel:${donor.phone}`}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-98 transition-all"
            >
              <Phone className="w-4 h-4" />
              <span>اتصال هاتفي</span>
            </a>
            <a
              href={`https://wa.me/${yemenPhone}?text=${encodeURIComponent(`السلام عليكم أخي ${donor.fullName}، نحتاج التبرع بالدم فصيلة (${donor.bloodType}) عبر سجل قعطبة.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-teal-600/20 active:scale-98 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span>مراسلة واتساب</span>
            </a>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card 1: Location */}
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
              <div className="flex items-center gap-2 text-rose-600 mb-1">
                <MapPin className="w-4 h-4" />
                <span className="text-xs font-bold text-slate-800">الموقع العام</span>
              </div>
              <p className="text-sm font-semibold text-slate-700">{donor.district}</p>
              <p className="text-xs text-slate-500 mt-0.5">القرية / الحي: {donor.area}</p>
            </div>

            {/* Card 2: Availability */}
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-rose-600" />
                    <span className="text-xs font-bold text-slate-800">حالة التوفر</span>
                  </div>
                  {donor.isAvailable ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      متاح للتبرع
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      <XCircle className="w-3 h-3" />
                      غير متاح مؤقتاً
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {donor.isAvailable
                    ? 'المتبرع جاهز لتلبية النداءات الطارئة'
                    : 'في فترة راحة أو اعتذار مؤقت'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onToggleAvailability(donor)}
                className="mt-2 text-right text-[11px] font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer"
              >
                تبديل حالة التوفر (تحديث فوري)
              </button>
            </div>

            {/* WhatsApp Consent Indicator */}
            <div className="sm:col-span-2 px-3.5 py-2 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>إشعارات واتساب السحابية:</span>
              </span>
              {donor.whatsappOptIn !== false ? (
                <span className="font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full text-[11px]">
                  مشترك وموافق على الاستقبال 💬
                </span>
              ) : (
                <span className="font-bold text-slate-600 bg-slate-200 px-2.5 py-0.5 rounded-full text-[11px]">
                  غير مشترك
                </span>
              )}
            </div>
          </div>

          {/* Card 3: Last Donation & Eligibility */}
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-rose-600" />
                <span className="text-xs font-bold text-slate-800">آخر تبرع بالدم</span>
              </div>
              <span className="text-xs font-bold font-sans text-slate-700">
                {donor.lastDonationDate || 'غير مسجل تبرع حديث'}
              </span>
            </div>

            <div
              className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                eligibility.isEligible
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {eligibility.isEligible ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              )}
              <span>{eligibility.message}</span>
            </div>
          </div>

          {/* Card 4: Blood Compatibility Matrix */}
          <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl">
            <h4 className="text-xs font-bold text-rose-900 mb-2 flex items-center gap-1.5">
              <span>توافق فصيلة {donor.bloodType}:</span>
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600 w-28 shrink-0">يمكنه التبرع لـ:</span>
                <div className="flex flex-wrap gap-1">
                  {compatibility.canDonateTo.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-md bg-white border border-rose-200 font-bold font-sans text-[11px] text-rose-700"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600 w-28 shrink-0">يمكنه الاستقبال من:</span>
                <div className="flex flex-wrap gap-1">
                  {compatibility.canReceiveFrom.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-bold font-sans text-[11px] text-slate-700"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Notes if any */}
          {donor.notes && (
            <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-xs text-amber-900">
              <span className="font-bold block mb-0.5">ملاحظات:</span>
              {donor.notes}
            </div>
          )}

          {/* Bottom Actions */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copied ? 'تم نسخ البيانات!' : 'مشاركة بيانات المتبرع'}</span>
            </button>

            <div className="flex items-center gap-2">
              {role === 'admin' && onEditDonor && (
                <button
                  onClick={() => {
                    onClose();
                    onEditDonor(donor);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-3 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>تعديل السجل</span>
                </button>
              )}

              {role === 'admin' && onDeleteDonor && !donor.isAvailable && (
                <button
                  onClick={() => {
                    if (confirm(`هل أنت متأكد من حذف المتبرع غير المتاح "${donor.fullName}" من السجل؟`)) {
                      onDeleteDonor(donor.id);
                      onClose();
                    }
                  }}
                  className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  حذف المتبرع غير المتاح
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
