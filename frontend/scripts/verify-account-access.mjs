#!/usr/bin/env node
/**
 * Behaviour: sign-up names the workspace on its own field; Delete Account sends a real WhatsApp code and the
 * server deletes the account; My Access shows the same human-readable information as the web portal.
 *
 * Run:  npm run verify:account-access
 * Exit: 0 pass · 1 fail
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ACCESS_MODULES, SCOPE_CHIP_LIMIT, buildMyAccessView, dataLabel, entryModeLabel, membershipStatusLabel,
  moduleRows, roleLabel, scopeRows, sensitivePolicyRows, tallyLabel,
} from '../src/utils/myAccess.ts';
import { WORKSPACE_NAME_MAX, canProceedRegister, isValidWorkspaceName } from '../src/utils/registerForm.ts';

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
const locale = (lang) => JSON.parse(read(`src/i18n/locales/${lang}.json`));
const lookup = (strings, key) => key.split('.').reduce((node, part) => node?.[part], strings);

// English strings, exactly as the app shows them; a missing key fails the check.
const en = locale('en');
const t = (key, opts = {}) => {
  const value = lookup(en, key);
  if (typeof value !== 'string') throw new Error(`missing translation ${key}`);
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(opts[name]));
};
const MA = en.screens.settingsMyAccess;
const pairs = (rows) => rows.map((r) => [r.label, r.value]);
const byKey = (rows) => Object.fromEntries(rows.map((r) => [r.key, r]));

// ── My Access ────────────────────────────────────────────────────────────────

await check('Tally, data and membership status read as words, not backend values', () => {
  assert.equal(tallyLabel('CONNECTED', t), 'Tally connected');
  assert.equal(tallyLabel('RECONNECTING', t), 'Paired · waiting for first sync');
  assert.equal(tallyLabel('UNPAIRED', t), 'Not paired');
  assert.equal(tallyLabel(undefined, t), 'Not paired');
  assert.equal(dataLabel(true, t), 'Demo Mode');
  assert.equal(dataLabel(false, t), 'Live data');
  assert.equal(membershipStatusLabel('ACTIVE', t), 'Active');
  assert.equal(membershipStatusLabel('SUSPENDED', t), 'Suspended');
  assert.equal(membershipStatusLabel('PENDING', t), 'Pending');
  assert.equal(membershipStatusLabel('PENDING_APPROVAL', t), 'Pending approval');
  assert.equal(membershipStatusLabel(undefined, t), 'Active');
});

await check('role is Owner, else the role name, else Member; entry mode in words', () => {
  assert.equal(roleLabel(true, 'Accountant', t), 'Owner');
  assert.equal(roleLabel(false, 'Accountant', t), 'Accountant');
  assert.equal(roleLabel(false, null, t), 'Member');
  const modes = [
    ['BOTH', 'Regular + Optional'], ['REGULAR', 'Regular only'], ['REGULAR_ONLY', 'Regular only'],
    ['OPTIONAL', 'Optional only'], ['OPTIONAL_ONLY', 'Optional only'], [undefined, 'Regular + Optional'],
    ['NONE', 'None'], ['VIEW_ONLY', 'View only'],
  ];
  for (const [mode, label] of modes) assert.equal(entryModeLabel(mode, t), label, String(mode));
});

await check('credits row only for non-owners; hint and footnote follow Owner / Admin', () => {
  const base = { demoMode: false, can: () => false };
  const owner = buildMyAccessView({ ...base, isOwner: true, isOwnerOrAdmin: true }, t);
  const admin = buildMyAccessView({ ...base, isOwner: false, isOwnerOrAdmin: true, roleDisplayName: 'Admin' }, t);
  const member = buildMyAccessView({ ...base, isOwner: false, isOwnerOrAdmin: false }, t);
  assert.deepEqual(owner.role.map((r) => r.key), ['role', 'entryMode']);
  assert.deepEqual(pairs(admin.role)[2], ['Credits & billing', 'Managed by the Workspace Owner']);
  assert.deepEqual(pairs(member.role)[2], ['Credits & billing', 'Managed by the Workspace Owner']);
  assert.equal(owner.roleHint, MA.ownerHint);
  assert.equal(admin.roleHint, MA.ownerHint);
  assert.equal(member.roleHint, MA.memberHint);
  assert.equal(owner.footnote, MA.footnoteOwner);
  assert.equal(admin.footnote, MA.footnoteMember);
  assert.equal(member.footnote, MA.footnoteMember);
});

await check('eleven modules in order; Owner has all open, members follow their capabilities', () => {
  assert.deepEqual(ACCESS_MODULES.map((m) => m.cap), [
    'dashboard.view', 'sales.view', 'purchase.view', 'vouchers.view', 'inventory.view', 'expenses.view',
    'financials.view', 'compliance.view', 'ledgers.view', 'audit_trail.view', 'ai_insights.view',
  ]);
  const owner = moduleRows(true, () => false, t);
  assert.ok(owner.every((m) => m.open));
  assert.deepEqual(owner.map((m) => m.label), [
    'Dashboard', 'Sales', 'Purchase', 'Vouchers', 'Inventory', 'Expenses',
    'Financials', 'Compliance', 'Ledgers', 'Audit Trail', 'AI Insights',
  ]);
  const member = moduleRows(false, (cap) => cap === 'sales.view' || cap === 'audit_trail.view', t);
  assert.deepEqual(member.filter((m) => m.open).map((m) => m.label), ['Sales', 'Audit Trail']);
});

await check('data scope: Owner and ALL read All; NONE and an empty selection read None', () => {
  const labels = scopeRows(null, false, [], t).map((r) => r.label);
  assert.deepEqual(labels, ['Companies', 'Financial years', 'Ledgers / parties', 'Godowns / warehouses', 'Cost centres']);
  assert.ok(scopeRows(null, false, [], t).every((r) => r.value === 'All'), 'no scope and no mode reads All');
  const denied = { policy: { company_mode: 'NONE', fy_mode: 'NONE' }, companies: ['g1'] };
  assert.ok(scopeRows(denied, true, [], t).every((r) => r.value === 'All'), 'Owner always reads All');
  const rows = byKey(scopeRows({
    policy: { company_mode: 'SELECTED', fy_mode: 'SELECTED', ledger_mode: 'ALL', godown_mode: 'NONE' },
    companies: ['g1'],
    ledgers: [{ ledger_guid: 'l1', ledger_name: 'Cash' }],
    godowns: [{ godown_guid: 'w1', godown_name: 'Main' }],
  }, false, [], t));
  assert.equal(rows.ledgers.value, 'All', 'ALL even with names');
  assert.equal(rows.godowns.value, 'None', 'NONE even with names');
  assert.equal(rows.financialYears.value, 'None', 'SELECTED with nothing selected');
  assert.equal(rows.costCentres.value, 'All', 'no mode and no names');
  assert.equal(rows.companies.value, null);
});

await check('data scope names: company GUIDs by name, rows by their name fields, 12 chips then +N more', () => {
  const rows = byKey(scopeRows({
    policy: { company_mode: 'SELECTED', fy_mode: 'SELECTED', ledger_mode: 'SELECTED', godown_mode: 'SELECTED', cost_centre_mode: 'SELECTED' },
    companies: ['guid-a', 'guid-unknown'],
    financialYears: ['2025-2026'],
    ledgers: Array.from({ length: 15 }, (_, i) => ({ ledger_guid: `l${i}`, ledger_name: `Party ${i + 1}` })),
    godowns: [{ godown_guid: 'w1', name: 'Back store' }, { godown_guid: 'w2' }],
    costCentres: [{ cost_centre_guid: 'c1', cost_centre_name: 'Branch A' }],
  }, false, [{ guid: 'guid-a', name: 'Mehta Traders' }], t));
  assert.deepEqual(rows.companies.names, ['Mehta Traders', 'guid-unknown'], 'an unknown company keeps its id, as on the web');
  assert.deepEqual(rows.financialYears.names, ['2025-2026']);
  assert.equal(rows.ledgers.names.length, SCOPE_CHIP_LIMIT);
  assert.deepEqual(rows.ledgers.names.slice(0, 2), ['Party 1', 'Party 2']);
  assert.equal(rows.ledgers.more, '+3 more');
  assert.deepEqual(rows.godowns.names, ['Back store', 'w2']);
  assert.deepEqual(rows.costCentres.names, ['Branch A']);
  assert.equal(rows.costCentres.more, null);
});

await check('sensitive policies: fixed order, other keys alphabetically, Visible / Masked / Hidden', () => {
  const rows = sensitivePolicyRows({
    purchase_values: false, zeta_export: 'VISIBLE', cost_price: true, bank_balance: 'MASKED', alpha_notes: 'HIDDEN', margin: 'VISIBLE',
  }, false, t);
  assert.deepEqual(pairs(rows), [
    ['Cost Price', 'Visible'], ['Margin', 'Visible'], ['Bank Balance', 'Masked'], ['Purchase Values', 'Hidden'],
    ['Alpha notes', 'Hidden'], ['Zeta export', 'Visible'],
  ]);
  assert.deepEqual(pairs(sensitivePolicyRows({}, true, t)), [['Sensitive fields', 'Visible (Owner/Admin default)']]);
  assert.deepEqual(pairs(sensitivePolicyRows(null, false, t)), [['Sensitive fields', 'Follows role policy (server-enforced)']]);
});

await check('a member sees the web portal summary with no raw backend values', () => {
  const view = buildMyAccessView({
    isOwner: false,
    isOwnerOrAdmin: false,
    workspaceName: 'Mehta Group',
    companyName: 'Mehta Traders',
    pairingStatus: 'CONNECTED',
    demoMode: false,
    membershipStatus: 'ACTIVE',
    roleDisplayName: 'Accountant',
    entryMode: 'REGULAR_ONLY',
    can: (cap) => cap === 'sales.view',
    scopes: { policy: { company_mode: 'SELECTED', ledger_mode: 'SELECTED' }, companies: ['g1'], ledgers: [{ ledger_guid: 'l1', ledger_name: 'Cash' }] },
    companies: [{ guid: 'g1', name: 'Mehta Traders' }],
    sensitivePolicies: { cost_price: false, bank_balance: 'MASKED' },
  }, t);
  assert.deepEqual(pairs(view.workspace), [
    ['Name', 'Mehta Group'], ['Company', 'Mehta Traders'], ['Tally', 'Tally connected'], ['Data', 'Live data'], ['Status', 'Active'],
  ]);
  assert.deepEqual(pairs(view.role), [
    ['Role', 'Accountant'], ['Entry mode', 'Regular only'], ['Credits & billing', 'Managed by the Workspace Owner'],
  ]);
  assert.equal(view.sensitiveHint, MA.sensitiveHint);
  const shown = [
    ...view.workspace.flatMap((r) => [r.label, r.value]), ...view.role.flatMap((r) => [r.label, r.value]),
    ...view.modules.map((m) => m.label), ...view.scopes.flatMap((r) => [r.label, r.value, r.more, ...r.names]),
    ...view.sensitive.flatMap((r) => [r.label, r.value]), view.roleHint, view.sensitiveHint, view.footnote,
  ].filter(Boolean);
  for (const text of shown) {
    assert.doesNotMatch(text, /_|\.view\b|^[A-Z]{4,}$/, `raw value shown: ${text}`);
  }
  assert.ok(!shown.includes('g1') && !shown.includes('l1'), 'no GUIDs shown');
  const emptyWorkspace = buildMyAccessView({ isOwner: true, isOwnerOrAdmin: true, demoMode: true, can: () => true }, t);
  assert.deepEqual(pairs(emptyWorkspace.workspace).slice(0, 2), [['Name', '—'], ['Company', '—']]);
});

await check('My Access screen renders the shared view from the raw scopes; raw sections are gone', () => {
  const src = read('app/settings/my-access.tsx');
  assert.match(src, /buildMyAccessView\(\{/, 'missing /buildMyAccessView\\(\\{/');
  assert.match(src, /scopes: access\?\.scopes,/, 'reads the raw access.scopes, not the GUID-only bag');
  assert.match(src, /lock-closed-outline/, 'missing /lock-closed-outline/');
  for (const gone of ['capabilitiesTitle', 'settingsMyAccess.pairing', 'policyHint', "settingsMyAccess.footnote'", '✓', '✗', 'capabilities']) {
    assert.ok(!src.includes(gone), `still uses ${gone}`);
  }
});

// ── Sign-up workspace name ───────────────────────────────────────────────────

await check('workspace name is valid at 2–60 characters once trimmed', () => {
  assert.equal(WORKSPACE_NAME_MAX, 60);
  assert.equal(isValidWorkspaceName(''), false);
  assert.equal(isValidWorkspaceName('   '), false);
  assert.equal(isValidWorkspaceName(' A '), false);
  assert.equal(isValidWorkspaceName('AB'), true);
  assert.equal(isValidWorkspaceName('  Mehta Traders  '), true);
  assert.equal(isValidWorkspaceName('x'.repeat(60)), true);
  assert.equal(isValidWorkspaceName(`  ${'x'.repeat(60)}  `), true);
  assert.equal(isValidWorkspaceName('x'.repeat(61)), false);
});

await check('Continue needs a valid workspace name as well as name, email and terms', () => {
  const form = { name: 'Asha Mehta', email: 'asha@example.com', workspaceName: 'Mehta Traders', termsAccepted: true };
  assert.equal(canProceedRegister(form), true);
  assert.equal(canProceedRegister({ ...form, workspaceName: 'M' }), false);
  assert.equal(canProceedRegister({ ...form, workspaceName: '  ' }), false);
  assert.equal(canProceedRegister({ ...form, name: 'A' }), false);
  assert.equal(canProceedRegister({ ...form, email: 'asha@' }), false);
  assert.equal(canProceedRegister({ ...form, termsAccepted: false }), false);
});

await check('sign-up sends workspace_name on Continue and Skip, separately from Full Name', () => {
  const src = read('app/(auth)/register.tsx');
  assert.match(src, /workspace_name: workspaceName\.trim\(\)/, 'missing /workspace_name: workspaceName\\.trim\\(\\)/');
  assert.match(src, /name: name\.trim\(\)/, 'missing /name: name\\.trim\\(\\)/');
  assert.equal((src.match(/registerUser\(/g) || []).length, 1, 'one register call');
  assert.equal((src.match(/onPress=\{handleLogin\}/g) || []).length, 2, 'both Skip buttons register through it');
  assert.match(src, /maxLength=\{WORKSPACE_NAME_MAX\}/, 'missing /maxLength=\\{WORKSPACE_NAME_MAX\\}/');
  assert.match(src, /canProceedRegister\(\{ name, email, workspaceName, termsAccepted \}\)/, 'missing /canProceedRegister\\(\\{ name, email, workspaceName, termsAccepted \\}\\)/');
  for (const key of ['workspaceName', 'workspaceNamePlaceholder', 'workspaceNameHint', 'workspaceNameInvalid']) {
    assert.ok(src.includes(`'screens.authRegister.${key}'`), key);
  }
  assert.match(src, /err\?\.code === 'VALIDATION_ERROR'/, 'missing /err\\?\\.code === \'VALIDATION_ERROR\'/');
  const api = read('src/services/api.ts');
  assert.match(api, /workspace_name: string \}>\): Promise<RegisterResponse>/, 'missing /workspace_name: string \\}>\\): Promise<RegisterResponse>/');
  assert.match(api, /workspace\?: \{ id: string; name: string \}/, 'missing /workspace\\?: \\{ id: string; name: string \\}/');
});

// ── Delete Account ───────────────────────────────────────────────────────────

await check('Delete Account uses the real endpoints and signs out through AuthContext', () => {
  const api = read('src/services/api.ts');
  assert.match(api, /post<AccountDeletionStartResponse>\('\/auth\/account\/delete\/start'\)/, 'missing /post<AccountDeletionStartResponse>\\(\'\\/auth\\/account\\/delete\\/start\'\\)/');
  assert.match(api, /'\/auth\/account\/delete\/confirm', \{ otp \}/, 'missing /\'\\/auth\\/account\\/delete\\/confirm\', \\{ otp \\}/');
  assert.match(api, /err\.code !== 'OWNS_SHARED_WORKSPACE'/, 'missing /err\\.code !== \'OWNS_SHARED_WORKSPACE\'/');
  const profile = read('app/settings/profile.tsx');
  const sheet = profile.slice(profile.indexOf('function DeleteAccountModal'), profile.indexOf('function CreatePasskeyModal'));
  assert.match(sheet, /startAccountDeletion\(\)/, 'missing /startAccountDeletion\\(\\)/');
  assert.match(sheet, /confirmAccountDeletion\(otp\)/, 'missing /confirmAccountDeletion\\(otp\\)/');
  assert.match(sheet, /res\?\.data\?\.masked_phone/, 'missing /res\\?\\.data\\?\\.masked_phone/');
  assert.match(sheet, /'screens\.settingsProfile\.deleteAccountSub'/, 'missing /\'screens\\.settingsProfile\\.deleteAccountSub\'/');
  assert.match(sheet, /'screens\.settingsProfile\.deleteBlocked', \{ names: blocked\.map\(w => w\.name\)\.join\(', '\) \}/, 'missing /\'screens\\.settingsProfile\\.deleteBlocked\', \\{ names: blocked\\.map\\(w => w\\.name\\)\\.join\\(\', \'\\) \\}/');
  assert.match(sheet, /<ActivityIndicator/, 'missing /<ActivityIndicator/');
  assert.ok(!sheet.includes('accountDeleted'), 'the sheet never reports success on its own');
  assert.ok(!sheet.includes('changeNumberMsg'), 'the change-number alert is gone');
  assert.match(profile, /await signOut\(\)\.catch\(\(\) => \{\}\);\n\s+router\.replace\('\/\(auth\)'\);/, 'missing /await signOut\\(\\)\\.catch\\(\\(\\) => \\{\\}\\);\\n\\s+router\\.replace\\(\'\\/\\(auth\\)\'\\);/');
  assert.match(profile, /'screens\.settingsProfile\.accountDeleted'\), t\('screens\.settingsProfile\.accountDeletedMsg'\)/, 'missing /\'screens\\.settingsProfile\\.accountDeleted\'\\), t\\(\'screens\\.settingsProfile\\.accountDeletedMsg\'\\)/');
});

// ── Translations ─────────────────────────────────────────────────────────────

const USED_KEYS = [
  ...['workspaceName', 'workspaceNamePlaceholder', 'workspaceNameHint', 'workspaceNameInvalid'].map((k) => `screens.authRegister.${k}`),
  ...['deleteAccountConfirmation', 'deleteAccountSub', 'deleteBlocked', 'codeSentToPrefix', 'viaWhatsAppSuffix', 'accountDeleted', 'accountDeletedMsg']
    .map((k) => `screens.settingsProfile.${k}`),
  ...[
    'title', 'workspace', 'name', 'company', 'data', 'status', 'tallyConnected', 'tallyWaiting', 'tallyNotPaired', 'demoMode',
    'liveData', 'statusActive', 'statusSuspended', 'yourRole', 'role', 'owner', 'member', 'entryMode', 'entryBoth',
    'entryRegularOnly', 'entryOptionalOnly', 'creditsBilling', 'managedByOwner', 'ownerHint', 'memberHint', 'modulesTitle',
    ...ACCESS_MODULES.map((m) => m.labelKey), 'dataScope', 'scopeCompanies', 'scopeFinancialYears', 'scopeLedgers',
    'scopeGodowns', 'scopeCostCentres', 'all', 'none', 'moreCount', 'sensitivePolicy', 'sensitiveCostPrice',
    'sensitiveInventoryValuation', 'sensitiveMargin', 'sensitiveBankBalance', 'sensitiveCashBalance', 'sensitiveCreditLimit',
    'sensitiveTaxIdentity', 'sensitivePurchaseValues', 'sensitiveFields', 'visibleDefault', 'followsRolePolicy', 'visible',
    'masked', 'hidden', 'sensitiveHint', 'footnoteOwner', 'footnoteMember',
  ].map((k) => `screens.settingsMyAccess.${k}`),
];

await check('every string these screens use exists in all 11 languages, placeholders intact', () => {
  const langs = ['en', 'bn', 'gu', 'hi', 'kn', 'ml', 'mr', 'or', 'pa', 'ta', 'te'];
  for (const lang of langs) {
    const strings = locale(lang);
    const missing = USED_KEYS.filter((key) => typeof lookup(strings, key) !== 'string' || !lookup(strings, key).trim());
    assert.deepEqual(missing, [], `${lang} is missing ${missing.join(', ')}`);
    assert.match(lookup(strings, 'screens.settingsProfile.deleteBlocked'), /\{\{names\}\}/, `${lang} deleteBlocked`);
    assert.match(lookup(strings, 'screens.settingsMyAccess.moreCount'), /\{\{count\}\}/, `${lang} moreCount`);
  }
});

if (failures.length) {
  console.error(`\n${failures.length} failed`);
  process.exit(1);
}
console.log('\nAll account & My Access checks passed');
