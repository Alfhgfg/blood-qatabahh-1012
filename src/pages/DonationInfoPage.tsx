import React, { useState } from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  Heart, 
  AlertTriangle, 
  HelpCircle, 
  Clock, 
  ShieldCheck, 
  Calculator,
  Droplet,
  ArrowRight
} from 'lucide-react';
import { COMPATIBILITY_MAP } from '../services/storageService';
import { BloodType } from '../types';

interface DonationInfoPageProps {
  onBack?: () => void;
}

export const DonationInfoPage: React.FC<DonationInfoPageProps> = ({ onBack }) => {
  // Interactive Eligibility Calculator State
  const [age, setAge] = useState<number>(25);
  const [weight, setWeight] = useState<number>(65);
  const [lastDonationMonths, setLastDonationMonths] = useState<number>(4);
  const [hasChronicDisease, setHasChronicDisease] = useState<boolean>(false);
  const [hadRecentCupping, setHadRecentCupping] = useState<boolean>(false);
  const [takingMeds, setTakingMeds] = useState<boolean>(false);

  // Blood compatibility interactive viewer
  const [selectedBlood, setSelectedBlood] = useState<BloodType>('O+');

  // Check eligibility calculations
  const isAgeOk = age >= 18 && age <= 65;
  const isWeightOk = weight >= 50;
  const isTimeOk = lastDonationMonths >= 2;
  const isGeneralHealthOk = !hasChronicDisease && !hadRecentCupping;
  const canDonateNow = isAgeOk && isWeightOk && isTimeOk && isGeneralHealthOk && !takingMeds;

  const bloodTypes: BloodType[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

  return (
    <div className="space-y-6 pb-24">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center justify-between gap-3.5">
        <div className="flex items-center gap-3.5">
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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-800 to-red-900 text-white flex items-center justify-center shadow-xs shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              معلومات وإرشادات التبرع بالدم
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              دليلك الصحي الشامل للتبرع الآمن والمحافظة على صحتك وإنقاذ الأرواح
            </p>
          </div>
        </div>
      </div>

      {/* ❤️ تذكّر Banner */}
      <div className="bg-gradient-to-r from-rose-900 via-red-900 to-slate-900 text-white p-4.5 sm:p-5 rounded-3xl shadow-sm border border-red-950/40 flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/10">
          <Heart className="w-5 h-5 text-rose-300 fill-rose-300 animate-pulse" />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-black">❤️ تذكّر</h3>
          <p className="text-xs sm:text-sm text-slate-200 font-medium mt-0.5 leading-relaxed">
            قطرة من دمك قد تمنح إنسانًا فرصة جديدة للحياة.
          </p>
        </div>
      </div>

      {/* أولاً: شروط التبرع بالدم */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
            أولاً: شروط التبرع بالدم
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            لضمان سلامة المتبرع والمستفيد، يجب مراعاة الشروط التالية:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
          {/* 1. العمر */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
              <span className="text-rose-600">🔹 1.</span>
              <span>العمر:</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-xs">
              عادةً من 18 إلى 65 عامًا، وفقًا للضوابط الطبية المعتمدة.
            </p>
          </div>

          {/* 2. آخر مرة قمت بالتبرع */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
              <span className="text-rose-600">🔹 2.</span>
              <span>اخر مره قمت بالتبرع:</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-xs">
              ان يمضي من التبرع الاخير من شهرين الى ثلاث اشهر.
            </p>
          </div>

          {/* 3. الحالة الصحية */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
              <span className="text-rose-600">🔹 3.</span>
              <span>الحالة الصحية:</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-xs">
              أن يكون المتبرع بصحة جيدة، وألا يعاني من أمراض تمنع التبرع.
            </p>
          </div>

          {/* 4. نسبة الهيموجلوبين */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
              <span className="text-rose-600">🔹 4.</span>
              <span>نسبة الهيموجلوبين (قوة الدم):</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-xs">
              تُفحص قبل التبرع، ويحدد المختص مدى ملاءمتها للتبرع.
            </p>
          </div>

          {/* 5. العلامات الحيوية */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 md:col-span-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 mb-1.5">
              <span className="text-rose-600">🔹 5.</span>
              <span>العلامات الحيوية:</span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600">
              <li className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-800 block mb-0.5">• درجة الحرارة:</span>
                عادةً لا تتجاوز 37.5 درجة مئوية.
              </li>
              <li className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-800 block mb-0.5">• ضغط الدم:</span>
                يجب أن يكون ضمن الحدود المقبولة طبيًا.
              </li>
              <li className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-800 block mb-0.5">• نبض القلب:</span>
                منتظم وضمن المعدل المقبول للتبرع.
              </li>
            </ul>
          </div>

          {/* 6. الأدوية */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
              <span className="text-rose-600">🔹 6.</span>
              <span>الأدوية:</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-xs">
              يجب إبلاغ المختص بجميع الأدوية التي تتناولها، فقد يؤثر بعضها في إمكانية التبرع.
            </p>
          </div>

          {/* 7. الحجامة */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
              <span className="text-rose-600">🔹 7.</span>
              <span>الحجامة:</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-xs">
              أخبر المختص بموعد آخر حجامة، ليحدد مدى ملاءمة التبرع وفقًا للإرشادات المعتمدة.
            </p>
          </div>

          {/* 8. الأمراض */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 md:col-span-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
              <span className="text-rose-600">🔹 8.</span>
              <span>الأمراض:</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-xs">
              يجب الإفصاح عن الأمراض المزمنة أو المعدية وأي مشكلة صحية قد تؤثر في سلامة التبرع.
            </p>
          </div>
        </div>
      </div>

      {/* ثانياً وثالثاً: نصائح قبل وبعد التبرع */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ثانياً: نصائح قبل التبرع */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm">
              قبل
            </div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              ثانيًا: نصائح قبل التبرع بالدم
            </h3>
          </div>

          <div className="space-y-2.5 text-xs text-slate-700">
            <div className="flex items-start gap-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
              <span className="text-emerald-600 font-bold shrink-0">✅</span>
              <span>تناول وجبة غذائية مناسبة قبل التبرع.</span>
            </div>
            <div className="flex items-start gap-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
              <span className="text-emerald-600 font-bold shrink-0">✅</span>
              <span>اشرب كمية كافية من الماء.</span>
            </div>
            <div className="flex items-start gap-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
              <span className="text-emerald-600 font-bold shrink-0">✅</span>
              <span>احصل على قسط كافٍ من النوم.</span>
            </div>
            <div className="flex items-start gap-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
              <span className="text-emerald-600 font-bold shrink-0">✅</span>
              <span>أخبر المختص عن حالتك الصحية والأدوية التي تتناولها.</span>
            </div>
          </div>
        </div>

        {/* ثالثاً: نصائح بعد التبرع */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm">
              بعد
            </div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              ثالثًا: نصائح بعد التبرع بالدم
            </h3>
          </div>

          <div className="space-y-2.5 text-xs text-slate-700">
            <div className="flex items-start gap-2 bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100">
              <span className="text-emerald-600 font-bold shrink-0">✅</span>
              <span>
                <strong>الراحة:</strong> استرح في مكان التبرع لمدة 10–15 دقيقة على الأقل.
              </span>
            </div>
            <div className="flex items-start gap-2 bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100">
              <span className="text-emerald-600 font-bold shrink-0">✅</span>
              <span>
                <strong>السوائل:</strong> اشرب الماء والسوائل بكميات كافية.
              </span>
            </div>
            <div className="flex items-start gap-2 bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100">
              <span className="text-emerald-600 font-bold shrink-0">✅</span>
              <span>
                <strong>الجهد البدني:</strong> تجنب الرياضة الشاقة ورفع الأوزان الثقيلة لبقية اليوم.
              </span>
            </div>
            <div className="flex items-start gap-2 bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100">
              <span className="text-emerald-600 font-bold shrink-0">✅</span>
              <span>
                <strong>التغذية:</strong> تناول وجبات غذائية متوازنة.
              </span>
            </div>
            <div className="flex items-start gap-2 bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100">
              <span className="text-emerald-600 font-bold shrink-0">✅</span>
              <span>
                <strong>الضمادة:</strong> اتركها لمدة 2–3 ساعات، أو حسب تعليمات مركز التبرع.
              </span>
            </div>
            <div className="flex items-start gap-2 bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100">
              <span className="text-emerald-600 font-bold shrink-0">✅</span>
              <span>
                <strong>عند الشعور بالدوخة:</strong> اجلس أو استلقِ، وارفع قدميك قليلًا، واطلب المساعدة إذا استمر الشعور.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ⚠️ تنبيه مهم */}
      <div className="p-4 sm:p-5 rounded-3xl bg-amber-50 border border-amber-200/80 text-amber-900 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs sm:text-sm font-bold mb-1">⚠️ تنبيه مهم:</h4>
          <p className="text-xs leading-relaxed text-amber-800">
            هذه إرشادات عامة، ولا تغني عن الفحص الطبي. يحدد المختص أهلية التبرع والفترة المناسبة بين التبرعات وفقًا للحالة الصحية واللوائح المعتمدة.
          </p>
        </div>
      </div>

      {/* Interactive Tool: حاسبة الأهلية السريعة للتبرع */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              حاسبة التحقق من الأهلية للتبرع اليوم
            </h3>
            <p className="text-xs text-slate-500">
              أدخل بياناتك لاختبار الشروط الأولية للتبرع وفق الإرشادات
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Age */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              العمر: <span className="text-rose-600 font-sans">{age}</span> سنة
            </label>
            <input
              type="range"
              min="15"
              max="75"
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className="w-full accent-rose-600 cursor-pointer"
            />
            <span className="text-[10px] text-slate-400 block mt-1">المطلوب: 18 إلى 65 سنة</span>
          </div>

          {/* Weight */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              الوزن التقريبي: <span className="text-rose-600 font-sans">{weight}</span> كجم
            </label>
            <input
              type="range"
              min="40"
              max="120"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="w-full accent-rose-600 cursor-pointer"
            />
            <span className="text-[10px] text-slate-400 block mt-1">المطلوب: 50 كجم فما فوق</span>
          </div>

          {/* Last Donation */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              مضى على آخر تبرع: <span className="text-rose-600 font-sans">{lastDonationMonths}</span> أشهر
            </label>
            <input
              type="range"
              min="0"
              max="12"
              value={lastDonationMonths}
              onChange={(e) => setLastDonationMonths(Number(e.target.value))}
              className="w-full accent-rose-600 cursor-pointer"
            />
            <span className="text-[10px] text-slate-400 block mt-1">المطلوب: شهرين إلى 3 أشهر</span>
          </div>
        </div>

        {/* Checkboxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={hasChronicDisease}
              onChange={(e) => setHasChronicDisease(e.target.checked)}
              className="rounded-sm accent-rose-600"
            />
            <span className="text-slate-700">يعاني من أمراض مزمنة تمنع التبرع</span>
          </label>

          <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={hadRecentCupping}
              onChange={(e) => setHadRecentCupping(e.target.checked)}
              className="rounded-sm accent-rose-600"
            />
            <span className="text-slate-700">أجرى حجامة حديثة جداً</span>
          </label>

          <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={takingMeds}
              onChange={(e) => setTakingMeds(e.target.checked)}
              className="rounded-sm accent-rose-600"
            />
            <span className="text-slate-700">يتناول أدوية حالياً (مضادات/مسكنات)</span>
          </label>
        </div>

        {/* Calculation Result */}
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 ${
            canDonateNow
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {canDonateNow ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
          )}
          <div>
            <h4 className="text-xs sm:text-sm font-bold">
              {canDonateNow
                ? 'مبارك! أنت مستوفٍ للشروط العامة المبدئية للتبرع بالدم 🎉'
                : 'أنت غير مستوفٍ لأحد الشروط الأساسية للتبرع حالياً'}
            </h4>
            <p className="text-xs mt-0.5 opacity-90">
              {canDonateNow
                ? 'يمكنك التوجه لأقرب مركز تبرع أو مستشفى في قعطبة أو التسجيل في السجل للاتصال بك عند الحاجة.'
                : 'يرجى مراجعة الطبيب المختص أو الانتظار حتى اكتمال المدة الموصى بها حفاظاً على صحتك.'}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Blood Compatibility Table */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Droplet className="w-5 h-5 text-rose-600 fill-rose-600" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              جدول توافق فصائل الدم (من يتبرع لمن؟)
            </h3>
          </div>
          <span className="text-xs text-slate-400">انقر على فصيلة للاستكشاف</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {bloodTypes.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedBlood(t)}
              className={`px-3 py-1.5 rounded-xl font-bold font-sans text-xs transition-all border cursor-pointer ${
                selectedBlood === t
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl">
            <span className="text-xs font-bold text-rose-900 block mb-1">
              فصيلة ({selectedBlood}) تمنح الدم لـ:
            </span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {COMPATIBILITY_MAP[selectedBlood].canDonateTo.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-lg bg-white border border-rose-300 font-bold font-sans text-xs text-rose-700 shadow-2xs"
                >
                  {t}
                </span>
              ))}
            </div>
            {selectedBlood === 'O-' && (
              <p className="text-[11px] text-rose-700 font-semibold mt-2">
                🌟 فصيلة O- هي معطاء عام لجميع الفصائل في العالم.
              </p>
            )}
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <span className="text-xs font-bold text-slate-800 block mb-1">
              فصيلة ({selectedBlood}) تستقبل الدم من:
            </span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {COMPATIBILITY_MAP[selectedBlood].canReceiveFrom.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 font-bold font-sans text-xs text-slate-700 shadow-2xs"
                >
                  {t}
                </span>
              ))}
            </div>
            {selectedBlood === 'AB+' && (
              <p className="text-[11px] text-slate-600 font-semibold mt-2">
                🌟 فصيلة AB+ هي مستقبل عام يمكنها الاستقبال من أي فصيلة.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
