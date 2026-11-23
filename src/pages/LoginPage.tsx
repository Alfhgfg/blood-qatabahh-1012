import React, { useState } from 'react';
import { 
  Lock, 
  User, 
  Phone, 
  KeyRound, 
  ShieldCheck, 
  Droplet, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  HelpCircle,
  HeartHandshake
} from 'lucide-react';
import { UserAccount } from '../types';
import { storageService } from '../services/storageService';
import { useRegisterBackHandler } from '../services/backHandlerRegistry';

interface LoginPageProps {
  onLoginSuccess: (user: UserAccount) => void;
  onGoToAdminLogin?: () => void;
}

type AuthMode = 'login' | 'register' | 'forgot';

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onGoToAdminLogin }) => {
  const [mode, setMode] = useState<AuthMode>('login');

  useRegisterBackHandler(
    'login-auth-mode',
    mode !== 'login',
    () => {
      setMode('login');
      setError('');
      setSuccess('');
    },
    20
  );

  // Login Form State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register Form State
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Forgot Password / Recovery State
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Status & Feedback State
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickTips, setShowQuickTips] = useState(false);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!loginUsername.trim()) {
      setError('يرجى إدخال اسم المستخدم أو رقم الهاتف');
      return;
    }
    if (!loginPassword.trim()) {
      setError('يرجى إدخال كلمة المرور');
      return;
    }

    try {
      setIsLoading(true);
      const res = await storageService.login(loginUsername.trim(), loginPassword.trim());
      setIsLoading(false);

      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setError(res.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'حدث خطأ أثناء تسجيل الدخول');
    }
  };

  // Handle Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!regFullName.trim() || regFullName.trim().split(/\s+/).length < 2) {
      setError('يرجى إدخال الاسم كاملاً (الاسم الثنائي أو الثلاثي على الأقل)');
      return;
    }
    if (!regUsername.trim()) {
      setError('يرجى اختيار اسم مستخدم');
      return;
    }
    if (!regPhone.trim()) {
      setError('يرجى إدخال رقم الهاتف للتواصل');
      return;
    }
    if (regPassword.length < 4) {
      setError('يجب ألا تقل كلمة المرور عن 4 خانات');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('كلمة المرور وتأكيدها غير متطابقين');
      return;
    }

    try {
      setIsLoading(true);
      const res = await storageService.register({
        fullName: regFullName.trim(),
        username: regUsername.trim().toLowerCase(),
        phone: regPhone.trim(),
        password: regPassword
      });
      setIsLoading(false);

      if (res.success && res.user) {
        setSuccess('تم إنشاء حسابك بنجاح! يتم نقلك إلى السجل الآن...');
        setTimeout(() => {
          onLoginSuccess(res.user!);
        }, 1000);
      } else {
        setError(res.error || 'تعذر إنشاء الحساب');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'حدث خطأ أثناء إنشاء الحساب');
    }
  };

  // Mode handlers

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 font-['Cairo',sans-serif] relative overflow-hidden">
      {/* Background Graphic Ambient Lighting */}
      <div 
        className="pointer-events-none absolute -top-40 -right-40 w-96 h-96 rounded-full bg-rose-600/15 blur-3xl"
        aria-hidden="true"
      />
      <div 
        className="pointer-events-none absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-red-900/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md bg-white text-slate-800 rounded-3xl shadow-2xl border border-slate-100/20 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Top Visual Header */}
        <div className="bg-gradient-to-br from-rose-950 via-slate-900 to-rose-900 p-6 text-white text-center relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-600 to-red-700 text-white flex items-center justify-center shadow-lg shadow-rose-950/40 mb-3 border border-rose-500/30">
              <Droplet className="w-8 h-8 fill-white text-white animate-pulse" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              سجل المتبرعين بالدم
            </h1>
            <p className="text-xs text-rose-200 mt-1 font-semibold">
              مديرية قعطبة – محافظة الضالع
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-bold text-rose-100 border border-white/15">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>نظام مركزي مؤمن لحفظ الأرواح</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs between Login & Register */}
        <div className="grid grid-cols-2 bg-slate-100 border-b border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              setSuccess('');
            }}
            className={`py-3 text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-white text-rose-700 border-b-2 border-rose-600 font-extrabold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>تسجيل الدخول</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
              setSuccess('');
            }}
            className={`py-3 text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'register'
                ? 'bg-white text-rose-700 border-b-2 border-rose-600 font-extrabold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>إنشاء حساب جديد</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-semibold">{error}</div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-semibold">{success}</div>
            </div>
          )}

          {/* MODE 1: LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم المستخدم أو رقم الهاتف
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => {
                      setLoginUsername(e.target.value);
                      setError('');
                    }}
                    placeholder="مثال: admin أو 771234567"
                    className="w-full px-3.5 py-2.5 pl-10 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:border-rose-600 focus:ring-2 focus:ring-rose-600/10 transition-all bg-slate-50/50"
                    required
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    كلمة المرور
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setSuccess('');
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="أدخل كلمة المرور الخاصة بك"
                    className="w-full px-3.5 py-2.5 pl-10 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:border-rose-600 focus:ring-2 focus:ring-rose-600/10 transition-all bg-slate-50/50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-700 to-red-800 hover:from-rose-800 hover:to-red-900 text-white font-black text-sm shadow-md shadow-rose-900/20 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>{isLoading ? 'جاري التحقق والدخول...' : 'تسجيل الدخول إلى السجل'}</span>
              </button>

              {onGoToAdminLogin && (
                <button
                  type="button"
                  onClick={onGoToAdminLogin}
                  className="w-full py-2.5 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border border-amber-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>بوابة دخول المشرفين والمسؤولين (لوحة الإدارة) 🛡️</span>
                </button>
              )}

              {/* Security and Help Guidance */}
              <div className="pt-2 text-center">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs space-y-1">
                  <p className="text-[11px] text-slate-600 font-semibold">
                    سجل الدخول باستخدام بيانات حسابك المسجل، أو اضغط على «إنشاء حساب جديد» للإنضمام إلى سجل المتبرعين.
                  </p>
                  <p className="text-[10px] text-slate-400">
                    لحماية بيانات المتبرعين، الوصول لصلاحيات الإدارة مخصص للمسؤولين المعتمدين فقط.
                  </p>
                </div>
              </div>
            </form>
          )}

          {/* MODE 2: REGISTER */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الاسم الرباعي أو الكامل <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={regFullName}
                  onChange={(e) => {
                    setRegFullName(e.target.value);
                    setError('');
                  }}
                  placeholder="مثال: صالح محمد علي الشعيبي"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:border-rose-600 bg-slate-50/50"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم المستخدم <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => {
                      setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ''));
                      setError('');
                    }}
                    placeholder="مثال: saleh2026"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:border-rose-600 bg-slate-50/50"
                    dir="ltr"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رقم الهاتف <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => {
                      setRegPhone(e.target.value);
                      setError('');
                    }}
                    placeholder="77xxxxxxx"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:border-rose-600 bg-slate-50/50 text-right"
                    dir="ltr"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    كلمة المرور <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => {
                        setRegPassword(e.target.value);
                        setError('');
                      }}
                      placeholder="4 خانات على الأقل"
                      className="w-full px-3 py-2 pl-9 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:border-rose-600 bg-slate-50/50"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تأكيد كلمة المرور <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={(e) => {
                      setRegConfirmPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="أعد كتابتها للتأكيد"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:border-rose-600 bg-slate-50/50"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm shadow-md shadow-emerald-900/20 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isLoading ? 'جاري التسجيل...' : 'تسجيل الحساب والدخول'}</span>
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className="text-xs text-slate-500 hover:text-rose-700 font-bold"
                >
                  لديك حساب مسجل بالفعل؟ <span className="text-rose-600 underline">تسجيل الدخول هنا</span>
                </button>
              </div>
            </form>
          )}

          {/* MODE 3: FORGOT / RECOVER */}
          {mode === 'forgot' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-900 text-xs space-y-2">
                <span className="font-bold flex items-center gap-1.5 text-amber-800">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  استعادة وتعيين كلمة مرور المسؤول:
                </span>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  لحماية بيانات السجل والمتبرعين، ترتبط صلاحيات الإدارة حصرياً بالبريد المعتمد للمديرية وتتم استعادة كلمة المرور عبر رابط رسمي مشفر من <strong>Firebase Authentication</strong>.
                </p>
                {onGoToAdminLogin && (
                  <button
                    type="button"
                    onClick={onGoToAdminLogin}
                    className="w-full mt-2 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs cursor-pointer flex items-center justify-center gap-2 border border-amber-500/20 shadow-xs"
                  >
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>الانتقال لبوابة المسؤول لطلب رابط الاستعادة ✉️</span>
                  </button>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-slate-700 text-xs space-y-1.5">
                <span className="font-bold flex items-center gap-1.5 text-slate-800">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  حسابات المستخدمين والمتبرعين:
                </span>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  إذا نسيت كلمة مرور حسابك كمستخدم أو متبرع، يرجى التواصل مع مشرف السجل المركزي على هاتف الطوارئ (771234567) لتأكيد رقم هاتفك واستعادة حسابك فوراً.
                </p>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                >
                  العودة إلى <span className="text-rose-600 underline">صفحة تسجيل الدخول</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="bg-slate-50 p-3.5 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-500 font-semibold">
            © جميع الحقوق محفوظة للنسر وايب 2027.
          </p>
        </div>
      </div>
    </div>
  );
};
