import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { Droplet, Loader2, Lock } from 'lucide-react';
import { 
  ActivePage, 
  BloodRequest, 
  BloodType, 
  District, 
  Donor, 
  AppNotification, 
  UserRole,
  RequestStatus,
  UserAccount,
  HospitalAd,
  Hospital,
  Doctor,
  UpdateCheckResult,
  UpdateProgressState
} from './types';
import { storageService } from './services/storageService';
import { firestoreService } from './firebase/firestoreService';
import { pushNotificationService } from './services/pushNotificationService';
import {
  appUpdateService,
  clearSnoozedVersion,
  isVersionSnoozedForSession,
  snoozeVersionForSession
} from './services/appUpdateService';
import { saveAndShareFile } from './services/nativeFileSaver';
import {
  NavEntry,
  NavOptions,
  buildInitialNavStack,
  isValidActivePage,
  pushNavEntry,
  popNavEntry,
  resetNavStack,
  sanitizeRestoredStack
} from './lib/navigationStack.js';
import { nativeNavigationService } from './services/nativeNavigationService';
import { backHandlerRegistry, useRegisterBackHandler } from './services/backHandlerRegistry';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { SidebarDrawer } from './components/SidebarDrawer';
import { AddDonorModal } from './components/AddDonorModal';
import { AddRequestModal } from './components/AddRequestModal';
import { DonorProfileModal } from './components/DonorProfileModal';
import { RequestDetailsModal } from './components/RequestDetailsModal';
import { NotificationModal } from './components/NotificationModal';
import { RoleSwitcherModal } from './components/RoleSwitcherModal';
import { InstallAppModal } from './components/InstallAppModal';
import { ImportDonorsModal } from './components/ImportDonorsModal';
import { PushPromptModal } from './components/PushPromptModal';
import { AppUpdateModal } from './components/AppUpdateModal';
import { HomePage } from './pages/HomePage';
import { DonorsPage } from './pages/DonorsPage';
import { RequestsPage } from './pages/RequestsPage';
import { DonationInfoPage } from './pages/DonationInfoPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { DistrictsPage } from './pages/DistrictsPage';
import { ProfilePage } from './pages/ProfilePage';
import { DonationHistoryPage } from './pages/DonationHistoryPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { HospitalAdDetailPage } from './pages/HospitalAdDetailPage';
import { HospitalsPage } from './pages/HospitalsPage';
import { HospitalDoctorsPage } from './pages/HospitalDoctorsPage';

// Offline Audio Chime using Web Audio API
function playAlertChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.15); // A5
    gain2.gain.setValueAtTime(0.2, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.5);
  } catch {
    // Ignore audio permission restrictions
  }
}

export default function App() {
  // Navigation, User & Role State with permanent persistence
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => storageService.getCurrentUser());
  const [role, setRole] = useState<UserRole>(() => storageService.getRole());
  const [isAuthReady, setIsAuthReady] = useState<boolean>(() => {
    // If local storage already has valid user session, we can start immediately
    return Boolean(storageService.getCurrentUser());
  });
  const [isLoadingDonors, setIsLoadingDonors] = useState<boolean>(false);
  const [donorLoadError, setDonorLoadError] = useState<string | null>(null);
  const [isAdminLoginView, setIsAdminLoginView] = useState<boolean>(false);
  const [selectedHospitalAdId, setSelectedHospitalAdId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('qaatabah_selected_hospital_ad_id_v1');
    } catch {
      return null;
    }
  });
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('qaatabah_selected_hospital_id_v1');
    } catch {
      return null;
    }
  });

  const [historyStack, setHistoryStack] = useState<NavEntry[]>(() => {
    let initialPage: ActivePage = 'home';
    const user = storageService.getCurrentUser();
    try {
      const saved = localStorage.getItem('qaatabah_blood_last_page_v1') as ActivePage | null;
      if (saved && isValidActivePage(saved)) {
        if ((saved === 'admin' || saved === 'districts') && user?.role !== 'admin') {
          initialPage = 'home';
        } else {
          initialPage = saved;
        }
      } else {
        initialPage = user?.role === 'admin' ? 'admin' : 'home';
      }
    } catch {
      initialPage = 'home';
    }

    let initialAdId: string | null = null;
    let initialHospitalId: string | null = null;
    try {
      initialAdId = localStorage.getItem('qaatabah_selected_hospital_ad_id_v1');
      initialHospitalId = localStorage.getItem('qaatabah_selected_hospital_id_v1');
    } catch {}

    return buildInitialNavStack(initialPage, {
      userRole: user?.role === 'admin' ? 'admin' : 'user',
      hospitalAdId: initialAdId,
      hospitalId: initialHospitalId
    });
  });

  const historyStackRef = useRef<NavEntry[]>(historyStack);
  historyStackRef.current = historyStack;

  const currentEntry = historyStack[historyStack.length - 1];
  const activePage = currentEntry.page;
  const previousEntry = historyStack.length > 1 ? historyStack[historyStack.length - 2] : null;

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Scroll preservation per history entry key
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const pendingScrollRestoreRef = useRef<{ y: number; behavior: ScrollBehavior } | null>(null);
  const ignorePopstateCountRef = useRef<number>(0);
  const [historyGuardRevision, setHistoryGuardRevision] = useState(0);

  // Persist active page across reloads
  useEffect(() => {
    try {
      localStorage.setItem('qaatabah_blood_last_page_v1', activePage);
    } catch {}
  }, [activePage]);

  // Disable native browser scroll restoration so per-entry scrollPositionsRef stays exact,
  // and mirror the initial Navigation Stack entries into window.history.
  useEffect(() => {
    try {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
      const initialStack = historyStackRef.current;
      const first = initialStack[0];
      if (first) {
        window.history.replaceState(
          {
            appNav: true,
            depth: 1,
            key: first.key,
            page: first.page,
            stack: initialStack.slice(0, 1),
            isOverlay: false
          },
          ''
        );
      }
      for (let i = 1; i < initialStack.length; i += 1) {
        const entry = initialStack[i];
        window.history.pushState(
          {
            appNav: true,
            depth: i + 1,
            key: entry.key,
            page: entry.page,
            stack: initialStack.slice(0, i + 1),
            isOverlay: false
          },
          ''
        );
      }
    } catch {}
  }, []);

  // Restore scroll position synchronously after React toggles hidden/block wrappers
  useLayoutEffect(() => {
    const pending = pendingScrollRestoreRef.current;
    if (!pending) return;
    pendingScrollRestoreRef.current = null;
    window.scrollTo({ top: pending.y, behavior: pending.behavior });
    const rafId = requestAnimationFrame(() => {
      window.scrollTo({ top: pending.y, behavior: 'auto' });
    });
    return () => cancelAnimationFrame(rafId);
  }, [currentEntry.key]);

  const navigateToPage = useCallback((page: ActivePage, options: NavOptions = {}) => {
    if (!isValidActivePage(page)) {
      return;
    }

    const currentStack = historyStackRef.current;
    const current = currentStack[currentStack.length - 1];
    const res = pushNavEntry(currentStack, page, options);

    if (!res.changed) {
      return;
    }

    if (current) {
      scrollPositionsRef.current[current.key] = window.scrollY;
    }
    pendingScrollRestoreRef.current = { y: 0, behavior: 'auto' };

    historyStackRef.current = res.stack;
    setHistoryStack(res.stack);

    try {
      const nextState = {
        appNav: true,
        depth: res.stack.length,
        key: res.current.key,
        page: res.current.page,
        stack: res.stack,
        isOverlay: false
      };
      if (window.history.state?.isOverlay) {
        window.history.replaceState(nextState, '');
      } else {
        window.history.pushState(nextState, '');
      }
    } catch {}
  }, []);

  const resetHistoryStack = useCallback((initialPage: ActivePage = 'home', options: NavOptions = {}) => {
    const nextStack = resetNavStack(initialPage, options);
    scrollPositionsRef.current = {};
    pendingScrollRestoreRef.current = { y: 0, behavior: 'auto' };
    historyStackRef.current = nextStack;
    setHistoryStack(nextStack);

    try {
      window.history.replaceState(
        {
          appNav: true,
          depth: 1,
          key: nextStack[0].key,
          page: nextStack[0].page,
          stack: nextStack,
          isOverlay: false
        },
        ''
      );
    } catch {}
  }, []);

  // Core Data loaded from offline storage
  const [donors, setDonors] = useState<Donor[]>([]);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [hospitalAds, setHospitalAds] = useState<HospitalAd[]>([]);
  const [selectedHospitalAd, setSelectedHospitalAd] = useState<HospitalAd | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);

  const handleSelectHospitalAd = (ad: HospitalAd) => {
    setSelectedHospitalAd(ad);
    setSelectedHospitalAdId(ad.id);
    try {
      localStorage.setItem('qaatabah_selected_hospital_ad_id_v1', ad.id);
    } catch {}
    navigateToPage('hospital-ad', { hospitalAdId: ad.id });
  };

  const handleSelectHospital = (hospital: Hospital) => {
    setSelectedHospital(hospital);
    setSelectedHospitalId(hospital.id);
    try {
      localStorage.setItem('qaatabah_selected_hospital_id_v1', hospital.id);
    } catch {}
    navigateToPage('hospital-doctors', { hospitalId: hospital.id });
  };

  // Centralized Donor Refresh Directly from Firebase Firestore
  const refreshDonors = useCallback(async () => {
    setIsLoadingDonors(true);
    setDonorLoadError(null);
    try {
      const freshDonors = await firestoreService.fetchDonors();
      if (Array.isArray(freshDonors) && freshDonors.length > 0) {
        setDonors(freshDonors);
        storageService.setLocalDonors(freshDonors);
      }
    } catch (err: any) {
      console.warn('refreshDonors warning:', err);
      setDonorLoadError('تعذر جلب بيانات المتبرعين من قاعدة البيانات السحابية. يرجى التحقق من اتصال الإنترنت.');
    } finally {
      setIsLoadingDonors(false);
    }
  }, []);

  // Modals
  const [isAddDonorOpen, setIsAddDonorOpen] = useState(false);
  const [donorToEdit, setDonorToEdit] = useState<Donor | null>(null);
  const [isAddRequestOpen, setIsAddRequestOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPushPromptOpen, setIsPushPromptOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Selected details
  const [selectedDonor, setSelectedDonor] = useState<Donor | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<BloodRequest | null>(null);

  // Shared blood filter
  const [selectedBloodFilter, setSelectedBloodFilter] = useState<BloodType | null>(null);
  const [bloodFilterToken, setBloodFilterToken] = useState<number>(0);

  // Toast alert
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // In-App Update System State
  const [updateCheckResult, setUpdateCheckResult] = useState<UpdateCheckResult | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateProgressState, setUpdateProgressState] = useState<UpdateProgressState>({
    phase: 'idle',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0
  });

  // Back handler registry subscription (page-local modals & subviews)
  const [hasRegisteredOverlay, setHasRegisteredOverlay] = useState(() =>
    backHandlerRegistry.hasActiveHandlers()
  );

  useEffect(() => {
    return backHandlerRegistry.subscribe(() => {
      setHasRegisteredOverlay(backHandlerRegistry.hasActiveHandlers());
    });
  }, []);

  useRegisterBackHandler(
    'prelogin-admin-view',
    !currentUser && isAdminLoginView,
    () => setIsAdminLoginView(false),
    10
  );

  const runAppUpdateCheck = useCallback(async (manual = false, swWaitingReady = false) => {
    try {
      const result = await appUpdateService.checkForUpdates({ swWaitingReady });
      setUpdateCheckResult(result);

      const targetVersionCode =
        result.platform === 'android'
          ? result.remoteConfig?.android?.versionCode || 0
          : result.remoteConfig?.web?.versionCode || 0;
      const isMandatory =
        result.platform === 'android'
          ? Boolean(result.remoteConfig?.android?.mandatory)
          : Boolean(result.remoteConfig?.web?.mandatory);

      if (result.updateAvailable) {
        if (manual || isMandatory || !isVersionSnoozedForSession(targetVersionCode)) {
          setUpdateProgressState({
            phase: 'available',
            progress: 0,
            downloadedBytes: 0,
            totalBytes: result.remoteConfig?.android?.fileSize || 0
          });
          setIsUpdateModalOpen(true);
        }
      } else if (manual) {
        if (!result.compatible && result.compatibility.reasonMessage) {
          setUpdateProgressState({
            phase: 'available',
            progress: 0,
            downloadedBytes: 0,
            totalBytes: 0
          });
          setIsUpdateModalOpen(true);
        } else {
          setToastMessage(`أنت تستخدم أحدث إصدار من التطبيق (v${result.installed.versionName}) ✅`);
          setTimeout(() => setToastMessage(null), 3500);
        }
      }
    } catch {
      if (manual) {
        setToastMessage('تعذر التحقق من التحديثات حالياً. يرجى التأكد من اتصال الإنترنت.');
        setTimeout(() => setToastMessage(null), 3500);
      }
    }
  }, []);

  const handleStartAppUpdate = useCallback(async () => {
    if (!updateCheckResult) return;
    clearSnoozedVersion();
    await appUpdateService.downloadAndInstallUpdate(updateCheckResult, setUpdateProgressState);
  }, [updateCheckResult]);

  const handleRetryInstallPermission = useCallback(async () => {
    await appUpdateService.retryInstallAfterPermission(setUpdateProgressState);
  }, []);

  const handleOpenInstallPermissionSettings = useCallback(async () => {
    await appUpdateService.openInstallPermissionSettings();
  }, []);

  const handleDismissUpdateLater = useCallback(() => {
    if (updateCheckResult) {
      const targetCode =
        updateCheckResult.platform === 'android'
          ? updateCheckResult.remoteConfig?.android?.versionCode || 0
          : updateCheckResult.remoteConfig?.web?.versionCode || 0;
      if (targetCode > 0) {
        snoozeVersionForSession(targetCode);
      }
    }
    setIsUpdateModalOpen(false);
  }, [updateCheckResult]);

  const handleCancelUpdateDownload = useCallback(async () => {
    await appUpdateService.cancelDownload();
    setUpdateProgressState({
      phase: 'available',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0
    });
  }, []);

  // Initialize data on mount, sync with server, and listen for PWA install prompt
  useEffect(() => {
    // 0. Auto-register device for FCM push notifications if permission is granted, or prompt if new
    try {
      setTimeout(() => {
        pushNotificationService.autoRegisterPushNotifications().catch(() => {});
      }, 600);
      if (pushNotificationService.isSupported()) {
        const currentPerm = pushNotificationService.getPermissionSync();
        const dismissed = localStorage.getItem('qaatabah_push_prompt_dismissed_v1');
        if (currentPerm === 'default' && !dismissed) {
          setTimeout(() => {
            setIsPushPromptOpen(true);
          }, 1500);
        }
      }
    } catch {}

    // 1. Initial fast load from local storage
    const localD = storageService.getDonors();
    if (localD.length > 0) setDonors(localD);
    setRequests(storageService.getRequests());
    setDistricts(storageService.getDistricts());
    setNotifications(storageService.getNotifications());
    const localAds = storageService.getLocalHospitalAds();
    if (localAds.length > 0) setHospitalAds(localAds);
    storageService.getHospitalAds().then((freshAds) => {
      if (Array.isArray(freshAds)) {
        setHospitalAds(freshAds);
      }
    }).catch(() => {});

    const localHospitals = storageService.getLocalHospitals();
    if (localHospitals.length > 0) setHospitals(localHospitals);
    storageService.getHospitals().then((freshHospitals) => {
      if (Array.isArray(freshHospitals)) {
        setHospitals(freshHospitals);
      }
    }).catch(() => {});

    const localDoctors = storageService.getLocalDoctors();
    if (localDoctors.length > 0) setDoctors(localDoctors);
    storageService.getDoctors().then((freshDoctors) => {
      if (Array.isArray(freshDoctors)) {
        setDoctors(freshDoctors);
      }
    }).catch(() => {});
    const savedUser = storageService.getCurrentUser();
    if (savedUser) {
      setCurrentUser(savedUser);
      setRole(savedUser.role);
      // Refresh user profile (including photoUrl and linkedDonorId) from Firestore
      if (savedUser.id) {
        firestoreService.fetchUserById(savedUser.id).then((remoteUser) => {
          if (remoteUser && remoteUser.id === savedUser.id) {
            const mergedUser = { ...savedUser, ...remoteUser };
            setCurrentUser(mergedUser);
            setRole(mergedUser.role);
            storageService.setCurrentUser(mergedUser);
          }
        }).catch(() => {});
      }
    } else {
      setRole(storageService.getRole());
    }

    // 2. Fetch fresh donors from Firestore immediately and seed if cloud database is empty
    firestoreService.seedInitialDataIfEmpty(
      localD,
      storageService.getRequests(),
      storageService.getDistricts(),
      storageService.getLocalUsers()
    ).then(() => {
      firestoreService.confirmMasterAdminInFirestore().catch(() => {});
      refreshDonors();
    }).catch(() => {
      firestoreService.confirmMasterAdminInFirestore().catch(() => {});
      refreshDonors();
    });

    // 3. Real-time live synchronization with Firebase Firestore
    const unsubscribeDonors = firestoreService.subscribeDonors(
      (liveDonors) => {
        if (Array.isArray(liveDonors)) {
          setDonors(liveDonors);
          storageService.setLocalDonors(liveDonors);
          setDonorLoadError(null);
          setIsLoadingDonors(false);
        }
      },
      (error) => {
        console.warn('Firestore live donors listener error:', error);
        setDonorLoadError('تعذر الاتصال بقاعدة بيانات المتبرعين السحابية');
        setIsLoadingDonors(false);
      }
    );

    let initialRequestsLoaded = false;
    const unsubscribeRequests = firestoreService.subscribeRequests((liveRequests) => {
      if (Array.isArray(liveRequests) && liveRequests.length > 0) {
        if (initialRequestsLoaded) {
          // Check for newly added open requests and trigger notification
          const currentIds = new Set(storageService.getRequests().map((r) => r.id));
          liveRequests.forEach((req) => {
            if (!currentIds.has(req.id) && req.status === 'open') {
              pushNotificationService.notifyForRequest(req);
            }
          });
        }
        initialRequestsLoaded = true;
        setRequests(liveRequests);
        storageService.setLocalRequests(liveRequests);
      }
    });

    const unsubscribeDistricts = firestoreService.subscribeDistricts((liveDistricts) => {
      if (Array.isArray(liveDistricts) && liveDistricts.length > 0) {
        setDistricts(liveDistricts);
        storageService.setLocalDistricts(liveDistricts);
      }
    });

    const unsubscribeNotifications = firestoreService.subscribeNotifications((liveNotifs) => {
      if (Array.isArray(liveNotifs) && liveNotifs.length > 0) {
        setNotifications(liveNotifs);
        storageService.setLocalNotifications(liveNotifs);
      }
    });

    const unsubscribeHospitalAds = firestoreService.subscribeHospitalAds((liveAds) => {
      if (Array.isArray(liveAds) && liveAds.length > 0) {
        setHospitalAds(liveAds);
        storageService.setLocalHospitalAds(liveAds);
      } else {
        storageService.getHospitalAds().then((merged) => {
          setHospitalAds(merged);
        }).catch(() => {});
      }
    });

    const unsubscribeHospitals = firestoreService.subscribeHospitals((liveHospitals) => {
      if (Array.isArray(liveHospitals) && liveHospitals.length > 0) {
        setHospitals(liveHospitals);
        storageService.setLocalHospitals(liveHospitals);
      } else {
        storageService.getHospitals().then((merged) => {
          setHospitals(merged);
        }).catch(() => {});
      }
    });

    const unsubscribeDoctors = firestoreService.subscribeDoctors((liveDoctors) => {
      if (Array.isArray(liveDoctors) && liveDoctors.length > 0) {
        setDoctors(liveDoctors);
        storageService.setLocalDoctors(liveDoctors);
      } else {
        storageService.getDoctors().then((merged) => {
          setDoctors(merged);
        }).catch(() => {});
      }
    });

    // 4. Persistent Firebase Auth state listener with automatic admin session restoration
    const unsubscribeAuth = firestoreService.subscribeAuthState(async (authUser) => {
      if (authUser) {
        setCurrentUser(authUser);
        setRole(authUser.role);
        storageService.setCurrentUser(authUser);
        storageService.setRole(authUser.role);

        // Pre-fetch and cache fresh admin ID token if administrator
        if (authUser.role === 'admin') {
          try {
            await storageService.getAdminAuthHeaders(false);
          } catch {}
        }
      }
      setIsAuthReady(true);
    });

    // Safety fallback: Ensure auth check resolves within 1.2s max
    const authTimer = setTimeout(() => {
      setIsAuthReady(true);
    }, 1200);

    // 5. Centralized background sync for server notifications and backups
    const sync = async () => {
      const serverData = await storageService.syncFromServer();
      if (serverData.online && serverData.notifications) {
        setNotifications(serverData.notifications);
      }
      if (serverData.online && Array.isArray(serverData.donors) && serverData.donors.length > 0) {
        setDonors((prev) => (prev.length === 0 ? serverData.donors : prev));
      }
      if (serverData.online) {
        storageService.getHospitals().then((mergedHospitals) => {
          setHospitals(mergedHospitals);
        }).catch(() => {});
        storageService.getDoctors().then((mergedDoctors) => {
          setDoctors(mergedDoctors);
        }).catch(() => {});
      }
    };
    sync();

    // 6. Periodic background sync every 45s
    const interval = setInterval(sync, 45000);

    // 7. Auto-detect internet reconnection and resync automatically
    const handleOnline = () => {
      setDonorLoadError(null);
      refreshDonors();
      storageService.syncFromServer();
      triggerToast('تمت استعادة الاتصال بالإنترنت ومزامنة البيانات تلقائياً 🟢');
    };

    const handleOffline = () => {
      triggerToast('أنت الآن في وضع عدم الاتصال (أوفلاين) 📶 السجل متاح ومحفوظ');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // 8. Check for app updates on startup & clean stale cached APKs without touching user data/session
    appUpdateService.cleanupNativeUpdateCache().catch(() => {});
    const startupUpdateTimer = setTimeout(() => {
      runAppUpdateCheck(false, false);
    }, 1800);
    const handleSwUpdateReady = () => {
      runAppUpdateCheck(false, true);
    };
    window.addEventListener('APP_SW_UPDATE_AVAILABLE', handleSwUpdateReady);

    return () => {
      unsubscribeDonors();
      unsubscribeRequests();
      unsubscribeDistricts();
      unsubscribeNotifications();
      unsubscribeHospitalAds();
      unsubscribeHospitals();
      unsubscribeDoctors();
      unsubscribeAuth();
      clearTimeout(authTimer);
      clearTimeout(startupUpdateTimer);
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('APP_SW_UPDATE_AVAILABLE', handleSwUpdateReady);
    };
  }, [refreshDonors, runAppUpdateCheck]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    playAlertChime();
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleUpdateUser = async (updatedUser: UserAccount) => {
    setCurrentUser(updatedUser);
    storageService.setCurrentUser(updatedUser);
    const localUsers = storageService.getLocalUsers();
    const nextUsers = localUsers.some((u) => u.id === updatedUser.id)
      ? localUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u))
      : [...localUsers, updatedUser];
    storageService.saveLocalUsers(nextUsers);
    await firestoreService.setUser(updatedUser);
  };

  const syncDetailSelectionForEntry = useCallback(
    (entry: NavEntry) => {
      if (entry.page === 'hospital-ad' && entry.hospitalAdId) {
        setSelectedHospitalAdId(entry.hospitalAdId);
        try {
          localStorage.setItem('qaatabah_selected_hospital_ad_id_v1', entry.hospitalAdId);
        } catch {}
        const matched = hospitalAds.find((ad) => ad.id === entry.hospitalAdId) || null;
        if (matched) setSelectedHospitalAd(matched);
      }

      if (entry.page === 'hospital-doctors' && entry.hospitalId) {
        setSelectedHospitalId(entry.hospitalId);
        try {
          localStorage.setItem('qaatabah_selected_hospital_id_v1', entry.hospitalId);
        } catch {}
        const matchedHosp = hospitals.find((h) => h.id === entry.hospitalId) || null;
        if (matchedHosp) setSelectedHospital(matchedHosp);
      }
    },
    [hospitalAds, hospitals]
  );

  const popStackEntryAndRestore = useCallback(
    (fromPopstate: boolean): boolean => {
      const currentStack = historyStackRef.current;
      const currentTop = currentStack[currentStack.length - 1];
      const res = popNavEntry(currentStack);
      if (!res.canGoBack || !res.current) {
        return false;
      }

      if (fromPopstate && currentTop) {
        scrollPositionsRef.current[currentTop.key] = window.scrollY;
      } else if (res.popped) {
        delete scrollPositionsRef.current[res.popped.key];
      }

      const restoredY = scrollPositionsRef.current[res.current.key] ?? 0;
      pendingScrollRestoreRef.current = { y: restoredY, behavior: 'auto' };
      syncDetailSelectionForEntry(res.current);

      historyStackRef.current = res.stack;
      setHistoryStack(res.stack);

      if (!fromPopstate) {
        try {
          if (typeof window.history.state?.depth === 'number' && window.history.state.depth > 1) {
            ignorePopstateCountRef.current += 1;
            window.history.back();
          }
        } catch {}
      }

      return true;
    },
    [syncDetailSelectionForEntry]
  );

  const goBack = useCallback(
    (fallbackPage?: ActivePage) => {
      if (popStackEntryAndRestore(false)) {
        return true;
      }
      if (fallbackPage && fallbackPage !== historyStackRef.current[historyStackRef.current.length - 1]?.page) {
        navigateToPage(fallbackPage);
        return true;
      }
      return false;
    },
    [popStackEntryAndRestore, navigateToPage]
  );

  const hasGlobalOverlay =
    isUpdateModalOpen ||
    isPushPromptOpen ||
    isImportModalOpen ||
    isInstallModalOpen ||
    isRoleModalOpen ||
    isNotificationsOpen ||
    isAddDonorOpen ||
    isAddRequestOpen ||
    Boolean(selectedDonor) ||
    Boolean(selectedRequest) ||
    isSidebarOpen;

  const anyOverlayOpen = hasGlobalOverlay || hasRegisteredOverlay;
  const prevAnyOverlayOpenRef = useRef(anyOverlayOpen);

  // Synchronize browser history guard entry when overlays/drawers open or close
  useEffect(() => {
    const wasOpen = prevAnyOverlayOpenRef.current;
    prevAnyOverlayOpenRef.current = anyOverlayOpen;

    try {
      if (anyOverlayOpen && (!wasOpen || !window.history.state?.isOverlay)) {
        if (!window.history.state?.isOverlay) {
          const current = historyStackRef.current[historyStackRef.current.length - 1];
          window.history.pushState(
            {
              appNav: true,
              depth: historyStackRef.current.length,
              key: current?.key || 'root',
              page: current?.page || 'home',
              stack: historyStackRef.current,
              isOverlay: true
            },
            ''
          );
        }
      } else if (!anyOverlayOpen && wasOpen) {
        if (window.history.state?.isOverlay) {
          ignorePopstateCountRef.current += 1;
          window.history.back();
        }
      }
    } catch {}
  }, [anyOverlayOpen, historyGuardRevision]);

  const closeTopOverlayRef = useRef<() => 'none' | 'closed' | 'blocked'>(() => 'none');
  closeTopOverlayRef.current = () => {
    if (isUpdateModalOpen) {
      const isAndroidUpdate = updateCheckResult?.platform === 'android';
      const isMandatoryUpdate = Boolean(
        isAndroidUpdate
          ? updateCheckResult?.remoteConfig?.android?.mandatory
          : updateCheckResult?.remoteConfig?.web?.mandatory
      );
      const phase = updateProgressState.phase;
      const isUpdateBusy =
        phase === 'downloading' ||
        phase === 'verifying' ||
        phase === 'ready_to_install' ||
        phase === 'installing';

      if (!isMandatoryUpdate && !isUpdateBusy) {
        handleDismissUpdateLater();
        return 'closed';
      }
      return 'blocked';
    }
    if (isPushPromptOpen) {
      setIsPushPromptOpen(false);
      return 'closed';
    }
    if (isImportModalOpen) {
      setIsImportModalOpen(false);
      return 'closed';
    }
    if (isInstallModalOpen) {
      setIsInstallModalOpen(false);
      return 'closed';
    }
    if (isRoleModalOpen) {
      setIsRoleModalOpen(false);
      return 'closed';
    }
    if (isNotificationsOpen) {
      setIsNotificationsOpen(false);
      return 'closed';
    }
    if (isAddDonorOpen) {
      setIsAddDonorOpen(false);
      setDonorToEdit(null);
      return 'closed';
    }
    if (isAddRequestOpen) {
      setIsAddRequestOpen(false);
      return 'closed';
    }
    if (selectedDonor) {
      setSelectedDonor(null);
      return 'closed';
    }
    if (selectedRequest) {
      setSelectedRequest(null);
      return 'closed';
    }
    if (backHandlerRegistry.handleTop()) {
      return 'closed';
    }
    if (isSidebarOpen) {
      setIsSidebarOpen(false);
      return 'closed';
    }
    return 'none';
  };

  // Expose synchronous native Android back bridge + handle Web browser popstate
  useEffect(() => {
    const handleNativeBack = (): boolean => {
      const overlayOutcome = closeTopOverlayRef.current();
      if (overlayOutcome === 'closed' || overlayOutcome === 'blocked') {
        return true;
      }
      if (popStackEntryAndRestore(false)) {
        return true;
      }
      return false;
    };

    const handlePopState = (event: PopStateEvent) => {
      if (ignorePopstateCountRef.current > 0) {
        ignorePopstateCountRef.current -= 1;
        return;
      }

      const overlayOutcome = closeTopOverlayRef.current();
      if (overlayOutcome === 'closed' || overlayOutcome === 'blocked') {
        setHistoryGuardRevision((n) => n + 1);
        return;
      }

      const currentStack = historyStackRef.current;
      const currentTop = currentStack[currentStack.length - 1];

      // Support multi-step browser Back AND browser Forward by reading sanitized stack from history state
      const restoredStack = sanitizeRestoredStack(event.state?.stack);
      if (restoredStack && restoredStack.length > 0) {
        const nextTop = restoredStack[restoredStack.length - 1];
        if (!currentTop || nextTop.key !== currentTop.key || restoredStack.length !== currentStack.length) {
          if (currentTop) {
            scrollPositionsRef.current[currentTop.key] = window.scrollY;
          }
          const restoredY = scrollPositionsRef.current[nextTop.key] ?? 0;
          pendingScrollRestoreRef.current = { y: restoredY, behavior: 'auto' };
          syncDetailSelectionForEntry(nextTop);
          historyStackRef.current = restoredStack;
          setHistoryStack(restoredStack);
        }
        return;
      }

      const stateDepth = typeof event.state?.depth === 'number' ? event.state.depth : null;
      if (stateDepth !== null && stateDepth >= currentStack.length) {
        return;
      }

      popStackEntryAndRestore(true);
    };

    (window as any).__handleAppNativeBack = handleNativeBack;
    (window as any).__appBackHandlerReady = true;
    window.addEventListener('popstate', handlePopState);

    return () => {
      (window as any).__appBackHandlerReady = false;
      try {
        delete (window as any).__handleAppNativeBack;
      } catch {}
      window.removeEventListener('popstate', handlePopState);
    };
  }, [popStackEntryAndRestore, syncDetailSelectionForEntry]);

  const handleLogout = () => {
    setIsSidebarOpen(false);
    setSelectedDonor(null);
    setSelectedRequest(null);
    setIsAddDonorOpen(false);
    setIsAddRequestOpen(false);
    setIsNotificationsOpen(false);
    setIsRoleModalOpen(false);
    setIsInstallModalOpen(false);
    setIsImportModalOpen(false);
    setIsAdminLoginView(false);
    storageService.logout();
    setCurrentUser(null);
    setRole('user');
    resetHistoryStack('home');
    triggerToast('تم تسجيل الخروج بنجاح 👋');
  };

  // Deep link detection from push notification clicks (URL query param ?openRequest=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const reqId = params.get('openRequest');
      if (reqId) {
        const targetReq = requests.find((r) => r.id === reqId) || storageService.getRequests().find((r) => r.id === reqId);
        if (targetReq) {
          setSelectedRequest(targetReq);
          navigateToPage('requests');
          // Clean query params from URL without page reload
          const url = new URL(window.location.href);
          url.searchParams.delete('openRequest');
          window.history.replaceState(window.history.state || {}, '', url.pathname + (url.search ? url.search : ''));
        } else {
          firestoreService.fetchRequests().then((fresh) => {
            const found = fresh.find((r) => r.id === reqId);
            if (found) {
              setSelectedRequest(found);
              navigateToPage('requests');
              const url = new URL(window.location.href);
              url.searchParams.delete('openRequest');
              window.history.replaceState(window.history.state || {}, '', url.pathname + (url.search ? url.search : ''));
            }
          }).catch(() => {});
        }
      }
    } catch {}
  }, [requests, navigateToPage]);

  // Service Worker message listener for OPEN_REQUEST_NOTIFICATION
  useEffect(() => {
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'OPEN_REQUEST_NOTIFICATION' && event.data.requestId) {
        const reqId = event.data.requestId;
        const targetReq = requests.find((r) => r.id === reqId) || storageService.getRequests().find((r) => r.id === reqId);
        if (targetReq) {
          setSelectedRequest(targetReq);
          navigateToPage('requests');
        } else {
          firestoreService.fetchRequests().then((fresh) => {
            const found = fresh.find((r) => r.id === reqId);
            if (found) {
              setSelectedRequest(found);
              navigateToPage('requests');
            }
          }).catch(() => {});
        }
      }
    };

    const handlePushEvent = (e: any) => {
      const detail = e.detail;
      const title = detail?.title || '🚨 نداء دم عاجل';
      const body = detail?.body || '';
      triggerToast(`${title}: ${body}`);
    };

    const handleOpenReqEvent = (e: any) => {
      const reqId = e.detail?.requestId;
      if (reqId) {
        const targetReq = requests.find((r) => r.id === reqId) || storageService.getRequests().find((r) => r.id === reqId);
        if (targetReq) {
          setSelectedRequest(targetReq);
          navigateToPage('requests');
        } else {
          firestoreService.fetchRequests().then((fresh) => {
            const found = fresh.find((r) => r.id === reqId);
            if (found) {
              setSelectedRequest(found);
              navigateToPage('requests');
            }
          }).catch(() => {});
        }
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }
    window.addEventListener('PUSH_NOTIFICATION_RECEIVED', handlePushEvent);
    window.addEventListener('OPEN_REQUEST_NOTIFICATION', handleOpenReqEvent);

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
      window.removeEventListener('PUSH_NOTIFICATION_RECEIVED', handlePushEvent);
      window.removeEventListener('OPEN_REQUEST_NOTIFICATION', handleOpenReqEvent);
    };
  }, [requests, navigateToPage]);

  // Donor Handlers
  const handleOpenAddDonor = () => {
    setDonorToEdit(null);
    setIsAddDonorOpen(true);
  };

  const handleSaveDonor = async (donorData: Omit<Donor, 'id' | 'createdAt'>) => {
    try {
      const created = await storageService.saveDonor(donorData, currentUser);
      setDonors(storageService.getDonors());
      setNotifications(storageService.getNotifications());
      setCurrentUser(storageService.getCurrentUser());
      triggerToast(`تم حفظ المتبرع ${created.fullName} (${created.bloodType}) بنجاح في قاعدة البيانات ✅`);
    } catch (err: any) {
      triggerToast(err.message || 'تعذر حفظ بيانات المتبرع');
      throw err;
    }
  };

  const handleOpenEditDonor = (donor: Donor) => {
    setDonorToEdit(donor);
    setIsAddDonorOpen(true);
  };

  const handleUpdateDonor = async (updated: Donor) => {
    try {
      await storageService.updateDonor(updated);
      setDonors(storageService.getDonors());
      if (selectedDonor?.id === updated.id) {
        setSelectedDonor(updated);
      }
      triggerToast(`تم تحديث بيانات المتبرع ${updated.fullName} بنجاح في قاعدة البيانات ✅`);
    } catch (err: any) {
      triggerToast(err.message || 'تعذر تحديث بيانات المتبرع');
      throw err;
    }
  };

  const handleToggleDonorAvailability = async (donor: Donor) => {
    const updated: Donor = {
      ...donor,
      isAvailable: !donor.isAvailable
    };
    try {
      await storageService.updateDonor(updated);
      setDonors(storageService.getDonors());
      if (selectedDonor?.id === donor.id) {
        setSelectedDonor(updated);
      }
      triggerToast(`تم تحديث حالة التوفر للمتبرع ${donor.fullName} بنجاح ✅`);
    } catch (err: any) {
      triggerToast(err.message || 'تعذر تحديث حالة المتبرع');
    }
  };

  const handleDeleteDonor = async (id: string) => {
    if (role !== 'admin') {
      triggerToast('عفواً، حذف المتبرع متاح للمسؤول فقط ⚠️');
      return;
    }
    try {
      await storageService.deleteDonor(id);
      setDonors(storageService.getDonors());
      if (selectedDonor?.id === id) {
        setSelectedDonor(null);
      }
      triggerToast('تم حذف المتبرع من قاعدة البيانات المركزية بنجاح 🗑️');
    } catch (err: any) {
      triggerToast(err.message || 'تعذر حذف المتبرع من قاعدة البيانات');
    }
  };

  const handleDeleteAllDonors = async () => {
    if (role !== 'admin') {
      triggerToast('عفواً، حذف جميع المتبرعين متاح للمسؤول فقط ⚠️');
      return;
    }
    try {
      setIsLoadingDonors(true);
      await storageService.deleteAllDonors();
      setDonors([]);
      setSelectedDonor(null);
      triggerToast('تم حذف جميع المتبرعين نهائياً من قاعدة البيانات السحابية المركزية 🗑️');
    } catch (err: any) {
      triggerToast(err.message || 'تعذر حذف المتبرعين من قاعدة البيانات');
    } finally {
      setIsLoadingDonors(false);
    }
  };

  // Request Handlers
  const handleSaveRequest = async (reqData: Omit<BloodRequest, 'id' | 'createdAt'>) => {
    try {
      const created = await storageService.saveRequest(reqData);
      setRequests(storageService.getRequests());
      setNotifications(storageService.getNotifications());
      // Trigger instant push notification evaluation & external dispatch
      pushNotificationService.notifyForRequest(created);
      pushNotificationService.broadcastEmergencyRequest(created);
      triggerToast(`تم حفظ ونشر طلب الدم للمريض ${created.patientName} (${created.bloodType}) في قاعدة البيانات بنجاح ✅`);
    } catch (err: any) {
      triggerToast(err.message || 'تعذر نشر طلب الدم في قاعدة البيانات');
      throw err;
    }
  };

  const handleUpdateRequestStatus = async (req: BloodRequest, status: RequestStatus) => {
    const updated: BloodRequest = {
      ...req,
      status
    };
    await storageService.updateRequest(updated);
    setRequests(storageService.getRequests());
    if (selectedRequest?.id === req.id) {
      setSelectedRequest(updated);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (role !== 'admin') {
      triggerToast('عفواً، حذف طلب الدم متاح للمسؤول فقط ⚠️');
      return;
    }
    try {
      await storageService.deleteRequest(id);
      setRequests(storageService.getRequests());
      if (selectedRequest?.id === id) {
        setSelectedRequest(null);
      }
      triggerToast('تم حذف طلب الدم من قاعدة البيانات بنجاح 🗑️');
    } catch (err: any) {
      triggerToast(err.message || 'تعذر حذف طلب الدم');
    }
  };

  // District Handlers
  const handleAddDistrict = async (name: string, areas: string[]) => {
    await storageService.saveDistrict(name, areas);
    setDistricts(storageService.getDistricts());
    triggerToast(`تمت إضافة مديرية ${name} بنجاح`);
  };

  const handleUpdateDistrict = async (district: District) => {
    await storageService.updateDistrict(district);
    setDistricts(storageService.getDistricts());
  };

  const handleDeleteDistrict = async (id: string) => {
    await storageService.deleteDistrict(id);
    setDistricts(storageService.getDistricts());
  };

  // Role Switcher
  const handleSelectRole = (newRole: UserRole) => {
    if (newRole === 'admin') {
      if (currentUser?.role === 'admin') {
        storageService.setRole('admin');
        setRole('admin');
        triggerToast('تم التبديل إلى دور المسؤول 🛡️');
      } else {
        navigateToPage('admin');
        triggerToast('يرجى تسجيل الدخول كمسؤول للمتابعة 🛡️');
      }
      return;
    }
    storageService.setRole('user');
    setRole('user');
    triggerToast('تم التبديل إلى دور المستخدم 👤');
  };

  // Backup & Restore
  const handleExportBackup = async () => {
    try {
      const jsonStr = storageService.exportBackup();
      const filename = `qaatabah_blood_registry_${new Date().toISOString().split('T')[0]}.json`;
      const res = await saveAndShareFile({
        filename,
        data: jsonStr,
        mimeType: 'application/json',
        title: 'النسخة الاحتياطية لسجل متبرعي الدم - قعطبة',
        text: `النسخة الاحتياطية لقاعدة بيانات متبرعي الدم (${filename})`,
        dialogTitle: 'تصدير ومشاركة النسخة الاحتياطية'
      });
      if (res.success) {
        triggerToast('تم تصدير وحفظ النسخة الاحتياطية بنجاح 💾');
      } else {
        triggerToast('تعذر تصدير النسخة الاحتياطية');
      }
    } catch (e: any) {
      triggerToast('حدث خطأ أثناء تصدير النسخة الاحتياطية');
    }
  };

  const handleImportBackup = async (fileContent: string) => {
    const success = await storageService.importBackup(fileContent);
    if (success) {
      setDonors(storageService.getDonors());
      setRequests(storageService.getRequests());
      setDistricts(storageService.getDistricts());
      triggerToast('تم استيراد البيانات بنجاح واستعادة السجلات');
    } else {
      alert('خطأ في صيغة ملف JSON المستورد');
    }
  };

  const handleImportDonors = async (newDonors: Omit<Donor, 'id' | 'createdAt'>[]) => {
    const res = await storageService.importDonors(newDonors);
    setDonors(storageService.getDonors());
    setNotifications(storageService.getNotifications());
    triggerToast(res.message || 'تم استيراد المتبرعين بنجاح ✅');
    return res;
  };

  const handleResetDefaults = () => {
    storageService.resetDefaults();
    setDonors(storageService.getDonors());
    setRequests(storageService.getRequests());
    setDistricts(storageService.getDistricts());
    setNotifications(storageService.getNotifications());
    triggerToast('تمت استعادة البيانات الافتراضية لقعطبة بنجاح');
  };

  // Deep linking from notification
  const handleNavigateToItem = (page: ActivePage, itemId?: string) => {
    navigateToPage(page);
    if (page === 'requests' && itemId) {
      const found = requests.find((r) => r.id === itemId);
      if (found) setSelectedRequest(found);
    } else if (page === 'donors' && itemId) {
      const found = donors.find((d) => d.id === itemId);
      if (found) setSelectedDonor(found);
    }
  };

  const urgentRequestsCount = requests.filter(
    (r) => r.status === 'open' && (r.urgency === 'critical' || r.urgency === 'urgent')
  ).length;

  const mountedPages = useMemo(() => {
    return new Set<ActivePage>(historyStack.map((entry) => entry.page));
  }, [historyStack]);

  const PAGE_BACK_LABELS: Record<ActivePage, string> = {
    home: 'العودة إلى الرئيسية',
    donors: 'العودة إلى المتبرعين',
    requests: 'العودة إلى طلبات الدم',
    info: 'العودة إلى معلومات التبرع',
    admin: 'العودة إلى لوحة الإدارة',
    districts: 'العودة إلى المديريات',
    profile: 'العودة إلى الملف الشخصي',
    history: 'العودة إلى سجل التبرعات',
    about: 'العودة إلى من نحن',
    contact: 'العودة إلى اتصل بنا',
    settings: 'العودة إلى الإعدادات',
    'hospital-ad': 'العودة إلى الإعلان السابق',
    hospitals: 'العودة إلى المستشفيات والأطباء',
    'hospital-doctors': 'العودة إلى أطباء المستشفى'
  };

  // Expose native exit helper cleanly in case an explicit exit button is needed later
  void nativeNavigationService;

  // If authentication check is still in progress, show clean splash screen
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-['Cairo',sans-serif]">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-rose-700 to-red-600 flex items-center justify-center shadow-2xl shadow-rose-900/50 mb-4 animate-pulse">
          <Droplet className="w-8 h-8 text-white fill-white" />
        </div>
        <h1 className="text-xl font-black tracking-tight text-white mb-1">
          سجل المتبرعين بالدم
        </h1>
        <p className="text-xs text-rose-300 font-semibold mb-1">
          مديرية قعطبة – محافظة الضالع
        </p>
        <p className="text-[11px] text-amber-200/90 font-semibold mb-6">
          برعاية اللجنة المجتمعية – مديرية قعطبة
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 text-rose-500 animate-spin" />
          <span>جاري التحقق من الجلسة وتحميل السجل السحابي...</span>
        </div>
      </div>
    );
  }

  // If not logged in, enforce login page as the mandatory first view
  if (!currentUser) {
    if (isAdminLoginView) {
      return (
        <AdminLoginPage
          isActive={true}
          onLoginSuccess={(adminUser) => {
            storageService.setCurrentUser(adminUser);
            setCurrentUser(adminUser);
            setRole(adminUser.role);
            setIsAdminLoginView(false);
            resetHistoryStack('admin');
            refreshDonors();
            triggerToast('مرحباً بك في لوحة تحكم المسؤول 🛡️');
          }}
          onBackToApp={() => setIsAdminLoginView(false)}
        />
      );
    }

    return (
      <LoginPage
        onLoginSuccess={(user) => {
          storageService.setCurrentUser(user);
          setCurrentUser(user);
          setRole(user.role);
          const targetPage: ActivePage = user.role === 'admin' ? 'admin' : 'home';
          resetHistoryStack(targetPage);
          refreshDonors();
          triggerToast(`مرحباً بك، ${user.fullName} 👋`);
        }}
        onGoToAdminLogin={() => setIsAdminLoginView(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-800 flex flex-col font-['Cairo',sans-serif]">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 backdrop-blur-md text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 border border-slate-700/50">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <Header
        role={role}
        onOpenRoleModal={() => setIsRoleModalOpen(true)}
        notifications={notifications}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onNavigateHome={() => {
          if (activePage === 'home') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            navigateToPage('home');
          }
        }}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenSidebar={() => setIsSidebarOpen(true)}
        isSidebarOpen={isSidebarOpen}
      />

      {/* RTL Right-Side Navigation Sidebar Drawer */}
      <SidebarDrawer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activePage={activePage}
        onNavigate={(p) => navigateToPage(p)}
        onOpenAddDonor={handleOpenAddDonor}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onLogout={handleLogout}
        currentUser={currentUser}
        role={role}
        donors={donors}
        openRequestsCount={requests.filter((r) => r.status === 'open').length}
        unreadNotificationsCount={notifications.filter((n) => !n.read).length}
        hospitalsCount={hospitals.length}
      />

      {/* Main Content Area — Keep pages in the history stack mounted to preserve form/filter state */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 pt-5">
        {mountedPages.has('home') && (
          <div className={activePage === 'home' ? 'block' : 'hidden'}>
            <HomePage
              donors={donors}
              requests={requests}
              hospitalAds={hospitalAds}
              onNavigate={(p) => navigateToPage(p)}
              onOpenAddDonor={handleOpenAddDonor}
              onOpenAddRequest={() => setIsAddRequestOpen(true)}
              onSelectDonor={(d) => setSelectedDonor(d)}
              onSelectRequest={(r) => setSelectedRequest(r)}
              onSelectHospitalAd={handleSelectHospitalAd}
              onFilterBloodType={(t) => {
                setSelectedBloodFilter(t);
                setBloodFilterToken((c) => c + 1);
              }}
              selectedBloodType={selectedBloodFilter}
              onOpenInstallModal={() => setIsInstallModalOpen(true)}
              onOpenNotifications={() => setIsNotificationsOpen(true)}
              role={role}
            />
          </div>
        )}

        {mountedPages.has('hospital-ad') && (
          <div className={activePage === 'hospital-ad' ? 'block' : 'hidden'}>
            <HospitalAdDetailPage
              ad={
                (selectedHospitalAdId && hospitalAds.find((item) => item.id === selectedHospitalAdId)) ||
                (selectedHospitalAd && hospitalAds.find((item) => item.id === selectedHospitalAd.id)) ||
                selectedHospitalAd ||
                null
              }
              onBack={() => goBack('home')}
              backLabel={previousEntry ? PAGE_BACK_LABELS[previousEntry.page] : 'العودة إلى الرئيسية'}
              onTriggerToast={triggerToast}
            />
          </div>
        )}

        {mountedPages.has('hospitals') && (
          <div className={activePage === 'hospitals' ? 'block' : 'hidden'}>
            <HospitalsPage
              hospitals={hospitals}
              doctors={doctors}
              onSelectHospital={handleSelectHospital}
              role={role}
              onOpenAdminDashboard={() => navigateToPage('admin')}
              onBack={() => goBack('home')}
            />
          </div>
        )}

        {mountedPages.has('hospital-doctors') && (
          <div className={activePage === 'hospital-doctors' ? 'block' : 'hidden'}>
            <HospitalDoctorsPage
              hospital={
                (selectedHospitalId && hospitals.find((item) => item.id === selectedHospitalId)) ||
                (selectedHospital && hospitals.find((item) => item.id === selectedHospital.id)) ||
                selectedHospital ||
                null
              }
              doctors={doctors}
              onBack={() => goBack('hospitals')}
              backLabel={previousEntry ? PAGE_BACK_LABELS[previousEntry.page] : 'العودة إلى المستشفيات'}
              onTriggerToast={triggerToast}
              role={role}
              onOpenAdminDashboard={() => navigateToPage('admin')}
            />
          </div>
        )}

        {mountedPages.has('donors') && (
          <div className={activePage === 'donors' ? 'block' : 'hidden'}>
            <DonorsPage
              donors={donors}
              districts={districts}
              onOpenAddDonor={handleOpenAddDonor}
              onSelectDonor={(d) => setSelectedDonor(d)}
              onEditDonor={handleOpenEditDonor}
              initialBloodFilter={selectedBloodFilter}
              filterSyncToken={bloodFilterToken}
              role={role}
              onOpenImportModal={() => setIsImportModalOpen(true)}
              onRefreshDonors={refreshDonors}
              isLoadingDonors={isLoadingDonors}
              donorLoadError={donorLoadError}
              onBack={() => goBack('home')}
            />
          </div>
        )}

        {mountedPages.has('requests') && (
          <div className={activePage === 'requests' ? 'block' : 'hidden'}>
            <RequestsPage
              requests={requests}
              onOpenAddRequest={() => setIsAddRequestOpen(true)}
              onSelectRequest={(r) => setSelectedRequest(r)}
              onBack={() => goBack('home')}
            />
          </div>
        )}

        {mountedPages.has('info') && (
          <div className={activePage === 'info' ? 'block' : 'hidden'}>
            <DonationInfoPage onBack={() => goBack('home')} />
          </div>
        )}

        {mountedPages.has('admin') && (
          <div className={activePage === 'admin' ? 'block' : 'hidden'}>
            {role === 'admin' ? (
              <AdminDashboardPage
                role={role}
                donors={donors}
                requests={requests}
                onNavigate={(p) => navigateToPage(p)}
                onOpenRoleModal={() => setIsRoleModalOpen(true)}
                onEditDonor={handleOpenEditDonor}
                onDeleteDonor={handleDeleteDonor}
                onDeleteAllDonors={handleDeleteAllDonors}
                onOpenAddDonor={handleOpenAddDonor}
                onToggleDonorAvailability={handleToggleDonorAvailability}
                onUpdateRequestStatus={handleUpdateRequestStatus}
                onDeleteRequest={handleDeleteRequest}
                onExportBackup={handleExportBackup}
                onImportBackup={handleImportBackup}
                onResetDefaults={handleResetDefaults}
                onSelectDonor={(d) => setSelectedDonor(d)}
                onSelectRequest={(r) => setSelectedRequest(r)}
                onOpenImportModal={() => setIsImportModalOpen(true)}
                onLogout={handleLogout}
                currentUser={currentUser}
                hospitalAds={hospitalAds}
                onHospitalAdsChange={(updatedAds) => setHospitalAds(updatedAds)}
                hospitals={hospitals}
                doctors={doctors}
                onHospitalsChange={(updatedHospitals) => setHospitals(updatedHospitals)}
                onDoctorsChange={(updatedDoctors) => setDoctors(updatedDoctors)}
                isActive={activePage === 'admin'}
                onBack={() => goBack('home')}
              />
            ) : (
              <div className="py-4">
                <AdminLoginPage
                  isActive={activePage === 'admin'}
                  onLoginSuccess={(adminUser) => {
                    storageService.setCurrentUser(adminUser);
                    setCurrentUser(adminUser);
                    setRole('admin');
                    refreshDonors();
                    triggerToast('تم التحقق وتسجيل الدخول كمسؤول بنجاح 🛡️');
                  }}
                  onBackToApp={() => goBack('home')}
                />
              </div>
            )}
          </div>
        )}

        {mountedPages.has('districts') && (
          <div className={activePage === 'districts' ? 'block' : 'hidden'}>
            <DistrictsPage
              role={role}
              districts={districts}
              donors={donors}
              onNavigate={(p) => navigateToPage(p)}
              onBack={() => goBack('admin')}
              onOpenRoleModal={() => setIsRoleModalOpen(true)}
              onAddDistrict={handleAddDistrict}
              onUpdateDistrict={handleUpdateDistrict}
              onDeleteDistrict={handleDeleteDistrict}
              isActive={activePage === 'districts'}
            />
          </div>
        )}

        {mountedPages.has('profile') && (
          <div className={activePage === 'profile' ? 'block' : 'hidden'}>
            <ProfilePage
              currentUser={currentUser}
              donors={donors}
              requests={requests}
              role={role}
              onUpdateUser={handleUpdateUser}
              onToggleDonorAvailability={handleToggleDonorAvailability}
              onOpenAddDonor={handleOpenAddDonor}
              onEditDonor={handleOpenEditDonor}
              onNavigate={(p) => navigateToPage(p)}
              onTriggerToast={triggerToast}
              onBack={() => goBack('home')}
            />
          </div>
        )}

        {mountedPages.has('history') && (
          <div className={activePage === 'history' ? 'block' : 'hidden'}>
            <DonationHistoryPage
              currentUser={currentUser}
              donors={donors}
              requests={requests}
              onUpdateUser={handleUpdateUser}
              onSelectRequest={(r) => setSelectedRequest(r)}
              onSelectDonor={(d) => setSelectedDonor(d)}
              onOpenAddDonor={handleOpenAddDonor}
              onTriggerToast={triggerToast}
              onBack={() => goBack('home')}
            />
          </div>
        )}

        {mountedPages.has('about') && (
          <div className={activePage === 'about' ? 'block' : 'hidden'}>
            <AboutPage
              donors={donors}
              requests={requests}
              districts={districts}
              onNavigate={(p) => navigateToPage(p)}
              onBack={() => goBack('home')}
            />
          </div>
        )}

        {mountedPages.has('contact') && (
          <div className={activePage === 'contact' ? 'block' : 'hidden'}>
            <ContactPage
              currentUser={currentUser}
              onOpenAddRequest={() => setIsAddRequestOpen(true)}
              onTriggerToast={triggerToast}
              onBack={() => goBack('home')}
            />
          </div>
        )}

        {mountedPages.has('settings') && (
          <div className={activePage === 'settings' ? 'block' : 'hidden'}>
            <SettingsPage
              currentUser={currentUser}
              role={role}
              donors={donors}
              districts={districts}
              requests={requests}
              onToggleDonorAvailability={handleToggleDonorAvailability}
              onRefreshData={refreshDonors}
              onOpenInstallModal={() => setIsInstallModalOpen(true)}
              onOpenRoleModal={() => setIsRoleModalOpen(true)}
              onNavigate={(p) => navigateToPage(p)}
              onLogout={handleLogout}
              onTriggerToast={triggerToast}
              onCheckForUpdates={() => runAppUpdateCheck(true)}
              onBack={() => goBack('home')}
            />
          </div>
        )}

        {/* Footer with Official Sponsorship, Copyright & Discreet Admin Access */}
        <footer className="mt-12 mb-28 pt-6 pb-4 text-center border-t border-slate-200/80 space-y-1.5">
          <p className="text-xs sm:text-sm font-bold text-rose-800">
            معًا من أجل إنقاذ الأرواح... قطرة دم قد تصنع حياة.
          </p>
          <p className="text-xs font-semibold text-slate-600">
            برعاية اللجنة المجتمعية – مديرية قعطبة
          </p>
          <p className="text-xs text-slate-500 font-semibold tracking-wide flex items-center justify-center gap-1.5 pt-1">
            <span>© جميع الحقوق محفوظة للنسر وايب 2027.</span>
            {role !== 'admin' && (
              <button
                type="button"
                onClick={() => navigateToPage('admin')}
                className="opacity-25 hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-amber-600 cursor-pointer"
                title="بوابة إدارة النظام المحمية"
                aria-label="بوابة إدارة النظام المحمية"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            )}
          </p>
        </footer>
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav
        activePage={activePage}
        onNavigate={(p) => {
          if (p === activePage) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            navigateToPage(p);
          }
        }}
        role={role}
        urgentRequestsCount={urgentRequestsCount}
      />

      {/* Modals */}
      <AddDonorModal
        isOpen={isAddDonorOpen}
        onClose={() => {
          setIsAddDonorOpen(false);
          setDonorToEdit(null);
        }}
        onSave={handleSaveDonor}
        onUpdate={handleUpdateDonor}
        donorToEdit={donorToEdit}
        districts={districts}
        existingDonors={donors}
      />

      <AddRequestModal
        isOpen={isAddRequestOpen}
        onClose={() => setIsAddRequestOpen(false)}
        onSave={handleSaveRequest}
        districts={districts}
      />

      <DonorProfileModal
        donor={selectedDonor}
        onClose={() => setSelectedDonor(null)}
        role={role}
        onToggleAvailability={handleToggleDonorAvailability}
        onDeleteDonor={handleDeleteDonor}
        onEditDonor={handleOpenEditDonor}
      />

      <RequestDetailsModal
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        role={role}
        donors={donors}
        currentUser={currentUser}
        onTriggerToast={triggerToast}
        onUpdateRequestStatus={handleUpdateRequestStatus}
        onDeleteRequest={handleDeleteRequest}
        onSelectDonor={(d) => setSelectedDonor(d)}
      />

      <NotificationModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        districts={districts}
        userBloodType={
          currentUser?.linkedDonorId
            ? donors.find((d) => d.id === currentUser.linkedDonorId)?.bloodType
            : undefined
        }
        onTriggerToast={triggerToast}
        onMarkAsRead={(id) => {
          storageService.markAsRead(id);
          setNotifications(storageService.getNotifications());
        }}
        onMarkAllAsRead={() => {
          storageService.markAllAsRead();
          setNotifications(storageService.getNotifications());
        }}
        onClearAll={() => {
          storageService.clearNotifications();
          setNotifications([]);
        }}
        onNavigateToItem={handleNavigateToItem}
      />

      <RoleSwitcherModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        currentRole={role}
        onSelectRole={handleSelectRole}
        onOpenAdminLoginPage={() => {
          setIsRoleModalOpen(false);
          navigateToPage('admin');
        }}
      />

      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        deferredPrompt={deferredPrompt}
        onInstallSuccess={() => triggerToast('تم تثبيت التطبيق بنجاح على جهازك 🎉')}
      />

      <ImportDonorsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        existingDonors={donors}
        districts={districts}
        onImport={handleImportDonors}
      />

      {/* Push Notification Activation Prompt (Only on App Open) */}
      <PushPromptModal
        isOpen={isPushPromptOpen}
        onClose={() => setIsPushPromptOpen(false)}
        districts={districts}
        userBloodType={
          currentUser?.linkedDonorId
            ? donors.find((d) => d.id === currentUser.linkedDonorId)?.bloodType
            : undefined
        }
        onTriggerToast={triggerToast}
      />

      {/* Seamless In-App Update Modal */}
      <AppUpdateModal
        isOpen={isUpdateModalOpen}
        checkResult={updateCheckResult}
        progressState={updateProgressState}
        onStartUpdate={handleStartAppUpdate}
        onRetryInstallPermission={handleRetryInstallPermission}
        onOpenInstallPermissionSettings={handleOpenInstallPermissionSettings}
        onDismissLater={handleDismissUpdateLater}
        onCancelDownload={handleCancelUpdateDownload}
      />
    </div>
  );
}
