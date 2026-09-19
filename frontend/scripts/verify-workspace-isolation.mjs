#!/usr/bin/env node
/**
 * Guard: one workspace must never speak for another, and a 15-minute access
 * token must never end the session.
 *
 * A user can own an unpaired workspace and be a member of a paired one at the
 * same time. The app used to keep a single user-global `is_paired` flag and to
 * act on socket events without checking which workspace sent them, so switching
 * between the two leaked pairing state, company caches and toasts across
 * tenants. These checks pin the shape of the fix so it cannot quietly regress.
 *
 * Run:  npm run verify:isolation
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
    fn();
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
}

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** Comments describe the old design on purpose — never match against them. */
function stripComments(text) {
  return text
    // Line comments go first. Sweeping block comments first would start at the
    // `/*` inside a line like `// Base: /api/*` and swallow real code with it.
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function sourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        out.push({ rel: path.relative(root, full), code: stripComments(fs.readFileSync(full, 'utf8')) });
      }
    }
  };
  walk(path.join(root, 'src'));
  walk(path.join(root, 'app'));
  return out;
}

const files = sourceFiles();
globalThis.__DEV__ = false;
const scope = await import(path.join(root, 'src/services/workspaceEventScope.ts'));

console.log('mobile workspace isolation guard');

// ── 1. Pairing is a property of a workspace, never of the user ──────────────

check('no source file keeps a user-global pairing flag', () => {
  const offenders = files
    .filter((f) => /\b(isPaired|setIsPaired)\b/.test(f.code))
    .map((f) => f.rel);
  assert.deepEqual(
    offenders,
    [],
    `user-global pairing flag survives in: ${offenders.join(', ')}. `
      + 'Pairing lives on the selected workspace (WorkspaceContext.pairingStatus).'
  );
});

check('the legacy is_paired storage key is never read or written', () => {
  const offenders = [];
  for (const { rel, code } of files) {
    if (/(getItem|multiGet)\s*\([^)]*['"]is_paired['"]/.test(code)) offenders.push(`${rel} (read)`);
    if (/(setItem|multiSet)\s*\(\s*\[?\s*['"]is_paired['"]/.test(code)) offenders.push(`${rel} (write)`);
  }
  assert.deepEqual(offenders, [], `is_paired is still used as pairing truth in: ${offenders.join(', ')}`);
});

check('the home screen takes its live-Tally state from the workspace', () => {
  const home = stripComments(read('app/(tabs)/index.tsx'));
  assert.match(home, /useWorkspace\(\)/, 'home screen must read WorkspaceContext');
  assert.match(
    home,
    /tallyConnected\s*&&\s*!isDesktopOnline/,
    'the desktop-offline badge must be gated on the workspace being CONNECTED'
  );
  // Only CONNECTED toasts "Tally connected". RECONNECTING is paired-offline real books.
  const tracked = [...home.matchAll(/wasPaired\.current\s*=\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(tracked.length > 0, 'the connect/disconnect toast no longer tracks a previous state');
  assert.deepEqual(
    [...new Set(tracked)],
    ['tallyConnected'],
    `the toast must track tallyConnected only, found: ${tracked.join(', ')}`
  );
  const effect = home.match(/wasPaired\.current\s*=\s*tallyConnected;\s*\},\s*\[([^\]]*)\]\)/);
  assert.ok(effect, 'the pairing toast effect was not found');
  const deps = effect[1].split(',').map((s) => s.trim());
  assert.ok(
    deps.includes('workspaceId'),
    'switching workspace must re-baseline the toast rather than announce a disconnect'
  );
});

check('logging out clears the workspace-scoped caches and the refresh token', () => {
  const auth = stripComments(read('src/context/AuthContext.tsx'));
  assert.match(auth, /clearRefreshToken\(\)/, 'removeToken must clear the refresh token');
  assert.match(auth, /sweepTenantAsyncStorage/, 'tenant keys must still be swept by pattern');
});

// ── 2. Socket events are filtered by the active workspace ───────────────────

const MUTATING_EVENTS = [
  'synced',
  'paired',
  'unpaired',
  'tally_connection',
  'workspace_access_changed',
  'workspace_access_revoked',
  'hard_sync_request',
  'hard_sync_status',
  'restore_request',
  'restore_status',
];

check('every workspace-mutating socket event is workspace-scoped', () => {
  for (const event of MUTATING_EVENTS) {
    assert.ok(
      scope.WORKSPACE_SCOPED_EVENTS.has(event),
      `${event} mutates workspace state but is not in WORKSPACE_SCOPED_EVENTS`
    );
  }
});

check('an event for another workspace is ignored', () => {
  for (const event of MUTATING_EVENTS) {
    assert.equal(
      scope.isEventForWorkspace(event, { workspaceId: 'ws-ABC' }, 'ws-XYZ'),
      false,
      `${event} from workspace ABC was accepted while XYZ is active`
    );
  }
});

check('an event without a workspaceId is ignored', () => {
  for (const event of MUTATING_EVENTS) {
    assert.equal(
      scope.isEventForWorkspace(event, {}, 'ws-XYZ'),
      false,
      `${event} with no workspaceId was applied to the active workspace`
    );
    assert.equal(scope.isEventForWorkspace(event, undefined, 'ws-XYZ'), false);
    assert.equal(scope.isEventForWorkspace(event, { workspaceId: '' }, 'ws-XYZ'), false);
  }
});

check('an event for the active workspace is delivered', () => {
  for (const event of MUTATING_EVENTS) {
    assert.equal(scope.isEventForWorkspace(event, { workspaceId: 'ws-XYZ' }, 'ws-XYZ'), true);
    assert.equal(scope.isEventForWorkspace(event, { workspace_id: 'ws-XYZ' }, 'ws-XYZ'), true);
  }
});

check('invitations stay user-scoped', () => {
  // An invitation names a workspace the user has not joined — filtering it by
  // the active workspace would hide every invite.
  assert.equal(scope.isEventForWorkspace('invitation_received', {}, 'ws-XYZ'), true);
  assert.equal(
    scope.isEventForWorkspace('invitation_received', { workspaceId: 'ws-ABC' }, 'ws-XYZ'),
    true
  );
});

check('socket handlers read the active workspace at event time', () => {
  const svc = stripComments(read('src/services/socketService.ts'));
  assert.match(
    svc,
    /isEventForWorkspace\(\s*event,\s*payload,\s*getActiveWorkspaceId\(\)\s*\)/,
    'the gate must call getActiveWorkspaceId() on each event, not a captured id'
  );
  // The two events that also fire onSyncedCallback bypass emitWorkspaceEvent.
  for (const event of ['synced', 'tally_connection']) {
    const handler = svc.match(new RegExp(`socket\\.on\\('${event}'[\\s\\S]*?\\n {4}\\}\\);`));
    assert.ok(handler, `no '${event}' handler found in socketService`);
    assert.match(
      handler[0],
      /isEventForActiveWorkspace\(/,
      `the '${event}' handler must drop events from other workspaces before refreshing`
    );
  }
});

check('the workspace context re-checks the workspace before mutating', () => {
  const ctx = stripComments(read('src/context/WorkspaceContext.tsx'));
  assert.match(
    ctx,
    /isEventForActiveWorkspace\(\s*event,\s*payload\s*\)/,
    'the socket handler must verify the event belongs to the active workspace'
  );
});

// ── 3. Late replies must not write onto the workspace the user moved to ─────

check('async workspace reads are invalidated by a switch', () => {
  const ctx = stripComments(read('src/context/WorkspaceContext.tsx'));
  assert.match(ctx, /wsGenRef/, 'a generation counter must guard async workspace reads');
  for (const fn of ['refreshContext', 'refreshWorkspaces', 'switchWorkspace']) {
    const start = ctx.indexOf(`const ${fn} = useCallback`);
    assert.ok(start > -1, `${fn} not found in WorkspaceContext`);
    const body = ctx.slice(start, start + 4000);
    assert.ok(
      /isStale\(|wsGenRef\.current !== gen/.test(body),
      `${fn} writes state after an await without checking the workspace is still current`
    );
  }
});

check('the auth status poll discards replies for the previous workspace', () => {
  const auth = stripComments(read('src/context/AuthContext.tsx'));
  const start = auth.indexOf('const poll = async');
  assert.ok(start > -1, 'pairing/desktop poll not found in AuthContext');
  const body = auth.slice(start, auth.indexOf('poll();', start));
  const guards = body.match(/getActiveWorkspaceId\(\)\s*!==\s*wsId/g) || [];
  assert.ok(
    guards.length >= 2,
    `the poll re-checks the active workspace ${guards.length} time(s); every write after an await needs a guard`
  );
});

// ── 4. Sessions survive a 15-minute access token ────────────────────────────

check('the refresh token is stored in SecureStore', () => {
  const api = stripComments(read('src/services/api.ts'));
  assert.match(api, /from 'expo-secure-store'/, 'api.ts must use expo-secure-store');
  assert.match(api, /SecureStore\.setItemAsync\(\s*REFRESH_TOKEN_KEY/, 'refresh token must be written to SecureStore');
  assert.match(api, /SecureStore\.getItemAsync\(\s*REFRESH_TOKEN_KEY/, 'refresh token must be read from SecureStore');
  assert.match(api, /SecureStore\.deleteItemAsync\(\s*REFRESH_TOKEN_KEY/, 'refresh token must be deletable');
});

check('the refresh token never touches AsyncStorage', () => {
  const offenders = [];
  for (const { rel, code } of files) {
    const keyLiterals = /(AsyncStorage|localStorage)\s*\.\s*\w+\s*\([^)]*(refresh[_-]?token|REFRESH_TOKEN_KEY)/i;
    if (keyLiterals.test(code)) offenders.push(rel);
  }
  assert.deepEqual(
    offenders,
    [],
    `refresh token written to unencrypted storage in: ${offenders.join(', ')}`
  );
});

check('one 401 triggers at most one refresh, then one replay', () => {
  const api = stripComments(read('src/services/api.ts'));
  assert.match(
    api,
    /beginSingleFlight\(_refreshSlot,\s*performRefresh\)/,
    'concurrent 401s must await the single in-flight refresh instead of starting their own'
  );
  assert.match(
    api,
    /allowRefresh/,
    'request() needs a flag so the replayed request cannot refresh again'
  );
  assert.match(
    api,
    /return await request<T>\([^)]*false/,
    'the replay must disable a second refresh attempt'
  );
});

check('sign-out happens only when the session is really gone', () => {
  const api = stripComments(read('src/services/api.ts'));
  const start = api.indexOf('if (res.status === 401)');
  assert.ok(start > -1, 'no 401 branch found in api.ts');
  const branch = api.slice(start, start + 800);
  assert.match(branch, /tryRefreshSession\(\)/, 'a 401 must attempt a refresh first');
  assert.match(
    branch,
    /outcome === 'unavailable'/,
    'an unreachable refresh endpoint must not destroy the session'
  );
  const errors = stripComments(read('src/services/apiErrors.ts'));
  assert.match(
    errors,
    /if \(err\.status === 403 \|\| err\.kind === 'forbidden'\) return/,
    'notifyAuthFailure must ignore 403'
  );
});

check('a 403 or RBAC denial never signs the user out', () => {
  const api = stripComments(read('src/services/api.ts'));
  // notifyAuthFailure must be reachable only from the 401 path.
  const calls = [...api.matchAll(/notifyAuthFailure\s*\(/g)];
  assert.ok(calls.length > 0, 'the central 401 handler is no longer called at all');
  for (const call of calls) {
    const before = api.slice(Math.max(0, call.index - 700), call.index);
    const lastStatusBranch = before.lastIndexOf('res.status === ');
    assert.ok(lastStatusBranch > -1, 'notifyAuthFailure is called outside any status branch');
    const status = before.slice(lastStatusBranch).match(/res\.status === (\d+)/)?.[1];
    assert.equal(status, '401', `notifyAuthFailure is reachable from a ${status} response`);
  }
  assert.match(
    api,
    /res\.status === 403[^\n]*\|\|[\s\S]{0,80}toastRbasError|toastRbasError\(err\)/,
    '403 must surface as a toast, not a logout'
  );
  const errors = stripComments(read('src/services/apiErrors.ts'));
  assert.match(errors, /if \(status === 403\) return 'forbidden'/, '403 must never be classified as auth');
});

check('a refresh leaves the selected workspace and company alone', () => {
  const api = stripComments(read('src/services/api.ts'));
  const start = api.indexOf('async function performRefresh');
  assert.ok(start > -1, 'performRefresh not found');
  const body = api.slice(start, api.indexOf('export function tryRefreshSession'));
  assert.ok(
    !/setActiveWorkspaceId|_activeWorkspaceId\s*=|wsCompanyKey|company_data/.test(body),
    'the refresh path must not move the user to another workspace or company'
  );
});

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall workspace isolation checks passed');
