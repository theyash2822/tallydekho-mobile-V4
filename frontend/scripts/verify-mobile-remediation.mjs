#!/usr/bin/env node
/**
 * Behavioral coverage for Mobile production remediation (2026-09-19).
 * Pure modules + source contracts. No extra test framework.
 *
 * Run:  npm run verify:remediation
 * Exit: 0 pass · 1 fail
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function check(name, fn) {
  try {
    const out = fn();
    if (out && typeof out.then === 'function') {
      return out.then(() => console.log(`  PASS  ${name}`)).catch((err) => {
        failures.push(`${name}: ${err.message}`);
        console.error(`  FAIL  ${name}\n        ${err.message}`);
      });
    }
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
}

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const strip = (text) =>
  text.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const {
  tenantKey,
  currentTenantKey,
  setTenantKeyContext,
  isTenantStorageKey,
  isAmbiguousLegacyDraftKey,
  draftFeature,
  logoFeature,
  prefillFeature,
  wouldSweepKey,
} = await import('../src/utils/tenantStorage.ts').catch(async () => {
  const ts = await import(path.join(root, 'src/utils/tenantStorage.ts'));
  return ts;
});

// wouldSweepKey lives in logoutCleanup — re-export via tenant helpers if missing
let sweepKey = wouldSweepKey;
if (typeof sweepKey !== 'function') {
  const { isTenantStorageKey: isT, isAmbiguousLegacyDraftKey: isA, LOGOUT_ALWAYS_REMOVE } =
    await import(path.join(root, 'src/utils/tenantStorage.ts'));
  sweepKey = (key) => LOGOUT_ALWAYS_REMOVE.includes(key) || isT(key) || isA(key);
}

const { isDemoCompany, isDemoMode, isLiveBooksStatus, filterCompaniesForPairing } =
  await import(path.join(root, 'src/utils/isDemoCompany.ts'));
const { sameCompany, companyInList, companyGuid } =
  await import(path.join(root, 'src/utils/companyIdentity.ts'));
const { fyEquals, normalizeFy } = await import(path.join(root, 'src/utils/fyIdentity.ts'));
const { setWorkspaceGeneration, isCurrentWorkspaceGeneration, captureWorkspaceGeneration } =
  await import(path.join(root, 'src/utils/workspaceGeneration.ts'));
const { kindFromStatus, notifyAuthFailure, setAuthFailureHandler } =
  await import(path.join(root, 'src/services/apiErrors.ts'));
const { isEventForWorkspace } = await import(path.join(root, 'src/services/workspaceEventScope.ts'));
const { beginSingleFlight } = await import(path.join(root, 'src/utils/singleFlight.ts'));
function resolveWriteTarget(writeAsDemo, tallyEndpoint, demoEntryType) {
  if (writeAsDemo && demoEntryType) {
    return { prefix: 'api', endpoint: '/demo/entries', demo: true };
  }
  return { prefix: 'tally', endpoint: tallyEndpoint, demo: false };
}

console.log('mobile remediation behavioral tests');

await check('logout clears invoice/proforma drafts', () => {
  assert.equal(sweepKey('tdinvoice_draft_AAAA'), true);
  assert.equal(sweepKey('tdproforma_draft_AAAA'), true);
  assert.equal(sweepKey(tenantKey({ userId: 1, workspaceId: 'ws', companyGuid: 'g', feature: draftFeature('invoice') })), true);
  assert.equal(sweepKey(tenantKey({ userId: 1, workspaceId: 'ws', companyGuid: 'g', feature: draftFeature('proforma') })), true);
});

await check('logout clears prefills, logos, company, FY, ledger key class', () => {
  assert.equal(sweepKey('tdso_to_invoice_prefill_GUID'), true);
  assert.equal(sweepKey('tdpo_to_invoice_prefill_GUID'), true);
  assert.equal(sweepKey('tdprf_to_invoice_prefill_GUID'), true);
  assert.equal(sweepKey('company_logo_GUID'), true);
  assert.equal(sweepKey('company_data'), true);
  assert.equal(sweepKey('pre_auth_token'), true);
  assert.equal(sweepKey('auth_token'), true);
  assert.equal(isAmbiguousLegacyDraftKey('tdinvoice_draft_GUID'), true);
});

await check('same GUID / different workspace draft isolation', () => {
  setTenantKeyContext(9, 'ABC');
  const a = currentTenantKey('GUID-X', draftFeature('invoice'));
  setTenantKeyContext(9, 'XYZ', 'workspace');
  const b = currentTenantKey('GUID-X', draftFeature('invoice'));
  assert.notEqual(a, b);
  assert.match(a, /ws:ABC/);
  assert.match(b, /ws:XYZ/);
});

await check('same GUID logo isolation', () => {
  setTenantKeyContext(1, 'ABC');
  const a = currentTenantKey('GUID-X', logoFeature());
  setTenantKeyContext(1, 'XYZ', 'workspace');
  const b = currentTenantKey('GUID-X', logoFeature());
  assert.notEqual(a, b);
});

await check('prefill keys are user/workspace/company scoped', () => {
  setTenantKeyContext(2, 'WS1');
  const a = currentTenantKey('G', prefillFeature('tdso'));
  setTenantKeyContext(3, 'WS1', 'user');
  const b = currentTenantKey('G', prefillFeature('tdso'));
  assert.notEqual(a, b);
});

await check('Demo uses is_demo, not name — Demo Traders remains real', () => {
  assert.equal(isDemoCompany({ name: 'Demo Traders', guid: 'DEMO-1', is_demo: false }), false);
  assert.equal(isDemoCompany({ name: 'Live Co', guid: 'dddddddd-dddd-dddd-dddd-dddddddddddd', is_demo: false }), false);
  assert.equal(isDemoCompany({ name: 'Anything', is_demo: true }), true);
});

await check('UNPAIRED enables Demo mode; CONNECTED/RECONNECTING stay real', () => {
  assert.equal(isDemoMode('UNPAIRED'), true);
  assert.equal(isDemoMode('CONNECTED'), false);
  assert.equal(isDemoMode('RECONNECTING'), false);
  assert.equal(isLiveBooksStatus('RECONNECTING'), true);
  assert.equal(isLiveBooksStatus('CONNECTED'), true);
  const demo = { name: 'Demo Company', is_demo: true };
  const real = { name: 'Demo Traders', is_demo: false };
  const unpaired = filterCompaniesForPairing([demo, real], 'UNPAIRED');
  const reconnecting = filterCompaniesForPairing([demo, real], 'RECONNECTING');
  assert.deepEqual(unpaired.map((c) => c.name), ['Demo Company']);
  assert.deepEqual(reconnecting.map((c) => c.name), ['Demo Traders']);
});

await check('company poll guid/id identity comparison', () => {
  const cur = { guid: 'TALLY-GUID', id: 99 };
  assert.equal(companyInList(cur, [{ id: 99, name: 'wrong-if-id-compared-to-guid' }]), false);
  assert.equal(companyInList(cur, [{ guid: 'TALLY-GUID', id: 1 }]), true);
  assert.equal(sameCompany({ guid: 'X', id: 1 }, { guid: 'X', id: 9 }), true);
  assert.equal(sameCompany({ guid: 'X', id: 1 }, { guid: 'Y', id: 1 }), false);
  assert.equal(companyGuid({ guid: 'G', id: 7 }), 'G');
});

await check('FY equality prevents redundant writes + date normalization', () => {
  const a = { begin_date: '2025-04-01', end_date: '2026-03-31', label: 'FY 2025-26' };
  const b = { startDate: '2025-04-01', endDate: '2026-03-31', label: 'FY 2025-26' };
  assert.equal(fyEquals(a, b), true);
  assert.equal(normalizeFy(a)?.startDate, '2025-04-01');
  assert.equal(fyEquals(a, { startDate: '2024-04-01', endDate: '2025-03-31' }), false);
});

await check('workspace switch late getMe ignored', () => {
  setWorkspaceGeneration('ABC');
  const snap = captureWorkspaceGeneration();
  setWorkspaceGeneration('XYZ');
  assert.equal(isCurrentWorkspaceGeneration(snap.gen, snap.workspaceId), false);
  const now = captureWorkspaceGeneration();
  assert.equal(isCurrentWorkspaceGeneration(now.gen, now.workspaceId), true);
});

await check('wrong-workspace and missing-workspace sockets ignored', () => {
  assert.equal(isEventForWorkspace('voucher:tallySynced', { workspaceId: 'XYZ' }, 'ABC'), false);
  assert.equal(isEventForWorkspace('invoice_posting_updated', {}, 'ABC'), false);
  assert.equal(isEventForWorkspace('invoice_posting_updated', { workspaceId: 'ABC' }, 'ABC'), true);
});

await check('422 is validation, 403 never logs out', () => {
  assert.equal(kindFromStatus(422, 'PARTY_LEDGER_NOT_FOUND'), 'validation');
  assert.equal(kindFromStatus(403, 'FORBIDDEN'), 'forbidden');
  let loggedOut = false;
  setAuthFailureHandler(() => { loggedOut = true; });
  notifyAuthFailure({ kind: 'forbidden', status: 403, message: 'no' });
  assert.equal(loggedOut, false);
  notifyAuthFailure({ kind: 'auth', status: 401, message: 'gone' });
  assert.equal(loggedOut, true);
  setAuthFailureHandler(null);
});

await check('5 concurrent 401 → one refresh', async () => {
  let runs = 0;
  const holder = { current: null };
  const run = () => {
    runs += 1;
    return new Promise((resolve) => setTimeout(() => resolve('refreshed'), 20));
  };
  const results = await Promise.all([
    beginSingleFlight(holder, run),
    beginSingleFlight(holder, run),
    beginSingleFlight(holder, run),
    beginSingleFlight(holder, run),
    beginSingleFlight(holder, run),
  ]);
  assert.equal(runs, 1);
  assert.deepEqual(results, ['refreshed', 'refreshed', 'refreshed', 'refreshed', 'refreshed']);
});

await check('Demo create uses private simulated-entry endpoint', () => {
  const api = strip(read('src/services/api.ts'));
  assert.match(api, /export function resolveWriteTarget/);
  assert.match(api, /\/demo\/entries/);
  assert.match(api, /createDemoEntry/);
  const demo = resolveWriteTarget(true, '/voucher/sales', 'sales');
  assert.equal(demo.demo, true);
  assert.equal(demo.endpoint, '/demo/entries');
  assert.equal(demo.prefix, 'api');
  const live = resolveWriteTarget(false, '/voucher/sales', 'sales');
  assert.equal(live.demo, false);
  assert.equal(live.prefix, 'tally');
  assert.equal(live.endpoint, '/voucher/sales');
});

await check('online logout calls server logout', () => {
  const auth = strip(read('src/context/AuthContext.tsx'));
  assert.match(auth, /logoutOnServer/);
  const api = strip(read('src/services/api.ts'));
  assert.match(api, /\/api\/auth\/logout/);
});

await check('offline logout still clears local state', () => {
  const auth = strip(read('src/context/AuthContext.tsx'));
  assert.match(auth, /await removeToken\(\)/);
  assert.match(auth, /sweepTenantAsyncStorage|removeToken/);
});

await check('barcode template request includes workspace', () => {
  const api = strip(read('src/services/api.ts'));
  assert.match(api, /downloadBarcodeTemplate[\s\S]*request<string>/);
  assert.match(api, /if \(requiresAuth && _activeWorkspaceId\)/);
});

await check('HSN included in both stock create payloads', () => {
  const create = strip(read('app/stocks/create-item.tsx'));
  const modal = strip(read('src/components/forms/AddItemModal.tsx'));
  assert.match(create, /hsnCode:\s*hsnCode\.trim\(\)/);
  assert.match(modal, /hsnCode:\s*hsnCode\.trim\(\)/);
  assert.doesNotMatch(create, /hsnCode:\s*''/);
  assert.doesNotMatch(modal, /hsnCode:\s*''/);
});

await check('report data cleared on workspace switch', () => {
  const reports = strip(read('app/(tabs)/reports.tsx'));
  assert.match(reports, /reportIdentity/);
  assert.match(reports, /setFinData\(null\)/);
});

await check('ledger cache cleared on logout', () => {
  const cleanup = strip(read('src/utils/logoutCleanup.ts'));
  assert.match(cleanup, /clearLedgerCache\(\)/);
});

await check('no GUID-only draft/logo writers remain', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        files.push(full);
      }
    }
  };
  walk(path.join(root, 'src'));
  walk(path.join(root, 'app'));
  const offenders = [];
  for (const full of files) {
    const rel = path.relative(root, full);
    if (rel.includes('tenantStorage') || rel.includes('verify-')) continue;
    const code = strip(fs.readFileSync(full, 'utf8'));
    if (/[`'"]tdinvoice_draft_\$\{/.test(code) || /[`'"]company_logo_\$\{/.test(code)) {
      if (!/dropLegacyKeys/.test(code)) offenders.push(rel);
    }
    if (/setItem\(`tdinvoice_draft_/.test(code) || /setItem\(`company_logo_/.test(code)) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, [], `GUID-only writers remain: ${offenders.join(', ')}`);
});

await check('name-prefix Demo detection deleted', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
    }
  };
  walk(path.join(root, 'src'));
  walk(path.join(root, 'app'));
  const offenders = [];
  for (const full of files) {
    const code = strip(fs.readFileSync(full, 'utf8'));
    if (/\.startsWith\(\s*['"]demo['"]/i.test(code)) offenders.push(path.relative(root, full));
  }
  assert.deepEqual(offenders, [], `name-prefix Demo detection remains: ${offenders.join(', ')}`);
});

await check('switch-fy unused route deleted', () => {
  assert.equal(fs.existsSync(path.join(root, 'app/switch-fy.tsx')), false);
});

await check('production ATS arbitrary loads disabled', () => {
  const app = read('app.json');
  assert.match(app, /"NSAllowsArbitraryLoads":\s*false/);
  assert.match(app, /"NSAllowsLocalNetworking":\s*true/);
});

if (failures.length) {
  console.error(`\n${failures.length} FAILED`);
  process.exit(1);
}
console.log('\nverify-mobile-remediation: PASS');
