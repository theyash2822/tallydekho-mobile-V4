#!/usr/bin/env node
/**
 * Security-audit remediation guard (report 2026-11-06T040557Z, mobile part):
 * SEC-029 escaped PDF templates · SEC-030 socket token only in `auth` ·
 * SEC-031 biometric-only unlock + keychain-downgrade notice · SEC-032 export
 * files deleted after share and swept on sign-out · SEC-033 encoded API path
 * segments · SEC-041 identity in SecureStore, help chat 24 h + swept ·
 * SEC-048 preview profile targets staging · SEC-049 push project id warning ·
 * SEC-050 demo flag web-only.
 *
 * Pure modules + source contracts. No extra test framework, no device.
 *
 * Run:  npm run verify:security
 * Exit: 0 pass · 1 fail
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

// Source files import siblings without an extension, as Metro does; resolve them to .ts / index.ts here.
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); }
  catch (e) {
    if (specifier.startsWith('.') && !/\\.[cm]?[jt]sx?$/.test(specifier)) {
      try { return await next(specifier + '.ts', context); }
      catch { return next(specifier + '/index.ts', context); }
    }
    throw e;
  }
}`));

async function check(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
}

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const strip = (text) =>
  text.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

globalThis.__DEV__ = false;

const { seg } = await import(path.join(root, 'src/services/apiPath.ts'));
const { isExportArtifact, sweepExportFiles, EXPORT_SUBDIRS } =
  await import(path.join(root, 'src/utils/exportCacheSweep.ts'));
const notice = await import(path.join(root, 'src/utils/biometricPinNotice.ts'));
const { resolvePushProjectId, pushProjectIdStartupWarning, isPlausibleProjectId } =
  await import(path.join(root, 'src/services/pushProjectId.ts'));
const { renderTallyHTML } = await import(path.join(root, 'src/utils/pdf/tallyLayout.ts'));
const { wouldSweepKey } = await import(path.join(root, 'src/utils/tenantStorage.ts'))
  .then(async (t) => (typeof t.wouldSweepKey === 'function' ? t : {
    wouldSweepKey: (k) => t.LOGOUT_ALWAYS_REMOVE.includes(k) || t.isTenantStorageKey(k) || t.isAmbiguousLegacyDraftKey(k),
  }));

console.log('mobile security remediation guard (2026-11-06)');

// ── SEC-030 ─────────────────────────────────────────────────────────────────
await check('SEC-030: Socket.IO handshake carries the JWT only in `auth`, never in the query string', () => {
  const svc = strip(read('src/services/socketService.ts'));
  assert.match(svc, /auth:\s*\{\s*token\s*\}/, 'auth: { token } must remain');
  assert.doesNotMatch(svc, /query:\s*\{[^}]*token/, 'query: { token } is back');
  assert.doesNotMatch(svc, /[?&]token=/, 'token must not be appended to the URL');
});

// ── SEC-031 ─────────────────────────────────────────────────────────────────
await check('SEC-031: biometric unlock refuses the device-passcode fallback', () => {
  const screen = strip(read('app/(auth)/verify-pin.tsx'));
  assert.match(screen, /disableDeviceFallback:\s*true/);
  assert.doesNotMatch(screen, /disableDeviceFallback:\s*false/);
  // Owner decision: `requireAuthentication` stays off (the app runs its own prompt).
  const pin = strip(read('src/utils/biometricPin.ts'));
  assert.doesNotMatch(pin, /requireAuthentication:\s*true/);
});

await check('SEC-031: keychain downgrade is recorded once and surfaced once, not silently', () => {
  notice.resetBiometricPinDowngradeNotice();
  assert.equal(notice.takeBiometricPinDowngradeNotice(), null);
  notice.markBiometricPinDowngrade('get');
  notice.markBiometricPinDowngrade('set'); // first stage wins
  assert.equal(notice.hasPendingBiometricPinDowngrade(), true);
  assert.equal(notice.takeBiometricPinDowngradeNotice(), 'get');
  assert.equal(notice.takeBiometricPinDowngradeNotice(), null, 'notice must show once');
  notice.markBiometricPinDowngrade('get');
  assert.equal(notice.hasPendingBiometricPinDowngrade(), false, 'no second notice this run');
  notice.resetBiometricPinDowngradeNotice();
  const pin = strip(read('src/utils/biometricPin.ts'));
  assert.match(pin, /markBiometricPinDowngrade\(stage\)/, 'biometricPin must record the downgrade');
  const screen = strip(read('app/(auth)/verify-pin.tsx'));
  assert.match(screen, /takeBiometricPinDowngradeNotice\(\)/, 'verify-pin must surface it');
  assert.match(screen, /Toast\.show\(/, 'the notice is a non-blocking toast');
});

// ── SEC-032 ─────────────────────────────────────────────────────────────────
await check('SEC-032: sweep helper deletes pdf/csv/json/IRN-* in the cache and in Print/, nothing else', async () => {
  assert.equal(isExportArtifact('Invoice 12.pdf'), true);
  assert.equal(isExportArtifact('report.CSV'), true);
  assert.equal(isExportArtifact('IRN-abc'), true);
  assert.equal(isExportArtifact('td-multi-1.pdf'), true);
  assert.equal(isExportArtifact('image.png'), false);
  assert.equal(isExportArtifact('ExponentAsset-123.ttf'), false);
  assert.deepEqual([...EXPORT_SUBDIRS], ['Print']);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'td-sweep-'));
  const files = {
    keep: ['logo.png', 'ExponentAsset-1.ttf', 'notes.txt'],
    gone: ['Invoice 1.pdf', 'einvoice-report.csv', 'IRN-01AB.json', 'td-multi-9.pdf'],
    printGone: ['uuid-1.pdf', 'uuid-2.PDF'],
  };
  for (const f of [...files.keep, ...files.gone]) fs.writeFileSync(path.join(dir, f), 'x');
  fs.mkdirSync(path.join(dir, 'Print'));
  for (const f of files.printGone) fs.writeFileSync(path.join(dir, 'Print', f), 'x');
  fs.mkdirSync(path.join(dir, 'folder.pdf')); // a directory with an export-like name is skipped
  fs.mkdirSync(path.join(dir, 'other'));
  fs.writeFileSync(path.join(dir, 'other', 'deep.pdf'), 'x'); // not swept: unknown sub-directory

  const nodeFs = {
    readDirectory: async (d) => fs.readdirSync(d),
    isDirectory: async (p) => fs.statSync(p).isDirectory(),
    deleteFile: async (p) => fs.rmSync(p, { force: true }),
  };
  const deleted = await sweepExportFiles(dir + '/', nodeFs);
  assert.equal(deleted.length, files.gone.length + files.printGone.length);
  for (const f of files.keep) assert.ok(fs.existsSync(path.join(dir, f)), `${f} must survive`);
  for (const f of files.gone) assert.ok(!fs.existsSync(path.join(dir, f)), `${f} must be deleted`);
  for (const f of files.printGone) assert.ok(!fs.existsSync(path.join(dir, 'Print', f)), `Print/${f} must be deleted`);
  assert.ok(fs.existsSync(path.join(dir, 'folder.pdf')));
  assert.ok(fs.existsSync(path.join(dir, 'other', 'deep.pdf')));
  // Missing directory and null cache dir are no-ops, never throws.
  assert.deepEqual(await sweepExportFiles(path.join(dir, 'nope'), nodeFs), []);
  assert.deepEqual(await sweepExportFiles(null, nodeFs), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

await check('SEC-032: sign-out sweeps the export cache; every share site deletes its file afterwards', () => {
  const cleanup = strip(read('src/utils/logoutCleanup.ts'));
  assert.match(cleanup, /await sweepExportCache\(\)/);
  const temp = strip(read('src/utils/tempFiles.ts'));
  assert.match(temp, /deleteAsync\([^)]*idempotent:\s*true/);
  assert.match(temp, /FileSystem\.cacheDirectory/);

  const sites = [
    ['src/utils/voucherPdf.ts', /presentPdfAndDiscard/],
    ['src/utils/multiShare.ts', /deleteTempFile\(uri\)/],
    ['src/utils/complianceActions.ts', /withTempFile\(path/],
    ['app/stocks/label-preview.tsx', /withTempFile\(uri/],
    ['app/stocks/print-settings.tsx', /withTempFile\(uri/],
    ['app/settings/voucher-config.tsx', /withTempFile\(uri/],
    ['app/stocks/barcodes.tsx', /withTempFile\(path/],
  ];
  for (const [rel, re] of sites) assert.match(strip(read(rel)), re, `${rel} must delete its export after sharing`);
  // voucherPdf: no share path left that bypasses the discard helper.
  const vp = strip(read('src/utils/voucherPdf.ts'));
  const shares = vp.match(/Sharing\.shareAsync\(/g) || [];
  assert.equal(shares.length, 1, 'voucherPdf must share only through presentPdfAndDiscard');
});

// ── SEC-033 ─────────────────────────────────────────────────────────────────
await check('SEC-033: seg() percent-encodes path segments (deep-link ids cannot rewrite the path)', () => {
  assert.equal(seg('abc-123'), 'abc-123');
  assert.equal(seg('../auth/logout'), '..%2Fauth%2Flogout');
  assert.equal(seg('x?companyGuid=other'), 'x%3FcompanyGuid%3Dother');
  assert.equal(seg('a b#c'), 'a%20b%23c');
  assert.equal(seg(42), '42');
  assert.equal(seg(undefined), 'undefined', 'a missing id must not collapse to the collection route');
});

await check('SEC-033: every ${…} in an api.ts path template is wrapped in seg() or encodeURIComponent()', () => {
  const src = read('src/services/api.ts');
  const offenders = [];
  src.split('\n').forEach((line, i) => {
    const re = /`(\/[^`]*)`/g;
    let m;
    while ((m = re.exec(line))) {
      const pathPart = m[1].split('?')[0];
      for (const hole of pathPart.matchAll(/\$\{([^}]*)\}/g)) {
        if (!/^(seg|encodeURIComponent)\(/.test(hole[1].trim())) offenders.push(`${i + 1}: ${m[1]}`);
      }
    }
  });
  assert.deepEqual(offenders, [], `unencoded path segments:\n${offenders.join('\n')}`);
  assert.match(src, /import \{ seg \} from '\.\/apiPath'/);
});

// ── SEC-029 ─────────────────────────────────────────────────────────────────
const hostile = '<img src=x onerror=alert(1)>';
const stockJournal = {
  documentType: 'stock_journal',
  documentNumber: 'SJ-1',
  date: '01/04/2026',
  company: { name: `Acme ${hostile}`, address: `Street ${hostile}`, gstin: `27AAAAA0000A1Z5${hostile}` },
  party: { name: hostile, address: hostile, gstin: hostile, phone: hostile },
  items: [{ name: hostile, hsn: hostile, qty: 1, unit: 'nos', rate: 10, amount: 10 }],
  totals: { total: 10 },
  narration: hostile,
};

await check('SEC-029: a stock journal with <img onerror> in names renders escaped', () => {
  const html = renderTallyHTML(stockJournal);
  assert.ok(!html.includes(hostile), 'raw <img onerror> must not appear in the HTML');
  assert.ok(!/<img\s+src=x/i.test(html), 'no injected <img> element');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'the display name is escaped');
});

await check('SEC-029: generateDocumentHTML routes every non-accounting/commercial type to the escaped Tally engine; Format 2/3 deleted', () => {
  const dh = strip(read('src/utils/documentHelpers.ts'));
  assert.doesNotMatch(dh, /_generateFormat2HTML|_generateFormat3HTML|_bankBlock/, 'legacy templates must be gone');
  const fn = dh.slice(dh.indexOf('export function generateDocumentHTML'), dh.indexOf('export const TX_TO_DOC_TYPE'));
  assert.match(fn, /isAccountingVoucherType\(doc\.documentType\)/);
  assert.match(fn, /isCommercialDocumentType\(doc\.documentType\)/);
  assert.match(fn, /return renderTallyHTML\(doc, \{ logoUri, terms, qrImage, bankInfo \}\);\s*\}\s*$/, 'the fall-through must be renderTallyHTML');
  assert.equal((fn.match(/return /g) || []).length, 3, 'exactly three render paths');
  // No raw ${doc.…} / ${item.…} interpolation survives anywhere in the file.
  assert.doesNotMatch(dh, /\$\{(doc|item|e)\.(party|company|name|particulars|narration)/);
  assert.match(dh, /adjustment-preview|stock_journal/, 'stock_journal still a document type');
});

// ── SEC-041 ─────────────────────────────────────────────────────────────────
await check('SEC-041: user_info lives in SecureStore on native, migrates from AsyncStorage, web keeps localStorage', () => {
  const store = strip(read('src/utils/userInfoStore.ts'));
  assert.match(store, /SecureStore\.setItemAsync\(USER_INFO_SECURE_KEY/);
  assert.match(store, /SecureStore\.getItemAsync\(USER_INFO_SECURE_KEY/);
  assert.match(store, /AsyncStorage\.getItem\(USER_INFO_LEGACY_KEY\)/, 'migration read');
  assert.match(store, /AsyncStorage\.removeItem\(USER_INFO_LEGACY_KEY\)/, 'legacy copy deleted after migration');
  assert.match(store, /Platform\.OS === 'web'/, 'web branch kept');
  assert.match(store, /USER_INFO_SECURE_KEY = 'td_user_info'/);
  // No direct AsyncStorage writer/reader of user_info remains outside the store.
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (!entry.name.startsWith('.') && entry.name !== 'node_modules') walk(full); continue; }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const rel = path.relative(root, full);
      if (rel === path.join('src', 'utils', 'userInfoStore.ts') || rel.includes('tenantStorage')) continue;
      const code = strip(fs.readFileSync(full, 'utf8'));
      if (/AsyncStorage\.(getItem|setItem|multiGet)\([^)]*['"]user_info['"]/.test(code)) offenders.push(rel);
    }
  };
  walk(path.join(root, 'src'));
  walk(path.join(root, 'app'));
  assert.deepEqual(offenders, [], `direct user_info AsyncStorage access: ${offenders.join(', ')}`);
  const auth = strip(read('src/context/AuthContext.tsx'));
  assert.match(auth, /await deleteUserInfo\(\)/, 'sign-out must clear the keychain copy');
  assert.match(auth, /writeUserInfo\(/);
  assert.match(auth, /readUserInfoRaw\(\)/);
  assert.equal(wouldSweepKey('user_info'), true, 'legacy key still swept');
});

await check('SEC-041: help-chat transcripts expire after 24 h and are swept on sign-out', () => {
  const help = strip(read('app/settings/help.tsx'));
  assert.match(help, /CHAT_TTL_MS\s*=\s*24 \* 60 \* 60 \* 1000/);
  assert.match(help, /age < CHAT_TTL_MS/);
  assert.match(help, /const chatKey = `td_help_chat_\$\{/);
  assert.equal(wouldSweepKey('td_help_chat_919999999999'), true);
  assert.equal(wouldSweepKey('td_help_chat_guest'), true);
});

// ── SEC-048 ─────────────────────────────────────────────────────────────────
await check('SEC-048: preview profile is explicit staging (never production without env)', async () => {
  const eas = JSON.parse(read('eas.json'));
  const backend = await import(path.join(root, 'src/config/backend.ts'));
  for (const name of ['preview', 'staging']) {
    const profile = eas.build?.[name];
    assert.ok(profile, `eas.json is missing the ${name} profile`);
    assert.equal(profile.env?.EXPO_PUBLIC_APP_ENV, 'staging', `${name} must declare staging`);
    const url = profile.env?.EXPO_PUBLIC_BACKEND_URL;
    assert.ok(url, `${name} must set EXPO_PUBLIC_BACKEND_URL`);
    assert.ok(!/^https?:\/\/api\.tallydekho\.com/i.test(url), `${name} points at production: ${url}`);
    assert.equal(backend.resolveBackendUrl(profile.env, false), url.replace(/\/+$/, ''));
    assert.equal(backend.resolveAppEnv(profile.env, false), 'staging');
  }
  assert.ok(fs.existsSync(path.join(root, 'docs/eas-profiles.md')), 'profile rules must be documented');
  assert.match(read('docs/eas-profiles.md'), /EXPO_PUBLIC_PROJECT_ID/);
  assert.match(read('docs/eas-profiles.md'), /extra\.eas\.projectId/);
});

// ── SEC-049 ─────────────────────────────────────────────────────────────────
await check('SEC-049: push project id resolves env → extra.eas → easConfig and warns when absent', () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  assert.equal(resolvePushProjectId({ env: { EXPO_PUBLIC_PROJECT_ID: id } }), id);
  assert.equal(resolvePushProjectId({ env: {}, extra: { eas: { projectId: id } } }), id);
  assert.equal(resolvePushProjectId({ env: {}, extra: {}, easConfig: { projectId: id } }), id);
  assert.equal(resolvePushProjectId({ env: { EXPO_PUBLIC_PROJECT_ID: 'env' }, extra: { eas: { projectId: 'extra' } } }), 'env');
  assert.equal(resolvePushProjectId({ env: { EXPO_PUBLIC_PROJECT_ID: '  ' }, extra: null, easConfig: null }), null);
  assert.equal(pushProjectIdStartupWarning({ env: {} })?.includes('EXPO_PUBLIC_PROJECT_ID'), true);
  assert.equal(pushProjectIdStartupWarning({ env: { EXPO_PUBLIC_PROJECT_ID: id } }), null);
  assert.equal(isPlausibleProjectId(id), true);
  assert.equal(isPlausibleProjectId('nope'), false);
  // Committed config still does not carry the id — the owner must set it (documented).
  const app = JSON.parse(read('app.json'));
  const committed = app.expo?.extra?.eas?.projectId;
  if (!committed) console.log('        note: app.json has no extra.eas.projectId — owner action (docs/eas-profiles.md)');
  const layout = strip(read('app/_layout.tsx'));
  assert.match(layout, /warnIfPushProjectIdMissing\(\)/, 'startup warning must be wired');
  const push = strip(read('src/services/pushNotifications.ts'));
  assert.match(push, /if \(!__DEV__ \|\| Platform\.OS === 'web'\) return;/, 'startup warning is dev-only');
  assert.match(push, /resolvePushProjectId\(projectIdSources\(\)\)/);
});

// ── SEC-050 ─────────────────────────────────────────────────────────────────
await check('SEC-050: DEMO_MODE is true only on web with EXPO_PUBLIC_DEMO_MODE=1', () => {
  const cfg = strip(read('src/demo/config.ts'));
  assert.match(cfg, /import \{ Platform \} from 'react-native'/);
  assert.match(cfg, /export const DEMO_MODE = Platform\.OS === 'web' && process\.env\.EXPO_PUBLIC_DEMO_MODE === '1';/);
  // Evaluate the expression itself under both platforms.
  const expr = cfg.match(/export const DEMO_MODE = (.*);/)[1];
  const evalWith = (os, flag) => new Function('Platform', 'process', `return ${expr};`)({ OS: os }, { env: { EXPO_PUBLIC_DEMO_MODE: flag } });
  assert.equal(evalWith('web', '1'), true);
  assert.equal(evalWith('ios', '1'), false);
  assert.equal(evalWith('android', '1'), false);
  assert.equal(evalWith('web', '0'), false);
  assert.equal(evalWith('web', undefined), false);
});

if (failures.length) {
  console.error(`\n${failures.length} FAILED`);
  process.exit(1);
}
console.log('\nverify-security-2026-11-06: PASS');
