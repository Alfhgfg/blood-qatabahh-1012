import React, { useState } from 'react';
import {
  PhoneCall,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Send,
  Droplet,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { UserAccount } from '../types';
import { firestoreService } from '../firebase/firestoreService';

interface ContactPageProps {
  currentUser: UserAccount;
  onOpenAddRequest: () => void;
  onTriggerToast: (msg: string) => void;
  onBack?: () => void;
}

const COORDINATOR_PHONE = '770236765';
const COORDINATOR_WA = '967770236765';
const COORDINATOR_EMAIL = 'abdulrahmanalshaiby2028@gmail.com';

export const ContactPage: React.FC<ContactPageProps> = ({
  currentUser,
  onOpenAddRequest,
  onTriggerToast,
  onBack
}) => {
  const [senderName, setSenderName] = useState(currentUser.fullName || '');
  const [senderPhone, setSenderPhone] = useState(currentUser.phone || '');
  const [subject, setSubject] = useState('استفسار عام حول التبرع بالدم');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim() || !senderPhone.trim() || !message.trim()) {
      onTriggerToast('يرجى كتابة الاسم ورقم الهاتف ونص الرسالة ⚠️');
      return;
    }

    try {
      setIsSending(true);
      await firestoreService.setNotification({
        id: `notif-contact-${Date.now()}`,
        title: `رسالة تواصل: ${subject}`,
        message: `من: ${senderName.trim()} (${senderPhone.trim()}) — ${message.trim()}`,
        time: 'الآن',
        type: 'system',
        read: false
      });
      setSentSuccess(true);
      setMessage('');
      onTriggerToast('تم إرسال رسالتك إلى إدارة سجل قعطبة بنجاح ✅');
    } catch {
      onTriggerToast('تعذر حفظ الرسالة في السحابة، يمكنك التواصل مباشرة عبر واتساب أو الهاتف');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-5 pb-24 font-['Cairo',sans-serif]">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
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
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <PhoneCall className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">اتصل بنا</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              قنوات التواصل والتنسيق المباشر مع إدارة سجل المتبرعين بالدم في قعطبة
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenAddRequest}
          className="px-4 py-2.5 rounded-2xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 self-start sm:self-auto"
        >
          <Droplet className="w-4 h-4 fill-rose-200" />
          <span>رفع نداء دم عاجل</span>
        </button>
      </div>

      {/* Direct Contact Channels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <a
          href={`tel:${COORDINATOR_PHONE}`}
          className="bg-white hover:bg-emerald-50/40 p-4.5 rounded-3xl border border-slate-200/80 hover:border-emerald-300 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 block">الهاتف المباشر للتنسيق</span>
              <span className="text-sm font-black text-slate-900 font-sans" dir="ltr">
                {COORDINATOR_PHONE}
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-700">اضغط للاتصال الهاتفي ←</span>
        </a>

        <a
          href={`https://wa.me/${COORDINATOR_WA}?text=${encodeURIComponent('السلام عليكم، أتواصل معكم عبر تطبيق سجل المتبرعين بالدم - مديرية قعطبة')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white hover:bg-teal-50/40 p-4.5 rounded-3xl border border-slate-200/80 hover:border-teal-300 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 block">تواصل سريع عبر واتساب</span>
              <span className="text-sm font-black text-slate-900 font-sans" dir="ltr">
                +967 {COORDINATOR_PHONE}
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-teal-700">فتح محادثة واتساب ←</span>
        </a>

        <a
          href={`mailto:${COORDINATOR_EMAIL}`}
          className="bg-white hover:bg-sky-50/40 p-4.5 rounded-3xl border border-slate-200/80 hover:border-sky-300 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-500 block">البريد الإلكتروني الرسمي</span>
              <span className="text-xs font-bold text-slate-900 font-sans truncate block" dir="ltr">
                {COORDINATOR_EMAIL}
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-sky-700">إرسال بريد إلكتروني ←</span>
        </a>
      </div>

      {/* Location & Availability */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold">مركز التنسيق الميداني</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              مديرية قعطبة – محافظة الضالع · تنسيق الحالات الطارئة في المستشفيات والمراكز الصحية بالمديرية
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-rose-200 shrink-0">
          <Clock className="w-4 h-4" />
          <span>استجابة على مدار 24 ساعة للحالات الحرجة</span>
        </div>
      </div>

      {/* Direct Message Form */}
      <form
        onSubmit={handleSubmitMessage}
        className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4"
      >
        <div>
          <h3 className="text-base font-bold text-slate-900">إرسال رسالة أو بلاغ إلى الإدارة</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            تُحفظ رسالتك مباشرة في لوحة تنبيهات النظام ليتم مراجعتها والتواصل معك
          </p>
        </div>

        {sentSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>تم استلام رسالتك وحفظها بنجاح، سيتواصل معك فريق التنسيق في أقرب وقت.</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل</label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-rose-600"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف للتواصل</label>
            <input
              type="tel"
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value)}
              dir="ltr"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-rose-600 text-right"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">موضوع الرسالة</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-hidden focus:border-rose-600"
          >
            <option value="استفسار عام حول التبرع بالدم">استفسار عام حول التبرع بالدم</option>
            <option value="تحديث أو تصحيح بيانات متبرع">تحديث أو تصحيح بيانات متبرع</option>
            <option value="تنسيق حالة طارئة أو حملة تبرع">تنسيق حالة طارئة أو حملة تبرع</option>
            <option value="ملاحظات تقنية واقتراحات">ملاحظات تقنية واقتراحات</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">نص الرسالة</label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="اكتب رسالتك أو استفسارك هنا..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-rose-600"
            required
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <a
            href={`https://wa.me/${COORDINATOR_WA}?text=${encodeURIComponent(`${subject}\nالاسم: ${senderName}\nالهاتف: ${senderPhone}\n${message}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>إرسال عبر واتساب</span>
          </a>

          <button
            type="submit"
            disabled={isSending}
            className="px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{isSending ? 'جاري الإرسال...' : 'إرسال الرسالة'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
