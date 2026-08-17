/** Prefill Create Invoice from a Proforma (same Tally voucher on submit). */

function nid() {
  return Date.now().toString() + Math.random().toString(36).slice(2);
}

export function isoToDMY(iso: string): string {
  if (!iso) return '';
  if (iso.includes('/')) return iso;
  const parts = String(iso).split('T')[0].split('-');
  if (parts.length < 3) return '';
  const [y, m, d] = parts;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y.slice(-2)}`;
}

export function proformaPrefillStorageKey(companyGuid: string) {
  return `tdprf_to_invoice_prefill_${companyGuid}`;
}

function mapTaxEntries(list: any[] | undefined) {
  return (list || []).map((t: any) => ({
    id: t.id || nid(),
    ledgerName: t.ledgerName || '',
    taxRate: String(t.taxRate ?? t.rate ?? ''),
    taxAmount: String(t.taxAmount ?? t.total ?? ''),
  }));
}

function mapApiItems(apiItems: any[]) {
  return apiItems.map((it: any) => ({
    id: nid(),
    warehouse: it.godown || it.warehouse || '',
    product: it.itemName || it.product || it.name || '',
    qty: String(it.billedQty ?? it.actualQty ?? it.qty ?? 1),
    unit: it.unit || 'pcs',
    rate: String(it.rate || 0),
    discountType: (it.discountType === 'flat' ? 'flat' : '%') as '%' | 'flat',
    discount: String(it.discount ?? 0),
    taxEntries: Array.isArray(it.taxEntries) ? mapTaxEntries(it.taxEntries) : [],
  }));
}

function mapApiLogistics(logs: any[]) {
  return (logs || []).map((lg: any) => ({
    id: nid(),
    ledgerName: lg.ledgerName || '',
    amount: String(lg.amount ?? ''),
    addTaxes: Array.isArray(lg.taxes) && lg.taxes.length > 0,
    taxEntries: mapTaxEntries(lg.taxes),
  }));
}

export function buildProformaToInvoicePrefillFromPreview(rawData: any, tdkRef: string) {
  const rawPayload = rawData?.rawPayload || {};
  const pending = 'Pending from TallyPrime';
  const tallyNo = rawData?.documentNumber && rawData.documentNumber !== pending
    ? rawData.documentNumber
    : '';

  let items;
  if (Array.isArray(rawPayload.items) && rawPayload.items.length) {
    items = mapApiItems(rawPayload.items);
    if (items[0] && (!items[0].taxEntries || items[0].taxEntries.length === 0)
        && Array.isArray(rawPayload.taxes) && rawPayload.taxes.length) {
      items[0] = { ...items[0], taxEntries: mapTaxEntries(rawPayload.taxes) };
    }
  } else {
    items = (rawData?.items || []).map((it: any) => ({
      id: it.id || nid(),
      warehouse: '',
      product: it.name || it.itemName || '',
      qty: String(it.qty ?? 1),
      unit: it.unit || 'pcs',
      rate: String(it.rate || 0),
      discountType: '%' as const,
      discount: String(it.discount ?? 0),
      taxEntries: [],
    }));
  }

  return {
    party: rawPayload.partyLedger || rawData?.party?.name || '',
    ledger: rawPayload.salesLedger || '',
    date: rawPayload.date ? isoToDMY(rawPayload.date) : isoToDMY(rawData?.documentDate || ''),
    refNo: rawPayload.reference || rawData?.reference || '',
    narration: rawPayload.narration || rawData?.narration || '',
    termsText: rawPayload.termsText || 'Goods once sold will not be taken back.',
    items,
    logEntries: mapApiLogistics(rawPayload.logistics || []),
    roundOffLedger: rawPayload.roundOffLedger || '',
    roundOffAmount: rawData?.totals?.roundOff ? String(rawData.totals.roundOff) : (rawPayload.roundOffAmount || ''),
    dueDate: rawPayload.dueDate ? isoToDMY(rawPayload.dueDate) : '',
    convertProformaTdkRef: tdkRef,
    tallyVoucherNo: tallyNo,
    savedAt: Date.now(),
  };
}

export function buildProformaToInvoicePrefillFromForm(form: {
  party: string;
  ledger: string;
  date: string;
  refNo: string;
  narration: string;
  termsText: string;
  items: any[];
  logEntries: any[];
  roundOffLedger: string;
  roundOffAmount: string;
  dueDate: string;
  tdkRef: string;
  tallyVoucherNo?: string;
}) {
  return {
    party: form.party,
    ledger: form.ledger,
    date: form.date,
    refNo: form.refNo,
    narration: form.narration,
    termsText: form.termsText,
    items: form.items,
    logEntries: form.logEntries,
    roundOffLedger: form.roundOffLedger,
    roundOffAmount: form.roundOffAmount,
    dueDate: form.dueDate,
    convertProformaTdkRef: form.tdkRef,
    tallyVoucherNo: form.tallyVoucherNo || '',
    savedAt: Date.now(),
  };
}
