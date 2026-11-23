import React, { useState } from 'react';
import { X, Droplet, Phone, AlertTriangle, Hospital, MapPin, Check } from 'lucide-react';
import { BloodRequest, BloodType, District, UrgencyLevel } from '../types';

interface AddRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (req: Omit<BloodRequest, 'id' | 'createdAt'>) => Promise<void> | void;
  districts: District[];
}

export const AddRequestModal: React.FC<AddRequestModalProps> = ({
  isOpen,
  onClose,
  onSave,
  districts
}) => {
  if (!isOpen) return null;

  const [patientName, setPatientName] = useState('');
  const [bloodType, setBloodType] = useState<BloodType>('O+');
  const [unitsNeeded, setUnitsNeeded] = useState(2);
  const [hospital, setHospital] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState(districts[0]?.name || 'مديرية قعطبة - المركز');
  const [area, setArea] = useState('');
  const [urgency, setUrgency] = useState<UrgencyLevel>('critical');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [caseDetails, setCaseDetails] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const bloodTypes: BloodType[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) {
      setError('يرجى كتابة اسم المريض');
      return;
    }
    if (!hospital.trim()) {
      setError('يرجى تحديد اسم المستشفى أو المركز الصحي');
      return;
    }
    if (!contactPhone.trim()) {
      setError('يرجى تدوين رقم هاتف للتواصل الفوري');
      return;
    }
    if (!contactName.trim()) {
      setError('يرجى تحديد اسم مسؤول التواصل أو قريب المريض');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await onSave({
        patientName: patientName.trim(),
        bloodType,
        unitsNeeded: Math.max(1, Number(unitsNeeded) || 1),
        hospital: hospital.trim(),
        district: selectedDistrict,
        area: area.trim() || 'قعطبة',
        urgency,
        status: 'open',
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        caseDetails: caseDetails.trim() || 'حالة طبية تستدعي التبرع بالدم',
        requestDate: new Date().toISOString().split('T')[0]
      });
      setIsSubmitting(false);
      onClose();
    } catch (saveErr: any) {
      setIsSubmitting(false);
      setError(saveErr?.message || 'تعذر حفظ طلب الدم في قاعدة البيانات المركزية');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
              <Droplet className="w-5 h-5 fill-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">تقديم طلب دم عاجل</h3>
              <p className="text-xs text-slate-500">نشر نداء استغاثة لتوفير متبرعين في قعطبة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Urgency Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">درجة الإلحاح</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'critical', label: 'عاجل جداً 🚨', bg: 'bg-rose-800 text-white shadow-xs' },
                { id: 'urgent', label: 'عاجل ⚠️', bg: 'bg-amber-600 text-white shadow-xs' },
                { id: 'moderate', label: 'متوسط ⏳', bg: 'bg-sky-700 text-white shadow-xs' },
                { id: 'normal', label: 'عادي 🟢', bg: 'bg-emerald-700 text-white shadow-xs' }
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setUrgency(item.id as UrgencyLevel)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    urgency === item.id
                      ? `${item.bg} border-transparent`
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Patient Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              اسم المريض / الحالة <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => {
                setPatientName(e.target.value);
                setError('');
              }}
              placeholder="مثال: أيمن خالد / مريضة بقسم الولادة"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              required
            />
          </div>

          {/* Blood Type & Units */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الفصيلة المطلوبة <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {bloodTypes.map((type) => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => setBloodType(type)}
                    className={`py-1.5 rounded-lg text-xs font-bold font-sans transition-all border cursor-pointer ${
                      bloodType === type
                        ? 'bg-rose-800 text-white border-rose-800 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                عدد الوحدات (أكياس الدم) <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUnitsNeeded(Math.max(1, unitsNeeded - 1))}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <div className="flex-1 text-center font-black text-lg text-slate-800 bg-slate-50 border border-slate-200 py-1.5 rounded-xl">
                  {unitsNeeded} {unitsNeeded === 1 ? 'وحدة' : 'وحدات'}
                </div>
                <button
                  type="button"
                  onClick={() => setUnitsNeeded(unitsNeeded + 1)}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Hospital & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                المستشفى / المركز الصحي <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={hospital}
                  onChange={(e) => {
                    setHospital(e.target.value);
                    setError('');
                  }}
                  placeholder="مثال: مستشفى السلام - قعطبة"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-red-500 pr-9"
                  required
                />
                <Hospital className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">المديرية</label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-red-500 bg-white"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Area or Room Details */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              المنطقة أو القسم/الغرفة بالمستشفى
            </label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="مثال: قسم العناية المركزة / الطوارئ / مركز المدينة"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-red-500"
            />
          </div>

          {/* Contact Person & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم مسؤول التواصل / المرافق <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="مثال: والد المريض / شقيقه"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-red-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم هاتف الاتصال المباشر <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="مثال: 777112233"
                  dir="ltr"
                  className="w-full px-3 py-2 pl-9 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-red-500 text-right"
                  required
                />
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>
          </div>

          {/* Case Details */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              تفاصيل الحالة وسبب الاحتياج
            </label>
            <textarea
              rows={2}
              value={caseDetails}
              onChange={(e) => setCaseDetails(e.target.value)}
              placeholder="مثال: عملية جراحية عاجلة اليوم الساعة 10 صباحاً، انخفاض الهيموجلوبين..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-red-500"
            />
          </div>

          {/* Submit */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-800 to-red-800 hover:from-rose-900 hover:to-red-900 text-white font-bold text-xs shadow-sm active:scale-98 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الحفظ في قاعدة البيانات...' : 'نشر طلب التبرع'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
