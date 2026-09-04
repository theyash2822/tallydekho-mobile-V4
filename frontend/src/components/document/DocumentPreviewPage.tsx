import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Share, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/colors';
import { VoucherDocument, AddressInfo, PartyInfo } from '../../types/document';
import { formatCurrency, amountInWords, DOC_TYPE_CONFIG, generateDocumentHTML } from '../../utils/documentHelpers';

// ─────────────────────────────────────────────────────────────────────────────
// Print-sheet palette (themed "paper" — warm off-white + app black ink)
// ─────────────────────────────────────────────────────────────────────────────
const PAPER      = '#FAF8F2';   // sheet surface (lighter warm off-white)
const MAT        = '#E7E4DC';   // desk mat behind the sheet
const INK        = '#1A1A1A';   // primary ink / grid lines (app black)
const INK_SOFT   = '#4A4744';   // secondary text
const INK_FAINT  = '#8A857C';   // labels / hints
const SHADE      = '#EFEADF';   // table header / emphasis fill

// ─────────────────────────────────────────────────────────────────────────────
// Top navigation bar
// ─────────────────────────────────────────────────────────────────────────────
function DocNavBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={p.navBar}>
      <TouchableOpacity onPress={onBack} style={p.navBack} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Text style={p.navTitle} numberOfLines={1}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small building blocks
// ─────────────────────────────────────────────────────────────────────────────
const Cell = ({ label, value, last }: { label: string; value?: string; last?: boolean }) =>
  value ? (
    <View style={[p.kvCell, last && { borderBottomWidth: 0 }]}>
      <Text style={p.kvLabel}>{label}</Text>
      <Text style={p.kvValue}>{value}</Text>
    </View>
  ) : null;

function AddressBox({
  title, party, addr,
}: { title: string; party?: PartyInfo; addr?: AddressInfo }) {
  const name = party?.name || addr?.name;
  if (!name) return null;
  const lines = [
    party?.address || addr?.line1,
    addr?.city && addr?.state ? `${addr.city}, ${addr.state}` : addr?.city || addr?.state,
    addr?.pincode,
  ].filter(Boolean) as string[];
  return (
    <View style={p.addrBox}>
      <Text style={p.addrTitle}>{title}</Text>
      <Text style={p.addrName}>{name}</Text>
      {lines.map((l, i) => (
        <Text key={i} style={p.addrLine}>{l}</Text>
      ))}
      {!!party?.gstin && <Text style={p.addrMeta}>GSTIN/UIN : {party.gstin}</Text>}
      {!!party?.stateCode && (
        <Text style={p.addrMeta}>State Code : {party.stateCode}</Text>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet header — title ribbon + company letterhead
// ─────────────────────────────────────────────────────────────────────────────
function SheetHeader({ doc }: { doc: VoucherDocument }) {
  const cfg = DOC_TYPE_CONFIG[doc.documentType];
  const title = doc.documentTitle || cfg?.label || 'Voucher';
  return (
    <>
      <View style={p.titleBar}>
        <Text style={p.titleText}>{title}</Text>
      </View>
      <View style={p.companyBlock}>
        <Text style={p.companyName}>{doc.company.name}</Text>
        {!!doc.company.address && (
          <Text style={p.companyAddr}>{doc.company.address}</Text>
        )}
        <View style={p.companyMetaRow}>
          {!!doc.company.gstin && (
            <Text style={p.companyMeta}>GSTIN/UIN: {doc.company.gstin}</Text>
          )}
          {!!doc.company.pan && (
            <Text style={p.companyMeta}>PAN: {doc.company.pan}</Text>
          )}
        </View>
        {(doc.company.phone || doc.company.email) && (
          <Text style={p.companyContact}>
            {[doc.company.phone, doc.company.email].filter(Boolean).join('   •   ')}
          </Text>
        )}
      </View>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Invoice meta grid — party box (left) + document facts (right)
// ─────────────────────────────────────────────────────────────────────────────
function InvoiceMeta({ doc }: { doc: VoucherDocument }) {
  const m = doc.metadata || {};
  return (
    <View style={p.gridRow}>
      <View style={p.gridColLeft}>
        <AddressBox title="Buyer (Bill to)" party={doc.party} addr={doc.billing} />
        {(doc.shipping?.line1 || doc.shipping?.city) && (
          <View style={p.shipDivider}>
            <AddressBox title="Consignee (Ship to)" addr={doc.shipping} />
          </View>
        )}
      </View>
      <View style={p.gridColRight}>
        <Cell label="Invoice No." value={doc.documentNumber} />
        <Cell label="Dated" value={doc.date} />
        <Cell label="Place of Supply" value={m.placeOfSupply} />
        <Cell label="Order / PO Ref" value={m.orderRef} />
        <Cell label="Invoice Ref" value={m.invoiceRef} />
        <Cell label="Payment Terms" value={m.paymentTerms} />
        <Cell label="Due Date" value={m.dueDate} />
        <Cell label="Dispatch / Vehicle" value={m.vehicleNo} />
        <Cell label="Transport" value={m.transportDetails} last />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Voucher meta row — No. + Dated
// ─────────────────────────────────────────────────────────────────────────────
function VoucherMeta({ doc }: { doc: VoucherDocument }) {
  return (
    <View style={p.vMetaRow}>
      <View style={[p.vMetaCell, { borderRightWidth: 1, borderRightColor: INK }]}>
        <Text style={p.kvLabel}>Voucher No.</Text>
        <Text style={p.kvValue}>{doc.documentNumber}</Text>
      </View>
      <View style={p.vMetaCell}>
        <Text style={p.kvLabel}>Dated</Text>
        <Text style={p.kvValue}>{doc.date}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Items grid (horizontally scrollable, ruled like a printed table)
// ─────────────────────────────────────────────────────────────────────────────
function ItemsGrid({ doc }: { doc: VoucherDocument }) {
  if (!doc.items || doc.items.length === 0) return null;
  const hasDisc = doc.items.some(i => (i.discount ?? 0) > 0);
  const W = { sl: 30, name: 152, hsn: 62, qty: 70, rate: 88, disc: 56, amt: 100 };
  const totalQty = doc.items.reduce((s, i) => s + (i.qty || 0), 0);

  const HeadCell = ({ w, txt, right }: { w: number; txt: string; right?: boolean }) => (
    <Text style={[p.gHead, { width: w }, right && p.right]}>{txt}</Text>
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
      <View>
        {/* Header */}
        <View style={p.gHeadRow}>
          <HeadCell w={W.sl} txt="Sl" />
          <HeadCell w={W.name} txt="Description of Goods" />
          <HeadCell w={W.hsn} txt="HSN/SAC" />
          <HeadCell w={W.qty} txt="Qty" right />
          <HeadCell w={W.rate} txt="Rate" right />
          {hasDisc && <HeadCell w={W.disc} txt="Disc%" right />}
          <HeadCell w={W.amt} txt="Amount" right />
        </View>
        {/* Rows */}
        {doc.items.map((item, idx) => (
          <View key={item.id} style={p.gRow}>
            <Text style={[p.gCell, { width: W.sl, color: INK_FAINT }]}>{idx + 1}</Text>
            <View style={[p.gCellBox, { width: W.name }]}>
              <Text style={p.gCellName}>{item.name}</Text>
              {!!item.description && <Text style={p.gCellSub}>{item.description}</Text>}
            </View>
            <Text style={[p.gCell, { width: W.hsn }]}>{item.hsn || '—'}</Text>
            <Text style={[p.gCell, p.right, { width: W.qty }]}>{item.qty} {item.unit}</Text>
            <Text style={[p.gCell, p.right, { width: W.rate }]}>{formatCurrency(item.rate)}</Text>
            {hasDisc && (
              <Text style={[p.gCell, p.right, { width: W.disc }]}>
                {item.discount ? `${item.discount}%` : '—'}
              </Text>
            )}
            <Text style={[p.gCell, p.right, p.bold, { width: W.amt }]}>
              {formatCurrency(item.amount)}
            </Text>
          </View>
        ))}
        {/* Total qty row */}
        <View style={[p.gRow, p.gTotalRow]}>
          <Text style={[p.gCell, { width: W.sl }]} />
          <Text style={[p.gCell, p.bold, { width: W.name }]}>Total</Text>
          <Text style={[p.gCell, { width: W.hsn }]} />
          <Text style={[p.gCell, p.right, p.bold, { width: W.qty }]}>{totalQty}</Text>
          <Text style={[p.gCell, { width: W.rate }]} />
          {hasDisc && <Text style={[p.gCell, { width: W.disc }]} />}
          <Text style={[p.gCell, p.right, p.bold, { width: W.amt }]}>
            {formatCurrency(doc.totals.subtotal ?? doc.totals.total)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ledger grid (Dr/Cr) — fits screen width, no horizontal scroll
// ─────────────────────────────────────────────────────────────────────────────
function LedgerGrid({ doc }: { doc: VoucherDocument }) {
  if (!doc.ledgerEntries || doc.ledgerEntries.length === 0) return null;
  const drTotal = doc.totals.drTotal || 0;
  const crTotal = doc.totals.crTotal || 0;
  const COL = 92;

  return (
    <View>
      {/* Header */}
      <View style={p.gHeadRow}>
        <Text style={[p.gHead, { flex: 1 }]}>Particulars</Text>
        <Text style={[p.gHead, p.right, { width: COL }]}>Debit</Text>
        <Text style={[p.gHead, p.right, { width: COL, borderRightWidth: 0 }]}>Credit</Text>
      </View>
      {/* Rows */}
      {doc.ledgerEntries.map((e) => {
        const isDr = !!e.debit;
        return (
          <View key={e.id} style={p.gRow}>
            <View style={[p.gCellBox, { flex: 1 }]}>
              <Text style={p.ledgerName}>
                {isDr ? '' : 'To '}{e.particulars}
              </Text>
              {!!e.narration && <Text style={p.gCellSub}>{e.narration}</Text>}
            </View>
            <Text style={[p.gCell, p.right, p.bold, { width: COL, color: isDr ? INK : INK_FAINT }]}>
              {e.debit ? formatCurrency(e.debit) : ''}
            </Text>
            <Text style={[p.gCell, p.right, p.bold, { width: COL, borderRightWidth: 0, color: !isDr ? INK : INK_FAINT }]}>
              {e.credit ? formatCurrency(e.credit) : ''}
            </Text>
          </View>
        );
      })}
      {/* Total row */}
      <View style={[p.gRow, p.gTotalRow]}>
        <Text style={[p.gCell, p.bold, { flex: 1 }]}>Total</Text>
        <Text style={[p.gCell, p.right, p.bold, { width: COL }]}>{formatCurrency(drTotal)}</Text>
        <Text style={[p.gCell, p.right, p.bold, { width: COL, borderRightWidth: 0 }]}>{formatCurrency(crTotal)}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Totals + tax block (right-aligned label / amount rows)
// ─────────────────────────────────────────────────────────────────────────────
function TotalsBlock({ doc }: { doc: VoucherDocument }) {
  const t = doc.totals;
  const rows: { label: string; value: string; strong?: boolean }[] = [];
  if (t.subtotal !== undefined) rows.push({ label: 'Sub Total', value: formatCurrency(t.subtotal) });
  if (t.discount) rows.push({ label: 'Discount (−)', value: formatCurrency(t.discount) });
  if (t.taxableAmount !== undefined && t.discount)
    rows.push({ label: 'Taxable Value', value: formatCurrency(t.taxableAmount) });
  if (t.cgstTotal) rows.push({ label: 'Output CGST', value: formatCurrency(t.cgstTotal) });
  if (t.sgstTotal) rows.push({ label: 'Output SGST', value: formatCurrency(t.sgstTotal) });
  if (t.igstTotal) rows.push({ label: 'Output IGST', value: formatCurrency(t.igstTotal) });
  if (t.roundOff) rows.push({ label: 'Round Off', value: formatCurrency(t.roundOff) });

  return (
    <View style={p.totalsBlock}>
      {rows.map((r, i) => (
        <View key={i} style={p.totRow}>
          <Text style={p.totLabel}>{r.label}</Text>
          <Text style={p.totValue}>{r.value}</Text>
        </View>
      ))}
      <View style={p.grandRow}>
        <Text style={p.grandLabel}>Total</Text>
        <Text style={p.grandValue}>{formatCurrency(t.total)}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Amount in words
// ─────────────────────────────────────────────────────────────────────────────
function AmountWords({ doc }: { doc: VoucherDocument }) {
  return (
    <View style={p.wordsBlock}>
      <Text style={p.wordsLabel}>Amount Chargeable (in words)</Text>
      <Text style={p.wordsValue}>INR {amountInWords(doc.totals.total)}</Text>
      <Text style={p.eoe}>E. &amp; O.E</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment / instrument line (vouchers)
// ─────────────────────────────────────────────────────────────────────────────
function PaymentLine({ doc }: { doc: VoucherDocument }) {
  const pd = doc.paymentDetails;
  if (!pd) return null;
  const bits = [
    pd.mode && `Through: ${pd.mode}`,
    pd.bankName && `Bank: ${pd.bankName}`,
    pd.chequeNo && `Instrument: ${pd.chequeNo}`,
    pd.transactionRef && `Ref: ${pd.transactionRef}`,
    pd.instrumentDate && `Dt: ${pd.instrumentDate}`,
  ].filter(Boolean) as string[];
  return (
    <View style={p.softBlock}>
      <Text style={p.softLabel}>Payment Details</Text>
      <Text style={p.softText}>{bits.join('   •   ')}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Narration
// ─────────────────────────────────────────────────────────────────────────────
function Narration({ doc }: { doc: VoucherDocument }) {
  if (!doc.narration) return null;
  return (
    <View style={p.softBlock}>
      <Text style={p.softLabel}>Narration</Text>
      <Text style={p.softTextItalic}>{doc.narration}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Declaration + signature footer
// ─────────────────────────────────────────────────────────────────────────────
function FooterBlock({ doc }: { doc: VoucherDocument }) {
  const f = doc.footerInfo;
  return (
    <>
      {!!doc.terms && (
        <View style={p.softBlock}>
          <Text style={p.softLabel}>Terms &amp; Conditions</Text>
          <Text style={p.softText}>{doc.terms}</Text>
        </View>
      )}
      <View style={p.footRow}>
        <View style={p.footDecl}>
          {!!f?.declaration && (
            <>
              <Text style={p.softLabel}>Declaration</Text>
              <Text style={p.softText}>{f.declaration}</Text>
            </>
          )}
          {!!f?.receiverNote && (
            <Text style={[p.sigCaption, { marginTop: 24 }]}>{f.receiverNote}</Text>
          )}
        </View>
        <View style={p.footSig}>
          <Text style={p.sigFor}>for {f?.authorizedSignatory || doc.company.name}</Text>
          <View style={p.sigSpace} />
          <View style={p.sigLine} />
          <Text style={p.sigCaption}>Authorised Signatory</Text>
        </View>
      </View>
      {!!f?.systemNote && <Text style={p.sysNote}>{f.systemNote}</Text>}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom action bar — share as themed PDF
// ─────────────────────────────────────────────────────────────────────────────
function ActionBar({ doc }: { doc: VoucherDocument }) {
  const insets = useSafeAreaInsets();
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleShare = async () => {
    try {
      setPdfLoading(true);
      const html = generateDocumentHTML(doc);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      setPdfLoading(false);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `${doc.documentNumber}.pdf`,
          UTI: 'com.adobe.pdf',
        });
        return;
      }
    } catch {
      setPdfLoading(false);
    }
    try {
      await Share.share({
        message:
          `${doc.documentTitle} – ${doc.documentNumber}\n` +
          `Date: ${doc.date}\n` +
          `Total: ${formatCurrency(doc.totals.total)}`,
        title: doc.documentNumber,
      });
    } catch {}
  };

  return (
    <View style={[p.actionBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      <TouchableOpacity style={p.shareBtn} onPress={handleShare} activeOpacity={0.85} disabled={pdfLoading}>
        {pdfLoading
          ? <ActivityIndicator size="small" color={COLORS.white} />
          : <Ionicons name="share-outline" size={20} color={COLORS.white} />}
        <Text style={p.shareBtnText}>{pdfLoading ? 'Preparing…' : 'Share as PDF'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main — print-style paper sheet
// ─────────────────────────────────────────────────────────────────────────────
export default function DocumentPreviewPage({ document: doc }: { document: VoucherDocument }) {
  const router = useRouter();
  const isVoucher = !!doc.ledgerEntries && doc.ledgerEntries.length > 0;
  const hasItems = !!doc.items && doc.items.length > 0;

  return (
    <SafeAreaView style={p.safe} edges={['top', 'left', 'right']}>
      <DocNavBar title={doc.documentTitle} onBack={() => router.back()} />

      <ScrollView
        style={p.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={p.scrollContent}
      >
        <View style={p.sheet}>
          <SheetHeader doc={doc} />

          {isVoucher ? (
            <>
              <VoucherMeta doc={doc} />
              <View style={p.gridWrap}>
                <LedgerGrid doc={doc} />
              </View>
              <AmountWords doc={doc} />
              <PaymentLine doc={doc} />
              <Narration doc={doc} />
              <FooterBlock doc={doc} />
            </>
          ) : (
            <>
              <InvoiceMeta doc={doc} />
              {hasItems && (
                <View style={p.gridWrap}>
                  <ItemsGrid doc={doc} />
                </View>
              )}
              <TotalsBlock doc={doc} />
              <AmountWords doc={doc} />
              <Narration doc={doc} />
              <FooterBlock doc={doc} />
            </>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      <ActionBar doc={doc} />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const p = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: MAT },
  scroll:        { flex: 1 },
  scrollContent: { padding: 14 },

  // Nav
  navBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  navBack:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },

  // Paper sheet
  sheet: {
    backgroundColor: PAPER,
    borderWidth: 1, borderColor: INK,
    borderRadius: 2, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },

  // Title ribbon
  titleBar: {
    alignItems: 'center', paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: INK,
  },
  titleText: { fontSize: 14, fontWeight: '800', letterSpacing: 1.5, color: INK, textTransform: 'uppercase' },

  // Company letterhead
  companyBlock: {
    alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: INK,
  },
  companyName:   { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: INK, textAlign: 'center', letterSpacing: 0.3 },
  companyAddr:   { fontSize: TYPOGRAPHY.xs, color: INK_SOFT, textAlign: 'center', lineHeight: 17, marginTop: 4 },
  companyMetaRow:{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 16, marginTop: 6 },
  companyMeta:   { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: INK },
  companyContact:{ fontSize: 10, color: INK_FAINT, marginTop: 5 },

  // Invoice meta grid
  gridRow:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: INK },
  gridColLeft:  { flex: 1.25, borderRightWidth: 1, borderRightColor: INK },
  gridColRight: { flex: 1 },
  addrBox:      { padding: 12 },
  shipDivider:  { borderTopWidth: 1, borderTopColor: INK },
  addrTitle:    { fontSize: 10, fontWeight: '800', color: INK_FAINT, letterSpacing: 0.6, marginBottom: 5, textTransform: 'uppercase' },
  addrName:     { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: INK, marginBottom: 2 },
  addrLine:     { fontSize: TYPOGRAPHY.xs, color: INK_SOFT, lineHeight: 17 },
  addrMeta:     { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: INK, marginTop: 3 },

  kvCell:  { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: INK },
  kvLabel: { fontSize: 9, fontWeight: '700', color: INK_FAINT, letterSpacing: 0.4, textTransform: 'uppercase' },
  kvValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: INK, marginTop: 2 },

  // Voucher meta row
  vMetaRow:  { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: INK },
  vMetaCell: { flex: 1, paddingVertical: 9, paddingHorizontal: 12 },

  // Grid wrapper (adds bottom rule under the table section)
  gridWrap: { borderBottomWidth: 1, borderBottomColor: INK },

  // Generic ruled table
  gHeadRow: {
    flexDirection: 'row', backgroundColor: SHADE,
    borderBottomWidth: 1, borderBottomColor: INK,
  },
  gHead: {
    fontSize: 10, fontWeight: '800', color: INK, letterSpacing: 0.3,
    paddingVertical: 9, paddingHorizontal: 8,
    borderRightWidth: 1, borderRightColor: INK,
    textTransform: 'uppercase',
  },
  gRow: {
    flexDirection: 'row', alignItems: 'stretch',
    borderBottomWidth: 1, borderBottomColor: '#D8D3C6',
    minHeight: 40,
  },
  gCell: {
    fontSize: TYPOGRAPHY.xs, color: INK,
    paddingVertical: 10, paddingHorizontal: 8,
    borderRightWidth: 1, borderRightColor: '#D8D3C6',
    textAlignVertical: 'center',
  },
  gCellBox: {
    paddingVertical: 10, paddingHorizontal: 8,
    borderRightWidth: 1, borderRightColor: '#D8D3C6',
    justifyContent: 'center',
  },
  gCellName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: INK, lineHeight: 19 },
  gCellSub:  { fontSize: 10, color: INK_FAINT, lineHeight: 15, marginTop: 2 },
  ledgerName:{ fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: INK, lineHeight: 19 },
  gTotalRow: { backgroundColor: SHADE, borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: INK },
  right:     { textAlign: 'right' },
  bold:      { fontWeight: '800' },

  // Totals block
  totalsBlock: { borderBottomWidth: 1, borderBottomColor: INK },
  totRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 7, paddingHorizontal: 14,
  },
  totLabel: { fontSize: TYPOGRAPHY.sm, color: INK_SOFT },
  totValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: INK },
  grandRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: INK,
  },
  grandLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: PAPER, letterSpacing: 0.5 },
  grandValue: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: PAPER },

  // Amount in words
  wordsBlock: { paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: INK },
  wordsLabel: { fontSize: 9, fontWeight: '700', color: INK_FAINT, letterSpacing: 0.4, textTransform: 'uppercase' },
  wordsValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: INK, marginTop: 3, lineHeight: 20 },
  eoe:        { fontSize: 10, color: INK_FAINT, textAlign: 'right', marginTop: 2 },

  // Soft blocks (narration / payment / terms)
  softBlock:      { paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: INK },
  softLabel:      { fontSize: 9, fontWeight: '700', color: INK_FAINT, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 },
  softText:       { fontSize: TYPOGRAPHY.xs, color: INK_SOFT, lineHeight: 18 },
  softTextItalic: { fontSize: TYPOGRAPHY.sm, color: INK, lineHeight: 19, fontStyle: 'italic' },

  // Footer
  footRow:   { flexDirection: 'row' },
  footDecl:  { flex: 1.2, padding: 14, borderRightWidth: 1, borderRightColor: INK },
  footSig:   { flex: 1, padding: 14, alignItems: 'flex-end', justifyContent: 'space-between' },
  sigFor:    { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: INK },
  sigSpace:  { height: 34 },
  sigLine:   { height: 1, width: '100%', backgroundColor: INK },
  sigCaption:{ fontSize: 10, color: INK_SOFT, marginTop: 6 },
  sysNote:   { fontSize: 10, color: INK_FAINT, textAlign: 'center', paddingVertical: 8, fontStyle: 'italic' },

  // Action bar
  actionBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.brandPrimary, paddingTop: 12, paddingHorizontal: SPACING.md,
  },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 10,
  },
  shareBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white, letterSpacing: 0.3 },
});
