import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone, Monitor, Apple, CheckCircle2, Share2, MoreVertical, PlusSquare } from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onInstallSuccess: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onInstallSuccess
}) => {
  if (!isOpen) return null;

  const [activeDevice, setActiveDevice] = useState<'android' | 'ios' | 'pc'>('android');
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detect OS
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
      setActiveDevice('ios');
    } else if (/Android/.test(ua)) {
      setActiveDevice('android');
    } else {
      setActiveDevice('pc');
    }

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }
  }, []);

  const handleNativeInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        onInstallSuccess();
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-900 via-red-900 to-slate-900 text-white p-5 rounded-t-3xl border-b border-red-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Download className="w-5 h-5 text-rose-200" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">تنزيل وتثبيت التطبيق على جهازك</h3>
              <p className="text-xs text-slate-300">يعمل بدون إنترنت كأي تطبيق مثبت على الهاتف</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {isInstalled ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h4 className="font-bold text-sm">التطبيق مثبت بالفعل على جهازك!</h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  يمكنك فتحه من الشاشة الرئيسية لهاتفك واستخدامه في أي وقت بدون إنترنت.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Native 1-Click Install Button if supported by browser */}
              {deferredPrompt && (
                <button
                  onClick={handleNativeInstall}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-800 to-red-800 hover:from-rose-900 hover:to-red-900 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>تثبيت التطبيق فوراً بنقرة واحدة 📲</span>
                </button>
              )}

              {/* Device Selector Tabs */}
              <div className="flex items-center justify-between gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
                <button
                  onClick={() => setActiveDevice('android')}
                  className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeDevice === 'android'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>هواتف أندرويد</span>
                </button>
                <button
                  onClick={() => setActiveDevice('ios')}
                  className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeDevice === 'ios'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Apple className="w-3.5 h-3.5 text-slate-800" />
                  <span>آيفون (iPhone)</span>
                </button>
                <button
                  onClick={() => setActiveDevice('pc')}
                  className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeDevice === 'pc'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5 text-sky-600" />
                  <span>الكمبيوتر (PC/Mac)</span>
                </button>
              </div>

              {/* Instructions depending on device */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-3">
                {activeDevice === 'android' && (
                  <>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      طريقة التثبيت على أجهزة أندرويد (متصفح Chrome):
                    </h4>
                    <ol className="space-y-2.5 text-slate-700 pr-4 list-decimal">
                      <li>
                        افتح الرابط في متصفح <strong>Google Chrome</strong> على هاتفك.
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span>اضغط على زر القائمة</span>
                        <span className="p-1 rounded-md bg-white border border-slate-200 inline-flex items-center">
                          <MoreVertical className="w-3.5 h-3.5 text-slate-600" />
                        </span>
                        <span>أعلى يسار المتصفح (النقاط الثلاث).</span>
                      </li>
                      <li>
                        اختر <strong>«إضافة إلى الشاشة الرئيسية»</strong> أو <strong>«تثبيت التطبيق»</strong> (Install App).
                      </li>
                      <li>
                        اضغط على <strong>«تثبيت»</strong> وسيظهر التطبيق فوراً كأيقونة على شاشة هاتفك مثل أي تطبيق من المتجر.
                      </li>
                    </ol>
                  </>
                )}

                {activeDevice === 'ios' && (
                  <>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Apple className="w-4 h-4 text-slate-800" />
                      طريقة التثبيت على أجهزة iPhone و iPad (متصفح Safari):
                    </h4>
                    <ol className="space-y-2.5 text-slate-700 pr-4 list-decimal">
                      <li>
                        افتح الرابط في متصفح <strong>Safari</strong> الأصلي على الآيفون.
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span>اضغط على أيقونة المشاركة</span>
                        <span className="p-1 rounded-md bg-white border border-slate-200 inline-flex items-center">
                          <Share2 className="w-3.5 h-3.5 text-sky-600" />
                        </span>
                        <span>في أسفل الشاشة.</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span>مرر لأسفل واختر</span>
                        <span className="font-bold text-slate-900">«إضافة إلى الصفحة الرئيسية»</span>
                        <span className="p-1 rounded-md bg-white border border-slate-200 inline-flex items-center">
                          <PlusSquare className="w-3.5 h-3.5 text-slate-600" />
                        </span>
                      </li>
                      <li>
                        اضغط على <strong>«إضافة» (Add)</strong> في الزاوية العلوية. سيتم تثبيت أيقونة التطبيق على شاشة جهازك.
                      </li>
                    </ol>
                  </>
                )}

                {activeDevice === 'pc' && (
                  <>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-sky-600" />
                      طريقة التثبيت على أجهزة الكمبيوتر (Windows / Mac):
                    </h4>
                    <ol className="space-y-2.5 text-slate-700 pr-4 list-decimal">
                      <li>
                        افتح الرابط في متصفح <strong>Chrome</strong> أو <strong>Microsoft Edge</strong>.
                      </li>
                      <li>
                        ستظهر أيقونة تثبيت صغيرة (شاشة مع سهم ⊕) في أقصى يمين شريط العنوان (URL bar).
                      </li>
                      <li>
                        انقر عليها ثم اختر <strong>«تثبيت» (Install)</strong> لتشغيله في نافذة مستقلة وخفيفة كبرنامج سطح مكتب.
                      </li>
                    </ol>
                  </>
                )}
              </div>
            </>
          )}

          {/* Advantages of PWA */}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="font-bold text-slate-800 block mb-0.5">⚡ سرعة فائقة:</span>
              يفتح فورياً دون الحاجة لتنزيل تحديثات ثقيلة.
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="font-bold text-slate-800 block mb-0.5">📴 يعمل بدون إنترنت:</span>
              البيانات والسجلات مخزنة على جهازك بأمان.
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
