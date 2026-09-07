/**
 * Stock transfer / physical adjustment — cream print-sheet preview only.
 * No Share PDF (product lock: stock journals are preview-only).
 */
import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/colors';
import { VoucherDocument } from '../../types/document';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, DOC_TYPE_CONFIG } from '../../utils/documentHelpers';

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

function MetaCell({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={p.kvCell}>
      <Text style={p.kvLabel}>{label}</Text>
      <Text style={p.kvValue}>{value}</Text>
    </View>
  );
}

function ItemRows({
  rows,
  showGodown,
}: {
  rows: NonNullable<VoucherDocument['items']>;
  showGodown: boolean;
}) {
  if (!rows.length) {
    return <Text style={p.empty}>No stock lines</Text>;
  }
  return (
    <View>
      <View style={p.tblHead}>
        <Text style={[p.th, { flex: 1.4 }]}>Item</Text>
        {showGodown ? <Text style={[p.th, { flex: 1 }]}>Godown</Text> : null}
        <Text style={[p.th, p.thR, { width: 72 }]}>Qty</Text>
        <Text style={[p.th, p.thR, { width: 72 }]}>Rate</Text>
      </View>
      {rows.map((item, idx) => (
        <View
          key={item.id || `${item.name}-${idx}`}
          style={[p.tblRow, idx % 2 === 0 && p.tblRowAlt]}
        >
          <Text style={[p.tdBold, { flex: 1.4 }]} numberOfLines={2}>{item.name}</Text>
          {showGodown ? (
            <Text style={[p.td, { flex: 1 }]} numberOfLines={2}>{item.godown || '—'}</Text>
          ) : null}
          <Text style={[p.td, p.tdR, { width: 72 }]}>
            {item.qty}{item.unit ? ` ${item.unit}` : ''}
          </Text>
          <Text style={[p.td, p.tdR, { width: 72 }]}>
            {item.rate ? formatCurrency(item.rate) : '—'}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function StockJournalPreview({
  document: doc,
}: {
  document: VoucherDocument;
}) {
  const router = useRouter();
  const { company: authCompany } = useAuth();

  const companyName = doc.company?.name || authCompany?.name || '';
  const companyAddress = doc.company?.address || (authCompany as any)?.address || '';
  const gstin = doc.company?.gstin || (authCompany as any)?.gstin || '';

  const items = doc.items || [];
  const source = useMemo(() => items.filter((i) => i.direction === 'out'), [items]);
  const destination = useMemo(() => items.filter((i) => i.direction === 'in'), [items]);
  const isTransfer = source.length > 0 || destination.length > 0;

  const ribbon = isTransfer ? 'STOCK TRANSFER' : 'STOCK ADJUSTMENT';
  const navTitle =
    DOC_TYPE_CONFIG[doc.documentType]?.label ||
    (isTransfer ? 'Stock Transfer' : 'Stock Adjustment');

  const tally = doc.tallyMeta;
  const reason = tally?.adjustmentReason || doc.narration;

  return (
    <SafeAreaView style={p.safe} edges={['top', 'left', 'right', 'bottom']}>
      <DocNavBar title={navTitle} onBack={() => router.back()} />

      <ScrollView
        style={p.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={p.scrollContent}
      >
        <View style={p.sheet}>
          <View style={p.titleBar}>
            <Text style={p.titleText}>{ribbon}</Text>
          </View>

          <View style={p.companyBlock}>
            {!!companyName && <Text style={p.companyName}>{companyName}</Text>}
            {!!companyAddress && <Text style={p.companyAddr}>{companyAddress}</Text>}
            {!!gstin && <Text style={p.companyMeta}>GSTIN: {gstin}</Text>}
          </View>

          <View style={p.metaGrid}>
            <MetaCell label="Voucher No." value={doc.documentNumber} />
            <MetaCell label="Date" value={doc.date} />
            <MetaCell label="Source Godown" value={tally?.sourceGodown} />
            <MetaCell label="Destination" value={tally?.destinationGodown} />
            <MetaCell label="Warehouse" value={tally?.warehouse} />
            <MetaCell label="Reason" value={reason} />
          </View>

          <View style={p.gridWrap}>
            {isTransfer ? (
              <>
                <Text style={p.sectionLabel}>Source (Out)</Text>
                <ItemRows rows={source} showGodown />
                <Text style={[p.sectionLabel, { marginTop: 14 }]}>Destination (In)</Text>
                <ItemRows rows={destination} showGodown />
              </>
            ) : (
              <>
                <Text style={p.sectionLabel}>Physical Stock</Text>
                <ItemRows rows={items} showGodown />
              </>
            )}
          </View>

          {!!doc.narration && doc.narration !== reason && (
            <View style={p.footerBlock}>
              <Text style={p.kvLabel}>Narration</Text>
              <Text style={p.narration}>{doc.narration}</Text>
            </View>
          )}

          <View style={p.signRow}>
            <Text style={p.signHint}>Preview only — PDF sharing not available</Text>
          </View>
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
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
    alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
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
  companyMeta: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: INK_SOFT, marginTop: 6 },

  metaGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    borderBottomWidth: 1, borderBottomColor: RULE,
  },
  kvCell: {
    width: '50%', paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: RULE_SOFT,
  },
  kvLabel: {
    fontSize: 9, fontWeight: '600', color: INK_FAINT,
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  kvValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: INK, marginTop: 2 },

  gridWrap: { paddingHorizontal: 10, paddingVertical: 12 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: INK_SOFT,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
  },

  tblHead: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: SHADE, paddingVertical: 7, paddingHorizontal: 6,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: RULE,
  },
  th: { fontSize: 9, fontWeight: '700', color: INK_SOFT, letterSpacing: 0.4, textTransform: 'uppercase' },
  thR: { textAlign: 'right' },
  tblRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 8, paddingHorizontal: 6,
    borderBottomWidth: 1, borderBottomColor: RULE_SOFT,
  },
  tblRowAlt: { backgroundColor: '#FAF8F3' },
  td: { fontSize: TYPOGRAPHY.xs, color: INK_SOFT },
  tdBold: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: INK },
  tdR: { textAlign: 'right' },
  empty: { fontSize: TYPOGRAPHY.sm, color: INK_FAINT, paddingVertical: 12, textAlign: 'center' },

  footerBlock: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: RULE,
  },
  narration: { fontSize: TYPOGRAPHY.sm, color: INK, marginTop: 4, lineHeight: 18 },

  signRow: {
    paddingVertical: 12, paddingHorizontal: 14,
    borderTopWidth: 1, borderTopColor: RULE, backgroundColor: SHADE,
  },
  signHint: {
    fontSize: 10, color: INK_FAINT, textAlign: 'center', fontStyle: 'italic',
  },
});
