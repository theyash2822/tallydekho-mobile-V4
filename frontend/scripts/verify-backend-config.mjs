#!/usr/bin/env node
/**
 * Guard: a staging build must never talk to the production backend.
 *
 * The mobile app previously resolved its backend in two separate files, each
 * falling back to https://api.tallydekho.com in any release build where
 * EXPO_PUBLIC_BACKEND_URL was missing. A staging APK built that way would have
 * written real customer data during QA.
 *
 * Run:  npm run verify:config
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

globalThis.__DEV__ = false;
const backend = await import(path.join(root, 'src/config/backend.ts'));
const { resolveAppEnv, resolveBackendUrl, PRODUCTION_BACKEND_URL } = backend;

console.log('mobile backend configuration guard');

check('staging build refuses to fall back to production', () => {
  assert.throws(
    () => resolveBackendUrl({ EXPO_PUBLIC_APP_ENV: 'staging' }, false),
    /requires EXPO_PUBLIC_BACKEND_URL/
  );
});

check('staging build refuses an explicit production URL', () => {
  assert.throws(
    () =>
      resolveBackendUrl(
        { EXPO_PUBLIC_APP_ENV: 'staging', EXPO_PUBLIC_BACKEND_URL: PRODUCTION_BACKEND_URL },
        false
      ),
    /pointed at the production backend/
  );
});

check('staging build accepts the staging URL', () => {
  assert.equal(
    resolveBackendUrl(
      {
        EXPO_PUBLIC_APP_ENV: 'staging',
        EXPO_PUBLIC_BACKEND_URL: 'https://staging-api.tallydekho.com',
      },
      false
    ),
    'https://staging-api.tallydekho.com'
  );
});

check('production release still resolves to production', () => {
  assert.equal(resolveBackendUrl({ EXPO_PUBLIC_APP_ENV: 'production' }, false), PRODUCTION_BACKEND_URL);
  assert.equal(resolveBackendUrl({}, false), PRODUCTION_BACKEND_URL);
});

check('dev build stays on the LAN backend', () => {
  assert.equal(resolveAppEnv({}, true), 'development');
  assert.ok(!resolveBackendUrl({}, true).includes('api.tallydekho.com'));
});

check('eas.json staging profile targets a non-production backend', () => {
  const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
  const staging = eas.build?.staging;
  assert.ok(staging, 'eas.json is missing a staging build profile');
  assert.equal(staging.env?.EXPO_PUBLIC_APP_ENV, 'staging');
  const url = staging.env?.EXPO_PUBLIC_BACKEND_URL;
  assert.ok(url, 'staging profile must set EXPO_PUBLIC_BACKEND_URL explicitly');
  assert.ok(
    !/^https?:\/\/api\.tallydekho\.com/i.test(url),
    `staging profile points at production: ${url}`
  );
  // Resolving the profile's own env must succeed.
  assert.equal(resolveBackendUrl(staging.env, false), url.replace(/\/+$/, ''));
});

check('production profile is explicit about its environment', () => {
  const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
  assert.equal(eas.build?.production?.env?.EXPO_PUBLIC_APP_ENV, 'production');
});

check('the production URL appears only in the central config module', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        const rel = path.relative(root, full);
        if (rel === path.join('src', 'config', 'backend.ts')) continue;
        if (fs.readFileSync(full, 'utf8').includes('api.tallydekho.com')) offenders.push(rel);
      }
    }
  };
  walk(path.join(root, 'src'));
  walk(path.join(root, 'app'));
  assert.deepEqual(offenders, [], `hardcoded backend URL outside central config: ${offenders.join(', ')}`);
});

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall backend configuration checks passed');
