import React, { useMemo, useState } from 'react';
import {
  Hospital as HospitalIcon,
  Search,
  ChevronLeft,
  MapPin,
  Phone,
  Stethoscope,
  ShieldCheck,
  X,
  ArrowRight
} from 'lucide-react';
import { Doctor, Hospital, UserRole } from '../types';
import { sortHospitals } from '../utils/hospitalDirectoryUtils';

interface HospitalsPageProps {
  hospitals: Hospital[];
  doctors: Doctor[];
  onSelectHospital: (hospital: Hospital) => void;
  role?: UserRole;
  onOpenAdminDashboard?: () => void;
  onBack?: () => void;
}

export const HospitalsPage: React.FC<HospitalsPageProps> = ({
  hospitals,
  doctors,
  onSelectHospital,
  role = 'user',
  onOpenAdminDashboard,
  onBack
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const doctorCountsByHospital = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const doc of doctors) {
      if (!doc.hospitalId) continue;
      counts[doc.hospitalId] = (counts[doc.hospitalId] || 0) + 1;
    }
    return counts;
  }, [doctors]);

  const sortedHospitals = useMemo(() => sortHospitals(hospitals), [hospitals]);

  const filteredHospitals = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return sortedHospitals;
    return sortedHospitals.filter((h) => {
      const nameMatch = h.name?.toLowerCase().includes(q);
      const addrMatch = h.address?.toLowerCase().includes(q);
      const descMatch = h.description?.toLowerCase().includes(q);
      return Boolean(nameMatch || addrMatch || descMatch);
    });
  }, [sortedHospitals, searchTerm]);

  return (
    <div className="space-y-5 pb-24 font-['Cairo',sans-serif]">
      {/* Page Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/80 transition-all cursor-pointer shrink-0"
                title="الرجوع"
              >
                <ArrowRight className="w-4 h-4 text-slate-600" />
                <span>الرجوع</span>
              </button>
            )}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-700 to-red-800 text-white flex items-center justify-center shadow-md shadow-rose-900/15 shrink-0">
              <HospitalIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                المستشفيات والأطباء
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 tabular-nums">
                {sortedHospitals.length} مستشفى · {doctors.length} طبيب مسجل
              </p>
            </div>
          </div>

          {role === 'admin' && onOpenAdminDashboard && (
            <button
              type="button"
              onClick={onOpenAdminDashboard}
              className="min-h-[44px] px-4 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-rose-700 shrink-0" />
              <span>إدارة المستشفيات والأطباء</span>
            </button>
          )}
        </div>

        {/* Search Input */}
        {sortedHospitals.length > 0 && (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث عن مستشفى أو مركز طبي..."
              className="w-full min-h-[44px] pr-10 pl-10 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:border-rose-600 transition-colors"
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
        )}
      </div>

      {/* Hospitals Grid / Empty States */}
      {sortedHospitals.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200/90 shadow-xs text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-700 border border-rose-100 flex items-center justify-center mx-auto">
            <HospitalIcon className="w-8 h-8" />
          </div>
          <h2 className="text-base font-black text-slate-900">
            لا توجد مستشفيات مضافة حالياً
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            سيتم عرض المستشفيات والكوادر الطبية المعتمدة هنا فور إضافتها من لوحة تحكم الإدارة.
          </p>
          {role === 'admin' && onOpenAdminDashboard && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenAdminDashboard}
                className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-md shadow-rose-900/15 inline-flex items-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>إضافة مستشفى من لوحة الإدارة</span>
              </button>
            </div>
          )}
        </div>
      ) : filteredHospitals.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-200/90 text-center space-y-3">
          <Search className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">
            لم يتم العثور على مستشفى يطابق "{searchTerm}"
          </p>
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
          >
            عرض جميع المستشفيات
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHospitals.map((hospital) => {
            const doctorsCount = doctorCountsByHospital[hospital.id] || 0;
            const hasImageError = Boolean(brokenImages[hospital.id]) || !hospital.imageUrl;

            return (
              <button
                key={hospital.id}
                type="button"
                onClick={() => onSelectHospital(hospital)}
                className="group bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-lg hover:border-rose-300/90 transition-all duration-200 text-right flex flex-col cursor-pointer active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-rose-600"
              >
                {/* Hospital Card Image */}
                <div className="relative w-full aspect-[16/10] bg-slate-100 overflow-hidden border-b border-slate-100">
                  {!hasImageError ? (
                    <img
                      src={hospital.imageUrl}
                      alt={hospital.name}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                      onError={() =>
                        setBrokenImages((prev) => ({ ...prev, [hospital.id]: true }))
                      }
                      className="w-full h-full object-cover object-center group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-rose-50 to-slate-100 text-rose-700/70 gap-1.5">
                      <HospitalIcon className="w-10 h-10" />
                    </div>
                  )}
                </div>

                {/* Hospital Card Content */}
                <div className="p-4 sm:p-4.5 flex-1 flex flex-col justify-between gap-3 w-full">
                  <div className="space-y-2">
                    <h2 className="text-base font-black text-slate-900 group-hover:text-rose-700 transition-colors leading-snug line-clamp-2">
                      {hospital.name}
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span className="truncate">
                          {hospital.address?.trim() ? hospital.address : 'الموقع غير محدد'}
                        </span>
                      </span>
                      {hospital.phone && (
                        <span className="inline-flex items-center gap-1 font-sans text-slate-500" dir="ltr">
                          <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{hospital.phone}</span>
                        </span>
                      )}
                    </div>

                    {hospital.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed pt-0.5">
                        {hospital.description}
                      </p>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 tabular-nums">
                      <Stethoscope className="w-4 h-4 text-rose-700 shrink-0" />
                      <span>
                        {doctorsCount === 0
                          ? 'لم يُضف أطباء بعد'
                          : `${doctorsCount} طبيب`}
                      </span>
                    </span>

                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-700 group-hover:bg-rose-800 text-white font-bold text-xs shadow-2xs transition-colors shrink-0">
                      <span>عرض التفاصيل</span>
                      <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
