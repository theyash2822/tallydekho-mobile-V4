#!/usr/bin/env node
/**
 * Behaviour: a screen built from responses of different data revisions mixes data from before
 * and after a sync. An older response is fetched again once; a newer revision refreshes screens;
 * approvals show companies, years and any identity replacement; cancelled vouchers say so.
 *
 * Run:  npm run verify:data-revision
 * Exit: 0 pass · 1 fail
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  noteRevision, onNewerRevision, companyGuidOf, parseRevision, resetDataRevisions, isFreshSync,
} from '../src/services/dataRevision.ts';

const failures = [];
async function check(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
}
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

await check('revisions are classified per workspace and company', () => {
  resetDataRevisions();
  assert.equal(noteRevision('w', 'g', 5), 'first');
  assert.equal(noteRevision('w', 'g', 5), 'same');
  assert.equal(noteRevision('w', 'g', 4), 'older');
  assert.equal(noteRevision('w', 'g', 6), 'newer');
  assert.equal(noteRevision('w2', 'g', 1), 'first');
  assert.equal(noteRevision('w', 'g', null), 'same');
  assert.equal(parseRevision('x'), null);
  assert.equal(parseRevision('3'), 3);
});

await check('listeners hear newer revisions only, never silent ones', () => {
  resetDataRevisions();
  const heard = [];
  const off = onNewerRevision((e) => heard.push(e.revision));
  noteRevision('w', 'g', 1);
  noteRevision('w', 'g', 2);
  noteRevision('w', 'g', 3, { silent: true });
  noteRevision('w', 'g', 1);
  off();
  noteRevision('w', 'g', 10);
  assert.deepEqual(heard, [2]);
});

await check('companyGuid is read from the endpoint', () => {
  assert.equal(companyGuidOf('/ledgers?companyGuid=abc&fy=2025-2026'), 'abc');
  assert.equal(companyGuidOf('/ledgers'), null);
});

await check('api GETs retry an older response once and synced records the revision', () => {
  const api = read('src/services/api.ts');
  assert.match(api, /noteRevision\(_activeWorkspaceId, revisionCompany, res\.headers\?\.get\?\.\(DATA_REVISION_HEADER\)\)/);
  assert.match(api, /outcome === 'older' && allowRevisionRetry/);
  assert.match(api, /responseType, timeoutMs, false\)/);
  const sock = read('src/services/socketService.ts');
  assert.match(sock, /noteRevision\(getActiveWorkspaceId\(\), payload\?\.companyGuid, payload\?\.revision, \{ silent: true \}\)/);
  assert.match(sock, /onNewerRevision\(/);
});

await check('approvals show companies, years and identity replacement', () => {
  const src = read('src/components/requests/ApprovalsList.tsx');
  assert.match(src, /r\.scope\?\.companies/);
  assert.match(src, /r\.scope\?\.replacement/);
});

await check('cancelled vouchers are labelled Cancelled, not Unpaid', () => {
  for (const p of ['app/sales/register.tsx', 'app/purchase/register.tsx']) {
    const src = read(p);
    assert.doesNotMatch(src, /is_cancelled \? 'unpaid'/, p);
    assert.match(src, /is_cancelled \? 'cancelled'/, p);
  }
  assert.match(read('src/components/VoucherListTile.tsx'), /cancelled: 'Cancelled'/);
  assert.match(read('src/components/document/VoucherPreviewScreen.tsx'), /raw\?\.is_cancelled === true/);
});

await check('registers request cancelled vouchers but leave them out of totals and counts', () => {
  for (const p of ['app/sales/register.tsx', 'app/purchase/register.tsx']) {
    const src = read(p);
    assert.equal((src.match(/includeCancelled: '1'/g) || []).length, 2, p);
    assert.match(src, /const counted = allFiltered\.filter\(\(inv\) => inv\.status !== 'cancelled'\)/, p);
    assert.match(src, /value: String\(counted\.length\)/, p);
  }
});

await check('a synced event refreshes once per new revision and never for a no-change sync', () => {
  resetDataRevisions();
  noteRevision('w', 'g', 4);
  assert.equal(isFreshSync({ revision: 5 }, noteRevision('w', 'g', 5, { silent: true })), true);
  assert.equal(isFreshSync({ revision: 5 }, noteRevision('w', 'g', 5, { silent: true })), false);
  assert.equal(isFreshSync({ revision: 5, changed: false }, 'same'), false);
  assert.equal(isFreshSync({}, 'same'), true, 'older servers without a revision still refresh');
  assert.equal(isFreshSync({ reason: 'companies_removed', changed: false }, 'same'), true);
});

await check('heartbeats (device last_seen) no longer refresh screens; the revision probe does', () => {
  const auth = read('src/context/AuthContext.tsx');
  assert.doesNotMatch(auth, /deviceLastSeen/);
  assert.match(auth, /getCompanyYears\(guid\)/);
  assert.match(auth, /AppState\.addEventListener\('change'/);
  const socket = read('src/services/socketService.ts');
  assert.match(socket, /if \(fresh\) onSyncedCallback\?\.\(payload\?\.companyGuid\)/);
  assert.match(socket, /status === 'CONNECTED' && previous !== 'CONNECTED'/);
});

if (failures.length) {
  console.error(`\n${failures.length} failing`);
  process.exit(1);
}
console.log('\nall data-revision checks passed');
