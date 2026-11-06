/**
 * Demo build data layer. Before the app renders, the recorded demo file (EXPO_PUBLIC_DEMO_DATA_URL, default
 * /demo/data.json) seeds the signed-in storage keys, and every request to the backend is answered from it:
 * reads get the recorded response, anything that would change data is refused with a notice.
 */
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { BACKEND_URL } from '../config/backend';
import { DEMO_MODE } from './config';

type DemoData = { storage: Record<string, string>; responses: Record<string, unknown> };

/** Query values that change from day to day (date ranges, cache busters) are not part of a response's key. */
const VOLATILE_PARAM = /^(_|t|ts|nonce|cb|from|to|start|end|startDate|endDate|fromDate|toDate|date|since|until)$/i;
const DATE_VALUE = /^\d{4}-\d{2}-\d{2}|^\d{10,13}$/;

/** Path plus the stable query parameters, sorted: the key a recorded response is stored under. */
export function demoKey(url: string): string {
  const u = new URL(url, 'http://demo.local');
  const params = [...u.searchParams.entries()]
    .filter(([k, v]) => !VOLATILE_PARAM.test(k) && !DATE_VALUE.test(v))
    .sort(([a], [b]) => a.localeCompare(b));
  return params.length ? `${u.pathname}?${new URLSearchParams(params).toString()}` : u.pathname;
}

function lookup(responses: Record<string, unknown>, url: string): unknown {
  const key = demoKey(url);
  if (key in responses) return responses[key];
  // Same endpoint recorded with other parameters (another period, page or filter): closest match wins.
  const [path, query = ''] = key.split('?');
  const wanted = new URLSearchParams(query);
  let best: string | null = null;
  let bestScore = -1;
  for (const k of Object.keys(responses)) {
    const [p, q = ''] = k.split('?');
    if (p !== path) continue;
    const have = new URLSearchParams(q);
    let score = 0;
    wanted.forEach((v, name) => { if (have.get(name) === v) score += 1; });
    if (score > bestScore) { best = k; bestScore = score; }
  }
  return best ? responses[best] : undefined;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let lastNotice = 0;
export function showDemoNotice() {
  const now = Date.now();
  if (now - lastNotice < 1500) return;
  lastNotice = now;
  Toast.show({ type: 'info', text1: 'Not available in the demo', text2: 'Start free to create entries in your own books.' });
}

let ready: Promise<void> | null = null;

/** Installs the demo data layer once; resolves when the signed-in state is seeded. No-op outside the demo build. */
export function startDemo(): Promise<void> {
  if (!DEMO_MODE || Platform.OS !== 'web' || typeof window === 'undefined') return Promise.resolve();
  if (ready) return ready;
  const realFetch = window.fetch.bind(window);
  const dataUrl = process.env.EXPO_PUBLIC_DEMO_DATA_URL || '/demo/data.json';
  const data: Promise<DemoData> = realFetch(dataUrl).then((r) => r.json());

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(BACKEND_URL)) return realFetch(input, init);
    const method = (init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
    if (method !== 'GET') {
      showDemoNotice();
      return json(403, { success: false, code: 'DEMO_READ_ONLY', message: 'Not available in the demo' });
    }
    const { responses } = await data;
    return json(200, lookup(responses, url) ?? { success: true, data: [] });
  };

  ready = data.then(({ storage }) => {
    for (const [k, v] of Object.entries(storage)) {
      try { window.localStorage.setItem(k, v); } catch { /* private mode: the app opens signed out */ }
    }
  }).catch(() => {});
  return ready;
}
