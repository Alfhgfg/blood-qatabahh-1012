import React, { useMemo, useState } from 'react';
import {
  ClipboardList,
  Droplet,
  Calendar,
  Hospital,
  CheckCircle2,
  Plus,
  Trash2,
  HeartHandshake,
  MapPin,
  Clock,
  UserCheck,
  Search,
  ArrowRight
} from 'lucide-react';
import { BloodRequest, BloodType, DonationRecord, Donor, UserAccount } from '../types';
import { getDonationEligibility, normalizePhoneNumber } from '../services/storageService';

interface DonationHistoryPageProps {
  currentUser: UserAccount;
  donors: Donor[];
  requests: BloodRequest[];
  onUpdateUser: (updated: UserAccount) => Promise<void>;
  onSelectRequest: (req: BloodRequest) => void;
  onSelectDonor: (donor: Donor) => void;
  onOpenAddDonor: () => void;
  onTriggerToast: (msg: string) => void;
  onBack?: () => void;
}

const BLOOD_TYPES: BloodType[] = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

export const DonationHistoryPage: React.FC<DonationHistoryPageProps> = ({
  currentUser,
  donors,
  requests,
  onUpdateUser,
  onSelectRequest,
  onSelectDonor,
  onOpenAddDonor,
  onTriggerToast,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'registry'>('personal');
  const [showAddForm, setShowAddForm] = useState(false);
  const [donationDate, setDonationDate] = useState(new Date().toISOString().split('T')[0]);
  const [hospital, setHospital] = useState('مستشفى السلام العام - قعطبة');
  const [bloodTypeFilter, setBloodTypeFilter] = useState<BloodType | 'all'>('all');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const [selectedBloodType, setSelectedBloodType] = useState<BloodType>(
    linkedDonor?.bloodType || 'O+'
  );

  // Merge user's logged donationHistory + linked donor's lastDonationDate if not already listed
  const personalRecords = useMemo(() => {
    const saved = Array.isArray(currentUser.donationHistory) ? [...currentUser.donationHistory] : [];
    if (
      linkedDonor?.lastDonationDate &&
      !saved.some((item) => item.date === linkedDonor.lastDonationDate)
    ) {
      saved.push({
        id: `donor-last-${linkedDonor.id}`,
        date: linkedDonor.lastDonationDate,
        hospital: `${linkedDonor.district} - ${linkedDonor.area}`,
        bloodType: linkedDonor.bloodType,
        notes: 'مسجل من بطاقة المتبرع المعتمدة في السجل',
        createdAt: linkedDonor.createdAt
      });
    }
    return saved.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [currentUser.donationHistory, linkedDonor]);

  const latestDonationDate = personalRecords[0]?.date || linkedDonor?.lastDonationDate;
  const eligibility = getDonationEligibility(latestDonationDate);
  const progressPercent = eligibility.daysPassed === null
    ? 100
    : Math.min(100, Math.round((eligibility.daysPassed / 60) * 100));

  // Real fulfilled blood requests from Firestore
  const fulfilledRequests = useMemo(() => {
    return requests
      .filter((r) => r.status === 'fulfilled')
      .filter((r) => bloodTypeFilter === 'all' || r.bloodType === bloodTypeFilter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, bloodTypeFilter]);

  // Real donors who have documented lastDonationDate in Firestore
  const recentDonorsWithDates = useMemo(() => {
    return donors
      .filter((d) => Boolean(d.lastDonationDate))
      .filter((d) => bloodTypeFilter === 'all' || d.bloodType === bloodTypeFilter)
      .sort((a, b) => {
        const tA = a.lastDonationDate ? new Date(a.lastDonationDate).getTime() : 0;
        const tB = b.lastDonationDate ? new Date(b.lastDonationDate).getTime() : 0;
        return tB - tA;
      });
  }, [donors, bloodTypeFilter]);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donationDate || !hospital.trim()) {
      onTriggerToast('يرجى تحديد التاريخ واسم المستشفى أو المركز الطبي ⚠️');
      return;
    }
    const newRecord: DonationRecord = {
      id: `donrec-${Date.now()}`,
      date: donationDate,
      hospital: hospital.trim(),
      bloodType: linkedDonor?.bloodType || selectedBloodType,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    try {
      setIsSaving(true);
      const updatedHistory = [newRecord, ...(currentUser.donationHistory || [])];
      await onUpdateUser({
        ...currentUser,
        donationHistory: updatedHistory
      });
      setShowAddForm(false);
      setNotes('');
      onTriggerToast('تم توثيق التبرع في سجلك الشخصي بنجاح 🩸');
    } catch {
      onTriggerToast('تعذر حفظ سجل التبرع، يرجى المحاولة لاحقاً');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePersonalRecord = async (id: string) => {
    const updatedHistory = (currentUser.donationHistory || []).filter((item) => item.id !== id);
    try {
      await onUpdateUser({
        ...currentUser,
        donationHistory: updatedHistory
      });
      onTriggerToast('تم حذف السجل من قائمتك الشخصية');
    } catch {
      onTriggerToast('تعذر حذف السجل');
    }
  };

  return (
    <div className="space-y-5 pb-24 font-['Cairo',sans-serif]">
      {/* Page Header */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
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
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">سجل التبرعات</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              متابعة تبرعاتك الشخصية وسجل الحالات المُنقذة في قاعدة البيانات
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2.5 rounded-2xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>توثيق تبرع جديد</span>
        </button>
      </div>

      {/* Add Personal Donation Record Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddRecord}
          className="bg-white p-5 rounded-3xl border border-rose-200 shadow-sm space-y-4"
        >
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Droplet className="w-4 h-4 text-rose-600 fill-rose-600" />
            <span>إضافة تبرع بالدم إلى سجلك الشخصي</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ التبرع</label>
              <input
                type="date"
                value={donationDate}
                onChange={(e) => setDonationDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:border-rose-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">المستشفى أو المركز</label>
              <input
                type="text"
                value={hospital}
                onChange={(e) => setHospital(e.target.value)}
                placeholder="مثال: مستشفى السلام - قعطبة"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:border-rose-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">فصيلة الدم</label>
              <select
                value={linkedDonor?.bloodType || selectedBloodType}
                disabled={Boolean(linkedDonor)}
                onChange={(e) => setSelectedBloodType(e.target.value as BloodType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white focus:outline-hidden focus:border-rose-600 disabled:bg-slate-50"
              >
                {BLOOD_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات (اختياري)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: تبرع لحالة طوارئ، وحدة واحدة..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:border-rose-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'جاري الحفظ...' : 'حفظ التبرع'}
            </button>
          </div>
        </form>
      )}

      {/* Segmented Tab Switcher */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/70 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('personal')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'personal'
              ? 'bg-white text-rose-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          سجلي الشخصي ({personalRecords.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('registry')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'registry'
              ? 'bg-white text-rose-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          سجل الإنقاذ بالمديرية ({fulfilledRequests.length + recentDonorsWithDates.length})
        </button>
      </div>

      {/* TAB 1: Personal Donation History & Recovery Tracker */}
      {activeTab === 'personal' && (
        <div className="space-y-4">
          {/* Eligibility Progress Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-rose-700" />
                <h3 className="text-sm font-bold text-slate-900">مؤشر الجاهزية الصحية للتبرع القادم</h3>
              </div>
              <span
                className={`text-xs font-bold ${
                  eligibility.isEligible ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {eligibility.isEligible ? 'مؤهل للتبرع الآن' : `متبقٍ ${eligibility.daysRemaining} يوماً`}
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  eligibility.isEligible ? 'bg-emerald-600' : 'bg-amber-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="text-xs text-slate-600">{eligibility.message}</p>

            {!linkedDonor && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500">لم يتم ربط حسابك ببطاقة متبرع في السجل العام بعد.</span>
                <button
                  type="button"
                  onClick={onOpenAddDonor}
                  className="font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer shrink-0"
                >
                  سجّل كمتبرع
                </button>
              </div>
            )}
          </div>

          {/* Personal Records List */}
          {personalRecords.length > 0 ? (
            <div className="space-y-3">
              {personalRecords.map((rec) => {
                const isFromDonorCard = rec.id.startsWith('donor-last-');
                return (
                  <div
                    key={rec.id}
                    className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-700 to-red-800 text-white font-sans font-black text-sm flex items-center justify-center shrink-0">
                        {rec.bloodType}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900">{rec.hospital}</h4>
                          <span className="text-xs text-slate-400 font-sans">· {rec.date}</span>
                        </div>
                        {rec.notes && (
                          <p className="text-xs text-slate-600 mt-1">{rec.notes}</p>
                        )}
                      </div>
                    </div>

                    {!isFromDonorCard && (
                      <button
                        type="button"
                        onClick={() => handleDeletePersonalRecord(rec.id)}
                        title="حذف السجل"
                        aria-label="حذف السجل"
                        className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/80 space-y-2">
              <HeartHandshake className="w-10 h-10 text-rose-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">لا توجد تبرعات موثقة في سجلك الشخصي حتى الآن</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                اضغط على "توثيق تبرع جديد" لإضافة تواريخ تبرعاتك السابقة وحساب موعد تبرعك القادم تلقائياً.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Community Registry History (Fulfilled Requests + Documented Donor Dates) */}
      {activeTab === 'registry' && (
        <div className="space-y-4">
          {/* Blood Type Filter */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 ml-2 flex items-center gap-1">
              <Search className="w-3.5 h-3.5" />
              <span>تصفية بالفصيلة:</span>
            </span>
            <button
              type="button"
              onClick={() => setBloodTypeFilter('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold border cursor-pointer ${
                bloodTypeFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              الكل
            </button>
            {BLOOD_TYPES.map((bt) => (
              <button
                key={bt}
                type="button"
                onClick={() => setBloodTypeFilter(bt)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold font-sans border cursor-pointer ${
                  bloodTypeFilter === bt
                    ? 'bg-rose-700 text-white border-rose-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {bt}
              </button>
            ))}
          </div>

          {/* Section A: Fulfilled Blood Requests */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 px-1">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
              <span>حالات تم توفير الدم لها ({fulfilledRequests.length})</span>
            </h3>

            {fulfilledRequests.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {fulfilledRequests.map((req) => (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => onSelectRequest(req)}
                    className="text-right bg-white p-4 rounded-3xl border border-emerald-200/80 hover:border-emerald-400 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)] cursor-pointer flex items-start gap-3"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-emerald-700 text-white font-sans font-black text-sm flex items-center justify-center shrink-0">
                      {req.bloodType}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{req.patientName}</h4>
                        <span className="text-[11px] font-bold text-emerald-700 shrink-0">تم التوفير</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Hospital className="w-3.5 h-3.5" />
                          {req.hospital}
                        </span>
                        <span className="flex items-center gap-1 font-sans">
                          <Calendar className="w-3.5 h-3.5" />
                          {req.requestDate}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-5 text-center border border-slate-200/80 text-xs text-slate-500">
                لا توجد طلبات مكتملة مطابقة للتصفية الحالية.
              </div>
            )}
          </div>

          {/* Section B: Donors with Documented Recent Donation Dates */}
          <div className="space-y-2.5 pt-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 px-1">
              <UserCheck className="w-4.5 h-4.5 text-rose-700" />
              <span>سجل آخر تبرعات المتبرعين المسجلين ({recentDonorsWithDates.length})</span>
            </h3>

            {recentDonorsWithDates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recentDonorsWithDates.map((donor) => (
                  <button
                    key={donor.id}
                    type="button"
                    onClick={() => onSelectDonor(donor)}
                    className="text-right bg-white p-4 rounded-3xl border border-slate-200/80 hover:border-rose-300 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)] cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-800 border border-rose-200 font-sans font-black text-sm flex items-center justify-center shrink-0">
                        {donor.bloodType}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{donor.fullName}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{donor.district} - {donor.area}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <span className="text-[10px] text-slate-400 block">آخر تبرع</span>
                      <span className="text-xs font-bold text-slate-800 font-sans">{donor.lastDonationDate}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-5 text-center border border-slate-200/80 text-xs text-slate-500">
                لا توجد تواريخ تبرع مسجلة لهذه الفصيلة حالياً.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
