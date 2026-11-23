import React, { useState, useMemo } from 'react';
import { 
  UserPlus, 
  Users, 
  Search, 
  AlertTriangle, 
  BookOpen, 
  Droplet, 
  Phone, 
  MapPin, 
  ArrowLeft, 
  Heart,
  ChevronLeft,
  Hospital,
  Stethoscope,
  Megaphone,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { BloodRequest, BloodType, Donor, ActivePage, UserRole, Announcement, HospitalAd } from '../types';
import { DonutChart } from '../components/DonutChart';
import { HospitalAdsSlider } from '../components/HospitalAdsSlider';
import { storageService } from '../services/storageService';
import { isHospitalAdCurrentlyVisible, sortHospitalAds } from '../utils/hospitalAdUtils';

interface HomePageProps {
  donors: Donor[];
  requests: BloodRequest[];
  hospitalAds?: HospitalAd[];
  onNavigate: (page: ActivePage) => void;
  onOpenAddDonor: () => void;
  onOpenAddRequest: () => void;
  onSelectDonor: (donor: Donor) => void;
  onSelectRequest: (req: BloodRequest) => void;
  onSelectHospitalAd?: (ad: HospitalAd) => void;
  onFilterBloodType: (bloodType: BloodType | null) => void;
  selectedBloodType: BloodType | null;
  onOpenInstallModal?: () => void;
  onOpenNotifications?: () => void;
  role?: UserRole;
}

export const HomePage: React.FC<HomePageProps> = ({
  donors,
  requests,
  hospitalAds = [],
  onNavigate,
  onOpenAddDonor,
  onOpenAddRequest,
  onSelectDonor,
  onSelectRequest,
  onSelectHospitalAd,
  onFilterBloodType,
  selectedBloodType,
  onOpenInstallModal,
  onOpenNotifications,
  role = 'user'
}) => {
  // Visible Hospital & Medical Center Ads (active and within startDate..endDate)
  const visibleHospitalAds = useMemo(
    () => sortHospitalAds(hospitalAds.filter((ad) => isHospitalAdCurrentlyVisible(ad))),
    [hospitalAds]
  );

  // Urgent requests (critical and urgent, open)
  const urgentRequests = requests
    .filter((r) => r.status === 'open' && (r.urgency === 'critical' || r.urgency === 'urgent'))
    .slice(0, 3);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  React.useEffect(() => {
    storageService.getAnnouncements().then((items) => {
      setAnnouncements(items.filter((a) => a.isActive));
    }).catch(() => {});
  }, []);

  const availableDonorsCount = donors.filter((d) => d.isAvailable).length;
  const criticalCount = requests.filter((r) => r.status === 'open' && r.urgency === 'critical').length;

  return (
    <div className="space-y-6 pb-24 font-['Cairo',sans-serif]">
      {/* Active Administrative Announcements Banner */}
      {announcements.length > 0 && (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <div
              key={ann.id}
              className={`p-4 rounded-3xl border flex items-start gap-3.5 shadow-xs transition-all ${
                ann.type === 'urgent'
                  ? 'bg-rose-50 border-rose-200 text-rose-950'
                  : ann.type === 'campaign'
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-sky-50 border-sky-200 text-sky-950'
              }`}
            >
              <div
                className={`p-2.5 rounded-2xl shrink-0 shadow-xs ${
                  ann.type === 'urgent'
                    ? 'bg-rose-600 text-white'
                    : ann.type === 'campaign'
                    ? 'bg-amber-600 text-white'
                    : 'bg-sky-600 text-white'
                }`}
              >
                <Megaphone className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-black tracking-tight">{ann.title}</h4>
                  <span className="text-[10px] font-bold opacity-75">
                    {new Date(ann.createdAt).toLocaleDateString('ar-YE')}
                  </span>
                </div>
                <p className="text-xs mt-1.5 leading-relaxed whitespace-pre-wrap font-medium">
                  {ann.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hero Banner with Optimized Height & Visual Appeal */}
      <div className="relative overflow-hidden rounded-3xl shadow-xl shadow-rose-950/20 border border-rose-500/30 bg-slate-950 group">
        <img
          src="/assets/aistudio/1001974620_imgupscaler.ai__________2K_b80bcc57.jpg"
          alt="سجل المتبرعين بالدم في مديرية قعطبة - قطرة دم تنقذ حياة"
          className="w-full h-[220px] sm:h-[310px] object-cover object-center rounded-t-3xl block select-none brightness-105 contrast-105 group-hover:scale-[1.01] transition-transform duration-500"
          loading="eager"
        />

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-5 bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white rounded-b-3xl border-t border-rose-900/40">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-100">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
              <span>تطبيق سجل المتبرعين بالدم – مديرية قعطبة</span>
            </div>
            <div className="text-xs sm:text-sm text-amber-200 font-bold pr-4.5 tracking-wide drop-shadow-sm">
              معًا من أجل إنقاذ الأرواح... قطرة دم قد تصنع حياة.
            </div>
            <button
              type="button"
              onClick={() => onNavigate('about')}
              className="text-[11px] text-rose-200/90 hover:text-white pr-4.5 text-right transition-colors cursor-pointer w-fit"
            >
              برعاية اللجنة المجتمعية – مديرية قعطبة · نبذة عن المبادرة
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAddDonor}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all active:scale-98 cursor-pointer flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>تسجيل كمتبرع</span>
            </button>
            <button
              onClick={onOpenAddRequest}
              className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold text-xs backdrop-blur-xs transition-all active:scale-98 cursor-pointer flex items-center gap-1.5"
            >
              <Droplet className="w-3.5 h-3.5 fill-rose-300 text-rose-300" />
              <span>طلب دم عاجل</span>
            </button>
          </div>
        </div>
      </div>

      {/* Shortcuts Bar (شريط اختصارات) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <h3 className="text-xs font-bold text-slate-400 mb-3 px-1">الوصول السريع للأقسام</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 text-center">
          <button
            onClick={onOpenAddDonor}
            className="group flex flex-col items-center p-2 rounded-2xl hover:bg-rose-50/60 transition-all cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center group-hover:scale-105 group-hover:bg-rose-700 group-hover:text-white transition-all shadow-xs border border-rose-100">
              <UserPlus className="w-5 h-5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-slate-700 group-hover:text-rose-700 mt-1.5">
              إضافة متبرع
            </span>
          </button>

          <button
            onClick={() => {
              onFilterBloodType(null);
              onNavigate('donors');
            }}
            className="group flex flex-col items-center p-2 rounded-2xl hover:bg-sky-50/60 transition-all cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center group-hover:scale-105 group-hover:bg-sky-600 group-hover:text-white transition-all shadow-xs border border-sky-100">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-slate-700 group-hover:text-sky-700 mt-1.5">
              قائمة المتبرعين
            </span>
          </button>

          <button
            onClick={() => {
              onFilterBloodType(null);
              onNavigate('donors');
            }}
            className="group flex flex-col items-center p-2 rounded-2xl hover:bg-amber-50/60 transition-all cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-105 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-xs border border-amber-100">
              <Search className="w-5 h-5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-slate-700 group-hover:text-amber-700 mt-1.5">
              البحث بالفصيل
            </span>
          </button>

          <button
            onClick={() => onNavigate('requests')}
            className="group flex flex-col items-center p-2 rounded-2xl hover:bg-red-50/60 transition-all cursor-pointer relative"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center group-hover:scale-105 group-hover:bg-red-700 group-hover:text-white transition-all shadow-xs border border-red-100 relative">
              <AlertTriangle className="w-5 h-5" />
              {criticalCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs">
                  {criticalCount}
                </span>
              )}
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-slate-700 group-hover:text-red-700 mt-1.5">
              الطلبات العاجلة
            </span>
          </button>

          <button
            onClick={() => onNavigate('hospitals')}
            className="group flex flex-col items-center p-2 rounded-2xl hover:bg-teal-50/60 transition-all cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center group-hover:scale-105 group-hover:bg-teal-600 group-hover:text-white transition-all shadow-xs border border-teal-100">
              <Stethoscope className="w-5 h-5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-slate-700 group-hover:text-teal-700 mt-1.5">
              المستشفيات والأطباء
            </span>
          </button>

          <button
            onClick={() => onNavigate('info')}
            className="group flex flex-col items-center p-2 rounded-2xl hover:bg-emerald-50/60 transition-all cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs border border-emerald-100">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-slate-700 group-hover:text-emerald-700 mt-1.5">
              معلومات التبرع
            </span>
          </button>
        </div>
      </div>

      {/* Hospital & Medical Center Ads Slider */}
      {visibleHospitalAds.length > 0 && onSelectHospitalAd && (
        <HospitalAdsSlider
          ads={visibleHospitalAds}
          onSelectAd={onSelectHospitalAd}
        />
      )}

      {/* Donut Chart & Interactive Blood Groups Component */}
      <DonutChart
        donors={donors}
        onSelectBloodType={(type) => {
          onFilterBloodType(type);
          onNavigate('donors');
        }}
        selectedBloodType={selectedBloodType}
      />

      {/* Urgent Requests Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
            </span>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              الطلبات العاجلة بالمنطقة
            </h3>
            <span className="text-xs bg-rose-50 text-rose-700 font-bold px-2.5 py-0.5 rounded-full border border-rose-200/80">
              {urgentRequests.length} نداء عاجل
            </span>
          </div>

          <button
            onClick={() => onNavigate('requests')}
            className="text-xs font-bold text-rose-700 hover:text-rose-900 flex items-center gap-1 cursor-pointer"
          >
            <span>عرض الكل ({requests.length})</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {urgentRequests.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {urgentRequests.map((req) => (
              <div
                key={req.id}
                onClick={() => onSelectRequest(req)}
                className="bg-white rounded-3xl p-4.5 border border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group hover:border-rose-300"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200/70">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                      {req.urgency === 'critical' ? 'عاجل جداً' : 'عاجل'}
                    </span>
                    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-700 to-red-800 text-white font-sans font-black text-sm flex items-center justify-center shadow-xs">
                      {req.bloodType}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm group-hover:text-rose-700 transition-colors">
                    {req.patientName}
                  </h4>

                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Hospital className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{req.hospital}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{req.district}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 mt-2.5 line-clamp-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                    {req.caseDetails}
                  </p>
                </div>

                <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    مطلوب: <span className="text-rose-700 font-black font-sans">{req.unitsNeeded}</span> وحدات
                  </span>
                  <a
                    href={`tel:${req.contactPhone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-emerald-700 font-bold hover:text-white bg-emerald-50 hover:bg-emerald-600 px-3.5 py-1.5 rounded-xl border border-emerald-200 hover:border-emerald-600 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>اتصال</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 text-center border border-slate-200/90 text-slate-500">
            <Heart className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs font-semibold">لا توجد طلبات دم عاجلة مفتوحة حالياً، الحمد لله.</p>
          </div>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4.5 rounded-3xl border border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] text-center">
          <span className="text-2xl font-black text-rose-700 font-sans block">{donors.length}</span>
          <span className="text-xs font-bold text-slate-700 mt-1 block">إجمالي المتبرعين</span>
          <span className="text-[10px] text-slate-400">سجل قعطبة الشامل</span>
        </div>
        <div className="bg-white p-4.5 rounded-3xl border border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] text-center">
          <span className="text-2xl font-black text-emerald-700 font-sans block">
            {availableDonorsCount}
          </span>
          <span className="text-xs font-bold text-slate-700 mt-1 block">متاحون للتبرع</span>
          <span className="text-[10px] text-emerald-600 font-medium">جاهزون فوراً</span>
        </div>
        <div className="bg-white p-4.5 rounded-3xl border border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] text-center">
          <span className="text-2xl font-black text-amber-600 font-sans block">
            {requests.filter((r) => r.status === 'open').length}
          </span>
          <span className="text-xs font-bold text-slate-700 mt-1 block">طلبات نشطة</span>
          <span className="text-[10px] text-slate-400">قيد المتابعة الطبية</span>
        </div>
        <div className="bg-white p-4.5 rounded-3xl border border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] text-center">
          <span className="text-2xl font-black text-sky-700 font-sans block">
            {requests.filter((r) => r.status === 'fulfilled').length}
          </span>
          <span className="text-xs font-bold text-slate-700 mt-1 block">حالات أُنقذت</span>
          <span className="text-[10px] text-sky-600 font-medium">تم توفير الدم بنجاح</span>
        </div>
      </div>
    </div>
  );
};
