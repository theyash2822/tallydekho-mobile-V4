/**
 * Commercial document on-screen preview — polished print-sheet (screenshots)
 * for Sales/Purchase invoices, orders, notes, quotation.
 * Share as PDF uses Spec commercial templates (Settings; default Tally Classic).
 * Button chrome matches AccountingVoucherPreview.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import { VoucherDocument } from '../../types/document';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, amountInWords, DOC_TYPE_CONFIG } from '../../utils/documentHelpers';
import { shareVoucherPdfSafely } from '../../utils/voucherPdf';
import {
  toCommercialPrintModel,
  commercialTitle,
} from '../../utils/commercial-print';

const PAPER = '#FEFDFB';
const INK = '#1A1A1A';
const INK_SOFT = '#55524C';
const INK_FAINT = '#98938A';
const SHADE = '#F4F1E9';
const RULE = '#CFCABE';
const RULE_SOFT = '#E5E1D6';
const EDGE = '#B8B3A6';

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

function MetaCell({ label, value, last }: { label: string; value?: string | null; last?: boolean }) {
  if (!value) return null;
  return (
    <View style={[p.kvCell, last && { borderBottomWidth: 0 }]}>
      <Text style={p.kvLabel}>{label}</Text>
      <Text style={p.kvValue}>{value}</Text>
    </View>
  );
}

function AmtCell({
  value,
  width,
  strong,
  last,
}: {
  value?: number | null;
  width: number;
  strong?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[p.amtCol, { width }, last && { borderRightWidth: 0 }]}>
      <Text
        style={[p.amtTxt, strong && p.bold]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        allowFontScaling={false}
      >
        {value != null && value !== 0 ? formatCurrency(value) : value === 0 ? formatCurrency(0) : ''}
      </Text>
    </View>
  );
}

export default function CommercialDocumentPreview({
  document: doc,
}: {
  document: VoucherDocument;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company: authCompany } = useAuth();
  const [sharing, setSharing] = useState(false);

  const model = useMemo(
    () => toCommercialPrintModel(doc, { companyGuid: authCompany?.guid }),
    [doc, authCompany?.guid],
  );

  const ribbon = model.identity.title || commercialTitle(model.identity.documentType) || 'DOCUMENT';
  const navTitle = DOC_TYPE_CONFIG[doc.documentType]?.label || ribbon;

  const companyName = model.company.name || authCompany?.name || '';
  const companyAddr = model.company.addressLines.join(', ');
  const gstin = model.company.gstin || '';
  const pan = model.company.pan || '';
  const phone = model.company.phone || '';
  const email = model.company.email || '';

  const buyer = model.parties.find((x) =>
    /buyer|bill to|customer/i.test(x.role + x.label),
  ) || model.parties.find((x) => /supplier|bill from|vendor/i.test(x.role + x.label));
  const ship = model.parties.find((x) =>
    /consignee|ship to|ship from/i.test(x.role + x.label),
  );

  const refs = model.references;
  const numLabel = model.flags?.documentNumberLabel || 'Invoice No.';
  const hideAmt = !!model.flags?.hideItemAmounts;
  const metaPairs: { label: string; value?: string | null }[] = [
    { label: numLabel, value: model.identity.documentNumber },
    { label: 'Dated', value: model.identity.date },
    { label: 'Place of Supply', value: refs.extra?.find((e) => /place of supply/i.test(e.label))?.value },
    { label: 'Order / PO Ref', value: refs.buyerOrderNo },
    { label: 'Order Dated', value: refs.buyerOrderDate },
    { label: 'Supplier Invoice', value: [refs.supplierInvoiceNo, refs.supplierInvoiceDate].filter(Boolean).join(' / ') || null },
    { label: 'Original Invoice', value: [refs.originalInvoiceNo, refs.originalInvoiceDate].filter(Boolean).join(' / ') || null },
    { label: 'Payment Terms', value: refs.paymentTerms },
    { label: 'e-Way Bill No.', value: refs.eWayBillNo },
    { label: 'Dispatch Doc', value: refs.dispatchDocNo },
    { label: 'Dispatch / Vehicle', value: refs.motorVehicleNo },
    { label: 'Transport', value: refs.dispatchThrough },
    { label: 'LR / RR', value: refs.lrRrNo },
    { label: 'Destination', value: refs.destination },
    { label: 'Terms of Delivery', value: refs.termsOfDelivery },
    { label: 'Valid Until', value: refs.validUntil },
    { label: 'Reason', value: refs.reasonForNote },
  ].filter((m) => !!m.value);

  const items = doc.items || [];
  const hasDisc = !hideAmt && items.some((i) => (i.discount ?? 0) > 0 || (i.discountAmount ?? 0) > 0);
  const COL = { sl: 28, name: 140, hsn: 58, qty: 72, rate: 78, disc: 48, amt: 92 };
  const totalQty = items.reduce((s, i) => s + (i.qty || 0), 0);

  const t = doc.totals;
  const totRows: { label: string; value: number }[] = [];
  if (!hideAmt) {
    if (t.subtotal != null) totRows.push({ label: 'Sub Total', value: t.subtotal });
    if (t.discount) totRows.push({ label: 'Discount (−)', value: t.discount });
    if (t.taxableAmount != null && t.discount) totRows.push({ label: 'Taxable Value', value: t.taxableAmount });
    if (t.cgstTotal) totRows.push({ label: 'Output CGST', value: t.cgstTotal });
    if (t.sgstTotal) totRows.push({ label: 'Output SGST', value: t.sgstTotal });
    if (t.igstTotal) totRows.push({ label: 'Output IGST', value: t.igstTotal });
    if (t.cessTotal) totRows.push({ label: 'Cess', value: t.cessTotal });
    for (const c of model.charges) {
      const n = parseFloat(String(c.amount).replace(/,/g, ''));
      if (Number.isFinite(n) && n !== 0) totRows.push({ label: c.label, value: n });
    }
    if (t.roundOff) totRows.push({ label: 'Round Off', value: t.roundOff });
  }

  const words = model.amountInWords || t.totalInWords || amountInWords(t.total || 0);
  const taxWords = model.taxAmountInWords;
  const hsnRows = model.taxSummary || [];

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    await shareVoucherPdfSafely(doc, {
      companyGuid: authCompany?.guid,
      dialogTitle: `${doc.documentNumber || 'Document'}.pdf`,
      onBeforeShare: () => setSharing(false),
    });
    setSharing(false);
  };

  return (
    <SafeAreaView style={p.safe} edges={['top', 'left', 'right']}>
      <DocNavBar title={navTitle} onBack={() => router.back()} />

      <ScrollView
        style={p.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={p.scrollContent}
      >
        <View style={p.sheet}>
          {/* Title ribbon */}
          <View style={p.titleBar}>
            <Text style={p.titleText}>{ribbon}</Text>
          </View>

          {/* Company letterhead */}
          <View style={p.companyBlock}>
            <Text style={p.companyName}>{companyName}</Text>
            {!!companyAddr && <Text style={p.companyAddr}>{companyAddr}</Text>}
            <View style={p.companyMetaRow}>
              {!!gstin && <Text style={p.companyMeta}>GSTIN/UIN: {gstin}</Text>}
              {!!pan && <Text style={p.companyMeta}>PAN: {pan}</Text>}
            </View>
            {(phone || email) && (
              <Text style={p.companyContact}>
                {[phone, email].filter(Boolean).join('   •   ')}
              </Text>
            )}
          </View>

          {/* Party + meta */}
          <View style={p.gridRow}>
            <View style={p.gridColLeft}>
              {buyer && (
                <View style={p.addrBox}>
                  <Text style={p.addrTitle}>{buyer.label || 'Buyer (Bill to)'}</Text>
                  <Text style={p.addrName}>{buyer.name}</Text>
                  {buyer.addressLines.map((l, i) => (
                    <Text key={i} style={p.addrLine}>{l}</Text>
                  ))}
                  {!!buyer.gstin && <Text style={p.addrMeta}>GSTIN/UIN : {buyer.gstin}</Text>}
                  {!!buyer.stateCode && <Text style={p.addrMeta}>State Code : {buyer.stateCode}</Text>}
                </View>
              )}
              {ship && ship.name && ship.name !== buyer?.name && (
                <View style={[p.addrBox, p.shipDivider]}>
                  <Text style={p.addrTitle}>{ship.label || 'Consignee (Ship to)'}</Text>
                  <Text style={p.addrName}>{ship.name}</Text>
                  {ship.addressLines.map((l, i) => (
                    <Text key={i} style={p.addrLine}>{l}</Text>
                  ))}
                  {!!ship.gstin && <Text style={p.addrMeta}>GSTIN/UIN : {ship.gstin}</Text>}
                </View>
              )}
              {!buyer && !ship && (
                <View style={p.addrBox}>
                  <Text style={p.addrTitle}>Party</Text>
                  <Text style={p.addrName}>{doc.party?.name || '—'}</Text>
                </View>
              )}
            </View>
            <View style={p.gridColRight}>
              {metaPairs.map((m, i) => (
                <MetaCell
                  key={m.label}
                  label={m.label}
                  value={m.value}
                  last={i === metaPairs.length - 1}
                />
              ))}
            </View>
          </View>

          {/* Items */}
          {items.length > 0 && (
            <View style={p.gridWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
                <View>
                  <View style={p.gHeadRow}>
                    <Text style={[p.gHead, { width: COL.sl }]}>Sl</Text>
                    <Text style={[p.gHead, { width: COL.name }]}>Description of Goods</Text>
                    <Text style={[p.gHead, { width: COL.hsn }]}>HSN/SAC</Text>
                    <Text style={[p.gHead, p.right, { width: COL.qty }]}>Qty</Text>
                    {!hideAmt && <Text style={[p.gHead, p.right, { width: COL.rate }]}>Rate</Text>}
                    {!hideAmt && hasDisc && <Text style={[p.gHead, p.right, { width: COL.disc }]}>Disc%</Text>}
                    {!hideAmt && <Text style={[p.gHead, p.right, { width: COL.amt, borderRightWidth: 0 }]}>Amount</Text>}
                  </View>
                  {items.map((item, idx) => {
                    const sec = (item as any).secondaryQty || (item as any).alternateQty;
                    const secUnit = (item as any).secondaryUnit || (item as any).alternateUnit;
                    return (
                      <View key={item.id || idx} style={p.gRow}>
                        <Text style={[p.gCell, { width: COL.sl, color: INK_FAINT }]}>{idx + 1}</Text>
                        <View style={[p.gCellBox, { width: COL.name }]}>
                          <Text style={p.gCellName}>{item.name}</Text>
                          {!!item.description && <Text style={p.gCellSub}>{item.description}</Text>}
                          {!!sec && (
                            <Text style={p.gCellSub}>
                              ({sec}{secUnit ? ` ${secUnit}` : ''})
                            </Text>
                          )}
                        </View>
                        <Text style={[p.gCell, { width: COL.hsn }]}>{item.hsn || '—'}</Text>
                        <Text style={[p.gCell, p.right, { width: COL.qty }]}>
                          {item.qty} {item.unit}
                        </Text>
                        {!hideAmt && (
                          <View style={[p.amtCol, { width: COL.rate }]}>
                            <Text style={p.amtTxt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} allowFontScaling={false}>
                              {formatCurrency(item.rate)}
                            </Text>
                          </View>
                        )}
                        {!hideAmt && hasDisc && (
                          <Text style={[p.gCell, p.right, { width: COL.disc }]}>
                            {item.discount ? `${item.discount}%` : '—'}
                          </Text>
                        )}
                        {!hideAmt && <AmtCell value={item.amount} width={COL.amt} strong last />}
                      </View>
                    );
                  })}
                  <View style={[p.gRow, p.gTotalRow]}>
                    <Text style={[p.gCell, { width: COL.sl }]} />
                    <Text style={[p.gCell, p.bold, { width: COL.name }]}>Total</Text>
                    <Text style={[p.gCell, { width: COL.hsn }]} />
                    <Text style={[p.gCell, p.right, p.bold, { width: COL.qty }]}>{totalQty}</Text>
                    {!hideAmt && <Text style={[p.gCell, { width: COL.rate }]} />}
                    {!hideAmt && hasDisc && <Text style={[p.gCell, { width: COL.disc }]} />}
                    {!hideAmt && <AmtCell value={t.subtotal ?? t.total} width={COL.amt} strong last />}
                  </View>
                </View>
              </ScrollView>
            </View>
          )}

          {/* Totals */}
          {!hideAmt && (
            <View style={p.totalsBlock}>
              {totRows.map((r) => (
                <View key={r.label} style={p.totRow}>
                  <Text style={p.totLabel}>{r.label}</Text>
                  <Text style={p.totValue}>{formatCurrency(r.value)}</Text>
                </View>
              ))}
              <View style={p.grandRow}>
                <Text style={p.grandLabel}>Total</Text>
                <Text style={p.grandValue}>{formatCurrency(t.total || 0)}</Text>
              </View>
            </View>
          )}

          {/* Words */}
          <View style={p.wordsBlock}>
            {!hideAmt ? (
              <>
                <Text style={p.wordsLabel}>Amount Chargeable (in words)</Text>
                <Text style={p.wordsValue}>INR {words}</Text>
                {!!taxWords && (
                  <>
                    <Text style={[p.wordsLabel, { marginTop: 10 }]}>Tax Amount (in words)</Text>
                    <Text style={p.wordsValue}>{taxWords}</Text>
                  </>
                )}
                <Text style={p.eoe}>E. & O.E</Text>
              </>
            ) : (
              <Text style={p.softTextItalic}>Quantity delivery note — amounts not applicable.</Text>
            )}
          </View>

          {/* HSN Summary */}
          {hsnRows.length > 0 && !hideAmt && (
            <View style={p.softBlock}>
              <Text style={p.softLabel}>HSN / Tax Summary</Text>
              {hsnRows.map((row) => (
                <View key={`${row.sequence}-${row.hsnSac}`} style={p.hsnRow}>
                  <Text style={p.hsnHsn}>{row.hsnSac || '—'}</Text>
                  <Text style={p.hsnAmt}>{row.taxableValue}</Text>
                  <Text style={p.hsnTax}>
                    {[
                      row.cgstAmount ? `C ${row.cgstAmount}` : '',
                      row.sgstAmount ? `S ${row.sgstAmount}` : '',
                      row.igstAmount ? `I ${row.igstAmount}` : '',
                    ].filter(Boolean).join(' · ') || row.totalTaxAmount || ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {!!model.narration && (
            <View style={p.softBlock}>
              <Text style={p.softLabel}>Narration</Text>
              <Text style={p.softTextItalic}>{model.narration}</Text>
            </View>
          )}
          {!!(model.terms || doc.terms) && (
            <View style={p.softBlock}>
              <Text style={p.softLabel}>Terms & Conditions</Text>
              <Text style={p.softText}>{model.terms || doc.terms}</Text>
            </View>
          )}

          {/* Footer */}
          <View style={p.footRow}>
            <View style={p.footDecl}>
              {!!model.legal.declaration && (
                <>
                  <Text style={p.softLabel}>Declaration</Text>
                  <Text style={p.softText}>{model.legal.declaration}</Text>
                </>
              )}
              {!!doc.footerInfo?.receiverNote && (
                <Text style={[p.sigCaption, { marginTop: 24 }]}>{doc.footerInfo.receiverNote}</Text>
              )}
            </View>
            <View style={p.footSig}>
              <Text style={p.sigFor}>
                for {model.legal.authorisedFor || companyName}
              </Text>
              <View style={p.sigSpace} />
              <View style={p.sigLine} />
              <Text style={p.sigCaption}>
                {model.legal.authorisedSignatoryLabel || 'Authorised Signatory'}
              </Text>
            </View>
          </View>
          {!!model.legal.computerGeneratedText && (
            <Text style={p.sysNote}>{model.legal.computerGeneratedText}</Text>
          )}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={[p.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={p.shareBtn}
          onPress={handleShare}
          activeOpacity={0.7}
          disabled={sharing}
        >
          {sharing
            ? <ActivityIndicator size="small" color={COLORS.white} />
            : <Ionicons name="share-outline" size={18} color={COLORS.white} />}
          <Text style={p.shareBtnText}>{sharing ? 'Preparing…' : 'Share as PDF'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const p = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cardBg },
  scroll: { flex: 1, backgroundColor: COLORS.cardBg },
  scrollContent: { padding: SPACING.md, paddingTop: SPACING.lg },

  navBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  navBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: {
    flex: 1, textAlign: 'center',
    fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary,
  },

  sheet: {
    backgroundColor: PAPER,
    borderWidth: 1, borderColor: EDGE,
    borderRadius: 6, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },

  titleBar: {
    alignItems: 'center', paddingVertical: 10,
    backgroundColor: SHADE,
    borderBottomWidth: 1, borderBottomColor: RULE,
  },
  titleText: {
    fontSize: 12, fontWeight: '700', letterSpacing: 2,
    color: INK_SOFT, textTransform: 'uppercase',
  },

  companyBlock: {
    alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: RULE,
  },
  companyName: {
    fontSize: TYPOGRAPHY.md, fontWeight: '700', color: INK,
    textAlign: 'center', letterSpacing: 0.2,
  },
  companyAddr: {
    fontSize: TYPOGRAPHY.xs, color: INK_SOFT, textAlign: 'center',
    lineHeight: 17, marginTop: 5,
  },
  companyMetaRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    columnGap: 16, marginTop: 7,
  },
  companyMeta: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: INK_SOFT },
  companyContact: { fontSize: 10, color: INK_FAINT, marginTop: 5 },

  gridRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: RULE },
  gridColLeft: { flex: 1.25, borderRightWidth: 1, borderRightColor: RULE },
  gridColRight: { flex: 1 },
  addrBox: { padding: 12 },
  shipDivider: { borderTopWidth: 1, borderTopColor: RULE },
  addrTitle: {
    fontSize: 10, fontWeight: '700', color: INK_FAINT,
    letterSpacing: 0.6, marginBottom: 5, textTransform: 'uppercase',
  },
  addrName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: INK, marginBottom: 2 },
  addrLine: { fontSize: TYPOGRAPHY.xs, color: INK_SOFT, lineHeight: 17 },
  addrMeta: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: INK, marginTop: 3 },

  kvCell: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: RULE },
  kvLabel: {
    fontSize: 9, fontWeight: '600', color: INK_FAINT,
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  kvValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: INK, marginTop: 3 },

  gridWrap: { borderBottomWidth: 1, borderBottomColor: RULE },
  gHeadRow: {
    flexDirection: 'row', backgroundColor: SHADE,
    borderBottomWidth: 1, borderBottomColor: RULE,
  },
  gHead: {
    fontSize: 10, fontWeight: '600', color: INK_SOFT, letterSpacing: 0.5,
    paddingVertical: 9, paddingHorizontal: 6,
    borderRightWidth: 1, borderRightColor: RULE,
    textTransform: 'uppercase',
  },
  gRow: {
    flexDirection: 'row', alignItems: 'stretch',
    borderBottomWidth: 1, borderBottomColor: RULE_SOFT,
    minHeight: 42,
  },
  gCell: {
    fontSize: TYPOGRAPHY.xs, color: INK,
    paddingVertical: 11, paddingHorizontal: 6,
    borderRightWidth: 1, borderRightColor: RULE_SOFT,
    textAlignVertical: 'center',
  },
  gCellBox: {
    paddingVertical: 11, paddingHorizontal: 6,
    borderRightWidth: 1, borderRightColor: RULE_SOFT,
    justifyContent: 'center',
  },
  gCellName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: INK, lineHeight: 19 },
  gCellSub: { fontSize: 10, color: INK_FAINT, lineHeight: 15, marginTop: 2 },
  gTotalRow: { backgroundColor: SHADE, borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: RULE },
  right: { textAlign: 'right' },
  bold: { fontWeight: '700' },

  amtCol: {
    paddingVertical: 11, paddingHorizontal: 6,
    borderRightWidth: 1, borderRightColor: RULE_SOFT,
    justifyContent: 'center',
  },
  amtTxt: {
    fontSize: 11, fontWeight: '600', color: INK,
    textAlign: 'right', fontVariant: ['tabular-nums'],
  },

  totalsBlock: { borderBottomWidth: 1, borderBottomColor: RULE },
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

  wordsBlock: {
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: RULE,
  },
  wordsLabel: {
    fontSize: 9, fontWeight: '600', color: INK_FAINT,
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  wordsValue: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: INK,
    marginTop: 4, lineHeight: 20,
  },
  eoe: { fontSize: 10, color: INK_FAINT, textAlign: 'right', marginTop: 2 },

  softBlock: {
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: RULE,
  },
  softLabel: {
    fontSize: 9, fontWeight: '600', color: INK_FAINT,
    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4,
  },
  softText: { fontSize: TYPOGRAPHY.xs, color: INK_SOFT, lineHeight: 18 },
  softTextItalic: {
    fontSize: TYPOGRAPHY.sm, color: INK_SOFT, lineHeight: 19, fontStyle: 'italic',
  },
  hsnRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: RULE_SOFT,
  },
  hsnHsn: { width: 72, fontSize: 11, fontWeight: '600', color: INK },
  hsnAmt: { flex: 1, fontSize: 11, color: INK_SOFT, textAlign: 'right' },
  hsnTax: { flex: 1.2, fontSize: 10, color: INK_FAINT, textAlign: 'right', marginLeft: 8 },

  footRow: { flexDirection: 'row' },
  footDecl: { flex: 1.2, padding: 14, borderRightWidth: 1, borderRightColor: RULE },
  footSig: { flex: 1, padding: 14, alignItems: 'flex-end', justifyContent: 'space-between' },
  sigFor: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: INK },
  sigSpace: { height: 34 },
  sigLine: { height: 1, width: '100%', backgroundColor: RULE },
  sigCaption: { fontSize: 10, color: INK_SOFT, marginTop: 6 },
  sysNote: {
    fontSize: 10, color: INK_FAINT, textAlign: 'center',
    paddingVertical: 8, fontStyle: 'italic',
  },

  actionBar: {
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDefault,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.brandPrimary,
  },
  shareBtnText: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: '700',
    color: COLORS.white,
  },
});
