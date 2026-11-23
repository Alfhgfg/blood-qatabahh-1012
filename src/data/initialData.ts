import { BloodRequest, District, Donor, AppNotification } from '../types';

export const INITIAL_DISTRICTS: District[] = [
  {
    id: 'dist-1',
    name: 'مديرية قعطبة - المركز',
    areas: ['مركز المدينة', 'سوق قعطبة', 'حي النصر', 'حي السلام', 'المحطة', 'السهده', 'دار السلام']
  },
  {
    id: 'dist-2',
    name: 'قعطبة الشمالية',
    areas: ['الجبارة', 'القرين', 'صولان', 'الجعديات', 'يعيس', 'القهرة', 'العرفاف', 'حبيل السوق']
  },
  {
    id: 'dist-3',
    name: 'الفاخر',
    areas: ['سوق الفاخر', 'حبيل العبدي', 'مرخزة', 'سليم', 'القفلة', 'باب غلق']
  },
  {
    id: 'dist-4',
    name: 'سناح',
    areas: ['سوق سناح', 'الوبح', 'القبة', 'خوبر', 'لكمة الدوكي']
  },
  {
    id: 'dist-5',
    name: 'حمر وشخب',
    areas: ['شخب', 'حمر السادة', 'حمر القوز', 'دار السيد', 'بيت الشوكي']
  },
  {
    id: 'dist-6',
    name: 'نقيل الشيم وريشان',
    areas: ['نقيل الشيم', 'ريشان', 'كنه', 'الحقف', 'حمام الفردوس']
  }
];

export const INITIAL_DONORS: Donor[] = [
  {
    id: 'donor-1',
    fullName: 'عبدالله محمد صالح القحطبي',
    phone: '771234567',
    bloodType: 'O+',
    district: 'مديرية قعطبة - المركز',
    area: 'حي السلام',
    isAvailable: true,
    lastDonationDate: '2026-06-15',
    notes: 'متبرع منتظم، جاهز في أي وقت طارئ',
    createdAt: '2026-08-01T10:00:00Z'
  },
  {
    id: 'donor-2',
    fullName: 'صخر عبدالكريم القعطبي',
    phone: '734567890',
    bloodType: 'O-',
    district: 'قعطبة الشمالية',
    area: 'الجبارة',
    isAvailable: true,
    lastDonationDate: '2026-05-10',
    notes: 'فصيلة نادرة معطاء عام',
    createdAt: '2026-08-05T12:30:00Z'
  },
  {
    id: 'donor-3',
    fullName: 'أحمد فضل المنصوب',
    phone: '773456789',
    bloodType: 'A+',
    district: 'مديرية قعطبة - المركز',
    area: 'سوق قعطبة',
    isAvailable: true,
    lastDonationDate: '2026-07-20',
    notes: 'متواجد بالقرب من مستشفى السلام',
    createdAt: '2026-08-10T09:15:00Z'
  },
  {
    id: 'donor-4',
    fullName: 'جمال يحيى الشعيبي',
    phone: '712398745',
    bloodType: 'B+',
    district: 'سناح',
    area: 'سوق سناح',
    isAvailable: true,
    lastDonationDate: '2026-08-25',
    notes: 'لديه وسيلة مواصلات سريعة',
    createdAt: '2026-08-12T14:00:00Z'
  },
  {
    id: 'donor-5',
    fullName: 'وضاح ناصر الفاخري',
    phone: '770987654',
    bloodType: 'AB+',
    district: 'الفاخر',
    area: 'حبيل العبدي',
    isAvailable: true,
    lastDonationDate: '2026-04-12',
    notes: 'مستقبل عام، مستعد للتبرع لجميع فصائل AB',
    createdAt: '2026-08-15T16:20:00Z'
  },
  {
    id: 'donor-6',
    fullName: 'ماجد علي الشوكي',
    phone: '737890123',
    bloodType: 'A-',
    district: 'حمر وشخب',
    area: 'بيت الشوكي',
    isAvailable: false,
    lastDonationDate: '2026-09-28',
    notes: 'تبرع مؤخراً - يحتاج فترة راحة أسبوعين للجاهزية التامة',
    createdAt: '2026-08-18T11:45:00Z'
  },
  {
    id: 'donor-7',
    fullName: 'سيف الدين قاسم الرياشي',
    phone: '775678123',
    bloodType: 'B-',
    district: 'نقيل الشيم وريشان',
    area: 'ريشان',
    isAvailable: true,
    lastDonationDate: '2026-06-01',
    notes: 'فصيلة نادرة جداً',
    createdAt: '2026-08-20T08:00:00Z'
  },
  {
    id: 'donor-8',
    fullName: 'ردفان عبدالرحمن مسعد',
    phone: '716543210',
    bloodType: 'O+',
    district: 'قعطبة الشمالية',
    area: 'القرين',
    isAvailable: true,
    lastDonationDate: '2026-07-04',
    notes: 'متطوع ناشط في قوافل الإغاثة الطبية',
    createdAt: '2026-08-22T13:10:00Z'
  },
  {
    id: 'donor-9',
    fullName: 'هشام صالح النجار',
    phone: '778901234',
    bloodType: 'AB-',
    district: 'مديرية قعطبة - المركز',
    area: 'حي النصر',
    isAvailable: true,
    lastDonationDate: '2026-03-15',
    notes: 'فصيلة سالبة نادرة',
    createdAt: '2026-08-25T17:00:00Z'
  },
  {
    id: 'donor-10',
    fullName: 'بشير علوي سليم',
    phone: '739012345',
    bloodType: 'O-',
    district: 'الفاخر',
    area: 'سليم',
    isAvailable: true,
    lastDonationDate: '2026-07-15',
    notes: 'جاهز للحالات الحرجة',
    createdAt: '2026-09-01T10:00:00Z'
  }
];

export const INITIAL_REQUESTS: BloodRequest[] = [
  {
    id: 'req-1',
    patientName: 'الطفل أيمن خالد القعطبي',
    bloodType: 'O-',
    unitsNeeded: 2,
    hospital: 'مستشفى السلام التخصصي - قعطبة',
    district: 'مديرية قعطبة - المركز',
    area: 'مركز المدينة',
    urgency: 'critical',
    status: 'open',
    contactName: 'والد الطفل (خالد القعطبي)',
    contactPhone: '777443322',
    caseDetails: 'حالة نزيف حاد أثر عملية جراحية طارئة، يحتاج وحدتين فصيلة O سالبة فوراً.',
    requestDate: '2026-10-22',
    createdAt: '2026-10-22T08:30:00Z'
  },
  {
    id: 'req-2',
    patientName: 'أم عبدالملك القحطبي',
    bloodType: 'A+',
    unitsNeeded: 3,
    hospital: 'مستشفى النصر العام - الضالع',
    district: 'سناح',
    area: 'سوق سناح',
    urgency: 'critical',
    status: 'open',
    contactName: 'أخ المريضة (مصلح القحطبي)',
    contactPhone: '733221144',
    caseDetails: 'عملية ولادة قيصرية مع انخفاض حاد في خضاب الدم (الهيموجلوبين 6.5).',
    requestDate: '2026-10-22',
    createdAt: '2026-10-22T10:15:00Z'
  },
  {
    id: 'req-3',
    patientName: 'طارق عبدالسلام الحالمي',
    bloodType: 'B+',
    unitsNeeded: 1,
    hospital: 'مستوصف قعطبة الخيري',
    district: 'مديرية قعطبة - المركز',
    area: 'حي السلام',
    urgency: 'urgent',
    status: 'open',
    contactName: 'ابن عمه (عادل الحالمي)',
    contactPhone: '711998877',
    caseDetails: 'مريض ثلاسيميا بحاجة لتجديد كيس دم بصورة منتظمة اليوم.',
    requestDate: '2026-10-21',
    createdAt: '2026-10-21T16:00:00Z'
  },
  {
    id: 'req-4',
    patientName: 'فيصل عبده ناجي الشوكي',
    bloodType: 'AB+',
    unitsNeeded: 2,
    hospital: 'مستشفى التضامن التخصصي',
    district: 'حمر وشخب',
    area: 'بيت الشوكي',
    urgency: 'moderate',
    status: 'fulfilled',
    contactName: 'شقيقه (جميل الشوكي)',
    contactPhone: '772334455',
    caseDetails: 'تم توفير الدم بنجاح بفضل متبرعي منطقة مديرية قعطبة.',
    requestDate: '2026-10-19',
    createdAt: '2026-10-19T11:20:00Z'
  }
];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    title: 'طلب دم عاجل جداً في قعطبة 🚨',
    message: 'احتياج طارئ لـ وحدتين من فصيلة O- بمستشفى السلام التخصصي للطفل أيمن خالد.',
    time: 'منذ ساعة',
    type: 'urgent',
    read: false,
    linkPage: 'requests',
    itemId: 'req-1'
  },
  {
    id: 'notif-2',
    title: 'طلب دم عاجل A+ 🩸',
    message: 'حالة ولادة طارئة بمستشفى النصر العام بحاجة لـ 3 وحدات فصيلة A+.',
    time: 'منذ ساعتين',
    type: 'urgent',
    read: false,
    linkPage: 'requests',
    itemId: 'req-2'
  },
  {
    id: 'notif-3',
    title: 'سجل المتبرعين جاهز للعمل بدون إنترنت 🟢',
    message: 'تم تفعيل التخزين المحلي الآمن بنجاح. يمكنك استعراض المتبرعين والطلبات حتى بدون شبكة.',
    time: 'اليوم',
    type: 'system',
    read: true,
    linkPage: 'home'
  }
];
