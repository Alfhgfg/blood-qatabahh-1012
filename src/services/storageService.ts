import { 
  BloodRequest, 
  BloodType, 
  District, 
  Donor, 
  AppNotification, 
  UserRole, 
  ExportLog, 
  AdminSettings, 
  ServerHealth,
  UserAccount,
  AuthResponse,
  Announcement,
  AuditLog,
  HospitalAd,
  Hospital,
  Doctor
} from '../types';
import { INITIAL_DISTRICTS, INITIAL_DONORS, INITIAL_NOTIFICATIONS, INITIAL_REQUESTS } from '../data/initialData';
import { firestoreService } from '../firebase/firestoreService';
import { sortHospitalAds, sanitizeWebsiteUrl, isValidImageSource } from '../utils/hospitalAdUtils';
import { sortHospitals, sortDoctors, isValidDirectoryImageSource } from '../utils/hospitalDirectoryUtils';
import { summarizeUsersDirectory, UserDirectorySummary } from '../lib/userDirectoryUtils.js';
import { auth, db } from '../firebase/config';
import { doc, getDoc, getDocFromServer, setDoc } from 'firebase/firestore';
import { 
  signOut, 
  signInWithEmailAndPassword, 
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail, 
  updatePassword,
  onAuthStateChanged,
  sendEmailVerification as firebaseSendEmailVerification,
  User
} from 'firebase/auth';
import { sanitizeInput, sanitizePhoneNumber } from './securityShield';
import { exportDonorsToExcel } from './excelExportService';

const DONORS_KEY = 'qaatabah_blood_donors_v1';
const REQUESTS_KEY = 'qaatabah_blood_requests_v1';
const DISTRICTS_KEY = 'qaatabah_blood_districts_v1';
const NOTIFICATIONS_KEY = 'qaatabah_blood_notifs_v1';
const ROLE_KEY = 'qaatabah_blood_role_v1';
const ADMIN_ID_TOKEN_KEY = 'qaatabah_blood_admin_id_token_v1';
const DELETED_DONORS_KEY = 'qaatabah_blood_deleted_donors_v1';
const DELETED_REQUESTS_KEY = 'qaatabah_blood_deleted_requests_v1';
const CURRENT_USER_KEY = 'qaatabah_blood_current_user_v1';
const USERS_KEY = 'qaatabah_blood_users_v1';
const HOSPITAL_ADS_KEY = 'qaatabah_hospital_ads_v1';
const HOSPITALS_KEY = 'qaatabah_hospitals_v1';
const DOCTORS_KEY = 'qaatabah_doctors_v1';
const SERVER_URL_OVERRIDE_KEY = 'qaatabah_blood_server_url_override_v1';

export const MASTER_ADMIN_EMAIL = 'abdulrahmanalshaiby2028@gmail.com';
export const MASTER_ADMIN_EMAILS = [
  'abdulrahmanalshaiby2028@gmail.com',
  'abdulrahmanalshaiby2070@gmail.com',
  'an736160403an@gmail.com'
];
// Main Admin Master Code
export const MASTER_ADMIN_CODE = 'alsh486iby-2026';
export const ADMIN_MASTER_PASSWORD = 'alsh486iby-2026';

/**
 * Ensures Firebase Authentication is ready and returns the active user,
 * waiting for onAuthStateChanged / authStateReady if necessary.
 */
export async function waitForFirebaseAuth(timeoutMs = 4000): Promise<User | null> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  // Check if authStateReady is supported
  if (typeof (auth as any).authStateReady === 'function') {
    try {
      await Promise.race([
        (auth as any).authStateReady(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Auth readiness timeout')), timeoutMs))
      ]);
      if (auth.currentUser) return auth.currentUser;
    } catch {}
  }

  return new Promise((resolve) => {
    let resolved = false;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!resolved) {
        resolved = true;
        unsubscribe();
        resolve(user);
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unsubscribe();
        resolve(auth.currentUser);
      }
    }, timeoutMs);
  });
}

/**
 * Obtains Firebase Authorization headers for admin operations.
 * Awaits authentication readiness, requests an ID Token (refreshed automatically),
 * and caches it in persistent storage.
 */
export async function getAdminAuthHeaders(forceRefresh = false): Promise<Record<string, string>> {
  try {
    let user = auth.currentUser;
    if (!user) {
      user = await waitForFirebaseAuth(3500);
    }

    if (user) {
      const token = await user.getIdToken(forceRefresh);
      if (token) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(ADMIN_ID_TOKEN_KEY, token);
        }
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(ADMIN_ID_TOKEN_KEY, token);
        }
        return { 'Authorization': `Bearer ${token}` };
      }
    }
  } catch (err) {
    console.warn('getAdminAuthHeaders token fetch notice:', err);
  }

  const cached = 
    (typeof localStorage !== 'undefined' ? localStorage.getItem(ADMIN_ID_TOKEN_KEY) : null) ||
    (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(ADMIN_ID_TOKEN_KEY) : null);

  if (cached && cached.trim()) {
    return { 'Authorization': `Bearer ${cached.trim()}` };
  }

  return {};
}

// Default live production HTTPS backend URL (Cloud Run deployment)
export const DEFAULT_PRODUCTION_API_URL = 'https://blood-qatabah.ai.studio';

export function getServerUrl(): string {
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem(SERVER_URL_OVERRIDE_KEY);
    if (override && override.trim()) {
      return override.trim().replace(/\/+$/, '');
    }
    if (window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('localhost:')) {
      return window.location.origin;
    }
  }
  const envUrl = (import.meta as any)?.env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return DEFAULT_PRODUCTION_API_URL;
}

export function setServerUrl(url: string): void {
  if (typeof window !== 'undefined') {
    if (!url || !url.trim()) {
      localStorage.removeItem(SERVER_URL_OVERRIDE_KEY);
    } else {
      localStorage.setItem(SERVER_URL_OVERRIDE_KEY, url.trim().replace(/\/+$/, ''));
    }
  }
}

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem(SERVER_URL_OVERRIDE_KEY);
    if (override && override.trim()) {
      return override.trim().replace(/\/+$/, '');
    }
  }

  const envUrl = (import.meta as any)?.env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    // Detect Capacitor / Android APK WebView environment
    const isCapacitor = 
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:' ||
      window.location.protocol === 'file:' ||
      !!(window as any).Capacitor?.isNativePlatform?.() ||
      (window.location.hostname === 'localhost' && !window.location.port);

    if (isCapacitor) {
      // In native Android WebView, Firestore SDK handles direct cloud connectivity
      if (window.location.origin && window.location.origin.startsWith('http')) {
        return window.location.origin;
      }
      return '';
    }

    // In web browser when deployed or previewing
    if (window.location.origin && !window.location.origin.includes('localhost:')) {
      return window.location.origin;
    }
  }

  // Local development fallback
  return '';
}

export function getApiUrl(endpoint: string): string {
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const base = getApiBaseUrl();
  if (!base) return clean;
  return `${base}${clean}`;
}

// Secure client-side password hashing (SHA-256)
export async function hashPassword(password: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(password + '_blood_qatabah_2026_salt');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (err) {
    console.warn('crypto.subtle hash fallback notice:', err);
  }
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `h_${Math.abs(hash)}`;
}

// Arabic text normalizer
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s\t\n]+/g, ' ')
    .toLowerCase();
}

// Yemeni phone normalizer
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let clean = String(phone).replace(/[\s\-\(\)\.]+/g, '');
  if (clean.startsWith('+967')) clean = clean.substring(4);
  if (clean.startsWith('00967')) clean = clean.substring(5);
  if (clean.startsWith('967')) clean = clean.substring(3);
  if (clean.startsWith('0')) clean = clean.substring(1);
  return clean;
}

// Check duplication and single registration
export function checkDonorDuplication(
  newDonor: { fullName: string; phone: string },
  existingDonors: Donor[],
  excludeId?: string
): { isDuplicate: boolean; reason?: string } {
  const normPhone = normalizePhoneNumber(newDonor.phone);
  const normName = normalizeArabicText(newDonor.fullName);
  const rawName = String(newDonor.fullName || '').trim();

  // Validate phone format
  if (!normPhone || normPhone.length !== 9 || !/^(70|71|73|77|78)\d{7}$/.test(normPhone)) {
    return {
      isDuplicate: true,
      reason: 'رقم الهاتف غير صحيح. يجب أن يتكون من 9 أرقام ويبدأ بـ (77 أو 78 أو 73 أو 71 أو 70).'
    };
  }

  // Reject repeating fake numbers (e.g., 777777777, 711111111)
  if (/^(\d)\1{7,}$/.test(normPhone)) {
    return {
      isDuplicate: true,
      reason: 'رقم الهاتف غير صالح، يرجى إدخال رقم هاتف اتصال حقيقي للتواصل عند الحاجة للدم.'
    };
  }

  // Validate name has at least 3 words (e.g. first + father + family name)
  const words = rawName.split(/\s+/).filter((w) => w.length > 1);
  if (words.length < 3) {
    return {
      isDuplicate: true,
      reason: 'يرجى إدخال الاسم الثلاثي أو الرباعي كاملاً (مثال: صالح محمد علي الشعيبي) لضمان تفادي تشابه الأسماء وضمان دقة السجل.'
    };
  }

  // Check against all existing donors
  for (const existing of existingDonors) {
    if (excludeId && existing.id === excludeId) continue;

    const existingNormPhone = normalizePhoneNumber(existing.phone);
    const existingNormName = normalizeArabicText(existing.fullName);

    // 1. Phone already registered
    if (existingNormPhone === normPhone) {
      return {
        isDuplicate: true,
        reason: `رقم الهاتف (${newDonor.phone}) مسجل مسبقاً في السجل باسم المتبرع (${existing.fullName}). يمنع تسجيل نفس الرقم لمتبرع آخر.`
      };
    }

    // 2. Exact normalized name match
    if (existingNormName === normName) {
      return {
        isDuplicate: true,
        reason: `المتبرع (${newDonor.fullName}) مسجل مسبقاً في السجل برقم هاتف (${existing.phone}). يمنع تكرار تسجيل نفس المتبرع.`
      };
    }

    // 3. Similarity / token overlap
    const existingWords = existingNormName.split(' ').filter((w) => w.length > 1);
    const newWords = normName.split(' ').filter((w) => w.length > 1);

    const commonWords = newWords.filter((w) => existingWords.includes(w));
    if (commonWords.length >= 3 && (commonWords.length >= newWords.length - 1 || commonWords.length >= existingWords.length - 1)) {
      return {
        isDuplicate: true,
        reason: `هذا الاسم يتشابه أو يتطابق بشكل كبير مع المتبرع المسجل مسبقاً (${existing.fullName} - ${existing.phone}). يمنع التحايل بتسجيل سجلات متعددة لنفس الشخص.`
      };
    }
  }

  return { isDuplicate: false };
}

export const storageService = {
  // Synchronous Local Fallbacks (for instant initial rendering)
  getDonors(): Donor[] {
    try {
      const data = localStorage.getItem(DONORS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      return [];
    } catch {
      return [];
    }
  },

  getRequests(): BloodRequest[] {
    try {
      const data = localStorage.getItem(REQUESTS_KEY);
      if (!data) {
        localStorage.setItem(REQUESTS_KEY, JSON.stringify(INITIAL_REQUESTS));
        return INITIAL_REQUESTS;
      }
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_REQUESTS;
    } catch {
      return INITIAL_REQUESTS;
    }
  },

  getDistricts(): District[] {
    try {
      const data = localStorage.getItem(DISTRICTS_KEY);
      if (!data) {
        localStorage.setItem(DISTRICTS_KEY, JSON.stringify(INITIAL_DISTRICTS));
        return INITIAL_DISTRICTS;
      }
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_DISTRICTS;
    } catch {
      return INITIAL_DISTRICTS;
    }
  },

  setLocalDonors(donors: Donor[]): void {
    try {
      localStorage.setItem(DONORS_KEY, JSON.stringify(donors));
    } catch {}
  },

  setLocalRequests(requests: BloodRequest[]): void {
    try {
      localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
    } catch {}
  },

  setLocalDistricts(districts: District[]): void {
    try {
      localStorage.setItem(DISTRICTS_KEY, JSON.stringify(districts));
    } catch {}
  },

  setLocalNotifications(notifications: AppNotification[]): void {
    try {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    } catch {}
  },

  getNotifications(): AppNotification[] {
    try {
      const data = localStorage.getItem(NOTIFICATIONS_KEY);
      if (!data) {
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(INITIAL_NOTIFICATIONS));
        return INITIAL_NOTIFICATIONS;
      }
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : INITIAL_NOTIFICATIONS;
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  },

  // Role & Session Management
  getAdminAuthHeaders(forceRefresh = false): Promise<Record<string, string>> {
    return getAdminAuthHeaders(forceRefresh);
  },

  getRole(): UserRole {
    const user = this.getCurrentUser();
    if (user) return user.role;
    // Do not persist admin role in localStorage across browser restarts
    const role = sessionStorage.getItem(ROLE_KEY);
    return role === 'admin' ? 'admin' : 'user';
  },

  setRole(role: UserRole): void {
    // Only persist role for the current session
    sessionStorage.setItem(ROLE_KEY, role);
    const user = this.getCurrentUser();
    if (user && user.role !== role) {
      user.role = role;
      this.setCurrentUser(user);
    }
  },

  getCurrentUser(): UserAccount | null {
    try {
      let data = localStorage.getItem(CURRENT_USER_KEY);
      if (!data) {
        data = sessionStorage.getItem(CURRENT_USER_KEY);
      }
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && (parsed.id || parsed.username)) {
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  setCurrentUser(user: UserAccount | null): void {
    if (typeof localStorage === 'undefined') return;
    if (user) {
      const sessionData = {
        ...user,
        lastSavedAt: new Date().toISOString()
      };
      try {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sessionData));
        localStorage.setItem(ROLE_KEY, user.role);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sessionData));
        }
      } catch {}
    } else {
      try {
        localStorage.removeItem(CURRENT_USER_KEY);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(CURRENT_USER_KEY);
        }
      } catch {}
    }
  },

  logout(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(CURRENT_USER_KEY);
        localStorage.removeItem(ADMIN_ID_TOKEN_KEY);
        localStorage.setItem(ROLE_KEY, 'user');
      } catch {}
    }
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem(CURRENT_USER_KEY);
        sessionStorage.removeItem(ADMIN_ID_TOKEN_KEY);
      } catch {}
    }
    try {
      signOut(auth).catch(() => {});
    } catch {}
  },

  // Authentication Endpoints
  async login(username: string, password: string): Promise<AuthResponse> {
    const cleanU = String(username || '').trim();
    const cleanP = String(password || '').trim();
    const cleanPhone = normalizePhoneNumber(cleanU);

    if (!cleanU || !cleanP) {
      return { success: false, error: 'يرجى إدخال اسم المستخدم وكلمة المرور' };
    }

    const passHash = await hashPassword(cleanP);
    const MASTER_HASH = '0ffa41d39b4d4e70e376d592843d41e94a71d1593aa961f31dbc278ecbc56992';

    // Direct check for main admin code: alsh486iby-2026
    if (cleanP === MASTER_ADMIN_CODE || cleanU === MASTER_ADMIN_CODE || passHash === MASTER_HASH) {
      const adminUser: UserAccount = {
        id: 'user-admin',
        username: 'admin',
        fullName: 'مسؤول السجل المركزي - قعطبة',
        phone: '770236765',
        role: 'admin',
        createdAt: '2026-08-01T00:00:00Z',
        lastLoginAt: new Date().toISOString()
      };
      this.setCurrentUser(adminUser);
      this.setRole('admin');
      fetch(getApiUrl('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: MASTER_ADMIN_EMAIL, password: cleanP || cleanU })
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.adminSessionToken) {
            try {
              localStorage.setItem(ADMIN_ID_TOKEN_KEY, data.adminSessionToken);
              sessionStorage.setItem(ADMIN_ID_TOKEN_KEY, data.adminSessionToken);
            } catch {}
          }
        })
        .catch(() => {});
      return { success: true, user: adminUser };
    }

    // 1. Instant Local Cache Verification (< 10ms)
    const localUsers = this.getLocalUsers();
    const localMatch = localUsers.find(
      (u) =>
        (u.username && u.username.toLowerCase() === cleanU.toLowerCase()) ||
        (cleanPhone && normalizePhoneNumber(u.phone) === cleanPhone)
    );

    if (localMatch) {
      const isLocalPassValid =
        (localMatch as any).passwordHash === passHash ||
        (localMatch as any).password === cleanP;

      if (isLocalPassValid) {
        const persistentUser: UserAccount = {
          ...localMatch,
          passwordHash: passHash,
          lastLoginAt: new Date().toISOString()
        };
        this.setCurrentUser(persistentUser);

        // Background non-blocking sync with Firestore & Firebase Auth
        this.syncFirebaseAuthInBackground(persistentUser, cleanP);
        return { success: true, user: persistentUser };
      }
    }

    // 2. Targeted Firestore Query (< 250ms)
    try {
      const remoteUser = await firestoreService.fetchUserByUsernameOrPhone(cleanU);

      if (remoteUser) {
        const isPasswordValid =
          (remoteUser as any).passwordHash === passHash ||
          (remoteUser as any).password === cleanP;

        if (!isPasswordValid) {
          return { success: false, error: 'كلمة المرور غير صحيحة' };
        }

        const persistentUser: UserAccount = {
          ...remoteUser,
          passwordHash: passHash,
          lastLoginAt: new Date().toISOString()
        };

        // Instant session establishment
        this.setCurrentUser(persistentUser);
        const updatedLocal = [...localUsers.filter((u) => u.id !== persistentUser.id && u.username !== persistentUser.username), persistentUser];
        this.saveLocalUsers(updatedLocal);

        // Background non-blocking sync with Firebase Auth & Firestore
        this.syncFirebaseAuthInBackground(persistentUser, cleanP);

        return { success: true, user: persistentUser };
      }

      // 3. Fallback: Check server backend API with fast 2.5s timeout
      const apiUrl = getApiUrl('/api/auth/login');
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanU, password: cleanP }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success && data.user) {
          const persistentUser: UserAccount = {
            ...data.user,
            passwordHash: passHash,
            lastLoginAt: new Date().toISOString()
          };
          this.setCurrentUser(persistentUser);
          this.saveLocalUsers([...localUsers.filter((u) => u.id !== persistentUser.id), persistentUser]);
          firestoreService.setUser(persistentUser).catch(() => {});
          this.syncFirebaseAuthInBackground(persistentUser, cleanP);
          return { success: true, user: persistentUser };
        }
      } catch {}

      return { success: false, error: 'اسم المستخدم أو رقم الهاتف غير مسجل بالنظام' };
    } catch (e: any) {
      console.error('Login error:', e);
      if (e?.message?.includes('network') || e?.code === 'auth/network-request-failed') {
        return {
          success: false,
          error: 'تعذر الاتصال بقاعدة البيانات وخادم المصادقة، يرجى التأكد من اتصال الإنترنت ثم إعادة المحاولة'
        };
      }
      return { success: false, error: 'تعذر التحقق من بيانات الدخول، يرجى التأكد من اتصال الإنترنت' };
    }
  },

  // Asynchronous background Firestore synchronization
  syncFirebaseAuthInBackground(user: UserAccount, _cleanP: string): void {
    setTimeout(async () => {
      try {
        // Update Firestore lastLoginAt
        await firestoreService.setUser({
          ...user,
          lastLoginAt: new Date().toISOString()
        }).catch(() => {});
      } catch (err) {
        console.warn('Background sync note:', err);
      }
    }, 10);
  },

  async register(account: { username: string; password: string; fullName: string; phone: string }): Promise<AuthResponse> {
    const cleanUsername = String(account.username || '').trim().toLowerCase();
    const cleanPhone = normalizePhoneNumber(account.phone);
    const cleanName = String(account.fullName || '').trim();
    const password = String(account.password || '').trim();

    // 1. Client-side input validation with clear messages
    if (!cleanUsername || !password || !cleanName || !cleanPhone) {
      return { success: false, error: 'يرجى إكمال جميع الحقول المطلوبة للتسجيل' };
    }
    if (cleanUsername.length < 3) {
      return { success: false, error: 'يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل' };
    }
    if (password.length < 4) {
      return { success: false, error: 'يجب أن تتكون كلمة المرور من 4 خانات على الأقل' };
    }
    if (!cleanPhone || cleanPhone.length !== 9 || !/^(70|71|73|77|78)\d{7}$/.test(cleanPhone)) {
      return { success: false, error: 'رقم الهاتف غير صحيح، يجب أن يتكون من 9 أرقام يبدأ بـ 77 أو 78 أو 73 أو 71 أو 70' };
    }
    if (cleanUsername === 'admin' || cleanUsername === 'مدير' || cleanUsername === 'user') {
      return { success: false, error: 'اسم المستخدم هذا محجوز مسبقاً، يرجى اختيار اسم مستخدم آخر' };
    }

    // 2. High-speed duplicate verification
    try {
      // Check local cache
      const localUsers = this.getLocalUsers();
      const localUsernameExists = localUsers.some((u) => u.username && u.username.toLowerCase() === cleanUsername);
      if (localUsernameExists) {
        return { success: false, error: 'اسم المستخدم مسجل مسبقاً، يرجى اختيار اسم مستخدم آخر' };
      }
      const localPhoneExists = localUsers.some((u) => u.phone && normalizePhoneNumber(u.phone) === cleanPhone);
      if (localPhoneExists) {
        return { success: false, error: 'رقم الهاتف مسجل مسبقاً في النظام' };
      }

      // Fast targeted Firestore checks
      const existingUserByUsername = await firestoreService.fetchUserByUsernameOrPhone(cleanUsername);
      if (existingUserByUsername && existingUserByUsername.username.toLowerCase() === cleanUsername) {
        return { success: false, error: 'اسم المستخدم مسجل مسبقاً، يرجى اختيار اسم مستخدم آخر' };
      }

      const existingUserByPhone = await firestoreService.fetchUserByUsernameOrPhone(cleanPhone);
      if (existingUserByPhone && normalizePhoneNumber(existingUserByPhone.phone) === cleanPhone) {
        return { success: false, error: `رقم الهاتف مسجل مسبقاً باسم (${existingUserByPhone.fullName})` };
      }

      const passHash = await hashPassword(password);
      const newUserId = `user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const newUser: UserAccount & { passwordHash?: string; password?: string } = {
        id: newUserId,
        username: cleanUsername,
        fullName: cleanName,
        phone: cleanPhone,
        role: 'user',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        passwordHash: passHash,
        password: password
      };

      // Save to Cloud Firestore permanently
      await firestoreService.setUser(newUser);

      // Save to LocalStorage & set session
      this.saveLocalUsers([...localUsers, newUser]);
      this.setCurrentUser(newUser);

      // Mirror to backend server API in background
      try {
        fetch(getApiUrl('/api/auth/register'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanUsername,
            password,
            fullName: cleanName,
            phone: cleanPhone
          })
        }).catch(() => {});
      } catch {}

      return { success: true, user: newUser };
    } catch (fallbackErr: any) {
      console.error('Registration final error details:', fallbackErr?.message || fallbackErr);
      if (fallbackErr?.message?.includes('network') || fallbackErr?.code === 'auth/network-request-failed') {
        return {
          success: false,
          error: 'تعذر الاتصال بقاعدة البيانات وخادم المصادقة، يرجى التأكد من اتصال الإنترنت ثم إعادة المحاولة'
        };
      }
      return { 
        success: false, 
        error: `تعذر إنشاء الحساب حالياً (${fallbackErr?.message || 'خطأ في الاتصال'}). يرجى التأكد من اتصال الإنترنت ثم إعادة المحاولة.` 
      };
    }
  },

  async sendAdminPasswordReset(targetEmail?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const email = (targetEmail || MASTER_ADMIN_EMAIL).trim().toLowerCase();
    try {
      await sendPasswordResetEmail(auth, email);
      try {
        fetch(getApiUrl('/api/admin/request-password-reset'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        }).catch(() => {});
      } catch {}
      return {
        success: true,
        message: `تم إرسال رابط استعادة وتعيين كلمة المرور المشفر إلى بريدك الإلكتروني المعتمد (${email}). يرجى فتح بريدك والضغط على الرابط لتعيين كلمة مرور خاصة وجديدة.`
      };
    } catch (err: any) {
      console.warn('sendPasswordResetEmail notice:', err?.message || err);
      try {
        const res = await fetch(getApiUrl('/api/admin/request-password-reset'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          return { success: true, message: data.message };
        }
      } catch {}
      return {
        success: false,
        error: 'تعذر إرسال رابط استعادة كلمة المرور، يرجى التأكد من اتصال الإنترنت ثم إعادة المحاولة.'
      };
    }
  },

  async updateAdminPassword(newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const cleanP = String(newPassword || '').trim();
    if (!cleanP || cleanP.length < 6) {
      return { success: false, error: 'يجب ألا تقل كلمة المرور الجديدة عن 6 خانات' };
    }
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, cleanP);
      }
      await fetch(getApiUrl('/api/admin/init-auth'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: cleanP })
      }).catch(() => {});
      return { success: true, message: 'تم تحديث كلمة المرور الخاصة بالمسؤول بنجاح وحمايتها في Firebase Authentication' };
    } catch (err: any) {
      console.warn('updatePassword notice:', err);
      try {
        const res = await fetch(getApiUrl('/api/admin/init-auth'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: cleanP })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          return { success: true, message: 'تم تحديث كلمة المرور الخاصة بالمسؤول بنجاح' };
        }
      } catch {}
      return { success: false, error: err.message || 'تعذر تحديث كلمة المرور' };
    }
  },

  getLocalUsers(): UserAccount[] {
    try {
      const local = localStorage.getItem(USERS_KEY);
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  },

  saveLocalUsers(users: UserAccount[]): void {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch {}
  },

  async getRegisteredUsers(): Promise<UserAccount[]> {
    // 1. Live Firebase Firestore is the single authoritative source for both Web and Android
    try {
      const remote = await firestoreService.fetchUsers();
      const normalized = summarizeUsersDirectory(remote).activeUsers;
      this.saveLocalUsers(normalized);
      return normalized;
    } catch (fsErr) {
      console.warn('getRegisteredUsers Firestore fallback notice:', fsErr);
    }

    // 2. Fallback to backend endpoint (which also reads live Firestore with Cache-Control: no-store)
    try {
      const headers = await getAdminAuthHeaders();
      const apiUrl = getApiUrl('/api/admin/users');
      const res = await fetch(apiUrl, { headers, cache: 'no-store' });
      if (res.ok) {
        const users = await res.json();
        const normalized = summarizeUsersDirectory(users).activeUsers;
        this.saveLocalUsers(normalized);
        return normalized;
      }
    } catch {
      // ignore
    }

    // 3. Offline local cache fallback
    return summarizeUsersDirectory(this.getLocalUsers()).activeUsers;
  },

  subscribeRegisteredUsers(
    callback: (users: UserAccount[], summary: UserDirectorySummary) => void,
    onError?: (error: any) => void
  ): () => void {
    return firestoreService.subscribeUsers((users, summary) => {
      this.saveLocalUsers(users);
      callback(users, summary);
    }, onError);
  },

  async deleteRegisteredUser(id: string): Promise<boolean> {
    try {
      firestoreService.deleteUser(id).catch(() => {});
      const headers = await getAdminAuthHeaders();
      const apiUrl = getApiUrl(`/api/admin/users/${id}`);
      const res = await fetch(apiUrl, { method: 'DELETE', headers });
      const local = this.getLocalUsers();
      this.saveLocalUsers(local.filter((u) => u.id !== id));
      return res.ok;
    } catch {
      const local = this.getLocalUsers();
      this.saveLocalUsers(local.filter((u) => u.id !== id));
      return true;
    }
  },

  // Deleted items tracking to ensure syncing across devices
  getDeletedDonorIds(): string[] {
    try {
      const data = localStorage.getItem(DELETED_DONORS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addDeletedDonorId(id: string): void {
    try {
      const current = this.getDeletedDonorIds();
      if (!current.includes(id)) {
        localStorage.setItem(DELETED_DONORS_KEY, JSON.stringify([...current, id]));
      }
    } catch {}
  },

  getDeletedRequestIds(): string[] {
    try {
      const data = localStorage.getItem(DELETED_REQUESTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addDeletedRequestId(id: string): void {
    try {
      const current = this.getDeletedRequestIds();
      if (!current.includes(id)) {
        localStorage.setItem(DELETED_REQUESTS_KEY, JSON.stringify([...current, id]));
      }
    } catch {}
  },

  // Asynchronous Bidirectional Synchronization with Server
  async syncFromServer(): Promise<{
    donors: Donor[];
    requests: BloodRequest[];
    districts: District[];
    notifications: AppNotification[];
    hospitals: Hospital[];
    doctors: Doctor[];
    online: boolean;
  }> {
    try {
      const localDonors = this.getDonors();
      const localRequests = this.getRequests();
      const localDistricts = this.getDistricts();
      const localUsers = this.getLocalUsers();

      const deletedDonorIds = this.getDeletedDonorIds();
      const deletedRequestIds = this.getDeletedRequestIds();

      const syncRes = await fetch(getApiUrl('/api/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donors: localDonors,
          requests: localRequests,
          districts: localDistricts,
          users: localUsers,
          deletedDonorIds,
          deletedRequestIds
        })
      });

      if (syncRes.ok) {
        const data = await syncRes.json();
        if (data.success) {
          // Update local cache safely with the merged dataset
          if (Array.isArray(data.donors)) {
            localStorage.setItem(DONORS_KEY, JSON.stringify(data.donors));
          }
          if (Array.isArray(data.requests)) {
            localStorage.setItem(REQUESTS_KEY, JSON.stringify(data.requests));
          }
          if (Array.isArray(data.districts)) {
            localStorage.setItem(DISTRICTS_KEY, JSON.stringify(data.districts));
          }
          if (Array.isArray(data.notifications)) {
            localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(data.notifications));
          }
          if (Array.isArray(data.hospitalAds)) {
            localStorage.setItem(HOSPITAL_ADS_KEY, JSON.stringify(sortHospitalAds(data.hospitalAds)));
          }
          if (Array.isArray(data.hospitals)) {
            localStorage.setItem(HOSPITALS_KEY, JSON.stringify(sortHospitals(data.hospitals)));
          }
          if (Array.isArray(data.doctors)) {
            localStorage.setItem(DOCTORS_KEY, JSON.stringify(sortDoctors(data.doctors)));
          }
          if (Array.isArray(data.users) && data.users.length > 0) {
            // Only refresh the active signed-in session profile if updated on server;
            // do NOT merge stale local JSON snapshot users over live Firestore users cache.
            const current = this.getCurrentUser();
            if (current) {
              const updatedProfile = data.users.find((u: UserAccount) => u.id === current.id);
              if (updatedProfile && (updatedProfile.role !== current.role || updatedProfile.linkedDonorId !== current.linkedDonorId)) {
                this.setCurrentUser({ ...current, ...updatedProfile });
              }
            }
          }

          // Clear flushed delete queues
          localStorage.removeItem(DELETED_DONORS_KEY);
          localStorage.removeItem(DELETED_REQUESTS_KEY);

          const finalDonors = data.donors || localDonors;
          const finalRequests = data.requests || localRequests;
          const finalDistricts = data.districts || localDistricts;
          const finalUsers = this.getLocalUsers();

          // Background sync & seed with Firebase Firestore
          firestoreService.seedInitialDataIfEmpty(
            finalDonors,
            finalRequests,
            finalDistricts,
            finalUsers
          ).catch((err) => console.warn('Firestore initial sync notice:', err));

          return {
            donors: finalDonors,
            requests: finalRequests,
            districts: finalDistricts,
            notifications: data.notifications || this.getNotifications(),
            hospitals: Array.isArray(data.hospitals) ? sortHospitals(data.hospitals) : this.getLocalHospitals(),
            doctors: Array.isArray(data.doctors) ? sortDoctors(data.doctors) : this.getLocalDoctors(),
            online: true
          };
        }
      }
    } catch (e) {
      console.warn('Bidirectional sync failed, operating with local storage:', e);
    }

    return {
      donors: this.getDonors(),
      requests: this.getRequests(),
      districts: this.getDistricts(),
      notifications: this.getNotifications(),
      hospitals: this.getLocalHospitals(),
      doctors: this.getLocalDoctors(),
      online: false
    };
  },

  // Donors CRUD: Firebase Firestore as the primary shared central database
  async saveDonor(donor: Omit<Donor, 'id' | 'createdAt'>, activeUser?: UserAccount | null): Promise<Donor> {
    const user = activeUser || this.getCurrentUser();

    // 0. Sanitize inputs to prevent XSS and code injection
    const sanitizedDonor: Omit<Donor, 'id' | 'createdAt'> = {
      ...donor,
      fullName: sanitizeInput(donor.fullName),
      phone: sanitizePhoneNumber(donor.phone),
      area: sanitizeInput(donor.area),
      district: sanitizeInput(donor.district),
      notes: donor.notes ? sanitizeInput(donor.notes) : undefined,
    };

    // 1. Perform primary save directly in Firestore with centralized deduplication
    let createdDonor: Donor;
    try {
      createdDonor = await firestoreService.saveDonor(sanitizedDonor, user);
    } catch (firestoreErr: any) {
      let errMessage = firestoreErr?.message || String(firestoreErr);
      try {
        if (errMessage.startsWith('{')) {
          const parsed = JSON.parse(errMessage);
          errMessage = parsed.error || errMessage;
        }
      } catch {}

      if (errMessage.includes('مسجل مسبقاً') ||
          errMessage.includes('يمنع') ||
          errMessage.includes('إكمال جميع الحقول') ||
          errMessage.includes('رقم الهاتف غير صحيح') ||
          errMessage.includes('سجل واحد فقط')) {
        throw new Error(errMessage);
      }

      console.warn('Direct Firestore save notice, retrying / mirroring via server API:', errMessage);

      // Fallback via server API
      const res = await fetch(getApiUrl('/api/donors'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...donor, userId: user?.id, userRole: user?.role })
      });
      if (res.ok) {
        createdDonor = await res.json();
        // Also ensure synced to Firestore in background
        firestoreService.setDonor(createdDonor).catch(() => {});
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errMessage || 'تعذر حفظ بيانات المتبرع في قاعدة البيانات المشتركة');
      }
    }

    // 3. Update local cache
    const currentDonors = this.getDonors();
    const updated = [createdDonor, ...currentDonors.filter((d) => d.id !== createdDonor.id)];
    this.setLocalDonors(updated);

    // 4. Link donor to user session if applicable
    if (user && user.role === 'user') {
      user.linkedDonorId = createdDonor.id;
      this.setCurrentUser(user);
    }

    // 5. Mirror to Express server for automated Excel export & backups
    try {
      fetch(getApiUrl('/api/donors'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createdDonor)
      }).catch(() => {});
    } catch {}

    return createdDonor;
  },

  async updateDonor(donor: Donor, activeUser?: UserAccount | null): Promise<void> {
    const user = activeUser || this.getCurrentUser();
    const role = user?.role || this.getRole();

    if (role !== 'admin') {
      const existing = this.getDonors().find((d) => d.id === donor.id);
      if (existing) {
        if (
          existing.fullName !== donor.fullName ||
          existing.phone !== donor.phone ||
          existing.bloodType !== donor.bloodType ||
          existing.district !== donor.district ||
          existing.area !== donor.area ||
          existing.lastDonationDate !== donor.lastDonationDate ||
          existing.notes !== donor.notes
        ) {
          throw new Error('عذراً، تعديل بيانات المتبرعين متاح للمسؤول فقط.');
        }
      } else {
        throw new Error('عذراً، تعديل بيانات المتبرعين متاح للمسؤول فقط.');
      }
    }

    const sanitized: Donor = {
      ...donor,
      fullName: sanitizeInput(donor.fullName),
      phone: sanitizePhoneNumber(donor.phone),
      area: sanitizeInput(donor.area),
      district: sanitizeInput(donor.district),
      notes: donor.notes ? sanitizeInput(donor.notes) : undefined,
    };

    // 1. Direct update to Firebase Firestore centralized database
    await firestoreService.updateDonor(sanitized);

    // 2. Update local offline cache
    const donors = this.getDonors();
    const index = donors.findIndex((d) => d.id === sanitized.id);
    if (index !== -1) {
      donors[index] = sanitized;
      this.setLocalDonors(donors);
    } else {
      this.setLocalDonors([sanitized, ...donors]);
    }

    // 3. Mirror update to server in background
    try {
      fetch(getApiUrl(`/api/donors/${donor.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitized)
      }).catch(() => {});
    } catch {}
  },

  async deleteDonor(id: string): Promise<void> {
    const user = this.getCurrentUser();
    if (this.getRole() !== 'admin' && user?.role !== 'admin') {
      throw new Error('عذراً، حذف المتبرعين متاح حصرياً للمسؤول المعتمد.');
    }

    const localDonors = this.getDonors();
    const donorMatch = localDonors.find((d) => d.id === id);
    const donorName = donorMatch ? donorMatch.fullName : id;

    // 1. Direct delete from Firebase Firestore centralized database and AWAIT confirmation
    try {
      await firestoreService.deleteDonor(id);
    } catch (err: any) {
      console.error('Firestore delete error:', err);
      let errMsg = err.message || '';
      if (errMsg.includes('permission') || errMsg.includes('PERMISSION_DENIED')) {
        throw new Error('تم رفض العملية من خادم قاعدة البيانات: ليس لديك صلاحيات مسؤول كافية لحذف المتبرع.');
      }
      throw new Error('تعذر حذف المتبرع من السحابة: يرجى التحقق من اتصال الإنترنت.');
    }

    // 2. Update local offline cache immediately
    const donors = this.getDonors().filter((d) => d.id !== id);
    this.setLocalDonors(donors);

    // 3. Mirror delete to Express server in background
    try {
      getAdminAuthHeaders().then((headers) => {
        fetch(getApiUrl(`/api/donors/${id}`), { method: 'DELETE', headers }).catch(() => {});
      });
    } catch {}

    // 4. Record action in Audit Log
    firestoreService.addAuditLog({
      action: 'delete_donor',
      actionLabel: 'حذف متبرع نهائياً',
      details: `قام المسؤول بحذف المتبرع (${donorName}) نهائياً من قاعدة البيانات السحابية المركزية.`,
      targetId: id,
      targetName: donorName,
      adminEmail: user?.username || 'admin',
      adminName: user?.fullName || 'مسؤول السجل'
    }).catch(() => {});
  },

  async deleteAllDonors(): Promise<number> {
    const user = this.getCurrentUser();
    if (this.getRole() !== 'admin' && user?.role !== 'admin') {
      throw new Error('عذراً، عملية الحذف الشامل متاحة حصرياً للمسؤول المعتمد.');
    }

    // 1. Delete all from Firestore and AWAIT confirmation
    const deletedCount = await firestoreService.deleteAllDonors();

    // 2. Clear local cache
    this.setLocalDonors([]);

    // 3. Mirror delete to Express server
    try {
      const headers = await getAdminAuthHeaders();
      await fetch(getApiUrl('/api/donors/all'), { method: 'DELETE', headers }).catch(() => {});
    } catch {}

    // 4. Record action in Audit Log
    firestoreService.addAuditLog({
      action: 'delete_all_donors',
      actionLabel: 'حذف جميع المتبرعين',
      details: `قام المسؤول بحذف وتصفير جميع المتبرعين (${deletedCount} متبرع) بعد التأكيد الأمني.`,
      adminEmail: user?.username || 'admin',
      adminName: user?.fullName || 'مسؤول السجل'
    }).catch(() => {});

    return deletedCount;
  },

  async deleteUnavailableDonors(): Promise<number> {
    const user = this.getCurrentUser();
    try {
      const count = await firestoreService.deleteUnavailableDonors();
      const localDonors = this.getDonors();
      const availableDonors = localDonors.filter((d) => d.isAvailable);
      this.setLocalDonors(availableDonors);
      try {
        fetch(getApiUrl('/api/donors/unavailable'), { method: 'DELETE' }).catch(() => {});
      } catch {}

      firestoreService.addAuditLog({
        action: 'delete_donor',
        actionLabel: 'تنظيف المتبرعين غير المتاحين',
        details: `قام المسؤول بحذف المتبرعين غير المتاحين للتبرع (${count} متبرع).`,
        adminEmail: user?.username || 'admin',
        adminName: user?.fullName || 'مسؤول السجل'
      }).catch(() => {});

      return count;
    } catch (err) {
      console.warn('deleteUnavailableDonors fallback:', err);
      return 0;
    }
  },

  // Dedicated Admin Login using Firebase Authentication with server ID Token validation
  async loginAdmin(emailOrUser: string, password: string): Promise<AuthResponse> {
    const rawInput = String(emailOrUser || '').trim();
    const cleanPassword = String(password || '').trim();

    if (!cleanPassword && !rawInput) {
      return { success: false, error: 'يرجى إدخال رمز أو كلمة مرور المسؤول' };
    }

    const passHash = await hashPassword(cleanPassword || rawInput);
    const MASTER_HASH = '0ffa41d39b4d4e70e376d592843d41e94a71d1593aa961f31dbc278ecbc56992';

    // Direct check for the main master admin code: alsh486iby-2026
    if (
      cleanPassword === MASTER_ADMIN_CODE ||
      rawInput === MASTER_ADMIN_CODE ||
      passHash === MASTER_HASH
    ) {
      const adminUser: UserAccount = {
        id: 'user-admin',
        username: 'admin',
        fullName: 'مسؤول السجل المركزي - قعطبة',
        phone: '770236765',
        role: 'admin',
        createdAt: '2026-08-01T00:00:00Z',
        lastLoginAt: new Date().toISOString()
      };
      this.setCurrentUser(adminUser);
      this.setRole('admin');
      fetch(getApiUrl('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: MASTER_ADMIN_EMAIL, password: cleanPassword || rawInput })
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.adminSessionToken) {
            try {
              localStorage.setItem(ADMIN_ID_TOKEN_KEY, data.adminSessionToken);
              sessionStorage.setItem(ADMIN_ID_TOKEN_KEY, data.adminSessionToken);
            } catch {}
          }
        })
        .catch(() => {});
      return { success: true, user: adminUser };
    }

    // Determine target email: map 'admin' or custom email to MASTER_ADMIN_EMAIL
    let targetEmail = MASTER_ADMIN_EMAIL;
    if (rawInput && rawInput.includes('@')) {
      targetEmail = rawInput.toLowerCase();
    }

    // Enforce that only master admin emails are allowed to authenticate as admin
    if (!MASTER_ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(targetEmail.toLowerCase())) {
      return { 
        success: false, 
        error: 'تم رفض الوصول: هذا البريد الإلكتروني غير مخول بصلاحيات إدارة النظام. يُسمح فقط بالبريد المعتمد للمديرية.' 
      };
    }

    let idToken = '';
    let firebaseUser: any = null;

    // 1. Direct Firebase Auth sign in (try specified admin email, or alternate master admin email)
    const adminEmailsToTry = [targetEmail];
    for (const em of MASTER_ADMIN_EMAILS) {
      if (!adminEmailsToTry.includes(em.toLowerCase())) {
        adminEmailsToTry.push(em.toLowerCase());
      }
    }

    for (const tryEmail of adminEmailsToTry) {
      try {
        const cred = await signInWithEmailAndPassword(auth, tryEmail, cleanPassword);
        firebaseUser = cred.user;
        idToken = await cred.user.getIdToken(true);
        targetEmail = tryEmail;
        break;
      } catch (fbErr: any) {
        // Continue to check alternate admin email or server fallback
      }
    }

    if (!firebaseUser) {
      // Direct server-verified admin login fallback
      try {
        const srvRes = await fetch(getApiUrl('/api/admin/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: targetEmail, password: cleanPassword })
        });
        const srvData = await srvRes.json().catch(() => ({}));
        if (srvRes.ok && srvData.success && srvData.user) {
          const adminUser: UserAccount = {
            ...srvData.user,
            role: 'admin',
            lastLoginAt: new Date().toISOString()
          };
          if (srvData.adminSessionToken) {
            try {
              localStorage.setItem(ADMIN_ID_TOKEN_KEY, srvData.adminSessionToken);
              sessionStorage.setItem(ADMIN_ID_TOKEN_KEY, srvData.adminSessionToken);
            } catch {}
          }
          this.setCurrentUser(adminUser);
          this.setRole('admin');
          return { success: true, user: adminUser };
        } else if (srvData.error) {
          return { success: false, error: srvData.error };
        }
      } catch (srvFallbackErr) {
        console.warn('Server admin login fallback notice:', srvFallbackErr);
      }

      const passHash = await hashPassword(cleanPassword);
      const MASTER_HASH = '36692387b35b9ac1c16a3da8b23a40f7ae41f5f68ca72a70e87699f7b1d0d80d';

      if (passHash === MASTER_HASH) {
        const adminUser: UserAccount = {
          id: 'admin-fallback-uid',
          username: 'admin',
          fullName: 'مسؤول السجل المركزي (عبدالرحمن الشعيبي)',
          phone: '771234567',
          role: 'admin',
          createdAt: '2026-08-01T00:00:00Z',
          lastLoginAt: new Date().toISOString()
        };
        this.setCurrentUser(adminUser);
        this.setRole('admin');
        return { success: true, user: adminUser };
      }

      return {
        success: false,
        error: 'بيانات الدخول غير صحيحة. يرجى التأكد من البريد الإلكتروني ورمز المرور الخاص بالمسؤول.'
      };
    }

    // 2. Validate Firebase ID Token against backend server for dual-layer authority
    let verifiedUid = firebaseUser?.uid || '';
    if (idToken) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(ADMIN_ID_TOKEN_KEY, idToken);
        }
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(ADMIN_ID_TOKEN_KEY, idToken);
        }

        const srvRes = await fetch(getApiUrl('/api/admin/login'), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ idToken })
        });
        const srvData = await srvRes.json().catch(() => ({}));
        if (srvRes.ok && srvData.success && srvData.user) {
          verifiedUid = srvData.user.id || verifiedUid;
        }
      } catch (srvErr) {
        console.warn('Server token validation notice:', srvErr);
      }
    }

    if (!firebaseUser && !idToken) {
      return { 
        success: false, 
        error: 'فشل تسجيل الدخول. يرجى التحقق من صحة كلمة المرور أو طلب رابط استعادة كلمة المرور عبر البريد الإلكتروني.' 
      };
    }

    // 3. Register trusted Admin UID in Firestore /admins collection for Security Rules
    if (firebaseUser?.uid) {
      try {
        await setDoc(doc(db, 'admins', firebaseUser.uid), {
          email: targetEmail,
          uid: firebaseUser.uid,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (docErr) {
        console.warn('Admins collection setDoc notice:', docErr);
      }
    }

    // 4. Establish authenticated admin session in client
    const adminUser: UserAccount = {
      id: verifiedUid || firebaseUser?.uid || 'user-admin',
      username: 'admin',
      fullName: 'مسؤول السجل المركزي (عبدالرحمن الشعيبي)',
      phone: '771234567',
      role: 'admin',
      createdAt: '2026-08-01T00:00:00Z',
      lastLoginAt: new Date().toISOString()
    };

    this.setCurrentUser(adminUser);
    this.setRole('admin');

    firestoreService.addAuditLog({
      action: 'admin_login',
      actionLabel: 'تسجيل دخول مسؤول موثق',
      details: `تم توثيق هوية المسؤول (${adminUser.fullName}) بنجاح عبر Firebase Authentication بمعرف UID: ${adminUser.id}`,
      adminEmail: targetEmail,
      adminName: adminUser.fullName
    }).catch(() => {});

    return { success: true, user: adminUser };
  },

  async loginAdminWithGoogle(): Promise<AuthResponse> {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const firebaseUser = cred.user;
      const emailLower = String(firebaseUser?.email || '').trim().toLowerCase();

      if (!firebaseUser || !emailLower) {
        await signOut(auth).catch(() => {});
        return { success: false, error: 'تعذر الحصول على البريد الإلكتروني من حساب Google.' };
      }

      const isMasterEmail = MASTER_ADMIN_EMAILS.some((em) => em.toLowerCase() === emailLower);
      let isRegisteredAdminDoc = false;
      if (!isMasterEmail) {
        const adminSnap = await getDocFromServer(doc(db, 'admins', firebaseUser.uid)).catch(() =>
          getDoc(doc(db, 'admins', firebaseUser.uid)).catch(() => null)
        );
        isRegisteredAdminDoc = Boolean(adminSnap && adminSnap.exists());
      }

      if (!isMasterEmail && !isRegisteredAdminDoc) {
        await signOut(auth).catch(() => {});
        return {
          success: false,
          error: `تم رفض الوصول: الحساب (${emailLower}) غير مخول بصلاحيات المسؤول المركزي المعتمد.`
        };
      }

      const idToken = await firebaseUser.getIdToken(true);
      if (idToken) {
        try {
          if (typeof localStorage !== 'undefined') localStorage.setItem(ADMIN_ID_TOKEN_KEY, idToken);
          if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(ADMIN_ID_TOKEN_KEY, idToken);
        } catch {}
      }

      await setDoc(
        doc(db, 'admins', firebaseUser.uid),
        {
          email: emailLower,
          uid: firebaseUser.uid,
          role: 'admin',
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      ).catch((err) => {
        console.warn('Admins collection setDoc notice:', err);
      });

      const adminUser: UserAccount = {
        id: firebaseUser.uid,
        username: 'admin',
        email: emailLower,
        fullName: firebaseUser.displayName || 'مسؤول السجل المركزي - قعطبة',
        phone: '770236765',
        role: 'admin',
        createdAt: '2026-08-01T00:00:00Z',
        lastLoginAt: new Date().toISOString()
      };

      this.setCurrentUser(adminUser);
      this.setRole('admin');

      firestoreService.addAuditLog({
        action: 'admin_login',
        actionLabel: 'تسجيل دخول مسؤول موثق (Google)',
        details: `تم توثيق هوية المسؤول المركزي (${adminUser.fullName}) عبر Google وFirebase Authentication بمعرف UID: ${firebaseUser.uid}`,
        adminEmail: emailLower,
        adminName: adminUser.fullName
      }).catch(() => {});

      return { success: true, user: adminUser };
    } catch (err: any) {
      const code = String(err?.code || '').toLowerCase();
      if (code.includes('popup-closed-by-user')) {
        return { success: false, error: 'تم إغلاق نافذة تسجيل الدخول بحساب Google قبل إكمال المصادقة.' };
      }
      if (code.includes('popup-blocked')) {
        return { success: false, error: 'قام المتصفح بحظر نافذة Google المنبثقة. يرجى السماح بالنوافذ المنبثقة أو استخدام البريد وكلمة المرور.' };
      }
      return {
        success: false,
        error: err?.message || 'تعذر إتمام تسجيل الدخول بحساب Google عبر Firebase Authentication.'
      };
    }
  },

  // Send official Firebase Email Verification link
  async sendEmailVerification(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      // 1. Ensure Firebase Auth is ready
      let user = auth.currentUser;
      if (!user) {
        user = await waitForFirebaseAuth(3500);
      }

      // 2. Obtain fresh Admin Authorization Headers
      const headers = await getAdminAuthHeaders(true);
      if (!headers['Authorization']) {
        return {
          success: false,
          error: 'غير مصرح: رمز التفويض مفقود. يرجى تسجيل الدخول إلى بوابة المسؤول أولاً للتحقق من هويتك.'
        };
      }

      // 3. Dispatch to server endpoint
      const res = await fetch(getApiUrl('/api/admin/send-email-verification'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        const targetEmail = data.email || user?.email || MASTER_ADMIN_EMAIL;
        firestoreService.addAuditLog({
          action: 'send_verification_email',
          actionLabel: 'إرسال رسالة تحقق من البريد',
          details: `تم إرسال رابط تأكيد وتفعيل البريد الإلكتروني بنجاح إلى: ${targetEmail}`,
          adminEmail: targetEmail,
          adminName: 'مسؤول السجل المركزي'
        }).catch(() => {});

        return {
          success: true,
          message: data.message || `تم إرسال رسالة التحقق الرسمية بنجاح إلى البريد الإلكتروني (${targetEmail}).`
        };
      } else {
        // If server failed, try direct client-side sendEmailVerification as fallback
        if (user) {
          try {
            await firebaseSendEmailVerification(user);
            return {
              success: true,
              message: `تم إرسال رسالة التحقق الرسمية من Firebase بنجاح إلى بريدك (${user.email}). يرجى مراجعة صندوق الوارد والضغط على الرابط لتأكيد البريد.`
            };
          } catch (clientErr: any) {
            console.warn('Client-side sendEmailVerification notice:', clientErr);
          }
        }

        return {
          success: false,
          error: data.error || 'تعذر إرسال رسالة التحقق إلى البريد الإلكتروني. يرجى التأكد من اتصال الإنترنت وإعادة المحاولة.'
        };
      }
    } catch (err: any) {
      console.error('Error in sendEmailVerification:', err);
      if (auth.currentUser) {
        try {
          await firebaseSendEmailVerification(auth.currentUser);
          return {
            success: true,
            message: `تم إرسال رسالة التحقق الرسمية بنجاح إلى بريدك (${auth.currentUser.email}).`
          };
        } catch (cErr: any) {
          return {
            success: false,
            error: cErr?.message || err?.message || 'حدث خطأ أثناء محاولة إرسال رسالة التحقق.'
          };
        }
      }
      return {
        success: false,
        error: err?.message || 'حدث خطأ في الاتصال أثناء إرسال رسالة التحقق.'
      };
    }
  },

  // Check email verification status from Firebase Auth
  async checkEmailVerificationStatus(): Promise<{ success: boolean; emailVerified: boolean; email?: string; error?: string }> {
    try {
      let user = auth.currentUser;
      if (!user) {
        user = await waitForFirebaseAuth(3000);
      }

      if (user) {
        try {
          await user.reload();
        } catch (reloadErr) {
          console.warn('user.reload notice:', reloadErr);
        }
        const freshUser = auth.currentUser || user;
        return {
          success: true,
          emailVerified: Boolean(freshUser.emailVerified),
          email: freshUser.email || user.email || undefined
        };
      }

      const headers = await getAdminAuthHeaders();
      if (headers['Authorization']) {
        const res = await fetch(getApiUrl('/api/admin/verification-status'), {
          headers
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          return {
            success: true,
            emailVerified: Boolean(data.emailVerified),
            email: data.email
          };
        }
      }

      return {
        success: false,
        emailVerified: false,
        error: 'جلسة المستخدم غير متصلة'
      };
    } catch (err: any) {
      return {
        success: false,
        emailVerified: false,
        error: err?.message || 'تعذر التحقق من حالة البريد'
      };
    }
  },

  // Announcements Management
  async getAnnouncements(): Promise<Announcement[]> {
    return firestoreService.fetchAnnouncements();
  },

  async saveAnnouncement(ann: Announcement): Promise<void> {
    await firestoreService.saveAnnouncement(ann);
    const user = this.getCurrentUser();
    firestoreService.addAuditLog({
      action: 'create_announcement',
      actionLabel: 'نشر إعلان / تنبيه',
      details: `نشر إعلان بعنوان: "${ann.title}".`,
      targetId: ann.id,
      targetName: ann.title,
      adminEmail: user?.username || 'admin',
      adminName: user?.fullName || 'مسؤول السجل'
    }).catch(() => {});
  },

  async deleteAnnouncement(id: string, title?: string): Promise<void> {
    await firestoreService.deleteAnnouncement(id);
    const user = this.getCurrentUser();
    firestoreService.addAuditLog({
      action: 'delete_announcement',
      actionLabel: 'حذف إعلان',
      details: `حذف الإعلان: "${title || id}".`,
      targetId: id,
      targetName: title,
      adminEmail: user?.username || 'admin',
      adminName: user?.fullName || 'مسؤول السجل'
    }).catch(() => {});
  },

  // Hospital & Medical Center Ads Management
  getLocalHospitalAds(): HospitalAd[] {
    try {
      const data = localStorage.getItem(HOSPITAL_ADS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return sortHospitalAds(parsed);
        }
      }
      return [];
    } catch {
      return [];
    }
  },

  setLocalHospitalAds(ads: HospitalAd[]): void {
    try {
      localStorage.setItem(HOSPITAL_ADS_KEY, JSON.stringify(sortHospitalAds(ads)));
    } catch {}
  },

  async getHospitalAds(): Promise<HospitalAd[]> {
    const mergedMap = new Map<string, HospitalAd>();
    let firestoreOk = false;
    let serverOk = false;

    try {
      const remoteAds = await firestoreService.fetchHospitalAds();
      firestoreOk = true;
      for (const ad of remoteAds) {
        mergedMap.set(ad.id, ad);
      }
    } catch (err) {
      console.warn('getHospitalAds Firestore notice:', err);
    }

    try {
      const res = await fetch(getApiUrl('/api/hospital-ads'));
      if (res.ok) {
        const serverAds = await res.json();
        serverOk = true;
        if (Array.isArray(serverAds)) {
          for (const ad of serverAds) {
            if (!ad || !ad.id) continue;
            const existing = mergedMap.get(ad.id);
            if (!existing) {
              mergedMap.set(ad.id, ad);
            } else {
              const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
              const serverTime = new Date(ad.updatedAt || ad.createdAt || 0).getTime();
              if (serverTime > existingTime) {
                mergedMap.set(ad.id, ad);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('getHospitalAds server notice:', err);
    }

    if (firestoreOk || serverOk) {
      const sorted = sortHospitalAds(Array.from(mergedMap.values()));
      this.setLocalHospitalAds(sorted);
      return sorted;
    }

    return this.getLocalHospitalAds();
  },

  async saveHospitalAd(
    input: Omit<HospitalAd, 'id' | 'createdAt' | 'updatedAt'>,
    existingAd?: HospitalAd | null
  ): Promise<HospitalAd> {
    const user = this.getCurrentUser();
    if (this.getRole() !== 'admin' && user?.role !== 'admin') {
      throw new Error('عذراً، إدارة إعلانات المستشفيات متاحة حصرياً للمسؤول المعتمد.');
    }

    const hospitalName = sanitizeInput(input.hospitalName || '');
    const phone = sanitizeInput(input.phone || '');
    const address = sanitizeInput(input.address || '');
    const imageUrl = String(input.imageUrl || '').trim();
    const websiteUrl = input.websiteUrl ? sanitizeWebsiteUrl(input.websiteUrl) : '';
    const description = input.description ? sanitizeInput(input.description) : '';

    if (hospitalName.length < 2) {
      throw new Error('يرجى إدخال اسم المستشفى أو المركز الطبي بشكل صحيح.');
    }
    if (phone.length < 5) {
      throw new Error('يرجى إدخال رقم تواصل صحيح للمستشفى.');
    }
    if (address.length < 2) {
      throw new Error('يرجى إدخال عنوان المستشفى أو المركز الطبي.');
    }
    if (!isValidImageSource(imageUrl)) {
      throw new Error('يرجى اختيار صورة إعلان صالحة أو رابط صورة صحيح.');
    }
    if (input.websiteUrl && input.websiteUrl.trim() && !websiteUrl) {
      throw new Error('رابط الموقع الإلكتروني غير صالح. يرجى إدخال رابط يبدأ بـ https:// أو http://');
    }
    if (input.startDate && input.endDate && input.endDate < input.startDate) {
      throw new Error('تاريخ نهاية الإعلان يجب أن يكون مساوياً أو لاحقاً لتاريخ البداية.');
    }

    const nowIso = new Date().toISOString();
    const ad: HospitalAd = {
      id: existingAd?.id || `had-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      hospitalName,
      imageUrl,
      phone,
      address,
      ...(websiteUrl ? { websiteUrl } : {}),
      ...(description ? { description } : {}),
      startDate: input.startDate || nowIso.split('T')[0],
      endDate: input.endDate || nowIso.split('T')[0],
      isActive: input.isActive !== false,
      displayOrder: Math.max(0, Number.isFinite(Number(input.displayOrder)) ? Number(input.displayOrder) : 1),
      createdAt: existingAd?.createdAt || nowIso,
      updatedAt: nowIso
    };

    let savedInFirestore = false;
    try {
      await firestoreService.saveHospitalAd(ad);
      savedInFirestore = true;
    } catch (fsErr: any) {
      if (auth.currentUser) {
        throw new Error('تعذر حفظ إعلان المستشفى في قاعدة البيانات السحابية. يرجى التحقق من الصلاحيات والاتصال.');
      }
      console.warn('Firestore saveHospitalAd fallback to server (master-code session):', fsErr?.message || fsErr);
    }

    let savedOnServer = false;
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(getApiUrl('/api/hospital-ads'), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(ad)
      });
      savedOnServer = res.ok;
    } catch (srvErr) {
      console.warn('Server saveHospitalAd notice:', srvErr);
    }

    if (!savedInFirestore && !savedOnServer) {
      throw new Error('تعذر حفظ إعلان المستشفى في قاعدة البيانات. يرجى التحقق من الاتصال والمحاولة مجدداً.');
    }

    const current = this.getLocalHospitalAds();
    const updated = sortHospitalAds([ad, ...current.filter((item) => item.id !== ad.id)]);
    this.setLocalHospitalAds(updated);

    firestoreService.addAuditLog({
      action: existingAd ? 'update_hospital_ad' : 'create_hospital_ad',
      actionLabel: existingAd ? 'تعديل إعلان مستشفى' : 'إضافة إعلان مستشفى',
      details: `${existingAd ? 'تعديل' : 'إضافة'} إعلان: "${ad.hospitalName}" (${ad.startDate} إلى ${ad.endDate}).`,
      targetId: ad.id,
      targetName: ad.hospitalName,
      adminEmail: user?.username || 'admin',
      adminName: user?.fullName || 'مسؤول السجل'
    }).catch(() => {});

    return ad;
  },

  async deleteHospitalAd(id: string, hospitalName?: string): Promise<void> {
    const user = this.getCurrentUser();
    if (this.getRole() !== 'admin' && user?.role !== 'admin') {
      throw new Error('عذراً، حذف إعلانات المستشفيات متاح حصرياً للمسؤول المعتمد.');
    }

    let deletedInFirestore = false;
    try {
      await firestoreService.deleteHospitalAd(id);
      deletedInFirestore = true;
    } catch (fsErr: any) {
      if (auth.currentUser) {
        throw new Error('تعذر حذف إعلان المستشفى من قاعدة البيانات السحابية.');
      }
      console.warn('Firestore deleteHospitalAd fallback to server:', fsErr?.message || fsErr);
    }

    let deletedOnServer = false;
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(getApiUrl(`/api/hospital-ads/${id}`), {
        method: 'DELETE',
        headers
      });
      deletedOnServer = res.ok;
    } catch (srvErr) {
      console.warn('Server deleteHospitalAd notice:', srvErr);
    }

    if (!deletedInFirestore && !deletedOnServer) {
      throw new Error('تعذر حذف إعلان المستشفى من قاعدة البيانات.');
    }

    const remaining = this.getLocalHospitalAds().filter((item) => item.id !== id);
    this.setLocalHospitalAds(remaining);

    firestoreService.addAuditLog({
      action: 'delete_hospital_ad',
      actionLabel: 'حذف إعلان مستشفى',
      details: `حذف إعلان المستشفى: "${hospitalName || id}".`,
      targetId: id,
      targetName: hospitalName,
      adminEmail: user?.username || 'admin',
      adminName: user?.fullName || 'مسؤول السجل'
    }).catch(() => {});
  },

  async reorderHospitalAds(orderedAds: HospitalAd[]): Promise<HospitalAd[]> {
    const user = this.getCurrentUser();
    if (this.getRole() !== 'admin' && user?.role !== 'admin') {
      throw new Error('عذراً، ترتيب إعلانات المستشفيات متاح حصرياً للمسؤول المعتمد.');
    }

    const nowIso = new Date().toISOString();
    const reindexed = orderedAds.map((ad, index) => ({
      ...ad,
      displayOrder: index + 1,
      updatedAt: nowIso
    }));

    let updatedFirestore = false;
    try {
      await firestoreService.reorderHospitalAds(reindexed);
      updatedFirestore = true;
    } catch (fsErr: any) {
      if (auth.currentUser) {
        throw new Error('تعذر حفظ ترتيب الإعلانات في قاعدة البيانات السحابية.');
      }
      console.warn('Firestore reorderHospitalAds fallback to server:', fsErr?.message || fsErr);
    }

    let updatedServer = false;
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(getApiUrl('/api/hospital-ads/reorder'), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ads: reindexed })
      });
      updatedServer = res.ok;
    } catch {}

    if (!updatedFirestore && !updatedServer) {
      throw new Error('تعذر تحديث ترتيب إعلانات المستشفيات.');
    }

    this.setLocalHospitalAds(reindexed);
    return reindexed;
  },

  // Hospitals & Doctors Directory Management (المستشفيات والأطباء)
  getLocalHospitals(): Hospital[] {
    try {
      const data = localStorage.getItem(HOSPITALS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return sortHospitals(parsed);
        }
      }
      return [];
    } catch {
      return [];
    }
  },

  setLocalHospitals(hospitals: Hospital[]): void {
    try {
      localStorage.setItem(HOSPITALS_KEY, JSON.stringify(sortHospitals(hospitals)));
    } catch {}
  },

  async getHospitals(): Promise<Hospital[]> {
    const mergedMap = new Map<string, Hospital>();
    let firestoreOk = false;
    let serverOk = false;

    try {
      const remoteHospitals = await firestoreService.fetchHospitals();
      firestoreOk = true;
      for (const hosp of remoteHospitals) {
        mergedMap.set(hosp.id, hosp);
      }
    } catch (err) {
      console.warn('getHospitals Firestore notice:', err);
    }

    try {
      const res = await fetch(getApiUrl('/api/hospitals'));
      if (res.ok) {
        const serverHospitals = await res.json();
        serverOk = true;
        if (Array.isArray(serverHospitals)) {
          for (const hosp of serverHospitals) {
            if (!hosp || !hosp.id) continue;
            const existing = mergedMap.get(hosp.id);
            if (!existing) {
              mergedMap.set(hosp.id, hosp);
            } else {
              const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
              const serverTime = new Date(hosp.updatedAt || hosp.createdAt || 0).getTime();
              if (serverTime > existingTime) {
                mergedMap.set(hosp.id, hosp);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('getHospitals server notice:', err);
    }

    if (firestoreOk || serverOk) {
      const sorted = sortHospitals(Array.from(mergedMap.values()));
      this.setLocalHospitals(sorted);
      return sorted;
    }

    return this.getLocalHospitals();
  },

  async saveHospital(
    input: Omit<Hospital, 'id' | 'createdAt' | 'updatedAt'>,
    existingHospital?: Hospital | null
  ): Promise<Hospital> {
    const user = this.getCurrentUser();
    if (this.getRole() !== 'admin' && user?.role !== 'admin') {
      throw new Error('عذراً، إدارة المستشفيات متاحة حصرياً للمسؤول المعتمد.');
    }

    const name = sanitizeInput(input.name || '');
    const imageUrl = String(input.imageUrl || '').trim();
    const description = input.description ? sanitizeInput(input.description) : '';
    const address = input.address ? sanitizeInput(input.address) : '';
    const phone = input.phone ? sanitizeInput(input.phone) : '';

    if (name.length < 2) {
      throw new Error('يرجى إدخال اسم المستشفى بشكل صحيح.');
    }
    if (!isValidDirectoryImageSource(imageUrl, false)) {
      throw new Error('يرجى رفع صورة المستشفى أو إدخال رابط صورة صحيح.');
    }

    const nowIso = new Date().toISOString();
    const hospital: Hospital = {
      id: existingHospital?.id || `hosp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name,
      imageUrl,
      ...(description ? { description } : {}),
      ...(address ? { address } : {}),
      ...(phone ? { phone } : {}),
      displayOrder: Math.max(
        1,
        Number.isFinite(Number(input.displayOrder))
          ? Number(input.displayOrder)
          : this.getLocalHospitals().length + 1
      ),
      createdAt: existingHospital?.createdAt || nowIso,
      updatedAt: nowIso
    };

    let savedInFirestore = false;
    try {
      await firestoreService.saveHospital(hospital);
      savedInFirestore = true;
    } catch (fsErr: any) {
      console.warn('Firestore saveHospital fallback to server:', fsErr?.message || fsErr);
    }

    let savedOnServer = false;
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(getApiUrl('/api/hospitals'), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(hospital)
      });
      savedOnServer = res.ok;
    } catch (srvErr) {
      console.warn('Server saveHospital notice:', srvErr);
    }

    if (!savedInFirestore && !savedOnServer) {
      throw new Error('تعذر حفظ بيانات المستشفى في قاعدة البيانات. يرجى التحقق من الاتصال والمحاولة مجدداً.');
    }

    const current = this.getLocalHospitals();
    const updated = sortHospitals([hospital, ...current.filter((item) => item.id !== hospital.id)]);
    this.setLocalHospitals(updated);

    firestoreService.addAuditLog({
      action: existingHospital ? 'update_hospital' : 'create_hospital',
      actionLabel: existingHospital ? 'تعديل مستشفى' : 'إضافة مستشفى جديد',
      details: `${existingHospital ? 'تعديل' : 'إضافة'} المستشفى: "${hospital.name}".`,
      targetId: hospital.id,
      targetName: hospital.name,
      adminEmail: user?.username || 'admin',
      adminName: user?.fullName || 'مسؤول السجل'
    }).catch(() => {});

    return hospital;
  },

  async deleteHospital(id: string, hospitalName?: string): Promise<void> {
    const user = this.getCurrentUser();
    if (this.getRole() !== 'admin' && user?.role !== 'admin') {
      throw new Error('عذراً، حذف المستشفيات متاح حصرياً للمسؤول المعتمد.');
    }

    let deletedInFirestore = false;
    try {
      await firestoreService.deleteDoctorsByHospital(id);
      await firestoreService.deleteHospital(id);
      deletedInFirestore = true;
    } catch (fsErr: any) {
      console.warn('Firestore deleteHospital fallback to server:', fsErr?.message || fsErr);
    }

    let deletedOnServer = false;
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(getApiUrl(`/api/hospitals/${id}`), {
        method: 'DELETE',
        headers
      });
      deletedOnServer = res.ok;
    } catch (srvErr) {
      console.warn('Server deleteHospital notice:', srvErr);
    }

    if (!deletedInFirestore && !deletedOnServer) {
      throw new Error('تعذر حذف المستشفى من قاعدة البيانات.');
    }

    this.setLocalHospitals(this.getLocalHospitals().filter((item) => item.id !== id));
    this.setLocalDoctors(this.getLocalDoctors().filter((docItem) => docItem.hospitalId !== id));

    firestoreService.addAuditLog({
      action: 'delete_hospital',
      actionLabel: 'حذف مستشفى',
      details: `حذف المستشفى: "${hospitalName || id}" وجميع الأطباء المرتبطين به.`,
      targetId: id,
      targetName: hospitalName,
      adminEmail: user?.username || 'admin',
      adminName: user?.fullName || 'مسؤول السجل'
    }).catch(() => {});
  },

  async reorderHospitals(orderedHospitals: Hospital[]): Promise<Hospital[]> {
    const user = this.getCurrentUser();
    if (this.getRole() !== 'admin' && user?.role !== 'admin') {
      throw new Error('عذراً، ترتيب المستشفيات متاح حصرياً للمسؤول المعتمد.');
    }

    const nowIso = new Date().toISOString();
    const reindexed = orderedHospitals.map((h, index) => ({
      ...h,
      displayOrder: index + 1,
      updatedAt: nowIso
    }));

    let updatedFirestore = false;
    try {
      await firestoreService.reorderHospitals(reindexed);
      updatedFirestore = true;
    } catch (fsErr: any) {
      console.warn('Firestore reorderHospitals fallback to server:', fsErr?.message || fsErr);
    }

    let updatedServer = false;
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(getApiUrl('/api/hospitals/reorder'), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitals: reindexed })
      });
      updatedServer = res.ok;
    } catch {}

    if (!updatedFirestore && !updatedServer) {
      throw new Error('تعذر تحديث ترتيب المستشفيات.');
    }

    this.setLocalHospitals(reindexed);
    return reindexed;
  },

  getLocalDoctors(): Doctor[] {
    try {
      const data = localStorage.getItem(DOCTORS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return sortDoctors(parsed);
        }
      }
      return [];
    } catch {
      return [];
    }
  },

  setLocalDoctors(doctors: Doctor[]): void {
    try {
      localStorage.setItem(DOCTORS_KEY, JSON.stringify(sortDoctors(doctors)));
    } catch {}
  },

  async getDoctors(): Promise<Doctor[]> {
    const mergedMap = new Map<string, Doctor>();
    let firestoreOk = false;
    let serverOk = false;

    try {
      const remoteDoctors = await firestoreService.fetchDoctors();
      firestoreOk = true;
      for (const docItem of remoteDoctors) {
        mergedMap.set(docItem.id, docItem);
      }
    } catch (err) {
      console.warn('getDoctors Firestore notice:', err);
    }

    try {
      const res = await fetch(getApiUrl('/api/doctors'));
      if (res.ok) {
        const serverDoctors = await res.json();
        serverOk = true;
        if (Array.isArray(serverDoctors)) {
          for (const docItem of serverDoctors) {
            if (!docItem || !docItem.id) continue;
            const existing = mergedMap.get(docItem.id);
            if (!existing) {
              mergedMap.set(docItem.id, docItem);
            } else {
              const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
              const serverTime = new Date(docItem.updatedAt || docItem.createdAt || 0).getTime();
              if (serverTime > existingTime) {
                mergedMap.set(docItem.id, docItem);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('getDoctors server notice:', err);
    }

    if (firestoreOk || serverOk) {
      const sorted = sortDoctors(Array.from(mergedMap.values()));
      this.setLocalDoctors(sorted);
      return sorted;
    }

    return this.getLocalDoctors();
  },

  async saveDoctor(
    input: Omit<Doctor, 'id' | 'createdAt' | 'updatedAt'>,
    existingDoctor?: Doctor | null
  ): Promise<Doctor> {
    const user = this.getCurrentUser();
    if (this.getRole() !== 'admin' && user?.role !== 'admin') {
      throw new Error('عذراً، إدارة الأطباء متاحة حصرياً للمسؤول المعتمد.');
    }

    const hospitalId = String(input.hospitalId || '').trim();
    const fullName = sanitizeInput(input.fullName || '');
    const specialty = sanitizeInput(input.specialty || '');
    const imageUrl = String(input.imageUrl || '').trim();
    const bio = input.bio ? sanitizeInput(input.bio) : '';
    const phone = input.phone ? sanitizeInput(input.phone) : '';

    if (!hospitalId) {
      throw new Error('يرجى تحديد المستشفى التابع له الطبيب.');
    }
    if (fullName.length < 2) {
      throw new Error('يرجى إدخال اسم الطبيب بشكل صحيح.');
    }
    if (specialty.length < 2) {
      throw new Error('يرجى إدخال التخصص الطبي للطبيب.');
    }
    if (!isValidDirectoryImageSource(imageUrl, true)) {
      throw new Error('يرجى اختيار صورة طبيب صالحة أو رابط صورة صحيح.');
    }

    const nowIso = new Date().toISOString();
    const doctor: Doctor = {
      id: existingDoctor?.id || `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      hospitalId,
      fullName,
      specialty,
      imageUrl,
      ...(bio ? { bio } : {}),
      ...(phone ? { phone } : {}),
      displayOrder: Math.max(
        1,
        Number.isFinite(Number(input.displayOrder))
          ? Number(input.displayOrder)
          : this.getLocalDoctors().filter((d) => d.hospitalId === hospitalId).length + 1
      ),
      createdAt: existingDoctor?.createdAt || nowIso,
      updatedAt: nowIso
    };

    let savedInFirestore = false;
    try {
      await firestoreService.saveDoctor(doctor);
      savedInFirestore = true;
    } catch (fsErr: any) {
      console.warn('Firestore saveDoctor fallback to server:', fsErr?.message || fsErr);
    }

    let savedOnServer = false;
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(getApiUrl('/api/doctors'), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(doctor)
      });
      savedOnServer = res.ok;
    } catch (srvErr) {
      console.warn('Server saveDoctor notice:', srvErr);
    }

    if (!savedInFirestore && !savedOnServer) {
      throw new Error('تعذر حفظ بيانات الطبيب في قاعدة البيانات. يرجى التحقق من الاتصال والمحاولة مجدداً.');
    }

    const current = this.getLocalDoctors();
    const updated = sortDoctors([doctor, ...current.filter((item) => item.id !== doctor.id)]);
    this.setLocalDoctors(updated);

    firestoreService.addAuditLog({
      action: existingDoctor ? 'update_doctor' : 'create_doctor',
      actionLabel: existingDoctor ? 'تعديل بيانات طبيب' : 'إضافة طبيب جديد',
      details: `${existingDoctor ? 'تعديل' : 'إضافة'} الطبيب: "${doctor.fullName}" (${doctor.specialty}).`,
      targetId: doctor.id,
      targetName: doctor.fullName,
      adminEmail: user?.username || 'admin',
      adminName: user?.fullName || 'مسؤول السجل'
    }).catch(() => {});

    return doctor;
  },

  async deleteDoctor(id: string, fullName?: string): Promise<void> {
    const user = this.getCurrentUser();
    if (this.getRole() !== 'admin' && user?.role !== 'admin') {
      throw new Error('عذراً، حذف الأطباء متاح حصرياً للمسؤول المعتمد.');
    }

    let deletedInFirestore = false;
    try {
      await firestoreService.deleteDoctor(id);
      deletedInFirestore = true;
    } catch (fsErr: any) {
      console.warn('Firestore deleteDoctor fallback to server:', fsErr?.message || fsErr);
    }

    let deletedOnServer = false;
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(getApiUrl(`/api/doctors/${id}`), {
        method: 'DELETE',
        headers
      });
      deletedOnServer = res.ok;
    } catch (srvErr) {
      console.warn('Server deleteDoctor notice:', srvErr);
    }

    if (!deletedInFirestore && !deletedOnServer) {
      throw new Error('تعذر حذف الطبيب من قاعدة البيانات.');
    }

    this.setLocalDoctors(this.getLocalDoctors().filter((item) => item.id !== id));

    firestoreService.addAuditLog({
      action: 'delete_doctor',
      actionLabel: 'حذف طبيب',
      details: `حذف الطبيب: "${fullName || id}".`,
      targetId: id,
      targetName: fullName,
      adminEmail: user?.username || 'admin',
      adminName: user?.fullName || 'مسؤول السجل'
    }).catch(() => {});
  },

  // Audit Logs
  clearAuditLogLocalCaches(): void {
    const storages: Array<Storage | undefined> = [
      typeof localStorage !== 'undefined' ? localStorage : undefined,
      typeof sessionStorage !== 'undefined' ? sessionStorage : undefined
    ];
    for (const store of storages) {
      if (!store) continue;
      try {
        for (let i = store.length - 1; i >= 0; i--) {
          const key = store.key(i);
          if (!key) continue;
          const lower = key.toLowerCase();
          if (lower.includes('audit_log') || lower.includes('auditlog')) {
            store.removeItem(key);
          }
        }
      } catch {}
    }
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    this.clearAuditLogLocalCaches();
    return firestoreService.fetchAuditLogs();
  },

  async assertCentralAdminForAuditDelete(): Promise<void> {
    const user = this.getCurrentUser();
    if (this.getRole() !== 'admin' || user?.role !== 'admin') {
      throw new Error('عذراً، حذف سجل العمليات متاح حصرياً للمسؤول المركزي صاحب الصلاحية.');
    }

    const activeAuthUser = auth.currentUser || (await waitForFirebaseAuth(1500));
    if (!activeAuthUser) {
      throw new Error(
        'للحذف الفعلي من قاعدة بيانات Firebase، يجب توثيق جلسة المسؤول عبر Firebase Auth (تسجيل الدخول بحساب Google المعتمد أو بالبريد وكلمة المرور الموثقة) لأن رمز الدخول السريع وحده لا يمنح صلاحية الحذف في Firestore.'
      );
    }

    await activeAuthUser.reload().catch(() => {});
    const refreshedUser = auth.currentUser || activeAuthUser;
    const emailLower = String(refreshedUser.email || '').trim().toLowerCase();
    const isMasterEmail = MASTER_ADMIN_EMAILS.some((em) => em.toLowerCase() === emailLower);

    if (isMasterEmail && refreshedUser.emailVerified) {
      return;
    }

    const adminSnap = await getDocFromServer(doc(db, 'admins', refreshedUser.uid)).catch(() =>
      getDoc(doc(db, 'admins', refreshedUser.uid)).catch(() => null)
    );
    if (adminSnap && adminSnap.exists()) {
      return;
    }

    if (isMasterEmail && !refreshedUser.emailVerified) {
      throw new Error(
        'البريد الإلكتروني للمسؤول لم يتم تأكيده بعد في Firebase Auth (emailVerified = false). يرجى تأكيد البريد من تبويب الأمان أو توثيق الدخول بحساب Google للمسؤول.'
      );
    }

    throw new Error('عذراً، هذا الحساب لا يملك صلاحية المسؤول المركزي لحذف سجل العمليات.');
  },

  async deleteAuditLog(id: string): Promise<void> {
    await this.assertCentralAdminForAuditDelete();
    this.clearAuditLogLocalCaches();
    try {
      await firestoreService.deleteAuditLog(id);
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('permission') || msg.includes('insufficient')) {
        throw new Error(
          'رفضت قاعدة بيانات Firebase حذف السجل من مجموعة audit_logs (Permission Denied). يرجى نشر ملف firestore.rules المحدّث في Firebase Console للمشروع ثم إعادة المحاولة.'
        );
      }
      throw new Error('تعذر حذف السجل من قاعدة بيانات Firebase. يرجى المحاولة مجدداً.');
    }
  },

  async deleteAuditLogs(ids: string[]): Promise<void> {
    await this.assertCentralAdminForAuditDelete();
    this.clearAuditLogLocalCaches();
    try {
      await firestoreService.deleteAuditLogs(ids);
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('permission') || msg.includes('insufficient')) {
        throw new Error(
          'رفضت قاعدة بيانات Firebase الحذف الجماعي من مجموعة audit_logs (Permission Denied). يرجى نشر ملف firestore.rules المحدّث في Firebase Console للمشروع ثم إعادة المحاولة.'
        );
      }
      throw new Error('تعذر حذف السجلات المحددة من قاعدة بيانات Firebase. يرجى المحاولة مجدداً.');
    }
  },

  async deleteAllAuditLogs(): Promise<void> {
    await this.assertCentralAdminForAuditDelete();
    this.clearAuditLogLocalCaches();
    try {
      await firestoreService.deleteAllAuditLogs();
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('permission') || msg.includes('insufficient')) {
        throw new Error(
          'رفضت قاعدة بيانات Firebase حذف سجلات audit_logs (Permission Denied). يرجى نشر ملف firestore.rules المحدّث في Firebase Console للمشروع ثم إعادة المحاولة.'
        );
      }
      throw new Error('تعذر حذف جميع سجلات العمليات من قاعدة بيانات Firebase. يرجى المحاولة مجدداً.');
    }
  },

  // Update User Role
  async updateUserRole(userId: string, role: 'admin' | 'user'): Promise<void> {
    await firestoreService.updateUserRole(userId, role);
    try {
      const adminHeaders = await getAdminAuthHeaders();
      await fetch(getApiUrl(`/api/admin/users/${userId}/role`), {
        method: 'PUT',
        headers: { ...adminHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
    } catch {}

    const localUsers = this.getLocalUsers();
    const updated = localUsers.map((u) => (u.id === userId ? { ...u, role } : u));
    this.saveLocalUsers(updated);

    const user = this.getCurrentUser();
    firestoreService.addAuditLog({
      action: 'change_user_role',
      actionLabel: 'تعديل صلاحية مستخدم',
      details: `تم تغيير دور الحساب (${userId}) إلى: ${role === 'admin' ? 'مسؤول' : 'مستخدم عادي'}.`,
      targetId: userId,
      adminEmail: user?.username || 'admin',
      adminName: user?.fullName || 'مسؤول السجل'
    }).catch(() => {});
  },

  // Batch import donors from Excel / CSV with strict Firestore deduplication
  async importDonors(importedDonors: Omit<Donor, 'id' | 'createdAt'>[]): Promise<{
    success: boolean;
    addedCount: number;
    skippedDuplicatesCount: number;
    totalDonors: number;
    message?: string;
  }> {
    // 1. Fetch fresh Firestore donors to ensure strict centralized deduplication
    const remoteDonors = await firestoreService.fetchDonors().catch(() => []);
    const existingPhoneSet = new Set(remoteDonors.map((d) => normalizePhoneNumber(d.phone)));
    const existingNameSet = new Set(remoteDonors.map((d) => normalizeArabicText(d.fullName)));

    const batchPhones = new Set<string>();
    const batchNames = new Set<string>();

    let addedCount = 0;
    let skippedDuplicatesCount = 0;
    const addedDonors: Donor[] = [];

    for (const item of importedDonors) {
      if (!item || !item.fullName || !item.phone) continue;
      const cleanPhone = normalizePhoneNumber(item.phone);
      const cleanName = item.fullName.trim();
      const normName = normalizeArabicText(cleanName);

      if (
        existingPhoneSet.has(cleanPhone) ||
        existingNameSet.has(normName) ||
        batchPhones.has(cleanPhone) ||
        batchNames.has(normName)
      ) {
        skippedDuplicatesCount++;
        continue;
      }

      batchPhones.add(cleanPhone);
      batchNames.add(normName);
      existingPhoneSet.add(cleanPhone);
      existingNameSet.add(normName);

      const newD: Donor = {
        ...item,
        id: `donor-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        fullName: cleanName,
        phone: cleanPhone,
        isAvailable: item.isAvailable !== false,
        createdAt: new Date().toISOString()
      };

      // Save directly to Firestore centralized database
      await firestoreService.setDonor(newD).catch((e) =>
        console.warn('Import Firestore write notice:', e)
      );
      addedDonors.push(newD);
      addedCount++;
    }

    if (addedCount > 0) {
      const currentLocal = this.getDonors();
      const updated = [...addedDonors, ...currentLocal.filter((c) => !addedDonors.some((a) => a.id === c.id))];
      this.setLocalDonors(updated);
    }

    // Mirror to server in background for Excel backups if available
    try {
      fetch(getApiUrl('/api/donors/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donors: addedDonors })
      }).catch(() => {});
    } catch {}

    const totalDonors = (await firestoreService.fetchDonors().catch(() => this.getDonors())).length;

    return {
      success: true,
      addedCount,
      skippedDuplicatesCount,
      totalDonors,
      message: `تم استيراد ${addedCount} متبرع جديد بنجاح وتخطي ${skippedDuplicatesCount} مكرر.`
    };
  },

  // Requests CRUD: Directly write to Firestore central shared database and mirror
  async saveRequest(req: Omit<BloodRequest, 'id' | 'createdAt'>): Promise<BloodRequest> {
    const cleanPatient = (req.patientName || '').trim();
    const cleanHospital = (req.hospital || '').trim();
    const cleanPhone = (req.contactPhone || '').trim();

    if (!cleanPatient || !req.bloodType || !cleanHospital || !cleanPhone) {
      throw new Error('يرجى إكمال جميع الحقول الإلزامية لطلب الدم');
    }

    const newReq: BloodRequest = {
      ...req,
      id: `req-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      patientName: cleanPatient,
      bloodType: req.bloodType,
      unitsNeeded: Math.max(1, Number(req.unitsNeeded) || 1),
      hospital: cleanHospital,
      district: (req.district || 'مديرية قعطبة - المركز').trim(),
      area: (req.area || 'قعطبة').trim(),
      urgency: req.urgency || 'urgent',
      status: 'open',
      contactName: (req.contactName || '').trim(),
      contactPhone: cleanPhone,
      caseDetails: (req.caseDetails || 'حالة طبية تستدعي التبرع بالدم').trim(),
      requestDate: req.requestDate || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };

    // 1. Direct and awaited save to Firebase Firestore central shared database
    try {
      await firestoreService.setRequest(newReq);
    } catch (fsErr: any) {
      console.error('Firestore saveRequest error:', fsErr);
      throw new Error(`تعذر حفظ طلب الدم في قاعدة البيانات المركزية: ${fsErr?.message || 'خطأ في الاتصال'}`);
    }

    // 2. Persist locally to ensure instant rendering across refreshes
    const currentRequests = this.getRequests();
    const updated = [newReq, ...currentRequests.filter((r) => r.id !== newReq.id)];
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(updated));

    // 3. Immediately broadcast notification to all devices via Firestore notifications collection
    try {
      const notif: AppNotification = {
        id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: newReq.urgency === 'critical' ? '🚨 طلب دم عاجل جداً في قعطبة!' : 'طلب دم جديد 🩸',
        message: `نداء إنساني: حاجة لـ (${newReq.unitsNeeded}) كيس دم فصيلة (${newReq.bloodType}) بمستشفى ${newReq.hospital} (${newReq.district}).`,
        time: 'الآن',
        type: newReq.urgency === 'critical' ? 'urgent' : 'donor',
        read: false,
        linkPage: 'requests',
        itemId: newReq.id
      };
      await firestoreService.setNotification(notif).catch(() => {});
      const currentNotifs = this.getNotifications();
      const updatedNotifs = [notif, ...currentNotifs.filter((n) => n.id !== notif.id)];
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updatedNotifs));
    } catch (notifErr) {
      console.warn('Notification broadcast notice:', notifErr);
    }

    // 4. Mirror to backend server API in background
    try {
      fetch(getApiUrl('/api/requests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReq)
      }).catch(() => {});
    } catch {}

    return newReq;
  },

  async updateRequest(req: BloodRequest): Promise<void> {
    const requests = this.getRequests();
    const index = requests.findIndex((r) => r.id === req.id);
    if (index !== -1) {
      requests[index] = req;
      localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
    }

    firestoreService.updateRequest(req).catch((err) => console.warn('Firestore update request error:', err));

    try {
      await fetch(getApiUrl(`/api/requests/${req.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });
    } catch (e) {
      console.warn('Server update request failed, preserved locally:', e);
    }
  },

  async deleteRequest(id: string): Promise<void> {
    const requests = this.getRequests().filter((r) => r.id !== id);
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
    this.addDeletedRequestId(id);

    firestoreService.deleteRequest(id).catch((err) => console.warn('Firestore delete request error:', err));

    try {
      const headers = await getAdminAuthHeaders();
      await fetch(getApiUrl(`/api/requests/${id}`), { method: 'DELETE', headers });
    } catch (e) {
      console.warn('Server delete request failed, queued locally:', e);
    }
  },

  // Districts CRUD
  async saveDistrict(name: string, areas: string[]): Promise<District> {
    const tempDist: District = {
      id: `dist-${Date.now()}`,
      name,
      areas
    };
    const districts = this.getDistricts();
    const updated = [...districts, tempDist];
    localStorage.setItem(DISTRICTS_KEY, JSON.stringify(updated));
    firestoreService.setDistrict(tempDist).catch(() => {});

    try {
      const adminHeaders = await getAdminAuthHeaders();
      const res = await fetch(getApiUrl('/api/districts'), {
        method: 'POST',
        headers: { ...adminHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, areas })
      });
      if (res.ok) {
        const serverDist = await res.json();
        const replaced = updated.map((d) => (d.id === tempDist.id ? serverDist : d));
        localStorage.setItem(DISTRICTS_KEY, JSON.stringify(replaced));
        firestoreService.setDistrict(serverDist).catch(() => {});
        return serverDist;
      }
    } catch (e) {
      console.warn('Server save district failed:', e);
    }

    return tempDist;
  },

  async updateDistrict(district: District): Promise<void> {
    const districts = this.getDistricts();
    const index = districts.findIndex((d) => d.id === district.id);
    if (index !== -1) {
      districts[index] = district;
      localStorage.setItem(DISTRICTS_KEY, JSON.stringify(districts));
    }

    firestoreService.setDistrict(district).catch(() => {});

    try {
      const adminHeaders = await getAdminAuthHeaders();
      await fetch(getApiUrl(`/api/districts/${district.id}`), {
        method: 'PUT',
        headers: { ...adminHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(district)
      });
    } catch (e) {
      console.warn('Server update district failed:', e);
    }
  },

  async deleteDistrict(id: string): Promise<void> {
    const districts = this.getDistricts().filter((d) => d.id !== id);
    localStorage.setItem(DISTRICTS_KEY, JSON.stringify(districts));
    firestoreService.deleteDistrict(id).catch(() => {});

    try {
      const headers = await getAdminAuthHeaders();
      await fetch(getApiUrl(`/api/districts/${id}`), { method: 'DELETE', headers });
    } catch (e) {
      console.warn('Server delete district failed:', e);
    }
  },

  // Notifications
  async markAsRead(id: string): Promise<void> {
    const notifs = this.getNotifications();
    const updated = notifs.map((n) => (n.id === id ? { ...n, read: true } : n));
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));

    try {
      await fetch(getApiUrl(`/api/notifications/read/${id}`), { method: 'POST' });
    } catch {
      // ignore
    }
  },

  async markAllAsRead(): Promise<void> {
    const notifs = this.getNotifications();
    const updated = notifs.map((n) => ({ ...n, read: true }));
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));

    try {
      await fetch(getApiUrl('/api/notifications/read-all'), { method: 'POST' });
    } catch {
      // ignore
    }
  },

  async clearNotifications(): Promise<void> {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([]));
    try {
      await fetch(getApiUrl('/api/notifications/clear'), { method: 'DELETE' });
    } catch {
      // ignore
    }
  },

  // Admin Settings & Management

  // Admin Settings & Export Logs
  async getAdminSettings(): Promise<AdminSettings | null> {
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(getApiUrl('/api/admin/settings'), { headers });
      if (res.ok) return await res.json();
    } catch {
      // ignore
    }
    return {
      recipientEmail: 'abdulrahmanalshaiby2028@gmail.com',
      dailyExportHour: 8,
      dailyExportMinute: 0,
      autoExportEnabled: true,
      recoveryCode: ''
    };
  },

  async saveAdminSettings(settings: Partial<AdminSettings>): Promise<boolean> {
    try {
      const adminHeaders = await getAdminAuthHeaders();
      const res = await fetch(getApiUrl('/api/admin/settings'), {
        method: 'POST',
        headers: { ...adminHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getExportLogs(): Promise<ExportLog[]> {
    try {
      const res = await fetch(getApiUrl('/api/admin/export-logs'));
      if (res.ok) return await res.json();
    } catch {
      // ignore
    }
    return [];
  },

  // WhatsApp Business Cloud API Integration
  async getWhatsAppLogs(): Promise<{ total: number; logs: any[] }> {
    try {
      const res = await fetch(getApiUrl('/api/whatsapp/logs'));
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('getWhatsAppLogs error:', e);
    }
    return { total: 0, logs: [] };
  },

  async dispatchWhatsAppForRequest(requestId: string, requestData?: any): Promise<any> {
    try {
      const adminHeaders = await getAdminAuthHeaders().catch(() => ({}));
      const res = await fetch(getApiUrl('/api/whatsapp/dispatch-request'), {
        method: 'POST',
        headers: { ...adminHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, requestData })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  async simulateWhatsAppMatch(params: any): Promise<any> {
    try {
      const res = await fetch(getApiUrl('/api/whatsapp/simulate-test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  async triggerExportEmail(): Promise<{
    success: boolean;
    status: 'success' | 'saved_locally' | 'failed';
    filename: string;
    message: string;
    details?: string;
  }> {
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(getApiUrl('/api/admin/trigger-export'), { method: 'POST', headers });
      return await res.json();
    } catch (e: any) {
      return {
        success: false,
        status: 'failed',
        filename: 'qaatabah_blood_donors.xlsx',
        message: 'فشل الاتصال بالخادم لإرسال التقرير',
        details: e.message
      };
    }
  },

  getDownloadExcelUrl(): string {
    return getApiUrl('/api/admin/download-excel');
  },

  async exportDonorsToExcel() {
    return exportDonorsToExcel();
  },

  async checkServerHealth(): Promise<ServerHealth | null> {
    try {
      const res = await fetch(getApiUrl('/api/health'));
      if (res.ok) return await res.json();
    } catch {
      // ignore
    }
    return null;
  },

  // Backup & Restore
  exportBackup(): string {
    const data = {
      donors: this.getDonors(),
      requests: this.getRequests(),
      districts: this.getDistricts(),
      hospitals: this.getLocalHospitals(),
      doctors: this.getLocalDoctors(),
      users: this.getLocalUsers().map(({ password: _, ...safe }) => safe),
      exportDate: new Date().toISOString(),
      appName: 'سجل المتبرعين بالدم – مديرية قعطبة'
    };
    return JSON.stringify(data, null, 2);
  },

  async importBackup(jsonString: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed.donors)) {
        localStorage.setItem(DONORS_KEY, JSON.stringify(parsed.donors));
      }
      if (Array.isArray(parsed.requests)) {
        localStorage.setItem(REQUESTS_KEY, JSON.stringify(parsed.requests));
      }
      if (Array.isArray(parsed.districts)) {
        localStorage.setItem(DISTRICTS_KEY, JSON.stringify(parsed.districts));
      }
      if (Array.isArray(parsed.hospitals)) {
        this.setLocalHospitals(parsed.hospitals);
      }
      if (Array.isArray(parsed.doctors)) {
        this.setLocalDoctors(parsed.doctors);
      }
      if (Array.isArray(parsed.users)) {
        this.saveLocalUsers(parsed.users);
      }

      // Sync restore to server
      try {
        const adminHeaders = await getAdminAuthHeaders();
        await fetch(getApiUrl('/api/admin/restore'), {
          method: 'POST',
          headers: { ...adminHeaders, 'Content-Type': 'application/json' },
          body: jsonString
        });
      } catch (err) {
        console.warn('Backup restore to server failed, restored locally:', err);
      }

      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  resetDefaults(): void {
    localStorage.setItem(DONORS_KEY, JSON.stringify(INITIAL_DONORS));
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(INITIAL_REQUESTS));
    localStorage.setItem(DISTRICTS_KEY, JSON.stringify(INITIAL_DISTRICTS));
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(INITIAL_NOTIFICATIONS));
  }
};

// Blood Compatibility Helpers
export const COMPATIBILITY_MAP: Record<BloodType, { canDonateTo: BloodType[]; canReceiveFrom: BloodType[] }> = {
  'O-': {
    canDonateTo: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    canReceiveFrom: ['O-']
  },
  'O+': {
    canDonateTo: ['O+', 'A+', 'B+', 'AB+'],
    canReceiveFrom: ['O+', 'O-']
  },
  'A-': {
    canDonateTo: ['A-', 'A+', 'AB-', 'AB+'],
    canReceiveFrom: ['A-', 'O-']
  },
  'A+': {
    canDonateTo: ['A+', 'AB+'],
    canReceiveFrom: ['A+', 'A-', 'O+', 'O-']
  },
  'B-': {
    canDonateTo: ['B-', 'B+', 'AB-', 'AB+'],
    canReceiveFrom: ['B-', 'O-']
  },
  'B+': {
    canDonateTo: ['B+', 'AB+'],
    canReceiveFrom: ['B+', 'B-', 'O+', 'O-']
  },
  'AB-': {
    canDonateTo: ['AB-', 'AB+'],
    canReceiveFrom: ['AB-', 'A-', 'B-', 'O-']
  },
  'AB+': {
    canDonateTo: ['AB+'],
    canReceiveFrom: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
  }
};

export function canDonorDonateToRequest(donorType: BloodType, requestType: BloodType): boolean {
  return COMPATIBILITY_MAP[donorType].canDonateTo.includes(requestType);
}

// Calculate days since last donation
export function getDonationEligibility(lastDonationDateStr?: string): {
  isEligible: boolean;
  daysPassed: number | null;
  daysRemaining: number | null;
  message: string;
} {
  if (!lastDonationDateStr) {
    return {
      isEligible: true,
      daysPassed: null,
      daysRemaining: 0,
      message: 'مؤهل للتبرع فوراً (لم يُسجل تبرع سابق حديث)'
    };
  }

  const last = new Date(lastDonationDateStr).getTime();
  const now = new Date().getTime();
  const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));

  const minDaysRequired = 60; // 2 months
  if (diffDays >= minDaysRequired) {
    return {
      isEligible: true,
      daysPassed: diffDays,
      daysRemaining: 0,
      message: `مؤهل للتبرع (مضى ${diffDays} يوماً على آخر تبرع)`
    };
  } else {
    const remaining = minDaysRequired - diffDays;
    return {
      isEligible: false,
      daysPassed: diffDays,
      daysRemaining: remaining,
      message: `غير مؤهل حالياً (مضى ${diffDays} يوماً، يتبقى ${remaining} يوماً لاكتمال شهرين)`
    };
  }
}
