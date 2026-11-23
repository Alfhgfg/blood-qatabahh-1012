import React, { useMemo, useRef, useState } from 'react';
import {
  Hospital as HospitalIcon,
  Stethoscope,
  Upload,
  Plus,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  X,
  Image as ImageIcon,
  Save,
  Loader2,
  Phone,
  MapPin,
  Search,
  UserRound
} from 'lucide-react';
import { Doctor, Hospital } from '../types';
import { storageService } from '../services/storageService';
import {
  formatImageBytes,
  optimizeDoctorPortraitImage,
  optimizeHospitalCardImage,
  sortDoctors,
  sortHospitals
} from '../utils/hospitalDirectoryUtils';

interface AdminHospitalsDoctorsTabProps {
  hospitals: Hospital[];
  doctors: Doctor[];
  onHospitalsChange: (hospitals: Hospital[]) => void;
  onDoctorsChange: (doctors: Doctor[]) => void;
  onRefreshAuditLogs?: () => void;
}

export const AdminHospitalsDoctorsTab: React.FC<AdminHospitalsDoctorsTabProps> = ({
  hospitals,
  doctors,
  onHospitalsChange,
  onDoctorsChange,
  onRefreshAuditLogs
}) => {
  const [subTab, setSubTab] = useState<'hospitals' | 'doctors'>('hospitals');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Hospital Form State
  const hospitalFormRef = useRef<HTMLDivElement | null>(null);
  const hospitalFileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [hospName, setHospName] = useState('');
  const [hospImageUrl, setHospImageUrl] = useState('');
  const [useExternalHospUrl, setUseExternalHospUrl] = useState(false);
  const [hospAddress, setHospAddress] = useState('');
  const [hospPhone, setHospPhone] = useState('');
  const [hospDescription, setHospDescription] = useState('');
  const [hospDisplayOrder, setHospDisplayOrder] = useState<number>(() => hospitals.length + 1);
  const [isOptimizingHospImg, setIsOptimizingHospImg] = useState(false);
  const [hospImgSizeInfo, setHospImgSizeInfo] = useState<string | null>(null);
  const [isSavingHosp, setIsSavingHosp] = useState(false);
  const [busyHospitalId, setBusyHospitalId] = useState<string | null>(null);
  const [confirmDeleteHospitalId, setConfirmDeleteHospitalId] = useState<string | null>(null);

  // Doctor Form State
  const doctorFormRef = useRef<HTMLDivElement | null>(null);
  const doctorFileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [docHospitalId, setDocHospitalId] = useState<string>(() => hospitals[0]?.id || '');
  const [docFullName, setDocFullName] = useState('');
  const [docSpecialty, setDocSpecialty] = useState('');
  const [docImageUrl, setDocImageUrl] = useState('');
  const [useExternalDocUrl, setUseExternalDocUrl] = useState(false);
  const [docBio, setDocBio] = useState('');
  const [docPhone, setDocPhone] = useState('');
  const [docDisplayOrder, setDocDisplayOrder] = useState<number>(1);
  const [isOptimizingDocImg, setIsOptimizingDocImg] = useState(false);
  const [docImgSizeInfo, setDocImgSizeInfo] = useState<string | null>(null);
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [busyDoctorId, setBusyDoctorId] = useState<string | null>(null);
  const [confirmDeleteDoctorId, setConfirmDeleteDoctorId] = useState<string | null>(null);

  // Doctor Filter State
  const [filterHospitalId, setFilterHospitalId] = useState<string>('all');
  const [doctorSearchTerm, setDoctorSearchTerm] = useState('');

  const sortedHospitals = useMemo(() => sortHospitals(hospitals), [hospitals]);
  const sortedDoctors = useMemo(() => sortDoctors(doctors), [doctors]);

  const hospitalMap = useMemo(() => {
    const map = new Map<string, Hospital>();
    for (const h of sortedHospitals) {
      map.set(h.id, h);
    }
    return map;
  }, [sortedHospitals]);

  const doctorCountByHospital = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of sortedDoctors) {
      map[d.hospitalId] = (map[d.hospitalId] || 0) + 1;
    }
    return map;
  }, [sortedDoctors]);

  const filteredDoctorsList = useMemo(() => {
    const q = doctorSearchTerm.trim().toLowerCase();
    return sortedDoctors.filter((doc) => {
      if (filterHospitalId !== 'all' && doc.hospitalId !== filterHospitalId) {
        return false;
      }
      if (!q) return true;
      const hospNameMatch = hospitalMap.get(doc.hospitalId)?.name.toLowerCase().includes(q);
      return (
        doc.fullName.toLowerCase().includes(q) ||
        doc.specialty.toLowerCase().includes(q) ||
        Boolean(hospNameMatch)
      );
    });
  }, [sortedDoctors, filterHospitalId, doctorSearchTerm, hospitalMap]);

  // Hospital Handlers
  const resetHospitalForm = (nextOrder?: number) => {
    setEditingHospital(null);
    setHospName('');
    setHospImageUrl('');
    setUseExternalHospUrl(false);
    setHospAddress('');
    setHospPhone('');
    setHospDescription('');
    setHospDisplayOrder(nextOrder ?? hospitals.length + 1);
    setHospImgSizeInfo(null);
    if (hospitalFileInputRef.current) {
      hospitalFileInputRef.current.value = '';
    }
  };

  const handleStartEditHospital = (hosp: Hospital) => {
    setSubTab('hospitals');
    setEditingHospital(hosp);
    setHospName(hosp.name);
    setHospImageUrl(hosp.imageUrl);
    setUseExternalHospUrl(/^https?:\/\//i.test(hosp.imageUrl));
    setHospAddress(hosp.address || '');
    setHospPhone(hosp.phone || '');
    setHospDescription(hosp.description || '');
    setHospDisplayOrder(hosp.displayOrder || 1);
    setHospImgSizeInfo(null);
    setFeedback(null);
    setTimeout(() => {
      hospitalFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleHospitalImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOptimizingHospImg(true);
    setFeedback(null);
    try {
      const result = await optimizeHospitalCardImage(file);
      setHospImageUrl(result.dataUrl);
      setHospImgSizeInfo(
        `تم ضغط الصورة تلقائياً: ${formatImageBytes(result.optimizedBytes)} (بدلاً من ${formatImageBytes(result.originalBytes)}) · ${result.width}×${result.height}`
      );
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'تعذر معالجة صورة المستشفى' });
    } finally {
      setIsOptimizingHospImg(false);
    }
  };

  const handleSubmitHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSavingHosp(true);
    try {
      const saved = await storageService.saveHospital(
        {
          name: hospName,
          imageUrl: hospImageUrl,
          address: hospAddress,
          phone: hospPhone,
          description: hospDescription,
          displayOrder: hospDisplayOrder
        },
        editingHospital
      );

      const refreshed = await storageService.getHospitals();
      onHospitalsChange(refreshed);
      onRefreshAuditLogs?.();

      if (!docHospitalId) {
        setDocHospitalId(saved.id);
      }

      setFeedback({
        type: 'success',
        text: editingHospital
          ? `تم تحديث بيانات مستشفى "${saved.name}" بنجاح`
          : `تمت إضافة مستشفى "${saved.name}" ونشره لجميع المستخدمين بنجاح`
      });
      resetHospitalForm(refreshed.length + 1);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'حدث خطأ أثناء حفظ بيانات المستشفى' });
    } finally {
      setIsSavingHosp(false);
    }
  };

  const handleMoveHospital = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedHospitals.length) return;
    const nextList = [...sortedHospitals];
    const [moved] = nextList.splice(index, 1);
    nextList.splice(targetIndex, 0, moved);

    setBusyHospitalId(moved.id);
    setFeedback(null);
    try {
      const reordered = await storageService.reorderHospitals(nextList);
      onHospitalsChange(reordered);
      setFeedback({ type: 'success', text: 'تم تحديث ترتيب ظهور المستشفيات بنجاح' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'تعذر تحديث الترتيب' });
    } finally {
      setBusyHospitalId(null);
    }
  };

  const handleDeleteHospital = async (hosp: Hospital) => {
    setBusyHospitalId(hosp.id);
    setFeedback(null);
    try {
      await storageService.deleteHospital(hosp.id, hosp.name);
      const [refreshedHospitals, refreshedDoctors] = await Promise.all([
        storageService.getHospitals(),
        storageService.getDoctors()
      ]);
      onHospitalsChange(refreshedHospitals);
      onDoctorsChange(refreshedDoctors);
      onRefreshAuditLogs?.();
      setConfirmDeleteHospitalId(null);
      if (editingHospital?.id === hosp.id) {
        resetHospitalForm(refreshedHospitals.length + 1);
      }
      if (docHospitalId === hosp.id) {
        setDocHospitalId(refreshedHospitals[0]?.id || '');
      }
      if (filterHospitalId === hosp.id) {
        setFilterHospitalId('all');
      }
      setFeedback({ type: 'success', text: `تم حذف مستشفى "${hosp.name}" والأطباء المرتبطين به بنجاح` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'تعذر حذف المستشفى' });
    } finally {
      setBusyHospitalId(null);
    }
  };

  const handleManageHospitalDoctors = (hospitalId: string) => {
    setSubTab('doctors');
    setDocHospitalId(hospitalId);
    setFilterHospitalId(hospitalId);
    setEditingDoctor(null);
    setDocDisplayOrder((doctorCountByHospital[hospitalId] || 0) + 1);
    setTimeout(() => {
      doctorFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Doctor Handlers
  const resetDoctorForm = (keepHospitalId?: string) => {
    const nextHospId = keepHospitalId || docHospitalId || sortedHospitals[0]?.id || '';
    setEditingDoctor(null);
    setDocHospitalId(nextHospId);
    setDocFullName('');
    setDocSpecialty('');
    setDocImageUrl('');
    setUseExternalDocUrl(false);
    setDocBio('');
    setDocPhone('');
    setDocDisplayOrder((doctorCountByHospital[nextHospId] || 0) + 1);
    setDocImgSizeInfo(null);
    if (doctorFileInputRef.current) {
      doctorFileInputRef.current.value = '';
    }
  };

  const handleStartEditDoctor = (doc: Doctor) => {
    setSubTab('doctors');
    setEditingDoctor(doc);
    setDocHospitalId(doc.hospitalId);
    setDocFullName(doc.fullName);
    setDocSpecialty(doc.specialty);
    setDocImageUrl(doc.imageUrl);
    setUseExternalDocUrl(/^https?:\/\//i.test(doc.imageUrl));
    setDocBio(doc.bio || '');
    setDocPhone(doc.phone || '');
    setDocDisplayOrder(doc.displayOrder || 1);
    setDocImgSizeInfo(null);
    setFeedback(null);
    setTimeout(() => {
      doctorFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleDoctorImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOptimizingDocImg(true);
    setFeedback(null);
    try {
      const result = await optimizeDoctorPortraitImage(file);
      setDocImageUrl(result.dataUrl);
      setDocImgSizeInfo(
        `تم ضغط الصورة تلقائياً: ${formatImageBytes(result.optimizedBytes)} (بدلاً من ${formatImageBytes(result.originalBytes)}) · ${result.width}×${result.height}`
      );
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'تعذر معالجة صورة الطبيب' });
    } finally {
      setIsOptimizingDocImg(false);
    }
  };

  const handleSubmitDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const chosenHospitalId = docHospitalId || sortedHospitals[0]?.id || '';
    if (!chosenHospitalId) {
      setFeedback({ type: 'error', text: 'يرجى إضافة مستشفى أولاً قبل إضافة الأطباء.' });
      return;
    }

    setIsSavingDoc(true);
    try {
      const saved = await storageService.saveDoctor(
        {
          hospitalId: chosenHospitalId,
          fullName: docFullName,
          specialty: docSpecialty,
          imageUrl: docImageUrl,
          bio: docBio,
          phone: docPhone,
          displayOrder: docDisplayOrder
        },
        editingDoctor
      );

      const refreshed = await storageService.getDoctors();
      onDoctorsChange(refreshed);
      onRefreshAuditLogs?.();

      const targetHospName = hospitalMap.get(saved.hospitalId)?.name || '';
      setFeedback({
        type: 'success',
        text: editingDoctor
          ? `تم تحديث بيانات الطبيب "${saved.fullName}" بنجاح`
          : `تمت إضافة الطبيب "${saved.fullName}" إلى "${targetHospName}" بنجاح`
      });
      resetDoctorForm(saved.hospitalId);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'حدث خطأ أثناء حفظ بيانات الطبيب' });
    } finally {
      setIsSavingDoc(false);
    }
  };

  const handleDeleteDoctor = async (doc: Doctor) => {
    setBusyDoctorId(doc.id);
    setFeedback(null);
    try {
      await storageService.deleteDoctor(doc.id, doc.fullName);
      const refreshed = await storageService.getDoctors();
      onDoctorsChange(refreshed);
      onRefreshAuditLogs?.();
      setConfirmDeleteDoctorId(null);
      if (editingDoctor?.id === doc.id) {
        resetDoctorForm();
      }
      setFeedback({ type: 'success', text: `تم حذف الطبيب "${doc.fullName}" بنجاح` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'تعذر حذف الطبيب' });
    } finally {
      setBusyDoctorId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Sub-navigation Switcher: Hospitals vs Doctors */}
      <div className="bg-white rounded-3xl p-2 border border-slate-200/80 shadow-xs flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSubTab('hospitals')}
          className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${
            subTab === 'hospitals'
              ? 'bg-rose-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <HospitalIcon className="w-4 h-4 shrink-0" />
          <span className="tabular-nums">إدارة المستشفيات ({sortedHospitals.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('doctors');
            if (!docHospitalId && sortedHospitals.length > 0) {
              setDocHospitalId(sortedHospitals[0].id);
            }
          }}
          className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${
            subTab === 'doctors'
              ? 'bg-rose-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Stethoscope className="w-4 h-4 shrink-0" />
          <span className="tabular-nums">إدارة الأطباء ({sortedDoctors.length})</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
            aria-label="إغلاق التنبيه"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ============================================================
          SUB-TAB 1: HOSPITALS MANAGEMENT
         ============================================================ */}
      {subTab === 'hospitals' && (
        <div className="space-y-6">
          {/* Add / Edit Hospital Form */}
          <div
            ref={hospitalFormRef}
            className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 flex items-center justify-center shrink-0">
                  <HospitalIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    {editingHospital ? `تعديل مستشفى: ${editingHospital.name}` : 'إضافة مستشفى جديد'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    يظهر المستشفى في صفحة «المستشفيات والأطباء» لجميع المستخدمين فور الحفظ
                  </p>
                </div>
              </div>

              {editingHospital && (
                <button
                  type="button"
                  onClick={() => resetHospitalForm()}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>إلغاء التعديل</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSubmitHospital} className="space-y-4">
              {/* Hospital Image Upload & Preview */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-rose-700" />
                    <span>صورة المستشفى <span className="text-rose-600">*</span></span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setUseExternalHospUrl(!useExternalHospUrl)}
                    className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
                  >
                    {useExternalHospUrl ? 'رفع صورة من الجهاز بدلاً من الرابط' : 'أو إدخال رابط صورة مباشر (URL)'}
                  </button>
                </div>

                {!useExternalHospUrl ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      ref={hospitalFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleHospitalImageChange}
                      className="hidden"
                      id="directory-hospital-image-upload"
                    />
                    <label
                      htmlFor="directory-hospital-image-upload"
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-2 transition-all active:scale-98"
                    >
                      {isOptimizingHospImg ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <span>
                        {isOptimizingHospImg
                          ? 'جاري ضغط الصورة...'
                          : hospImageUrl
                          ? 'تغيير صورة المستشفى'
                          : 'رفع صورة المستشفى'}
                      </span>
                    </label>

                    {hospImgSizeInfo && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                        {hospImgSizeInfo}
                      </span>
                    )}
                  </div>
                ) : (
                  <input
                    type="url"
                    value={hospImageUrl}
                    onChange={(e) => setHospImageUrl(e.target.value)}
                    placeholder="https://example.com/hospital-photo.webp"
                    dir="ltr"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono focus:outline-hidden focus:border-rose-600"
                  />
                )}

                {hospImageUrl && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 block">
                      معاينة بطاقة المستشفى:
                    </span>
                    <div className="max-w-xs rounded-2xl overflow-hidden border border-slate-300/80 bg-white shadow-2xs">
                      <div className="aspect-[16/10] bg-slate-100">
                        <img
                          src={hospImageUrl}
                          alt="معاينة صورة المستشفى"
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-black text-slate-900 truncate">
                          {hospName || 'اسم المستشفى'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Hospital Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم المستشفى <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={hospName}
                    onChange={(e) => setHospName(e.target.value)}
                    placeholder="أدخل الاسم الرسمي للمستشفى..."
                    required
                    maxLength={150}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    العنوان / الموقع (اختياري)
                  </label>
                  <input
                    type="text"
                    value={hospAddress}
                    onChange={(e) => setHospAddress(e.target.value)}
                    placeholder="مثال: مديرية قعطبة - الشارع العام"
                    maxLength={250}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رقم هاتف المستشفى (اختياري)
                  </label>
                  <input
                    type="tel"
                    value={hospPhone}
                    onChange={(e) => setHospPhone(e.target.value)}
                    placeholder="مثال: 777123456"
                    dir="ltr"
                    maxLength={25}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-sans text-right focus:outline-hidden focus:border-rose-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ترتيب العرض
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={hospDisplayOrder}
                    onChange={(e) => setHospDisplayOrder(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-sans focus:outline-hidden focus:border-rose-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نبذة عن المستشفى والخدمات المتوفرة (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={hospDescription}
                  onChange={(e) => setHospDescription(e.target.value)}
                  placeholder="أقسام المستشفى، ساعات العمل، أو ملاحظات للمراجعين..."
                  maxLength={1500}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSavingHosp || isOptimizingHospImg}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-md shadow-rose-900/20 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 transition-all active:scale-98"
                >
                  {isSavingHosp ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingHospital ? (
                    <Save className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>
                    {isSavingHosp
                      ? 'جاري الحفظ...'
                      : editingHospital
                      ? 'حفظ تعديلات المستشفى'
                      : 'إضافة المستشفى'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Registered Hospitals List */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="font-extrabold text-slate-900 text-sm tabular-nums">
                المستشفيات المسجلة ({sortedHospitals.length})
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                يمكنك تعديل أي مستشفى أو إضافة الأطباء التابعين له مباشرة
              </span>
            </div>

            {sortedHospitals.length === 0 ? (
              <div className="py-10 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-2xl">
                <HospitalIcon className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-semibold">لا توجد مستشفيات مضافة حالياً.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedHospitals.map((hosp, index) => {
                  const docsCount = doctorCountByHospital[hosp.id] || 0;
                  const isBusy = busyHospitalId === hosp.id;

                  return (
                    <div
                      key={hosp.id}
                      className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-full sm:w-36 h-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 relative">
                          <img
                            src={hosp.imageUrl}
                            alt={hosp.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-1.5 right-1.5 text-[10px] font-black font-sans bg-slate-950/75 text-white px-2 py-0.5 rounded-md">
                            #{hosp.displayOrder || index + 1}
                          </span>
                        </div>

                        <div className="space-y-1.5 min-w-0 flex-1">
                          <h5 className="font-extrabold text-slate-900 text-sm sm:text-base truncate">
                            {hosp.name}
                          </h5>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                            <span className="inline-flex items-center gap-1 font-bold text-rose-700 tabular-nums">
                              <Stethoscope className="w-3.5 h-3.5" />
                              <span>{docsCount} طبيب</span>
                            </span>
                            {hosp.address && (
                              <span className="inline-flex items-center gap-1 truncate max-w-xs">
                                <MapPin className="w-3 h-3 text-rose-600 shrink-0" />
                                <span className="truncate">{hosp.address}</span>
                              </span>
                            )}
                            {hosp.phone && (
                              <span className="inline-flex items-center gap-1 font-sans" dir="ltr">
                                <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>{hosp.phone}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleManageHospitalDoctors(hosp.id)}
                            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>إضافة / عرض الأطباء</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMoveHospital(index, 'up')}
                            disabled={index === 0 || isBusy}
                            className="min-h-[38px] min-w-[38px] p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 cursor-pointer flex items-center justify-center"
                            title="تقديم للأعلى"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveHospital(index, 'down')}
                            disabled={index === sortedHospitals.length - 1 || isBusy}
                            className="min-h-[38px] min-w-[38px] p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 cursor-pointer flex items-center justify-center"
                            title="تأخير للأسفل"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartEditHospital(hosp)}
                            disabled={isBusy}
                            className="min-h-[38px] min-w-[38px] p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 cursor-pointer flex items-center justify-center"
                            title="تعديل المستشفى"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteHospitalId(
                                confirmDeleteHospitalId === hosp.id ? null : hosp.id
                              )
                            }
                            disabled={isBusy}
                            className="min-h-[38px] min-w-[38px] p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 cursor-pointer flex items-center justify-center"
                            title="حذف المستشفى"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {confirmDeleteHospitalId === hosp.id && (
                          <div className="flex flex-wrap items-center gap-2 bg-red-50 border border-red-200 px-3 py-2 rounded-xl text-[11px] font-bold text-red-900">
                            <span>
                              {docsCount > 0
                                ? `سيتم حذف المستشفى و(${docsCount}) طبيب مرتبط به، تأكيد؟`
                                : 'تأكيد حذف المستشفى؟'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteHospital(hosp)}
                              disabled={isBusy}
                              className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                            >
                              {isBusy ? 'جاري...' : 'نعم، احذف'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteHospitalId(null)}
                              className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          SUB-TAB 2: DOCTORS MANAGEMENT
         ============================================================ */}
      {subTab === 'doctors' && (
        <div className="space-y-6">
          {sortedHospitals.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-slate-200/80 text-center space-y-3">
              <HospitalIcon className="w-10 h-10 text-rose-600 mx-auto" />
              <h3 className="text-base font-black text-slate-900">
                أضف مستشفى أولاً لربط الأطباء به
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                كل طبيب يرتبط بالمستشفى التابع له، لذا يرجى إضافة مستشفى واحد على الأقل أولاً.
              </p>
              <button
                type="button"
                onClick={() => setSubTab('hospitals')}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>الانتقال لإضافة مستشفى</span>
              </button>
            </div>
          ) : (
            <div
              ref={doctorFormRef}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 flex items-center justify-center shrink-0">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                      {editingDoctor ? `تعديل بيانات الطبيب: ${editingDoctor.fullName}` : 'إضافة طبيب جديد'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      يمكنك إضافة عدد غير محدود من الأطباء وربط كل طبيب بالمستشفى التابع له
                    </p>
                  </div>
                </div>

                {editingDoctor && (
                  <button
                    type="button"
                    onClick={() => resetDoctorForm()}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>إلغاء التعديل</span>
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmitDoctor} className="space-y-4">
                {/* Doctor Photo Upload & Preview */}
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-rose-700" />
                      <span>صورة الطبيب:</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setUseExternalDocUrl(!useExternalDocUrl)}
                      className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
                    >
                      {useExternalDocUrl ? 'رفع صورة من الجهاز بدلاً من الرابط' : 'أو إدخال رابط صورة مباشر (URL)'}
                    </button>
                  </div>

                  {!useExternalDocUrl ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        ref={doctorFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleDoctorImageChange}
                        className="hidden"
                        id="directory-doctor-image-upload"
                      />
                      <label
                        htmlFor="directory-doctor-image-upload"
                        className="min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-2 transition-all active:scale-98"
                      >
                        {isOptimizingDocImg ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>
                          {isOptimizingDocImg
                            ? 'جاري ضغط الصورة...'
                            : docImageUrl
                            ? 'تغيير صورة الطبيب'
                            : 'رفع صورة الطبيب'}
                        </span>
                      </label>

                      {docImageUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setDocImageUrl('');
                            setDocImgSizeInfo(null);
                            if (doctorFileInputRef.current) doctorFileInputRef.current.value = '';
                          }}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-red-700 text-xs font-bold cursor-pointer"
                        >
                          إزالة الصورة
                        </button>
                      )}

                      {docImgSizeInfo && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                          {docImgSizeInfo}
                        </span>
                      )}
                    </div>
                  ) : (
                    <input
                      type="url"
                      value={docImageUrl}
                      onChange={(e) => setDocImageUrl(e.target.value)}
                      placeholder="https://example.com/doctor-photo.webp"
                      dir="ltr"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono focus:outline-hidden focus:border-rose-600"
                    />
                  )}

                  {/* Live Doctor Card Preview */}
                  {(docImageUrl || docFullName || docSpecialty) && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 block">
                        معاينة بطاقة الطبيب:
                      </span>
                      <div className="max-w-md bg-white rounded-2xl p-3 border border-slate-200/90 flex items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                          {docImageUrl ? (
                            <img
                              src={docImageUrl}
                              alt="معاينة صورة الطبيب"
                              className="w-full h-full object-cover object-top"
                            />
                          ) : (
                            <UserRound className="w-7 h-7 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 truncate">
                            {docFullName || 'اسم الطبيب'}
                          </p>
                          <p className="text-xs font-bold text-rose-700 truncate">
                            {docSpecialty || 'التخصص الطبي'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Doctor Details Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      المستشفى التابع له <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={docHospitalId}
                      onChange={(e) => setDocHospitalId(e.target.value)}
                      required
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden focus:border-rose-600"
                    >
                      <option value="">-- اختر المستشفى --</option>
                      {sortedHospitals.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      اسم الطبيب <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={docFullName}
                      onChange={(e) => setDocFullName(e.target.value)}
                      placeholder="أدخل اسم الطبيب الكامل..."
                      required
                      maxLength={150}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      التخصص الطبي <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={docSpecialty}
                      onChange={(e) => setDocSpecialty(e.target.value)}
                      placeholder="مثال: أخصائي باطنية، جراحة عامة، أطفال..."
                      required
                      maxLength={120}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      رقم التواصل (اختياري)
                    </label>
                    <input
                      type="tel"
                      value={docPhone}
                      onChange={(e) => setDocPhone(e.target.value)}
                      placeholder="مثال: 777123456"
                      dir="ltr"
                      maxLength={25}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-sans text-right focus:outline-hidden focus:border-rose-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      نبذة مختصرة عن الطبيب (اختياري)
                    </label>
                    <textarea
                      rows={2}
                      value={docBio}
                      onChange={(e) => setDocBio(e.target.value)}
                      placeholder="الخبرات، الشهادات، أو أوقات العيادة في المستشفى..."
                      maxLength={1000}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ترتيب الظهور
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={docDisplayOrder}
                      onChange={(e) =>
                        setDocDisplayOrder(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-sans focus:outline-hidden focus:border-rose-600"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={isSavingDoc || isOptimizingDocImg}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-md shadow-rose-900/20 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 transition-all active:scale-98"
                  >
                    {isSavingDoc ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : editingDoctor ? (
                      <Save className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    <span>
                      {isSavingDoc
                        ? 'جاري الحفظ...'
                        : editingDoctor
                        ? 'حفظ تعديلات الطبيب'
                        : 'إضافة الطبيب للمستشفى'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Existing Doctors Management List */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h4 className="font-extrabold text-slate-900 text-sm tabular-nums">
                الأطباء المسجلون ({filteredDoctorsList.length})
              </h4>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={doctorSearchTerm}
                    onChange={(e) => setDoctorSearchTerm(e.target.value)}
                    placeholder="بحث باسم الطبيب أو التخصص..."
                    className="min-h-[40px] pr-9 pl-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-hidden focus:border-rose-600"
                  />
                </div>

                <select
                  value={filterHospitalId}
                  onChange={(e) => setFilterHospitalId(e.target.value)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-hidden focus:border-rose-600"
                >
                  <option value="all">كل المستشفيات ({sortedDoctors.length})</option>
                  {sortedHospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({doctorCountByHospital[h.id] || 0})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredDoctorsList.length === 0 ? (
              <div className="py-10 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-2xl">
                <Stethoscope className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-semibold">
                  {sortedDoctors.length === 0
                    ? 'لم يتم إضافة أطباء حتى الآن.'
                    : 'لا توجد نتائج مطابقة للبحث أو التصفية.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDoctorsList.map((doc) => {
                  const hospNameLabel = hospitalMap.get(doc.hospitalId)?.name || 'مستشفى غير محدد';
                  const isBusy = busyDoctorId === doc.id;

                  return (
                    <div
                      key={doc.id}
                      className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
                          {doc.imageUrl ? (
                            <img
                              src={doc.imageUrl}
                              alt={doc.fullName}
                              loading="lazy"
                              className="w-full h-full object-cover object-top"
                            />
                          ) : (
                            <UserRound className="w-7 h-7 text-slate-400" />
                          )}
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <h5 className="font-extrabold text-slate-900 text-sm sm:text-base truncate">
                            {doc.fullName}
                          </h5>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span className="font-bold text-rose-700">{doc.specialty}</span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="text-slate-600 font-semibold inline-flex items-center gap-1">
                              <HospitalIcon className="w-3.5 h-3.5 text-slate-400" />
                              <span>{hospNameLabel}</span>
                            </span>
                            {doc.phone && (
                              <>
                                <span aria-hidden="true" className="text-slate-300">·</span>
                                <span className="text-emerald-700 font-sans font-bold" dir="ltr">
                                  {doc.phone}
                                </span>
                              </>
                            )}
                          </div>
                          {doc.bio && (
                            <p className="text-xs text-slate-500 line-clamp-2 pt-0.5">
                              {doc.bio}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEditDoctor(doc)}
                            disabled={isBusy}
                            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>تعديل</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteDoctorId(
                                confirmDeleteDoctorId === doc.id ? null : doc.id
                              )
                            }
                            disabled={isBusy}
                            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف</span>
                          </button>
                        </div>

                        {confirmDeleteDoctorId === doc.id && (
                          <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl text-[11px] font-bold text-red-900">
                            <span>تأكيد حذف الطبيب؟</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteDoctor(doc)}
                              disabled={isBusy}
                              className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                            >
                              {isBusy ? 'جاري...' : 'نعم، احذف'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteDoctorId(null)}
                              className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
