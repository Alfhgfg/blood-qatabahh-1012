import React, { useState, useEffect } from 'react';
import { 
  X, 
  Bell, 
  Droplet, 
  UserCheck, 
  CheckCheck, 
  Trash2, 
  ArrowLeft, 
  Settings, 
  ShieldCheck, 
  Smartphone, 
  Volume2, 
  Vibrate, 
  MapPin, 
  Sparkles,
  Send,
  AlertTriangle,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { AppNotification, ActivePage, BloodType, District } from '../types';
import { pushNotificationService, PushNotificationPreferences } from '../services/pushNotificationService';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  districts?: District[];
  userBloodType?: BloodType;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onNavigateToItem: (page: ActivePage, itemId?: string) => void;
  onTriggerToast?: (message: string) => void;
}

const BLOOD_TYPES: BloodType[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  districts = [],
  userBloodType,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onNavigateToItem,
  onTriggerToast
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'settings'>('list');
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [pushPrefs, setPushPrefs] = useState<PushNotificationPreferences>(() => pushNotificationService.getPreferences());
  const [testSending, setTestSending] = useState(false);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      pushNotificationService.getPermission().then((p) => {
        setPermission(p);
      }).catch(() => {
        setPermission('default');
      });
      const current = pushNotificationService.getPreferences();
      // If user has a linked donor blood type and preference is still default 'all', suggest their blood type
      if (userBloodType && current.bloodType === 'all') {
        current.bloodType = userBloodType;
      }
      setPushPrefs(current);
    }
  }, [isOpen, userBloodType]);

  if (!isOpen) return null;

  const isNative = pushNotificationService.isNative();
  const isSupported = pushNotificationService.isSupported();

  const handleRequestPermission = async () => {
    try {
      const res = await pushNotificationService.requestPermission();
      const updatedPerm = await pushNotificationService.getPermission();
      setPermission(updatedPerm);
      setPushPrefs(pushNotificationService.getPreferences());
      if (onTriggerToast) {
        onTriggerToast(res.message || (res.success ? 'تم تفعيل الإشعارات بنجاح' : 'تعذر تفعيل الإشعارات'));
      }
    } catch (err: any) {
      console.warn('handleRequestPermission notice:', err);
      if (onTriggerToast) {
        onTriggerToast('حدث خطأ غير متوقع أثناء تفعيل الإشعارات');
      }
    }
  };

  const handleTogglePush = (enabled: boolean) => {
    const updated = pushNotificationService.savePreferences({ enabled });
    setPushPrefs(updated);
    if (enabled && permission !== 'granted') {
      handleRequestPermission();
    } else if (onTriggerToast) {
      onTriggerToast(enabled ? 'تم تفعيل التنبيهات الخارجية الفورية ✅' : 'تم تعطيل التنبيهات الخارجية 🔕');
    }
  };

  const handleUpdateBloodFilter = (bloodType: BloodType | 'all') => {
    const updated = pushNotificationService.savePreferences({ bloodType });
    setPushPrefs(updated);
  };

  const handleUpdateDistrictFilter = (district: string | 'all') => {
    const updated = pushNotificationService.savePreferences({ district });
    setPushPrefs(updated);
  };

  const handleToggleCriticalOnly = (criticalOnly: boolean) => {
    const updated = pushNotificationService.savePreferences({ criticalOnly });
    setPushPrefs(updated);
  };

  const handleToggleVibrate = (vibrate: boolean) => {
    const updated = pushNotificationService.savePreferences({ vibrate });
    setPushPrefs(updated);
  };

  const handleToggleSound = (sound: boolean) => {
    const updated = pushNotificationService.savePreferences({ sound });
    setPushPrefs(updated);
  };

  const handleSendTestNotification = async (delaySeconds = 0) => {
    setTestSending(true);
    setTestFeedback(null);
    try {
      const selectedType = pushPrefs.bloodType !== 'all' ? pushPrefs.bloodType : 'O-';
      const selectedDist = pushPrefs.district !== 'all' ? pushPrefs.district : 'مديرية قعطبة - المركز';
      const result = await pushNotificationService.sendTestNotification(delaySeconds, selectedType, selectedDist);
      setTestFeedback(result.message);
      if (onTriggerToast) {
        onTriggerToast(result.message);
      }
    } catch (err: any) {
      setTestFeedback(err?.message || 'تعذر إرسال الإشعار التجريبي');
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[88vh] overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="bg-white px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">مركز التنبيهات والإشعارات</h3>
              <p className="text-[11px] text-slate-500">إشعارات طلبات الدم الفورية والتنبيهات الخارجية</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1.5 bg-slate-100 border-b border-slate-200/60 gap-1.5 text-xs font-bold">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'list'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>الإشعارات الواردة</span>
            {notifications.filter((n) => !n.read).length > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
                {notifications.filter((n) => !n.read).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>إعدادات الإشعارات الخارجية (Push)</span>
            {permission === 'granted' && pushPrefs.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* TAB 1: Notifications List */}
        {activeTab === 'list' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Action bar */}
            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">
                {notifications.filter((n) => !n.read).length} غير مقروء
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={onMarkAllAsRead}
                  className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  تحديد الكل كمقروء
                </button>
                <button
                  onClick={onClearAll}
                  className="text-slate-400 hover:text-red-600 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  مسح
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-slate-100">
              {notifications.length > 0 ? (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onMarkAsRead(item.id);
                      if (item.linkPage) {
                        onClose();
                        onNavigateToItem(item.linkPage as ActivePage, item.itemId);
                      }
                    }}
                    className={`pt-2.5 first:pt-0 pb-1 cursor-pointer rounded-2xl p-3 transition-all border ${
                      item.read
                        ? 'bg-transparent border-transparent opacity-85 hover:bg-slate-50'
                        : 'bg-rose-50/60 border-rose-100 hover:bg-rose-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          item.type === 'urgent'
                            ? 'bg-red-100 text-red-600'
                            : item.type === 'donor'
                              ? 'bg-rose-100 text-rose-600'
                              : 'bg-emerald-100 text-emerald-600'
                        }`}
                      >
                        {item.type === 'urgent' ? (
                          <Droplet className="w-4 h-4 fill-red-600" />
                        ) : item.type === 'donor' ? (
                          <UserCheck className="w-4 h-4" />
                        ) : (
                          <Bell className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{item.title}</h4>
                          <span className="text-[10px] text-slate-400 shrink-0">{item.time}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-normal">{item.message}</p>
                        
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100">
                          <span className="text-[10px] text-slate-400">
                            {item.linkPage === 'requests' ? 'طلب دم بمديرية قعطبة' : 'تحديث النظام'}
                          </span>
                          <div className="flex items-center text-[11px] font-bold text-rose-600 hover:text-rose-800">
                            <span>عرض التفاصيل والاستجابة للطلب</span>
                            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-14 text-center text-slate-400">
                  <Bell className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
                  <p className="text-xs font-semibold">لا توجد إشعارات جديدة حالياً</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    ستصلك تنبيهات فورية فور نشر طلبات دم جديدة متوافقة مع فصيلتك وموقعك
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Push Notifications Settings & Test */}
        {activeTab === 'settings' && (
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {/* Permission Status Banner */}
            <div className={`p-4 rounded-2xl border ${
              permission === 'granted' && pushPrefs.enabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : permission === 'denied'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : permission === 'unsupported'
                    ? 'bg-slate-50 border-slate-200 text-slate-800'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-xs">
                  {permission === 'granted' && pushPrefs.enabled ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  ) : permission === 'denied' ? (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  ) : permission === 'unsupported' ? (
                    <ShieldCheck className="w-5 h-5 text-slate-500" />
                  ) : (
                    <Smartphone className="w-5 h-5 text-amber-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold">
                      {permission === 'granted' && pushPrefs.enabled
                        ? isNative ? 'إشعارات تطبيق أندرويد مفعلة وتعمل 🟢' : 'إشعارات الويب الفورية مفعلة وتعمل 🟢'
                        : permission === 'denied'
                          ? 'الإشعارات محظورة في هذا الجهاز 🔴'
                          : permission === 'unsupported'
                            ? 'الإشعارات تعمل داخل التطبيق ℹ️'
                            : isNative ? 'تفعيل إشعارات تطبيق أندرويد (APK) 🔔' : 'تفعيل إشعارات الويب الفورية 🔔'}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white shadow-2xs">
                      {permission === 'granted' ? 'مفعل' : permission === 'denied' ? 'محظور' : permission === 'unsupported' ? 'داخل التطبيق' : 'غير مفعل'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                    <span>بيئة التشغيل:</span>
                    <span className="font-semibold px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                      {isNative ? 'تطبيق Android APK الأصلي' : 'متصفح الويب (Service Worker & FCM)'}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed mt-1 opacity-90">
                    {permission === 'granted' && pushPrefs.enabled
                      ? 'تصلك التنبيهات الفورية على شاشة الهاتف حتى عند إغلاق التطبيق فور تسجيل أي طلب دم عاجل متوافق مع فصيلتك وموقعك.'
                      : permission === 'denied'
                        ? isNative ? 'يرجى السماح بالإشعارات من إعدادات الهاتف (إدارة التطبيقات) لتلقي التنبيهات الخارجية.' : 'يرجى السماح بالإشعارات من إعدادات المتصفح لتتمكن من تلقي التنبيهات الخارجية.'
                        : permission === 'unsupported'
                          ? 'المتصفح الحالي لا يدعم ميزة إشعارات الخلفية المستقلة، ولكن ستصلك كافة نداءات التبرع داخل التطبيق بشكل طبيعي فور فتح الموقع.'
                          : 'اضغط على زر التفعيل لتلقي تنبيهات خارجية فورية على هاتفك عند حاجة مريض لدم متوافق في قعطبة.'}
                  </p>

                  {permission !== 'granted' && isSupported && (
                    <button
                      onClick={handleRequestPermission}
                      className="mt-2.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>السماح بالتنبيهات الخارجية الآن</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Master Toggle */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  تشغيل الإشعارات الخارجية الفورية (Push)
                </span>
                <span className="text-[11px] text-slate-500 block">
                  استقبال تنبيهات النظام حتى في حال إغلاق التطبيق أو قفل الشاشة
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={pushPrefs.enabled && permission === 'granted'}
                  onChange={(e) => handleTogglePush(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>

            {/* Targeting Filter 1: Blood Type Filter */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Droplet className="w-4 h-4 text-rose-600" />
                  <span className="text-xs font-bold text-slate-800">
                    تصفية الإشعارات بحسب فصيلة الدم
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {pushPrefs.bloodType === 'all' ? 'جميع الفصائل' : `فصيلة (${pushPrefs.bloodType}) والمتوافقة`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                عند تحديد فصيلة دم معينة، ستصلك تنبيهات فقط بالحالات التي تتوافق طبياً مع فصيلتك للتبرع لها.
              </p>

              <div className="grid grid-cols-5 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleUpdateBloodFilter('all')}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    pushPrefs.bloodType === 'all'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  الكل 🌐
                </button>
                {BLOOD_TYPES.map((bt) => (
                  <button
                    key={bt}
                    type="button"
                    onClick={() => handleUpdateBloodFilter(bt)}
                    className={`py-1.5 px-1.5 rounded-xl text-xs font-bold font-sans transition-all border cursor-pointer ${
                      pushPrefs.bloodType === bt
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {bt}
                  </button>
                ))}
              </div>
            </div>

            {/* Targeting Filter 2: Geographic District Filter */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-600" />
                  <span className="text-xs font-bold text-slate-800">
                    تصفية الإشعارات بحسب النطاق الجغرافي
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 truncate max-w-[150px]">
                  {pushPrefs.district === 'all' ? 'جميع المناطق' : pushPrefs.district}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                إشعارك فقط بطلبات الدم في مستشفيات ومراكز منطقتك الجغرافية لسرعة الوصول والاستجابة.
              </p>

              <select
                value={pushPrefs.district}
                onChange={(e) => handleUpdateDistrictFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer"
              >
                <option value="all">كل المديريات والمناطق بقعطبة وما حولها 📍</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Targeting Filter 3: Critical Urgency Only */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    الحالات الحرجة والطارئة فقط 🚨
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    تنبيهك فقط بالعمليات الجراحية العاجلة وحالات النزيف الحاد
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={pushPrefs.criticalOnly}
                  onChange={(e) => handleToggleCriticalOnly(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>

            {/* Sound & Vibrate Options */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Vibrate className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-bold text-slate-700">الاهتزاز</span>
                </div>
                <input
                  type="checkbox"
                  checked={pushPrefs.vibrate}
                  onChange={(e) => handleToggleVibrate(e.target.checked)}
                  className="w-4 h-4 accent-rose-600 cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-bold text-slate-700">صوت التنبيه</span>
                </div>
                <input
                  type="checkbox"
                  checked={pushPrefs.sound}
                  onChange={(e) => handleToggleSound(e.target.checked)}
                  className="w-4 h-4 accent-rose-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Push Testing Tools Section */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200/70 space-y-2.5">
              <div className="flex items-center gap-2 text-rose-800">
                <Sparkles className="w-4 h-4" />
                <h4 className="text-xs font-bold">اختبار التنبيهات الخارجية على هاتفك</h4>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">
                جرب وصول إشعار خارجي إلى شريط إشعارات الهاتف وقفل الشاشة للتأكد من جاهزية التنبيهات.
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={testSending}
                  onClick={() => handleSendTestNotification(0)}
                  className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-rose-700 font-bold text-xs border border-rose-200 shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إشعار فوري الآن 🔔</span>
                </button>

                <button
                  type="button"
                  disabled={testSending}
                  onClick={() => handleSendTestNotification(5)}
                  className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>تجربة بعد 5 ثوانٍ ⏱️</span>
                </button>
              </div>

              {testFeedback && (
                <div className="p-2.5 rounded-xl bg-white border border-rose-200 text-xs text-rose-900 font-semibold flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{testFeedback}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
