#!/usr/bin/env node
/**
 * Behaviour: a desktop removal closes forms, returns Home and says "Data has been
 * refreshed" ("No data available" when nothing is left). An ordinary sync does not.
 *
 * Run:  npm run verify:scope-refresh
 * Exit: 0 pass · 1 fail
 */
import assert from 'node:assert/strict';
import {
  isRemovalSync, onScopeRemoved, notifyScopeRemoved, handleScopeRemoved, heldEntriesNote, formatDeadline, isWorkspaceDraftKey,
  DATA_REFRESHED_MESSAGE, NO_DATA_MESSAGE,
} from '../src/services/scopeRefresh.ts';

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

function recorder(companies) {
  const calls = [];
  return {
    calls,
    deps: {
      closeForms: () => calls.push('close'),
      goHome: () => calls.push('home'),
      loadCompanies: async () => { calls.push('load'); if (companies instanceof Error) throw companies; return companies; },
      toast: (m) => calls.push(`toast:${m}`),
    },
  };
}

await check('only a removal sync is treated as a removal', () => {
  assert.equal(isRemovalSync({ reason: 'companies_removed', removedGuids: ['c1'] }), true);
  assert.equal(isRemovalSync({ companyGuid: 'c1', syncedAt: 'now' }), false);
  assert.equal(isRemovalSync(null), false);
});

await check('forms close, their drafts go, and Home opens before the refreshed message', async () => {
  const r = recorder([{ guid: 'c2' }]);
  const message = await handleScopeRemoved({ ...r.deps, clearDrafts: async () => { r.calls.push('drafts'); } });
  assert.equal(message, DATA_REFRESHED_MESSAGE);
  assert.deepEqual(r.calls, ['close', 'drafts', 'home', 'load', `toast:${DATA_REFRESHED_MESSAGE}`]);
});

await check('only drafts of the affected workspace are cleared', () => {
  assert.equal(isWorkspaceDraftKey('td:u:7:ws:W1:co:C1:invoice_draft', 'W1'), true);
  assert.equal(isWorkspaceDraftKey('td:u:7:ws:W1:co:C1:proforma_draft', 'W1'), true);
  assert.equal(isWorkspaceDraftKey('td:u:7:ws:W2:co:C1:invoice_draft', 'W1'), false);
  assert.equal(isWorkspaceDraftKey('td:u:7:ws:W1:co:C1:company_logo', 'W1'), false);
  assert.equal(isWorkspaceDraftKey('td:u:7:ws:W1:co:C1:invoice_draft', null), false);
});

await check('nothing left (or the reload fails) says "No data available"', async () => {
  const empty = recorder([]);
  assert.equal(await handleScopeRemoved(empty.deps), NO_DATA_MESSAGE);
  const failed = recorder(new Error('offline'));
  assert.equal(await handleScopeRemoved(failed.deps), NO_DATA_MESSAGE);
  assert.deepEqual(failed.calls.slice(0, 2), ['close', 'home']);
});

await check('listeners receive removals and can unsubscribe; one failing listener does not stop others', () => {
  const seen = [];
  const offBad = onScopeRemoved(() => { throw new Error('boom'); });
  const off = onScopeRemoved((p) => seen.push(p.removedGuids?.[0]));
  notifyScopeRemoved({ reason: 'companies_removed', removedGuids: ['c1'] });
  off();
  offBad();
  notifyScopeRemoved({ reason: 'companies_removed', removedGuids: ['c2'] });
  assert.deepEqual(seen, ['c1']);
});

await check('queued entries of a removed company are told their real deadline', async () => {
  const NOW = Date.parse('2026-10-10T06:00:00Z');
  const at = (iso) => Math.floor(Date.parse(iso) / 1000);
  assert.equal(formatDeadline(at('2026-11-08T20:00:00Z')), '9 Nov 2026');
  assert.equal(heldEntriesNote([{ count: 3, mode: 'deactivate', purgeDueAt: at('2026-11-09T06:00:00Z') }], NOW),
    '3 queued entries will be sent only if the company is selected and synced again before 9 Nov 2026.');
  assert.equal(heldEntriesNote([{ count: 1, mode: 'complete', purgeDueAt: at('2026-10-10T05:00:00Z') }], NOW),
    '1 queued entry for a removed company can no longer be sent to Tally.');
  const r = recorder([{ guid: 'c2' }]);
  const msg = await handleScopeRemoved({ ...r.deps, held: [{ count: 2, mode: 'complete', purgeDueAt: 1 }] });
  assert.equal(msg, `${DATA_REFRESHED_MESSAGE}. 2 queued entries for a removed company can no longer be sent to Tally.`);
});

if (failures.length) {
  console.error(`\n${failures.length} scope-refresh check(s) failed`);
  process.exit(1);
}
console.log('\nScope refresh behaviour verified.');
