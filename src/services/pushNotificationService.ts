import { Capacitor } from '@capacitor/core';
import { 
  PushNotifications, 
  Token, 
  ActionPerformed, 
  PushNotificationSchema 
} from '@capacitor/push-notifications';
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, isSupported as isMessagingSupported } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';
import { BloodRequest, BloodType, FCMDeviceToken, Donor } from '../types';
import { canDonorDonateToRequest, getApiUrl } from './storageService';
import { firestoreService } from '../firebase/firestoreService';

export interface PushNotificationPreferences {
  enabled: boolean;
  bloodType: BloodType | 'all';
  district: string | 'all';
  criticalOnly: boolean;
  sound: boolean;
  vibrate: boolean;
  endpoint?: string;
  fcmToken?: string;
  platform?: 'web' | 'android';
  updatedAt?: string;
}

export interface DonorResponseRecord {
  id: string;
  requestId: string;
  donorName: string;
  donorPhone: string;
  donorBloodType: BloodType;
  district: string;
  responseType: 'ready_to_donate' | 'contacted_phone' | 'contacted_whatsapp';
  timestamp: string;
  notes?: string;
}

const PUSH_PREFS_KEY = 'qaatabah_blood_push_prefs_v1';
const DONOR_RESPONSES_KEY = 'qaatabah_blood_donor_responses_v1';
const FCM_TOKEN_STORAGE_KEY = 'qaatabah_fcm_token_v1';

class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private isInitializingSw = false;
  private currentFCMToken: string | null = null;
  private isNativeListenersAttached = false;
  private appInstance: any = null;

  constructor() {
    this.initFirebaseApp();
    if (typeof window !== 'undefined') {
      if (this.isNative()) {
        this.initNativePush().catch(() => {});
      } else {
        this.initServiceWorker().catch(() => {});
      }
    }
  }

  /**
   * Automatic background registration for users who already granted notification permission
   */
  async autoRegisterPushNotifications(): Promise<void> {
    if (typeof window === 'undefined') return;

    const prefs = this.getPreferences();
    // Do not auto-register if user specifically disabled notifications
    if (prefs.enabled === false) return;

    if (this.isNative()) {
      try {
        await this.initNativePush();
        const check = await PushNotifications.checkPermissions();
        if (check.receive === 'granted') {
          console.log('[Native Push] Permission granted. Registering with FCM safely...');
          try {
            await PushNotifications.register();
          } catch (regErr) {
            console.warn('[Native Push] autoRegister FCM register notice:', regErr);
          }
        }
      } catch (err) {
        console.debug('autoRegisterPushNotifications native notice:', err);
      }
      return;
    }

    // Web browser environment
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        await this.registerWebPushAndFCM(prefs);
      }
    } catch (err) {
      console.debug('autoRegisterPushNotifications web notice:', err);
    }
  }

  private initFirebaseApp() {
    try {
      this.appInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    } catch (e) {
      console.debug('PushNotificationService Firebase init note:', e);
    }
  }

  /**
   * Check if running in a native Android APK (Capacitor environment)
   */
  isNative(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      if (Capacitor.isNativePlatform()) return true;
      const platform = Capacitor.getPlatform();
      return platform === 'android' || platform === 'ios';
    } catch {
      return false;
    }
  }

  /**
   * Check if push notifications are supported in current environment
   */
  isSupported(): boolean {
    if (typeof window === 'undefined') return false;

    // In Android APK, support is provided by the Capacitor native PushNotifications plugin
    if (this.isNative()) {
      try {
        return Capacitor.isPluginAvailable('PushNotifications');
      } catch {
        return false;
      }
    }

    // In web browsers, support requires Notification API and Service Worker
    return (
      'Notification' in window &&
      'serviceWorker' in navigator &&
      typeof window.Notification !== 'undefined'
    );
  }

  /**
   * Get current notification permission state
   */
  async getPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!this.isSupported()) return 'unsupported';

    if (this.isNative()) {
      try {
        const check = await PushNotifications.checkPermissions();
        if (check.receive === 'granted') return 'granted';
        if (check.receive === 'denied') return 'denied';
        return 'default';
      } catch {
        return 'default';
      }
    }

    if (typeof Notification !== 'undefined') {
      return Notification.permission;
    }
    return 'unsupported';
  }

  /**
   * Synchronous check for UI rendering
   */
  getPermissionSync(): NotificationPermission | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    if (this.isNative()) {
      const prefs = this.getPreferences();
      return prefs.enabled ? 'granted' : 'default';
    }
    if (typeof Notification !== 'undefined') {
      return Notification.permission;
    }
    return 'unsupported';
  }

  /**
   * Initialize native Android Push Notification listeners and notification channels
   */
  private async initNativePush(): Promise<void> {
    if (!this.isNative() || this.isNativeListenersAttached) return;
    this.isNativeListenersAttached = true;

    try {
      // Create high-priority notification channel for Android 8.0+ (API 26+)
      await this.setupAndroidEmergencyChannel();

      // Listener 1: FCM Token registration
      await PushNotifications.addListener('registration', async (token: Token) => {
        console.log('[Native Push] FCM Registration Token:', token.value);
        this.currentFCMToken = token.value;
        try {
          localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token.value);
        } catch {}

        await this.saveTokenToFirebase(token.value, 'android');
      });

      // Listener 2: Registration errors
      await PushNotifications.addListener('registrationError', (error: any) => {
        console.warn('[Native Push] FCM Registration Error:', error);
      });

      // Listener 3: Notification received in foreground
      await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('[Native Push] Notification received in foreground:', notification);
        const prefs = this.getPreferences();
        if (prefs.vibrate && 'vibrate' in navigator) {
          try {
            navigator.vibrate([300, 150, 300]);
          } catch {}
        }
        // Dispatch in-app notification event
        window.dispatchEvent(
          new CustomEvent('PUSH_NOTIFICATION_RECEIVED', { detail: notification })
        );
      });

      // Listener 4: Notification action performed (tapped by user)
      await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        console.log('[Native Push] Action performed:', action);
        const notifData = action.notification.data || {};
        const requestId = notifData.requestId || (notifData.data && notifData.data.requestId);

        if (requestId) {
          window.dispatchEvent(
            new CustomEvent('OPEN_REQUEST_NOTIFICATION', { detail: { requestId } })
          );
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('openRequest', requestId);
            window.history.pushState({}, '', url.toString());
          } catch {}
        }
      });

      // Check if app was cold-started from tapping an external notification
      try {
        const initialAction = await (PushNotifications as any).getInitialNotification?.().catch(() => null);
        if (initialAction && initialAction.hasNotification && initialAction.requestId) {
          console.log('[Native Push] Cold-started from notification for request:', initialAction.requestId);
          window.dispatchEvent(
            new CustomEvent('OPEN_REQUEST_NOTIFICATION', { detail: { requestId: initialAction.requestId } })
          );
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('openRequest', initialAction.requestId);
            window.history.pushState({}, '', url.toString());
          } catch {}
        }
      } catch (initNotifErr) {
        console.debug('getInitialNotification notice:', initNotifErr);
      }
    } catch (err) {
      console.warn('Native push initialization notice:', err);
    }
  }

  /**
   * Create Android Notification Channel for Emergency Blood Alerts
   */
  private async setupAndroidEmergencyChannel(): Promise<void> {
    if (!this.isNative()) return;
    try {
      // Do not specify custom sound name 'default' because Android expects a file in res/raw.
      // Omitting sound allows the system default emergency notification sound to be played properly.
      await PushNotifications.createChannel({
        id: 'blood_emergency_channel',
        name: 'نداءات طوارئ الدم قعطبة',
        description: 'تنبيهات فورية لطلبات التبرع بالدم العاجلة والحرجة في مديرية قعطبة',
        importance: 4, // High importance (shows banner, sounds, vibrates safely on all Android versions)
        visibility: 1, // Public visibility on lockscreen
        vibration: true,
        lights: true,
        lightColor: '#be123c'
      });
    } catch (channelErr) {
      console.debug('Android channel setup notice:', channelErr);
    }
  }

  /**
   * Initialize and retain active Web Service Worker registration
   */
  async initServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || this.isNative()) {
      return null;
    }

    if (this.registration) {
      return this.registration;
    }

    if (this.isInitializingSw) {
      return null;
    }

    this.isInitializingSw = true;
    try {
      const reg = await navigator.serviceWorker.ready;
      this.registration = reg;
      return reg;
    } catch {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js');
        this.registration = reg;
        return reg;
      } catch (err) {
        console.debug('PushNotificationService SW init notice:', err);
        return null;
      }
    } finally {
      this.isInitializingSw = false;
    }
  }

  /**
   * Load user's push notification preferences
   */
  getPreferences(): PushNotificationPreferences {
    if (typeof localStorage === 'undefined') {
      return {
        enabled: true,
        bloodType: 'all',
        district: 'all',
        criticalOnly: false,
        sound: true,
        vibrate: true,
        platform: this.isNative() ? 'android' : 'web'
      };
    }

    try {
      const saved = localStorage.getItem(PUSH_PREFS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}

    return {
      enabled: true,
      bloodType: 'all',
      district: 'all',
      criticalOnly: false,
      sound: true,
      vibrate: true,
      platform: this.isNative() ? 'android' : 'web'
    };
  }

  /**
   * Save user's push preferences and sync to Firebase & server
   */
  savePreferences(prefs: Partial<PushNotificationPreferences>): PushNotificationPreferences {
    const current = this.getPreferences();
    const updated: PushNotificationPreferences = {
      ...current,
      ...prefs,
      platform: this.isNative() ? 'android' : 'web',
      updatedAt: new Date().toISOString()
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PUSH_PREFS_KEY, JSON.stringify(updated));
    }

    // Update token in Firebase with updated filter preferences
    const storedToken = this.currentFCMToken || (typeof localStorage !== 'undefined' ? localStorage.getItem(FCM_TOKEN_STORAGE_KEY) : null);
    if (storedToken) {
      this.saveTokenToFirebase(storedToken, this.isNative() ? 'android' : 'web').catch(() => {});
    }

    this.syncSubscriptionWithServer(updated).catch(() => {});
    return updated;
  }

  /**
   * Request push notification permission properly based on the execution environment
   */
  async requestPermission(): Promise<{
    success: boolean;
    permission: NotificationPermission | 'unsupported';
    message: string;
    token?: string;
  }> {
    if (!this.isSupported()) {
      return {
        success: false,
        permission: 'unsupported',
        message: 'الإشعارات الخارجية غير مدعومة في بيئة التشغيل أو المتصفح الحالي. ستظهر التنبيهات داخل التطبيق.'
      };
    }

    // 1. Native Android APK Environment (Capacitor)
    if (this.isNative()) {
      try {
        await this.initNativePush();

        // Check permission state first before triggering OS prompt
        let currentStatus = await PushNotifications.checkPermissions().catch(() => ({ receive: 'prompt' as any }));
        let permResult = currentStatus;

        if (currentStatus.receive !== 'granted') {
          permResult = await PushNotifications.requestPermissions().catch((e) => {
            console.warn('[Native Push] requestPermissions catch notice:', e);
            return { receive: 'prompt' as any };
          });
        }

        if (permResult.receive === 'granted') {
          // Register with Google Play Services / FCM inside try/catch so exceptions never crash the app
          try {
            await PushNotifications.register();
            console.log('[Native Push] PushNotifications.register() initiated successfully.');
          } catch (regErr: any) {
            console.warn('[Native Push] Register notice (continuing safely):', regErr);
          }

          const prefs = this.savePreferences({ enabled: true });
          await this.syncSubscriptionWithServer(prefs);

          return {
            success: true,
            permission: 'granted',
            message: 'تم تفعيل إشعارات تطبيق أندرويد بنجاح! ستصلك تنبيهات الحالات العاجلة على هاتفك 🔔'
          };
        } else if (permResult.receive === 'denied') {
          this.savePreferences({ enabled: false });
          return {
            success: false,
            permission: 'denied',
            message: 'تم رفض إذن الإشعارات من إعدادات الهاتف. يمكنك تفعيلها من إعدادات التطبيق لتلقي التنبيهات.'
          };
        }

        return {
          success: false,
          permission: 'default',
          message: 'لم يتم منح إذن الإشعارات بعد.'
        };
      } catch (nativeErr: any) {
        console.warn('Native requestPermissions notice:', nativeErr);
        return {
          success: false,
          permission: 'default',
          message: 'تعذر طلب الإذن من نظام أندرويد، يرجى تفعيل الإشعارات من إعدادات الهاتف.'
        };
      }
    }

    // 2. Web Browser Environment (PWA / Web Push)
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        const prefs = this.savePreferences({ enabled: true });
        await this.initServiceWorker();
        const token = await this.registerWebPushAndFCM(prefs);

        return {
          success: true,
          permission: 'granted',
          token: token || undefined,
          message: 'تم تفعيل إشعارات الويب الفورية بنجاح! ستصلك تنبيهات فورية عند وجود طلبات دم عاجلة.'
        };
      } else if (perm === 'denied') {
        this.savePreferences({ enabled: false });
        return {
          success: false,
          permission: 'denied',
          message: 'تم رفض إذن الإشعارات من المتصفح. يرجى تفعيلها من إعدادات الموقع لتلقي التنبيهات.'
        };
      }

      return {
        success: false,
        permission: perm,
        message: 'لم يتم منح الإذن بعد.'
      };
    } catch (webErr: any) {
      console.warn('Web requestPermission notice:', webErr);
      return {
        success: false,
        permission: 'denied',
        message: 'تعذر تفعيل الإشعارات في هذا المتصفح.'
      };
    }
  }

  /**
   * Register Web Push and FCM token for web browser
   */
  private async registerWebPushAndFCM(prefs: PushNotificationPreferences): Promise<string | null> {
    // In native Android APK, push notifications are handled exclusively by native Capacitor FCM
    if (this.isNative()) return null;

    let tokenStr: string | null = null;
    const reg = await this.initServiceWorker();

    // 1. Try Firebase Web Messaging SDK
    try {
      const isSupp = await isMessagingSupported().catch(() => false);
      if (isSupp && this.appInstance) {
        const messaging = getMessaging(this.appInstance);
        tokenStr = await getToken(messaging, {
          serviceWorkerRegistration: reg || undefined
        }).catch((e) => {
          console.debug('FCM web getToken note:', e?.message || e);
          return null;
        });
      }
    } catch (err) {
      console.debug('FCM web messaging init note:', err);
    }

    // 2. Try standard Web Push Manager subscription
    let pushEndpoint = '';
    if (reg && 'pushManager' in reg) {
      try {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          pushEndpoint = sub.endpoint;
        }
      } catch {}
    }

    const effectiveToken = tokenStr || pushEndpoint || `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    this.currentFCMToken = effectiveToken;

    try {
      localStorage.setItem(FCM_TOKEN_STORAGE_KEY, effectiveToken);
    } catch {}

    await this.saveTokenToFirebase(effectiveToken, 'web');
    await this.syncSubscriptionWithServer({ ...prefs, endpoint: effectiveToken, fcmToken: effectiveToken });

    return effectiveToken;
  }

  /**
   * Register and save FCM Device Token in Firebase Firestore
   */
  async saveTokenToFirebase(tokenString: string, platform: 'web' | 'android' | 'ios'): Promise<void> {
    if (!tokenString) return;
    const prefs = this.getPreferences();

    // Create a safe, valid Firestore document ID
    const tokenPart = tokenString.length > 28 ? tokenString.slice(-28) : tokenString;
    const cleanId = `fcm-${platform}-${tokenPart.replace(/[^a-zA-Z0-9_-]/g, '')}`;

    const tokenDoc: FCMDeviceToken = {
      id: cleanId,
      token: tokenString,
      platform,
      bloodType: prefs.bloodType,
      district: prefs.district,
      criticalOnly: prefs.criticalOnly,
      enabled: prefs.enabled !== false,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : '',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    // 1. Direct save in Firestore collection 'fcm_tokens'
    try {
      await firestoreService.saveFCMDeviceToken(tokenDoc);
    } catch (err) {
      console.debug('Firestore saveFCMDeviceToken notice:', err);
    }

    // 2. Mirror to Express server
    try {
      await fetch(getApiUrl('/api/notifications/fcm-token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokenDoc)
      }).catch(() => {});
    } catch {}
  }

  /**
   * Synchronize push subscription details and targeting filters with the backend
   */
  async syncSubscriptionWithServer(prefs: PushNotificationPreferences): Promise<void> {
    try {
      let endpoint = prefs.endpoint || this.currentFCMToken || '';
      if (!endpoint && typeof localStorage !== 'undefined') {
        endpoint = localStorage.getItem(FCM_TOKEN_STORAGE_KEY) || '';
      }

      const reg = await this.initServiceWorker();
      if (!endpoint && reg && 'pushManager' in reg) {
        try {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            endpoint = sub.endpoint;
          }
        } catch {}
      }

      const effectiveEndpoint = endpoint || `${this.isNative() ? 'apk-device' : 'web-device'}-${Date.now()}`;

      await fetch(getApiUrl('/api/notifications/push-subscription'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: effectiveEndpoint,
          fcmToken: this.currentFCMToken || endpoint,
          platform: this.isNative() ? 'android' : 'web',
          enabled: prefs.enabled,
          bloodType: prefs.bloodType,
          district: prefs.district,
          criticalOnly: prefs.criticalOnly,
          sound: prefs.sound,
          vibrate: prefs.vibrate,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
        })
      }).catch(() => {});
    } catch (err) {
      console.debug('syncSubscriptionWithServer notice:', err);
    }
  }

  /**
   * Check whether a BloodRequest matches the user's notification preferences
   */
  shouldNotifyForRequest(request: BloodRequest): { matches: boolean; reason?: string } {
    const prefs = this.getPreferences();

    if (!prefs.enabled) {
      return { matches: false, reason: 'الإشعارات معطلة في الإعدادات' };
    }

    // Urgency check
    if (prefs.criticalOnly) {
      const isCritical = request.urgency === 'critical' || request.urgency === 'urgent';
      if (!isCritical) {
        return { matches: false, reason: 'تم ضبط التنبيهات للحالات الحرجة والطارئة فقط' };
      }
    }

    // Geographic District check
    if (prefs.district && prefs.district !== 'all') {
      const reqDist = (request.district || '').trim().toLowerCase();
      const prefDist = prefs.district.trim().toLowerCase();
      if (!reqDist.includes(prefDist) && !prefDist.includes(reqDist)) {
        return { matches: false, reason: 'خارج النطاق الجغرافي المحدد' };
      }
    }

    // Blood compatibility check
    if (prefs.bloodType && prefs.bloodType !== 'all') {
      const canDonate = canDonorDonateToRequest(prefs.bloodType, request.bloodType);
      if (!canDonate) {
        return {
          matches: false,
          reason: `فصيلتك (${prefs.bloodType}) غير متوافقة مع الفصيلة المطلوبة (${request.bloodType})`
        };
      }
    }

    return { matches: true };
  }

  /**
   * Dispatch an immediate push notification for a blood request
   */
  async notifyForRequest(request: BloodRequest): Promise<boolean> {
    const check = this.shouldNotifyForRequest(request);
    if (!check.matches) {
      return false;
    }

    const urgencyEmoji = request.urgency === 'critical' ? '🚨' : '🩸';
    const title = `${urgencyEmoji} نداء دم عاجل: مطلوب فصيلة (${request.bloodType}) في ${request.district}`;
    const body = `المريض: ${request.patientName} (${request.unitsNeeded} وحدة) بمستشفى ${request.hospital}. اضغط هنا لعرض تفاصيل الطلب والاستجابة فوراً.`;

    return this.showSystemNotification(title, {
      body,
      tag: `req-${request.id}`,
      data: {
        requestId: request.id,
        bloodType: request.bloodType,
        district: request.district,
        hospital: request.hospital,
        patientName: request.patientName,
        url: `/?openRequest=${request.id}`
      }
    });
  }

  /**
   * Broadcast an emergency blood request to all users across the platform
   */
  async broadcastEmergencyRequest(request: BloodRequest): Promise<void> {
    try {
      // 1. Post to backend broadcast endpoint which dispatches to all FCM tokens and Web Push
      await fetch(getApiUrl('/api/notifications/broadcast'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.id,
          patientName: request.patientName,
          bloodType: request.bloodType,
          unitsNeeded: request.unitsNeeded,
          hospital: request.hospital,
          district: request.district,
          area: request.area,
          urgency: request.urgency
        })
      }).catch(() => {});
    } catch (err) {
      console.warn('broadcastEmergencyRequest notice:', err);
    }
  }

  /**
   * Show a system-level notification (via Service Worker on Web, or Window Notification)
   */
  async showSystemNotification(
    title: string,
    options: {
      body: string;
      tag?: string;
      data?: Record<string, any>;
      icon?: string;
      badge?: string;
      vibrate?: number[];
    }
  ): Promise<boolean> {
    const prefs = this.getPreferences();
    if (!prefs.enabled) return false;

    const defaultIcon = '/assets/aistudio/1001974620_imgupscaler.ai__________2K_b80bcc57.jpg';
    const notificationOptions: any = {
      body: options.body,
      tag: options.tag || `qaatabah-blood-${Date.now()}`,
      icon: options.icon || defaultIcon,
      badge: options.badge || defaultIcon,
      vibrate: prefs.vibrate ? options.vibrate || [300, 150, 300, 150, 300] : undefined,
      requireInteraction: true,
      data: options.data || { url: '/' },
      renotify: true,
      actions: [
        { action: 'open_request', title: '🩸 عرض التفاصيل والاستجابة' },
        { action: 'close', title: 'إغلاق' }
      ]
    };

    // If native Android APK, trigger real Android status bar notification via native plugin
    if (this.isNative()) {
      if (prefs.vibrate && 'vibrate' in navigator) {
        try {
          navigator.vibrate([300, 150, 300]);
        } catch {}
      }

      try {
        await (PushNotifications as any).showNotification?.({
          title,
          body: options.body,
          requestId: options.data?.requestId || '',
          data: options.data || {}
        });
      } catch (nativeShowErr) {
        console.warn('Native showNotification notice:', nativeShowErr);
      }

      window.dispatchEvent(
        new CustomEvent('PUSH_NOTIFICATION_RECEIVED', {
          detail: {
            title,
            body: options.body,
            data: options.data
          }
        })
      );
      return true;
    }

    // 1. Try Service Worker ShowNotification
    try {
      const reg = await this.initServiceWorker();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, notificationOptions);
        return true;
      }
    } catch (swErr) {
      console.debug('ServiceWorker showNotification notice:', swErr);
    }

    // 2. Fallback to standard Window Notification API
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const notif = new Notification(title, notificationOptions);
        notif.onclick = () => {
          window.focus();
          const targetUrl = (options.data as any)?.url || '/';
          if (targetUrl && targetUrl !== '/') {
            window.location.href = targetUrl;
          }
          notif.close();
        };
        return true;
      }
    } catch (winErr) {
      console.debug('Window Notification fallback notice:', winErr);
    }

    return false;
  }

  /**
   * Send a test push notification
   */
  async sendTestNotification(
    delaySeconds = 0,
    testBloodType: BloodType = 'O-',
    testDistrict = 'مديرية قعطبة - المركز'
  ): Promise<{ success: boolean; message: string }> {
    const isSupp = this.isSupported();
    if (!isSupp) {
      return {
        success: false,
        message: 'الإشعارات غير مدعومة في بيئة التشغيل الحالية.'
      };
    }

    const title = `🚨 إشعار خارجي تجريبي: طلب دم (${testBloodType}) في ${testDistrict}`;
    const body = 'هذا إشعار تجريبي لاختبار وصول التنبيهات الخارجية على هاتفك. اضغط عليه للاستجابة فوراً.';

    const dispatch = async () => {
      await this.showSystemNotification(title, {
        body,
        tag: 'test-push-notification',
        data: {
          requestId: 'test-req-demo',
          bloodType: testBloodType,
          district: testDistrict,
          url: '/?openRequest=test-req-demo'
        }
      });

      // Also trigger server test dispatch
      try {
        await fetch(getApiUrl('/api/notifications/test-push'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bloodType: testBloodType, district: testDistrict })
        }).catch(() => {});
      } catch {}
    };

    if (delaySeconds > 0) {
      setTimeout(() => {
        dispatch().catch(() => {});
      }, delaySeconds * 1000);

      return {
        success: true,
        message: `سيصلك الإشعار الخارجي على هاتفك خلال ${delaySeconds} ثوانٍ. يمكنك تصغير التطبيق أو قفل الشاشة لاختباره!`
      };
    } else {
      await dispatch();
      return {
        success: true,
        message: 'تم إرسال الإشعار الخارجي التجريبي بنجاح 🔔'
      };
    }
  }

  /**
   * Record a donor's response to an urgent blood request
   */
  async recordDonorResponse(
    requestId: string,
    donorData: {
      fullName: string;
      phone: string;
      bloodType: BloodType;
      district: string;
    },
    responseType: 'ready_to_donate' | 'contacted_phone' | 'contacted_whatsapp' = 'ready_to_donate',
    notes?: string
  ): Promise<DonorResponseRecord> {
    const record: DonorResponseRecord = {
      id: `resp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      requestId,
      donorName: donorData.fullName,
      donorPhone: donorData.phone,
      donorBloodType: donorData.bloodType,
      district: donorData.district,
      responseType,
      timestamp: new Date().toISOString(),
      notes
    };

    // Store in local storage
    try {
      const saved = this.getDonorResponses();
      const updated = [record, ...saved.filter((r) => r.id !== record.id)];
      localStorage.setItem(DONOR_RESPONSES_KEY, JSON.stringify(updated));
    } catch {}

    // Send to backend
    try {
      await fetch(getApiUrl(`/api/requests/${requestId}/respond`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      }).catch(() => {});
    } catch {}

    return record;
  }

  /**
   * Get all recorded donor responses
   */
  getDonorResponses(): DonorResponseRecord[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const data = localStorage.getItem(DONOR_RESPONSES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get responses for a specific request
   */
  getResponsesForRequest(requestId: string): DonorResponseRecord[] {
    return this.getDonorResponses().filter((r) => r.requestId === requestId);
  }

  /**
   * Broadcast custom notification from Admin Dashboard filtered by blood type or district
   */
  async sendCustomBroadcast(payload: {
    title: string;
    message: string;
    bloodType?: string;
    district?: string;
    urgency?: 'critical' | 'urgent' | 'moderate' | 'normal';
    linkPage?: string;
    itemId?: string;
  }): Promise<{ success: boolean; message: string; targetedCount?: number }> {
    try {
      const response = await fetch(getApiUrl('/api/notifications/custom-broadcast'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'فشل إرسال الإشعار المخصص');
      }
      return data;
    } catch (err: any) {
      console.warn('sendCustomBroadcast notice:', err);
      throw err;
    }
  }

  /**
   * Get FCM registered devices status for Admin
   */
  async getFCMDevicesStatus(): Promise<any> {
    try {
      const res = await fetch(getApiUrl('/api/notifications/fcm-devices'));
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('getFCMDevicesStatus notice:', e);
    }
    return {
      total: 0,
      active: 0,
      androidCount: 0,
      webCount: 0,
      byBloodType: {},
      byDistrict: {},
      devices: [],
      fcmReady: true,
      projectId: 'avian-gate-pbcxw'
    };
  }
}

export const pushNotificationService = new PushNotificationService();
