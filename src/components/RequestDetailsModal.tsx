import React, { useState, useEffect } from 'react';
import { 
  X, 
  Phone, 
  MessageCircle, 
  Hospital, 
  MapPin, 
  Droplet, 
  Clock, 
  CheckCircle2, 
  AlertOctagon, 
  Share2, 
  Users, 
  Check, 
  Trash2,
  HeartHandshake,
  Send,
  User,
  Sparkles
} from 'lucide-react';
import { canDonorDonateToRequest } from '../services/storageService';
import { BloodRequest, Donor, UserRole, RequestStatus, UserAccount, BloodType } from '../types';
import { pushNotificationService, DonorResponseRecord } from '../services/pushNotificationService';

interface RequestDetailsModalProps {
  request: BloodRequest | null;
  onClose: () => void;
  role: UserRole;
  donors: Donor[];
  currentUser?: UserAccount | null;
  onUpdateRequestStatus: (req: BloodRequest, status: RequestStatus) => void;
  onDeleteRequest?: (id: string) => void;
  onSelectDonor?: (donor: Donor) => void;
  onTriggerToast?: (message: string) => void;
}

export const RequestDetailsModal: React.FC<RequestDetailsModalProps> = ({
  request,
  onClose,
  role,
  donors,
  currentUser,
  onUpdateRequestStatus,
  onDeleteRequest,
  onSelectDonor,
  onTriggerToast
}) => {
  if (!request) return null;

  const [copied, setCopied] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [responseName, setResponseName] = useState(currentUser?.fullName || '');
  const [responsePhone, setResponsePhone] = useState(currentUser?.phone || '');
  const [responseBloodType, setResponseBloodType] = useState<BloodType>(() => {
    if (currentUser?.linkedDonorId) {
      const matched = donors.find((d) => d.id === currentUser.linkedDonorId);
      if (matched) return matched.bloodType;
    }
    return 'O+';
  });
  const [responseDistrict, setResponseDistrict] = useState('مديرية قعطبة - المركز');
  const [existingResponses, setExistingResponses] = useState<DonorResponseRecord[]>([]);

  useEffect(() => {
    if (request) {
      const responses = pushNotificationService.getResponsesForRequest(request.id);
      setExistingResponses(responses);
      const userAlreadyResponded = responses.some(
        (r) => (currentUser && r.donorPhone === currentUser.phone) || r.donorPhone === responsePhone
      );
      setHasResponded(userAlreadyResponded);

      // Auto-populate response donor info from current user or linked donor
      if (currentUser) {
        setResponseName(currentUser.fullName);
        setResponsePhone(currentUser.phone);
        if (currentUser.linkedDonorId) {
          const matched = donors.find((d) => d.id === currentUser.linkedDonorId);
          if (matched) {
            setResponseBloodType(matched.bloodType);
            setResponseDistrict(matched.district);
          }
        }
      }
    }
  }, [request, currentUser, donors]);

  const cleanPhone = request.contactPhone ? request.contactPhone.replace(/[^0-9]/g, '') : '';
  const yemenPhone = cleanPhone ? (cleanPhone.startsWith('967') ? cleanPhone : `967${cleanPhone.replace(/^0+/, '')}`) : '';

  // Find compatible donors in the registry
  const compatibleDonors = donors.filter(
    (d) => d.isAvailable && canDonorDonateToRequest(d.bloodType, request.bloodType)
  );

  const isUserBloodCompatible = canDonorDonateToRequest(responseBloodType, request.bloodType);

  const handleShare = () => {
    const text = `🚨 نداء دم عاجل في قعطبة:\nالمريض: ${request.patientName}\nالفصيلة المطلوبة: ${request.bloodType}\nالعدد: ${request.unitsNeeded} وحدة\nالمستشفى: ${request.hospital} (${request.district})\nللتواصل: ${request.contactName} - ${request.contactPhone}\nالحالة: ${request.caseDetails}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRecordResponse = async (type: 'ready_to_donate' | 'contacted_phone' | 'contacted_whatsapp' = 'ready_to_donate') => {
    if (!responseName.trim() || !responsePhone.trim()) {
      if (onTriggerToast) onTriggerToast('يرجى إدخال اسمك ورقم هاتفك للتواصل معك');
      return;
    }

    setIsResponding(true);
    try {
      const record = await pushNotificationService.recordDonorResponse(
        request.id,
        {
          fullName: responseName.trim(),
          phone: responsePhone.trim(),
          bloodType: responseBloodType,
          district: responseDistrict
        },
        type
      );

      setHasResponded(true);
      setExistingResponses((prev) => [record, ...prev]);
      if (onTriggerToast) {
        onTriggerToast('جزاك الله خيراً! تم تسجيل استعدادك للتبرع، ويمكنك الآن الاتصال بمسؤول الحالة مباشرة 🩸');
      }
    } catch {
      if (onTriggerToast) onTriggerToast('تعذر تسجيل الاستجابة، يرجى الاتصال المباشر');
    } finally {
      setIsResponding(false);
    }
  };

  const getUrgencyBadge = () => {
    switch (request.urgency) {
      case 'critical':
        return { label: 'عاجل جداً وطارئ 🚨', bg: 'bg-red-500 text-white' };
      case 'urgent':
        return { label: 'عاجل ⚠️', bg: 'bg-amber-500 text-white' };
      case 'moderate':
        return { label: 'متوسط ⏳', bg: 'bg-sky-500 text-white' };
      default:
        return { label: 'عادي 🟢', bg: 'bg-emerald-500 text-white' };
    }
  };

  const urgencyBadge = getUrgencyBadge();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-rose-950 via-red-900 to-slate-900 p-5 text-white rounded-t-3xl border-b border-red-950/40">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${urgencyBadge.bg}`}>
                  {urgencyBadge.label}
                </span>
                <span className="text-[11px] bg-white/15 backdrop-blur-xs px-2.5 py-0.5 rounded-full text-rose-100">
                  {request.requestDate}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold leading-tight">{request.patientName}</h3>
              <p className="text-xs text-slate-300 mt-1">
                مسؤول الحالة: {request.contactName} • {request.contactPhone}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Main Direct Contact Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={`tel:${request.contactPhone}`}
              onClick={() => handleRecordResponse('contacted_phone')}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-98 transition-all"
            >
              <Phone className="w-4 h-4" />
              <span>اتصال بمسؤول الحالة</span>
            </a>
            <a
              href={`https://wa.me/${yemenPhone}?text=${encodeURIComponent(`السلام عليكم ورحمة الله، بخصوص نداء التبرع بالدم للمريض (${request.patientName}) فصيلة (${request.bloodType}) في مستشفى ${request.hospital} (${request.district}) عبر سجل قعطبة: أنا مستعد للتبرع ومتابعة الحالة.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleRecordResponse('contacted_whatsapp')}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-teal-600/20 active:scale-98 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span>مراسلة واتساب</span>
            </a>
          </div>

          {/* Cards for Blood Type & Units */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-rose-800 block">فصيلة الدم المطلوبة</span>
                <span className="text-2xl font-black font-sans text-rose-700">
                  {request.bloodType}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                <Droplet className="w-5 h-5 fill-white" />
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-700 block">عدد الوحدات</span>
                <span className="text-2xl font-black text-slate-900 font-sans">
                  {request.unitsNeeded}
                </span>
                <span className="text-[11px] text-slate-500 block">أكياس دم مطلوبة</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Card: Hospital */}
          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
            <div className="flex items-center gap-2 text-rose-600 mb-1">
              <Hospital className="w-4 h-4" />
              <span className="text-xs font-bold text-slate-800">المستشفى والمركز الطبي</span>
            </div>
            <p className="text-sm font-bold text-slate-800">{request.hospital}</p>
            {request.area && (
              <p className="text-xs text-slate-500 mt-0.5">القسم / الجناح / القرية: {request.area}</p>
            )}
          </div>

          {/* Card: Location */}
          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
            <div className="flex items-center gap-2 text-rose-600 mb-1">
              <MapPin className="w-4 h-4" />
              <span className="text-xs font-bold text-slate-800">الموقع الجغرافي</span>
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {request.district} - {request.area || 'مركز المدينة'}
            </p>
          </div>

          {/* Card: Case Details */}
          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
            <span className="text-xs font-bold text-slate-800 block mb-1">تفاصيل الحالة الطبية</span>
            <p className="text-xs text-slate-600 leading-relaxed">{request.caseDetails}</p>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* SPECIAL SECTION: الاستجابة لطلب التبرع كمتبرع جاهز ومستعد */}
          {/* ------------------------------------------------------------- */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-rose-50 via-red-50/50 to-orange-50 border-2 border-rose-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-800">
                <HeartHandshake className="w-5 h-5 text-rose-600" />
                <h4 className="text-sm font-bold">الاستجابة لطلب التبرع بالدم</h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                إنقاذ حياة 🩸
              </span>
            </div>

            {hasResponded ? (
              <div className="p-3 bg-white rounded-2xl border border-emerald-200 text-emerald-900 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <p className="text-xs font-bold">
                    جزاك الله خيراً! تم تسجيل استعدادك للتبرع لهذه الحالة بنجاح.
                  </p>
                </div>
                <p className="text-[11px] text-slate-600">
                  يرجى الاتصال بمسؤول الحالة مباشرة عبر الهاتف أو مراسلته عبر الواتساب لتأكيد موعد الذهاب إلى المستشفى.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-700 leading-relaxed">
                  هل أنت مستعد للتبرع بالدم للمريض ({request.patientName})؟ اضغط على الزر أدناه لتأكيد جاهزيتك والتواصل مع أسرته.
                </p>

                {/* Compatibility hint */}
                <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
                  isUserBloodCompatible
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  <Droplet className="w-4 h-4 shrink-0 fill-current" />
                  <span>
                    فصيلتك المسجلة ({responseBloodType}):{' '}
                    {isUserBloodCompatible
                      ? `متوافقة تماماً للتبرع لفصيلة المريض (${request.bloodType}) ✅`
                      : `يرجى الانتباه: طبياً فصيلة (${responseBloodType}) قد لا تتوافق مع فصيلة (${request.bloodType}).`}
                  </span>
                </div>

                {/* Donor quick details if not prefilled */}
                {(!currentUser || !currentUser.phone) && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="اسمك الكريم"
                      value={responseName}
                      onChange={(e) => setResponseName(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-rose-500"
                    />
                    <input
                      type="tel"
                      placeholder="رقم هاتفك (77...)"
                      value={responsePhone}
                      onChange={(e) => setResponsePhone(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-rose-500"
                    />
                  </div>
                )}

                <button
                  type="button"
                  disabled={isResponding}
                  onClick={() => handleRecordResponse('ready_to_donate')}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-600/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <HeartHandshake className="w-4 h-4" />
                  <span>{isResponding ? 'جارٍ تسجيل استجابتك...' : 'أنا جاهز ومستعد للتبرع لهذه الحالة الآن 🩸'}</span>
                </button>
              </div>
            )}

            {/* Existing Responses List for this Request */}
            {existingResponses.length > 0 && (
              <div className="pt-2 border-t border-rose-200/60">
                <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  المتبرعون المستجيبون لهذه الحالة ({existingResponses.length}):
                </span>
                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                  {existingResponses.map((res) => (
                    <div
                      key={res.id}
                      className="p-2 rounded-xl bg-white border border-rose-100 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 font-bold font-sans text-[10px] flex items-center justify-center">
                          {res.donorBloodType}
                        </span>
                        <div>
                          <p className="font-bold text-slate-800 text-[11px]">{res.donorName}</p>
                          <p className="text-[10px] text-slate-400">{res.district}</p>
                        </div>
                      </div>
                      <a
                        href={`tel:${res.donorPhone}`}
                        className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100"
                      >
                        اتصال بالمتبرع
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status Management: دورة حياة الطلب (جديد، قيد المتابعة، تم التوفير، ملغي) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">حالة دورة حياة الطلب</span>
                <span className="text-[11px] text-slate-500">
                  {request.status === 'fulfilled' ? 'تم توفير الدم بنجاح 🟢' :
                   request.status === 'in_progress' ? 'قيد المتابعة والبحث النشط ⏳' :
                   request.status === 'cancelled' ? 'الطلب ملغي ⚪' : 'طلب جديد 🚨'}
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                request.status === 'fulfilled' ? 'bg-emerald-100 text-emerald-800' :
                request.status === 'in_progress' ? 'bg-sky-100 text-sky-800' :
                request.status === 'cancelled' ? 'bg-slate-200 text-slate-700' : 'bg-rose-100 text-rose-800'
              }`}>
                {request.status === 'fulfilled' ? 'تم التوفير' :
                 request.status === 'in_progress' ? 'قيد المتابعة' :
                 request.status === 'cancelled' ? 'ملغي' : 'جديد'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => onUpdateRequestStatus(request, 'new')}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  request.status === 'new' || (!request.status || request.status === 'open')
                    ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                جديد 🚨
              </button>
              <button
                type="button"
                onClick={() => onUpdateRequestStatus(request, 'in_progress')}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  request.status === 'in_progress'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                قيد المتابعة ⏳
              </button>
              <button
                type="button"
                onClick={() => onUpdateRequestStatus(request, 'fulfilled')}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  request.status === 'fulfilled'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                تم التوفير ✅
              </button>
              <button
                type="button"
                onClick={() => onUpdateRequestStatus(request, 'cancelled')}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  request.status === 'cancelled'
                    ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ملغي ✕
              </button>
            </div>
          </div>

          {/* Matching Donors List in Registry */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-rose-600" />
                <h4 className="text-xs font-bold text-slate-900">
                  المتبرعون المتوافقون في قعطبة ({compatibleDonors.length})
                </h4>
              </div>
              <span className="text-[11px] text-slate-400">متاحون للتبرع الآن</span>
            </div>

            {compatibleDonors.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {compatibleDonors.slice(0, 5).map((d) => (
                  <div
                    key={d.id}
                    className="p-2.5 rounded-xl border border-slate-100 bg-white hover:border-rose-200 transition-all flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 font-sans font-bold text-xs flex items-center justify-center shrink-0">
                        {d.bloodType}
                      </span>
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-800 truncate">{d.fullName}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {d.district} • {d.area}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`tel:${d.phone}`}
                        className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors"
                        title="اتصال سريع"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                      {onSelectDonor && (
                        <button
                          onClick={() => {
                            onClose();
                            onSelectDonor(d);
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                        >
                          الملف
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-3 bg-slate-50 rounded-xl">
                لا يوجد حالياً متبرع متاح بفصيلة متوافقة مسجل في هذا النطاق، يرجى مشاركة النداء.
              </p>
            )}
          </div>

          {/* Share & Admin Actions */}
          <div className="pt-2 flex flex-col gap-2 border-t border-slate-100">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer w-full justify-center"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copied ? 'تم نسخ نداء الاستغاثة!' : 'مشاركة نداء الاستغاثة عبر الواتساب والمجموعات'}</span>
            </button>

            {role === 'admin' && onDeleteRequest && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`هل أنت متأكد من حذف طلب الدم للمريض (${request.patientName}) نهائياً؟`)) {
                    onDeleteRequest(request.id);
                    onClose();
                  }
                }}
                className="flex items-center justify-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors cursor-pointer border border-red-200/60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف هذا الطلب (صلاحية مسؤول)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
