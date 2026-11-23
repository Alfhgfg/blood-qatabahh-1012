export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type UrgencyLevel = 'critical' | 'urgent' | 'moderate' | 'normal';

export type RequestStatus = 'new' | 'in_progress' | 'open' | 'fulfilled' | 'cancelled';

export interface Donor {
  id: string;
  fullName: string;
  phone: string;
  bloodType: BloodType;
  district: string;
  area: string;
  isAvailable: boolean;
  lastDonationDate?: string; // YYYY-MM-DD
  notes?: string;
  createdAt: string;
  whatsappOptIn?: boolean; // Donor consent to receive urgent WhatsApp blood requests
}

export interface BloodRequest {
  id: string;
  patientName: string;
  bloodType: BloodType;
  unitsNeeded: number;
  hospital: string;
  district: string;
  area: string;
  urgency: UrgencyLevel;
  status: RequestStatus;
  contactName: string;
  contactPhone: string;
  caseDetails: string;
  requestDate: string; // YYYY-MM-DD
  createdAt: string;
}

export interface District {
  id: string;
  name: string;
  areas: string[];
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'urgent' | 'donor' | 'system';
  read: boolean;
  linkPage?: string;
  itemId?: string;
}

export type UserRole = 'admin' | 'user';

export interface DonationRecord {
  id: string;
  date: string; // YYYY-MM-DD
  hospital: string;
  bloodType: BloodType;
  recipientName?: string;
  notes?: string;
  createdAt: string;
}

export interface UserAccount {
  id: string;
  username: string;
  password?: string;
  passwordHash?: string;
  fullName: string;
  phone: string;
  email?: string;
  photoUrl?: string;
  role: UserRole;
  linkedDonorId?: string;
  fcmToken?: string;
  notificationsEnabled?: boolean;
  donationHistory?: DonationRecord[];
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: UserAccount;
  error?: string;
  message?: string;
}

export type ActivePage =
  | 'home'
  | 'donors'
  | 'requests'
  | 'info'
  | 'admin'
  | 'districts'
  | 'profile'
  | 'history'
  | 'about'
  | 'contact'
  | 'settings'
  | 'hospital-ad'
  | 'hospitals'
  | 'hospital-doctors';

export interface ExportLog {
  id: string;
  timestamp: string;
  filename: string;
  recipient: string;
  donorsCount: number;
  status: 'success' | 'saved_locally' | 'failed';
  message: string;
  errorDetails?: string;
}

export interface AdminSettings {
  recipientEmail: string;
  dailyExportHour: number;
  dailyExportMinute: number;
  autoExportEnabled: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpSecure?: boolean;
  smtpFrom?: string;
  hasSmtpPass?: boolean;
  smtpPass?: string;
  recoveryCode: string;
  lastExportAt?: string;
  lastExportStatus?: 'success' | 'saved_locally' | 'failed';
  lastExportMessage?: string;
  // WhatsApp Business Cloud API Configuration (Secure, token kept server-side only)
  whatsappEnabled?: boolean;
  whatsappPhoneNumberId?: string;
  whatsappAccessToken?: string;
  whatsappSimulateMode?: boolean;
  whatsappMaxRecipients?: number;
  hasWhatsappToken?: boolean;
}

export interface WhatsAppDispatch {
  id: string;
  requestId: string;
  patientName: string;
  bloodType: BloodType;
  donorId: string;
  donorName: string;
  donorPhone: string;
  donorDistrict: string;
  donorArea: string;
  distanceKm?: number;
  proximityLevel?: 'same_area' | 'same_district' | 'nearby_district' | 'governorate';
  status: 'sent' | 'delivered' | 'failed' | 'simulated' | 'skipped_duplicate';
  messageId?: string;
  errorMessage?: string;
  timestamp: string;
  reason?: string;
}

export interface ServerHealth {
  status: string;
  donorsCount: number;
  requestsCount: number;
  districtsCount: number;
  lastExport?: string;
}

export interface MasterSpreadsheetConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  sheetName: string;
  lastSyncedAt?: string;
  autoSyncEnabled: boolean;
  connectedEmail?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'urgent' | 'info' | 'campaign';
  isActive: boolean;
  createdAt: string;
  authorName?: string;
}

export interface HospitalAd {
  id: string;
  hospitalName: string;
  imageUrl: string;
  phone: string;
  address: string;
  websiteUrl?: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Hospital {
  id: string;
  name: string;
  imageUrl: string;
  description?: string;
  address?: string;
  phone?: string;
  displayOrder: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Doctor {
  id: string;
  hospitalId: string;
  fullName: string;
  specialty: string;
  imageUrl: string;
  bio?: string;
  phone?: string;
  displayOrder: number;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  docId?: string;
  action: 'add_donor' | 'edit_donor' | 'delete_donor' | 'delete_all_donors' | 'update_request' | 'delete_request' | 'create_announcement' | 'toggle_announcement' | 'delete_announcement' | 'create_hospital_ad' | 'update_hospital_ad' | 'delete_hospital_ad' | 'create_hospital' | 'update_hospital' | 'delete_hospital' | 'create_doctor' | 'update_doctor' | 'delete_doctor' | 'delete_user' | 'change_user_role' | 'admin_login' | 'export_excel' | 'send_verification_email';
  actionLabel: string;
  details: string;
  targetId?: string;
  targetName?: string;
  adminEmail?: string;
  adminName?: string;
  timestamp: string;
}

export interface FCMDeviceToken {
  id: string;
  token: string;
  platform: 'web' | 'android' | 'ios';
  bloodType?: BloodType | 'all';
  district?: string | 'all';
  criticalOnly?: boolean;
  enabled: boolean;
  userId?: string;
  userAgent?: string;
  updatedAt: string;
  createdAt?: string;
}

export interface AndroidUpdateConfig {
  versionCode: number;
  versionName: string;
  packageName: string;
  downloadUrl: string;
  sha256: string;
  fileSize: number;
  minSdkVersion: number;
  minUpgradeFromVersionCode: number;
  mandatory?: boolean;
  releaseNotes?: string;
  releasedAt?: string;
}

export interface WebUpdateConfig {
  versionCode: number;
  versionName: string;
  mandatory?: boolean;
  releaseNotes?: string;
  releasedAt?: string;
}

export interface AppUpdateConfig {
  enabled: boolean;
  android: AndroidUpdateConfig;
  web: WebUpdateConfig;
  updatedAt: string;
  updatedBy?: string;
}

export interface InstalledAppInfo {
  platform: 'android' | 'web';
  packageName: string;
  versionCode: number;
  versionName: string;
  sdkInt?: number;
  signingDigests?: string[];
  canRequestPackageInstalls?: boolean;
}

export type UpdateCompatibilityReasonCode =
  | 'UP_TO_DATE'
  | 'DISABLED'
  | 'PACKAGE_MISMATCH'
  | 'INCOMPATIBLE_SDK'
  | 'VERSION_NOT_SUPPORTED_FOR_UPGRADE'
  | 'INVALID_DOWNLOAD_URL'
  | 'MISSING_CHECKSUM';

export interface UpdateCompatibilityResult {
  compatible: boolean;
  updateAvailable: boolean;
  reasonCode?: UpdateCompatibilityReasonCode;
  reasonMessage?: string;
}

export type UpdateProgressPhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'permission_required'
  | 'downloading'
  | 'verifying'
  | 'ready_to_install'
  | 'installing'
  | 'error'
  | 'up_to_date';

export interface UpdateProgressState {
  phase: UpdateProgressPhase;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface UpdateCheckResult {
  checked: boolean;
  updateAvailable: boolean;
  compatible: boolean;
  platform: 'android' | 'web';
  installed: InstalledAppInfo;
  remoteConfig: AppUpdateConfig | null;
  compatibility: UpdateCompatibilityResult;
  swUpdateReady?: boolean;
  source?: 'server' | 'firestore' | 'service_worker' | 'none';
}



