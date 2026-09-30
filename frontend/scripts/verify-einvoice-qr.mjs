/**
 * Parser fixtures for src/utils/einvoiceQr.ts.
 * Tokens here are standards-shaped with fake signatures — parser coverage only,
 * never evidence of IRP trust.
 */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { parseEinvoiceQr, einvoiceDateToFormDate } from '../src/utils/einvoiceQr.ts';

const b64u = (s) => Buffer.from(s, 'utf8').toString('base64url');
const FAKE_SIG = b64u('x'.repeat(256));
const HEADER = { alg: 'RS256', kid: 'TEST', typ: 'JWT' };

const SUMMARY = {
  SellerGstin: '29AAAPL1234C1Z5',
  BuyerGstin: '27AABCU9603R1ZM',
  DocNo: 'INV/24-25/0042',
  DocTyp: 'INV',
  DocDt: '15/09/2026',
  TotInvVal: 118000.5,
  ItemCnt: 3,
  MainHsnCode: '0808',
  Irn: 'a'.repeat(64),
  IrnDt: '2026-09-15 10:20:00',
};

const token = (data, header = HEADER, sig = FAKE_SIG) =>
  `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify({ data, iss: 'NIC' }))}.${sig}`;

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`ok - ${name}`); };

t('valid NIC-shaped token (data as JSON string)', () => {
  const r = parseEinvoiceQr(`  ${token(JSON.stringify(SUMMARY))}\n`);
  assert.equal(r.kind, 'ok');
  assert.equal(r.summary.docNo, 'INV/24-25/0042');
  assert.equal(r.summary.mainHsnCode, '0808');
  assert.equal(r.summary.totalInvoiceValue, 118000.5);
  assert.equal(r.summary.itemCount, 3);
  assert.equal(r.summary.issuer, 'NIC');
});

t('data as object adapter', () => {
  assert.equal(parseEinvoiceQr(token(SUMMARY)).kind, 'ok');
});

t('single-quoted pseudo-JSON inner data rejected (no permissive repair)', () => {
  const pyStr = JSON.stringify(SUMMARY).replace(/"/g, "'");
  assert.equal(parseEinvoiceQr(token(pyStr)).kind, 'malformed');
});

t('alg none rejected', () => {
  assert.equal(parseEinvoiceQr(token(JSON.stringify(SUMMARY), { alg: 'none' })).kind, 'not_einvoice');
});

t('login-style JWT rejected', () => {
  const jwt = `${b64u(JSON.stringify(HEADER))}.${b64u(JSON.stringify({ sub: 'u1', exp: 1 }))}.${FAKE_SIG}`;
  assert.equal(parseEinvoiceQr(jwt).kind, 'not_einvoice');
});

t('UPI / URL / barcode / plain JSON → not_einvoice', () => {
  for (const s of ['upi://pay?pa=a@b', 'https://example.com', '8901234567890', JSON.stringify(SUMMARY)]) {
    assert.equal(parseEinvoiceQr(s).kind, 'not_einvoice', s);
  }
});

t('invalid date / GSTIN / IRN / total → malformed', () => {
  assert.equal(parseEinvoiceQr(token(JSON.stringify({ ...SUMMARY, DocDt: '31/02/2026' }))).kind, 'malformed');
  assert.equal(parseEinvoiceQr(token(JSON.stringify({ ...SUMMARY, SellerGstin: 'BAD' }))).kind, 'malformed');
  assert.equal(parseEinvoiceQr(token(JSON.stringify({ ...SUMMARY, Irn: 'xyz' }))).kind, 'malformed');
  assert.equal(parseEinvoiceQr(token(JSON.stringify({ ...SUMMARY, TotInvVal: '100' }))).kind, 'malformed');
});

t('URP buyer → not usable for purchase', () => {
  assert.equal(parseEinvoiceQr(token(JSON.stringify({ ...SUMMARY, BuyerGstin: 'URP' }))).kind, 'not_einvoice');
});

t('full SignedInvoice shape rejected as QR summary', () => {
  assert.equal(parseEinvoiceQr(token(JSON.stringify({ ...SUMMARY, ItemList: [] }))).kind, 'not_einvoice');
});

t('oversize input bounded', () => {
  assert.equal(parseEinvoiceQr('a.'.repeat(5000) + 'a').kind, 'malformed');
});

t('__proto__ key does not pollute', () => {
  const r = parseEinvoiceQr(token(JSON.stringify(SUMMARY).replace('{', '{"__proto__":{"polluted":1},')));
  assert.equal(r.kind, 'ok');
  assert.equal(({}).polluted, undefined);
});

t('non-ASCII UTF-8 in DocNo decoded strictly', () => {
  const r = parseEinvoiceQr(token(JSON.stringify({ ...SUMMARY, DocNo: 'इन्व-1' })));
  assert.equal(r.kind, 'ok');
  assert.equal(r.summary.docNo, 'इन्व-1');
});

t('date conversion DD/MM/YYYY → DD/MM/YY', () => {
  assert.equal(einvoiceDateToFormDate('15/09/2026'), '15/09/26');
});

console.log(`\n${n} einvoice QR parser checks passed`);
