export function normalizeUserRecord(raw, docId = '') {
  if (!raw || typeof raw !== 'object') return null;
  const resolvedId = String(raw.id || docId || '').trim();
  if (!resolvedId) return null;

  return {
    ...raw,
    id: resolvedId,
    username: typeof raw.username === 'string' ? raw.username : String(raw.username || ''),
    fullName: typeof raw.fullName === 'string' ? raw.fullName : String(raw.fullName || ''),
    phone: typeof raw.phone === 'string' ? raw.phone : String(raw.phone || ''),
    role: raw.role === 'admin' ? 'admin' : 'user',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : String(raw.createdAt || '')
  };
}

export function isDeletedUser(user) {
  if (!user || typeof user !== 'object') return false;
  return user.deleted === true || user.status === 'deleted';
}

export function isDisabledUser(user) {
  if (!user || typeof user !== 'object') return false;
  return user.disabled === true || user.isActive === false || user.status === 'disabled';
}

function normalizePhoneForDiagnostic(phone) {
  if (!phone) return '';
  let clean = String(phone).replace(/[\s\-\(\)\.]+/g, '');
  if (clean.startsWith('+967')) clean = clean.substring(4);
  if (clean.startsWith('00967')) clean = clean.substring(5);
  if (clean.startsWith('967')) clean = clean.substring(3);
  if (clean.startsWith('0') && clean.length === 10) clean = clean.substring(1);
  return clean.trim();
}

/**
 * Unified user directory normalizer & counter shared across Web Admin,
 * Express backend, and Mobile client so total registered user counts always match.
 */
export function summarizeUsersDirectory(rawUsers = []) {
  const list = Array.isArray(rawUsers) ? rawUsers : [];
  const rawRecordsCount = list.length;

  const uniqueByIdMap = new Map();
  for (const item of list) {
    const normalized = normalizeUserRecord(item, item?.docId || item?.id || '');
    if (!normalized) continue;
    const existing = uniqueByIdMap.get(normalized.id);
    if (!existing) {
      uniqueByIdMap.set(normalized.id, normalized);
    } else {
      uniqueByIdMap.set(normalized.id, { ...existing, ...normalized });
    }
  }

  const uniqueUsers = Array.from(uniqueByIdMap.values());
  const deletedUsers = [];
  const disabledUsers = [];
  const activeUsers = [];

  for (const user of uniqueUsers) {
    if (isDeletedUser(user)) {
      deletedUsers.push(user);
    } else if (isDisabledUser(user)) {
      disabledUsers.push(user);
    } else {
      activeUsers.push(user);
    }
  }

  activeUsers.sort((a, b) => {
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tB - tA;
  });

  const phoneCounts = new Map();
  const usernameCounts = new Map();
  for (const u of activeUsers) {
    const p = normalizePhoneForDiagnostic(u.phone);
    if (p) phoneCounts.set(p, (phoneCounts.get(p) || 0) + 1);
    const uname = String(u.username || '').trim().toLowerCase();
    if (uname) usernameCounts.set(uname, (usernameCounts.get(uname) || 0) + 1);
  }

  let duplicatePhoneUsersCount = 0;
  for (const count of phoneCounts.values()) {
    if (count > 1) duplicatePhoneUsersCount += count - 1;
  }

  let duplicateUsernameUsersCount = 0;
  for (const count of usernameCounts.values()) {
    if (count > 1) duplicateUsernameUsersCount += count - 1;
  }

  const adminCount = activeUsers.filter((u) => u.role === 'admin').length;
  const standardUserCount = activeUsers.length - adminCount;

  return {
    rawRecordsCount,
    uniqueRecordsCount: uniqueUsers.length,
    totalRegisteredUsers: activeUsers.length,
    activeUsers,
    disabledUsers,
    deletedUsers,
    disabledCount: disabledUsers.length,
    deletedCount: deletedUsers.length,
    adminCount,
    standardUserCount,
    duplicatePhoneUsersCount,
    duplicateUsernameUsersCount
  };
}
