import React from 'react';
import { X, ShieldCheck, UserCheck, Lock, CheckCircle2 } from 'lucide-react';
import { UserRole } from '../types';
import { storageService, MASTER_ADMIN_EMAIL } from '../services/storageService';

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  onOpenAdminLoginPage?: () => void;
}

export const RoleSwitcherModal: React.FC<RoleSwitcherModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  onSelectRole,
  onOpenAdminLoginPage
}) => {
  if (!isOpen) return null;

  const currentUser = storageService.getCurrentUser();
  const isAdminAuthenticated = currentUser?.role === 'admin';

  const handleAdminClick = () => {
    if (isAdminAuthenticated) {
      onSelectRole('admin');
      onClose();
    } else if (onOpenAdminLoginPage) {
      onClose();
      onOpenAdminLoginPage();
    }
  };

  const switchToUser = () => {
    onSelectRole('user');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 font-['Cairo',sans-serif]">
      <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <ShieldCheck className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">أدوار وصلاحيات النظام</h3>
              <p className="text-[11px] text-slate-500">حالة الصلاحيات النشطة للجلسة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {/* User Role Card */}
          <div
            onClick={switchToUser}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              currentRole === 'user'
                ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">دور: «مستخدم»</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  البحث في السجل، طلب فصيلة دم، وتسجيل متبرع
                </p>
              </div>
            </div>
            {currentRole === 'user' && (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            )}
          </div>

          {/* Admin Role Card */}
          <div
            onClick={handleAdminClick}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              currentRole === 'admin'
                ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-900">دور: «مسؤول النظام»</h4>
                  {!isAdminAuthenticated && (
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] text-slate-500 font-semibold flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" />
                      محمي
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  إدارة السجلات، تصدير Excel، وحذف وتعديل البيانات
                </p>
              </div>
            </div>
            {currentRole === 'admin' && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
            )}
          </div>

          {/* Security Notice / Admin Login Trigger */}
          {!isAdminAuthenticated ? (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 animate-in fade-in">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  صلاحية المسؤول محصورة بالحسابات الرسمية المعتمدة لإدارة السجل المركزي، ومحمية برمز مرور مشفر ومصادقة سحابية عبر Firebase Authentication.
                </p>
              </div>

              {onOpenAdminLoginPage && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAdminLoginPage();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-500/30 shadow-xs active:scale-98"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>تسجيل الدخول كمسؤول معتمد 🛡️</span>
                </button>
              )}
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>أنت مسجل حالياً كمسؤول موثق بحساب {currentUser?.fullName || MASTER_ADMIN_EMAIL}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
