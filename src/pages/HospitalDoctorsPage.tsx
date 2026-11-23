import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Hospital as HospitalIcon,
  Stethoscope,
  Phone,
  MapPin,
  Search,
  Copy,
  UserRound,
  ShieldCheck,
  X
} from 'lucide-react';
import { Doctor, Hospital, UserRole } from '../types';
import { sortDoctors } from '../utils/hospitalDirectoryUtils';

interface HospitalDoctorsPageProps {
  hospital: Hospital | null;
  doctors: Doctor[];
  onBack: () => void;
  backLabel?: string;
  onTriggerToast?: (msg: string) => void;
  role?: UserRole;
  onOpenAdminDashboard?: () => void;
}

export const HospitalDoctorsPage: React.FC<HospitalDoctorsPageProps> = ({
  hospital,
  doctors,
  onBack,
  backLabel = 'العودة إلى المستشفيات',
  onTriggerToast,
  role = 'user',
  onOpenAdminDashboard
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [hospitalImgError, setHospitalImgError] = useState(false);
  const [brokenDoctorImages, setBrokenDoctorImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSearchTerm('');
    setSelectedSpecialty('all');
    setHospitalImgError(false);
  }, [hospital?.id]);

  useEffect(() => {
    setHospitalImgError(false);
  }, [hospital?.imageUrl]);

  const hospitalDoctors = useMemo(() => {
    if (!hospital) return [];
    return sortDoctors(doctors.filter((doc) => doc.hospitalId === hospital.id));
  }, [doctors, hospital]);

  const specialties = useMemo(() => {
    const set = new Set<string>();
    for (const doc of hospitalDoctors) {
      const clean = doc.specialty?.trim();
      if (clean) set.add(clean);
    }
    return Array.from(set);
  }, [hospitalDoctors]);

  const filteredDoctors = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return hospitalDoctors.filter((doc) => {
      if (selectedSpecialty !== 'all' && doc.specialty.trim() !== selectedSpecialty) {
        return false;
      }
      if (!q) return true;
      return (
        doc.fullName.toLowerCase().includes(q) ||
        doc.specialty.toLowerCase().includes(q) ||
        Boolean(doc.bio?.toLowerCase().includes(q))
      );
    });
  }, [hospitalDoctors, searchTerm, selectedSpecialty]);

  const handleCopyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      onTriggerToast?.(`تم نسخ رقم الهاتف (${phone}) بنجاح`);
    } catch {
      onTriggerToast?.(`رقم التواصل: ${phone}`);
    }
  };

  if (!hospital) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xs text-center space-y-4 my-4 font-['Cairo',sans-serif]">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto">
          <HospitalIcon className="w-7 h-7" />
        </div>
        <h2 className="text-base font-black text-slate-900">لم يتم تحديد المستشفى</h2>
        <p className="text-xs sm:text-sm text-slate-500">
          يمكنك العودة إلى صفحة المستشفيات لاختيار المستشفى وعرض قائمة الأطباء العاملين فيه.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>{backLabel}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 font-['Cairo',sans-serif]">
      {/* Top Navigation Row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 font-bold text-xs shadow-2xs transition-all active:scale-98 cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 text-rose-700" />
          <span>{backLabel}</span>
        </button>

        {role === 'admin' && onOpenAdminDashboard && (
          <button
            type="button"
            onClick={onOpenAdminDashboard}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-bold text-xs cursor-pointer transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-rose-700" />
            <span>تعديل الأطباء</span>
          </button>
        )}
      </div>

      {/* Hospital Header Card */}
      <div className="bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.05)]">
        <div className="grid grid-cols-1 md:grid-cols-12">
          <div className="md:col-span-5 lg:col-span-4 aspect-[16/10] md:aspect-auto md:min-h-[190px] bg-slate-100 overflow-hidden border-b md:border-b-0 md:border-l border-slate-100">
            {!hospitalImgError && hospital.imageUrl ? (
              <img
                src={hospital.imageUrl}
                alt={hospital.name}
                referrerPolicy="no-referrer"
                onError={() => setHospitalImgError(true)}
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div className="w-full h-full min-h-[160px] flex items-center justify-center bg-gradient-to-br from-rose-50 to-slate-100 text-rose-700/70">
                <HospitalIcon className="w-12 h-12" />
              </div>
            )}
          </div>

          <div className="md:col-span-7 lg:col-span-8 p-5 sm:p-6 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                  {hospital.name}
                </h1>
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-rose-700 tabular-nums shrink-0">
                  <Stethoscope className="w-4 h-4" />
                  <span>{hospitalDoctors.length} طبيب</span>
                </span>
              </div>

              {(hospital.address || hospital.phone) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-slate-600">
                  {hospital.address && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{hospital.address}</span>
                    </span>
                  )}
                  {hospital.phone && (
                    <span className="inline-flex items-center gap-1.5 font-sans" dir="ltr">
                      <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{hospital.phone}</span>
                    </span>
                  )}
                </div>
              )}

              {hospital.description && (
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap pt-1">
                  {hospital.description}
                </p>
              )}
            </div>

            {hospital.phone && (
              <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
                <a
                  href={`tel:${hospital.phone}`}
                  className="min-h-[44px] px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-2 shadow-xs transition-all active:scale-98"
                >
                  <Phone className="w-4 h-4" />
                  <span>اتصال بالمستشفى</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyPhone(hospital.phone!)}
                  className="min-h-[44px] px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                  <span>نسخ الرقم</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Doctors Section Header + Search & Specialty Filters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-rose-700" />
            <span>الأطباء العاملون في المستشفى</span>
          </h2>
          <span className="text-xs font-bold text-slate-500 tabular-nums">
            {filteredDoctors.length} من {hospitalDoctors.length}
          </span>
        </div>

        {hospitalDoctors.length > 0 && (
          <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث باسم الطبيب أو التخصص..."
                className="w-full min-h-[44px] pr-10 pl-10 py-2 rounded-2xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:border-rose-600 transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="مسح البحث"
                  className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {specialties.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedSpecialty('all')}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors border ${
                    selectedSpecialty === 'all'
                      ? 'bg-rose-700 text-white border-rose-700'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  جميع التخصصات
                </button>
                {specialties.map((spec) => (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => setSelectedSpecialty(spec)}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors border ${
                      selectedSpecialty === spec
                        ? 'bg-rose-700 text-white border-rose-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {spec}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Doctors List / Empty State */}
      {hospitalDoctors.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200/90 shadow-xs text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Stethoscope className="w-7 h-7" />
          </div>
          <h3 className="text-base font-black text-slate-900">
            لم يتم إضافة أطباء لهذا المستشفى بعد
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            سيظهر هنا الأطباء وتخصصاتهم وبيانات التواصل الخاصة بهم فور إضافتهم من لوحة الإدارة.
          </p>
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-200/90 text-center space-y-3">
          <Search className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">
            لا يوجد أطباء مطابقون لخيارات البحث الحالية
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedSpecialty('all');
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
          >
            إعادة تعيين البحث
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDoctors.map((doc) => {
            const hasPhotoError = Boolean(brokenDoctorImages[doc.id]) || !doc.imageUrl;

            return (
              <article
                key={doc.id}
                className="bg-white rounded-3xl p-4.5 sm:p-5 border border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between gap-4"
              >
                <div className="space-y-3.5">
                  {/* Doctor Photo Beside Name & Specialty */}
                  <div className="flex items-center gap-3.5">
                    <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/90 shrink-0 shadow-2xs">
                      {!hasPhotoError ? (
                        <img
                          src={doc.imageUrl}
                          alt={doc.fullName}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          onError={() =>
                            setBrokenDoctorImages((prev) => ({ ...prev, [doc.id]: true }))
                          }
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-50 to-slate-100 text-rose-700/70">
                          <UserRound className="w-9 h-9" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                        {doc.fullName}
                      </h3>
                      <p className="text-xs sm:text-sm font-extrabold text-rose-700 flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5 shrink-0" />
                        <span>{doc.specialty}</span>
                      </p>
                    </div>
                  </div>

                  {/* Optional Bio */}
                  {doc.bio && (
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 whitespace-pre-wrap">
                      {doc.bio}
                    </p>
                  )}
                </div>

                {/* Optional Contact Phone */}
                {doc.phone && (
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-700 font-sans inline-flex items-center gap-1.5" dir="ltr">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{doc.phone}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${doc.phone}`}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-2xs transition-all active:scale-98"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>اتصال</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyPhone(doc.phone!)}
                        className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        title="نسخ رقم الطبيب"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ</span>
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
