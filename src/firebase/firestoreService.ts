import {
  collection,
  doc,
  getDocs,
  getDocsFromServer,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  limit,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from './config';
import { 
  Donor, 
  BloodRequest, 
  District, 
  UserAccount, 
  AppNotification, 
  MasterSpreadsheetConfig,
  Announcement,
  AuditLog,
  FCMDeviceToken,
  WhatsAppDispatch,
  HospitalAd,
  Hospital,
  Doctor,
  AppUpdateConfig
} from '../types';
import { storageService } from '../services/storageService';
import { sortHospitalAds } from '../utils/hospitalAdUtils';
import { sortHospitals, sortDoctors } from '../utils/hospitalDirectoryUtils';
import { normalizeUserRecord, summarizeUsersDirectory, UserDirectorySummary } from '../lib/userDirectoryUtils.js';
import {
  normalizeAuditLogDoc,
  sortAuditLogsNewestFirst,
  resolveAuditLogDocIds,
  chunkAuditLogDocIds
} from '../lib/auditLogUtils.js';

// Helper to strip undefined or null values before submitting to Firestore
function cleanFirestoreData<T extends Record<string, any>>(data: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined && val !== null) {
      result[key] = val;
    }
  }
  return result;
}

// Arabic text normalizer for deduplication
function normalizeArabicText(text: string): string {
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
function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let clean = String(phone).replace(/[\s\-\(\)\.]+/g, '');
  if (clean.startsWith('+967')) clean = clean.substring(4);
  if (clean.startsWith('00967')) clean = clean.substring(5);
  if (clean.startsWith('967')) clean = clean.substring(3);
  if (clean.startsWith('0') && clean.length === 10) clean = clean.substring(1);
  return clean.trim();
}

export const firestoreService = {
  // 1. Donors: Centralized Shared Database Operations
  subscribeDonors(
    callback: (donors: Donor[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const path = 'donors';
    // Immediate initial fetch to guarantee data is present immediately on reopen
    this.fetchDonors().then((fresh) => {
      if (Array.isArray(fresh)) {
        callback(fresh);
      }
    }).catch((err) => {
      console.warn('Immediate fetchDonors notice:', err?.message || err);
      if (onError) onError(err);
    });

    try {
      return onSnapshot(
        collection(db, path),
        (snap) => {
          const donors: Donor[] = [];
          snap.forEach((d) => {
            const data = d.data() as Donor;
            if (data && data.fullName && data.phone && data.bloodType) {
              donors.push(data);
            }
          });
          // Sort newest first
          donors.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });
          callback(donors);
        },
        (err) => {
          console.warn('Firestore live donors listener error:', err.message);
          if (onError) onError(err);
        }
      );
    } catch (err: any) {
      console.warn('Could not establish real-time donors listener:', err.message);
      if (onError) onError(err);
      return () => {};
    }
  },

  async fetchDonors(): Promise<Donor[]> {
    const path = 'donors';
    try {
      const snap = await getDocs(collection(db, path));
      const donors: Donor[] = [];
      snap.forEach((d) => {
        const data = d.data() as Donor;
        if (data && data.fullName && data.phone && data.bloodType) {
          donors.push(data);
        }
      });
      donors.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      return donors;
    } catch (err: any) {
      console.error('Firestore fetchDonors error:', err);
      throw err;
    }
  },

  // Centralized deduplication check directly against Firestore
  async checkDonorDuplicate(
    fullName: string, 
    phone: string,
    excludeId?: string
  ): Promise<{ isDuplicate: boolean; reason?: string; existingDonor?: Donor }> {
    const cleanPhone = normalizePhoneNumber(phone);
    const cleanName = normalizeArabicText(fullName);

    if (!cleanPhone || cleanPhone.length !== 9) {
      return {
        isDuplicate: true,
        reason: 'رقم الهاتف غير صحيح، يجب أن يتكون من 9 أرقام يمنية (77، 78، 73، 71، 70)'
      };
    }

    const remoteDonors = await this.fetchDonors().catch(() => []);
    for (const d of remoteDonors) {
      if (excludeId && d.id === excludeId) continue;

      const dPhone = normalizePhoneNumber(d.phone);
      if (dPhone === cleanPhone) {
        return {
          isDuplicate: true,
          reason: `رقم الهاتف (${phone}) مسجل مسبقاً في قاعدة البيانات المشتركة باسم المتبرع (${d.fullName}). يمنع تسجيل نفس المتبرع أكثر من مرة.`,
          existingDonor: d
        };
      }

      const dName = normalizeArabicText(d.fullName);
      if (dName === cleanName) {
        return {
          isDuplicate: true,
          reason: `يوجد متبرع مسجل مسبقاً بنفس الاسم (${d.fullName}) في قاعدة البيانات المشتركة.`,
          existingDonor: d
        };
      }
    }

    return { isDuplicate: false };
  },

  // Centralized save donor directly to Firestore with strict deduplication
  async saveDonor(
    donorData: Omit<Donor, 'id' | 'createdAt'>, 
    activeUser?: UserAccount | null
  ): Promise<Donor> {
    const cleanPhone = normalizePhoneNumber(donorData.phone);
    const cleanName = donorData.fullName.trim();

    if (!cleanName || !cleanPhone || !donorData.bloodType || !donorData.district || !donorData.area) {
      throw new Error('يرجى إكمال جميع الحقول الإلزامية للمتبرع');
    }

    // 1. Strict Firestore-level duplicate verification
    const dupCheck = await this.checkDonorDuplicate(cleanName, cleanPhone);
    if (dupCheck.isDuplicate) {
      throw new Error(dupCheck.reason || 'المتبرع مسجل مسبقاً في قاعدة البيانات المشتركة');
    }

    // 2. Single registration enforcement for standard user accounts
    if (activeUser && activeUser.role === 'user' && activeUser.linkedDonorId) {
      throw new Error('لديك سجل متبرع مسجل مسبقاً بهذا الحساب. يُسمح بسجل واحد فقط لكل شخص.');
    }

    const rawDonor: Donor = {
      ...donorData,
      id: `donor-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fullName: cleanName,
      phone: cleanPhone,
      isAvailable: donorData.isAvailable ?? true,
      createdAt: new Date().toISOString()
    };

    const cleanedDonor = cleanFirestoreData(rawDonor) as Donor;

    // 3. Write directly to Firestore centralized database
    const path = `donors/${cleanedDonor.id}`;
    try {
      await setDoc(doc(db, 'donors', cleanedDonor.id), cleanedDonor);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }

    return cleanedDonor;
  },

  async setDonor(donor: Donor): Promise<void> {
    const clean = cleanFirestoreData(donor);
    const path = `donors/${donor.id}`;
    try {
      await setDoc(doc(db, 'donors', donor.id), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async updateDonor(donor: Donor): Promise<void> {
    const clean = cleanFirestoreData(donor);
    const path = `donors/${donor.id}`;
    try {
      await setDoc(doc(db, 'donors', donor.id), clean, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  async deleteDonor(id: string): Promise<void> {
    const path = `donors/${id}`;
    try {
      await deleteDoc(doc(db, 'donors', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  async deleteAllDonors(): Promise<number> {
    const path = 'donors';
    try {
      const snap = await getDocs(collection(db, path));
      let count = 0;
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
        count++;
      }
      return count;
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
      return 0;
    }
  },

  async deleteUnavailableDonors(): Promise<number> {
    const path = 'donors';
    try {
      const snap = await getDocs(collection(db, path));
      let count = 0;
      for (const d of snap.docs) {
        const data = d.data() as Donor;
        if (data.isAvailable === false) {
          await deleteDoc(d.ref);
          count++;
        }
      }
      return count;
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
      return 0;
    }
  },

  // 2. Requests: Real-time Live Subscription & CRUD
  subscribeRequests(callback: (requests: BloodRequest[]) => void): () => void {
    const path = 'requests';
    this.fetchRequests().then((fresh) => {
      if (Array.isArray(fresh)) callback(fresh);
    }).catch(() => {});

    try {
      return onSnapshot(
        collection(db, path),
        { includeMetadataChanges: true },
        (snap) => {
          if (snap.metadata.fromCache) {
            return;
          }
          const reqs: BloodRequest[] = [];
          snap.forEach((d) => {
            const data = { id: d.id, ...d.data() } as BloodRequest;
            if (data) {
              reqs.push(data);
            }
          });
          reqs.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });
          callback(reqs);
        },
        (err) => {
          console.warn('Firestore live requests listener notice:', err.message);
        }
      );
    } catch (err: any) {
      console.warn('Could not establish real-time requests listener:', err.message);
      return () => {};
    }
  },

  async fetchRequests(): Promise<BloodRequest[]> {
    const path = 'requests';
    try {
      const snap = await getDocs(collection(db, path));
      const requests: BloodRequest[] = [];
      snap.forEach((d) => {
        const data = { id: d.id, ...d.data() } as BloodRequest;
        if (data) {
          requests.push(data);
        }
      });
      requests.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      return requests;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
      return [];
    }
  },

  async setRequest(req: BloodRequest): Promise<void> {
    const clean = cleanFirestoreData(req);
    const path = `requests/${req.id}`;
    try {
      await setDoc(doc(db, 'requests', req.id), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async updateRequest(req: BloodRequest): Promise<void> {
    const clean = cleanFirestoreData(req);
    const path = `requests/${req.id}`;
    try {
      await setDoc(doc(db, 'requests', req.id), clean, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  async deleteRequest(id: string): Promise<void> {
    const path = `requests/${id}`;
    try {
      await deleteDoc(doc(db, 'requests', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // 3. Districts: Real-time Live Subscription & CRUD
  subscribeDistricts(callback: (districts: District[]) => void): () => void {
    const path = 'districts';
    this.fetchDistricts().then((fresh) => {
      if (Array.isArray(fresh) && fresh.length > 0) callback(fresh);
    }).catch(() => {});

    try {
      return onSnapshot(
        collection(db, path),
        (snap) => {
          const districts: District[] = [];
          snap.forEach((d) => {
            const data = d.data() as District;
            if (data && data.name) {
              districts.push(data);
            }
          });
          if (districts.length > 0) {
            callback(districts);
          }
        },
        (err) => {
          console.warn('Firestore live districts listener notice:', err.message);
        }
      );
    } catch (err: any) {
      return () => {};
    }
  },

  async fetchDistricts(): Promise<District[]> {
    const path = 'districts';
    try {
      const snap = await getDocs(collection(db, path));
      const districts: District[] = [];
      snap.forEach((d) => districts.push(d.data() as District));
      return districts;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
      return [];
    }
  },

  async setDistrict(district: District): Promise<void> {
    const clean = cleanFirestoreData(district);
    const path = `districts/${district.id}`;
    try {
      await setDoc(doc(db, 'districts', district.id), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async deleteDistrict(id: string): Promise<void> {
    const path = `districts/${id}`;
    try {
      await deleteDoc(doc(db, 'districts', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // 4. Notifications: Real-time Live Subscription & Management
  subscribeNotifications(callback: (notifications: AppNotification[]) => void): () => void {
    const path = 'notifications';
    this.fetchNotifications().then((fresh) => {
      if (Array.isArray(fresh) && fresh.length > 0) callback(fresh);
    }).catch(() => {});

    try {
      return onSnapshot(
        collection(db, path),
        (snap) => {
          const notifs: AppNotification[] = [];
          snap.forEach((d) => {
            const data = d.data() as AppNotification;
            if (data && data.title && data.message) {
              notifs.push(data);
            }
          });
          notifs.sort((a, b) => {
            const timeA = a.id ? Number(a.id.replace(/\D/g, '')) || 0 : 0;
            const timeB = b.id ? Number(b.id.replace(/\D/g, '')) || 0 : 0;
            return timeB - timeA;
          });
          callback(notifs);
        },
        (err) => {
          console.warn('Firestore live notifications listener notice:', err.message);
        }
      );
    } catch (err: any) {
      return () => {};
    }
  },

  async fetchNotifications(): Promise<AppNotification[]> {
    const path = 'notifications';
    try {
      const snap = await getDocs(collection(db, path));
      const notifs: AppNotification[] = [];
      snap.forEach((d) => notifs.push(d.data() as AppNotification));
      notifs.sort((a, b) => {
        const timeA = a.id ? Number(a.id.replace(/\D/g, '')) || 0 : 0;
        const timeB = b.id ? Number(b.id.replace(/\D/g, '')) || 0 : 0;
        return timeB - timeA;
      });
      return notifs;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
      return [];
    }
  },

  async setNotification(notification: AppNotification): Promise<void> {
    const clean = cleanFirestoreData(notification);
    const path = `notifications/${notification.id}`;
    try {
      await setDoc(doc(db, 'notifications', notification.id), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async markNotificationRead(id: string): Promise<void> {
    const path = `notifications/${id}`;
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  async deleteNotification(id: string): Promise<void> {
    const path = `notifications/${id}`;
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // 5. Announcements / Advertisements (إدارة الإعلانات)
  subscribeAnnouncements(callback: (announcements: Announcement[]) => void): () => void {
    const path = 'announcements';
    this.fetchAnnouncements().then((list) => callback(list)).catch(() => {});

    try {
      return onSnapshot(
        collection(db, path),
        (snap) => {
          const list: Announcement[] = [];
          snap.forEach((d) => {
            const data = d.data() as Announcement;
            if (data && data.title) {
              list.push(data);
            }
          });
          list.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });
          callback(list);
        },
        (err) => {
          console.warn('Firestore live announcements listener notice:', err.message);
        }
      );
    } catch (err) {
      return () => {};
    }
  },

  async fetchAnnouncements(): Promise<Announcement[]> {
    const path = 'announcements';
    try {
      const snap = await getDocs(collection(db, path));
      const list: Announcement[] = [];
      snap.forEach((d) => list.push(d.data() as Announcement));
      list.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
      return [];
    }
  },

  async saveAnnouncement(announcement: Announcement): Promise<void> {
    const clean = cleanFirestoreData(announcement);
    const path = `announcements/${announcement.id}`;
    try {
      await setDoc(doc(db, 'announcements', announcement.id), clean, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async deleteAnnouncement(id: string): Promise<void> {
    const path = `announcements/${id}`;
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // 6. Audit Logs (سجل عمليات المسؤول)
  subscribeAuditLogs(
    callback: (logs: AuditLog[]) => void,
    onError?: (err: any) => void
  ): () => void {
    const path = 'audit_logs';
    let isCancelled = false;
    let hasAuthoritativeServerSnapshot = false;

    // Immediate fresh server fetch to guarantee zero stale IndexedDB/local-cache state
    this.fetchAuditLogs()
      .then((list) => {
        if (!isCancelled && !hasAuthoritativeServerSnapshot) {
          callback(list);
        }
      })
      .catch((err) => {
        if (onError) onError(err);
      });

    try {
      const unsubscribe = onSnapshot(
        collection(db, path),
        { includeMetadataChanges: true },
        (snap) => {
          if (isCancelled) return;
          // Ignore local persistent cache emissions so deleted records never re-appear
          if (snap.metadata.fromCache) {
            return;
          }
          hasAuthoritativeServerSnapshot = true;
          const list: AuditLog[] = [];
          snap.forEach((d) => {
            const normalized = normalizeAuditLogDoc(d.data(), d.id);
            if (normalized) {
              list.push(normalized);
            }
          });
          callback(sortAuditLogsNewestFirst(list));
        },
        (err) => {
          console.warn('Firestore live audit logs listener notice:', err.message);
          if (onError) onError(err);
        }
      );

      return () => {
        isCancelled = true;
        unsubscribe();
      };
    } catch (err: any) {
      if (onError) onError(err);
      return () => {
        isCancelled = true;
      };
    }
  },

  async fetchAuditLogs(): Promise<AuditLog[]> {
    const path = 'audit_logs';
    try {
      const snap = await getDocsFromServer(collection(db, path));
      const list: AuditLog[] = [];
      snap.forEach((d) => {
        const normalized = normalizeAuditLogDoc(d.data(), d.id);
        if (normalized) {
          list.push(normalized);
        }
      });
      return sortAuditLogsNewestFirst(list);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
      return [];
    }
  },

  async addAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    const id = `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const fullLog: AuditLog = {
      ...entry,
      id,
      timestamp: new Date().toISOString()
    };
    const clean = cleanFirestoreData(fullLog);
    try {
      await setDoc(doc(db, 'audit_logs', id), clean);
    } catch (err) {
      console.warn('addAuditLog error (continuing):', err);
    }
  },

  async deleteAuditLog(id: string): Promise<void> {
    return this.deleteAuditLogs([id]);
  },

  async deleteAuditLogs(ids: string[]): Promise<void> {
    const uniqueIds = resolveAuditLogDocIds(ids);
    if (uniqueIds.length === 0) return;

    const path = uniqueIds.length === 1 ? `audit_logs/${uniqueIds[0]}` : 'audit_logs';
    const chunks = chunkAuditLogDocIds(uniqueIds, 450);

    try {
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const docId of chunk) {
          batch.delete(doc(db, 'audit_logs', docId));
        }
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  async deleteAllAuditLogs(): Promise<void> {
    const path = 'audit_logs';
    const maxPasses = 25;

    try {
      for (let pass = 0; pass < maxPasses; pass++) {
        const snap = await getDocsFromServer(collection(db, path));
        if (snap.empty) {
          return;
        }
        const targetIds = snap.docs.map((d) => d.id).filter(Boolean);
        if (targetIds.length === 0) {
          return;
        }
        // Strictly keep each Firestore writeBatch <= 450 operations (below 500 hard limit)
        const chunks = chunkAuditLogDocIds(targetIds, 450);
        for (const chunk of chunks) {
          const batch = writeBatch(db);
          for (const docId of chunk) {
            batch.delete(doc(db, 'audit_logs', docId));
          }
          await batch.commit();
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // 7. Users Accounts Management
  subscribeUsers(
    callback: (users: UserAccount[], summary: UserDirectorySummary) => void,
    onError?: (error: any) => void
  ): () => void {
    const path = 'users';
    let isCancelled = false;

    const emitSummary = (rawList: Array<Record<string, any>>) => {
      if (isCancelled) return;
      const summary = summarizeUsersDirectory(rawList);
      callback(summary.activeUsers, summary);
    };

    // Immediate fresh server fetch to avoid stale persistentLocalCache counts
    this.fetchUsersRaw()
      .then((rawList) => emitSummary(rawList))
      .catch((err) => {
        if (onError) onError(err);
      });

    try {
      const unsubscribe = onSnapshot(
        collection(db, path),
        (snap) => {
          const rawList: Array<Record<string, any>> = [];
          snap.forEach((d) => {
            const normalized = normalizeUserRecord(d.data(), d.id);
            if (normalized) {
              rawList.push(normalized);
            }
          });
          emitSummary(rawList);
        },
        (err) => {
          console.warn('Firestore live users listener notice:', err?.message || err);
          if (onError) onError(err);
        }
      );

      return () => {
        isCancelled = true;
        unsubscribe();
      };
    } catch (err: any) {
      console.warn('Could not establish real-time users listener:', err?.message || err);
      if (onError) onError(err);
      return () => {
        isCancelled = true;
      };
    }
  },

  async fetchUsersRaw(): Promise<UserAccount[]> {
    const path = 'users';
    try {
      let snap;
      try {
        snap = await getDocsFromServer(collection(db, path));
      } catch {
        snap = await getDocs(collection(db, path));
      }
      const rawUsers: UserAccount[] = [];
      snap.forEach((d) => {
        const normalized = normalizeUserRecord(d.data(), d.id);
        if (normalized) {
          rawUsers.push(normalized);
        }
      });
      return rawUsers;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
      return [];
    }
  },

  async fetchUsers(): Promise<UserAccount[]> {
    const rawUsers = await this.fetchUsersRaw();
    return summarizeUsersDirectory(rawUsers).activeUsers;
  },

  async setUser(user: UserAccount): Promise<void> {
    const clean = cleanFirestoreData(user);
    const path = `users/${user.id}`;
    try {
      await setDoc(doc(db, 'users', user.id), clean, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async updateUserRole(userId: string, role: 'admin' | 'user'): Promise<void> {
    const path = `users/${userId}`;
    try {
      await updateDoc(doc(db, 'users', userId), { role });
      if (role === 'admin') {
        await setDoc(doc(db, 'admins', userId), { isAdmin: true, updatedAt: new Date().toISOString() });
      } else {
        await deleteDoc(doc(db, 'admins', userId)).catch(() => {});
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  async deleteUser(id: string): Promise<void> {
    const path = `users/${id}`;
    try {
      await deleteDoc(doc(db, 'users', id));
      await deleteDoc(doc(db, 'admins', id)).catch(() => {});
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  async fetchUserById(id: string): Promise<UserAccount | null> {
    const path = `users/${id}`;
    try {
      const snap = await getDoc(doc(db, 'users', id));
      if (snap.exists()) {
        return snap.data() as UserAccount;
      }
      return null;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
      return null;
    }
  },

  async fetchUserByUsernameOrPhone(identifier: string): Promise<UserAccount | null> {
    if (!identifier) return null;
    const cleanU = identifier.trim().toLowerCase();
    const cleanPhone = normalizePhoneNumber(identifier);

    try {
      // Direct doc lookup by ID
      const directDoc = await getDoc(doc(db, 'users', identifier.trim())).catch(() => null);
      if (directDoc && directDoc.exists()) {
        return directDoc.data() as UserAccount;
      }

      // Targeted queries
      const queries = [
        getDocs(query(collection(db, 'users'), where('username', '==', cleanU), limit(1))).catch(() => null)
      ];

      if (cleanPhone) {
        queries.push(
          getDocs(query(collection(db, 'users'), where('phone', '==', cleanPhone), limit(1))).catch(() => null)
        );
      }

      const results = await Promise.all(queries);
      for (const res of results) {
        if (res && !res.empty) {
          const docData = res.docs[0].data() as UserAccount;
          if (docData && docData.id) return docData;
        }
      }

      // Fallback: full fetch
      const allUsers = await this.fetchUsers().catch(() => []);
      const found = allUsers.find(
        (u) =>
          (u.username && u.username.toLowerCase() === cleanU) ||
          (cleanPhone && normalizePhoneNumber(u.phone) === cleanPhone)
      );
      return found || null;
    } catch (err) {
      console.warn('fetchUserByUsernameOrPhone notice:', err);
      return null;
    }
  },

  subscribeAuthState(callback: (user: UserAccount | null) => void): () => void {
    try {
      const currentUser = storageService.getCurrentUser();
      callback(currentUser);
    } catch (err) {
      console.warn('subscribeAuthState notice:', err);
      callback(null);
    }
    return () => {};
  },

  // 8. Seed Firestore with initial data ONLY on initial system installation
  async seedInitialDataIfEmpty(
    initialDonors: Donor[],
    initialRequests: BloodRequest[],
    initialDistricts: District[],
    initialUsers: UserAccount[],
    initialNotifications?: AppNotification[]
  ): Promise<void> {
    try {
      // Check if initialization marker exists
      const initSnap = await getDoc(doc(db, 'settings', 'system_init')).catch(() => null);
      if (initSnap && initSnap.exists()) {
        // System already initialized. NEVER re-insert deleted records!
        return;
      }

      // Check if donors collection already has records
      const existingDonors = await getDocs(query(collection(db, 'donors'), limit(1))).catch(() => null);
      if (existingDonors && !existingDonors.empty) {
        await setDoc(doc(db, 'settings', 'system_init'), { initializedAt: new Date().toISOString() });
        return;
      }

      // Fresh initialization (first launch only)
      for (const d of initialDonors) {
        await this.setDonor(d).catch(() => {});
      }
      for (const r of initialRequests) {
        await this.setRequest(r).catch(() => {});
      }
      for (const dist of initialDistricts) {
        await this.setDistrict(dist).catch(() => {});
      }
      for (const u of initialUsers) {
        await this.setUser(u).catch(() => {});
      }
      if (Array.isArray(initialNotifications)) {
        for (const n of initialNotifications) {
          await this.setNotification(n).catch(() => {});
        }
      }

      // Ensure root admin document exists in admins collection
      await setDoc(doc(db, 'admins', 'user-admin'), {
        email: 'abdulrahmanalshaiby2028@gmail.com',
        username: 'admin',
        role: 'admin',
        createdAt: new Date().toISOString()
      }, { merge: true });

      await setDoc(doc(db, 'settings', 'system_init'), { initializedAt: new Date().toISOString() });
    } catch (err) {
      console.warn('Firestore seeding notice:', err);
    }
  },

  // 9. Master Google Sheets Configuration in Firestore
  async getMasterSpreadsheetConfig(): Promise<MasterSpreadsheetConfig | null> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'google_sheets'));
      if (snap.exists()) {
        const data = snap.data() as MasterSpreadsheetConfig;
        if (data && data.spreadsheetId) {
          try {
            localStorage.setItem('qaatabah_master_spreadsheet_v1', JSON.stringify(data));
          } catch {}
          return data;
        }
      }
    } catch (e) {
      console.warn('getMasterSpreadsheetConfig notice:', e);
    }
    return null;
  },

  async setMasterSpreadsheetConfig(config: MasterSpreadsheetConfig): Promise<void> {
    try {
      localStorage.setItem('qaatabah_master_spreadsheet_v1', JSON.stringify(config));
    } catch {}
    try {
      const clean = cleanFirestoreData(config);
      await setDoc(doc(db, 'settings', 'google_sheets'), clean, { merge: true });
    } catch (e) {
      console.warn('setMasterSpreadsheetConfig notice:', e);
    }
  },

  // 10. Direct confirmation of the master admin code and credentials in Firebase Firestore
  async confirmMasterAdminInFirestore(): Promise<void> {
    const masterCode = 'alsh486iby-2026';
    const masterHash = '0ffa41d39b4d4e70e376d592843d41e94a71d1593aa961f31dbc278ecbc56992';
    const masterEmail = 'abdulrahmanalshaiby2028@gmail.com';

    try {
      // 1. Confirm admin user profile in Firebase Firestore collection 'users'
      await setDoc(doc(db, 'users', 'user-admin'), {
        id: 'user-admin',
        username: 'admin',
        fullName: 'مسؤول السجل المركزي - قعطبة',
        phone: '770236765',
        role: 'admin',
        password: masterCode,
        passwordHash: masterHash,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Confirm master admin settings in Firebase Firestore collection 'settings/admin'
      await setDoc(doc(db, 'settings', 'admin'), {
        pin: masterCode,
        recoveryCode: masterCode,
        masterCode: masterCode,
        recipientEmail: masterEmail,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 3. Confirm trusted admin authority in Firebase Firestore collection 'admins'
      await setDoc(doc(db, 'admins', 'user-admin'), {
        email: masterEmail,
        username: 'admin',
        role: 'admin',
        masterCode: masterCode,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('confirmMasterAdminInFirestore notice:', err);
    }
  },

  // 11. FCM Device Tokens for Web and Native Android APK
  async saveFCMDeviceToken(deviceToken: FCMDeviceToken): Promise<void> {
    const clean = cleanFirestoreData(deviceToken);
    const path = `fcm_tokens/${deviceToken.id}`;
    try {
      await setDoc(doc(db, 'fcm_tokens', deviceToken.id), clean, { merge: true });
    } catch (err) {
      console.warn('saveFCMDeviceToken notice (continuing):', err);
    }
  },

  async fetchFCMDeviceTokens(): Promise<FCMDeviceToken[]> {
    const path = 'fcm_tokens';
    try {
      const snap = await getDocs(collection(db, path));
      const tokens: FCMDeviceToken[] = [];
      snap.forEach((d) => {
        const data = d.data() as FCMDeviceToken;
        if (data && data.token) {
          tokens.push(data);
        }
      });
      return tokens;
    } catch (err) {
      console.warn('fetchFCMDeviceTokens notice:', err);
      return [];
    }
  },

  async deleteFCMDeviceToken(tokenId: string): Promise<void> {
    const path = `fcm_tokens/${tokenId}`;
    try {
      await deleteDoc(doc(db, 'fcm_tokens', tokenId));
    } catch (err) {
      console.warn('deleteFCMDeviceToken notice:', err);
    }
  },

  // WhatsApp Business Cloud API Dispatch Logs
  subscribeWhatsAppDispatches(callback: (dispatches: WhatsAppDispatch[]) => void): () => void {
    const path = 'whatsapp_dispatches';
    try {
      const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(100));
      return onSnapshot(
        q,
        (snap) => {
          const items: WhatsAppDispatch[] = [];
          snap.forEach((d) => items.push(d.data() as WhatsAppDispatch));
          callback(items);
        },
        (err) => {
          console.warn('subscribeWhatsAppDispatches notice:', err);
        }
      );
    } catch (err) {
      console.warn('subscribeWhatsAppDispatches setup notice:', err);
      return () => {};
    }
  },

  async fetchWhatsAppDispatches(): Promise<WhatsAppDispatch[]> {
    const path = 'whatsapp_dispatches';
    try {
      const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(100));
      const snap = await getDocs(q);
      const items: WhatsAppDispatch[] = [];
      snap.forEach((d) => items.push(d.data() as WhatsAppDispatch));
      return items;
    } catch (err) {
      console.warn('fetchWhatsAppDispatches notice:', err);
      return [];
    }
  },

  async saveWhatsAppDispatch(dispatch: WhatsAppDispatch): Promise<void> {
    const clean = cleanFirestoreData(dispatch) as WhatsAppDispatch;
    const path = `whatsapp_dispatches/${dispatch.id}`;
    try {
      await setDoc(doc(db, 'whatsapp_dispatches', dispatch.id), clean, { merge: true });
    } catch (err) {
      console.warn('saveWhatsAppDispatch notice (continuing):', err);
    }
  },

  // 12. Hospital & Medical Center Ads (إعلانات المستشفيات والمراكز الطبية)
  subscribeHospitalAds(
    callback: (ads: HospitalAd[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const path = 'hospital_ads';
    this.fetchHospitalAds()
      .then((ads) => {
        if (Array.isArray(ads)) {
          callback(ads);
        }
      })
      .catch((err) => {
        console.warn('Initial fetchHospitalAds notice:', err?.message || err);
        if (onError) onError(err);
      });

    try {
      return onSnapshot(
        collection(db, path),
        (snap) => {
          const ads: HospitalAd[] = [];
          snap.forEach((d) => {
            const data = d.data() as HospitalAd;
            if (data && data.id && data.hospitalName && data.imageUrl) {
              ads.push(data);
            }
          });
          callback(sortHospitalAds(ads));
        },
        (err) => {
          console.warn('Firestore live hospital_ads listener notice:', err?.message || err);
          if (onError) onError(err);
        }
      );
    } catch (err: any) {
      console.warn('Could not establish real-time hospital_ads listener:', err?.message || err);
      if (onError) onError(err);
      return () => {};
    }
  },

  async fetchHospitalAds(): Promise<HospitalAd[]> {
    const path = 'hospital_ads';
    try {
      const snap = await getDocs(collection(db, path));
      const ads: HospitalAd[] = [];
      snap.forEach((d) => {
        const data = d.data() as HospitalAd;
        if (data && data.id && data.hospitalName && data.imageUrl) {
          ads.push(data);
        }
      });
      return sortHospitalAds(ads);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
      return [];
    }
  },

  async saveHospitalAd(ad: HospitalAd): Promise<void> {
    const clean = cleanFirestoreData(ad);
    const path = `hospital_ads/${ad.id}`;
    try {
      await setDoc(doc(db, 'hospital_ads', ad.id), clean, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async deleteHospitalAd(id: string): Promise<void> {
    const path = `hospital_ads/${id}`;
    try {
      await deleteDoc(doc(db, 'hospital_ads', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  async reorderHospitalAds(ads: HospitalAd[]): Promise<void> {
    for (const ad of ads) {
      const path = `hospital_ads/${ad.id}`;
      try {
        await updateDoc(doc(db, 'hospital_ads', ad.id), {
          displayOrder: ad.displayOrder,
          updatedAt: ad.updatedAt || new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }
  },

  // 13. In-App Update Configuration (إعدادات تحديث التطبيق)
  async fetchAppUpdateConfig(): Promise<AppUpdateConfig | null> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'app_update'));
      if (snap.exists()) {
        const data = snap.data() as AppUpdateConfig;
        if (data && typeof data === 'object' && data.android) {
          return data;
        }
      }
      return null;
    } catch (err) {
      console.warn('fetchAppUpdateConfig notice:', err);
      return null;
    }
  },

  async saveAppUpdateConfig(config: AppUpdateConfig): Promise<void> {
    const clean = JSON.parse(JSON.stringify(config));
    const path = 'settings/app_update';
    try {
      await setDoc(doc(db, 'settings', 'app_update'), clean, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  // 14. Hospitals & Doctors Directory (دليل المستشفيات والأطباء)
  subscribeHospitals(
    callback: (hospitals: Hospital[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const path = 'hospitals';
    let isCancelled = false;
    let activeUnsubscribe: (() => void) | null = null;

    const attachFallbackListener = () => {
      if (isCancelled) return;
      fetchDirectoryHospitalsFromSettings()
        .then((list) => {
          if (!isCancelled) callback(list);
        })
        .catch(() => {
          if (!isCancelled) callback([]);
        });

      try {
        activeUnsubscribe = onSnapshot(
          doc(db, 'settings', DIRECTORY_INDEX_DOC_ID),
          () => {
            fetchDirectoryHospitalsFromSettings()
              .then((list) => {
                if (!isCancelled) callback(list);
              })
              .catch(() => {});
          },
          (err) => {
            console.warn('Firestore directory index hospitals listener notice:', err?.message || err);
          }
        );
      } catch (err: any) {
        console.warn('Could not establish fallback hospitals listener:', err?.message || err);
      }
    };

    getDocs(collection(db, path))
      .then((snap) => {
        if (isCancelled) return;
        const initial: Hospital[] = [];
        snap.forEach((d) => {
          const data = d.data() as Hospital;
          if (data && data.id && data.name && data.imageUrl) {
            initial.push(data);
          }
        });
        callback(sortHospitals(initial));

        try {
          activeUnsubscribe = onSnapshot(
            collection(db, path),
            (liveSnap) => {
              const hospitals: Hospital[] = [];
              liveSnap.forEach((d) => {
                const data = d.data() as Hospital;
                if (data && data.id && data.name && data.imageUrl) {
                  hospitals.push(data);
                }
              });
              callback(sortHospitals(hospitals));
            },
            (err) => {
              if (isFirestorePermissionDenied(err)) {
                if (activeUnsubscribe) {
                  activeUnsubscribe();
                  activeUnsubscribe = null;
                }
                attachFallbackListener();
                return;
              }
              console.warn('Firestore live hospitals listener notice:', err?.message || err);
              if (onError) onError(err);
            }
          );
        } catch (err: any) {
          console.warn('Could not establish real-time hospitals listener:', err?.message || err);
          if (onError) onError(err);
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        if (isFirestorePermissionDenied(err)) {
          attachFallbackListener();
          return;
        }
        console.warn('Initial fetchHospitals notice:', err?.message || err);
        if (onError) onError(err);
      });

    return () => {
      isCancelled = true;
      if (activeUnsubscribe) {
        activeUnsubscribe();
        activeUnsubscribe = null;
      }
    };
  },

  async fetchHospitals(): Promise<Hospital[]> {
    const path = 'hospitals';
    try {
      const snap = await getDocs(collection(db, path));
      const hospitals: Hospital[] = [];
      snap.forEach((d) => {
        const data = d.data() as Hospital;
        if (data && data.id && data.name && data.imageUrl) {
          hospitals.push(data);
        }
      });
      const fallbackHospitals = await fetchDirectoryHospitalsFromSettings().catch(() => []);
      if (fallbackHospitals.length > 0) {
        const merged = new Map<string, Hospital>();
        for (const h of fallbackHospitals) merged.set(h.id, h);
        for (const h of hospitals) merged.set(h.id, h);
        return sortHospitals(Array.from(merged.values()));
      }
      return sortHospitals(hospitals);
    } catch (err) {
      if (isFirestorePermissionDenied(err)) {
        return fetchDirectoryHospitalsFromSettings().catch(() => []);
      }
      console.warn('fetchHospitals notice:', err);
      return fetchDirectoryHospitalsFromSettings().catch(() => []);
    }
  },

  async saveHospital(hospital: Hospital): Promise<void> {
    const clean = cleanFirestoreData(hospital) as Hospital;
    const path = `hospitals/${hospital.id}`;
    try {
      await setDoc(doc(db, 'hospitals', hospital.id), clean, { merge: true });
      return;
    } catch (err) {
      if (isFirestorePermissionDenied(err)) {
        await saveHospitalToSettings(clean);
        return;
      }
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async deleteHospital(id: string): Promise<void> {
    const path = `hospitals/${id}`;
    try {
      await deleteDoc(doc(db, 'hospitals', id));
      await deleteHospitalFromSettings(id).catch(() => {});
      return;
    } catch (err) {
      if (isFirestorePermissionDenied(err)) {
        await deleteHospitalFromSettings(id);
        return;
      }
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  async reorderHospitals(hospitals: Hospital[]): Promise<void> {
    let usedFallback = false;
    for (const h of hospitals) {
      const path = `hospitals/${h.id}`;
      try {
        await updateDoc(doc(db, 'hospitals', h.id), {
          displayOrder: h.displayOrder,
          updatedAt: h.updatedAt || new Date().toISOString()
        });
      } catch (err) {
        if (isFirestorePermissionDenied(err)) {
          usedFallback = true;
          break;
        }
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }
    if (usedFallback) {
      await reorderHospitalsInSettings(hospitals);
    }
  },

  subscribeDoctors(
    callback: (doctors: Doctor[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const path = 'doctors';
    let isCancelled = false;
    let activeUnsubscribe: (() => void) | null = null;

    const attachFallbackListener = () => {
      if (isCancelled) return;
      fetchDirectoryDoctorsFromSettings()
        .then((list) => {
          if (!isCancelled) callback(list);
        })
        .catch(() => {
          if (!isCancelled) callback([]);
        });

      try {
        activeUnsubscribe = onSnapshot(
          doc(db, 'settings', DIRECTORY_INDEX_DOC_ID),
          () => {
            fetchDirectoryDoctorsFromSettings()
              .then((list) => {
                if (!isCancelled) callback(list);
              })
              .catch(() => {});
          },
          (err) => {
            console.warn('Firestore directory index doctors listener notice:', err?.message || err);
          }
        );
      } catch (err: any) {
        console.warn('Could not establish fallback doctors listener:', err?.message || err);
      }
    };

    getDocs(collection(db, path))
      .then((snap) => {
        if (isCancelled) return;
        const initial: Doctor[] = [];
        snap.forEach((d) => {
          const data = d.data() as Doctor;
          if (data && data.id && data.hospitalId && data.fullName && data.specialty) {
            initial.push(data);
          }
        });
        callback(sortDoctors(initial));

        try {
          activeUnsubscribe = onSnapshot(
            collection(db, path),
            (liveSnap) => {
              const doctors: Doctor[] = [];
              liveSnap.forEach((d) => {
                const data = d.data() as Doctor;
                if (data && data.id && data.hospitalId && data.fullName && data.specialty) {
                  doctors.push(data);
                }
              });
              callback(sortDoctors(doctors));
            },
            (err) => {
              if (isFirestorePermissionDenied(err)) {
                if (activeUnsubscribe) {
                  activeUnsubscribe();
                  activeUnsubscribe = null;
                }
                attachFallbackListener();
                return;
              }
              console.warn('Firestore live doctors listener notice:', err?.message || err);
              if (onError) onError(err);
            }
          );
        } catch (err: any) {
          console.warn('Could not establish real-time doctors listener:', err?.message || err);
          if (onError) onError(err);
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        if (isFirestorePermissionDenied(err)) {
          attachFallbackListener();
          return;
        }
        console.warn('Initial fetchDoctors notice:', err?.message || err);
        if (onError) onError(err);
      });

    return () => {
      isCancelled = true;
      if (activeUnsubscribe) {
        activeUnsubscribe();
        activeUnsubscribe = null;
      }
    };
  },

  async fetchDoctors(): Promise<Doctor[]> {
    const path = 'doctors';
    try {
      const snap = await getDocs(collection(db, path));
      const doctors: Doctor[] = [];
      snap.forEach((d) => {
        const data = d.data() as Doctor;
        if (data && data.id && data.hospitalId && data.fullName && data.specialty) {
          doctors.push(data);
        }
      });
      const fallbackDoctors = await fetchDirectoryDoctorsFromSettings().catch(() => []);
      if (fallbackDoctors.length > 0) {
        const merged = new Map<string, Doctor>();
        for (const docItem of fallbackDoctors) merged.set(docItem.id, docItem);
        for (const docItem of doctors) merged.set(docItem.id, docItem);
        return sortDoctors(Array.from(merged.values()));
      }
      return sortDoctors(doctors);
    } catch (err) {
      if (isFirestorePermissionDenied(err)) {
        return fetchDirectoryDoctorsFromSettings().catch(() => []);
      }
      console.warn('fetchDoctors notice:', err);
      return fetchDirectoryDoctorsFromSettings().catch(() => []);
    }
  },

  async saveDoctor(doctor: Doctor): Promise<void> {
    const clean = cleanFirestoreData(doctor) as Doctor;
    const path = `doctors/${doctor.id}`;
    try {
      await setDoc(doc(db, 'doctors', doctor.id), clean, { merge: true });
      return;
    } catch (err) {
      if (isFirestorePermissionDenied(err)) {
        await saveDoctorToSettings(clean);
        return;
      }
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async deleteDoctor(id: string): Promise<void> {
    const path = `doctors/${id}`;
    try {
      await deleteDoc(doc(db, 'doctors', id));
      await deleteDoctorFromSettings(id).catch(() => {});
      return;
    } catch (err) {
      if (isFirestorePermissionDenied(err)) {
        await deleteDoctorFromSettings(id);
        return;
      }
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  async deleteDoctorsByHospital(hospitalId: string): Promise<void> {
    const path = 'doctors';
    try {
      const q = query(collection(db, path), where('hospitalId', '==', hospitalId));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    } catch (err) {
      if (isFirestorePermissionDenied(err)) {
        return;
      }
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
};

const DIRECTORY_INDEX_DOC_ID = 'hospitals_directory_index';
const DIRECTORY_HOSP_PREFIX = 'dir_hosp_';
const DIRECTORY_DOC_PREFIX = 'dir_doc_';

interface DirectoryIndexDoc {
  hospitalIds: string[];
  doctorIds: string[];
  updatedAt: string;
}

function isFirestorePermissionDenied(err: any): boolean {
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || '').toLowerCase();
  return (
    code.includes('permission-denied') ||
    msg.includes('missing or insufficient permissions') ||
    msg.includes('permission_denied')
  );
}

async function getDirectoryIndex(): Promise<DirectoryIndexDoc> {
  const snap = await getDoc(doc(db, 'settings', DIRECTORY_INDEX_DOC_ID));
  if (!snap.exists()) {
    return { hospitalIds: [], doctorIds: [], updatedAt: '' };
  }
  const data = snap.data() as Partial<DirectoryIndexDoc>;
  return {
    hospitalIds: Array.isArray(data?.hospitalIds) ? data.hospitalIds.filter((x): x is string => typeof x === 'string') : [],
    doctorIds: Array.isArray(data?.doctorIds) ? data.doctorIds.filter((x): x is string => typeof x === 'string') : [],
    updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : ''
  };
}

async function fetchDirectoryHospitalsFromSettings(): Promise<Hospital[]> {
  const index = await getDirectoryIndex();
  if (index.hospitalIds.length === 0) return [];
  const snaps = await Promise.all(
    index.hospitalIds.map((id) => getDoc(doc(db, 'settings', `${DIRECTORY_HOSP_PREFIX}${id}`)).catch(() => null))
  );
  const hospitals: Hospital[] = [];
  for (const snap of snaps) {
    if (!snap || !snap.exists()) continue;
    const data = snap.data() as Hospital;
    if (data && data.id && data.name && data.imageUrl) {
      hospitals.push(data);
    }
  }
  return sortHospitals(hospitals);
}

async function fetchDirectoryDoctorsFromSettings(): Promise<Doctor[]> {
  const index = await getDirectoryIndex();
  if (index.doctorIds.length === 0) return [];
  const snaps = await Promise.all(
    index.doctorIds.map((id) => getDoc(doc(db, 'settings', `${DIRECTORY_DOC_PREFIX}${id}`)).catch(() => null))
  );
  const doctors: Doctor[] = [];
  for (const snap of snaps) {
    if (!snap || !snap.exists()) continue;
    const data = snap.data() as Doctor;
    if (data && data.id && data.hospitalId && data.fullName && data.specialty) {
      doctors.push(data);
    }
  }
  return sortDoctors(doctors);
}

async function saveHospitalToSettings(hospital: Hospital): Promise<void> {
  await setDoc(doc(db, 'settings', `${DIRECTORY_HOSP_PREFIX}${hospital.id}`), hospital, { merge: true });
  const index = await getDirectoryIndex().catch((): DirectoryIndexDoc => ({ hospitalIds: [], doctorIds: [], updatedAt: '' }));
  const nextHospitalIds = index.hospitalIds.includes(hospital.id)
    ? index.hospitalIds
    : [...index.hospitalIds, hospital.id];
  await setDoc(
    doc(db, 'settings', DIRECTORY_INDEX_DOC_ID),
    {
      hospitalIds: nextHospitalIds,
      doctorIds: index.doctorIds,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

async function deleteHospitalFromSettings(hospitalId: string): Promise<void> {
  const index = await getDirectoryIndex().catch((): DirectoryIndexDoc => ({ hospitalIds: [], doctorIds: [], updatedAt: '' }));
  await deleteDoc(doc(db, 'settings', `${DIRECTORY_HOSP_PREFIX}${hospitalId}`)).catch(() => {});

  const remainingDoctorIds: string[] = [];
  for (const docId of index.doctorIds) {
    const docSnap = await getDoc(doc(db, 'settings', `${DIRECTORY_DOC_PREFIX}${docId}`)).catch(() => null);
    const data = docSnap?.exists() ? (docSnap.data() as Doctor) : null;
    if (data && data.hospitalId === hospitalId) {
      await deleteDoc(doc(db, 'settings', `${DIRECTORY_DOC_PREFIX}${docId}`)).catch(() => {});
    } else if (docSnap?.exists()) {
      remainingDoctorIds.push(docId);
    }
  }

  await setDoc(
    doc(db, 'settings', DIRECTORY_INDEX_DOC_ID),
    {
      hospitalIds: index.hospitalIds.filter((id) => id !== hospitalId),
      doctorIds: remainingDoctorIds,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

async function reorderHospitalsInSettings(hospitals: Hospital[]): Promise<void> {
  const nowIso = new Date().toISOString();
  await Promise.all(
    hospitals.map((h) =>
      setDoc(
        doc(db, 'settings', `${DIRECTORY_HOSP_PREFIX}${h.id}`),
        cleanFirestoreData({ ...h, updatedAt: h.updatedAt || nowIso }),
        { merge: true }
      )
    )
  );
  const index = await getDirectoryIndex().catch((): DirectoryIndexDoc => ({ hospitalIds: [], doctorIds: [], updatedAt: '' }));
  const mergedIds = Array.from(new Set([...hospitals.map((h) => h.id), ...index.hospitalIds]));
  await setDoc(
    doc(db, 'settings', DIRECTORY_INDEX_DOC_ID),
    {
      hospitalIds: mergedIds,
      doctorIds: index.doctorIds,
      updatedAt: nowIso
    },
    { merge: true }
  );
}

async function saveDoctorToSettings(doctor: Doctor): Promise<void> {
  await setDoc(doc(db, 'settings', `${DIRECTORY_DOC_PREFIX}${doctor.id}`), doctor, { merge: true });
  const index = await getDirectoryIndex().catch((): DirectoryIndexDoc => ({ hospitalIds: [], doctorIds: [], updatedAt: '' }));
  const nextDoctorIds = index.doctorIds.includes(doctor.id)
    ? index.doctorIds
    : [...index.doctorIds, doctor.id];
  await setDoc(
    doc(db, 'settings', DIRECTORY_INDEX_DOC_ID),
    {
      hospitalIds: index.hospitalIds,
      doctorIds: nextDoctorIds,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

async function deleteDoctorFromSettings(doctorId: string): Promise<void> {
  await deleteDoc(doc(db, 'settings', `${DIRECTORY_DOC_PREFIX}${doctorId}`)).catch(() => {});
  const index = await getDirectoryIndex().catch((): DirectoryIndexDoc => ({ hospitalIds: [], doctorIds: [], updatedAt: '' }));
  await setDoc(
    doc(db, 'settings', DIRECTORY_INDEX_DOC_ID),
    {
      hospitalIds: index.hospitalIds,
      doctorIds: index.doctorIds.filter((id) => id !== doctorId),
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}


