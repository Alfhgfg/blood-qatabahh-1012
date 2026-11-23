/**
 * Audit Log normalization, sorting, and real Firestore Document ID resolution.
 * Ensures every audit log entry carries its genuine Firestore Document ID (`docId`)
 * and prevents local/tombstone hiding from causing cross-device drift.
 */

export function normalizeAuditLogDoc(data, docId) {
  if (!data || typeof data !== 'object') return null;
  const realDocId = String(docId || data.docId || data.id || '').trim();
  if (!realDocId) return null;
  if (!data.action || typeof data.action !== 'string') return null;

  return {
    ...data,
    id: realDocId,
    docId: realDocId,
    action: String(data.action),
    actionLabel: String(data.actionLabel || data.action || ''),
    details: String(data.details || ''),
    timestamp: String(data.timestamp || '')
  };
}

export function sortAuditLogsNewestFirst(logs) {
  if (!Array.isArray(logs)) return [];
  const byDocId = new Map();

  for (const item of logs) {
    if (!item) continue;
    const realDocId = String(item.docId || item.id || '').trim();
    if (!realDocId) continue;
    byDocId.set(realDocId, {
      ...item,
      id: realDocId,
      docId: realDocId
    });
  }

  return Array.from(byDocId.values()).sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    return String(b.docId || b.id).localeCompare(String(a.docId || a.id));
  });
}

export function resolveAuditLogDocIds(logsOrIds) {
  if (!Array.isArray(logsOrIds)) return [];
  const unique = new Set();
  for (const item of logsOrIds) {
    if (!item) continue;
    const rawId =
      typeof item === 'string'
        ? item
        : String(item.docId || item.id || '').trim();
    const cleanId = String(rawId || '').trim();
    if (cleanId) {
      unique.add(cleanId);
    }
  }
  return Array.from(unique);
}

export function chunkAuditLogDocIds(docIds, batchSize = 450) {
  const safeIds = resolveAuditLogDocIds(docIds);
  const size = Math.max(1, Math.min(450, Number(batchSize) || 450));
  const chunks = [];
  for (let i = 0; i < safeIds.length; i += size) {
    chunks.push(safeIds.slice(i, i + size));
  }
  return chunks;
}
