import React from 'react';
import {
  Info,
  HeartHandshake,
  ShieldCheck,
  MapPin,
  Droplet,
  Bell,
  Users,
  BookOpen,
  PhoneCall,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { ActivePage, BloodRequest, District, Donor } from '../types';

interface AboutPageProps {
  donors: Donor[];
  requests: BloodRequest[];
  districts: District[];
  onNavigate: (page: ActivePage) => void;
  onBack?: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  donors,
  requests,
  districts,
  onNavigate,
  onBack
}) => {
  const availableCount = donors.filter((d) => d.isAvailable).length;
  const fulfilledCount = requests.filter((r) => r.status === 'fulfilled').length;

  return (
    <div className="space-y-5 pb-24 font-['Cairo',sans-serif]">
      {/* Hero Banner */}
      <div className="bg-gradient-to-bl from-rose-900 via-red-900 to-slate-900 text-white rounded-3xl p-5 sm:p-7 shadow-lg border border-red-950/30 space-y-3.5">
        {onBack && (
          <div className="mb-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer shrink-0"
              title="الرجوع"
            >
              <ArrowRight className="w-4 h-4 text-amber-300" />
              <span>الرجوع</span>
            </button>
          </div>
        )}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
            <HeartHandshake className="w-6 h-6 text-rose-200" />
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-black text-white">
              تطبيق سجل المتبرعين بالدم في مديرية قعطبة
            </h2>
            <p className="text-xs sm:text-sm text-amber-200 font-bold mt-0.5">
              برعاية اللجنة المجتمعية – مديرية قعطبة
            </p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-100 leading-relaxed pt-1">
          تطبيق إلكتروني يهدف إلى تنظيم وإدارة بيانات المتبرعين بالدم في مديرية قعطبة، وتسهيل الوصول إلى المتبرعين عند الحاجة، بما يسهم في إنقاذ الأرواح وتعزيز التكافل والتعاون المجتمعي.
        </p>
      </div>

      {/* Official Sponsorship & Vision Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-rose-200/70 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              رعاية اللجنة المجتمعية ورؤية المشروع
            </h3>
            <p className="text-[11px] text-slate-500">
              اللجنة المجتمعية – مديرية قعطبة
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
          <p>
            يأتي هذا المشروع برعاية <strong className="text-slate-900">اللجنة المجتمعية في مديرية قعطبة</strong>، وحرصًا منها على دعم المبادرات الإنسانية والمجتمعية، وتطوير آليات التنسيق بين المتبرعين والمحتاجين للدم، وتسهيل عمليات التواصل والاستجابة للحالات الطارئة.
          </p>
          <p>
            نسعى من خلال هذا التطبيق إلى بناء قاعدة بيانات منظمة وآمنة للمتبرعين، وتعزيز ثقافة التبرع الطوعي بالدم، وترسيخ قيم التعاون والتراحم بين أبناء المجتمع.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/70 text-center space-y-1">
          <p className="text-sm sm:text-base font-black text-rose-900">
            معًا من أجل إنقاذ الأرواح... قطرة دم قد تصنع حياة.
          </p>
          <p className="text-xs font-bold text-rose-700">
            برعاية اللجنة المجتمعية – مديرية قعطبة
          </p>
        </div>
      </div>

      {/* Live Statistics from Database */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <span className="text-2xl font-black text-rose-700 font-sans tabular-nums block">
            {donors.length}
          </span>
          <span className="text-xs font-bold text-slate-700 mt-1 block">متبرع مسجل</span>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <span className="text-2xl font-black text-emerald-700 font-sans tabular-nums block">
            {availableCount}
          </span>
          <span className="text-xs font-bold text-slate-700 mt-1 block">جاهز للتبرع</span>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <span className="text-2xl font-black text-sky-700 font-sans tabular-nums block">
            {fulfilledCount}
          </span>
          <span className="text-xs font-bold text-slate-700 mt-1 block">حالة تم إنقاذها</span>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <span className="text-2xl font-black text-amber-600 font-sans tabular-nums block">
            {districts.length}
          </span>
          <span className="text-xs font-bold text-slate-700 mt-1 block">منطقة مغطاة</span>
        </div>
      </div>

      {/* Core Features */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Info className="w-5 h-5 text-rose-700" />
          <h3 className="text-base font-bold text-slate-900">أهداف المنصة وآلية العمل</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <Users className="w-4.5 h-4.5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">قاعدة بيانات دقيقة</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              توثيق بيانات المتبرعين حسب الفصيلة والقرية والمديرية مع منع التكرار لضمان موثوقية الاستجابة.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Bell className="w-4.5 h-4.5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">تنبيهات الطوارئ الذكية</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              إشعارات فورية على الهاتف وتطبيق أندرويد فور نشر طلب دم مطابق لفصيلة المتبرع ونطاقه الجغرافي.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">العمل المستمر والموثوقية</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              حفظ محلي وسحابي متزامن يتيح تصفح السجل والوصول للمتبرعين حتى في حال ضعف الإنترنت.
            </p>
          </div>
        </div>
      </div>

      {/* Covered Districts from Live Firestore */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <MapPin className="w-5 h-5 text-rose-700" />
          <h3 className="text-base font-bold text-slate-900">النطاق الجغرافي والمناطق المخدومة</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {districts.map((dist) => (
            <div
              key={dist.id}
              className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">{dist.name}</h4>
              </div>
              {dist.areas.length > 0 && (
                <p className="text-[11px] text-slate-500 pr-6 leading-relaxed">
                  {dist.areas.join(' · ')}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate('info')}
          className="flex-1 min-w-[160px] py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <BookOpen className="w-4 h-4 text-rose-700" />
          <span>شروط وإرشادات التبرع</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('contact')}
          className="flex-1 min-w-[160px] py-3 px-4 rounded-2xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
        >
          <PhoneCall className="w-4 h-4" />
          <span>تواصل مع إدارة السجل</span>
        </button>
      </div>
    </div>
  );
};
