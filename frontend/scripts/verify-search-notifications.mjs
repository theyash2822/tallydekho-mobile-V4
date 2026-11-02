#!/usr/bin/env node
/**
 * Behaviour: global search and notifications work as on the web portal. Search hits are grouped
 * (vouchers, ledgers, stock items) and each opens its record; the search is bounded to the selected
 * financial year. Every notification opens the record or filtered list it is about.
 *
 * Run:  npm run verify:search-notifications
 * Exit: 0 pass · 1 fail
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSearchSections, searchHitRoute, SEARCH_PLACEHOLDERS } from '../src/utils/globalSearch.ts';
import { notificationRoute, notificationGroup, notificationSeverity } from '../src/utils/notificationLinks.ts';

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

await check('search hits are grouped vouchers, ledgers, stock; empty groups dropped', () => {
  const sections = buildSearchSections([
    { kind: 'stock', guid: 's1' }, { kind: 'voucher', guid: 'v1' }, { kind: 'voucher', guid: 'v2' },
  ]);
  assert.deepEqual(sections.map((s) => [s.id, s.items.length]), [['voucher', 2], ['stock', 1]]);
});

await check('each search hit opens its own record', () => {
  assert.equal(searchHitRoute({ kind: 'voucher', guid: 'a b' }), '/document/a%20b');
  assert.equal(searchHitRoute({ kind: 'ledger', guid: 'L1' }), '/ledger/L1');
  assert.equal(searchHitRoute({ kind: 'stock', guid: 'S1' }), '/stocks/item-detail?id=S1');
  assert.equal(searchHitRoute({ kind: 'stock' }), null);
});

await check('placeholder rotates through the portal phrases', () => {
  assert.equal(SEARCH_PLACEHOLDERS[0][1], 'Search transactions, parties…');
  assert.ok(SEARCH_PLACEHOLDERS.length >= 4);
});

await check('home search sends the financial year and shows only data results', () => {
  const home = read('app/(tabs)/index.tsx');
  assert.match(home, /searchDashboard\(q, companyGuid, \{ from: fyFrom, to: fyTo \}\)/);
  assert.match(home, /<GlobalSearchResults /);
  assert.doesNotMatch(home, /filteredActivity/, 'no local recent-activity fallback');
  assert.match(read('src/services/api.ts'), /from: period\.from, to: period\.to/);
});

await check('notification targets open the record or filtered list', () => {
  assert.equal(notificationRoute({ target: { kind: 'stock_item', guid: 'S1' } }), '/stocks/item-detail?id=S1');
  assert.equal(notificationRoute({ target: { kind: 'stock_item', guid: null } }), '/stocks/low-stock');
  assert.equal(notificationRoute({ target: { kind: 'ledger', guid: 'L1' } }), '/ledger/L1');
  assert.equal(notificationRoute({ target: { kind: 'page', page: 'eway-bill', filter: 'pending' } }), '/reports/ewb-list?status=pending');
  assert.equal(notificationRoute({ target: { kind: 'page', page: 'einvoice', filter: 'pending' } }), '/reports/einvoice-list?status=pending');
  assert.equal(notificationRoute({ target: { kind: 'page', page: 'expiry-schedule' } }), '/stocks/expiry-schedule');
  assert.equal(notificationRoute({ target: { kind: 'page', page: 'negative-stock' } }), '/stocks/negative-stock');
});

await check('older alerts without a target still open the right list', () => {
  assert.equal(notificationRoute({ route: '/settings/ewb' }), '/reports/ewb-list?status=pending');
  assert.equal(notificationRoute({ route: '/settings/einvoice' }), '/reports/einvoice-list?status=pending');
  assert.equal(notificationRoute({ route: '/stocks/negative-stock' }), '/stocks/negative-stock');
  assert.equal(notificationRoute({ route: 'https://x' }), null);
  assert.equal(notificationRoute({}), null);
});

await check('alerts are grouped Today / Yesterday / Earlier and graded by severity', () => {
  const now = new Date(2026, 10, 1, 18, 0);
  assert.equal(notificationGroup(new Date(2026, 10, 1, 1, 0).toISOString(), now), 'Today');
  assert.equal(notificationGroup(new Date(2026, 9, 31, 23, 0).toISOString(), now), 'Yesterday');
  assert.equal(notificationGroup(new Date(2026, 9, 20).toISOString(), now), 'Earlier');
  assert.equal(notificationSeverity({ title: 'Negative stock' }), 'critical');
  assert.equal(notificationSeverity({ title: 'Low stock: Rice' }), 'attention');
  assert.equal(notificationSeverity({ title: 'Synced' }), 'info');
});

await check('pending lists honour ?status= from a notification', () => {
  for (const f of ['app/reports/ewb-list.tsx', 'app/reports/einvoice-list.tsx']) {
    const src = read(f);
    assert.match(src, /useLocalSearchParams<\{ status\?: string \}>/, f);
    assert.match(src, /<StatusOnlyChip /, f);
  }
  assert.match(read('app/notifications.tsx'), /notificationRoute\(n\)/);
});

if (failures.length) {
  console.error(`\n${failures.length} failed`);
  process.exit(1);
}
console.log('\nAll search & notification checks passed');
