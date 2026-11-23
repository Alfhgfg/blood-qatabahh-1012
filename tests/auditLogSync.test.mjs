import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocsFromServer, doc, deleteDoc, terminate } from 'firebase/firestore';
import {
  normalizeAuditLogDoc,
  sortAuditLogsNewestFirst,
  resolveAuditLogDocIds,
  chunkAuditLogDocIds
} from '../src/lib/auditLogUtils.js';

test('normalizeAuditLogDoc always uses genuine Firestore Document ID and ignores invalid docs', () => {
  const normalized = normalizeAuditLogDoc(
    {
      id: 'stale-legacy-field-id',
      action: 'delete_donor',
      actionLabel: 'حذف متبرع',
      details: 'تم حذف متبرع',
      timestamp: '2026-11-20T10:00:00.000Z'
    },
    'real-firestore-doc-id-123'
  );

  assert.ok(normalized);
  assert.equal(normalized.docId, 'real-firestore-doc-id-123');
  assert.equal(normalized.id, 'real-firestore-doc-id-123');
  assert.equal(normalizeAuditLogDoc(null, 'doc-1'), null);
  assert.equal(normalizeAuditLogDoc({ details: 'missing action' }, 'doc-2'), null);
});

test('sortAuditLogsNewestFirst deduplicates by real docId and orders newest first', () => {
  const logs = [
    normalizeAuditLogDoc({ action: 'admin_login', actionLabel: 'دخول', details: '1', timestamp: '2026-11-01T10:00:00Z' }, 'a1'),
    normalizeAuditLogDoc({ action: 'add_donor', actionLabel: 'إضافة', details: '2', timestamp: '2026-11-03T10:00:00Z' }, 'a2'),
    normalizeAuditLogDoc({ action: 'admin_login', actionLabel: 'دخول', details: '1-dup', timestamp: '2026-11-01T10:00:00Z' }, 'a1')
  ].filter(Boolean);

  const sorted = sortAuditLogsNewestFirst(logs);
  assert.equal(sorted.length, 2);
  assert.deepEqual(sorted.map((l) => l.docId), ['a2', 'a1']);
});

test('resolveAuditLogDocIds & chunkAuditLogDocIds extract unique Firestore doc IDs in safe batch chunks', () => {
  const ids = resolveAuditLogDocIds([
    { id: 'field-id-1', docId: 'real-doc-1' },
    'real-doc-1',
    { id: 'real-doc-2' },
    '',
    null
  ]);
  assert.deepEqual(ids, ['real-doc-1', 'real-doc-2']);

  const manyIds = Array.from({ length: 1000 }, (_, i) => `audit-${i}`);
  const chunks = chunkAuditLogDocIds(manyIds, 450);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 450);
  assert.equal(chunks[1].length, 450);
  assert.equal(chunks[2].length, 100);
});

test('firestoreService and codebase enforce real Firestore audit_logs deletion with zero tombstone or stale cache fallback', () => {
  const fsSource = fs.readFileSync(path.resolve('src/firebase/firestoreService.ts'), 'utf8');
  const storageSource = fs.readFileSync(path.resolve('src/services/storageService.ts'), 'utf8');
  assert.equal(fsSource.includes('markAuditLogsDeletedInSettings'), false);
  assert.equal(fsSource.includes('markAllAuditLogsClearedInSettings'), false);
  assert.equal(fsSource.includes('filterAndSortAuditLogs'), false);
  assert.equal(fsSource.includes('audit_logs_deleted'), false);
  assert.equal(storageSource.includes('audit_logs_deleted'), false);
  assert.equal(fsSource.includes('snap.metadata.fromCache'), true);
  assert.equal(fsSource.includes('getDocsFromServer(collection(db, path))'), true);
  assert.equal(fsSource.includes('chunkAuditLogDocIds(uniqueIds, 450)'), true);
  assert.equal(fsSource.includes('chunkAuditLogDocIds(targetIds, 450)'), true);
  assert.equal(fsSource.includes("batch.delete(doc(db, 'audit_logs', docId))"), true);
  assert.equal(fsSource.includes('handleFirestoreError(err, OperationType.DELETE'), true);
});

test('firestore.rules restricts audit_logs deletion exclusively to verified isCentralAdmin() with valid docId', () => {
  const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');
  assert.match(rules, /function isVerifiedCentralAdminEmail\(\)/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /function isCentralAdmin\(\)/);
  assert.match(rules, /match \/audit_logs\/\{logId\}[\s\S]*allow delete:\s*if isCentralAdmin\(\)\s*&&\s*isValidId\(logId\);/);
});

test('Live two-client Firestore audit_logs read parity and unauthorized delete protection', async () => {
  const cfg = JSON.parse(fs.readFileSync(path.resolve('firebase-applet-config.json'), 'utf8'));
  const appA = getApps().find((a) => a.name === 'audit-client-a') || initializeApp(cfg, 'audit-client-a');
  const appB = getApps().find((a) => a.name === 'audit-client-b') || initializeApp(cfg, 'audit-client-b');

  const dbA = getFirestore(appA, cfg.firestoreDatabaseId);
  const dbB = getFirestore(appB, cfg.firestoreDatabaseId);

  try {
    const [snapA, snapB] = await Promise.all([
      getDocsFromServer(collection(dbA, 'audit_logs')),
      getDocsFromServer(collection(dbB, 'audit_logs'))
    ]);

    const logsA = sortAuditLogsNewestFirst(
      snapA.docs.map((d) => normalizeAuditLogDoc(d.data(), d.id)).filter(Boolean)
    );
    const logsB = sortAuditLogsNewestFirst(
      snapB.docs.map((d) => normalizeAuditLogDoc(d.data(), d.id)).filter(Boolean)
    );

    assert.equal(logsA.length, logsB.length);
    assert.deepEqual(
      logsA.map((l) => l.docId),
      logsB.map((l) => l.docId)
    );

    // Confirm unauthenticated delete is strictly blocked by Firestore Security Rules
    if (logsA.length > 0) {
      const sampleDocId = logsA[0].docId;
      await assert.rejects(
        () => deleteDoc(doc(dbA, 'audit_logs', sampleDocId)),
        (err) => {
          const msg = String(err?.code || err?.message || '').toLowerCase();
          return msg.includes('permission') || msg.includes('insufficient');
        }
      );
    }
  } finally {
    await Promise.allSettled([terminate(dbA), terminate(dbB)]);
  }
});
