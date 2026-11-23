import React, { useState } from 'react';
import { 
  PieChart, 
  Droplets, 
  Check, 
  X, 
  Activity, 
  Info, 
  ArrowLeft 
} from 'lucide-react';
import { BloodType, Donor } from '../types';

interface DonutChartProps {
  donors: Donor[];
  onSelectBloodType?: (type: BloodType | null) => void;
  selectedBloodType?: BloodType | null;
}

interface BloodMeta {
  stroke: string;
  gradientFrom: string;
  gradientTo: string;
  bgLight: string;
  textColor: string;
  badgeBg: string;
  badgeText: string;
  label: string;
  note: string;
}

const BLOOD_CONFIG: Record<BloodType, BloodMeta> = {
  'O+': { 
    stroke: '#e11d48', // rose-600
    gradientFrom: '#f43f5e',
    gradientTo: '#be123c',
    bgLight: 'bg-rose-50/70', 
    textColor: 'text-rose-600', 
    badgeBg: 'bg-rose-100', 
    badgeText: 'text-rose-800', 
    label: 'الأكثر طلباً',
    note: 'الفصيلة الأكثر استخداماً في الطوارئ'
  },
  'O-': { 
    stroke: '#be123c', // rose-700
    gradientFrom: '#e11d48',
    gradientTo: '#9f1239',
    bgLight: 'bg-red-50/70', 
    textColor: 'text-red-700', 
    badgeBg: 'bg-red-100', 
    badgeText: 'text-red-900', 
    label: 'مانح عام نادر',
    note: 'تمنح لجميع فصائل الدم الأخرى'
  },
  'A+': { 
    stroke: '#ea580c', // orange-600
    gradientFrom: '#f97316',
    gradientTo: '#c2410c',
    bgLight: 'bg-orange-50/70', 
    textColor: 'text-orange-600', 
    badgeBg: 'bg-orange-100', 
    badgeText: 'text-orange-800', 
    label: 'شائع ومطلوب',
    note: 'مطلوبة بكثرة في العمليات الجراحية'
  },
  'A-': { 
    stroke: '#d97706', // amber-600
    gradientFrom: '#f59e0b',
    gradientTo: '#b45309',
    bgLight: 'bg-amber-50/70', 
    textColor: 'text-amber-700', 
    badgeBg: 'bg-amber-100', 
    badgeText: 'text-amber-900', 
    label: 'فصيلة نادرة',
    note: 'مخزون حرج يحتاج دعم المتبرعين دائماً'
  },
  'B+': { 
    stroke: '#0284c7', // sky-600
    gradientFrom: '#38bdf8',
    gradientTo: '#0369a1',
    bgLight: 'bg-sky-50/70', 
    textColor: 'text-sky-600', 
    badgeBg: 'bg-sky-100', 
    badgeText: 'text-sky-800', 
    label: 'طلب متكرر',
    note: 'تمنح لمرضى الفصائل B+ و AB+'
  },
  'B-': { 
    stroke: '#0d9488', // teal-600
    gradientFrom: '#2dd4bf',
    gradientTo: '#0f766e',
    bgLight: 'bg-teal-50/70', 
    textColor: 'text-teal-700', 
    badgeBg: 'bg-teal-100', 
    badgeText: 'text-teal-900', 
    label: 'فصيلة نادرة',
    note: 'حاجة ماسة للمتبرعين الملتزمين'
  },
  'AB+': { 
    stroke: '#7c3aed', // violet-600
    gradientFrom: '#a855f7',
    gradientTo: '#6d28d9',
    bgLight: 'bg-purple-50/70', 
    textColor: 'text-purple-600', 
    badgeBg: 'bg-purple-100', 
    badgeText: 'text-purple-800', 
    label: 'مستقبل عام',
    note: 'تستقبل كريات الدم من كافة الفصائل'
  },
  'AB-': { 
    stroke: '#4f46e5', // indigo-600
    gradientFrom: '#6366f1',
    gradientTo: '#3730a3',
    bgLight: 'bg-indigo-50/70', 
    textColor: 'text-indigo-600', 
    badgeBg: 'bg-indigo-100', 
    badgeText: 'text-indigo-900', 
    label: 'أندر الفصائل',
    note: 'تمثل أقل من 1% من إجمالي السكان'
  }
};

export const DonutChart: React.FC<DonutChartProps> = ({
  donors,
  onSelectBloodType,
  selectedBloodType
}) => {
  const [hoveredType, setHoveredType] = useState<BloodType | null>(null);

  const totalDonors = donors.length;
  const availableCount = donors.filter((d) => d.isAvailable).length;

  const bloodCounts: Record<BloodType, number> = {
    'O+': 0,
    'O-': 0,
    'A+': 0,
    'A-': 0,
    'B+': 0,
    'B-': 0,
    'AB+': 0,
    'AB-': 0
  };

  donors.forEach((d) => {
    if (bloodCounts[d.bloodType] !== undefined) {
      bloodCounts[d.bloodType]++;
    }
  });

  const bloodTypesList: BloodType[] = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'];

  // Calculate SVG arc parameters
  const radius = 70;
  const circumference = 2 * Math.PI * radius; // ~439.82
  let cumulativeOffset = 0;

  const segments = bloodTypesList.map((type) => {
    const count = bloodCounts[type];
    const percentage = totalDonors > 0 ? (count / totalDonors) * 100 : 0;
    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativeOffset;
    cumulativeOffset += (percentage / 100) * circumference;

    return {
      type,
      count,
      percentage: percentage.toFixed(1),
      strokeDasharray,
      strokeDashoffset,
      config: BLOOD_CONFIG[type]
    };
  });

  const activeFocusType = hoveredType || selectedBloodType;
  const activeFocusData = activeFocusType
    ? {
        type: activeFocusType,
        count: bloodCounts[activeFocusType],
        pct: totalDonors > 0 ? ((bloodCounts[activeFocusType] / totalDonors) * 100).toFixed(1) : '0',
        config: BLOOD_CONFIG[activeFocusType]
      }
    : null;

  return (
    <div className="relative overflow-hidden bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.04)] font-['Cairo',sans-serif]">
      {/* Decorative ambient glow */}
      <div 
        className="pointer-events-none absolute -top-20 -left-20 w-64 h-64 rounded-full bg-rose-500/5 blur-3xl"
        aria-hidden="true"
      />
      <div 
        className="pointer-events-none absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-sky-500/5 blur-3xl"
        aria-hidden="true"
      />

      {/* Header Bar */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-700 via-rose-800 to-red-900 text-white flex items-center justify-center shadow-md shadow-rose-900/20 shrink-0">
            <PieChart className="w-5 h-5 text-rose-100" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                توزيع فصائل الدم في مديرية قعطبة
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/70">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                سجل إلكتروني حي
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              مخطط تحليلي دقيق لنسب الفصائل وبطاقات تفاعلية فورية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {selectedBloodType && onSelectBloodType ? (
            <button
              onClick={() => onSelectBloodType(null)}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs shadow-xs transition-all active:scale-98 cursor-pointer flex items-center gap-1.5"
            >
              <span>إلغاء تصفية ({selectedBloodType})</span>
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-rose-600" />
              <span>
                <strong className="text-slate-800 font-sans font-bold">{availableCount}</strong> متاح للتبرع الآن
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Donut Visual & Center Dial */}
      <div className="relative flex items-center justify-center py-2">
        <div className="relative w-56 h-56 sm:w-60 sm:h-60 flex items-center justify-center shrink-0">
          <svg className="w-full h-full -rotate-90 transform drop-shadow-xs" viewBox="0 0 190 190">
            <circle
              cx="95"
              cy="95"
              r={radius}
              fill="transparent"
              stroke="#f1f5f9"
              strokeWidth="20"
            />

            {segments.map((seg) => {
              if (seg.count === 0) return null;
              const isSelected = selectedBloodType === seg.type;
              const isHovered = hoveredType === seg.type;
              const isActive = isSelected || isHovered;

              return (
                <circle
                  key={seg.type}
                  cx="95"
                  cy="95"
                  r={radius}
                  fill="transparent"
                  stroke={seg.config.stroke}
                  strokeWidth={isActive ? 25 : 20}
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-300 cursor-pointer origin-center hover:opacity-95"
                  onMouseEnter={() => setHoveredType(seg.type)}
                  onMouseLeave={() => setHoveredType(null)}
                  onClick={() => onSelectBloodType && onSelectBloodType(selectedBloodType === seg.type ? null : seg.type)}
                />
              );
            })}
          </svg>

          {/* Central Precision Dial Card */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-gradient-to-b from-white via-slate-50 to-slate-100/90 border border-slate-200/80 shadow-[inset_0_2px_6px_rgba(0,0,0,0.04),0_6px_16px_rgba(0,0,0,0.04)] flex flex-col items-center justify-center p-3 text-center transition-all duration-300">
              {activeFocusData ? (
                <>
                  <span className="text-[10px] font-bold text-slate-400">فصيلة</span>
                  <div className="flex items-center gap-1 my-0.5">
                    <span 
                      className="text-2xl sm:text-3xl font-black font-sans tracking-tight"
                      style={{ color: activeFocusData.config.stroke }}
                    >
                      {activeFocusData.type}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-800 font-sans">
                    {activeFocusData.count} متبرع · {activeFocusData.pct}%
                  </span>
                  <span 
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 line-clamp-1 border"
                    style={{ 
                      color: activeFocusData.config.stroke,
                      backgroundColor: `${activeFocusData.config.stroke}10`,
                      borderColor: `${activeFocusData.config.stroke}30`
                    }}
                  >
                    {activeFocusData.config.label}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center mb-0.5 text-rose-600">
                    <Droplets className="w-3.5 h-3.5 fill-rose-600 text-rose-600 animate-pulse" />
                  </div>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 font-sans tracking-tight">
                    {totalDonors}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500">
                    إجمالي المتبرعين
                  </span>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 mt-1">
                    جاهزون لإنقاذ الأرواح
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 8 Interactive Blood Group Cards Grid (بطاقات فصائل الدم التفاعلية الثماني) */}
      <div className="mt-6 pt-5 border-t border-slate-100">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">بطاقات فصائل الدم التفاعلية الثماني</h4>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">انقر على أي بطاقة للتصفية</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {segments.map((seg) => {
            const isSelected = selectedBloodType === seg.type;
            const isHovered = hoveredType === seg.type;
            const isActive = isSelected || isHovered;

            return (
              <div
                key={seg.type}
                onMouseEnter={() => setHoveredType(seg.type)}
                onMouseLeave={() => setHoveredType(null)}
                onClick={() => onSelectBloodType && onSelectBloodType(selectedBloodType === seg.type ? null : seg.type)}
                className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between group ${
                  isActive
                    ? 'ring-2 ring-rose-600 bg-rose-50/90 shadow-md border-rose-300 scale-102'
                    : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-sans font-black text-sm sm:text-base shadow-xs text-white"
                    style={{ background: `linear-gradient(135deg, ${seg.config.gradientFrom}, ${seg.config.gradientTo})` }}
                  >
                    {seg.type}
                  </span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg border text-center"
                    style={{
                      color: seg.config.stroke,
                      backgroundColor: `${seg.config.stroke}10`,
                      borderColor: `${seg.config.stroke}30`
                    }}
                  >
                    {seg.config.label}
                  </span>
                </div>

                <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-lg sm:text-xl font-black font-sans text-slate-900 block leading-tight">
                      {seg.count}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">متبرع مسجل</span>
                  </div>
                  <span className="text-xs font-black font-sans text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                    {seg.percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Helper Note */}
      <div className="relative mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>انقر على أي فصيلة بالأعلى لتصفية قائمة المتبرعين في قعطبة فوراً</span>
        </div>
        {selectedBloodType ? (
          <span className="font-bold text-rose-700 flex items-center gap-1">
            محدد الآن: ({selectedBloodType})
          </span>
        ) : (
          <span className="text-slate-400 font-medium">
            تحديث مباشر مع كل متبرع جديد
          </span>
        )}
      </div>
    </div>
  );
};
