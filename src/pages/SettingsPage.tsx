import React, { useEffect, useMemo, useState } from 'react';
import {
  Settings,
  Bell,
  Smartphone,
  Droplet,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Volume2,
  Vibrate,
  Download,
  LogOut,
  CheckCircle2,
  Wifi,
  WifiOff,
  AlertTriangle,
  Send,
  ArrowRight
} from 'lucide-react';
import { ActivePage, BloodRequest, BloodType, District, Donor, UserAccount, UserRole } from '../types';
import { pushNotificationService, PushNotificationPreferences } from '../services/pushNotificationService';
import { normalizePhoneNumber } from '../services/storageService';
import { appUpdateService, getCompiledVersionInfo } from '../services/appUpdateService';

interface SettingsPageProps {
  currentUser: UserAccount;
  role: UserRole;
  donors: Donor[];
  districts: District[];
  requests: BloodRequest[];
  onToggleDonorAvailability: (donor: Donor) => Promise<void>;
  onRefreshData: () => Promise<void>;
  onOpenInstallModal: () => void;
  onOpenRoleModal: () => void;
  onNavigate: (page: ActivePage) => void;
  onLogout: () => void;
  onTriggerToast: (msg: string) => void;
  onCheckForUpdates?: () => Promise<void> | void;
  onBack?: () => void;
}

const BLOOD_TYPES: BloodType[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

export const SettingsPage: React.FC<SettingsPageProps> = ({
  currentUser,
  role,
  donors,
  districts,
  requests,
  onToggleDonorAvailability,
  onRefreshData,
  onOpenInstallModal,
  onOpenRoleModal,
  onNavigate,
  onLogout,
  onTriggerToast,
  onCheckForUpdates,
  onBack
}) => {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [pushPrefs, setPushPrefs] = useState<PushNotificationPreferences>(() =>
    pushNotificationService.getPreferences()
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [installedVersionLabel, setInstalledVersionLabel] = useState<string>(
    () => `v${getCompiledVersionInfo().versionName}`
  );
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    pushNotificationService.getPermission().then(setPermission).catch(() => {});
    appUpdateService
      .getInstalledAppInfo()
      .then((info) => setInstalledVersionLabel(`v${info.versionName}`))
      .catch(() => {});
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const linkedDonor = useMemo(() => {
    if (currentUser.linkedDonorId) {
      const byId = donors.find((d) => d.id === currentUser.linkedDonorId);
      if (byId) return byId;
    }
    const cleanPhone = normalizePhoneNumber(currentUser.phone || '');
    if (cleanPhone) {
      return donors.find((d) => normalizePhoneNumber(d.phone) === cleanPhone) || null;
    }
    return null;
  }, [currentUser, donors]);

  const handleRequestPermission = async () => {
    const res = await pushNotificationService.requestPermission();
    const updatedPerm = await pushNotificationService.getPermission();
    setPermission(updatedPerm);
    setPushPrefs(pushNotificationService.getPreferences());
    onTriggerToast(res.message || (res.success ? 'تم تفعيل الإشعارات' : 'تعذر تفعيل الإشعارات'));
  };

  const updatePrefs = (partial: Partial<PushNotificationPreferences>) => {
    const next = pushNotificationService.savePreferences(partial);
    setPushPrefs(next);
  };

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      await onRefreshData();
      onTriggerToast('تمت مزامنة السجل السحابي وتحديث البيانات بنجاح ✅');
    } finally {
      setTimeout(() => setIsSyncing(false), 400);
    }
  };

  const handleTestPush = async () => {
    const bt = pushPrefs.bloodType !== 'all' ? pushPrefs.bloodType : 'O-';
    const dist = pushPrefs.district !== 'all' ? pushPrefs.district : 'مديرية قعطبة - المركز';
    const res = await pushNotificationService.sendTestNotification(0, bt, dist);
    onTriggerToast(res.message);
  };

  return (
    <div className="space-y-5 pb-24 font-['Cairo',sans-serif]">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-3.5">
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
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">الإعدادات</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ضبط تفضيلات الإشعارات، حالة التوفر للتبرع، والمزامنة السحابية
          </p>
        </div>
      </div>

      {/* Linked Donor Availability Setting */}
      {linkedDonor && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-700 font-sans font-black text-sm flex items-center justify-center shrink-0">
              {linkedDonor.bloodType}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">حالة توفرك للتبرع بالدم</h3>
              <p className="text-xs text-slate-500">
                {linkedDonor.isAvailable
                  ? 'حسابك يظهر كمتبرع جاهز للاستجابة للنداءات'
                  : 'تم إيقاف ظهورك مؤقتاً في قائمة المتاحين'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onToggleDonorAvailability(linkedDonor)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              linkedDonor.isAvailable
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
            }`}
          >
            {linkedDonor.isAvailable ? 'متاح الآن' : 'غير متاح'}
          </button>
        </div>
      )}

      {/* Push Notifications Preferences */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-rose-700" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900">إعدادات التنبيهات والإشعارات</h3>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {permission === 'granted' ? 'مفعلة' : permission === 'denied' ? 'محظورة' : 'تحتاج إذن'}
          </span>
        </div>

        {/* Enable Push Toggle */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
          <div>
            <span className="text-xs sm:text-sm font-bold text-slate-800 block">
              تفعيل إشعارات نداءات الدم الفورية
            </span>
            <span className="text-[11px] text-slate-500">
              استلام تنبيهات فورية على الهاتف عند الحاجة لفصيلة متوافقة
            </span>
          </div>
          {permission !== 'granted' && pushNotificationService.isSupported() ? (
            <button
              type="button"
              onClick={handleRequestPermission}
              className="px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold cursor-pointer shrink-0"
            >
              تفعيل الإذن
            </button>
          ) : (
            <input
              type="checkbox"
              checked={pushPrefs.enabled}
              onChange={(e) => {
                updatePrefs({ enabled: e.target.checked });
                onTriggerToast(e.target.checked ? 'تم تشغيل الإشعارات ✅' : 'تم إيقاف الإشعارات 🔕');
              }}
              className="w-5 h-5 accent-rose-700 cursor-pointer shrink-0"
            />
          )}
        </div>

        {/* Blood Type Filter */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Droplet className="w-4 h-4 text-rose-600" />
            <span>تصفية الإشعارات حسب فصيلة الدم</span>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5">
            <button
              type="button"
              onClick={() => updatePrefs({ bloodType: 'all' })}
              className={`py-2 px-2 rounded-xl text-xs font-bold border cursor-pointer ${
                pushPrefs.bloodType === 'all'
                  ? 'bg-rose-700 text-white border-rose-700'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              الكل
            </button>
            {BLOOD_TYPES.map((bt) => (
              <button
                key={bt}
                type="button"
                onClick={() => updatePrefs({ bloodType: bt })}
                className={`py-2 px-1 rounded-xl text-xs font-bold font-sans border cursor-pointer ${
                  pushPrefs.bloodType === bt
                    ? 'bg-rose-700 text-white border-rose-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {bt}
              </button>
            ))}
          </div>
        </div>

        {/* District Filter */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <MapPin className="w-4 h-4 text-rose-600" />
            <span>نطاق المنطقة الجغرافية للتنبيهات</span>
          </label>
          <select
            value={pushPrefs.district}
            onChange={(e) => updatePrefs({ district: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:outline-hidden focus:border-rose-600"
          >
            <option value="all">جميع المديريات والمناطق</option>
            {districts.map((d) => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Sound, Vibration & Critical Only */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <label className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between cursor-pointer">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>الحرجة فقط</span>
            </span>
            <input
              type="checkbox"
              checked={pushPrefs.criticalOnly}
              onChange={(e) => updatePrefs({ criticalOnly: e.target.checked })}
              className="w-4 h-4 accent-rose-700"
            />
          </label>

          <label className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between cursor-pointer">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Volume2 className="w-4 h-4 text-slate-600" />
              <span>صوت التنبيه</span>
            </span>
            <input
              type="checkbox"
              checked={pushPrefs.sound}
              onChange={(e) => updatePrefs({ sound: e.target.checked })}
              className="w-4 h-4 accent-rose-700"
            />
          </label>

          <label className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between cursor-pointer">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Vibrate className="w-4 h-4 text-slate-600" />
              <span>الاهتزاز</span>
            </span>
            <input
              type="checkbox"
              checked={pushPrefs.vibrate}
              onChange={(e) => updatePrefs({ vibrate: e.target.checked })}
              className="w-4 h-4 accent-rose-700"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleTestPush}
          className="w-full py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          <span>إرسال إشعار تجريبي للتأكد من العمل</span>
        </button>
      </div>

      {/* Sync & Cloud Connection */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {isOnline ? (
              <Wifi className="w-5 h-5 text-emerald-600" />
            ) : (
              <WifiOff className="w-5 h-5 text-amber-600" />
            )}
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isOnline ? 'متصل بقاعدة البيانات السحابية' : 'وضع عدم الاتصال (محلي)'}
              </h3>
              <p className="text-xs text-slate-500 font-sans">
                {donors.length} متبرع · {requests.length} طلب دم محفوظ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة الآن'}</span>
          </button>
        </div>
      </div>

      {/* App & Account Actions */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-2.5">
        <button
          type="button"
          onClick={onOpenInstallModal}
          className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/70 flex items-center justify-between text-right cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-rose-700" />
            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                تثبيت التطبيق على الهاتف (Android / PWA)
              </span>
              <span className="text-[11px] text-slate-500">إضافة أيقونة سريعة للوصول الفوري</span>
            </div>
          </div>
          <Download className="w-4 h-4 text-slate-400" />
        </button>

        {onCheckForUpdates && (
          <button
            type="button"
            disabled={isCheckingUpdate}
            onClick={async () => {
              try {
                setIsCheckingUpdate(true);
                await onCheckForUpdates();
              } finally {
                setIsCheckingUpdate(false);
              }
            }}
            className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/70 flex items-center justify-between text-right cursor-pointer transition-colors disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <RefreshCw className={`w-5 h-5 text-emerald-700 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                  التحقق من وجود تحديثات للتطبيق
                </span>
                <span className="text-[11px] text-slate-500">
                  الإصدار المثبت حالياً: <span className="font-sans font-bold" dir="ltr">{installedVersionLabel}</span> · تحديث آمن دون فقدان البيانات
                </span>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-400" />
          </button>
        )}

        <button
          type="button"
          onClick={role === 'admin' ? () => onNavigate('admin') : onOpenRoleModal}
          className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/70 flex items-center justify-between text-right cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                {role === 'admin' ? 'الانتقال إلى لوحة تحكم المسؤول' : 'صلاحيات المستخدم وبوابة الإدارة'}
              </span>
              <span className="text-[11px] text-slate-500">
                الدور الحالي: {role === 'admin' ? 'مسؤول معتمد' : 'مستخدم عادي'}
              </span>
            </div>
          </div>
          <CheckCircle2 className="w-4 h-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="w-full p-3.5 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-200/80 flex items-center justify-center gap-2 text-red-700 font-bold text-xs sm:text-sm cursor-pointer transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج من الحساب</span>
        </button>
      </div>
    </div>
  );
};
