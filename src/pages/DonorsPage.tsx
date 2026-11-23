import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserPlus, 
  Search, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  Filter, 
  X,
  Droplet,
  ChevronLeft,
  UserCheck,
  FileSpreadsheet,
  RefreshCw,
  Edit3,
  AlertTriangle,
  Download,
  ArrowRight
} from 'lucide-react';
import { BloodType, District, Donor, UserRole } from '../types';
import { exportDonorsToExcel } from '../services/excelExportService';

interface DonorsPageProps {
  donors: Donor[];
  districts: District[];
  onOpenAddDonor: () => void;
  onSelectDonor: (donor: Donor) => void;
  onEditDonor?: (donor: Donor) => void;
  initialBloodFilter?: BloodType | null;
  filterSyncToken?: number;
  role?: UserRole;
  onOpenImportModal?: () => void;
  onRefreshDonors?: () => Promise<void> | void;
  isLoadingDonors?: boolean;
  donorLoadError?: string | null;
  onBack?: () => void;
}

export const DonorsPage: React.FC<DonorsPageProps> = ({
  donors,
  districts,
  onOpenAddDonor,
  onSelectDonor,
  onEditDonor,
  initialBloodFilter = null,
  filterSyncToken = 0,
  role = 'user',
  onOpenImportModal,
  onRefreshDonors,
  isLoadingDonors = false,
  donorLoadError = null,
  onBack
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBlood, setSelectedBlood] = useState<BloodType | 'all'>(initialBloodFilter || 'all');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (filterSyncToken > 0) {
      setSelectedBlood(initialBloodFilter || 'all');
    }
  }, [filterSyncToken, initialBloodFilter]);

  const handleExportExcel = async () => {
    setIsExporting(true);
    setExportNotice(null);
    try {
      const result = await exportDonorsToExcel();
      if (result.success) {
        setExportNotice({
          type: 'success',
          message: `تم تصدير وتنزيل ملف Excel بنجاح بنسبة 100% (${result.donorsCount} متبرع تم جلبهم مباشرة من Firebase Firestore) 📊`
        });
        setTimeout(() => setExportNotice(null), 6000);
      } else {
        setExportNotice({
          type: 'error',
          message: result.error || 'تعذر تصدير بيانات المتبرعين إلى Excel.'
        });
      }
    } catch (err: any) {
      setExportNotice({
        type: 'error',
        message: err?.message || 'حدث خطأ غير متوقع أثناء تصدير ملف Excel.'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleManualRefresh = async () => {
    if (onRefreshDonors && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefreshDonors();
      } finally {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };

  const bloodTypes: BloodType[] = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'];

  // Custom Donor Explorer search & filtering
  const filteredDonors = useMemo(() => {
    return donors.filter((donor) => {
      // Search term
      const matchesSearch =
        searchTerm.trim() === '' ||
        donor.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        donor.phone.includes(searchTerm) ||
        donor.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
        donor.area.toLowerCase().includes(searchTerm.toLowerCase());

      // Blood type
      const matchesBlood = selectedBlood === 'all' || donor.bloodType === selectedBlood;

      // District
      const matchesDistrict = selectedDistrict === 'all' || donor.district === selectedDistrict;

      // Availability
      const matchesAvailability =
        availabilityFilter === 'all' ||
        (availabilityFilter === 'available' && donor.isAvailable) ||
        (availabilityFilter === 'unavailable' && !donor.isAvailable);

      return matchesSearch && matchesBlood && matchesDistrict && matchesAvailability;
    });
  }, [donors, searchTerm, selectedBlood, selectedDistrict, availabilityFilter]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedBlood('all');
    setSelectedDistrict('all');
    setAvailabilityFilter('all');
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedBlood !== 'all' ||
    selectedDistrict !== 'all' ||
    availabilityFilter !== 'all';

  return (
    <div className="space-y-5 pb-24">
      {/* Top Header & Add Donor Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3">
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
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-700"></span>
              مستكشف سجل المتبرعين بالدم
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              البحث في قاعدة بيانات المتبرعين بقعطبة والضالع والتواصل المباشر
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {onRefreshDonors && (
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing || isLoadingDonors}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm shadow-2xs active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              title="تحديث قائمة المتبرعين من قاعدة البيانات السحابية"
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 ${isRefreshing || isLoadingDonors ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">تحديث السجل</span>
            </button>
          )}



          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="px-3.5 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-xs active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
            title="تصدير جميع المتبرعين من Firebase مباشرة إلى ملف Excel (.xlsx)"
          >
            {isExporting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isExporting ? 'جاري التصدير...' : 'تصدير Excel'}</span>
          </button>

          {role === 'admin' && onOpenImportModal && (
            <button
              onClick={onOpenImportModal}
              className="px-3.5 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs sm:text-sm shadow-xs active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              title="استيراد متبرعين من ملف Excel أو CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>استيراد ملف</span>
            </button>
          )}

          <button
            onClick={onOpenAddDonor}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-800 to-red-800 hover:from-rose-900 hover:to-red-900 text-white font-bold text-xs sm:text-sm shadow-sm active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة متبرع جديد</span>
          </button>
        </div>
      </div>

      {/* Excel Export Feedback Notice Banner */}
      {exportNotice && (
        <div className={`p-4 rounded-3xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-bold shadow-xs animate-in fade-in slide-in-from-top-2 ${
          exportNotice.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center gap-2.5">
            {exportNotice.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{exportNotice.message}</span>
          </div>
          <button
            onClick={() => setExportNotice(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Network / Connection Error Banner */}
      {donorLoadError && (
        <div className="bg-rose-50 border border-rose-200/90 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-rose-900 animate-in fade-in shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0 text-rose-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm">تنبيه اتصال السجل المركزي</h4>
              <p className="text-xs text-rose-700 mt-0.5">{donorLoadError}</p>
            </div>
          </div>
          {onRefreshDonors && (
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-xs active:scale-98 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>إعادة المحاولة الآن</span>
            </button>
          )}
        </div>
      )}

      {/* Explorer Controls: Search & Filters */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3.5">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث بالاسم، رقم الهاتف، أو اسم القرية/المنطقة (مثال: حي السلام، 77...)"
            className="w-full px-4 py-2.5 pr-11 pl-10 rounded-2xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:border-rose-700 focus:ring-2 focus:ring-rose-700/10 bg-slate-50/70"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Blood Type Filter Pills */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-600">تصفية حسب فصيلة الدم:</span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs text-rose-700 hover:text-rose-900 font-semibold cursor-pointer"
              >
                إعادة ضبط الفلاتر ✕
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedBlood('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                selectedBlood === 'all'
                  ? 'bg-rose-800 text-white border-rose-800 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              الكل ({donors.length})
            </button>
            {bloodTypes.map((type) => {
              const count = donors.filter((d) => d.bloodType === type).length;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedBlood(type)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold font-sans transition-all border cursor-pointer flex items-center gap-1 ${
                    selectedBlood === type
                      ? 'bg-rose-800 text-white border-rose-800 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{type}</span>
                  <span className="text-[10px] opacity-75 font-normal">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* District & Availability Secondary Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">المديرية / المنطقة</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-700 bg-white"
            >
              <option value="all">جميع المديريات والمناطق</option>
              {districts.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">حالة الجاهزية للتبرع</label>
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-700 bg-white"
            >
              <option value="all">الكل (المتاح وغير المتاح)</option>
              <option value="available">متاح الآن فقط 🟢</option>
              <option value="unavailable">غير متاح مؤقتاً ⚪</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-slate-600">
          نتائج البحث: <span className="text-rose-800 font-sans font-black">{filteredDonors.length}</span> متبرع
        </span>
        <span className="text-[11px] text-slate-400">
          تحديث فوري للسجل
        </span>
      </div>

      {/* Donors Cards Grid */}
      {isLoadingDonors && filteredDonors.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto border border-rose-100">
            <RefreshCw className="w-7 h-7 animate-spin" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">جاري تحميل سجل المتبرعين السحابي...</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            يتم الآن مزامنة بيانات المتبرعين المركزية مع السيرفر وقاعدة البيانات السحابية.
          </p>
        </div>
      ) : filteredDonors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredDonors.map((donor) => (
            <div
              key={donor.id}
              onClick={() => onSelectDonor(donor)}
              className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 hover:border-rose-300 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                {/* Card Top: Blood Type & Availability Badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-800 to-red-900 text-white font-sans font-black text-sm flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                      {donor.bloodType}
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm group-hover:text-rose-700 transition-colors">
                        {donor.fullName}
                      </h3>
                      <p className="text-xs text-slate-500 font-sans tracking-wide mt-0.5" dir="ltr">
                        {donor.phone}
                      </p>
                    </div>
                  </div>

                  <div>
                    {donor.isAvailable ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        متاح
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                        <XCircle className="w-3 h-3 text-slate-400" />
                        غير متاح
                      </span>
                    )}
                  </div>
                </div>

                {/* Location Details */}
                <div className="p-2.5 bg-slate-50/80 border border-slate-100 rounded-2xl text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                    <span className="font-semibold">{donor.district}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 pr-5">
                    القرية / الحي: <span className="text-slate-700">{donor.area}</span>
                  </div>
                </div>

                {donor.notes && (
                  <p className="text-[11px] text-slate-500 mt-2 line-clamp-1 italic">
                    "{donor.notes}"
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <a
                  href={`tel:${donor.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-200/80 hover:border-emerald-600 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>اتصال هاتفي</span>
                </a>

                {role === 'admin' && onEditDonor && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditDonor(donor);
                    }}
                    className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
                    title="تعديل بيانات المتبرع"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onSelectDonor(donor)}
                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <span>عرض الملف</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/80 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto border border-rose-100">
            <UserCheck className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">لا توجد نتائج مطابقة لبحثك</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            جرب تغيير الفصيلة المحددة أو إزالة فلاتر البحث للعثور على متبرعين آخرين في قعطبة.
          </p>
          <button
            onClick={resetFilters}
            className="px-4 py-2 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer"
          >
            إلغاء جميع الفلاتر
          </button>
        </div>
      )}
    </div>
  );
};
