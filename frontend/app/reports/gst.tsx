import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal, { parseDMY } from '../../src/components/DateRangePickerModal';
import { useAuth } from '../../src/context/AuthContext';
import { fyInfoToParam } from '../../src/context/AuthContext';
import { getGSTDetail } from '../../src/services/api';
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

/** Returns e.g. "Apr 2024" from a Date object */
function monthLabel(d: Date): string {
  return `${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

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
  const { formatAmount } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const companyGuid = company?.guid;

  const [isGSTApplicable, setIsGSTApplicable] = useState(true);
  const [gstNotApplicableMsg, setGstNotApplicableMsg] = useState('');
  const [liveInvoices, setLiveInvoices] = useState<Invoice[]>([]);
  const [tabNotApplicable, setTabNotApplicable] = useState(false);
  const [tabNotApplicableMsg, setTabNotApplicableMsg] = useState('');
  const [gstr3bSummary, setGstr3bSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [activeTab,      setActiveTab]      = useState('GSTR-1');
  const [fromDate,       setFromDate]       = useState('');
  const [toDate,         setToDate]         = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selected,       setSelected]       = useState<string[]>([]);

  // ── Collapsible months: Set of month labels that are currently collapsed ──
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  const toggleMonth = useCallback((month: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }, []);

  // ── Fetch on tab change or FY change ──────────────────────────────────────
  useEffect(() => {
    if (!companyGuid) return;
    setLiveInvoices([]);
    setTabNotApplicable(false);
    setTabNotApplicableMsg('');
    setGstr3bSummary(null);
    setLoading(true);
    setCollapsedMonths(new Set()); // reset collapsed on every refetch

    const fyParam = fyInfoToParam(selectedFY);

    getGSTDetail(companyGuid, {
      type: activeTab,
      ...(fyParam ? { fy: fyParam } : {}),
    }).then((res: any) => {
      if (res?.meta?.country_applicable === false) {
        setIsGSTApplicable(false);
        setGstNotApplicableMsg(res.meta.message || 'GST reports not applicable for your country');
        setLoading(false);
        return;
      }
      if (res?.meta?.not_applicable) {
        setTabNotApplicable(true);
        setTabNotApplicableMsg(res.meta.message || `${activeTab} not applicable`);
        setLoading(false);
        return;
      }
      if (res?.meta?.is_summary && res?.summary) {
        setGstr3bSummary(res.summary);
        setLoading(false);
        return;
      }
      const rows: any[] = res?.data ?? [];
      if (rows.length) {
        setLiveInvoices(rows.map((r: any, idx: number) => ({
          id: r.guid || r.id ? `${r.guid || r.id}` : `row-${activeTab}-${idx}`,
          invoiceNo: r.voucher_number || '',
          type: r.voucher_type || 'Sales',
          party: r.party_name || '',
          date: r.date || '',
          dateObj: new Date(r.date || Date.now()),
          amount: formatAmount(Math.abs(+r.amount || 0)),
          matched: !!(r.irn),
          gstr: [activeTab],
        })));
      }
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }, [companyGuid, activeTab, selectedFY]);

  const isDateActive = fromDate.length > 0 && toDate.length > 0;

  // ── Filter by tab + date range ────────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    return liveInvoices.filter((inv) => {
      if (!inv.gstr.includes(activeTab)) return false;
      if (isDateActive) {
        const from = parseDMY(fromDate);
        const to   = parseDMY(toDate);
        if (from && to && !(inv.dateObj >= from && inv.dateObj <= to)) return false;
      }
      return true;
    });
  }, [liveInvoices, activeTab, isDateActive, fromDate, toDate]);

  // ── Group filtered invoices by month (chronological order) ───────────────
  const groupedInvoices = useMemo(() => {
    const groups: { month: string; invoices: Invoice[] }[] = [];
    const monthMap = new Map<string, Invoice[]>();
    const sorted = [...filteredInvoices].sort(
      (a, b) => a.dateObj.getTime() - b.dateObj.getTime()
    );
    for (const inv of sorted) {
      const m = monthLabel(inv.dateObj);
      if (!monthMap.has(m)) {
        monthMap.set(m, []);
        groups.push({ month: m, invoices: monthMap.get(m)! });
      }
      monthMap.get(m)!.push(inv);
    }
    return groups;
  }, [filteredInvoices]);

  // ── Unmatched count for current tab ──────────────────────────────────────
  const unmatchedCount = liveInvoices.filter(
    (inv) => !inv.matched && inv.gstr.includes(activeTab)
  ).length;

  if (!isGSTApplicable) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>GST Reports</Text>
          <View style={{width:44}} />
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
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelected([]);
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
        <TouchableOpacity style={s.iconBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
          <Ionicons
            name="calendar-outline"
            size={20}
            color={isDateActive ? COLORS.brandPrimary : COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* ── Date Range Strip ─────────────────────────────────────────────── */}
      <TouchableOpacity style={s.dateStrip} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={13} color={isDateActive ? COLORS.brandPrimary : COLORS.textTertiary} />
        <Text style={[s.dateStripTxt, isDateActive && s.dateStripActive]}>
          {isDateActive ? `${fromDate}  →  ${toDate}` : 'All Dates'}
        </Text>
        {!isDateActive && <Ionicons name="chevron-down" size={11} color={COLORS.textTertiary} />}
        {isDateActive && (
          <TouchableOpacity onPress={() => { setFromDate(''); setToDate(''); }} hitSlop={{top:8,bottom:8,left:8,right:8}}>
            <Ionicons name="close-circle" size={16} color={COLORS.brandPrimary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* ── Summary Card ─────────────────────────────────────────────── */}
        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>GST Collected</Text>
            <Text style={s.summaryValue}>₹4,75,000</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>ITC Balance</Text>
            <Text style={s.summaryValue}>₹3,92,000</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Net Payable</Text>
            <Text style={s.summaryValue}>₹83,000</Text>
          </View>
        </View>

        {/* ── Unmatched CTA ────────────────────────────────────────────── */}
        {unmatchedCount > 0 && (
          <TouchableOpacity
            style={s.unmatchedBtn}
            onPress={() => router.push('/reports/unmatched-list' as any)}
            activeOpacity={0.85}
          >
            <Text style={s.unmatchedBtnTxt}>Unmatched {unmatchedCount} Invoices</Text>
          </TouchableOpacity>
        )}

        {/* ── GST Ledger Section ───────────────────────────────────────── */}
        <Text style={s.sectionLabel}>GST Ledger</Text>

        {/* ── GSTR Tab Pills ───────────────────────────────────────────── */}
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
              <Text style={[s.tabPillTxt, activeTab === tab && s.tabPillTxtActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Tab Not Applicable ───────────────────────────────────────── */}
        {tabNotApplicable && (
          <View style={s.emptyBox}>
            <Ionicons name="information-circle-outline" size={44} color={COLORS.textTertiary} />
            <Text style={[s.emptyTxt, {fontWeight:'700',color:COLORS.textPrimary}]}>{activeTab} — Not Applicable</Text>
            <Text style={[s.emptyTxt, {fontSize:12,marginTop:4}]}>{tabNotApplicableMsg}</Text>
          </View>
        )}

        {/* ── GSTR-3B Summary ─────────────────────────────────────────── */}
        {gstr3bSummary && (
          <View style={{gap:12}}>
            <Text style={{fontSize:14,fontWeight:'700',color:COLORS.textSecondary,marginBottom:4}}>GSTR-3B Summary</Text>
            {[
              {label:'Total Outward Supply (Sales)',    value:gstr3bSummary.outwardSupply,   color:COLORS.positive},
              {label:'Total Inward Supply (Purchase)',  value:gstr3bSummary.inwardSupply,    color:COLORS.textSecondary},
              {label:'Estimated Output Tax (18%)',      value:gstr3bSummary.outputTax,       color:COLORS.negative||'#E53935'},
              {label:'Input Tax Credit (18%)',          value:gstr3bSummary.inputTaxCredit,  color:COLORS.positive},
              {label:'Net GST Payable',                 value:gstr3bSummary.netTaxPayable,   color:COLORS.negative||'#E53935'},
            ].map(row => (
              <View key={row.label} style={{flexDirection:'row',justifyContent:'space-between',paddingVertical:10,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault}}>
                <Text style={{fontSize:13,color:COLORS.textSecondary,flex:1}}>{row.label}</Text>
                <Text style={{fontSize:13,fontWeight:'700',color:row.color}}>₹{row.value?.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text>
              </View>
            ))}
            <Text style={{fontSize:11,color:COLORS.textTertiary,marginTop:8}}>* Tax amounts are approximate (18% GST). Actual rates may vary per item.</Text>
          </View>
        )}

        {/* ── Shimmer skeleton while loading ──────────────────────────── */}
        {loading && !tabNotApplicable && !gstr3bSummary && (
          <View style={s.shimmerWrap}>
            {[...Array(6)].map((_, i) => <LedgerRowSkeleton key={`sk-${i}`} />)}
          </View>
        )}

        {/* ── Empty state ──────────────────────────────────────────────── */}
        {!loading && !tabNotApplicable && !gstr3bSummary && filteredInvoices.length === 0 && (
          <View style={s.emptyBox}>
            <Ionicons name="checkmark-circle-outline" size={44} color={COLORS.positive} />
            <Text style={s.emptyTxt}>No invoices found</Text>
          </View>
        )}

        {/* ── Invoice List — grouped by month with collapsible headers ── */}
        {!loading && !tabNotApplicable && !gstr3bSummary && groupedInvoices.length > 0 && (
          groupedInvoices.map(({ month, invoices: monthInvoices }) => {
            const isCollapsed = collapsedMonths.has(month);
            return (
              <View key={month}>
                {/* Month section header */}
                <TouchableOpacity
                  style={s.monthHeader}
                  onPress={() => toggleMonth(month)}
                  activeOpacity={0.75}
                >
                  <Text style={s.monthHeaderTxt}>{month}</Text>
                  <View style={s.monthHeaderRight}>
                    <Text style={s.monthHeaderCount}>{monthInvoices.length} invoice{monthInvoices.length !== 1 ? 's' : ''}</Text>
                    <Ionicons
                      name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                      size={15}
                      color={COLORS.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {/* Invoice cards — hidden when collapsed */}
                {!isCollapsed && monthInvoices.map((inv) => {
                  const isSelected = selected.includes(inv.id);
                  return (
                    <TouchableOpacity
                      key={inv.id}
                      style={[s.invoiceCard, isSelected && s.invoiceCardSelected]}
                      onPress={() => {
                        if (selected.length > 0) {
                          toggleSelect(inv.id);
                        } else {
                          router.push(`/document/${inv.id}?type=${encodeURIComponent(inv.type)}` as any);
                        }
                      }}
                      onLongPress={() => toggleSelect(inv.id)}
                      delayLongPress={500}
                      activeOpacity={0.8}
                    >
                      <View style={s.invTopRow}>
                        <Text style={s.invId}>{inv.invoiceNo}</Text>
                        <Text style={s.invSep}> • </Text>
                        <Text style={s.invType}>{inv.type}</Text>
                      </View>
                      <View style={s.invBodyRow}>
                        <View style={[s.statusIcon, { backgroundColor: inv.matched ? '#F0FBF4' : '#FEF2F2' }]}>
                          <Ionicons name={inv.matched ? 'checkmark' : 'warning'} size={15} color={inv.matched ? COLORS.positive : '#DC2626'} />
                        </View>
                        <View style={s.invInfo}>
                          <Text style={s.invParty}>{inv.party}</Text>
                          <Text style={s.invDate}>{inv.date}</Text>
                        </View>
                        <Text style={s.invAmount}>{inv.amount}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })
        )}

        <View style={{ height: selected.length > 0 ? 90 : 40 }} />
      </ScrollView>

      {/* ── Share Bar (long-press selection) ─────────────────────────── */}
      {selected.length > 0 && (
        <View style={[s.shareBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.shareLeft}>
            <Text style={s.shareCount}>{selected.length} selected</Text>
            <TouchableOpacity onPress={() => setSelected([])} hitSlop={{top:8,bottom:8,left:8,right:8}} activeOpacity={0.7}>
              <Text style={s.shareCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.shareActionBtn} activeOpacity={0.85}>
            <Ionicons name="share-outline" size={16} color={COLORS.white} />
            <Text style={s.shareActionTxt}>Share PDF / XLS</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Date Range Modal ─────────────────────────────────────────── */}
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

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  iconBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },

  dateStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  dateStripTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  dateStripActive: { color: COLORS.brandPrimary },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  summaryCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.md, paddingVertical: 4,
    marginBottom: SPACING.sm,
  },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14,
  },
  summaryDivider: { height: 1, backgroundColor: COLORS.borderDefault },
  summaryLabel:   { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '500' },
  summaryValue:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },

  unmatchedBtn: {
    backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.md, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  unmatchedBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white, letterSpacing: 0.2 },

  sectionLabel: {
    fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },

  tabBarWrap:    { marginBottom: SPACING.sm },
  tabBarContent: { gap: 8, paddingRight: SPACING.md },
  tabPill: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.pageBg,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
  },
  tabPillActive:    { backgroundColor: COLORS.cardBg, borderColor: COLORS.brandPrimary },
  tabPillTxt:       { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabPillTxtActive: { color: COLORS.brandPrimary, fontWeight: '700' },

  // Month section header
  monthHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 4,
    marginTop: SPACING.sm, marginBottom: 6,
    borderBottomWidth: 1.5, borderBottomColor: COLORS.borderDefault,
  },
  monthHeaderTxt: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  monthHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthHeaderCount: { fontSize: TYPOGRAPHY.xs, fontWeight: '500', color: COLORS.textSecondary },

  shimmerWrap: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden', marginBottom: SPACING.sm,
  },

  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, fontWeight: '500' },

  invoiceCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, marginBottom: SPACING.sm, gap: 8,
  },
  invoiceCardSelected: { borderColor: COLORS.brandPrimary, borderWidth: 2 },

  invTopRow: { flexDirection: 'row', alignItems: 'center' },
  invId:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  invSep:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  invType:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },

  invBodyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  invInfo:    { flex: 1, gap: 3 },
  invParty:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  invDate:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  invAmount:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },

  shareBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    gap: 12,
  },
  shareLeft:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  shareCount:      { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  shareCancelTxt:  { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textSecondary },
  shareActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: RADIUS.md,
  },
  shareActionTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
});
