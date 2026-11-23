import type { UserAccount } from '../types';

export interface UserDirectorySummary {
  rawRecordsCount: number;
  uniqueRecordsCount: number;
  totalRegisteredUsers: number;
  activeUsers: UserAccount[];
  disabledUsers: UserAccount[];
  deletedUsers: UserAccount[];
  disabledCount: number;
  deletedCount: number;
  adminCount: number;
  standardUserCount: number;
  duplicatePhoneUsersCount: number;
  duplicateUsernameUsersCount: number;
}

export function normalizeUserRecord(
  raw: Record<string, unknown> | null | undefined,
  docId?: string
): UserAccount | null;

export function isDeletedUser(user: UserAccount | Record<string, unknown> | null | undefined): boolean;

export function isDisabledUser(user: UserAccount | Record<string, unknown> | null | undefined): boolean;

export function summarizeUsersDirectory(
  rawUsers: Array<UserAccount | Record<string, unknown>>
): UserDirectorySummary;
