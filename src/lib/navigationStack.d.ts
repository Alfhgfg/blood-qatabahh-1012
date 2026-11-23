import type { ActivePage, UserRole } from '../types';

export interface NavEntry {
  key: string;
  page: ActivePage;
  hospitalAdId?: string | null;
  hospitalId?: string | null;
}

export interface NavOptions {
  key?: string;
  hospitalAdId?: string | null;
  hospitalId?: string | null;
}

export interface InitialNavOptions {
  userRole?: UserRole;
  hospitalAdId?: string | null;
  hospitalId?: string | null;
}

export interface PushNavResult {
  stack: NavEntry[];
  changed: boolean;
  current: NavEntry;
  previous?: NavEntry | null;
}

export interface PopNavResult {
  stack: NavEntry[];
  popped: NavEntry | null;
  current: NavEntry | null;
  canGoBack: boolean;
}

export const VALID_ACTIVE_PAGES: readonly ActivePage[];
export function isValidActivePage(page: unknown): page is ActivePage;
export function createNavEntry(page: ActivePage, options?: NavOptions): NavEntry;
export function isSameNavTarget(
  entry: NavEntry | null | undefined,
  targetPage: ActivePage,
  options?: NavOptions
): boolean;
export function pushNavEntry(
  stack: NavEntry[],
  targetPage: ActivePage,
  options?: NavOptions
): PushNavResult;
export function popNavEntry(stack: NavEntry[]): PopNavResult;
export function resetNavStack(initialPage?: ActivePage, options?: NavOptions): NavEntry[];
export function buildInitialNavStack(
  initialPage?: ActivePage,
  options?: InitialNavOptions
): NavEntry[];
export function sanitizeRestoredStack(candidateStack: unknown): NavEntry[] | null;
