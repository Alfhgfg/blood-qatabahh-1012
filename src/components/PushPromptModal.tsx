import React, { useState } from 'react';
import { 
  Bell, 
  BellRing, 
  X, 
  CheckCircle2, 
  MapPin, 
  Droplet, 
  ShieldCheck, 
  Volume2, 
  Smartphone 
} from 'lucide-react';
import { BloodType, District } from '../types';
import { pushNotificationService } from '../services/pushNotificationService';

const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface PushPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  districts: District[];
  userBloodType?: BloodType;
  onTriggerToast: (msg: string) => void;
}

export const PushPromptModal: React.FC<PushPromptModalProps> = ({
  isOpen,
  onClose,
  districts,
  userBloodType,
  onTriggerToast
}) => {
  if (!isOpen) return null;

  const [selectedBlood, setSelectedBlood] = useState<BloodType | 'all'>(userBloodType || 'all');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isNative = pushNotificationService.isNative();
  const isSupported = pushNotificationService.isSupported();

  const handleActivate = async () => {
    if (!isSupported) {
      try {
        localStorage.setItem('qaatabah_push_prompt_dismissed_v1', 'true');
      } catch {}
      onTriggerToast('ستصلك كافة التنبيهات داخل التطبيق عند فتحه 🔔');
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await pushNotificationService.requestPermission();
      if (res.success || res.permission === 'granted') {
        pushNotificationService.savePreferences({
          enabled: true,
          bloodType: selectedBlood,
          district: selectedDistrict
        });
        // Mark as prompted
        try {
          localStorage.setItem('qaatabah_push_prompt_dismissed_v1', 'true');
        } catch {}
        onTriggerToast(res.message || 'تم تفعيل الإشعارات الفورية بنجاح! ستصلك نداءات الطوارئ فوراً 🔔');
        onClose();
      } else if (res.permission === 'denied') {
        try {
          localStorage.setItem('qaatabah_push_prompt_dismissed_v1', 'true');
        } catch {}
        onTriggerToast(isNative ? 'تم رفض إذن الإشعارات من إعدادات الهاتف. يمكنك تفعيله من إعدادات التطبيق.' : 'تم رفض إذن الإشعارات من إعدادات المتصفح. يمكنك تفعيله من إعدادات الموقع.');
        onClose();
      } else {
        onTriggerToast(res.message || 'تعذر تفعيل الإشعارات على هذا الجهاز');
        onClose();
      }
    } catch {
      onTriggerToast('حدث خطأ أثناء طلب إذن الإشعارات');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem('qaatabah_push_prompt_dismissed_v1', 'true');
    } catch {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200 font-['Cairo',sans-serif]">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-rose-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header with attractive emergency gradient */}
        <div className="relative overflow-hidden bg-gradient-to-r from-rose-950 via-slate-900 to-rose-900 text-white p-5 pt-6 pb-6 border-b border-rose-900/50">
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-4 left-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="إغلاق"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-900/40">
              <BellRing className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-[11px] font-bold text-amber-300">
                  {isNative ? 'تطبيق أندرويد (APK) – تنبيهات الطوارئ' : 'نداءات الدم وطوارئ قعطبة'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
                {isNative ? 'تفعيل إشعارات الهاتف الفورية 📲' : 'تفعيل الإشعارات على جهازك 📲'}
              </h3>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-slate-800">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
            لإنقاذ أرواح المرضى والحالات الحرجة في قعطبة، فعّل الإشعارات الخارجية لتصلك نداءات التبرع العاجلة المتوافقة معك <strong className="text-rose-700 font-bold">حتى عند إغلاق التطبيق</strong>.
          </p>

          {!isSupported && (
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>الإشعارات الخارجية غير مدعومة في بيئة المتصفح الحالية. لا تقلق، ستصلك كافة التنبيهات ونداءات الدم داخل التطبيق عند استخدامه.</span>
            </div>
          )}

          {/* Quick Customization: Blood Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5 text-rose-600 fill-rose-600" />
                <span>فصيلة دمك المفضلة للتنبيهات:</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                {selectedBlood === 'all' ? 'كافة الفصائل' : selectedBlood}
              </span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedBlood('all')}
                className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  selectedBlood === 'all'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                الكل
              </button>
              {BLOOD_TYPES.map((bt) => (
                <button
                  key={bt}
                  type="button"
                  onClick={() => setSelectedBlood(bt)}
                  className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    selectedBlood === bt
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {bt}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Customization: District */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-600" />
              <span>المنطقة / المركز:</span>
            </label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            >
              <option value="all">كافة مناطق مديرية قعطبة</option>
              {districts.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Features list */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5 text-[11px] text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>تنبيه فوري عند إضافة أي طلب دم عاجل يطابق فصيلتك.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>الضغط على الإشعار يفتح تفاصيل الحالة والاستجابة بضغطة زر.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>يمكنك تعديل هذه الإعدادات في أي وقت من أيقونة الجرس 🔔.</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleActivate}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-900/20 hover:shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Bell className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري التفعيل...' : 'تفعيل الإشعارات الفورية الآن'}</span>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full sm:w-auto py-2.5 px-4 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              ليس الآن (تخطي)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
