const MAX_HISTORY_LENGTH = 30;

export const VALID_ACTIVE_PAGES = [
  'home',
  'donors',
  'requests',
  'info',
  'admin',
  'districts',
  'profile',
  'history',
  'about',
  'contact',
  'settings',
  'hospital-ad',
  'hospitals',
  'hospital-doctors'
];

const VALID_ACTIVE_PAGE_SET = new Set(VALID_ACTIVE_PAGES);

export function isValidActivePage(page) {
  return typeof page === 'string' && VALID_ACTIVE_PAGE_SET.has(page);
}

let entrySequence = 0;

function generateEntryKey(page) {
  entrySequence += 1;
  return `nav-${page}-${Date.now()}-${entrySequence}`;
}

export function createNavEntry(page, options = {}) {
  const safePage = isValidActivePage(page) ? page : 'home';
  return {
    key: options.key || generateEntryKey(safePage),
    page: safePage,
    hospitalAdId: options.hospitalAdId ?? null,
    hospitalId: options.hospitalId ?? null
  };
}

export function isSameNavTarget(entry, targetPage, options = {}) {
  if (!entry || entry.page !== targetPage) return false;
  if (targetPage === 'hospital-ad') {
    return (entry.hospitalAdId ?? null) === (options.hospitalAdId ?? null);
  }
  if (targetPage === 'hospital-doctors') {
    return (entry.hospitalId ?? null) === (options.hospitalId ?? null);
  }
  return true;
}

export function pushNavEntry(stack, targetPage, options = {}) {
  const safeStack =
    Array.isArray(stack) && stack.length > 0 ? stack : [createNavEntry('home')];
  const current = safeStack[safeStack.length - 1];

  if (!isValidActivePage(targetPage)) {
    return {
      stack: safeStack,
      changed: false,
      current,
      previous: safeStack.length > 1 ? safeStack[safeStack.length - 2] : null
    };
  }

  if (isSameNavTarget(current, targetPage, options)) {
    return {
      stack: safeStack,
      changed: false,
      current,
      previous: safeStack.length > 1 ? safeStack[safeStack.length - 2] : null
    };
  }

  const nextEntry = createNavEntry(targetPage, options);
  const combined = [...safeStack, nextEntry];
  const trimmed =
    combined.length > MAX_HISTORY_LENGTH
      ? combined.slice(combined.length - MAX_HISTORY_LENGTH)
      : combined;

  return {
    stack: trimmed,
    changed: true,
    current: nextEntry,
    previous: current
  };
}

export function popNavEntry(stack) {
  if (!Array.isArray(stack) || stack.length <= 1) {
    const current = Array.isArray(stack) && stack.length === 1 ? stack[0] : createNavEntry('home');
    return {
      stack: [current],
      popped: null,
      current,
      canGoBack: false
    };
  }

  const popped = stack[stack.length - 1];
  const nextStack = stack.slice(0, stack.length - 1);
  return {
    stack: nextStack,
    popped,
    current: nextStack[nextStack.length - 1],
    canGoBack: true
  };
}

export function resetNavStack(initialPage = 'home', options = {}) {
  const safePage = isValidActivePage(initialPage) ? initialPage : 'home';
  return [createNavEntry(safePage, options)];
}

export function buildInitialNavStack(initialPage = 'home', options = {}) {
  const userRole = options.userRole === 'admin' ? 'admin' : 'user';
  const safePage = isValidActivePage(initialPage) ? initialPage : 'home';
  const baseRoot = userRole === 'admin' ? 'admin' : 'home';

  if (safePage === 'home') {
    return [createNavEntry('home')];
  }

  if ((safePage === 'admin' || safePage === 'districts') && userRole !== 'admin') {
    return [createNavEntry('home')];
  }

  if (safePage === baseRoot) {
    return [createNavEntry(baseRoot)];
  }

  if (safePage === 'hospital-ad') {
    if (!options.hospitalAdId) {
      return [createNavEntry(baseRoot)];
    }
    return [
      createNavEntry(baseRoot),
      createNavEntry('hospital-ad', { hospitalAdId: options.hospitalAdId })
    ];
  }

  if (safePage === 'hospital-doctors') {
    if (!options.hospitalId) {
      return [createNavEntry(baseRoot), createNavEntry('hospitals')];
    }
    return [
      createNavEntry(baseRoot),
      createNavEntry('hospitals'),
      createNavEntry('hospital-doctors', { hospitalId: options.hospitalId })
    ];
  }

  return [createNavEntry(baseRoot), createNavEntry(safePage)];
}

export function sanitizeRestoredStack(candidateStack) {
  if (!Array.isArray(candidateStack) || candidateStack.length === 0) {
    return null;
  }

  const normalized = [];
  for (const item of candidateStack) {
    if (!item || typeof item !== 'object' || !isValidActivePage(item.page)) {
      return null;
    }
    normalized.push(
      createNavEntry(item.page, {
        key: typeof item.key === 'string' && item.key ? item.key : undefined,
        hospitalAdId: typeof item.hospitalAdId === 'string' ? item.hospitalAdId : null,
        hospitalId: typeof item.hospitalId === 'string' ? item.hospitalId : null
      })
    );
  }

  return normalized.length > MAX_HISTORY_LENGTH
    ? normalized.slice(normalized.length - MAX_HISTORY_LENGTH)
    : normalized;
}
