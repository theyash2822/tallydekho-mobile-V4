/**
 * Accounting voucher on-screen preview — React Native print-sheet chrome
 * (title ribbon, letterhead, ruled Dr/Cr table) matching the 4--sep redesign.
 * Share as PDF uses Tally Classic / Settings template HTML (may differ from sheet).
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
import { LedgerEntry, VoucherDocument } from '../../types/document';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, amountInWords, DOC_TYPE_CONFIG } from '../../utils/documentHelpers';
import { shareVoucherPdfSafely } from '../../utils/voucherPdf';

const PAPER = '#FEFDFB';
const INK = '#1A1A1A';
const INK_SOFT = '#55524C';
const INK_FAINT = '#98938A';
const SHADE = '#F4F1E9';
/** Section separators — softened so the sheet doesn't read as heavy black rules. */
const RULE = '#CFCABE';
/** Row dividers inside the table — lighter again. */
const RULE_SOFT = '#E5E1D6';
/** Sheet outline. */
const EDGE = '#B8B3A6';

type DisplayRow = {
  id: string;
  particulars: string;
  narration?: string;
  debit?: number;
  credit?: number;
  showToPrefix?: boolean;
};

function isMoneyVoucher(t: string) {
  return (
    t === 'receipt_voucher' ||
    t === 'payment_voucher' ||
    t === 'expense_voucher'
  );
}

/** Collapse allocations under the party row; order matches print-sheet mock. */
function buildDisplayRows(doc: VoucherDocument): DisplayRow[] {
  const entries = doc.ledgerEntries || [];
  if (!entries.length) return [];

  if (!isMoneyVoucher(doc.documentType)) {
    return entries.map((e) => ({
      id: e.id,
      particulars: e.particulars,
      narration: e.narration,
      debit: e.debit,
      credit: e.credit,
      showToPrefix: !!e.credit && !e.debit,
    }));
  }

  const account = entries.find((e) => e.reference === 'Account');
  const through = entries.find((e) => e.reference === 'Through');
  const allocs = entries.filter((e) => e.reference === 'allocation');
  const allocNarr = allocs.map((a) => a.particulars).filter(Boolean).join(' · ') || undefined;
  const amount =
    account?.debit ||
    account?.credit ||
    through?.debit ||
    through?.credit ||
    doc.totals.total ||
    0;

  const throughName =
    through?.particulars ||
    doc.paymentDetails?.ledgerName ||
    doc.paymentDetails?.mode ||
    '';
  const partyName = account?.particulars || doc.party?.name || '';

  if (doc.documentType === 'receipt_voucher') {
    const rows: DisplayRow[] = [];
    if (throughName) {
      rows.push({
        id: 'through',
        particulars: throughName,
        narration: through?.narration,
        debit: amount,
      });
    }
    if (partyName) {
      rows.push({
        id: 'account',
        particulars: partyName,
        narration: allocNarr || account?.narration,
        credit: amount,
        showToPrefix: true,
      });
    }
    return rows.length ? rows : fallbackRows(entries);
  }

  // Payment / Expense — party Dr, cash/bank Cr
  const rows: DisplayRow[] = [];
  if (partyName) {
    rows.push({
      id: 'account',
      particulars: partyName,
      narration: allocNarr || account?.narration,
      debit: amount,
    });
  }
  if (throughName) {
    rows.push({
      id: 'through',
      particulars: throughName,
      narration: through?.narration,
      credit: amount,
      showToPrefix: true,
    });
  }
  return rows.length ? rows : fallbackRows(entries);
}

function fallbackRows(entries: LedgerEntry[]): DisplayRow[] {
  return entries.map((e) => ({
    id: e.id,
    particulars: e.particulars,
    narration: e.narration,
    debit: e.debit,
    credit: e.credit,
    showToPrefix: !!e.credit && !e.debit,
  }));
}

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

function SheetHeader({
  doc,
  companyName,
  companyAddress,
  gstin,
  pan,
  phone,
  email,
}: {
  doc: VoucherDocument;
  companyName: string;
  companyAddress?: string;
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
}) {
  const cfg = DOC_TYPE_CONFIG[doc.documentType];
  const ribbon =
    cfg?.label?.toUpperCase() ||
    doc.documentTitle?.split(' - ')[0]?.toUpperCase() ||
    'VOUCHER';

  return (
    <>
      <View style={p.titleBar}>
        <Text style={p.titleText}>{ribbon}</Text>
      </View>
      <View style={p.companyBlock}>
        <Text style={p.companyName}>{companyName}</Text>
        {!!companyAddress && (
          <Text style={p.companyAddr}>{companyAddress}</Text>
        )}
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
    </>
  );
}

function VoucherMeta({ doc }: { doc: VoucherDocument }) {
  return (
    <View style={p.vMetaRow}>
      <View style={[p.vMetaCell, { borderRightWidth: 1, borderRightColor: RULE }]}>
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

function AmtCell({
  value,
  width,
  strong,
  last,
}: {
  value?: number;
  width: number;
  strong?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[p.amtCol, { width }, last && { borderRightWidth: 0 }]}>
      <Text
        style={[p.amtTxt, strong && p.bold, !value && { color: INK_FAINT }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        allowFontScaling={false}
      >
        {value ? formatCurrency(value) : ''}
      </Text>
    </View>
  );
}

function LedgerGrid({
  rows,
  drTotal,
  crTotal,
}: {
  rows: DisplayRow[];
  drTotal: number;
  crTotal: number;
}) {
  // Wide enough for ₹99,99,999.00; still shrinks via adjustsFontSizeToFit if needed.
  const COL = 112;
  if (!rows.length) return null;

  return (
    <View>
      <View style={p.gHeadRow}>
        <Text style={[p.gHead, { flex: 1 }]}>Particulars</Text>
        <Text style={[p.gHead, p.right, { width: COL }]}>Debit</Text>
        <Text style={[p.gHead, p.right, { width: COL, borderRightWidth: 0 }]}>Credit</Text>
      </View>
      {rows.map((e) => {
        const isDr = !!e.debit;
        return (
          <View key={e.id} style={p.gRow}>
            <View style={[p.gCellBox, { flex: 1, minWidth: 0 }]}>
              <Text style={p.ledgerName} numberOfLines={2}>
                {e.showToPrefix ? 'To ' : ''}{e.particulars}
              </Text>
              {!!e.narration && <Text style={p.gCellSub}>{e.narration}</Text>}
            </View>
            <AmtCell value={e.debit} width={COL} strong={isDr} />
            <AmtCell value={e.credit} width={COL} strong={!isDr} last />
          </View>
        );
      })}
      <View style={[p.gRow, p.gTotalRow]}>
        <Text style={[p.gCell, p.bold, { flex: 1, minWidth: 0 }]}>Total</Text>
        <View style={[p.amtCol, { width: COL }]}>
          <Text style={[p.amtTxt, p.bold]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} allowFontScaling={false}>
            {formatCurrency(drTotal || 0)}
          </Text>
        </View>
        <View style={[p.amtCol, { width: COL, borderRightWidth: 0 }]}>
          <Text style={[p.amtTxt, p.bold]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} allowFontScaling={false}>
            {formatCurrency(crTotal || 0)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function AmountWords({ doc }: { doc: VoucherDocument }) {
  const words = doc.totals.totalInWords || amountInWords(doc.totals.total || 0);
  return (
    <View style={p.wordsBlock}>
      <Text style={p.wordsLabel}>Amount Chargeable (in words)</Text>
      <Text style={p.wordsValue}>INR {words}</Text>
      <Text style={p.eoe}>E. & O.E</Text>
    </View>
  );
}

function PaymentLine({ doc }: { doc: VoucherDocument }) {
  const pd = doc.paymentDetails;
  if (!pd) return null;
  const bits = [
    (pd.ledgerName || pd.mode) && `Through: ${pd.ledgerName || pd.mode}`,
    pd.bankName && `Bank: ${pd.bankName}`,
    pd.chequeNo && `Instrument: ${pd.chequeNo}`,
    pd.transactionRef && `Ref: ${pd.transactionRef}`,
    pd.instrumentDate && `Dt: ${pd.instrumentDate}`,
  ].filter(Boolean) as string[];
  if (!bits.length) return null;
  return (
    <View style={p.softBlock}>
      <Text style={p.softLabel}>Payment Details</Text>
      <Text style={p.softText}>{bits.join('   •   ')}</Text>
    </View>
  );
}

function Narration({ doc }: { doc: VoucherDocument }) {
  if (!doc.narration) return null;
  return (
    <View style={p.softBlock}>
      <Text style={p.softLabel}>Narration</Text>
      <Text style={p.softTextItalic}>{doc.narration}</Text>
    </View>
  );
}

function FooterBlock({ doc, companyName }: { doc: VoucherDocument; companyName: string }) {
  const f = doc.footerInfo;
  return (
    <>
      {!!doc.terms && (
        <View style={p.softBlock}>
          <Text style={p.softLabel}>Terms & Conditions</Text>
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
          <Text style={p.sigFor}>for {f?.authorizedSignatory || companyName}</Text>
          <View style={p.sigSpace} />
          <View style={p.sigLine} />
          <Text style={p.sigCaption}>Authorised Signatory</Text>
        </View>
      </View>
      {!!f?.systemNote && <Text style={p.sysNote}>{f.systemNote}</Text>}
    </>
  );
}

export default function AccountingVoucherPreview({
  document: doc,
}: {
  document: VoucherDocument;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company: authCompany } = useAuth();
  const [sharing, setSharing] = useState(false);

  const companyName = doc.company?.name || authCompany?.name || '';
  const companyAddress = doc.company?.address || (authCompany as any)?.address || '';
  const gstin = doc.company?.gstin || (authCompany as any)?.gstin || '';
  const pan = doc.company?.pan || (authCompany as any)?.pan || '';
  const phone = doc.company?.phone || (authCompany as any)?.phone || '';
  const email = doc.company?.email || (authCompany as any)?.email || '';

  const rows = useMemo(() => buildDisplayRows(doc), [doc]);
  const drTotal = useMemo(
    () => rows.reduce((s, r) => s + (r.debit || 0), 0) || doc.totals.drTotal || doc.totals.total || 0,
    [rows, doc.totals.drTotal, doc.totals.total],
  );
  const crTotal = useMemo(
    () => rows.reduce((s, r) => s + (r.credit || 0), 0) || doc.totals.crTotal || doc.totals.total || 0,
    [rows, doc.totals.crTotal, doc.totals.total],
  );

  const navTitle = DOC_TYPE_CONFIG[doc.documentType]?.label || doc.documentTitle || 'Voucher';

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    await shareVoucherPdfSafely(doc, {
      companyGuid: authCompany?.guid,
      dialogTitle: `${doc.documentNumber || 'Voucher'}.pdf`,
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
          <SheetHeader
            doc={doc}
            companyName={companyName}
            companyAddress={companyAddress}
            gstin={gstin}
            pan={pan}
            phone={phone}
            email={email}
          />
          <VoucherMeta doc={doc} />
          <View style={p.gridWrap}>
            <LedgerGrid rows={rows} drTotal={drTotal} crTotal={crTotal} />
          </View>
          <AmountWords doc={doc} />
          <PaymentLine doc={doc} />
          <Narration doc={doc} />
          <FooterBlock doc={doc} companyName={companyName} />
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

  kvLabel: {
    fontSize: 9, fontWeight: '600', color: INK_FAINT,
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  kvValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: INK, marginTop: 3 },

  vMetaRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: RULE },
  vMetaCell: { flex: 1, paddingVertical: 10, paddingHorizontal: 14 },

  gridWrap: { borderBottomWidth: 1, borderBottomColor: RULE },

  gHeadRow: {
    flexDirection: 'row', backgroundColor: SHADE,
    borderBottomWidth: 1, borderBottomColor: RULE,
  },
  gHead: {
    fontSize: 10, fontWeight: '600', color: INK_SOFT, letterSpacing: 0.5,
    paddingVertical: 9, paddingHorizontal: 10,
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
    paddingVertical: 11, paddingHorizontal: 10,
    borderRightWidth: 1, borderRightColor: RULE_SOFT,
    textAlignVertical: 'center',
  },
  gCellBox: {
    paddingVertical: 11, paddingHorizontal: 10,
    borderRightWidth: 1, borderRightColor: RULE_SOFT,
    justifyContent: 'center',
  },
  gCellSub: { fontSize: 10, color: INK_FAINT, lineHeight: 15, marginTop: 2 },
  ledgerName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: INK, lineHeight: 19 },
  gTotalRow: { backgroundColor: SHADE, borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: RULE },
  right: { textAlign: 'right' },
  bold: { fontWeight: '700' },

  amtCol: {
    paddingVertical: 11, paddingHorizontal: 6,
    borderRightWidth: 1, borderRightColor: RULE_SOFT,
    justifyContent: 'center',
  },
  amtTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: INK,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

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
