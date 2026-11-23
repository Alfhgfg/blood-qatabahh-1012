import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Droplet, 
  MapPin, 
  Trash2, 
  RefreshCw, 
  Download, 
  Upload, 
  Search, 
  Phone, 
  ChevronLeft, 
  Lock, 
  FileSpreadsheet, 
  Mail, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  KeyRound, 
  Save, 
  Check, 
  Server, 
  HelpCircle,
  Eye,
  EyeOff,
  UserCog,
  UserCheck,
  UserX,
  Edit3,
  UserPlus,
  Megaphone,
  History,
  AlertTriangle,
  LogOut,
  PieChart,
  BarChart3,
  Sliders,
  Sparkles,
  Bell,
  Smartphone,
  Radio,
  MessageSquare,
  MessageCircle,
  Navigation,
  Compass,
  Hospital as HospitalIcon,
  Stethoscope,
  ArrowUpCircle,
  Loader2,
  X,
  ArrowRight
} from 'lucide-react';
import { 
  BloodRequest, 
  Donor, 
  UserRole, 
  ActivePage, 
  RequestStatus, 
  ExportLog, 
  AdminSettings, 
  UserAccount,
  BloodType,
  Announcement,
  AuditLog,
  WhatsAppDispatch,
  HospitalAd,
  Hospital,
  Doctor,
  AppUpdateConfig
} from '../types';
import { storageService, MASTER_ADMIN_EMAIL } from '../services/storageService';
import { firestoreService } from '../firebase/firestoreService';
import { pushNotificationService } from '../services/pushNotificationService';
import { exportDonorsToExcel } from '../services/excelExportService';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { AdminHospitalAdsTab } from '../components/AdminHospitalAdsTab';
import { AdminHospitalsDoctorsTab } from '../components/AdminHospitalsDoctorsTab';
import { appUpdateService } from '../services/appUpdateService';
import { createDefaultAppUpdateConfig } from '../lib/appUpdateValidator.js';
import { summarizeUsersDirectory, UserDirectorySummary } from '../lib/userDirectoryUtils.js';
import { useRegisterBackHandler } from '../services/backHandlerRegistry';

interface AdminDashboardPageProps {
  role: UserRole;
  donors: Donor[];
  requests: BloodRequest[];
  onNavigate: (page: ActivePage) => void;
  onOpenRoleModal: () => void;
  onDeleteDonor: (id: string) => Promise<void> | void;
  onDeleteAllDonors?: () => Promise<void> | void;
  onToggleDonorAvailability: (donor: Donor) => void;
  onEditDonor?: (donor: Donor) => void;
  onOpenAddDonor?: () => void;
  onUpdateRequestStatus: (req: BloodRequest, status: RequestStatus) => void;
  onDeleteRequest: (id: string) => void;
  onExportBackup: () => void;
  onImportBackup: (fileContent: string) => void;
  onResetDefaults: () => void;
  onSelectDonor: (donor: Donor) => void;
  onSelectRequest: (req: BloodRequest) => void;
  onOpenImportModal?: () => void;
  onLogout?: () => void;
  currentUser?: UserAccount | null;
  hospitalAds?: HospitalAd[];
  onHospitalAdsChange?: (ads: HospitalAd[]) => void;
  hospitals?: Hospital[];
  doctors?: Doctor[];
  onHospitalsChange?: (hospitals: Hospital[]) => void;
  onDoctorsChange?: (doctors: Doctor[]) => void;
  isActive?: boolean;
  onBack?: () => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  role,
  donors,
  requests,
  onNavigate,
  onOpenRoleModal,
  onDeleteDonor,
  onDeleteAllDonors,
  onToggleDonorAvailability,
  onEditDonor,
  onOpenAddDonor,
  onUpdateRequestStatus,
  onDeleteRequest,
  onExportBackup,
  onImportBackup,
  onResetDefaults,
  onSelectDonor,
  onSelectRequest,
  onOpenImportModal,
  onLogout,
  currentUser,
  hospitalAds = [],
  onHospitalAdsChange,
  hospitals = [],
  doctors = [],
  onHospitalsChange,
  onDoctorsChange,
  isActive = true,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'donors' | 'requests' | 'announcements' | 'hospitalAds' | 'hospitalsDoctors' | 'fcm' | 'whatsapp' | 'users' | 'audit' | 'excel' | 'security' | 'system'>('stats');
  
  // Searches
  const [donorSearch, setDonorSearch] = useState('');
  const [requestSearch, setRequestSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [donorBloodFilter, setDonorBloodFilter] = useState<string>('all');

  // FCM Push Notifications State
  const [fcmStats, setFcmStats] = useState<any>({
    total: 0,
    active: 0,
    androidCount: 0,
    webCount: 0,
    byBloodType: {},
    byDistrict: {},
    devices: [],
    fcmReady: true,
    projectId: 'avian-gate-pbcxw'
  });
  const [isLoadingFcmStats, setIsLoadingFcmStats] = useState(false);
  const [customPushTitle, setCustomPushTitle] = useState('');
  const [customPushMessage, setCustomPushMessage] = useState('');
  const [customPushBloodType, setCustomPushBloodType] = useState<string>('all');
  const [customPushDistrict, setCustomPushDistrict] = useState<string>('all');
  const [customPushUrgency, setCustomPushUrgency] = useState<'critical' | 'urgent' | 'moderate' | 'normal'>('critical');
  const [customPushTargetPage, setCustomPushTargetPage] = useState<string>('requests');
  const [isSendingCustomPush, setIsSendingCustomPush] = useState(false);
  const [customPushResult, setCustomPushResult] = useState<string | null>(null);
  const [testPushLoading, setTestPushLoading] = useState(false);

  // WhatsApp Business Cloud API State
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppDispatch[]>([]);
  const [whatsappStats, setWhatsappStats] = useState<any>({ total: 0, simulatedCount: 0, sentCount: 0, skippedDuplicateCount: 0, failedCount: 0 });
  const [isLoadingWhatsApp, setIsLoadingWhatsApp] = useState(false);
  const [whatsappForm, setWhatsappForm] = useState({
    enabled: true,
    phoneNumberId: '',
    accessToken: '',
    simulateMode: true,
    maxRecipients: 10
  });
  const [isSavingWhatsAppSettings, setIsSavingWhatsAppSettings] = useState(false);
  const [whatsappSaveSuccess, setWhatsappSaveSuccess] = useState('');
  
  // WhatsApp Matching & Proximity Simulator State
  const [simBloodType, setSimBloodType] = useState<BloodType>('O-');
  const [simDistrict, setSimDistrict] = useState<string>('مديرية قعطبة - المركز');
  const [simArea, setSimArea] = useState<string>('مركز المدينة');
  const [simPatientName, setSimPatientName] = useState<string>('أيمن خالد القعطبي');
  const [simHospital, setSimHospital] = useState<string>('مستشفى السلام التخصصي - قعطبة');
  const [simUnits, setSimUnits] = useState<number>(2);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  // Registered Users State
  const [registeredUsers, setRegisteredUsers] = useState<UserAccount[]>([]);
  const [userDirectorySummary, setUserDirectorySummary] = useState<UserDirectorySummary | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userActionMessage, setUserActionMessage] = useState('');

  const effectiveUserSummary = useMemo(
    () => userDirectorySummary || summarizeUsersDirectory(registeredUsers),
    [userDirectorySummary, registeredUsers]
  );

  // Announcements State
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnType, setNewAnnType] = useState<'urgent' | 'info' | 'campaign'>('urgent');
  const [isSubmittingAnn, setIsSubmittingAnn] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [selectedAuditIds, setSelectedAuditIds] = useState<string[]>([]);
  const [auditDeleteModal, setAuditDeleteModal] = useState<{
    mode: 'single' | 'selected' | 'all';
    targetLog?: AuditLog;
  } | null>(null);
  const [isDeletingAuditLogs, setIsDeletingAuditLogs] = useState(false);
  const [auditNotice, setAuditNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useRegisterBackHandler(
    'admin-audit-delete-modal',
    isActive && Boolean(auditDeleteModal),
    () => {
      if (!isDeletingAuditLogs) {
        setAuditDeleteModal(null);
      }
    },
    30
  );

  // Bulk Delete All Donors Modal State
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteAllConfirmationText, setDeleteAllConfirmationText] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  useRegisterBackHandler(
    'admin-delete-all-modal',
    isActive && showDeleteAllModal,
    () => {
      if (!isDeletingAll) {
        setShowDeleteAllModal(false);
      }
    },
    30
  );

  // Excel & Email Settings State
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({
    recipientEmail: 'abdulrahmanalshaiby2028@gmail.com',
    dailyExportHour: 8,
    dailyExportMinute: 0,
    autoExportEnabled: true,
    recoveryCode: ''
  });
  const [exportLogs, setExportLogs] = useState<ExportLog[]>([]);
  const [isExportingNow, setIsExportingNow] = useState(false);
  const [isDirectExporting, setIsDirectExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  // SMTP Settings
  const [smtpForm, setSmtpForm] = useState({
    host: '',
    port: 587,
    user: '',
    pass: '',
    secure: false,
    from: 'qaatabah-blood-registry@yemen.org'
  });
  const [showSmtpSettings, setShowSmtpSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState('');

  // Password Change State
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  // Recovery Config State
  const [recoveryCode, setRecoveryCode] = useState('');
  const [showAdminRecoveryCode, setShowAdminRecoveryCode] = useState(false);

  // Email Verification State
  const [isSendingVerificationEmail, setIsSendingVerificationEmail] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<{ success: boolean; text: string } | null>(null);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(() => Boolean(auth.currentUser?.emailVerified));
  const [adminDisplayEmail, setAdminDisplayEmail] = useState<string>(() => auth.currentUser?.email || MASTER_ADMIN_EMAIL);
  const [hasFirebaseAuthSession, setHasFirebaseAuthSession] = useState<boolean>(() => Boolean(auth.currentUser));
  const [isAuthenticatingGoogleAdmin, setIsAuthenticatingGoogleAdmin] = useState(false);

  // App Update Management State
  const [appUpdateConfig, setAppUpdateConfig] = useState<AppUpdateConfig>(() => createDefaultAppUpdateConfig());
  const [isLoadingAppUpdate, setIsLoadingAppUpdate] = useState(false);
  const [isSavingAppUpdate, setIsSavingAppUpdate] = useState(false);
  const [appUpdateNotice, setAppUpdateNotice] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setHasFirebaseAuthSession(Boolean(fbUser));
      setIsEmailVerified(Boolean(fbUser?.emailVerified));
      if (fbUser?.email) {
        setAdminDisplayEmail(fbUser.email);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load Settings, Users, Announcements, and Audit Logs
  useEffect(() => {
    if (role === 'admin') {
      loadSettingsAndLogs();
      loadAnnouncementsAndAudit();
      checkAdminVerification();
    }
  }, [role]);

  // Real-time Firebase subscription for Audit Logs & counter
  useEffect(() => {
    if (role !== 'admin') return;
    const unsubscribe = firestoreService.subscribeAuditLogs(
      (liveLogs) => {
        setAuditLogs(liveLogs);
        setSelectedAuditIds((prev) => {
          if (prev.length === 0) return prev;
          const validSet = new Set(liveLogs.map((l) => l.docId || l.id));
          const filtered = prev.filter((id) => validSet.has(id));
          return filtered.length === prev.length ? prev : filtered;
        });
      },
      (err) => {
        console.warn('Audit logs live subscription notice:', err?.message || err);
      }
    );
    return () => unsubscribe();
  }, [role]);

  // Real-time Firebase subscription for Registered Users & total counter
  useEffect(() => {
    if (role !== 'admin') return;
    setIsLoadingUsers(true);
    const unsubscribe = storageService.subscribeRegisteredUsers(
      (liveUsers, summary) => {
        setRegisteredUsers(liveUsers);
        setUserDirectorySummary(summary);
        setIsLoadingUsers(false);
      },
      () => {
        setIsLoadingUsers(false);
      }
    );
    return () => unsubscribe();
  }, [role]);

  const isAllAuditSelected =
    auditLogs.length > 0 && auditLogs.every((log) => selectedAuditIds.includes(log.docId || log.id));

  const toggleSelectAuditLog = (id: string) => {
    setSelectedAuditIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllAuditLogs = () => {
    if (isAllAuditSelected) {
      setSelectedAuditIds([]);
    } else {
      setSelectedAuditIds(auditLogs.map((log) => log.docId || log.id));
    }
  };

  const handleConfirmDeleteAuditLogs = async () => {
    if (!auditDeleteModal) return;
    setIsDeletingAuditLogs(true);
    setAuditNotice(null);

    try {
      if (auditDeleteModal.mode === 'single' && auditDeleteModal.targetLog) {
        const targetId = auditDeleteModal.targetLog.docId || auditDeleteModal.targetLog.id;
        await storageService.deleteAuditLog(targetId);
        setSelectedAuditIds((prev) => prev.filter((id) => id !== targetId));
        setAuditNotice({ type: 'success', text: 'تم حذف العملية المحددة من قاعدة بيانات Firebase بنجاح.' });
      } else if (auditDeleteModal.mode === 'selected') {
        const idsToDelete = [...selectedAuditIds];
        await storageService.deleteAuditLogs(idsToDelete);
        setSelectedAuditIds([]);
        setAuditNotice({
          type: 'success',
          text: `تم حذف (${idsToDelete.length}) سجل من قاعدة بيانات Firebase بنجاح.`
        });
      } else if (auditDeleteModal.mode === 'all') {
        await storageService.deleteAllAuditLogs();
        setSelectedAuditIds([]);
        setAuditNotice({ type: 'success', text: 'تم حذف جميع سجلات العمليات من قاعدة بيانات Firebase بنجاح.' });
      }
      setAuditDeleteModal(null);
      const freshLogs = await storageService.getAuditLogs().catch(() => null);
      if (freshLogs) {
        setAuditLogs(freshLogs);
      }
    } catch (err: any) {
      setAuditNotice({
        type: 'error',
        text: err?.message || 'تعذر تنفيذ عملية الحذف من قاعدة بيانات Firebase.'
      });
      setAuditDeleteModal(null);
    } finally {
      setIsDeletingAuditLogs(false);
    }
  };

  const handleVerifyCentralAdminWithGoogle = async () => {
    setAuditNotice(null);
    setIsAuthenticatingGoogleAdmin(true);
    try {
      const res = await storageService.loginAdminWithGoogle();
      if (res.success) {
        setHasFirebaseAuthSession(Boolean(auth.currentUser));
        setIsEmailVerified(Boolean(auth.currentUser?.emailVerified));
        if (auth.currentUser?.email) {
          setAdminDisplayEmail(auth.currentUser.email);
        }
        setAuditNotice({
          type: 'success',
          text: 'تم توثيق جلسة المسؤول المركزي عبر Firebase Auth بنجاح، يمكنك الآن حذف السجلات مباشرة من Firestore.'
        });
      } else {
        setAuditNotice({
          type: 'error',
          text: res.error || 'تعذر توثيق جلسة المسؤول المركزي عبر Google.'
        });
      }
    } finally {
      setIsAuthenticatingGoogleAdmin(false);
    }
  };

  const checkAdminVerification = async () => {
    try {
      const res = await storageService.checkEmailVerificationStatus();
      if (res.success) {
        setIsEmailVerified(res.emailVerified);
        if (res.email) setAdminDisplayEmail(res.email);
      }
    } catch {}
  };

  const loadAnnouncementsAndAudit = async () => {
    try {
      const anns = await storageService.getAnnouncements();
      setAnnouncements(anns);
    } catch {}
    try {
      setIsLoadingAudit(true);
      const logs = await storageService.getAuditLogs();
      setAuditLogs(logs);
    } catch {} finally {
      setIsLoadingAudit(false);
    }
  };

  const loadSettingsAndLogs = async () => {
    const settings = await storageService.getAdminSettings();
    if (settings) {
      setAdminSettings(settings);
      setSmtpForm({
        host: settings.smtpHost || '',
        port: settings.smtpPort || 587,
        user: settings.smtpUser || '',
        pass: '',
        secure: Boolean(settings.smtpSecure),
        from: settings.smtpFrom || 'qaatabah-blood-registry@yemen.org'
      });
      setRecoveryCode(settings.recoveryCode || '');
      setWhatsappForm({
        enabled: settings.whatsappEnabled !== false,
        phoneNumberId: settings.whatsappPhoneNumberId || '',
        accessToken: '',
        simulateMode: settings.whatsappSimulateMode !== false,
        maxRecipients: settings.whatsappMaxRecipients || 10
      });
    }

    const logs = await storageService.getExportLogs();
    setExportLogs(logs);

    try {
      const waData = await storageService.getWhatsAppLogs();
      setWhatsappLogs(waData.logs || []);
      setWhatsappStats(waData);
    } catch {}

    try {
      setIsLoadingUsers(true);
      const users = await storageService.getRegisteredUsers();
      setRegisteredUsers(users);
    } catch {} finally {
      setIsLoadingUsers(false);
    }

    try {
      setIsLoadingAppUpdate(true);
      const latest = await appUpdateService.fetchLatestUpdateConfig();
      if (latest.config) {
        setAppUpdateConfig(latest.config);
      }
    } catch {} finally {
      setIsLoadingAppUpdate(false);
    }
  };

  const handleSaveAppUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setAppUpdateNotice(null);
    setIsSavingAppUpdate(true);
    try {
      const actor = currentUser?.email || adminDisplayEmail || 'admin';
      const result = await appUpdateService.saveUpdateConfig(appUpdateConfig, actor);
      if (result.success && result.config) {
        setAppUpdateConfig(result.config);
        setAppUpdateNotice({
          success: true,
          text: 'تم حفظ ونشر إعدادات تحديث التطبيق بنجاح. سيظهر التحديث تلقائياً للمستخدمين عند التحقق.'
        });
      } else {
        setAppUpdateNotice({
          success: false,
          text: result.error || 'تعذر حفظ إعدادات التحديث.'
        });
      }
    } catch (err: any) {
      setAppUpdateNotice({
        success: false,
        text: err?.message || 'حدث خطأ أثناء حفظ إعدادات التحديث.'
      });
    } finally {
      setIsSavingAppUpdate(false);
    }
  };

  // If role is not admin, show access restricted prompt
  if (role !== 'admin') {
    return (
      <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 text-center border border-slate-800 shadow-xl max-w-lg mx-auto my-12 space-y-4 font-['Cairo',sans-serif]">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-inner">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-white">منطقة محمية: لوحة تحكم المسؤول</h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          هذا القسم مخصص حصرياً للمسؤولين المعتمدين لمراجعة السجلات، وتعديل وحذف البيانات، وإدارة الحسابات. لا يُسمح للمستخدم العادي بالوصول هنا.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
          >
            العودة للرئيسية
          </button>
          <button
            onClick={onOpenRoleModal}
            className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>تسجيل دخول المسؤول</span>
          </button>
        </div>
      </div>
    );
  }

  // Blood types breakdown calculation
  const bloodTypeCounts: Record<BloodType, { total: number; available: number }> = {
    'O+': { total: 0, available: 0 },
    'O-': { total: 0, available: 0 },
    'A+': { total: 0, available: 0 },
    'A-': { total: 0, available: 0 },
    'B+': { total: 0, available: 0 },
    'B-': { total: 0, available: 0 },
    'AB+': { total: 0, available: 0 },
    'AB-': { total: 0, available: 0 }
  };

  donors.forEach((d) => {
    if (bloodTypeCounts[d.bloodType]) {
      bloodTypeCounts[d.bloodType].total++;
      if (d.isAvailable) bloodTypeCounts[d.bloodType].available++;
    }
  });

  const availableCount = donors.filter((d) => d.isAvailable).length;
  const criticalRequestsCount = requests.filter((r) => r.status === 'open' && r.urgency === 'critical').length;
  const openRequestsCount = requests.filter((r) => r.status === 'open').length;

  const filteredDonors = donors.filter((d) => {
    const q = donorSearch.toLowerCase();
    const matchesSearch = 
      d.fullName.toLowerCase().includes(q) ||
      d.phone.includes(q) ||
      d.district.includes(q) ||
      d.area.includes(q);
    const matchesBlood = donorBloodFilter === 'all' || d.bloodType === donorBloodFilter;
    return matchesSearch && matchesBlood;
  });

  const filteredRequests = requests.filter(
    (r) =>
      r.patientName.toLowerCase().includes(requestSearch.toLowerCase()) ||
      r.hospital.includes(requestSearch) ||
      r.bloodType.includes(requestSearch) ||
      r.district.includes(requestSearch)
  );

  // Bulk Delete All Donors
  const handleExecuteDeleteAll = async () => {
    if (deleteAllConfirmationText.trim() !== 'تأكيد الحذف الكامل') {
      alert('يرجى كتابة عبارة "تأكيد الحذف الكامل" بدقة للمتابعة');
      return;
    }

    try {
      setIsDeletingAll(true);
      if (onDeleteAllDonors) {
        await onDeleteAllDonors();
      } else {
        await storageService.deleteAllDonors();
      }
      setIsDeletingAll(false);
      setShowDeleteAllModal(false);
      setDeleteAllConfirmationText('');
      setUserActionMessage('تم حذف وتصفير جميع المتبرعين بنجاح ✅');
      setTimeout(() => setUserActionMessage(''), 4000);
      loadAnnouncementsAndAudit();
    } catch (err: any) {
      setIsDeletingAll(false);
      alert(err.message || 'تعذر إتمام عملية الحذف');
    }
  };

  // Add Announcement
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnContent.trim()) {
      alert('يرجى إدخال عنوان ومحتوى الإعلان');
      return;
    }

    try {
      setIsSubmittingAnn(true);
      const newAnn: Announcement = {
        id: `ann-${Date.now()}`,
        title: newAnnTitle.trim(),
        content: newAnnContent.trim(),
        type: newAnnType,
        isActive: true,
        createdAt: new Date().toISOString(),
        authorName: currentUser?.fullName || 'مسؤول السجل'
      };

      await storageService.saveAnnouncement(newAnn);
      // External FCM Push broadcast to all user devices
      pushNotificationService.sendCustomBroadcast({
        title: `📢 ${newAnn.title}`,
        message: newAnn.content.slice(0, 160),
        urgency: newAnn.type === 'urgent' ? 'critical' : 'normal',
        linkPage: 'home'
      }).catch(() => {});

      setNewAnnTitle('');
      setNewAnnContent('');
      setIsSubmittingAnn(false);
      setUserActionMessage('تم نشر الإعلان وبث الإشعار الخارجي بنجاح ✅');
      setTimeout(() => setUserActionMessage(''), 4000);
      loadAnnouncementsAndAudit();
    } catch (err: any) {
      setIsSubmittingAnn(false);
      alert(err.message || 'تعذر نشر الإعلان');
    }
  };

  // FCM Management Handlers
  const loadFcmStats = useCallback(async () => {
    setIsLoadingFcmStats(true);
    try {
      const stats = await pushNotificationService.getFCMDevicesStatus();
      if (stats) {
        setFcmStats(stats);
      }
    } catch (e) {
      console.warn('loadFcmStats note:', e);
    } finally {
      setIsLoadingFcmStats(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'fcm') {
      loadFcmStats();
    }
  }, [activeTab, loadFcmStats]);

  const handleSendCustomBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPushTitle.trim() || !customPushMessage.trim()) {
      alert('يرجى إدخال عنوان ونص الإشعار الخارجي');
      return;
    }
    setIsSendingCustomPush(true);
    setCustomPushResult(null);
    try {
      const res = await pushNotificationService.sendCustomBroadcast({
        title: customPushTitle.trim(),
        message: customPushMessage.trim(),
        bloodType: customPushBloodType,
        district: customPushDistrict,
        urgency: customPushUrgency,
        linkPage: customPushTargetPage
      });
      setCustomPushResult(res.message || 'تم إرسال الإشعار الخارجي بنجاح');
      setCustomPushTitle('');
      setCustomPushMessage('');
      loadFcmStats();
    } catch (err: any) {
      setCustomPushResult(err.message || 'حدث خطأ أثناء إرسال الإشعار الخارجي');
    } finally {
      setIsSendingCustomPush(false);
    }
  };

  const handleTestPushToMyDevice = async () => {
    setTestPushLoading(true);
    try {
      const res = await pushNotificationService.sendTestNotification(0, 'O-', 'مديرية قعطبة - المركز');
      setCustomPushResult(res.message);
      loadFcmStats();
    } catch (e: any) {
      setCustomPushResult('تعذر إرسال الإشعار التجريبي: ' + (e.message || e));
    } finally {
      setTestPushLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (ann: Announcement) => {
    if (!confirm(`هل أنت متأكد من حذف الإعلان: "${ann.title}"؟`)) return;
    try {
      await storageService.deleteAnnouncement(ann.id, ann.title);
      setUserActionMessage('تم حذف الإعلان بنجاح');
      setTimeout(() => setUserActionMessage(''), 3000);
      loadAnnouncementsAndAudit();
    } catch (err: any) {
      alert(err.message || 'تعذر حذف الإعلان');
    }
  };

  // User role toggle
  const handleToggleUserRole = async (user: UserAccount) => {
    if (user.username === 'admin' || user.id === 'user-admin') {
      alert('لا يمكن تعديل صلاحية حساب المشرف الأساسي للنظام.');
      return;
    }
    const targetRole: 'admin' | 'user' = user.role === 'admin' ? 'user' : 'admin';
    const confirmMsg = targetRole === 'admin'
      ? `هل ترغب في ترقية المستخدم (${user.fullName}) إلى مسؤول؟ سيكون قادراً على الوصول للوحة الإدارة.`
      : `هل ترغب في تحويل المستخدم (${user.fullName}) إلى مستخدم عادي وإلغاء صلاحيات الإدارة؟`;

    if (!confirm(confirmMsg)) return;

    try {
      await storageService.updateUserRole(user.id, targetRole);
      setUserActionMessage(`تم تعديل صلاحية (${user.fullName}) بنجاح إلى: ${targetRole === 'admin' ? 'مسؤول' : 'مستخدم عادي'}`);
      setTimeout(() => setUserActionMessage(''), 4000);
      loadSettingsAndLogs();
      loadAnnouncementsAndAudit();
    } catch (err: any) {
      alert(err.message || 'تعذر تعديل الصلاحية');
    }
  };

  const handleDeleteUser = async (user: UserAccount) => {
    if (user.role === 'admin' || user.id === 'user-admin' || user.username === 'admin') {
      alert('لا يمكن حذف حساب المسؤول الرئيسي لحماية النظام.');
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف حساب (${user.fullName}) نهائياً؟`)) return;

    try {
      await storageService.deleteRegisteredUser(user.id);
      setUserActionMessage(`تم حذف حساب (${user.fullName}) بنجاح`);
      setTimeout(() => setUserActionMessage(''), 4000);
      loadSettingsAndLogs();
      loadAnnouncementsAndAudit();
    } catch (err: any) {
      alert(err.message || 'تعذر حذف الحساب');
    }
  };

  // Trigger Immediate Excel Export & Email
  const handleTriggerExportNow = async () => {
    setIsExportingNow(true);
    setExportNotice(null);

    const result = await storageService.triggerExportEmail();
    setIsExportingNow(false);

    if (result.success) {
      if (result.status === 'success') {
        setExportNotice({
          type: 'success',
          message: `تم إنشاء وإرسال ملف Excel بنجاح إلى: ${adminSettings.recipientEmail}`
        });
      } else {
        setExportNotice({
          type: 'warning',
          message: `تم إنشاء وحفظ ملف Excel بنجاح في السيرفر (${result.filename}). يمكنك تحميله مباشرة.`
        });
      }
      loadSettingsAndLogs();
    } else {
      setExportNotice({
        type: 'error',
        message: result.message || 'تعذر تصدير ملف Excel'
      });
    }
  };

  // Direct Browser/Android Excel Download (.xlsx) from Firebase Firestore
  const handleDirectExcelExport = async () => {
    setIsDirectExporting(true);
    setExportNotice(null);

    try {
      const res = await exportDonorsToExcel();
      if (res.success) {
        setExportNotice({
          type: 'success',
          message: `تم جلب (${res.donorsCount}) متبرع مباشرة من Firebase Firestore وتنزيل ملف Excel (${res.filename}) بنجاح على جهازك! 📊`
        });
        loadAnnouncementsAndAudit();
      } else {
        setExportNotice({
          type: 'error',
          message: res.error || 'تعذر تصدير وتحميل ملف Excel'
        });
      }
    } catch (err: any) {
      setExportNotice({
        type: 'error',
        message: err?.message || 'حدث خطأ غير متوقع أثناء الاتصال بقاعدة البيانات وتوليد ملف Excel.'
      });
    } finally {
      setIsDirectExporting(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSavedMessage('');

    const payload: Partial<AdminSettings> & { smtpPass?: string } = {
      recipientEmail: adminSettings.recipientEmail,
      dailyExportHour: Number(adminSettings.dailyExportHour),
      dailyExportMinute: Number(adminSettings.dailyExportMinute),
      autoExportEnabled: adminSettings.autoExportEnabled,
      smtpHost: smtpForm.host,
      smtpPort: Number(smtpForm.port),
      smtpUser: smtpForm.user,
      smtpSecure: smtpForm.secure,
      smtpFrom: smtpForm.from,
      recoveryCode
    };

    if (smtpForm.pass) {
      payload.smtpPass = smtpForm.pass;
    }

    const ok = await storageService.saveAdminSettings(payload);
    setIsSavingSettings(false);

    if (ok) {
      setSettingsSavedMessage('تم حفظ إعدادات التصدير والبريد بنجاح ✅');
      setTimeout(() => setSettingsSavedMessage(''), 4000);
      loadSettingsAndLogs();
    }
  };

  // Change Admin Password
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [resetEmailNotice, setResetEmailNotice] = useState<{ success: boolean; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeError('');
    setPinChangeSuccess('');

    if (newPin.length < 6) {
      setPinChangeError('يجب أن تتكون كلمة المرور الجديدة من 6 خانات على الأقل لضمان الأمان');
      return;
    }

    if (newPin !== confirmPin) {
      setPinChangeError('كلمة المرور الجديدة وتأكيدها غير متطابقين');
      return;
    }

    setIsChangingPin(true);
    const result = await storageService.updateAdminPassword(newPin);
    setIsChangingPin(false);

    if (result.success) {
      setPinChangeSuccess('تم تحديث كلمة المرور الخاصة بالمسؤول بنجاح وحفظها في Firebase Authentication ✅');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => setPinChangeSuccess(''), 5000);
    } else {
      setPinChangeError(result.error || 'تعذر تحديث كلمة المرور');
    }
  };

  const handleSendAdminResetEmail = async () => {
    setIsSendingResetEmail(true);
    setResetEmailNotice(null);
    const res = await storageService.sendAdminPasswordReset(MASTER_ADMIN_EMAIL);
    setIsSendingResetEmail(false);
    if (res.success) {
      setResetEmailNotice({
        success: true,
        text: res.message || `تم إرسال رابط التعيين بنجاح إلى البريد المعتمد (${MASTER_ADMIN_EMAIL}).`
      });
    } else {
      setResetEmailNotice({
        success: false,
        text: res.error || 'تعذر إرسال الرابط، يرجى المحاولة بعد قليل.'
      });
    }
  };

  const handleSendVerificationEmail = async () => {
    setIsSendingVerificationEmail(true);
    setVerificationNotice(null);
    try {
      const res = await storageService.sendEmailVerification();
      if (res.success) {
        setVerificationNotice({
          success: true,
          text: res.message || 'تم إرسال رسالة التحقق بنجاح إلى البريد الإلكتروني.'
        });
        // Check after a brief delay
        setTimeout(() => {
          checkAdminVerification();
        }, 1500);
      } else {
        setVerificationNotice({
          success: false,
          text: res.error || 'تعذر إرسال رسالة التحقق، يرجى إعادة المحاولة.'
        });
      }
    } catch (err: any) {
      setVerificationNotice({
        success: false,
        text: err?.message || 'حدث خطأ غير متوقع أثناء إرسال رسالة التحقق.'
      });
    } finally {
      setIsSendingVerificationEmail(false);
    }
  };

  const handleManualCheckVerification = async () => {
    setIsCheckingVerification(true);
    setVerificationNotice(null);
    try {
      const res = await storageService.checkEmailVerificationStatus();
      if (res.success) {
        setIsEmailVerified(res.emailVerified);
        if (res.email) setAdminDisplayEmail(res.email);
        if (res.emailVerified) {
          setVerificationNotice({
            success: true,
            text: 'رائع! تم التحقق من البريد الإلكتروني بنجاح في Firebase Authentication (Email verified = true) ✅'
          });
        } else {
          setVerificationNotice({
            success: false,
            text: 'لم يتم تفعيل البريد بعد (Email verified = false). يرجى فتح الرسالة المرسلة في بريدك والضغط على رابط التحقق، ثم إعادة الفحص.'
          });
        }
      } else {
        setVerificationNotice({
          success: false,
          text: res.error || 'تعذر جلب حالة التحقق من الخادم.'
        });
      }
    } catch (err: any) {
      setVerificationNotice({
        success: false,
        text: err?.message || 'حدث خطأ أثناء فحص حالة التحقق'
      });
    } finally {
      setIsCheckingVerification(false);
    }
  };

  const handleSaveWhatsAppSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWhatsAppSettings(true);
    setWhatsappSaveSuccess('');
    try {
      const payload: Partial<AdminSettings> = {
        whatsappEnabled: whatsappForm.enabled,
        whatsappPhoneNumberId: whatsappForm.phoneNumberId,
        whatsappSimulateMode: whatsappForm.simulateMode,
        whatsappMaxRecipients: Number(whatsappForm.maxRecipients) || 10
      };
      if (whatsappForm.accessToken.trim()) {
        payload.whatsappAccessToken = whatsappForm.accessToken.trim();
      }
      const success = await storageService.saveAdminSettings(payload);
      if (success) {
        setWhatsappSaveSuccess('تم حفظ إعدادات WhatsApp Business API بنجاح.');
        setTimeout(() => setWhatsappSaveSuccess(''), 4000);
        await loadSettingsAndLogs();
      }
    } catch (err: any) {
      alert('خطأ أثناء حفظ إعدادات واتساب: ' + (err.message || ''));
    } finally {
      setIsSavingWhatsAppSettings(false);
    }
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setSimulationResult(null);
    try {
      const res = await storageService.simulateWhatsAppMatch({
        bloodType: simBloodType,
        district: simDistrict,
        area: simArea,
        patientName: simPatientName,
        hospital: simHospital,
        unitsNeeded: simUnits,
        urgency: 'critical'
      });
      setSimulationResult(res);
      // reload logs too
      const waData = await storageService.getWhatsAppLogs();
      setWhatsappLogs(waData.logs || []);
      setWhatsappStats(waData);
    } catch (err: any) {
      alert('خطأ أثناء تشغيل المحاكاة: ' + (err.message || ''));
    } finally {
      setIsSimulating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        onImportBackup(text);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-6 pb-24 font-['Cairo',sans-serif]">
      {/* Top Professional Header Bar */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-rose-950 text-white p-5 sm:p-6 rounded-3xl shadow-xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
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
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 font-bold shrink-0 border border-amber-300">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black tracking-tight">لوحة تحكم المسؤول المركزي - قعطبة</h2>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                قاعدة بيانات سحابية نشطة
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              مرحباً بك: <strong className="text-amber-300">{currentUser?.fullName || 'المسؤول المعتمد'}</strong> ({currentUser?.username || 'admin'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
          <button
            onClick={() => onNavigate('districts')}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition-all active:scale-98 cursor-pointer flex items-center gap-1.5"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>المديريات</span>
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="px-3.5 py-2 rounded-xl bg-red-600/80 hover:bg-red-700 text-white font-bold text-xs transition-all active:scale-98 cursor-pointer flex items-center gap-1.5"
              title="تسجيل الخروج من لوحة الإدارة"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Action Message */}
      {userActionMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{userActionMessage}</span>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-bold scrollbar-none">
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'stats'
              ? 'bg-rose-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>إحصائيات السجل</span>
        </button>

        <button
          onClick={() => setActiveTab('donors')}
          className={`px-4 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'donors'
              ? 'bg-rose-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>إدارة المتبرعين ({donors.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'requests'
              ? 'bg-rose-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Droplet className="w-4 h-4" />
          <span>طلبات الدم ({requests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('announcements')}
          className={`px-4 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'announcements'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>إدارة الإعلانات ({announcements.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('hospitalAds')}
          className={`px-4 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'hospitalAds'
              ? 'bg-rose-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <HospitalIcon className="w-4 h-4" />
          <span>إعلانات المستشفيات ({hospitalAds.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('hospitalsDoctors')}
          className={`px-4 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'hospitalsDoctors'
              ? 'bg-rose-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          <span>المستشفيات والأطباء ({hospitals.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('fcm')}
          className={`px-4 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'fcm'
              ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-600/30 font-black'
              : 'text-slate-600 hover:bg-slate-100 font-bold'
          }`}
        >
          <Bell className="w-4 h-4 text-rose-500" />
          <span>الإشعارات الخارجية (FCM)</span>
          {fcmStats.total > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
              activeTab === 'fcm' ? 'bg-white text-rose-700' : 'bg-rose-100 text-rose-700'
            }`}>
              {fcmStats.total}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`px-4 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'whatsapp'
              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30 font-black'
              : 'text-slate-600 hover:bg-slate-100 font-bold'
          }`}
        >
          <MessageCircle className="w-4 h-4 text-emerald-500" />
          <span>إشعارات واتساب (WhatsApp)</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
            activeTab === 'whatsapp' ? 'bg-white text-emerald-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {whatsappStats.simulatedCount > 0 ? `محاكاة (${whatsappStats.simulatedCount})` : 'محاكاة آمنة'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'users'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserCog className="w-4 h-4" />
          <span>إدارة المستخدمين ({effectiveUserSummary.totalRegisteredUsers})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'audit'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          <span>سجل العمليات ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('excel')}
          className={`px-4 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'excel'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>تصدير Excel اليومي</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'security'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>الأمان وكلمة المرور</span>
        </button>

        <button
          onClick={() => setActiveTab('system')}
          className={`px-4 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'system'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          <span>النسخ والتهيئة</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & BLOOD TYPE STATS */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-500 block">إجمالي المتبرعين</span>
              <span className="text-3xl font-black text-rose-700 font-sans block mt-1">{donors.length}</span>
              <span className="text-[10px] text-slate-400 mt-1 block">مسجلون في قعطبة</span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-500 block">المتاحون للتبرع فوراً</span>
              <span className="text-3xl font-black text-emerald-600 font-sans block mt-1">{availableCount}</span>
              <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
                {donors.length > 0 ? `${Math.round((availableCount / donors.length) * 100)}% جاهزية` : '0%'}
              </span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-500 block">طلبات الدم النشطة</span>
              <span className="text-3xl font-black text-amber-600 font-sans block mt-1">{openRequestsCount}</span>
              <span className="text-[10px] text-red-600 font-bold mt-1 block">
                {criticalRequestsCount} حالات حرجة
              </span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-500 block">المستخدمين المسجلين</span>
              <span className="text-3xl font-black text-sky-600 font-sans block mt-1">{effectiveUserSummary.totalRegisteredUsers}</span>
              <span className="text-[10px] text-slate-400 mt-1 block">حسابات نشطة</span>
            </div>
          </div>

          {/* Blood Type Breakdown Cards */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-rose-700" />
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  توزيع أعداد المتبرعين حسب فصيلة الدم
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-400">8 فصائل رئيسية</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(Object.keys(bloodTypeCounts) as BloodType[]).map((type) => {
                const s = bloodTypeCounts[type];
                const pct = donors.length > 0 ? Math.round((s.total / donors.length) * 100) : 0;
                return (
                  <div 
                    key={type}
                    onClick={() => {
                      setDonorBloodFilter(type);
                      setActiveTab('donors');
                    }}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-rose-400 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between bg-slate-50/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black font-sans text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-lg">
                        {type}
                      </span>
                      <span className="text-xs font-bold text-slate-400 font-sans">{pct}%</span>
                    </div>

                    <div className="mt-3">
                      <span className="text-2xl font-black text-slate-900 font-sans block">
                        {s.total} <span className="text-xs font-semibold text-slate-500">متبرع</span>
                      </span>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div 
                          className="bg-rose-600 h-full rounded-full transition-all duration-300" 
                          style={{ width: `${Math.max(pct, s.total > 0 ? 10 : 0)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-emerald-600 font-bold block mt-1">
                        {s.available} متاح للتبرع
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DONORS MANAGEMENT */}
      {activeTab === 'donors' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">إدارة سجل المتبرعين بالدم</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                إضافة، تعديل، حذف نهائي، أو تفريغ السجل بالكامل بعد التأكيد الأمني
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {onOpenAddDonor && (
                <button
                  type="button"
                  onClick={onOpenAddDonor}
                  className="px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-xs active:scale-98 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إضافة متبرع جديد</span>
                </button>
              )}

              {onOpenImportModal && (
                <button
                  type="button"
                  onClick={onOpenImportModal}
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs shadow-xs active:scale-98 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>استيراد ملف Excel</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDirectExcelExport}
                disabled={isDirectExporting}
                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs active:scale-98 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                title="تصدير جميع المتبرعين من Firebase إلى ملف Excel"
              >
                {isDirectExporting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>تصدير Excel (.xlsx)</span>
              </button>

              {/* DANGEROUS: Bulk Delete All Donors */}
              <button
                type="button"
                onClick={() => {
                  setDeleteAllConfirmationText('');
                  setShowDeleteAllModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-xs shadow-xs active:scale-98 transition-all cursor-pointer flex items-center gap-1.5"
                title="حذف جميع المتبرعين عند التأكيد الأمني"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
                <span>حذف جميع المتبرعين</span>
              </button>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                placeholder="بحث بالاسم، رقم الهاتف، أو المنطقة..."
                value={donorSearch}
                onChange={(e) => setDonorSearch(e.target.value)}
                className="w-full px-3.5 py-2 pr-9 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-600"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>

            <select
              value={donorBloodFilter}
              onChange={(e) => setDonorBloodFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-hidden focus:border-rose-600 w-full sm:w-auto"
            >
              <option value="all">جميع الفصائل ({donors.length})</option>
              {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((t) => (
                <option key={t} value={t}>فصيلة ({t})</option>
              ))}
            </select>
          </div>

          {/* Donors Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">الفصيلة</th>
                  <th className="py-2.5 px-3">اسم المتبرع</th>
                  <th className="py-2.5 px-3">الهاتف</th>
                  <th className="py-2.5 px-3">المديرية / المنطقة</th>
                  <th className="py-2.5 px-3">حالة التوفر</th>
                  <th className="py-2.5 px-3 text-center">إجراءات المسؤول</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDonors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      لا يوجد متبرعون يطابقون شروط البحث الحالية.
                    </td>
                  </tr>
                ) : (
                  filteredDonors.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-bold font-sans text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200">
                          {d.bloodType}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">
                        <button
                          onClick={() => onSelectDonor(d)}
                          className="hover:text-rose-700 text-right cursor-pointer"
                        >
                          {d.fullName}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-sans" dir="ltr">
                        {d.phone}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {d.district} - {d.area}
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => onToggleDonorAvailability(d)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                            d.isAvailable
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {d.isAvailable ? 'متاح للتبرع 🟢' : 'غير متاح ⚪'}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <a
                            href={`tel:${d.phone}`}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                            title="اتصال"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                          {onEditDonor && (
                            <button
                              onClick={() => onEditDonor(d)}
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 cursor-pointer"
                              title="تعديل بيانات المتبرع"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              if (confirm(`هل أنت متأكد من حذف المتبرع (${d.fullName}) نهائياً من قاعدة البيانات السحابية؟`)) {
                                try {
                                  await onDeleteDonor(d.id);
                                  setUserActionMessage(`تم حذف المتبرع (${d.fullName}) نهائياً`);
                                  setTimeout(() => setUserActionMessage(''), 3000);
                                  loadAnnouncementsAndAudit();
                                } catch (err: any) {
                                  alert(err.message || 'تعذر حذف المتبرع');
                                }
                              }
                            }}
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                            title="حذف المتبرع نهائياً"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: REQUESTS MANAGEMENT */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">مراجعة وإدارة طلبات الدم</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تحديث حالة توفير أكياس الدم، التواصل مع أهالي المرضى، وحذف الطلبات المنتهية
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="بحث في طلبات الدم..."
                value={requestSearch}
                onChange={(e) => setRequestSearch(e.target.value)}
                className="w-full px-3 py-1.5 pr-8 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-red-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">الفصيلة</th>
                  <th className="py-2.5 px-3">اسم المريض</th>
                  <th className="py-2.5 px-3">المستشفى</th>
                  <th className="py-2.5 px-3">الوحدات</th>
                  <th className="py-2.5 px-3">الإلحاح</th>
                  <th className="py-2.5 px-3">الحالة</th>
                  <th className="py-2.5 px-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-bold font-sans text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                        {r.bloodType}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800">
                      <button
                        onClick={() => onSelectRequest(r)}
                        className="hover:text-red-600 text-right cursor-pointer"
                      >
                        {r.patientName}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{r.hospital}</td>
                    <td className="py-3 px-3 font-black text-rose-600 font-sans">
                      {r.unitsNeeded}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          r.urgency === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.urgency === 'critical' ? 'عاجل جداً' : 'عاجل'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() =>
                          onUpdateRequestStatus(
                            r,
                            r.status === 'fulfilled' ? 'open' : 'fulfilled'
                          )
                        }
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                          r.status === 'fulfilled'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.status === 'fulfilled' ? 'تم التوفير ✔' : 'قيد الانتظار ⏳'}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <a
                          href={`tel:${r.contactPhone}`}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                          title="اتصال"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف طلب ${r.patientName}؟`)) {
                              onDeleteRequest(r.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ANNOUNCEMENTS MANAGEMENT (إدارة الإعلانات) */}
      {activeTab === 'announcements' && (
        <div className="space-y-6">
          {/* Create Announcement Form */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">نشر إعلان أو حملة تبرع جديدة</h3>
                <p className="text-xs text-slate-500">يظهر الإعلان فوراً لجميع زوار ومستخدمي التطبيق في قعطبة</p>
              </div>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">عنوان الإعلان / الحملة:</label>
                  <input
                    type="text"
                    value={newAnnTitle}
                    onChange={(e) => setNewAnnTitle(e.target.value)}
                    placeholder="مثال: حملة تبرع عاجلة لصالح مستشفى السلام بقعطبة"
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تصنيف الإعلان:</label>
                  <select
                    value={newAnnType}
                    onChange={(e) => setNewAnnType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden focus:border-indigo-600"
                  >
                    <option value="urgent">🚨 نداء عاجل جداً</option>
                    <option value="campaign">🩸 حملة تبرع ميدانية</option>
                    <option value="info">📢 إعلان وتوجيه عام</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تفاصيل ومحتوى الإعلان:</label>
                <textarea
                  rows={3}
                  value={newAnnContent}
                  onChange={(e) => setNewAnnContent(e.target.value)}
                  placeholder="اكتب نص الإعلان، الموقع، التوقيت، أو الفصائل المستهدفة..."
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingAnn}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 transition-all active:scale-98"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmittingAnn ? 'جاري النشر...' : 'نشر الإعلان الآن'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Published Announcements List */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <h4 className="font-bold text-slate-900 text-sm">الإعلانات المنشورة في السجل ({announcements.length})</h4>
            {announcements.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">لم يتم نشر إعلانات حتى الآن.</p>
            ) : (
              <div className="space-y-3">
                {announcements.map((ann) => (
                  <div 
                    key={ann.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ann.type === 'urgent' ? 'bg-red-100 text-red-800' : ann.type === 'campaign' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                        }`}>
                          {ann.type === 'urgent' ? 'نداء عاجل' : ann.type === 'campaign' ? 'حملة تبرع' : 'إعلان عام'}
                        </span>
                        <h5 className="font-bold text-slate-900 text-sm">{ann.title}</h5>
                      </div>
                      <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{ann.content}</p>
                      <span className="text-[10px] text-slate-400 block pt-1">
                        تاريخ النشر: {new Date(ann.createdAt).toLocaleString('ar-YE')} · بواسطة: {ann.authorName || 'المسؤول'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <button
                        onClick={() => handleDeleteAnnouncement(ann)}
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                        title="حذف الإعلان"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: HOSPITAL & MEDICAL CENTER ADS */}
      {activeTab === 'hospitalAds' && (
        <AdminHospitalAdsTab
          hospitalAds={hospitalAds}
          onHospitalAdsChange={(updatedAds) => {
            onHospitalAdsChange?.(updatedAds);
          }}
          onRefreshAuditLogs={loadAnnouncementsAndAudit}
        />
      )}

      {/* TAB: HOSPITALS & DOCTORS DIRECTORY */}
      {activeTab === 'hospitalsDoctors' && (
        <AdminHospitalsDoctorsTab
          hospitals={hospitals}
          doctors={doctors}
          onHospitalsChange={(updatedHospitals) => {
            onHospitalsChange?.(updatedHospitals);
          }}
          onDoctorsChange={(updatedDoctors) => {
            onDoctorsChange?.(updatedDoctors);
          }}
          onRefreshAuditLogs={loadAnnouncementsAndAudit}
        />
      )}

      {/* TAB: FIREBASE CLOUD MESSAGING (FCM) PUSH NOTIFICATIONS */}
      {activeTab === 'fcm' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header & Quick Action */}
          <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-red-900 text-white rounded-3xl p-6 shadow-lg shadow-rose-950/20 relative overflow-hidden border border-rose-700/50">
            <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-rose-600/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 bg-rose-700/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-rose-100 border border-rose-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>نظام الإشعارات الخارجية الحقيقي (Google FCM)</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  مركز بث الإشعارات الخارجية وتنبيهات الطوارئ
                </h3>
                <p className="text-xs sm:text-sm text-rose-100/90 max-w-2xl leading-relaxed">
                  إرسال إشعارات فورية تصل مباشرة لشاشة هواتف المتبرعين والمستخدمين في قعطبة، وتعمل حتى عندما يكون التطبيق مغلقاً تماماً أو في الخلفية.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={handleTestPushToMyDevice}
                  disabled={testPushLoading}
                  className="px-4 py-2.5 rounded-2xl bg-white text-rose-900 font-black text-xs shadow-md hover:bg-rose-50 cursor-pointer flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Smartphone className="w-4 h-4 text-rose-700" />
                  <span>{testPushLoading ? 'جاري الإرسال...' : 'تجربة إشعار على هاتفي 📱'}</span>
                </button>
                <button
                  type="button"
                  onClick={loadFcmStats}
                  disabled={isLoadingFcmStats}
                  className="p-2.5 rounded-2xl bg-rose-800/80 hover:bg-rose-700 text-white cursor-pointer transition-all border border-rose-600/40"
                  title="تحديث البيانات"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingFcmStats ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Notification Results Notice */}
            {customPushResult && (
              <div className="mt-4 p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-xs font-bold text-white flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>{customPushResult}</span>
                </div>
                <button
                  onClick={() => setCustomPushResult(null)}
                  className="text-white/70 hover:text-white text-xs px-2 py-0.5"
                >
                  إغلاق
                </button>
              </div>
            )}
          </div>

          {/* FCM Devices Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">الأجهزة المسجلة</span>
                <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
                  <Bell className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">{fcmStats.total || 0}</div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-1">
                {fcmStats.active || 0} جهاز مفعل ونشط
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">تطبيق أندرويد (APK)</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">{fcmStats.androidCount || 0}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                وصول في الخلفية ومغلق
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">متصفحات الويب (Web)</span>
                <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
                  <Radio className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">{fcmStats.webCount || 0}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                PWA وإشعارات المتصفح
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">محرك السحابة (FCM)</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Server className="w-4 h-4" />
                </div>
              </div>
              <div className="text-base font-black text-emerald-700 flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>متصل وجاهز</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-1 truncate">
                {fcmStats.projectId || 'avian-gate-pbcxw'}
              </div>
            </div>
          </div>

          {/* Custom Targeted Push Notification Broadcast Form */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
                <Radio className="w-5 h-5 text-rose-600 animate-pulse" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  إرسال إشعار خارجي فوري ومخصص للأجهزة
                </h4>
                <p className="text-xs text-slate-500">
                  يمكنك تخصيص المستلمين حسب فصيلة الدم والمنطقة الجغرافية لعدم إزعاج بقية المستخدمين
                </p>
              </div>
            </div>

            <form onSubmit={handleSendCustomBroadcast} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    عنوان الإشعار (يظهر في رأس التنبيه):
                  </label>
                  <input
                    type="text"
                    value={customPushTitle}
                    onChange={(e) => setCustomPushTitle(e.target.value)}
                    placeholder="مثال: 🚨 نداء دم عاجل: مطلوب فصيلة O- بمستشفى السلام"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-600 focus:ring-1 focus:ring-rose-600 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الفصيلة المستهدفة:</label>
                    <select
                      value={customPushBloodType}
                      onChange={(e) => setCustomPushBloodType(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden focus:border-rose-600 font-semibold"
                    >
                      <option value="all">الكل (جميع الفصائل)</option>
                      <option value="O-">O- (نادرة وسالبة)</option>
                      <option value="O+">O+ (موجبة)</option>
                      <option value="A-">A- (سالبة)</option>
                      <option value="A+">A+ (موجبة)</option>
                      <option value="B-">B- (سالبة)</option>
                      <option value="B+">B+ (موجبة)</option>
                      <option value="AB-">AB- (سالبة)</option>
                      <option value="AB+">AB+ (موجبة)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">المنطقة الجغرافية:</label>
                    <select
                      value={customPushDistrict}
                      onChange={(e) => setCustomPushDistrict(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden focus:border-rose-600 font-semibold"
                    >
                      <option value="all">كل المديرية (جميع المناطق)</option>
                      <option value="مديرية قعطبة - المركز">قعطبة - المركز والمدينة</option>
                      <option value="قعطبة الشمالية">قعطبة الشمالية (الجبّارة والقرين)</option>
                      <option value="الفاخر">الفاخر وسليم</option>
                      <option value="سناح">سناح والوبح</option>
                      <option value="حمر وشخب">حمر وشخب وبيت الشوكي</option>
                      <option value="نقيل الشيم وريشان">نقيل الشيم وريشان</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نص الإشعار (موجز ومباشر):
                  </label>
                  <textarea
                    rows={2}
                    value={customPushMessage}
                    onChange={(e) => setCustomPushMessage(e.target.value)}
                    placeholder="مثال: مريض بحاجة ماسة لوحدتي دم فوراً في مستشفى السلام بقعطبة. يرجى من المتبرعين الجاهزين الاستجابة عبر التطبيق."
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-600"
                  />
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">درجة الأهمية:</label>
                    <select
                      value={customPushUrgency}
                      onChange={(e) => setCustomPushUrgency(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden focus:border-rose-600 font-bold text-rose-700"
                    >
                      <option value="critical">🚨 نداء حرج وطارئ جداً (أولوية قصوى + اهتزاز)</option>
                      <option value="urgent">🩸 طلب عاجل</option>
                      <option value="normal">📢 إعلان أو تنبيه اعتيادي</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الوجهة عند النقر:</label>
                    <select
                      value={customPushTargetPage}
                      onChange={(e) => setCustomPushTargetPage(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden focus:border-rose-600"
                    >
                      <option value="requests">صفحة طلبات الدم</option>
                      <option value="donors">صفحة سجل المتبرعين</option>
                      <option value="home">الصفحة الرئيسية</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>الإرسال آمن ومحمي عبر خادم السجل ولا يتم تسريب مفاتيح Firebase للمستخدمين</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSendingCustomPush}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-black text-xs shadow-md shadow-rose-700/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-98"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSendingCustomPush ? 'جاري الإرسال عبر FCM...' : 'إرسال الإشعار الخارجي لجميع الأجهزة المستهدفة 🔔'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Breakdown & Registered Devices List */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Blood Type & District Breakdown */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <PieChart className="w-4 h-4 text-rose-600" />
                <span>توزيع الأجهزة المشتركة حسب الفصيلة والمنطقة</span>
              </h4>

              <div>
                <span className="text-[11px] font-bold text-slate-500 block mb-2">حسب فصائل الدم:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['all', 'O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((bt) => {
                    const count = fcmStats.byBloodType?.[bt] || 0;
                    return (
                      <span
                        key={bt}
                        className={`text-xs px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 ${
                          count > 0 ? 'bg-rose-50 text-rose-800 border border-rose-200/60' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        <span>{bt === 'all' ? 'جميع الفصائل' : bt}:</span>
                        <span className="font-black">{count}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 block mb-2">حسب مناطق قعطبة:</span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {Object.entries(fcmStats.byDistrict || {}).map(([dist, count]: any) => (
                    <div key={dist} className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-slate-50">
                      <span className="text-slate-700 font-semibold">{dist === 'all' ? 'كل المديرية' : dist}</span>
                      <span className="font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">{count} جهاز</span>
                    </div>
                  ))}
                  {(!fcmStats.byDistrict || Object.keys(fcmStats.byDistrict).length === 0) && (
                    <p className="text-xs text-slate-400 py-2">لا توجد بيانات توزيع حتى الآن.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Active Device Tokens List */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span>سجل أجهزة المستخدمين النشطة في قعطبة ({fcmStats.devices?.length || 0})</span>
                  </h4>
                  <p className="text-xs text-slate-500">تم تسجيل هذه الأجهزة تلقائياً لاستقبال الإشعارات الخارجية</p>
                </div>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                  تحديث فوري
                </span>
              </div>

              {(!fcmStats.devices || fcmStats.devices.length === 0) ? (
                <div className="text-center py-8 text-slate-400 space-y-2">
                  <Bell className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold">لم يتم تسجيل أجهزة بعد، أو جاري تسجيل الأجهزة النشطة تلقائياً.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {fcmStats.devices.map((dev: any, i: number) => (
                    <div
                      key={dev.id || i}
                      className="p-3 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                          dev.platform === 'android' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                        }`}>
                          {dev.platform === 'android' ? <Smartphone className="w-4 h-4" /> : <Radio className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span>{dev.platform === 'android' ? 'هاتف أندرويد (تطبيق APK)' : 'متصفح ويب (PWA)'}</span>
                            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-md font-mono">
                              {dev.tokenPreview}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>الفصيلة: <strong className="text-rose-700">{dev.bloodType === 'all' ? 'الكل' : dev.bloodType}</strong></span>
                            <span>·</span>
                            <span>المنطقة: <strong>{dev.district === 'all' ? 'كل المديرية' : dev.district}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="text-left">
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full inline-block">
                          جاهز للتلقي 🔔
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          {dev.updatedAt ? new Date(dev.updatedAt).toLocaleDateString('ar-YE') : 'نشط'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: WHATSAPP BUSINESS CLOUD API & PROXIMITY ENGINE */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          {/* Header & Simulation Status Banner */}
          <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-emerald-800/60 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-emerald-500/30 shrink-0">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-base sm:text-lg">منظومة إشعارات واتساب السحابية (WhatsApp Cloud API)</h3>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-400 text-slate-950 border border-amber-300 flex items-center gap-1 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse"></span>
                      وضع المحاكاة الآمنة نشط (Safe Simulation)
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200/90 mt-1">
                    محرك التوافق الطبي والمسافات الجغرافية (Haversine) بمديرية قعطبة مع منع التكرار والتحكم الكامل في الخصوصية.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadSettingsAndLogs}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-white/10"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تحديث السجلات</span>
                </button>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-emerald-800/60 relative z-10">
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                <span className="text-[11px] text-emerald-200/80 block font-bold">إجمالي العمليات</span>
                <span className="text-xl font-black text-white mt-0.5 block">{whatsappStats.total || 0}</span>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <span className="text-[11px] text-emerald-300 block font-bold">رسائل تمت محاكاتها</span>
                <span className="text-xl font-black text-emerald-300 mt-0.5 block">{whatsappStats.simulatedCount || 0}</span>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                <span className="text-[11px] text-amber-300 block font-bold">تم تفادي تكرارها</span>
                <span className="text-xl font-black text-amber-300 mt-0.5 block">{whatsappStats.skippedDuplicateCount || 0}</span>
              </div>
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <span className="text-[11px] text-rose-300 block font-bold">حالات فشل</span>
                <span className="text-xl font-black text-rose-300 mt-0.5 block">{whatsappStats.failedCount || 0}</span>
              </div>
            </div>
          </div>

          {/* Main WhatsApp Grid: Config + Simulator */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Column 1: WhatsApp Configuration Form */}
            <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <h4 className="font-extrabold text-slate-900 text-sm">إعدادات WhatsApp Business API</h4>
              </div>

              {whatsappSaveSuccess && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{whatsappSaveSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSaveWhatsAppSettings} className="space-y-4">
                {/* Enable toggle */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block">تفعيل إرسال إشعارات الواتساب</label>
                    <span className="text-[11px] text-slate-500">إرسال إشعارات تلقائية للمتبرعين المطابقين عند نشر طلب دم</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={whatsappForm.enabled}
                    onChange={(e) => setWhatsappForm({ ...whatsappForm, enabled: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                </div>

                {/* Simulation Mode Toggle */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/70 border border-amber-200/70">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-black text-amber-900">وضع المحاكاة الآمن (Simulation Mode)</label>
                      <span className="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-full font-bold">موصى به</span>
                    </div>
                    <span className="text-[11px] text-amber-700">اختبار وتوليد سجلات الإرسال ومحاكاة رسائل الواتساب دون إرسال رسائل فعلية عبر Meta</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={whatsappForm.simulateMode}
                    onChange={(e) => setWhatsappForm({ ...whatsappForm, simulateMode: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                  />
                </div>

                {/* Phone Number ID */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    معرف رقم الهاتف (WhatsApp Phone Number ID)
                  </label>
                  <input
                    type="text"
                    value={whatsappForm.phoneNumberId}
                    onChange={(e) => setWhatsappForm({ ...whatsappForm, phoneNumberId: e.target.value })}
                    placeholder="مثال: 104859382716492"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none font-mono"
                    dir="ltr"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">يتم استخراجه من لوحة Meta for Developers</span>
                </div>

                {/* Access Token */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      رمز الوصول الدائم (Permanent Access Token)
                    </label>
                    {adminSettings.hasWhatsappToken && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                        مفتاح الخادم محفوظ بأمان 🔒
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    value={whatsappForm.accessToken}
                    onChange={(e) => setWhatsappForm({ ...whatsappForm, accessToken: e.target.value })}
                    placeholder={adminSettings.hasWhatsappToken ? '•••••••••••••••••••••••• (محفوظ بأمان في الخادم)' : 'أدخل مفتاح Meta Access Token (EAAG...)'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none font-mono"
                    dir="ltr"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    يتم حفظ الرمز حصراً في بيئة الخادم ولا يتم إرساله للعميل أو كشفه في Firestore.
                  </span>
                </div>

                {/* Max Recipients */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    الحد الأقصى للمستلمين لكل طلب (Max Recipients)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={whatsappForm.maxRecipients}
                    onChange={(e) => setWhatsappForm({ ...whatsappForm, maxRecipients: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    يتم ترتيب المتبرعين تلقائياً حسب الأقرب جغرافياً لمركز الطلب (Haversine Distance).
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSavingWhatsAppSettings}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingWhatsAppSettings ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>حفظ إعدادات واتساب</span>
                </button>
              </form>
            </div>

            {/* Column 2: Proximity & Medical Match Simulator */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-extrabold text-slate-900 text-sm">مختبر المحاكاة الطبية والجغرافية (قعطبة)</h4>
                </div>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  Haversine Formula
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">فصيلة دم المريض</label>
                  <select
                    value={simBloodType}
                    onChange={(e) => setSimBloodType(e.target.value as BloodType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-rose-700 outline-none focus:border-emerald-600"
                  >
                    {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map(bt => (
                      <option key={bt} value={bt}>{bt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">المديرية / المنطقة</label>
                  <select
                    value={simDistrict}
                    onChange={(e) => setSimDistrict(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold outline-none focus:border-emerald-600"
                  >
                    <option value="مديرية قعطبة - المركز">مديرية قعطبة - المركز</option>
                    <option value="مريس - قعطبة">مريس - قعطبة</option>
                    <option value="سناح - قعطبة">سناح - قعطبة</option>
                    <option value="حجر - قعطبة">حجر - قعطبة</option>
                    <option value="الفاخر - قعطبة">الفاخر - قعطبة</option>
                    <option value="العود - قعطبة">العود - قعطبة</option>
                    <option value="الضالع - المدينة">الضالع - المدينة (مجاورة)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">العزلة أو القرية</label>
                  <input
                    type="text"
                    value={simArea}
                    onChange={(e) => setSimArea(e.target.value)}
                    placeholder="مثال: مركز المدينة، الجبارة، سهده..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">المستشفى</label>
                  <input
                    type="text"
                    value={simHospital}
                    onChange={(e) => setSimHospital(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={isSimulating}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSimulating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
                <span>تشغيل محاكاة المطابقة والمسافة الجغرافية 🧪</span>
              </button>

              {/* Simulation Result Box */}
              {simulationResult && (
                <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">
                      نتيجة المحاكاة: تم العثور على {simulationResult.matchingDonorsCount} متبرع متوافق طبياً
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      {simulationResult.mode === 'simulation' ? 'وضع المحاكاة' : 'إرسال حقيقي'}
                    </span>
                  </div>

                  {simulationResult.matchingDonors?.length > 0 ? (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {simulationResult.matchingDonors.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between text-xs hover:border-emerald-300 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[11px]">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                <span>{item.donor?.fullName || item.donorName}</span>
                                <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-bold font-mono">
                                  {item.donor?.bloodType}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                <span>{item.donor?.district}</span>
                                <span>·</span>
                                <span className="font-mono" dir="ltr">{item.donor?.phone}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-left">
                            <span className="text-xs font-black text-emerald-700 font-mono block">
                              {item.distanceKm !== null && item.distanceKm !== undefined ? `${item.distanceKm} كم` : 'تقديري'}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                              item.proximityLevel === 'same_area' ? 'bg-emerald-100 text-emerald-800' :
                              item.proximityLevel === 'same_district' ? 'bg-sky-100 text-sky-800' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {item.proximityLevel === 'same_area' ? 'نفس المنطقة' :
                               item.proximityLevel === 'same_district' ? 'نفس المديرية' : 'مديرية مجاورة'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-xs text-slate-500">
                      لا يوجد متبرعون متاحون ومطابقون جينياً لفصيلة ({simBloodType}) في قاعدة البيانات حالياً.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section: WhatsApp Dispatches Log Table */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>سجل إرسال إشعارات الواتساب ({whatsappLogs.length})</span>
                </h4>
                <p className="text-xs text-slate-500">توثيق كامل للرسائل الصادرة، المسافات بالكيلومتر، ومعرفات Meta</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-xl font-bold">
                  محاكاة آمنة 🛡️
                </span>
              </div>
            </div>

            {whatsappLogs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 space-y-2">
                <MessageCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold">لم يتم إرسال أو محاكاة أي إشعارات واتساب بعد.</p>
                <p className="text-[11px] text-slate-400">عند إنشاء طلب دم جديد أو تشغيل أداة المحاكاة، ستظهر السجلات هنا تلقائياً.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">وقت الإرسال</th>
                      <th className="py-2.5 px-3 font-bold">المتبرع المستلم</th>
                      <th className="py-2.5 px-3 font-bold">فصيلة الدم</th>
                      <th className="py-2.5 px-3 font-bold">المريض والطلب</th>
                      <th className="py-2.5 px-3 font-bold">المسافة (Haversine)</th>
                      <th className="py-2.5 px-3 font-bold">الحالة</th>
                      <th className="py-2.5 px-3 font-bold">معرف الرسالة (WAMID)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {whatsappLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString('ar-YE') : '-'}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{log.donorName}</div>
                          <div className="text-[11px] text-slate-400 font-mono" dir="ltr">{log.donorPhone}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-mono">
                            {log.bloodType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-800">{log.patientName || 'مريض عاجل'}</span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-bold font-mono text-emerald-700">
                            {log.distanceKm !== undefined ? `${log.distanceKm} كم` : '-'}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {log.proximityLevel === 'same_area' ? 'نفس المنطقة' :
                             log.proximityLevel === 'same_district' ? 'نفس المديرية' : 'مديرية مجاورة'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {log.status === 'simulated' ? (
                            <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                              تمت المحاكاة بنجاح 🧪
                            </span>
                          ) : log.status === 'sent' ? (
                            <span className="text-[11px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-bold">
                              تم الإرسال لـ Meta ✅
                            </span>
                          ) : log.status === 'skipped_duplicate' ? (
                            <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                              تفادي التكرار 🛡️
                            </span>
                          ) : (
                            <span className="text-[11px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-bold">
                              فشل ({log.errorMessage || 'خطأ'})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[10px] font-mono text-slate-400 max-w-[120px] truncate" title={log.messageId}>
                          {log.messageId || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: REGISTERED USERS MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <span>إدارة حسابات المستخدمين</span>
                <span className="px-2 py-0.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 text-xs font-black font-sans">
                  {effectiveUserSummary.totalRegisteredUsers}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                مراجعة المستخدمين، منح أو إلغاء صلاحية المسؤول، وحذف الحسابات غير المصرح بها
                {(effectiveUserSummary.disabledCount > 0 || effectiveUserSummary.deletedCount > 0) && (
                  <span className="mr-1.5 text-slate-400">
                    ({effectiveUserSummary.totalRegisteredUsers} نشط · {effectiveUserSummary.disabledCount} معطل · {effectiveUserSummary.deletedCount} محذوف)
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  placeholder="بحث بالاسم أو اسم المستخدم أو الهاتف..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full px-3 py-1.5 pr-8 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-sky-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
              <button
                type="button"
                onClick={async () => {
                  setIsLoadingUsers(true);
                  try {
                    const fresh = await storageService.getRegisteredUsers();
                    setRegisteredUsers(fresh);
                    setUserDirectorySummary(summarizeUsersDirectory(fresh));
                  } finally {
                    setIsLoadingUsers(false);
                  }
                }}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 border border-slate-200 cursor-pointer shrink-0"
                title="تحديث قائمة المستخدمين من السحابة"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingUsers ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">الاسم الكامل</th>
                  <th className="py-2.5 px-3">اسم المستخدم</th>
                  <th className="py-2.5 px-3">رقم الهاتف</th>
                  <th className="py-2.5 px-3">الصلاحية</th>
                  <th className="py-2.5 px-3">تاريخ التسجيل</th>
                  <th className="py-2.5 px-3 text-center">إجراءات الصلاحية والحذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registeredUsers
                  .filter((u) => {
                    const q = userSearch.toLowerCase();
                    return (
                      u.fullName.toLowerCase().includes(q) ||
                      u.username.toLowerCase().includes(q) ||
                      u.phone.includes(q)
                    );
                  })
                  .map((u) => {
                    const isRoot = u.username === 'admin' || u.id === 'user-admin';
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-800">{u.fullName}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-600" dir="ltr">@{u.username}</td>
                        <td className="py-3 px-3 font-sans text-slate-600" dir="ltr">{u.phone}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                            u.role === 'admin'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-sky-100 text-sky-800 border border-sky-200'
                          }`}>
                            {u.role === 'admin' ? (
                              <>
                                <ShieldCheck className="w-3 h-3 text-amber-700" />
                                <span>مسؤول</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3 h-3 text-sky-700" />
                                <span>مستخدم عادي</span>
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-YE') : '—'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isRoot ? (
                            <span className="text-[10px] text-slate-400 font-bold">محمي 🛡️</span>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleToggleUserRole(u)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                  u.role === 'admin'
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {u.role === 'admin' ? 'إلغاء المسؤول' : 'ترقية لمسؤول 🛡️'}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                                title="حذف الحساب"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT LOGS (سجل العمليات) */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">سجل عمليات المسؤول المعتمد (Audit Log)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                توثيق يوضح كافة عمليات الإضافة والتعديل والحذف وتاريخ ووقت تنفيذها
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedAuditIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAuditDeleteModal({ mode: 'selected' })}
                  disabled={isDeletingAuditLogs}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف المحدد ({selectedAuditIds.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setAuditDeleteModal({ mode: 'all' })}
                disabled={auditLogs.length === 0 || isDeletingAuditLogs}
                className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف جميع السجلات</span>
              </button>

              <button
                type="button"
                onClick={loadAnnouncementsAndAudit}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                title="تحديث سجل العمليات"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingAudit ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {(!hasFirebaseAuthSession || !isEmailVerified) && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-relaxed">
                  <div className="font-bold">
                    {!hasFirebaseAuthSession
                      ? 'توثيق Firebase Auth مطلوب قبل الحذف الفعلي من Firestore'
                      : 'البريد الإلكتروني للمسؤول غير موثق بعد (emailVerified = false)'}
                  </div>
                  <p className="text-[11px] text-amber-800">
                    تم تفعيل القراءة المباشرة من خادم Firestore بدون أي إخفاء محلي. لإتمام الحذف الفعلي للمستندات من مجموعة audit_logs، يلزم وجود جلسة Firebase Auth موثقة للمسؤول المركزي.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleVerifyCentralAdminWithGoogle}
                disabled={isAuthenticatingGoogleAdmin}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isAuthenticatingGoogleAdmin ? 'جاري التوثيق...' : 'توثيق بحساب Google للمسؤول'}</span>
              </button>
            </div>
          )}

          {auditNotice && (
            <div
              className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 ${
                auditNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {auditNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{auditNotice.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setAuditNotice(null)}
                className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
                aria-label="إغلاق التنبيه"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                  <th className="py-2.5 px-2 w-9 text-center">
                    <input
                      type="checkbox"
                      checked={isAllAuditSelected}
                      onChange={toggleSelectAllAuditLogs}
                      disabled={auditLogs.length === 0}
                      aria-label="تحديد جميع سجلات العمليات"
                      className="w-4 h-4 rounded border-slate-300 accent-purple-700 cursor-pointer disabled:opacity-40"
                    />
                  </th>
                  <th className="py-2.5 px-3">التوقيت والتاريخ</th>
                  <th className="py-2.5 px-3">نوع العملية</th>
                  <th className="py-2.5 px-3">تفاصيل الإجراء</th>
                  <th className="py-2.5 px-3">المسؤول المنفذ</th>
                  <th className="py-2.5 px-2 text-center w-14">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      لم يتم تسجيل عمليات بعد في سجل التدقيق.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => {
                    const logDocId = log.docId || log.id;
                    const isSelected = selectedAuditIds.includes(logDocId);
                    return (
                      <tr
                        key={logDocId}
                        className={`transition-colors ${
                          isSelected ? 'bg-purple-50/60 hover:bg-purple-50' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectAuditLog(logDocId)}
                            aria-label={`تحديد سجل ${log.actionLabel}`}
                            className="w-4 h-4 rounded border-slate-300 accent-purple-700 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                          {new Date(log.timestamp).toLocaleString('ar-YE')}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.action.includes('delete')
                              ? 'bg-red-100 text-red-800'
                              : log.action.includes('add') || log.action.includes('create')
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}>
                            {log.actionLabel}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-700 leading-relaxed font-semibold">
                          {log.details}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {log.adminName || 'المسؤول'} ({log.adminEmail || 'admin'})
                        </td>
                        <td className="py-3 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => setAuditDeleteModal({ mode: 'single', targetLog: log })}
                            disabled={isDeletingAuditLogs}
                            title="حذف هذا السجل"
                            aria-label={`حذف سجل ${log.actionLabel}`}
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 cursor-pointer inline-flex items-center justify-center transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: EXCEL EXPORT & EMAIL SETTINGS */}
      {activeTab === 'excel' && (
        <div className="space-y-6">
          {exportNotice && (
            <div className={`p-4 rounded-2xl border text-xs leading-relaxed flex items-start gap-2.5 animate-in fade-in ${
              exportNotice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              {exportNotice.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />}
              <div>{exportNotice.message}</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 flex flex-col justify-between">
              <div>
                <Mail className="w-8 h-8 text-emerald-600 mb-2" />
                <h4 className="text-xs font-bold text-slate-800">البريد الإلكتروني المعتمد</h4>
                <div className="mt-2 p-2 bg-white rounded-xl border border-emerald-200 font-mono text-xs text-emerald-900 font-bold select-all">
                  {adminSettings.recipientEmail || 'abdulrahmanalshaiby2028@gmail.com'}
                </div>
              </div>
              <span className="text-[11px] text-emerald-700 mt-3 font-semibold">
                التصدير اليومي: {adminSettings.autoExportEnabled ? 'مفعل يومياً 🟢' : 'متوقف'}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col justify-between">
              <div>
                <Send className="w-8 h-8 text-rose-600 mb-2" />
                <h4 className="text-xs font-bold text-slate-800">إرسال تقرير Excel للإيميل فوراً</h4>
                <p className="text-[11px] text-slate-500 mt-1">توليد ملف Excel وإرساله فوراً للبريد الإلكتروني.</p>
              </div>
              <button
                onClick={handleTriggerExportNow}
                disabled={isExportingNow}
                className="mt-3 w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isExportingNow ? 'جاري الإرسال...' : 'تصدير وإرسال للإيميل الآن'}</span>
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col justify-between">
              <div>
                <Download className="w-8 h-8 text-sky-600 mb-2" />
                <h4 className="text-xs font-bold text-slate-800">تحميل ملف Excel (.xlsx) على جهازك</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  تنزيل مباشر وشامل لجميع المتبرعين المسجلين في Firebase Firestore.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDirectExcelExport}
                disabled={isDirectExporting}
                className="mt-3 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 text-center disabled:opacity-60 transition-all active:scale-98"
              >
                {isDirectExporting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>{isDirectExporting ? 'جاري جلب البيانات والتنزيل...' : 'تحميل ملف Excel (.xlsx)'}</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <h4 className="font-bold text-slate-900 text-sm">إعدادات الجدولة اليومية</h4>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">البريد المستلم:</label>
                  <input
                    type="email"
                    value={adminSettings.recipientEmail}
                    onChange={(e) => setAdminSettings({ ...adminSettings, recipientEmail: e.target.value })}
                    required
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">وقت الإرسال اليومي:</label>
                  <select
                    value={adminSettings.dailyExportHour}
                    onChange={(e) => setAdminSettings({ ...adminSettings, dailyExportHour: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  >
                    <option value={6}>06:00 صباحاً</option>
                    <option value={8}>08:00 صباحاً (الافتراضي)</option>
                    <option value={12}>12:00 ظهراً</option>
                    <option value={18}>06:00 مساءً</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-800">تشغيل الإرسال اليومي التلقائي في السيرفر</span>
                <input
                  type="checkbox"
                  checked={adminSettings.autoExportEnabled}
                  onChange={(e) => setAdminSettings({ ...adminSettings, autoExportEnabled: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
              </div>

              {settingsSavedMessage && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{settingsSavedMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>حفظ الإعدادات</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 8: SECURITY & PASSWORD */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">تحديث كلمة مرور المسؤول</h4>
                <p className="text-[11px] text-slate-500">حفظ مباشر ومشفر في Firebase Authentication</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور الجديدة (6 خانات على الأقل):</label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="أدخل كلمة مرور قوية وجديدة"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-amber-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تأكيد كلمة المرور الجديدة:</label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور للتأكيد"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-amber-500 font-mono"
                />
              </div>

              {pinChangeError && <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl font-medium">{pinChangeError}</div>}
              {pinChangeSuccess && <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs rounded-xl font-bold">{pinChangeSuccess}</div>}

              <button
                type="submit"
                disabled={isChangingPin}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs cursor-pointer shadow-xs active:scale-98 transition-all disabled:opacity-50"
              >
                {isChangingPin ? 'جاري تحديث كلمة المرور في Firebase...' : 'تحديث وتأمين كلمة المرور'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">هوية ومصادقة المسؤول المعتمد</h4>
                <p className="text-[11px] text-slate-500">حماية الصلاحيات بمعرف UID موثوق</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div>
                <span className="text-[11px] text-slate-500 block mb-0.5">البريد الإلكتروني المعتمد للإدارة:</span>
                <span className="font-mono text-xs font-bold text-slate-900 dir-ltr block bg-white px-3 py-1.5 rounded-lg border border-slate-200 select-all">
                  {adminDisplayEmail || MASTER_ADMIN_EMAIL}
                </span>
              </div>

              {/* Status indicator: Email verified */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                  <span className="font-bold text-slate-700">حالة توثيق البريد الإلكتروني:</span>
                  {isEmailVerified ? (
                    <span className="font-mono text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Email verified = true 🟢</span>
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Email verified = false ⚠️</span>
                    </span>
                  )}
                </div>

                {!isEmailVerified && (
                  <p className="text-[11px] text-slate-500 leading-relaxed pt-1 border-t border-slate-100">
                    لم يتم التحقق من البريد الإلكتروني بعد. اضغط على الزر أدناه لإرسال رسالة تحقق رسمية من Firebase إلى بريدك المعتمد.
                  </p>
                )}
              </div>

              {verificationNotice && (
                <div className={`p-3 rounded-xl text-xs leading-relaxed flex items-start gap-2 animate-in fade-in ${
                  verificationNotice.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {verificationNotice.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <div className="font-medium">{verificationNotice.text}</div>
                </div>
              )}

              {/* Verification Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSendVerificationEmail}
                  disabled={isSendingVerificationEmail}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-700 to-rose-800 hover:from-rose-800 hover:to-rose-900 text-white font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-98 transition-all disabled:opacity-50"
                  title="إرسال رابط تحقق رسمي من خادم Firebase"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{isSendingVerificationEmail ? 'جاري الإرسال...' : 'إرسال رسالة تحقق رسمية إلى البريد المسجل'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleManualCheckVerification}
                  disabled={isCheckingVerification}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 transition-all disabled:opacity-50"
                  title="إعادة فحص وتحديث حالة تفعيل البريد"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingVerification ? 'animate-spin' : ''}`} />
                  <span>{isCheckingVerification ? 'جاري الفحص...' : 'فحص وتحديث حالة التحقق الآن'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/70">
                <span className="text-slate-600">حالة الصلاحيات والتحقق:</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>موثقة من الخادم وقواعد الأمان</span>
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200/70">
                <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                  في حال نسيت كلمة المرور، يمكنك إرسال رابط استعادة وتعيين كلمة مرور مشفر ومباشر إلى بريدك الرسمي:
                </p>

                {resetEmailNotice && (
                  <div className={`p-2.5 rounded-xl text-xs mb-2 ${
                    resetEmailNotice.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {resetEmailNotice.text}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSendAdminResetEmail}
                  disabled={isSendingResetEmail}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 border border-amber-500/20 active:scale-98 transition-all disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isSendingResetEmail ? 'جاري الإرسال...' : 'إرسال رابط استعادة كلمة المرور إلى البريد ✉️'}</span>
                </button>
              </div>

              {/* Status of Admin Code Protection & Concealment */}
              <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200 space-y-2 pt-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <h5 className="text-xs font-bold text-emerald-950">حماية وإخفاء رمز وبوابة المسؤول مفعلة 🛡️</h5>
                </div>
                <ul className="text-[11px] text-emerald-900/90 space-y-1.5 list-disc list-inside leading-relaxed">
                  <li>تم إخفاء أيقونة المسؤول من شريط التنقل السفلي والترويسة لعامة الزوار.</li>
                  <li>تشفير رمز المسؤول بتجزئة salted SHA-256 ومطابقته الآمنة في Firebase Authentication.</li>
                  <li>حظر ومنع تسريب رمز المسؤول في أي رسائل أخطاء برمجية أو استجابات خادم.</li>
                  <li>تفعيل درع الحماية ضد التخمين (Anti-Brute-Force) بالحظر المؤقت التلقائي للمحاولات المتكررة.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: SYSTEM & BACKUPS */}
      {activeTab === 'system' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <h4 className="font-bold text-slate-900 text-sm">النسخ الاحتياطي وإعادة الضبط</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <Download className="w-6 h-6 text-rose-600 mb-2" />
                  <h5 className="text-xs font-bold text-slate-800">تصدير نسخة احتياطية (JSON)</h5>
                  <p className="text-[11px] text-slate-500 mt-1">تنزيل السجلات كاملة على جهازك.</p>
                </div>
                <button
                  onClick={onExportBackup}
                  className="mt-3 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير الآن</span>
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <Upload className="w-6 h-6 text-sky-600 mb-2" />
                  <h5 className="text-xs font-bold text-slate-800">استيراد نسخة احتياطية</h5>
                  <p className="text-[11px] text-slate-500 mt-1">استعادة سجل محفوظ مسبقاً.</p>
                </div>
                <label className="mt-3 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 text-center">
                  <Upload className="w-3.5 h-3.5" />
                  <span>اختيار ملف JSON</span>
                  <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <RefreshCw className="w-6 h-6 text-amber-600 mb-2" />
                  <h5 className="text-xs font-bold text-slate-800">إعادة تعيين البيانات الافتراضية</h5>
                  <p className="text-[11px] text-slate-500 mt-1">استرجاع السجل التجريبي الافتراضي.</p>
                </div>
                <button
                  onClick={() => {
                    if (confirm('هل ترغب حقاً في استعادة السجل التجريبي الافتراضي؟')) {
                      onResetDefaults();
                    }
                  }}
                  className="mt-3 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة ضبط المصنع</span>
                </button>
              </div>
            </div>
          </div>

          {/* IN-APP UPDATE MANAGEMENT CARD */}
          <form
            onSubmit={handleSaveAppUpdateConfig}
            className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center">
                  <ArrowUpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    إدارة تحديثات التطبيق (تحديث مباشر دون حذف النسخة)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    نشر إصدار جديد للأندرويد والويب مع التحقق من التوقيع، البصمة SHA-256، والتوافق قبل التثبيت.
                  </p>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  checked={appUpdateConfig.enabled}
                  onChange={(e) =>
                    setAppUpdateConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-xs font-bold text-slate-800">تفعيل نشر التحديث للمستخدمين</span>
              </label>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 leading-relaxed space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                <span>تنبيه تقني إلزامي للتحديث فوق النسخة الحالية:</span>
              </div>
              <p>
                يجب أن يكون ملف APK الجديد موقعاً بنفس مفتاح التوقيع (Signing Key) وبنفس معرّف الحزمة{' '}
                <span className="font-mono font-bold">org.alnasr.bloodqatabah</span> وبرقم{' '}
                <span className="font-mono font-bold">versionCode</span> أكبر من الإصدار المثبت، ليقوم النظام بتثبيته مع الحفاظ على كافة الحسابات والبيانات والجلسات المسجلة.
              </p>
            </div>

            {isLoadingAppUpdate && (
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>جاري تحميل إعدادات التحديث الحالية...</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Android Release Config */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-700" />
                    <span>إصدار Android (APK)</span>
                  </h5>
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(appUpdateConfig.android.mandatory)}
                      onChange={(e) =>
                        setAppUpdateConfig((prev) => ({
                          ...prev,
                          android: { ...prev.android, mandatory: e.target.checked }
                        }))
                      }
                      className="rounded border-slate-300 text-rose-600"
                    />
                    <span>تحديث إلزامي</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      رقم الإصدار (versionCode)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={appUpdateConfig.android.versionCode}
                      onChange={(e) =>
                        setAppUpdateConfig((prev) => ({
                          ...prev,
                          android: {
                            ...prev.android,
                            versionCode: Math.max(1, parseInt(e.target.value, 10) || 1)
                          }
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      اسم الإصدار (versionName)
                    </label>
                    <input
                      type="text"
                      value={appUpdateConfig.android.versionName}
                      onChange={(e) =>
                        setAppUpdateConfig((prev) => ({
                          ...prev,
                          android: { ...prev.android, versionName: e.target.value }
                        }))
                      }
                      placeholder="1.1.0"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    رابط تنزيل APK المباشر (HTTPS فقط)
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    value={appUpdateConfig.android.downloadUrl}
                    onChange={(e) =>
                      setAppUpdateConfig((prev) => ({
                        ...prev,
                        android: { ...prev.android, downloadUrl: e.target.value }
                      }))
                    }
                    placeholder="https://example.com/releases/blood-qatabah-v1.1.0.apk"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono text-left"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    بصمة التحقق SHA-256 (64 محرفاً)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={appUpdateConfig.android.sha256}
                    onChange={(e) =>
                      setAppUpdateConfig((prev) => ({
                        ...prev,
                        android: { ...prev.android, sha256: e.target.value.trim().toLowerCase() }
                      }))
                    }
                    placeholder="sha256 hex digest from update-manifest.json"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-[11px] font-mono text-left"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      حجم الملف (بايت)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={appUpdateConfig.android.fileSize}
                      onChange={(e) =>
                        setAppUpdateConfig((prev) => ({
                          ...prev,
                          android: {
                            ...prev.android,
                            fileSize: Math.max(0, parseInt(e.target.value, 10) || 0)
                          }
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      أقل SDK مدعوم
                    </label>
                    <input
                      type="number"
                      min={21}
                      max={36}
                      value={appUpdateConfig.android.minSdkVersion}
                      onChange={(e) =>
                        setAppUpdateConfig((prev) => ({
                          ...prev,
                          android: {
                            ...prev.android,
                            minSdkVersion: Math.max(21, parseInt(e.target.value, 10) || 24)
                          }
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      أقل إصدار للترقية
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={appUpdateConfig.android.minUpgradeFromVersionCode}
                      onChange={(e) =>
                        setAppUpdateConfig((prev) => ({
                          ...prev,
                          android: {
                            ...prev.android,
                            minUpgradeFromVersionCode: Math.max(1, parseInt(e.target.value, 10) || 1)
                          }
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    ملاحظات إصدار الأندرويد
                  </label>
                  <textarea
                    rows={2}
                    value={appUpdateConfig.android.releaseNotes || ''}
                    onChange={(e) =>
                      setAppUpdateConfig((prev) => ({
                        ...prev,
                        android: { ...prev.android, releaseNotes: e.target.value }
                      }))
                    }
                    placeholder="تحسينات الأداء وإصلاح الأخطاء..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                  />
                </div>
              </div>

              {/* Web / PWA Release Config */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Server className="w-4 h-4 text-sky-700" />
                      <span>إصدار الويب / PWA</span>
                    </h5>
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(appUpdateConfig.web.mandatory)}
                        onChange={(e) =>
                          setAppUpdateConfig((prev) => ({
                            ...prev,
                            web: { ...prev.web, mandatory: e.target.checked }
                          }))
                        }
                        className="rounded border-slate-300 text-rose-600"
                      />
                      <span>تحديث إلزامي</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        رقم إصدار الويب
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={appUpdateConfig.web.versionCode}
                        onChange={(e) =>
                          setAppUpdateConfig((prev) => ({
                            ...prev,
                            web: {
                              ...prev.web,
                              versionCode: Math.max(1, parseInt(e.target.value, 10) || 1)
                            }
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        اسم إصدار الويب
                      </label>
                      <input
                        type="text"
                        value={appUpdateConfig.web.versionName}
                        onChange={(e) =>
                          setAppUpdateConfig((prev) => ({
                            ...prev,
                            web: { ...prev.web, versionName: e.target.value }
                          }))
                        }
                        placeholder="1.1.0"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ملاحظات إصدار الويب
                    </label>
                    <textarea
                      rows={3}
                      value={appUpdateConfig.web.releaseNotes || ''}
                      onChange={(e) =>
                        setAppUpdateConfig((prev) => ({
                          ...prev,
                          web: { ...prev.web, releaseNotes: e.target.value }
                        }))
                      }
                      placeholder="وصف مختصر للتحديث يظهر للمستخدمين داخل نافذة التحديث..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                    />
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 leading-relaxed">
                  يتم الاحتفاظ ببيانات الحسابات، الجلسة النشطة، والإعدادات المحلية بالكامل أثناء التحديث على كلٍ من Android و Web/PWA.
                </div>
              </div>
            </div>

            {appUpdateNotice && (
              <div
                className={`p-3 rounded-xl text-xs font-bold border ${
                  appUpdateNotice.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {appUpdateNotice.text}
              </div>
            )}

            <div className="flex items-center justify-end pt-1">
              <button
                type="submit"
                disabled={isSavingAppUpdate}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingAppUpdate ? 'جاري الحفظ والنشر...' : 'حفظ ونشر إعدادات التحديث'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* BULK DELETE ALL DONORS MODAL */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs font-['Cairo',sans-serif] animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="text-center">
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                تحذير أمني عالي الخطورة: حذف جميع المتبرعين
              </h3>
              <p className="text-xs text-red-600 font-bold mt-1">
                سيتم حذف كافة المتبرعين المسجلين في السجل ({donors.length} متبرع) نهائياً من قاعدة البيانات السحابية.
              </p>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-[11px] text-red-800 leading-relaxed">
              هذه العملية لا يمكن التراجع عنها. للمتابعة وتأكيد صلاحيتك كمسؤول، يرجى كتابة العبارة التالية بدقة في المربع أدناه:
              <div className="mt-1 font-black text-center text-xs text-red-900 select-all font-mono bg-white p-1.5 rounded-lg border border-red-300">
                تأكيد الحذف الكامل
              </div>
            </div>

            <div>
              <input
                type="text"
                value={deleteAllConfirmationText}
                onChange={(e) => setDeleteAllConfirmationText(e.target.value)}
                placeholder="اكتب هنا: تأكيد الحذف الكامل"
                className="w-full px-3.5 py-2.5 rounded-xl border border-red-300 text-xs sm:text-sm text-center font-bold focus:outline-hidden focus:border-red-600 focus:ring-1 focus:ring-red-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteAllModal(false);
                  setDeleteAllConfirmationText('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteAll}
                disabled={isDeletingAll || deleteAllConfirmationText.trim() !== 'تأكيد الحذف الكامل'}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingAll ? 'جاري الحذف...' : 'حذف جميع المتبرعين نهائياً'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT LOG DELETE CONFIRMATION MODAL */}
      {auditDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs font-['Cairo',sans-serif] animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                {auditDeleteModal.mode === 'all'
                  ? 'تأكيد حذف جميع سجلات العمليات'
                  : auditDeleteModal.mode === 'selected'
                  ? `تأكيد حذف (${selectedAuditIds.length}) سجل محدد`
                  : 'تأكيد حذف سجل العملية'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {auditDeleteModal.mode === 'all'
                  ? `سيتم حذف كافة سجلات العمليات (${auditLogs.length} سجل) من قاعدة بيانات Firebase نهائياً.`
                  : auditDeleteModal.mode === 'selected'
                  ? `سيتم حذف السجلات المحددة (${selectedAuditIds.length} سجل) من قاعدة بيانات Firebase نهائياً.`
                  : `سيتم حذف سجل العملية (${auditDeleteModal.targetLog?.actionLabel || ''}) من قاعدة بيانات Firebase نهائياً.`}
              </p>
            </div>

            {auditDeleteModal.mode === 'single' && auditDeleteModal.targetLog && (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                {auditDeleteModal.targetLog.details}
              </div>
            )}

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11px] text-emerald-900 font-semibold leading-relaxed">
              لن يتم المساس بأي بيانات للمتبرعين أو المستشفيات أو الطلبات أو حسابات المستخدمين عند تنفيذ هذا الإجراء.
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAuditDeleteModal(null)}
                disabled={isDeletingAuditLogs}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAuditLogs}
                disabled={isDeletingAuditLogs}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isDeletingAuditLogs ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{isDeletingAuditLogs ? 'جاري الحذف...' : 'تأكيد الحذف'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
