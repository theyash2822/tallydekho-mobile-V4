import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal, { parseDMY, fmtDMY } from '../../src/components/DateRangePickerModal';
import { useAuth } from '../../src/context/AuthContext';
import { getGSTDetail, getCompanyCapabilities } from '../../src/services/api';
import { useSettings } from '../../src/context/SettingsContext';
import { LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';

// ── GSTR Tabs ─────────────────────────────────────────────────────────────────
const GSTR_TABS = [
  'GSTR-1', 'GSTR-2A', 'GSTR-2B', 'GSTR-3B',
  'GSTR-4', 'GSTR-5', 'GSTR-5A', 'GSTR-6',
  'GSTR-7', 'GSTR-8', 'GSTR-9', 'GSTR-10', 'GSTR-11',
];

// ── Month label helpers ───────────────────────────────────────────────────────
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Returns e.g. "Apr 24" from a Date object */
function monthLabel(d: Date): string {
  return `${MONTH_ABBR[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

// (Mock invoice data removed — real API only)
interface Invoice {
  id: string;
  invoiceNo: string;
  type: string;
  party: string;
  date: string;
  dateObj: Date;
  amount: string;
  matched: boolean;
  gstr: string[];
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function GSTScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company } = useAuth();
  const companyGuid = company?.guid;
  const [isGSTApplicable, setIsGSTApplicable] = useState(true);
  const [gstNotApplicableMsg, setGstNotApplicableMsg] = useState('');
  const [liveInvoices, setLiveInvoices] = useState<any[]>([]);
  const [tabNotApplicable, setTabNotApplicable] = useState(false);
  const [tabNotApplicableMsg, setTabNotApplicableMsg] = useState('');
  const [gstr3bSummary, setGstr3bSummary] = useState<any>(null);

  // ── Feature 1: shimmer loading state ──────────────────────────────────────
  const [loading, setLoading] = useState(false);

  // ── Feature 2: month filter state ─────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const [activeTab,       setActiveTab]       = useState('GSTR-1');
  const [fromDate,        setFromDate]        = useState('');
  const [toDate,          setToDate]          = useState('');
  const [showDatePicker,  setShowDatePicker]  = useState(false);
  const [selected,        setSelected]        = useState<string[]>([]);

  useEffect(() => {
    if (!companyGuid) return;
    // Reset tab-specific state on tab change
    setLiveInvoices([]);
    setTabNotApplicable(false);
    setTabNotApplicableMsg('');
    setGstr3bSummary(null);

    getGSTDetail(companyGuid, { type: activeTab }).then((res: any) => {
      if (res?.meta?.country_applicable === false) {
        setIsGSTApplicable(false);
        setGstNotApplicableMsg(res.meta.message || 'GST reports not applicable for your country');
        setLoading(false);
        return;
      }
      // Tab-specific: GSTR-4, GSTR-6 etc.
      if (res?.meta?.not_applicable) {
        setTabNotApplicable(true);
        setTabNotApplicableMsg(res.meta.message || `${activeTab} not applicable`);
        setLoading(false);
        return;
      }
      // GSTR-3B summary
      if (res?.meta?.is_summary && res?.summary) {
        setGstr3bSummary(res.summary);
        setLoading(false);
        return;
      }
      const rows = res?.data ?? [];
      if (rows.length) setLiveInvoices(rows.map((r: any, idx: number) => ({
        id: r.guid || r.id ? `${r.guid || r.id}` : `row-${activeTab}-${idx}`,
        invoiceNo: r.voucher_number||'', type: r.voucher_type||'Sales',
        party: r.party_name||'', date: r.date||'', dateObj: new Date(r.date||Date.now()),
        amount: formatAmount(Math.abs(+r.amount||0)),
        matched: !!(r.irn), gstr: [activeTab],
      })));
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }, [companyGuid, activeTab]);

  // ── Feature 2: derive available months from current tab's invoices ─────────
  const availableMonths = useMemo<string[]>(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    // Sort by date ascending before deriving order
    const sorted = [...liveInvoices].sort(
      (a, b) => a.dateObj.getTime() - b.dateObj.getTime()
    );
    for (const inv of sorted) {
      const label = monthLabel(inv.dateObj);
      if (!seen.has(label)) { seen.add(label); ordered.push(label); }
    }
    return ordered;
  }, [liveInvoices]);

  const isDateActive = fromDate.length > 0 && toDate.length > 0;
  const sourceInvoices = liveInvoices;

  // Filter by tab + date range + selected month
  const filteredInvoices = sourceInvoices.filter((inv: any) => {
    if (!inv.gstr.includes(activeTab)) return false;
    if (isDateActive) {
      const from = parseDMY(fromDate);
      const to   = parseDMY(toDate);
      if (from && to) {
        if (!(inv.dateObj >= from && inv.dateObj <= to)) return false;
      }
    }
    // ── Feature 2: month filter ────────────────────────────────────────────
    if (selectedMonth !== null) {
      if (monthLabel(inv.dateObj) !== selectedMonth) return false;
    }
    return true;
  });

  // ── Feature 3: unmatched count reflects current tab's invoices ────────────
  const unmatchedCount = sourceInvoices.filter(
    (inv: any) => !inv.matched && (inv.gstr||[]).includes(activeTab)
  ).length;

  if (!isGSTApplicable) {
    return (
      <SafeAreaView style={[s.safe]} edges={['top']}>
        <View style={[s.header]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
          <Text style={s.headerTitle}>GST Reports</Text><View style={{width:36}} />
        </View>
        <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:24}}>
          <Ionicons name="information-circle-outline" size={48} color={COLORS.textTertiary} />
          <Text style={{fontSize:16,fontWeight:'700',color:COLORS.textPrimary,marginTop:12,textAlign:'center'}}>Not Applicable</Text>
          <Text style={{fontSize:14,color:COLORS.textSecondary,marginTop:8,textAlign:'center'}}>{gstNotApplicableMsg}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  // ── Feature 1: set loading=true on tab change ──────────────────────────────
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelected([]);
    setSelectedMonth(null); // reset month filter on tab change
    setLoading(true);
  };

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>GST</Text>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={isDateActive ? COLORS.brandPrimary : COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* ── Date Range Strip (unified, same as financial/ledger) ─────── */}
      <TouchableOpacity
        style={s.dateStrip}
        onPress={() => setShowDatePicker(true)}
        activeOpacity={0.8}
      >
        <Ionicons
          name="calendar-outline"
          size={13}
          color={isDateActive ? COLORS.brandPrimary : COLORS.textTertiary}
        />
        <Text style={[s.dateStripTxt, isDateActive && s.dateStripActive]}>
          {isDateActive ? `${fromDate}  \u2192  ${toDate}` : 'All Dates'}
        </Text>
        {!isDateActive && (
          <Ionicons name="chevron-down" size={11} color={COLORS.textTertiary} />
        )}
        {isDateActive && (
          <TouchableOpacity
            onPress={() => { setFromDate(''); setToDate(''); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color={COLORS.brandPrimary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {/* ── Summary Card ────────────────────────────────────────────── */}
        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>GST Collected</Text>
            <Text style={s.summaryValue}>{'₹4,75,000'}</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>ITC Balance</Text>
            <Text style={s.summaryValue}>{'₹3,92,000'}</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Net Payable</Text>
            <Text style={s.summaryValue}>{'₹83,000'}</Text>
          </View>
        </View>

        {/* ── Unmatched CTA (Feature 3: reflects current tab) ─────────── */}
        {unmatchedCount > 0 && (
          <TouchableOpacity
            style={s.unmatchedBtn}
            onPress={() => router.push('/reports/unmatched-list' as any)}
            activeOpacity={0.85}
          >
            <Text style={s.unmatchedBtnTxt}>Unmatched {unmatchedCount} Invoices</Text>
          </TouchableOpacity>
        )}

        {/* ── GST Ledger Section ──────────────────────────────────────── */}
        <Text style={s.sectionLabel}>GST Ledger</Text>

        {/* ── GSTR Tab Pills (horizontal scroll) ─────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabBarContent}
          style={s.tabBarWrap}
        >
          {GSTR_TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[s.tabPill, activeTab === tab && s.tabPillActive]}
              onPress={() => handleTabChange(tab)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabPillTxt, activeTab === tab && s.tabPillTxtActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Feature 2: Month Filter Chips ───────────────────────────── */}
        {!loading && availableMonths.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.monthBarContent}
            style={s.monthBarWrap}
          >
            {/* "All" chip */}
            <TouchableOpacity
              style={[s.monthChip, selectedMonth === null && s.monthChipActive]}
              onPress={() => setSelectedMonth(null)}
              activeOpacity={0.7}
            >
              <Text style={[s.monthChipTxt, selectedMonth === null && s.monthChipTxtActive]}>
                All
              </Text>
            </TouchableOpacity>

            {availableMonths.map((mon) => (
              <TouchableOpacity
                key={mon}
                style={[s.monthChip, selectedMonth === mon && s.monthChipActive]}
                onPress={() => setSelectedMonth(selectedMonth === mon ? null : mon)}
                activeOpacity={0.7}
              >
                <Text style={[s.monthChipTxt, selectedMonth === mon && s.monthChipTxtActive]}>
                  {mon}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Tab Not Applicable ───────────────────────────────────────── */}
        {tabNotApplicable && (
          <View style={s.emptyBox}>
            <Ionicons name="information-circle-outline" size={44} color={COLORS.textTertiary} />
            <Text style={[s.emptyTxt, {fontWeight:'700',color:COLORS.textPrimary}]}>{activeTab} — Not Applicable</Text>
            <Text style={[s.emptyTxt,{fontSize:12,marginTop:4}]}>{tabNotApplicableMsg}</Text>
          </View>
        )}

        {/* ── GSTR-3B Summary ─────────────────────────────────────────── */}
        {gstr3bSummary && (
          <ScrollView style={{flex:1}} contentContainerStyle={{padding:16,gap:12}}>
            <Text style={{fontSize:14,fontWeight:'700',color:COLORS.textSecondary,marginBottom:4}}>GSTR-3B Summary</Text>
            {[
              {label:'Total Outward Supply (Sales)',value:gstr3bSummary.outwardSupply,color:COLORS.positive},
              {label:'Total Inward Supply (Purchase)',value:gstr3bSummary.inwardSupply,color:COLORS.textSecondary},
              {label:'Estimated Output Tax (18%)',value:gstr3bSummary.outputTax,color:COLORS.negative||'#E53935'},
              {label:'Input Tax Credit (18%)',value:gstr3bSummary.inputTaxCredit,color:COLORS.positive},
              {label:'Net GST Payable',value:gstr3bSummary.netTaxPayable,color:COLORS.negative||'#E53935'},
            ].map(row => (
              <View key={row.label} style={{flexDirection:'row',justifyContent:'space-between',paddingVertical:10,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault}}>
                <Text style={{fontSize:13,color:COLORS.textSecondary,flex:1}}>{row.label}</Text>
                <Text style={{fontSize:13,fontWeight:'700',color:row.color}}>₹{row.value?.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text>
              </View>
            ))}
            <Text style={{fontSize:11,color:COLORS.textTertiary,marginTop:8}}>* Tax amounts are approximate (18% GST). Actual rates may vary per item.</Text>
          </ScrollView>
        )}

        {/* ── Feature 1: Shimmer skeleton while loading ───────────────── */}
        {loading && !tabNotApplicable && !gstr3bSummary && (
          <View style={s.shimmerWrap}>
            {[...Array(6)].map((_, i) => (
              <LedgerRowSkeleton key={`shimmer-${i}`} />
            ))}
          </View>
        )}

        {/* ── Invoice List ─────────────────────────────────────────────── */}
        {!loading && !tabNotApplicable && !gstr3bSummary && filteredInvoices.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="checkmark-circle-outline" size={44} color={COLORS.positive} />
            <Text style={s.emptyTxt}>No invoices found</Text>
          </View>
        ) : !loading && !tabNotApplicable && !gstr3bSummary && (
          filteredInvoices.map((inv) => {
            const isSelected = selected.includes(inv.id);
            return (
              <TouchableOpacity
                key={inv.id}
                style={[s.invoiceCard, isSelected && s.invoiceCardSelected]}
                onPress={() => {
                  if (selected.length > 0) {
                    toggleSelect(inv.id);
                  } else {
                    // ── Feature 4: open document screen with type param ──
                    router.push(`/document/${inv.id}?type=${encodeURIComponent(inv.type)}` as any);
                  }
                }}
                onLongPress={() => toggleSelect(inv.id)}
                delayLongPress={500}
                activeOpacity={0.8}
              >
                {/* Top row: Invoice ID + type */}
                <View style={s.invTopRow}>
                  <Text style={s.invId}>{inv.invoiceNo}</Text>
                  <Text style={s.invSep}> \u2022 </Text>
                  <Text style={s.invType}>{inv.type}</Text>
                </View>

                {/* Body: Status icon + Party info + Amount */}
                <View style={s.invBodyRow}>
                  <View
                    style={[
                      s.statusIcon,
                      { backgroundColor: inv.matched ? '#F0FBF4' : '#FEF2F2' },
                    ]}
                  >
                    <Ionicons
                      name={inv.matched ? 'checkmark' : 'warning'}
                      size={15}
                      color={inv.matched ? COLORS.positive : '#DC2626'}
                    />
                  </View>
                  <View style={s.invInfo}>
                    <Text style={s.invParty}>{inv.party}</Text>
                    <Text style={s.invDate}>{inv.date}</Text>
                  </View>
                  <Text style={s.invAmount}>{inv.amount}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: selected.length > 0 ? 90 : 40 }} />
      </ScrollView>

      {/* ── Share Bar (appears on long-press selection) ──────────────── */}
      {selected.length > 0 && (
        <View style={[s.shareBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.shareLeft}>
            <Text style={s.shareCount}>{selected.length} selected</Text>
            <TouchableOpacity
              onPress={() => setSelected([])}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text style={s.shareCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.shareActionBtn} activeOpacity={0.85}>
            <Ionicons name="share-outline" size={16} color={COLORS.white} />
            <Text style={s.shareActionTxt}>Share PDF / XLS</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Date Range Modal (shared component) ─────────────────────── */}
      <DateRangePickerModal
        visible={showDatePicker}
        fromDate={fromDate}
        toDate={toDate}
        onApply={(from, to) => {
          if (from && to) { setFromDate(from); setToDate(to); }
        }}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  iconBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },

  // Date Strip
  dateStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  dateStripTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  dateStripActive: { color: COLORS.brandPrimary },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  // Summary Card
  summaryCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    marginBottom: SPACING.sm,
  },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14,
  },
  summaryDivider: { height: 1, backgroundColor: COLORS.borderDefault },
  summaryLabel: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '500' },
  summaryValue: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },

  // Unmatched CTA
  unmatchedBtn: {
    backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  unmatchedBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white, letterSpacing: 0.2 },

  // Section label
  sectionLabel: {
    fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },

  // Tab bar
  tabBarWrap: { marginBottom: SPACING.sm },
  tabBarContent: { gap: 8, paddingRight: SPACING.md },
  tabPill: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.pageBg,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
  },
  tabPillActive: {
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.brandPrimary,
  },
  tabPillTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabPillTxtActive: { color: COLORS.brandPrimary, fontWeight: '700' },

  // Month filter bar
  monthBarWrap: { marginBottom: SPACING.sm },
  monthBarContent: { gap: 8, paddingRight: SPACING.md },
  monthChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: 'transparent',
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
  },
  monthChipActive: {
    backgroundColor: COLORS.brandPrimary,
    borderColor: COLORS.brandPrimary,
  },
  monthChipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  monthChipTxtActive: { color: '#FFFFFF', fontWeight: '700' },

  // Shimmer wrap
  shimmerWrap: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },

  // Empty state
  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, fontWeight: '500' },

  // Invoice cards
  invoiceCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: 8,
  },
  invoiceCardSelected: {
    borderColor: COLORS.brandPrimary,
    borderWidth: 2,
  },

  invTopRow: { flexDirection: 'row', alignItems: 'center' },
  invId:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  invSep:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  invType: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },

  invBodyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  invInfo:   { flex: 1, gap: 3 },
  invParty:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  invDate:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  invAmount: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },

  // Share bar
  shareBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    gap: 12,
  },
  shareLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  shareCount: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  shareCancelTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textSecondary },
  shareActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 18, paddingVertical: 11,
    borderRadius: RADIUS.md,
  },
  shareActionTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
});
