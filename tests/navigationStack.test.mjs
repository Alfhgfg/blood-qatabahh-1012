import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  VALID_ACTIVE_PAGES,
  isValidActivePage,
  createNavEntry,
  pushNavEntry,
  popNavEntry,
  resetNavStack,
  buildInitialNavStack,
  sanitizeRestoredStack
} from '../src/lib/navigationStack.js';

test('Header component does not render any back arrow button or accept back button props', () => {
  const headerSource = fs.readFileSync(path.resolve('src/components/Header.tsx'), 'utf8');
  assert.equal(headerSource.includes('header-back-button'), false);
  assert.equal(headerSource.includes('ArrowRight'), false);
  assert.equal(headerSource.includes('canGoBack'), false);
  assert.equal(headerSource.includes('onGoBack'), false);

  const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  assert.equal(/<Header[\s\S]*?(canGoBack|onGoBack)/.test(appSource), false);
});

test('Multi-step Navigation Stack pushes subpages and pops step-by-step back to home', () => {
  let stack = resetNavStack('home');
  assert.equal(stack.length, 1);
  assert.equal(stack[0].page, 'home');

  // Home -> Hospitals -> Hospital Doctors -> Settings
  const step1 = pushNavEntry(stack, 'hospitals');
  assert.equal(step1.changed, true);
  stack = step1.stack;

  const step2 = pushNavEntry(stack, 'hospital-doctors', { hospitalId: 'hosp-1' });
  assert.equal(step2.changed, true);
  assert.equal(step2.current.hospitalId, 'hosp-1');
  stack = step2.stack;

  const step3 = pushNavEntry(stack, 'settings');
  assert.equal(step3.changed, true);
  stack = step3.stack;

  assert.deepEqual(
    stack.map((e) => e.page),
    ['home', 'hospitals', 'hospital-doctors', 'settings']
  );

  // Back 1: settings -> hospital-doctors (preserving hosp-1)
  const pop1 = popNavEntry(stack);
  assert.equal(pop1.canGoBack, true);
  assert.equal(pop1.current.page, 'hospital-doctors');
  assert.equal(pop1.current.hospitalId, 'hosp-1');
  stack = pop1.stack;

  // Back 2: hospital-doctors -> hospitals
  const pop2 = popNavEntry(stack);
  assert.equal(pop2.canGoBack, true);
  assert.equal(pop2.current.page, 'hospitals');
  stack = pop2.stack;

  // Back 3: hospitals -> home
  const pop3 = popNavEntry(stack);
  assert.equal(pop3.canGoBack, true);
  assert.equal(pop3.current.page, 'home');
  stack = pop3.stack;

  // Back 4 on home -> natural app exit (canGoBack: false)
  const pop4 = popNavEntry(stack);
  assert.equal(pop4.canGoBack, false);
  assert.equal(pop4.current.page, 'home');
  assert.equal(pop4.stack.length, 1);
});

test('Consecutive duplicate targets do not create duplicate stack entries, while returning later preserves full trail', () => {
  let stack = resetNavStack('home');
  stack = pushNavEntry(stack, 'donors').stack;
  const dup = pushNavEntry(stack, 'donors');
  assert.equal(dup.changed, false);
  assert.equal(dup.stack.length, 2);

  // Hospital-doctors with a different hospitalId IS pushed as a distinct entry
  stack = pushNavEntry(stack, 'hospital-doctors', { hospitalId: 'h1' }).stack;
  const diffHospital = pushNavEntry(stack, 'hospital-doctors', { hospitalId: 'h2' });
  assert.equal(diffHospital.changed, true);
  assert.equal(diffHospital.stack.length, 4);

  const backToH1 = popNavEntry(diffHospital.stack);
  assert.equal(backToH1.current.hospitalId, 'h1');
});

test('buildInitialNavStack seeds proper root hierarchy for restored subpages and stays length 1 on home', () => {
  const homeInit = buildInitialNavStack('home', { userRole: 'user' });
  assert.deepEqual(homeInit.map((e) => e.page), ['home']);

  const donorsInit = buildInitialNavStack('donors', { userRole: 'user' });
  assert.deepEqual(donorsInit.map((e) => e.page), ['home', 'donors']);

  const docsInit = buildInitialNavStack('hospital-doctors', {
    userRole: 'user',
    hospitalId: 'h99'
  });
  assert.deepEqual(docsInit.map((e) => e.page), ['home', 'hospitals', 'hospital-doctors']);
  assert.equal(docsInit[2].hospitalId, 'h99');

  // Missing hospitalId falls back cleanly to hospitals list instead of broken detail page
  const docsMissingId = buildInitialNavStack('hospital-doctors', { userRole: 'user' });
  assert.deepEqual(docsMissingId.map((e) => e.page), ['home', 'hospitals']);

  // Non-admin user cannot boot into admin or districts
  const nonAdminAdmin = buildInitialNavStack('admin', { userRole: 'user' });
  assert.deepEqual(nonAdminAdmin.map((e) => e.page), ['home']);

  // Admin booting into districts gets admin beneath districts
  const adminDistricts = buildInitialNavStack('districts', { userRole: 'admin' });
  assert.deepEqual(adminDistricts.map((e) => e.page), ['admin', 'districts']);
});

test('Invalid / non-existent pages are blocked everywhere', () => {
  assert.equal(isValidActivePage('donors'), true);
  assert.equal(isValidActivePage('non-existent-route'), false);
  assert.equal(VALID_ACTIVE_PAGES.includes('hospitals'), true);

  const base = resetNavStack('home');
  const blocked = pushNavEntry(base, /** @type {any} */ ('does-not-exist'));
  assert.equal(blocked.changed, false);
  assert.deepEqual(blocked.stack.map((e) => e.page), ['home']);

  assert.equal(sanitizeRestoredStack([{ key: 'k1', page: 'bad-page' }]), null);
  const validRestored = sanitizeRestoredStack([
    createNavEntry('home', { key: 'k1' }),
    createNavEntry('requests', { key: 'k2' })
  ]);
  assert.ok(validRestored);
  assert.deepEqual(validRestored.map((e) => e.page), ['home', 'requests']);
});
