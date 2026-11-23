import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocsFromServer } from 'firebase/firestore';
import {
  normalizeUserRecord,
  summarizeUsersDirectory
} from '../src/lib/userDirectoryUtils.js';

test('summarizeUsersDirectory deduplicates by canonical ID, classifies disabled/deleted, and preserves distinct accounts', () => {
  const sample = [
    { id: 'u1', username: 'ahmed', fullName: 'أحمد علي', phone: '771111111', role: 'user', createdAt: '2026-10-01T00:00:00Z' },
    { id: 'u1', username: 'ahmed', fullName: 'أحمد علي', phone: '771111111', role: 'user', createdAt: '2026-10-01T00:00:00Z' },
    { id: 'u2', username: 'sara', fullName: 'سارة حسن', phone: '772222222', role: 'admin', createdAt: '2026-10-02T00:00:00Z' },
    { id: 'u3', username: 'disabled1', fullName: 'حساب معطل', phone: '773333333', role: 'user', disabled: true, createdAt: '2026-10-03T00:00:00Z' },
    { id: 'u4', username: 'deleted1', fullName: 'حساب محذوف', phone: '774444444', role: 'user', deleted: true, createdAt: '2026-10-04T00:00:00Z' },
    { docId: 'u5', username: 'salem', fullName: 'سالم صالح', phone: '775555555', role: 'user', createdAt: '2026-10-05T00:00:00Z' }
  ];

  const summary = summarizeUsersDirectory(sample);
  assert.equal(summary.rawRecordsCount, 6);
  assert.equal(summary.uniqueRecordsCount, 5);
  assert.equal(summary.totalRegisteredUsers, 3);
  assert.equal(summary.disabledCount, 1);
  assert.equal(summary.deletedCount, 1);
  assert.equal(summary.adminCount, 1);
  assert.equal(summary.standardUserCount, 2);
  assert.deepEqual(summary.activeUsers.map((u) => u.id), ['u5', 'u2', 'u1']);
});

test('Live Firestore users count matches Express GET /api/admin/users with Cache-Control no-store', async () => {
  const cfg = JSON.parse(fs.readFileSync(path.resolve('firebase-applet-config.json'), 'utf8'));
  const app = getApps().length === 0 ? initializeApp(cfg, 'user-count-test') : getApps()[0];
  const db = getFirestore(app, cfg.firestoreDatabaseId);

  const snap = await getDocsFromServer(collection(db, 'users'));
  const firestoreRaw = [];
  snap.forEach((d) => {
    const normalized = normalizeUserRecord(d.data(), d.id);
    if (normalized) firestoreRaw.push(normalized);
  });
  const firestoreSummary = summarizeUsersDirectory(firestoreRaw);

  const testPort = 3209;
  const baseUrl = `http://127.0.0.1:${testPort}`;
  const serverProc = spawn('node', ['server.js', '--port', String(testPort), '--host', '127.0.0.1'], {
    env: { ...process.env, NODE_ENV: 'production', PORT: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const waitForReady = async () => {
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`${baseUrl}/api/health`);
        if (res.ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error('Test server failed to become ready');
  };

  try {
    await waitForReady();
    const res = await fetch(`${baseUrl}/api/admin/users`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('cache-control') || '', /no-store/i);

    const apiUsers = await res.json();
    assert.ok(Array.isArray(apiUsers));
    assert.equal(apiUsers.length, firestoreSummary.totalRegisteredUsers);
    assert.deepEqual(
      apiUsers.map((u) => u.id).sort(),
      firestoreSummary.activeUsers.map((u) => u.id).sort()
    );
    // Ensure password fields are never leaked
    for (const u of apiUsers) {
      assert.equal('password' in u, false);
      assert.equal('passwordHash' in u, false);
    }
  } finally {
    serverProc.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 300));
  }
});
