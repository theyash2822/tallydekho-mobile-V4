#!/usr/bin/env node
/**
 * Behaviour (spec 2026-11-04 §4.3): the e-invoice days-left chip, the correction rule, when an invoice made here
 * registers by itself, compliance alert links open the matching screen, the signed QR prints as an image, the GST
 * helpers, and every new string exists in all 11 languages with its placeholders.
 *
 * Run:  npm run verify:compliance-v2
 * Exit: 0 pass · 1 fail
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import {
  daysLeftChip, todayIst, gapType, isInvoiceGap, correctableRow, correctionReason, einvoiceRegistersAppInvoices, isB2cBuyer,
  EWB_EXTRA_KINDS, withDocKind, DELIVERY_NOTE_REASONS, rejectDeadline, canRejectIncoming, recentTurnoverYears, complianceReportFileName,
  pickCalendarRows, previousGstPeriod, shiftGstPeriod, gstPeriodLabel, cashBalanceTotal, correctionPrefillFromVoucher, localIsoDay,
  calendarChip, imsSections, depositPostStatus, depositStatusAfterPost,
} from '../src/utils/complianceRules.ts';
import { complianceLinkRoute, isComplianceAlert, notificationRoute } from '../src/utils/notificationLinks.ts';
import { sanitizeImageSrc } from '../src/utils/sanitizeImageSrc.ts';

// irnQr.ts imports its siblings without an extension, as Metro does; resolve them to .ts here.
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); }
  catch (e) {
    if (specifier.startsWith('.') && !/\\.[cm]?[jt]sx?$/.test(specifier)) return next(specifier + '.ts', context);
    throw e;
  }
}`));
const { irnQrDataUrl, withIrnQrImage } = await import('../src/utils/irnQr.ts');

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

await check('days-left chip: gray above 10, amber 4–10, red 0–3, last day, window closed', () => {
  assert.deepEqual(daysLeftChip({ days_left: 15, urgency: 'ok' }), { tone: 'gray', label: 'daysLeft', count: 15 });
  assert.deepEqual(daysLeftChip({ days_left: 10 }), { tone: 'amber', label: 'daysLeft', count: 10 });
  assert.deepEqual(daysLeftChip({ days_left: 4 }), { tone: 'amber', label: 'daysLeft', count: 4 });
  assert.deepEqual(daysLeftChip({ days_left: 3 }), { tone: 'red', label: 'daysLeft', count: 3 });
  assert.deepEqual(daysLeftChip({ days_left: 1 }), { tone: 'red', label: 'dayLeft', count: 1 });
  assert.deepEqual(daysLeftChip({ days_left: 0, urgency: 'urgent' }), { tone: 'red', label: 'lastDay', count: 0 });
  assert.equal(daysLeftChip({ days_left: -2 }).label, 'windowClosed');
  assert.equal(daysLeftChip({ days_left: 6, urgency: 'expired' }).label, 'windowClosed');
  assert.equal(daysLeftChip({}), null);
  assert.equal(daysLeftChip({ days_left: null, urgency: 'ok' }), null);
});

await check('Correct invoice: today-dated, no IRN, not TallyPrime\'s, invoice-level gaps only (web GapFixDrawer rule)', () => {
  const today = todayIst(Date.UTC(2026, 10, 4, 20, 0));
  assert.equal(today, '2026-11-05', 'IST rolls over at 18:30 UTC');
  assert.equal(correctableRow({ date: '2026-11-05', irn: null }, today), true);
  assert.equal(correctableRow({ date: '2026-11-05T00:00:00Z' }, today), true);
  assert.equal(correctableRow({ date: '2026-11-04' }, today), false, 'yesterday stays "correct in Tally"');
  assert.equal(correctableRow({ date: '2026-11-05', irn: 'x' }, today), false);
  assert.equal(correctableRow({ date: '2026-11-05', source: 'tally' }, today), false);
  for (const type of ['tally_voucher', 'no_lines', 'portal', 'dispatch', 'other']) assert.equal(isInvoiceGap({ code: 'X', fix: { type } }), true, type);
  for (const type of ['stock_item_hsn', 'party', 'company', 'tally_numbering', 'ledger_hsn', 'too_old', 'einvoice_first']) assert.equal(isInvoiceGap({ code: 'X', fix: { type } }), false, type);
  assert.equal(gapType({ code: 'PORTAL_REJECTED' }), 'portal');
  assert.equal(correctionReason([{ code: 'HSN_MISSING', message: 'a' }, { code: 'PORTAL_REJECTED', message: 'NIC 2240: total mismatch' }]), 'NIC 2240: total mismatch');
  assert.equal(correctionReason([{ code: 'TOTAL_MISMATCH', message: 'x' }]), undefined);
});

await check('correction prefill: lines, GST ledgers at the voucher rate, dispatch from the app payload', () => {
  const p = correctionPrefillFromVoucher({
    voucher: { voucher_number: 'INV-2', party_name: 'Acme Traders', reference: 'PO-9', narration: 'n' },
    items: [
      { stock_item_name: 'Rice', actual_qty: '10 Kg', rate: '50.00/Kg', amount: '-500', unit: 'Kg', godown_name: 'Main', hsn: '1006', sales_ledger: 'Sales GST' },
      { stock_item_name: 'Dal', billed_qty: 5, amount: 500, unit: 'Kg' },
    ],
    ledger_entries: [{ ledger_name: 'Acme Traders', amount: 1180 }, { ledger_name: 'Output CGST', amount: -90 }, { ledger_name: 'Output SGST', amount: -90 }],
    dispatch_details: { dispatch_from: 'Pune', dispatch_from_state: 'Maharashtra', ship_to_pincode: '400001', vehicle_number: 'MH12AB1234' },
  });
  assert.equal(p.voucherNumber, 'INV-2');
  assert.equal(p.party, 'Acme Traders');
  assert.equal(p.ledger, 'Sales GST');
  assert.deepEqual(p.lines.map((l) => [l.product, l.qty, l.rate, l.warehouse, l.hsn]), [['Rice', '10', '50', 'Main', '1006'], ['Dal', '5', '100', '', undefined]]);
  assert.deepEqual(p.lines[0].taxes, [{ ledgerName: 'Output CGST', taxRate: '9' }, { ledgerName: 'Output SGST', taxRate: '9' }]);
  assert.equal(p.dispatch.dispatchFrom, 'Pune');
  assert.equal(p.dispatch.shipToPincode, '400001');
  assert.equal(correctionPrefillFromVoucher({ items: [] }), null);
  assert.equal(correctionPrefillFromVoucher({ voucher: { voucher_number: 'A' }, items: [] }).dispatch, null);
});

await check('"registered automatically" note: applicable and auto / auditer, or follow_mode in Auto; never B2C', () => {
  const base = { e_invoice_applicable: 'applicable_configured' };
  assert.equal(einvoiceRegistersAppInvoices({ ...base, e_invoice_app_invoices_effective: 'auto' }), true);
  assert.equal(einvoiceRegistersAppInvoices({ ...base, e_invoice_source: 'tally', e_invoice_app_invoices_effective: 'auditer' }), true);
  assert.equal(einvoiceRegistersAppInvoices({ ...base, e_invoice_app_invoices_effective: 'follow_mode', e_invoice_mode: 'auto' }), true);
  assert.equal(einvoiceRegistersAppInvoices({ ...base, e_invoice_app_invoices_effective: 'follow_mode', e_invoice_mode: 'manual' }), false);
  assert.equal(einvoiceRegistersAppInvoices({ ...base, e_invoice_source: 'tally', e_invoice_app_invoices_effective: 'tally', e_invoice_mode: 'auto' }), false);
  assert.equal(einvoiceRegistersAppInvoices({ e_invoice_applicable: 'not_applicable', e_invoice_app_invoices_effective: 'auto' }), false);
  assert.equal(einvoiceRegistersAppInvoices({ e_invoice_applicable: 'applicable_not_configured', e_invoice_app_invoices_effective: 'auto' }), false);
  assert.equal(einvoiceRegistersAppInvoices(null), false);
  assert.equal(isB2cBuyer('', 'Unregistered/Consumer'), true);
  assert.equal(isB2cBuyer('', ''), true);
  assert.equal(isB2cBuyer('', 'Overseas'), false, 'exports are e-invoiced');
  assert.equal(isB2cBuyer('', 'Regular'), false, 'a registered party without GSTIN stays a gap');
  assert.equal(isB2cBuyer('27AABCU9603R1ZM', ''), false);
});

await check('e-way bill: documents tracked keep the Settings order; delivery-note reasons; reject deadline from reject_by', () => {
  assert.deepEqual([...EWB_EXTRA_KINDS], ['delivery_note', 'job_work', 'purchase_return', 'inward_unregistered', 'stock_transfer']);
  assert.deepEqual(withDocKind(['job_work', 'delivery_note'], 'stock_transfer', true), ['delivery_note', 'job_work', 'stock_transfer']);
  assert.deepEqual(withDocKind(['delivery_note', 'job_work', 'bogus'], 'delivery_note', false), ['job_work']);
  assert.deepEqual([...DELIVERY_NOTE_REASONS], ['4', '5', '10', '12', '11', '8']);
  assert.equal(rejectDeadline(1_762_250_000).getTime(), 1_762_250_000_000, 'reject_by is epoch seconds');
  assert.equal(rejectDeadline(null), null);
  assert.equal(rejectDeadline(0), null);
  assert.equal(canRejectIncoming(1_000, 999_999), true, 'open until the very second of reject_by (no rounding to hours)');
  assert.equal(canRejectIncoming(1_000, 1_000_000), false);
  assert.equal(canRejectIncoming(null, 5), true, 'no deadline: the portal decides');
  assert.equal(complianceReportFileName('ewaybill', 'Yash Ki Company Pvt. Ltd.', 'ready', '2026-11-04'), 'ewaybill-Yash-Ki-Company-Pvt-Ltd-ready-2026-11-04.csv');
  assert.equal(complianceReportFileName('einvoice', '', 'attention', '2026-11-04'), 'einvoice-company-attention-2026-11-04.csv');
});

await check('compliance alert links (push data.link) open the matching app screen', () => {
  assert.equal(isComplianceAlert({ type: 'compliance_einvoice_deadline' }), true);
  assert.equal(isComplianceAlert({ type: 'payment_reminder' }), false);
  const cases = [
    ['/compliance/einvoice?tab=attention', '/reports/einvoice-list?tab=attention'],
    ['/compliance/einvoice?tab=ready', '/reports/einvoice-list?tab=ready'],
    ['/compliance/einvoice?tab=failed', '/reports/einvoice-list?tab=attention'],
    ['/compliance/einvoice', '/reports/einvoice-list'],
    ['/compliance/eway-bill?tab=incoming', '/reports/ewb-list?tab=incoming'],
    ['/compliance/eway-bill?ewb=123456789012', '/reports/ewb-list?tab=generated'],
    ['/compliance/gst?tab=deposits', '/reports/gst?tab=deposits'],
    ['/compliance/gst', '/reports/gst'],
    ['/settings/einvoice', '/settings/einvoice'],
    ['/settings/gst', '/settings/gst'],
    ['/settings/tally-sync', '/settings/tally-sync'],
    ['https://app.auditer.com/compliance/gst?tab=ims', '/reports/gst?tab=ims'],
  ];
  for (const [link, route] of cases) assert.equal(complianceLinkRoute(link), route, link);
  assert.equal(complianceLinkRoute('/settings/unknown'), null);
  assert.equal(complianceLinkRoute(''), null);
  assert.equal(complianceLinkRoute('javascript:alert(1)'), null);
});

await check('derived notification targets open the tab they name; older routes keep their list', () => {
  assert.equal(notificationRoute({ target: { kind: 'page', page: 'einvoice', filter: 'ready' } }), '/reports/einvoice-list?tab=ready');
  assert.equal(notificationRoute({ target: { kind: 'page', page: 'eway-bill', filter: 'incoming' } }), '/reports/ewb-list?tab=incoming');
  assert.equal(notificationRoute({ target: { kind: 'page', page: 'eway-bill', filter: 'pending' } }), '/reports/ewb-list?status=pending');
  assert.equal(notificationRoute({ target: { kind: 'settings', page: 'tally-sync' } }), '/settings/tally-sync');
  assert.equal(notificationRoute({ route: '/compliance/einvoice?tab=attention' }), '/reports/einvoice-list?tab=attention');
  assert.equal(notificationRoute({ route: '/settings/einvoice' }), '/reports/einvoice-list?status=pending');
});

await check('signed QR (JWT text) becomes a printable SVG image; the IRN band gets it only with an IRN', async () => {
  const jwt = `eyJhbGciOiJSUzI1NiIsImtpZCI6IjE1MTNCODIxRUU0NkJEMzk3NjZDODRBQ0E4QTlBNzRBMjhCQzEyQjAifQ.${'e'.repeat(1500)}.${'s'.repeat(342)}`;
  const url = await irnQrDataUrl(jwt);
  assert.match(url, /^data:image\/svg\+xml;base64,/);
  assert.equal(sanitizeImageSrc(url), url, 'passes the print sanitizer');
  assert.match(Buffer.from(url.split(',')[1], 'base64').toString('utf8'), /^<svg/);
  assert.equal(await irnQrDataUrl('  '), null);
  assert.equal(await irnQrDataUrl('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
  const doc = { id: '1', documentType: 'sales_invoice', documentTitle: 'Tax Invoice', documentNumber: 'INV-1', date: '', company: { name: 'A' }, totals: {}, tallyMeta: { irn: 'f'.repeat(64), irnSignedQr: jwt } };
  assert.match((await withIrnQrImage(doc)).tallyMeta.irnQrImage, /^data:image\/svg\+xml;base64,/);
  const noIrn = { ...doc, tallyMeta: { irnSignedQr: jwt } };
  assert.equal((await withIrnQrImage(noIrn)).tallyMeta.irnQrImage, undefined);
});

await check('the voucher PDF builders and the acknowledgement sheets draw the QR', () => {
  assert.match(read('src/utils/voucherPdf.ts'), /generateDocumentHTML\(\s*await withIrnQrImage\(doc\)/);
  assert.match(read('src/utils/voucherPdf.ts'), /qrImage: await irnQrDataUrl\(voucher\.qrImage\)/);
  assert.match(read('src/utils/multiShare.ts'), /await withIrnQrImage\(toVoucherDocument\(/);
  assert.match(read('src/utils/multiShare.ts'), /qrImage: await irnQrDataUrl\(vouchers\[i\]\.qrImage\)/);
  assert.match(read('src/utils/voucherDocumentAdapter.ts'), /irnSignedQr: v\.irn \? \(data\.e_invoice\?\.qr_code/);
  assert.match(read('src/utils/pdf/complianceSheet.ts'), /qrImage: sanitizeImageSrc\(v\.qrImage\)/);
});

await check('GST helpers: due dates worth a glance, return periods, cash ledger total', () => {
  const rows = [
    { form: 'GSTR-1', due_date: '2026-10-11', status: 'filed' },
    { form: 'GSTR-3B', due_date: '2026-11-20', status: 'upcoming' },
    { form: 'GSTR-1', due_date: '2026-11-11', status: 'due' },
    { form: 'GSTR-3B', due_date: '2026-10-20', status: 'overdue' },
    { form: 'GSTR-1', due_date: '2026-09-11', status: 'filed' },
  ];
  assert.deepEqual(pickCalendarRows(rows, 4).map((r) => `${r.form}:${r.status}`), ['GSTR-3B:overdue', 'GSTR-1:due', 'GSTR-3B:upcoming', 'GSTR-1:filed']);
  assert.equal(pickCalendarRows(rows, 4)[3].due_date, '2026-10-11', 'latest filed first');
  assert.equal(previousGstPeriod(new Date(2026, 0, 15)), '122025');
  assert.equal(shiftGstPeriod('122025', 1), '012026');
  assert.equal(shiftGstPeriod('012026', -1), '122025');
  assert.equal(gstPeriodLabel('102026'), 'Oct 2026');
  assert.equal(cashBalanceTotal({ igst: 100, cgst: 50, sgst: 50 }), 200);
  assert.equal(cashBalanceTotal({ total: 48200 }), 48200);
  assert.equal(cashBalanceTotal(1200), 1200);
  assert.equal(cashBalanceTotal(null), null);
  assert.equal(localIsoDay(new Date(2026, 10, 4, 23, 30)), '2026-11-04');
  assert.deepEqual(recentTurnoverYears([{ fy: '2024-25', fy_start: 2024 }, { fy: '2026-27', fy_start: 2026 }, { fy: '2022-23', fy_start: 2022 }, { fy: '2025-26', fy_start: 2025 }], 3).map((y) => y.fy), ['2024-25', '2025-26', '2026-27']);
});

await check('GST: a guessed status stays neutral, IMS chips per section, deposit posting state', () => {
  assert.deepEqual(calendarChip({ status: 'overdue', status_known: false }), { label: 'unknown', tone: 'muted' });
  assert.deepEqual(calendarChip({ status: 'due', status_known: false }), { label: 'due', tone: 'muted' }, 'due keeps its label, not orange');
  assert.deepEqual(calendarChip({ status: 'due' }), { label: 'due', tone: 'pending' });
  assert.deepEqual(calendarChip({ status: 'overdue' }), { label: 'overdue', tone: 'failed' });
  assert.deepEqual(calendarChip({ status: 'filed', status_known: false }), { label: 'filed', tone: 'generated' });
  assert.deepEqual(calendarChip({ status: 'whatever' }), { label: 'upcoming', tone: 'muted' });
  assert.deepEqual(
    imsSections([{ key: 'B2B', label: 'B2B invoices', count: 4 }, { key: 'B2BCN', count: '2' }, { label: 'no key' }, null]),
    [{ key: 'B2B', label: 'B2B invoices', count: 4 }, { key: 'B2BCN', label: 'B2BCN', count: 2 }],
  );
  assert.deepEqual(imsSections(undefined), []);
  assert.equal(depositPostStatus({ post_status: 'failed', posted: false }), 'failed');
  assert.equal(depositPostStatus({ post_status: 'unknown', posted: true }), 'unknown');
  assert.equal(depositPostStatus({ posted: true }), 'queued');
  assert.equal(depositPostStatus({}), 'not_posted');
  assert.equal(depositStatusAfterPost('success'), 'posted');
  assert.equal(depositStatusAfterPost('queued'), 'queued');
  assert.equal(depositStatusAfterPost('unconfirmed'), 'unknown');
});

await check('screens: IMS all sections and Reject confirm, deposits Post again / confirm, reject_by on incoming, B2C count', () => {
  const gst = read('src/components/compliance/GstPanels.tsx');
  assert.match(gst, /getGstIms\(companyGuid, period\)/, 'IMS asks for every section');
  assert.match(gst, /testID=\{`ims-section-\$\{s\.key \|\| 'all'\}`\}/);
  assert.match(gst, /sectionLabel\(r\.section\)/, 'each row says its section');
  assert.match(gst, /t\('screens\.reportsGst\.imsRejectTitle'\)[\s\S]*?style: 'destructive', onPress: \(\) => decide\(row, action\)/);
  assert.match(gst, /const showPost = canSubmit && r\.can_post === true && status !== 'unknown'/);
  assert.match(gst, /onPress=\{\(\) => confirmPost\(r, status === 'failed'\)\}/);
  assert.match(gst, /t\('screens\.reportsGst\.postConfirmTitle'\)/);
  assert.match(gst, /status === 'unknown' && \([\s\S]*?screens\.reportsGst\.postUnknown/);
  const ewb = read('app/reports/ewb-list.tsx');
  assert.match(ewb, /rejectDeadline\(b\.reject_by\)/);
  assert.match(ewb, /canRejectIncoming\(b\.reject_by, incomingAt\)/);
  assert.match(ewb, /decideIncoming\(ewbNo, 'reject', b\.reject_by\)/);
  assert.doesNotMatch(ewb, /hours_left_to_reject/);
  const einv = read('app/reports/einvoice-list.tsx');
  assert.match(einv, /tab !== 'generated' && Number\(counts\.b2c_excluded\) > 0/);
  assert.match(einv, /testID="einvoice-b2c-excluded"/);
});

await check('screens: GST settings entry, questions before configuration, correction submit, stored incoming, alerts', () => {
  const settings = read('app/settings/index.tsx');
  assert.match(settings, /\{ id: 'gst', label: 'GST Returns', icon: 'document-text-outline', route: '\/settings\/gst' \}/);
  assert.match(settings, /sub\.id === 'ewaybill' \|\| sub\.id === 'einvoice' \|\| sub\.id === 'gst'\) && !\(isOwnerOrAdmin \|\| hasCapability\('integrations\.configure'\)\)/);
  const integration = read('src/components/compliance/IntegrationSettingsScreen.tsx');
  assert.doesNotMatch(integration, /setOptOut|optOutHelp/, 'the old Not applicable switch is gone');
  assert.match(integration, /e_invoice_turnover: v \? 'above_5cr' : 'below_5cr'/);
  assert.match(integration, /e_invoice_aato_10cr: v/);
  assert.match(integration, /e_way_bill_moves_goods: v/);
  assert.match(integration, /e_invoice_app_invoices: key/);
  assert.match(integration, /e_way_bill_doc_kinds: withDocKind/);
  assert.match(integration, /e_way_bill_intra_limit: value/);
  const invoice = read('app/sales/create-invoice.tsx');
  assert.match(invoice, /correctSalesInvoice\(\{\s*\.\.\.payload,\s*voucherGuid: correctGuid,\s*isOptional: false,\s*original_entry_type: 'regular',\s*date: todayIst\(\),/);
  assert.match(invoice, /testID="correction-banner"/);
  assert.match(invoice, /testID="einvoice-auto-note"/);
  assert.match(read('src/services/api.ts'), /correctSalesInvoice = \(payload: any\) => tallyPost<any>\('\/voucher\/sales-correct'/);
  assert.match(read('app/reports/ewb-list.tsx'), /listStoredIncomingEwbs\(companyGuid\)/);
  assert.match(read('src/services/pushNotifications.ts'), /isComplianceAlert\(data\)\s*\?\s*\(complianceLinkRoute\(data\.link\) \|\| '\/reports\/compliance'\)/);
  assert.match(read('app/settings/compliance-reminders.tsx'), /<ComplianceAlertsCard canManage=\{isOwnerOrAdmin\} \/>/);
  assert.match(read('app/ledger/create.tsx'), /<PartyForm ref=\{formRef\} verifyCompanyGuid=/);
});

// Every string the compliance v2 screens added, in all 11 languages.
const NEW_KEYS = {
  settings: ['gst'],
  'screens.settingsEinvoice': ['answerHint', 'requiredTitle', 'turnoverQ', 'aatoQ', 'aatoHelp', 'fromBooks', 'fyLabel', 'fySoFar', 'panNote', 'notApplicableTitle', 'notApplicableBody', 'appInvTitle', 'appInvSub',
    ...['auto', 'follow_mode', 'auditer', 'tally'].flatMap((k) => [`appInv_${k}`, `appInv_${k}Help`])],
  'screens.settingsEwb': ['movesGoodsQ', 'movesGoodsHelp', 'notApplicableBody', 'docsTitle', 'docsHelp', 'docsStockNote', 'limitTitle', 'limitStateFallback', 'limitOwn', 'limitDefault', 'limitAcross', 'limitChange', 'limitUseDefault', 'limitAmount'],
  'screens.settingsGst': ['selectCompany', 'loadFailed', 'saveFailed', 'notConfigured', 'connection', 'statusConnected', 'statusExpired', 'statusNotConnected', 'connectedUntil', 'disconnect', 'disconnectTitle', 'disconnectMsg',
    'stepsTitle', 'step1', 'step2', 'step3', 'username', 'usernamePh', 'connect', 'otpSent', 'connectFailed', 'connected', 'otpTitle', 'otpHelp', 'otp', 'keepConnected', 'keepConnectedHelp', 'day', 'days', 'resendOtp',
    'returnsTitle', 'returnsSub', ...['prepare', 'draft', 'file'].flatMap((k) => [`returns_${k}`, `returns_${k}Help`]), 'imsTitle', ...['decide', 'view'].flatMap((k) => [`ims_${k}`, `ims_${k}Help`]),
    'depositsTitle', ...['show', 'button', 'auto'].flatMap((k) => [`deposit_${k}`, `deposit_${k}Help`]), 'debitLedger', 'bankLedger', 'selectLedger', 'ledgersNeeded', 'frequencyTitle', 'freqPortal', 'freqMonthly', 'freqQuarterly', 'portalSays', 'fileOnWeb'],
  'screens.reportsEinvoiceList': ['windowClosed', 'lastDayToday', 'dayLeft', 'daysLeft', 'staleDesktop', 'staleDesktopNoHours', 'rule30Unanswered', 'shareReport', 'reportFailed', 'correctHere', 'correctInvoice',
    'b2cExcluded_one', 'b2cExcluded_other'],
  'screens.reportsEwbList': [...EWB_EXTRA_KINDS.map((k) => `kind_${k}`), 'checkVehicle', 'vehicleCheckFailed', 'vehicleInsurance', 'vehiclePuc', 'vehicleFitness', 'vehicleOwner', 'vehicleNotFound', 'distanceOptional', 'distanceHint',
    'distanceResult', 'distanceWorkedOut', 'reasonTitle', ...DELIVERY_NOTE_REASONS.map((c) => `reason_${c}`), 'reasonDesc', 'receivingGodown', 'receivingGodownName', 'fromGodown', 'godownAddress', 'rejectBy', 'rejectClosed', 'last3Days', 'lastChecked', 'emptyIncomingStored'],
  'screens.reportsGst': ['overviewTitle', 'notConfigured', 'overviewFailed', 'connectInSettings', 'dueDates', 'dueOn', 'filedOn', ...['filed', 'due', 'overdue', 'upcoming', 'unknown'].map((s) => `status_${s}`), 'score', 'scoreOutOf', 'deposits',
    'cashBalance', 'lastDeposit', 'imsFailed', 'imsViewOnly', 'imsEmpty', 'imsAccept', 'imsReject', 'imsPending', ...['accepted', 'rejected', 'pending', 'none'].map((s) => `ims_${s}`), 'inBooks', 'notInBooks', 'depositsFailed',
    'depositsShowNote', 'depositsAutoNote', 'depositsEmpty', 'postToTally', 'posted', 'postedVoucher', 'sentToTally',
    'imsRejectTitle', 'imsRejectMsg', 'postConfirmTitle', 'postConfirmMsg', 'postAgain', 'postFailed', 'postUnknown'],
  'screens.settingsComplianceReminders': ['alertsTitle', 'alertsSub', 'alertsLoadFailed', 'whatsappPending', 'groupGeneral', 'hoursBeforeExpiry',
    ...['einvoice_deadline', 'einvoice_expired', 'auto_failure', 'ewb_expiry', 'ewb_incoming', 'gst_due', 'gst_deposit', 'gst_session', 'desktop_stale', 'turnover'].flatMap((k) => [`alert_${k}`, `alert_${k}Help`])],
  'screens.componentsFormsPartyForm': ['verify', 'verifyFailed', 'verifyUnavailable', 'gstinCancelled', 'gstinNotFound'],
  'screens.salesCreateInvoice': ['correctTitle', 'correctInvoice', 'correctBanner', 'thisInvoice', 'portalSaid', 'correctNotFound', 'correctLoadFailed', 'correctedTitle', 'correctedSub', 'einvoiceAutoNote'],
};
const USED_KEYS = Object.entries(NEW_KEYS).flatMap(([ns, keys]) => keys.map((k) => `${ns}.${k}`));

await check('every new string exists in all 11 languages, placeholders intact', () => {
  assert.equal(USED_KEYS.length, 227);
  const en = locale('en');
  const vars = (s) => [...String(s).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',');
  for (const lang of ['en', 'bn', 'gu', 'hi', 'kn', 'ml', 'mr', 'or', 'pa', 'ta', 'te']) {
    const strings = locale(lang);
    const missing = USED_KEYS.filter((key) => typeof lookup(strings, key) !== 'string' || !lookup(strings, key).trim());
    assert.deepEqual(missing, [], `${lang} is missing ${missing.join(', ')}`);
    const broken = USED_KEYS.filter((key) => vars(lookup(strings, key)) !== vars(lookup(en, key)));
    assert.deepEqual(broken, [], `${lang} placeholders differ in ${broken.join(', ')}`);
  }
});

if (failures.length) {
  console.error(`\n${failures.length} failed`);
  process.exit(1);
}
console.log('\nAll compliance v2 checks passed');
