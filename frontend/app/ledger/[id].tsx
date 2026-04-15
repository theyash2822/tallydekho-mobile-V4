import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_LEDGERS } from '../../src/data/mockData';
import { TX_TO_DOC_TYPE } from '../../src/utils/documentHelpers';

const SCREEN_W = Dimensions.get('window').width;

// ── Chart colours — lighter theme-matched shades ─────────────────────────────
const CHART_DR = '#D9534F'; // softer coral-red  (Dr)
const CHART_CR = '#47A370'; // muted teal-green  (Cr)

// ── SVG math helpers ─────────────────────────────────────────────────────────
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArc(
  cx: number, cy: number,
  rO: number, rI: number,
  startDeg: number, endDeg: number
): string {
  // Avoid degenerate arc (start == end)
  if (Math.abs(endDeg - startDeg) >= 360) endDeg = startDeg + 359.9;
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const o1 = polar(cx, cy, rO, startDeg);
  const o2 = polar(cx, cy, rO, endDeg);
  const i2 = polar(cx, cy, rI, endDeg);
  const i1 = polar(cx, cy, rI, startDeg);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${rO} ${rO} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i2.x} ${i2.y}`,
    `A ${rI} ${rI} 0 ${large} 0 ${i1.x} ${i1.y}`,
    'Z',
  ].join(' ');
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DrCrDonutChart({
  drPct, drAmt, crAmt,
}: {
  drPct: number; drAmt: string; crAmt: string;
}) {
  const [sel, setSel] = useState<'dr' | 'cr' | null>(null);
  const S = 160, cx = 80, cy = 80, rO = 70, rI = 44;
  const drEnd = drPct * 3.6; // degrees

  const drPath = donutArc(cx, cy, rO, rI, 0, drEnd);
  const crPath = donutArc(cx, cy, rO, rI, drEnd, 360);

  // Centre text changes when a segment is selected
  const topText  = sel === 'dr' ? drAmt  : sel === 'cr' ? crAmt  : `${drPct}%`;
  const botText  = sel === 'dr' ? 'Debit' : sel === 'cr' ? 'Credit' : 'Debit';
  const topColor = sel === 'dr' ? CHART_DR : sel === 'cr' ? CHART_CR : COLORS.textPrimary;

  return (
    <Svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
      {/* Cr segment */}
      <Path
        d={crPath}
        fill={CHART_CR}
        opacity={sel === 'dr' ? 0.35 : 1}
        onPress={() => setSel(p => (p === 'cr' ? null : 'cr'))}
      />
      {/* Dr segment */}
      <Path
        d={drPath}
        fill={CHART_DR}
        opacity={sel === 'cr' ? 0.35 : 1}
        onPress={() => setSel(p => (p === 'dr' ? null : 'dr'))}
      />
      {/* Centre white fill — creates the donut hole */}
      <Circle cx={cx} cy={cy} r={rI - 2} fill={COLORS.cardBg} />
      {/* Centre labels */}
      <SvgText x={cx} y={cy - 6} textAnchor="middle" fontSize="16" fontWeight="700" fill={topColor}>
        {topText}
      </SvgText>
      <SvgText x={cx} y={cy + 11} textAnchor="middle" fontSize="10" fill={COLORS.textTertiary}>
        {botText}
      </SvgText>
    </Svg>
  );
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_TRANSACTIONS = [
  { id: 't1', date: '01 Apr', voucher: 'SI-30865', type: 'Sales Invoice', amount: '₹12,500', isDebit: false, balance: '-₹12,500' },
  { id: 't2', date: '05 Apr', voucher: 'PV-2045',  type: 'Payment',       amount: '₹8,000',  isDebit: true,  balance: '-₹4,500'  },
  { id: 't3', date: '12 Apr', voucher: 'SI-30901', type: 'Sales Invoice', amount: '₹22,000', isDebit: false, balance: '-₹26,500' },
  { id: 't4', date: '18 Apr', voucher: 'RV-1023',  type: 'Receipt',       amount: '₹15,000', isDebit: true,  balance: '-₹11,500' },
  { id: 't5', date: '25 Apr', voucher: 'JV-0034',  type: 'Journal',       amount: '₹5,400',  isDebit: false, balance: '-₹16,900' },
  { id: 't6', date: '03 May', voucher: 'SI-30977', type: 'Sales Invoice', amount: '₹18,700', isDebit: false, balance: '-₹35,600' },
  { id: 't7', date: '10 May', voucher: 'PV-2089',  type: 'Payment',       amount: '₹20,000', isDebit: true,  balance: '-₹15,600' },
];

const KPI_CHIPS = [
  { label: 'Opening',      value: '₹0',        color: COLORS.textSecondary },
  { label: 'Closing',      value: '₹37.5K Dr', color: COLORS.negative      },
  { label: 'Total Credit', value: '₹87.7K',    color: COLORS.positive      },
  { label: 'Total Debit',  value: '₹17.9K',    color: COLORS.negative      },
  { label: 'Vouchers',     value: '6',          color: COLORS.brandPrimary  },
];

const MONTHS_ORDER = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

// ── Info Modal ────────────────────────────────────────────────────────────────
function LedgerInfoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={im.section}>
      <Text style={im.sectionTitle}>{title}</Text>
      <View style={im.sectionBody}>{children}</View>
    </View>
  );

  const Row = ({ label, value }: { label: string; value: string }) => (
    <Text style={im.rowText}>
      <Text style={im.rowLabel}>{label}: </Text>
      <Text style={im.rowValue}>{value}</Text>
    </Text>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={im.overlay}>
        {/* Tap backdrop to close */}
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />

        <View style={im.sheet}>
          {/* Header row */}
          <View style={im.header}>
            <View style={im.headerLeft}>
              <Ionicons name="information-circle-outline" size={20} color={COLORS.brandPrimary} />
              <Text style={im.title}>Information</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={im.closeX} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={im.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Section title="GST">
              <Row label="GSTIN"    value="27ABCDE1234F2Z5" />
              <Row label="GST Rate" value="18 %" />
              <Row label="HSN/SAC"  value="998313" />
            </Section>

            <Section title="CONTACT">
              <Row label="Contact Person" value="Ashish Agarwal" />
              <Row label="Mobile"         value="+91-9672222367" />
              <Row label="Email"          value="xyz@sample.com" />
              <Row label="Address"        value="Plot No. 11, Sitapura Industrial Area, Jaipur, Rajasthan – 302020 INDIA" />
            </Section>

            <Section title="BANK">
              <Row label="Beneficiary"    value="ABC Traders Private Limited" />
              <Row label="Bank Name"      value="ININI Bank" />
              <Row label="Account No."   value="123456789" />
              <Row label="IFSC"           value="HDFC0000123" />
              <Row label="Branch"         value="MI Road" />
              <Row label="SWIFT"          value="XYZ00099LM1" />
            </Section>

            <Section title="NARRATION">
              <Text style={im.narration}>
                Key distributor for Jaipur region and customers will make advance
                booking only. Also look at the transaction history and note that
                it is a sample data.
              </Text>
            </Section>

            <View style={{ height: 12 }} />
          </ScrollView>

          {/* Close button — theme colour */}
          <View style={im.footer}>
            <TouchableOpacity style={im.closeBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={im.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function LedgerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [showDrOnly, setShowDrOnly] = useState(false);
  const [showCrOnly, setShowCrOnly] = useState(false);
  const [showInfo,   setShowInfo]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const ledger = MOCK_LEDGERS?.find((l: any) => l.id === id) ||
    { id: id || 'L001', name: 'Alliance Trading Co.', group: 'Sundry Debtors', balance: '₹37,500 Dr' };

  // Apply Dr/Cr filter + search
  const txns = MOCK_TRANSACTIONS.filter(t => {
    if (showDrOnly && !t.isDebit) return false;
    if (showCrOnly &&  t.isDebit) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.voucher.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        t.date.toLowerCase().includes(q) ||
        t.amount.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group filtered transactions by month
  const monthGroups: Record<string, typeof MOCK_TRANSACTIONS> = {};
  txns.forEach(t => {
    const mon = t.date.split(' ')[1];
    if (!monthGroups[mon]) monthGroups[mon] = [];
    monthGroups[mon].push(t);
  });
  const sortedMonths = Object.keys(monthGroups).sort(
    (a, b) => MONTHS_ORDER.indexOf(a) - MONTHS_ORDER.indexOf(b)
  );

  // Accordion state — first month expanded by default
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    () => {
      const allMons = [...new Set(MOCK_TRANSACTIONS.map(t => t.date.split(' ')[1]))]
        .sort((a, b) => MONTHS_ORDER.indexOf(a) - MONTHS_ORDER.indexOf(b));
      return new Set(allMons.length ? [allMons[0]] : []);
    }
  );

  const toggleMonth = (mon: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      next.has(mon) ? next.delete(mon) : next.add(mon);
      return next;
    });
  };

  // When searching, auto-expand all months that have results
  const effectiveExpanded = searchQuery.trim()
    ? new Set(sortedMonths)   // all months visible while searching
    : expandedMonths;

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{ledger.name}</Text>
        <TouchableOpacity style={styles.infoBtn} activeOpacity={0.7} onPress={() => setShowInfo(true)}>
          <Ionicons name="information-circle-outline" size={22} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Donut + Legend ── */}
        <View style={styles.chartSection}>
          <DrCrDonutChart drPct={67} drAmt="₹67K" crAmt="₹33K" />
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: CHART_DR }]} />
              <Text style={styles.legendText}>Dr ₹67K</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: CHART_CR }]} />
              <Text style={styles.legendText}>Cr ₹33K</Text>
            </View>
            <Text style={styles.tapHint}>Tap segment to inspect</Text>
          </View>
        </View>

        {/* ── KPI chips (horizontal scroll) ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kpiRow}
        >
          {KPI_CHIPS.map(chip => (
            <View key={chip.label} style={styles.kpiChip}>
              <Text style={styles.kpiLabel}>{chip.label}</Text>
              <Text style={[styles.kpiValue, { color: chip.color }]}>{chip.value}</Text>
            </View>
          ))}
        </ScrollView>

        {/* ── Search + Dr/Cr filter ── */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={80}
        >
          <View style={styles.filterRow}>
            <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
              <Ionicons
                name="search-outline"
                size={14}
                color={searchFocused ? COLORS.brandPrimary : COLORS.textTertiary}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search transactions"
                placeholderTextColor={COLORS.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                selectionColor={COLORS.brandPrimary}
                returnKeyType="search"
                clearButtonMode="while-editing"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={15} color={COLORS.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.filterPill, showDrOnly && styles.filterPillActive]}
              onPress={() => { setShowDrOnly(!showDrOnly); setShowCrOnly(false); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterPillText, showDrOnly && styles.filterPillTextActive]}>Dr</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterPill, showCrOnly && styles.filterPillActive]}
              onPress={() => { setShowCrOnly(!showCrOnly); setShowDrOnly(false); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterPillText, showCrOnly && styles.filterPillTextActive]}>Cr</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* ── Transaction list — month accordion ── */}
        <View style={styles.txnContainer}>
          {sortedMonths.length === 0 ? (
            <View style={styles.emptySearch}>
              <Ionicons name="search-outline" size={28} color={COLORS.textTertiary} />
              <Text style={styles.emptySearchText}>No transactions match "{searchQuery}"</Text>
            </View>
          ) : (
            sortedMonths.map(mon => {
              const isOpen  = effectiveExpanded.has(mon);
              const monTxns = monthGroups[mon];
              return (
                <View key={mon} style={styles.monthGroup}>
                  {/* Month header — tappable accordion toggle */}
                  <TouchableOpacity
                    style={styles.monthHeader}
                    onPress={() => toggleMonth(mon)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.monthHeaderText}>{mon} 25</Text>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={15}
                      color={COLORS.textTertiary}
                    />
                  </TouchableOpacity>

                  {/* Rows — only rendered when expanded */}
                  {isOpen && monTxns.map((txn, idx) => (
                    <TouchableOpacity
                      key={txn.id}
                      style={[
                        styles.txnRow,
                        idx === monTxns.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      activeOpacity={0.75}
                      onPress={() => {
                        const docType = TX_TO_DOC_TYPE[txn.type];
                        router.push(
                          docType
                            ? `/document/${txn.voucher}?type=${docType}`
                            : `/document/${txn.voucher}`
                        );
                      }}
                    >
                      {/* Date column — two lines */}
                      <View style={styles.txnDateCol}>
                        <Text style={styles.txnDay}>{txn.date.split(' ')[0]}</Text>
                        <Text style={styles.txnMon}>{txn.date.split(' ')[1]}</Text>
                      </View>

                      {/* Voucher info */}
                      <View style={styles.txnInfo}>
                        <Text style={styles.txnVoucher}>{txn.voucher}</Text>
                        <Text style={styles.txnType}>{txn.type}</Text>
                      </View>

                      {/* Amount + balance */}
                      <View style={styles.txnAmounts}>
                        <Text style={[
                          styles.txnAmt,
                          { color: txn.isDebit ? COLORS.negative : COLORS.positive },
                        ]}>
                          {txn.isDebit ? 'Dr ' : 'Cr '}{txn.amount}
                        </Text>
                        <Text style={styles.txnBalance}>{txn.balance}</Text>
                      </View>

                      {/* Tap indicator */}
                      <Ionicons name="chevron-forward" size={13} color={COLORS.textTertiary} style={{ marginLeft: 2 }} />
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })
          )}
        </View>

        {/* ── Share button ── */}
        <TouchableOpacity style={styles.shareBtn} activeOpacity={0.8}>
          <Ionicons name="share-outline" size={16} color={COLORS.white} />
          <Text style={styles.shareBtnText}>Share PDF / XLSX</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── Info modal ── */}
      <LedgerInfoModal visible={showInfo} onClose={() => setShowInfo(false)} />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700',
    color: COLORS.textPrimary, textAlign: 'center',
  },
  infoBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll:  { flex: 1 },

  // Donut + legend card
  chartSection: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 24,
    backgroundColor: COLORS.cardBg,
    margin: SPACING.md, borderRadius: RADIUS.lg,
    padding: 16, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  chartLegend: { gap: 10, alignItems: 'flex-start' },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot:   { width: 11, height: 11, borderRadius: 6 },
  legendText:  { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  tapHint:     { fontSize: 10, color: COLORS.textTertiary, marginTop: 6, fontStyle: 'italic' },

  // KPI chips
  kpiRow: { paddingHorizontal: SPACING.md, gap: 8, paddingBottom: SPACING.md },
  kpiChip: {
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    alignItems: 'center', gap: 2,
  },
  kpiLabel: { fontSize: 10, color: COLORS.textTertiary, fontWeight: '500' },
  kpiValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },

  // Search + filter row
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchBoxFocused: {
    borderColor: COLORS.brandPrimary,
    borderWidth: 1.5,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textPrimary,
    paddingVertical: 0,      // remove extra android padding
    minHeight: 20,
  },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: COLORS.cardBg, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  filterPillActive:     { backgroundColor: COLORS.activeBg, borderColor: COLORS.brandPrimary },
  filterPillText:       { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  filterPillTextActive: { color: COLORS.brandPrimary },

  // Month accordion
  txnContainer: {
    marginHorizontal: SPACING.md, borderRadius: RADIUS.lg,
    overflow: 'hidden', borderWidth: 1,
    borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
    marginBottom: SPACING.md,
  },
  monthGroup: {},
  monthHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 11,
    backgroundColor: COLORS.pageBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  monthHeaderText: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '700',
    color: COLORS.textSecondary, letterSpacing: 0.3,
  },

  // Transaction rows
  txnRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SPACING.md, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
  },
  txnDateCol:  { width: 36, alignItems: 'center' },
  txnDay:      { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  txnMon:      { fontSize: 10, color: COLORS.textTertiary, marginTop: 1 },
  txnInfo:     { flex: 1 },
  txnVoucher:  { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  txnType:     { fontSize: 11, color: COLORS.textTertiary, marginTop: 2 },
  txnAmounts:  { alignItems: 'flex-end' },
  txnAmt:      { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  txnBalance:  { fontSize: 10, color: COLORS.textTertiary, marginTop: 2 },

  // Empty search state
  emptySearch: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.cardBg,
  },
  emptySearchText: {
    fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary,
    textAlign: 'center', paddingHorizontal: 24,
  },

  // Share
  shareBtn: {    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    margin: SPACING.md, backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.lg, paddingVertical: 14,
  },
  shareBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});

// ── Info Modal Styles ─────────────────────────────────────────────────────────
const im = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary,
  },
  closeX: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { flex: 1 },

  // Sections
  section: {
    marginHorizontal: SPACING.md, marginTop: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '800',
    color: COLORS.textTertiary, letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: COLORS.pageBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  sectionBody: {
    paddingHorizontal: 14, paddingVertical: 10, gap: 7,
  },

  // Info rows
  rowText:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, lineHeight: 20 },
  rowLabel: { fontWeight: '600', color: COLORS.textSecondary },
  rowValue: { color: COLORS.textPrimary },
  narration: {
    fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary,
    lineHeight: 20, paddingHorizontal: 14, paddingVertical: 10,
  },

  // Footer close button
  footer: {
    padding: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  closeBtn: {
    backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.md, paddingVertical: 15,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: TYPOGRAPHY.base, fontWeight: '700',
    color: COLORS.white, letterSpacing: 0.3,
  },
});
