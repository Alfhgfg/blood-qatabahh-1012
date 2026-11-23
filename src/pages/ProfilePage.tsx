import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  User,
  Phone,
  MapPin,
  Droplet,
  ShieldCheck,
  Heart,
  CheckCircle2,
  XCircle,
  Edit3,
  Save,
  X,
  Camera,
  Trash2,
  Calendar,
  UserPlus,
  ClipboardList,
  Settings,
  ArrowRight
} from 'lucide-react';
import { ActivePage, BloodRequest, Donor, UserAccount, UserRole } from '../types';
import { auth } from '../firebase/config';
import { getDonationEligibility, normalizePhoneNumber } from '../services/storageService';

interface ProfilePageProps {
  currentUser: UserAccount;
  donors: Donor[];
  requests: BloodRequest[];
  role: UserRole;
  onUpdateUser: (updated: UserAccount) => Promise<void>;
  onToggleDonorAvailability: (donor: Donor) => Promise<void>;
  onOpenAddDonor: () => void;
  onEditDonor?: (donor: Donor) => void;
  onNavigate: (page: ActivePage) => void;
  onTriggerToast: (msg: string) => void;
  onBack?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  currentUser,
  donors,
  requests,
  role,
  onUpdateUser,
  onToggleDonorAvailability,
  onOpenAddDonor,
  onEditDonor,
  onNavigate,
  onTriggerToast,
  onBack
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(currentUser.fullName || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [isSaving, setIsSaving] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const firebasePhoto = auth?.currentUser?.photoURL || undefined;
  const userPhoto = !imgError ? (currentUser.photoUrl || firebasePhoto) : undefined;

  useEffect(() => {
    setImgError(false);
  }, [currentUser.photoUrl, firebasePhoto]);

  // Match linked donor in Firestore donors list
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

  // Match any blood requests created with user's phone
  const myRequests = useMemo(() => {
    const cleanPhone = normalizePhoneNumber(currentUser.phone || '');
    if (!cleanPhone) return [];
    return requests.filter((r) => normalizePhoneNumber(r.contactPhone) === cleanPhone);
  }, [currentUser.phone, requests]);

  const eligibility = useMemo(() => {
    return linkedDonor ? getDonationEligibility(linkedDonor.lastDonationDate) : null;
  }, [linkedDonor]);

  const initials = (currentUser.fullName || 'م')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    if (cleanName.length < 2) {
      onTriggerToast('يرجى إدخال الاسم الكامل بشكل صحيح ⚠️');
      return;
    }
    try {
      setIsSaving(true);
      await onUpdateUser({
        ...currentUser,
        fullName: cleanName,
        email: email.trim() || undefined
      });
      setIsEditing(false);
      onTriggerToast('تم تحديث بيانات الملف الشخصي وحفظها في السحابة ✅');
    } catch {
      onTriggerToast('تعذر حفظ التعديلات، يرجى المحاولة لاحقاً');
    } finally {
      setIsSaving(false);
    }
  };

  // Compress and save profile photo to UserAccount (stored in Firestore & localStorage)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const size = 160;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.78);
          setImgError(false);
          await onUpdateUser({
            ...currentUser,
            photoUrl: compressedDataUrl
          });
          onTriggerToast('تم تحديث الصورة الشخصية بنجاح 📸');
        } catch {
          onTriggerToast('تعذر معالجة الصورة المختارة');
        }
      };
      img.src = String(ev.target?.result || '');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemovePhoto = async () => {
    try {
      await onUpdateUser({
        ...currentUser,
        photoUrl: ''
      });
      onTriggerToast('تمت إزالة الصورة الشخصية');
    } catch {
      onTriggerToast('تعذر إزالة الصورة');
    }
  };

  return (
    <div className="space-y-5 pb-24 font-['Cairo',sans-serif]">
      {/* Profile Hero Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="bg-gradient-to-bl from-rose-900 via-red-900 to-slate-900 p-5 sm:p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer shrink-0"
                title="الرجوع"
              >
                <ArrowRight className="w-4 h-4 text-amber-300" />
                <span>الرجوع</span>
              </button>
            )}
            <div className="text-xs text-rose-200 font-semibold">الملف الشخصي والحساب</div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Avatar with Upload Overlay */}
              <div className="relative shrink-0">
                {userPhoto ? (
                  <img
                    src={userPhoto}
                    alt={currentUser.fullName}
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="w-20 h-20 rounded-3xl object-cover border-2 border-white/40 shadow-lg bg-slate-800"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-3xl bg-white/15 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-white font-black text-2xl shadow-lg">
                    {initials}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="تغيير الصورة الشخصية"
                  aria-label="تغيير الصورة الشخصية"
                  className="absolute -bottom-1.5 -left-1.5 w-8 h-8 rounded-xl bg-white text-rose-700 hover:bg-rose-50 shadow-md flex items-center justify-center border border-rose-200 cursor-pointer transition-transform active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-black text-white truncate">
                    {currentUser.fullName}
                  </h2>
                  {role === 'admin' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-400/20 text-amber-200 border border-amber-300/30 px-2.5 py-0.5 rounded-lg">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      مسؤول النظام
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-rose-100/90 mt-1">
                  <span className="font-sans" dir="ltr">@{currentUser.username}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-sans" dir="ltr">{currentUser.phone}</span>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-2.5">
                  {currentUser.photoUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-[11px] font-bold text-rose-200 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>إزالة الصورة</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setFullName(currentUser.fullName);
                      setEmail(currentUser.email || '');
                      setIsEditing(!isEditing);
                    }}
                    className="text-xs font-bold bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-xl border border-white/20 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditing ? 'إغلاق التعديل' : 'تعديل بياناتي'}</span>
                  </button>
                </div>
              </div>
            </div>

            {linkedDonor && (
              <div className="self-start sm:self-center flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/15">
                <div className="w-12 h-12 rounded-2xl bg-white text-rose-800 font-sans font-black text-xl flex items-center justify-center shadow-sm">
                  {linkedDonor.bloodType}
                </div>
                <div>
                  <span className="text-[11px] text-rose-200 block">فصيلة الدم المسجلة</span>
                  <span className="text-xs font-bold text-white">
                    {linkedDonor.isAvailable ? 'متاح للتبرع 🟢' : 'غير متاح مؤقتاً'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Edit Account Form */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="p-5 bg-slate-50 border-b border-slate-200 space-y-3.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-rose-700" />
              <span>تحديث بيانات الحساب الشخصي</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-hidden focus:border-rose-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني (اختياري)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-hidden focus:border-rose-600 text-right"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>إلغاء</span>
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Account Metadata Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-100 bg-white text-center">
          <div className="p-3.5">
            <span className="text-[11px] text-slate-400 block">رقم الهاتف</span>
            <span className="text-xs sm:text-sm font-bold text-slate-800 font-sans mt-0.5 block" dir="ltr">
              {currentUser.phone || 'غير محدد'}
            </span>
          </div>
          <div className="p-3.5">
            <span className="text-[11px] text-slate-400 block">تاريخ التسجيل</span>
            <span className="text-xs sm:text-sm font-bold text-slate-800 font-sans mt-0.5 block">
              {currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString('ar-YE') : '—'}
            </span>
          </div>
          <div className="p-3.5">
            <span className="text-[11px] text-slate-400 block">سجلات التبرع</span>
            <span className="text-xs sm:text-sm font-bold text-rose-700 font-sans tabular-nums mt-0.5 block">
              {currentUser.donationHistory?.length || (linkedDonor?.lastDonationDate ? 1 : 0)}
            </span>
          </div>
          <div className="p-3.5">
            <span className="text-[11px] text-slate-400 block">طلبات مرتبطة</span>
            <span className="text-xs sm:text-sm font-bold text-slate-800 font-sans tabular-nums mt-0.5 block">
              {myRequests.length}
            </span>
          </div>
        </div>
      </div>

      {/* Linked Donor Card OR Registration CTA */}
      {linkedDonor ? (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  بطاقة المتبرع المرتبطة بحسابك
                </h3>
                <p className="text-xs text-slate-500">
                  بياناتك النشطة في قاعدة بيانات متبرعي مديرية قعطبة
                </p>
              </div>
            </div>

            {role === 'admin' && onEditDonor && (
              <button
                type="button"
                onClick={() => onEditDonor(linkedDonor)}
                className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>تعديل بطاقة المتبرع</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <MapPin className="w-4 h-4 text-rose-600" />
                <span>الموقع الجغرافي</span>
              </div>
              <p className="text-sm font-bold text-slate-900">{linkedDonor.district}</p>
              <p className="text-xs text-slate-500">القرية / الحي: {linkedDonor.area}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                  <Droplet className="w-4 h-4 text-rose-600" />
                  <span>حالة الجاهزية للتبرع</span>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-bold ${
                    linkedDonor.isAvailable ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {linkedDonor.isAvailable ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>متاح لتلبية النداءات</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>في فترة راحة مؤقتة</span>
                    </>
                  )}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onToggleDonorAvailability(linkedDonor)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  linkedDonor.isAvailable
                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {linkedDonor.isAvailable ? 'تعطيل مؤقت' : 'تفعيل التوفر'}
              </button>
            </div>
          </div>

          {eligibility && (
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                eligibility.isEligible
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50/70 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4.5 h-4.5 shrink-0" />
                <div>
                  <span className="font-bold block">
                    آخر تبرع مسجل: {linkedDonor.lastDonationDate || 'لم يسجل تبرع سابق'}
                  </span>
                  <span className="opacity-90">{eligibility.message}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('history')}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-bold text-slate-800 hover:bg-slate-50 shrink-0 cursor-pointer"
              >
                سجل التبرعات
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 border border-rose-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                أنت غير مسجل في قائمة المتبرعين بالدم بعد
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                سجّل بياناتك وفصيلة دمك الآن لتظهر ضمن سجل قعطبة وتصل إليك نداءات إنقاذ الحالات الحرجة.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenAddDonor}
            className="px-4 py-2.5 rounded-2xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>تسجيل كمتبرع الآن</span>
          </button>
        </div>
      )}

      {/* Quick Profile Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onNavigate('history')}
          className="bg-white hover:bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center gap-3 text-right transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">سجل التبرعات والأهلية</h4>
            <p className="text-xs text-slate-500">عرض ومتابعة سجل تبرعاتك والحالات المنقذة</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="bg-white hover:bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center gap-3 text-right transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">إعدادات الحساب والتنبيهات</h4>
            <p className="text-xs text-slate-500">تخصيص إشعارات الفصيلة والمنطقة والمزامنة</p>
          </div>
        </button>
      </div>
    </div>
  );
};
