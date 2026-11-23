import React, { useState, useEffect } from 'react';
import { X, UserPlus, UserCheck, Phone, MapPin, Heart, Calendar, Check, AlertCircle, Edit3 } from 'lucide-react';
import { BloodType, District, Donor } from '../types';
import { checkDonorDuplication } from '../services/storageService';

interface AddDonorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (donor: Omit<Donor, 'id' | 'createdAt'>) => Promise<any> | any;
  onUpdate?: (donor: Donor) => Promise<any> | any;
  donorToEdit?: Donor | null;
  districts: District[];
  existingDonors?: Donor[];
}

export const AddDonorModal: React.FC<AddDonorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  donorToEdit = null,
  districts,
  existingDonors = []
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodType, setBloodType] = useState<BloodType>('O+');
  const [selectedDistrictName, setSelectedDistrictName] = useState(districts[0]?.name || 'مديرية قعطبة - المركز');
  const [area, setArea] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [lastDonationDate, setLastDonationDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync form values when modal opens or donorToEdit changes
  useEffect(() => {
    if (donorToEdit) {
      setFullName(donorToEdit.fullName || '');
      setPhone(donorToEdit.phone || '');
      setBloodType(donorToEdit.bloodType || 'O+');
      setSelectedDistrictName(donorToEdit.district || districts[0]?.name || 'مديرية قعطبة - المركز');
      setArea(donorToEdit.area || '');
      setIsAvailable(donorToEdit.isAvailable !== false);
      setWhatsappOptIn(donorToEdit.whatsappOptIn !== false);
      setLastDonationDate(donorToEdit.lastDonationDate || '');
      setNotes(donorToEdit.notes || '');
      setError('');
    } else {
      setFullName('');
      setPhone('');
      setBloodType('O+');
      setSelectedDistrictName(districts[0]?.name || 'مديرية قعطبة - المركز');
      setArea('');
      setIsAvailable(true);
      setWhatsappOptIn(true);
      setLastDonationDate('');
      setNotes('');
      setError('');
    }
  }, [donorToEdit, isOpen, districts]);

  if (!isOpen) return null;

  const currentDistrict = districts.find((d) => d.name === selectedDistrictName);
  const availableAreas = currentDistrict ? currentDistrict.areas : [];
  const bloodTypes: BloodType[] = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('يرجى إدخال اسم المتبرع كاملاً');
      return;
    }
    if (!phone.trim()) {
      setError('يرجى إدخال رقم هاتف المتبرع');
      return;
    }

    // Check duplication and format rules before submitting (exclude current donor if editing)
    if (existingDonors.length > 0) {
      const dupCheck = checkDonorDuplication(
        { fullName, phone }, 
        existingDonors, 
        donorToEdit?.id
      );
      if (dupCheck.isDuplicate) {
        setError(dupCheck.reason || 'المتبرع مسجل مسبقاً أو بياناته مكررة بالسجل');
        return;
      }
    }

    if (!area.trim()) {
      setError('يرجى تحديد أو إدخال القرية أو المنطقة');
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      
      if (donorToEdit && onUpdate) {
        // Edit Mode
        const updatedDonor: Donor = {
          ...donorToEdit,
          fullName: fullName.trim(),
          phone: phone.trim(),
          bloodType,
          district: selectedDistrictName,
          area: area.trim(),
          isAvailable,
          whatsappOptIn: whatsappOptIn !== false,
          lastDonationDate: lastDonationDate || undefined,
          notes: notes.trim() || undefined
        };
        await onUpdate(updatedDonor);
      } else {
        // Create Mode
        await onSave({
          fullName: fullName.trim(),
          phone: phone.trim(),
          bloodType,
          district: selectedDistrictName,
          area: area.trim(),
          isAvailable,
          whatsappOptIn: whatsappOptIn !== false,
          lastDonationDate: lastDonationDate || undefined,
          notes: notes.trim() || undefined
        });
      }

      setIsSaving(false);
      onClose();
    } catch (err: any) {
      setIsSaving(false);
      setError(err.message || 'تعذر حفظ بيانات المتبرع');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              donorToEdit ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-600'
            }`}>
              {donorToEdit ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {donorToEdit ? 'تعديل بيانات المتبرع' : 'تسجيل متبرع جديد بالدم'}
              </h3>
              <p className="text-xs text-slate-500">
                {donorToEdit ? `تحديث سجل المتبرع (${donorToEdit.fullName})` : 'إضافة متبرع إلى سجل قعطبة والمناطق المجاورة'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              الاسم الرباعي أو الكامل <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setError('');
              }}
              placeholder="مثال: صالح محمد علي الشعيبي"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              required
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              رقم الهاتف (للاتصال والتواصل) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError('');
                }}
                placeholder="مثال: 771234567"
                dir="ltr"
                className="w-full px-3.5 py-2.5 pl-10 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-right"
                required
              />
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          {/* Blood Type Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              فصيلة الدم <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {bloodTypes.map((type) => {
                const isSelected = bloodType === type;
                return (
                  <button
                    type="button"
                    key={type}
                    onClick={() => setBloodType(type)}
                    className={`py-2 rounded-xl font-bold font-sans text-sm transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-rose-800 text-white border-rose-800 shadow-xs scale-102'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* District & Area */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                المديرية / المنطقة الرئيسية <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedDistrictName}
                onChange={(e) => {
                  setSelectedDistrictName(e.target.value);
                  setArea('');
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-rose-500 bg-white"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                القرية أو الحي <span className="text-red-500">*</span>
              </label>
              {availableAreas.length > 0 ? (
                <div className="space-y-1.5">
                  <select
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-rose-500 bg-white"
                  >
                    <option value="">اختر من القرى والحي...</option>
                    {availableAreas.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                    <option value="other">أخرى (كتابة يدوية)</option>
                  </select>
                  {area === 'other' || !availableAreas.includes(area) ? (
                    <input
                      type="text"
                      placeholder="اكتب اسم القرية أو المنطقة..."
                      value={area === 'other' ? '' : area}
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-500"
                    />
                  ) : null}
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="مثال: مركز المدينة / سناح"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-rose-500"
                  required
                />
              )}
            </div>
          </div>

          {/* Last Donation Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              تاريخ آخر تبرع (إن وُجد)
            </label>
            <div className="relative">
              <input
                type="date"
                value={lastDonationDate}
                onChange={(e) => setLastDonationDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-rose-500"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              يُشترط مضي شهرين إلى ثلاثة أشهر بين كل تبرع لضمان سلامتك وصحتك.
            </p>
          </div>

          {/* Availability Switch */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">حالة التوفر للتبرع</span>
              <span className="text-[11px] text-slate-500">
                {isAvailable ? 'متاح وجاهز للتبرع عند الحاجة 🟢' : 'غير متاح مؤقتاً ⚪'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsAvailable(!isAvailable)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                isAvailable ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isAvailable ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* WhatsApp Opt-in Consent Switch */}
          <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">استقبال نداءات الدم عبر واتساب 💬</span>
              <span className="text-[11px] text-slate-500">
                {whatsappOptIn ? 'موافق على تلقي رسائل واتساب عند وجود حالات دم عاجلة' : 'غير مشترك في إشعارات الواتساب'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setWhatsappOptIn(!whatsappOptIn)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                whatsappOptIn ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  whatsappOptIn ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: متواجد في المساء، لديه وسيلة نقل، فصيلة نادرة..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-500"
            />
          </div>

          {/* Submit Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-800 to-red-800 hover:from-rose-900 hover:to-red-900 text-white font-bold text-xs shadow-sm transition-all active:scale-98 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>
                {isSaving 
                  ? 'جاري الحفظ في قاعدة البيانات...' 
                  : donorToEdit ? 'حفظ وتعديل بيانات المتبرع' : 'حفظ وتأكيد التسجيل'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
