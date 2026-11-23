import { AuditLog } from '../types';

export function normalizeAuditLogDoc(
  data: Record<string, any> | null | undefined,
  docId?: string
): AuditLog | null;

export function sortAuditLogsNewestFirst(logs: AuditLog[]): AuditLog[];

export function resolveAuditLogDocIds(
  logsOrIds: Array<string | Pick<AuditLog, 'id' | 'docId'>>
): string[];

export function chunkAuditLogDocIds(docIds: string[], batchSize?: number): string[][];
