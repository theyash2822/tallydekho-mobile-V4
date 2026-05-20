import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import {
  getOtherTaxesSummary,
  getOtherTaxesTransactions,
  getOtherTaxesLateChallans,
} from '../../src/services/api';

// ── Tab Config ───────────────────────────────────────────────────────────────
const TABS = [
  { label: 'TDS',          taxType: 'TDS' },
  { label: 'TCS',          taxType: 'TCS' },
  { label: 'VAT',          taxType: 'VAT' },
  { label: 'Cess',         taxType: 'CESS' },
  { label: 'Excise Duty',  taxType: 'EXCISE_DUTY' },
  { label: 'Service Tax',  taxType: 'SERVICE_TAX' },
  { label: 'Import Duty',  taxType: 'IMPORT_DUTY' },
  { label: 'Export Duty',  taxType: 'EXPORT_DUTY' },
  { label: 'WHT',          taxType: 'WITHHOLDING_TAX' },
] as const;

type TabItem = typeof TABS[number];

interface SummaryRow {
  taxType: string;
  voucherCount: number;
  totalTaxAmount: number;
  lastTransactionDate: string | null;
}

interface TaxTxn {
  id: number;
  voucher_guid: string;
  voucher_date: string;
  voucher_number: string | null;
  voucher_type: string | null;
  party_ledger_name: string | null;
  tax_ledger_name: string;
  tax_amount: number;
  transaction_nature: string | null;
  financial_year?: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(n: number | string | null | undefined): string {
  const num = parseFloat(String(n ?? 0));
  if (isNaN(num)) return '0';
  if (Math.abs(num) >= 1_00_00_000) return `₹${(num / 1_00_00_000).toFixed(2)}Cr`;
  if (Math.abs(num) >= 1_00_000)    return `₹${(num / 1_00_000).toFixed(2)}L`;
  if (Math.abs(num) >= 1_000)       return `₹${(num / 1_000).toFixed(1)}K`;
  return `₹${num.toFixed(0)}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '-';
  const s = String(d).replace(/T.*/, '');
  const parts = s.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
  return s;
}

/** Group flat TaxTxn array into [{month, items}] sorted newest first */
function groupByMonth(txns: TaxTxn[]): Array<{ month: string; items: TaxTxn[] }> {
  const map = new Map<string, TaxTxn[]>();
  for (const txn of txns) {
    const raw = txn.voucher_date ? String(txn.voucher_date).replace(/T.*/, '') : '';
    const d   = raw ? new Date(raw) : null;
    let key: string;
    if (d && !isNaN(d.getTime())) {
      key = `${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
    } else if (txn.financial_year) {
      // No date — fall back to FY label e.g. '2017-2018' → 'FY 2017-18'
      const parts = String(txn.financial_year).split('-');
      key = parts.length === 2 ? `FY ${parts[0]}-${parts[1].slice(2)}` : `FY ${txn.financial_year}`;
    } else {
      key = 'Undated Entries';
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(txn);
  }
  return Array.from(map.entries()).map(([month, items]) => ({ month, items }));
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function OtherTaxesScreen() {
  const router = useRouter();
  const { company: selectedCompany, selectedFY } = useAuth();

  const [activeTab, setActiveTab] = useState<TabItem>(TABS[0]);

  // Summary
  const [summary, setSummary]               = useState<SummaryRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError]     = useState<string | null>(null);

  // Transactions
  const [txns, setTxns]           = useState<TaxTxn[]>([]);
  const [txnsLoading, setTxnsLoading] = useState(false);
  const [txnsError, setTxnsError] = useState<string | null>(null);
  const [txnsTotal, setTxnsTotal] = useState(0);

  // Collapsible months — all expanded by default
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  // Late challans
  const [challans, setChallans]               = useState<any[]>([]);
  const [hasChallans, setHasChallans]         = useState(false);
  const [challansLoading, setChallansLoading] = useState(false);

  const companyGuid = selectedCompany?.guid;
  const fyParam     = fyInfoToParam(selectedFY);

  // ── Grouped txns (derived) ──────────────────────────────────────────────────
  const groupedTxns = useMemo(() => groupByMonth(txns), [txns]);

  // ── Load Summary (FY-level, unaffected by month filter) ─────────────────────
  const loadSummary = useCallback(async () => {
    if (!companyGuid) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await getOtherTaxesSummary(companyGuid, fyParam ? { fy: fyParam } : {});
      setSummary(res?.data ?? []);
    } catch (e: any) {
      setSummaryError(e?.message ?? 'Failed to load summary');
    } finally {
      setSummaryLoading(false);
    }
  }, [companyGuid, fyParam]);

  // ── Load Transactions ───────────────────────────────────────────────────────
  const loadTxns = useCallback(async (tab: TabItem) => {
    if (!companyGuid) return;
    setTxnsLoading(true);
    setTxnsError(null);
    try {
      const params: any = {
        taxType: tab.taxType,
        limit:   500,
        page:    1,
        ...(fyParam ? { fy: fyParam } : {}),
      };
      const res  = await getOtherTaxesTransactions(companyGuid, params);
      const rows: TaxTxn[] = res?.data ?? [];
      setTxns(rows);
      setTxnsTotal(res?.meta?.total ?? rows.length);
    } catch (e: any) {
      setTxnsError(e?.message ?? 'Failed to load transactions');
    } finally {
      setTxnsLoading(false);
    }
  }, [companyGuid, fyParam]);

  // ── Load Late Challans ──────────────────────────────────────────────────────
  const loadChallans = useCallback(async (tab: TabItem) => {
    if (!companyGuid) return;
    setChallansLoading(true);
    try {
      const params: any = { taxType: tab.taxType, ...(fyParam ? { fy: fyParam } : {}) };
      const res = await getOtherTaxesLateChallans(companyGuid, params);
      setChallans(res?.data ?? []);
      setHasChallans(res?.has_challan_data ?? false);
    } catch {
      setChallans([]); setHasChallans(false);
    } finally {
      setChallansLoading(false);
    }
  }, [companyGuid, fyParam]);

  // ── Initial + FY change ─────────────────────────────────────────────────────
  useEffect(() => { loadSummary(); }, [loadSummary]);

  // ── Tab change → reload txns + challans ────────────────────────────────────
  useEffect(() => {
    setTxns([]);
    setCollapsedMonths(new Set());
    loadTxns(activeTab);
    loadChallans(activeTab);
  }, [activeTab, loadTxns, loadChallans]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleTabPress = (tab: TabItem) => {
    if (tab.taxType === activeTab.taxType) return;
    setActiveTab(tab);
  };

  const toggleMonth = (month: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      next.has(month) ? next.delete(month) : next.add(month);
      return next;
    });
  };

  // ── Summary stats for active tab ────────────────────────────────────────────
  const activeSummary = summary.find(s => s.taxType === activeTab.taxType);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Other Taxes</Text>
        <View style={s.iconBtn} />
      </View>

      {/* FY Strip */}
      {selectedFY && (
        <View style={s.fyStrip}>
          <Ionicons name="calendar-outline" size={13} color={COLORS.brandPrimary} />
          <Text style={s.fyStripTxt}>{selectedFY.label ?? 'Current FY'}</Text>
        </View>
      )}

      {/* Tax Tab Bar */}
      <View style={s.tabBarWrapper}>
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabBarContent}
        >
          {TABS.map((tab) => {
            const tabSummary = summary.find(s => s.taxType === tab.taxType);
            const isActive   = activeTab.taxType === tab.taxType;
            return (
              <TouchableOpacity
                key={tab.taxType}
                style={[s.tabPill, isActive && s.tabPillActive]}
                onPress={() => handleTabPress(tab)}
                activeOpacity={0.7}
              >
                <Text style={[s.tabTxt, isActive && s.tabTxtActive]}>{tab.label}</Text>
                {tabSummary && tabSummary.totalTaxAmount > 0 && (
                  <View style={[s.tabBadge, isActive && s.tabBadgeActive]}>
                    <Text style={[s.tabBadgeTxt, isActive && s.tabBadgeTxtActive]}>
                      {fmt(tabSummary.totalTaxAmount)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>



      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >

        {/* Summary Loading/Error */}
        {summaryLoading && (
          <View style={s.centered}>
            <ActivityIndicator size="small" color={COLORS.brandPrimary} />
          </View>
        )}
        {summaryError && !summaryLoading && (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={'#E74C3C'} />
            <Text style={s.errorTxt}>{summaryError}</Text>
            <TouchableOpacity onPress={loadSummary}>
              <Text style={s.retryTxt}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats Card (always FY-level) */}
        {!summaryLoading && !summaryError && (
          activeSummary ? (
            <View style={s.statsCard}>
              <View style={s.statsRow}>
                <View style={s.statCell}>
                  <Text style={s.statLabel}>Total Tax Amount</Text>
                  <Text style={s.statValue}>{fmt(activeSummary.totalTaxAmount)}</Text>
                </View>
                <View style={s.statDivV} />
                <View style={s.statCell}>
                  <Text style={s.statLabel}>Vouchers</Text>
                  <Text style={s.statValue}>{activeSummary.voucherCount}</Text>
                </View>
              </View>
              <View style={s.statDivH} />
              <View style={s.statsRow}>
                <View style={s.statCell}>
                  <Text style={s.statLabel}>Last Transaction</Text>
                  <Text style={s.statValue}>{fmtDate(activeSummary.lastTransactionDate)}</Text>
                </View>
                <View style={s.statDivV} />
                <View style={s.statCell}>
                  <Text style={s.statLabel}>Tax Type</Text>
                  <Text style={s.statValue}>{activeTab.label}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={s.emptyCard}>
              <Ionicons name="receipt-outline" size={40} color={COLORS.textTertiary} />
              <Text style={s.emptyTitle}>No {activeTab.label} data found</Text>
              <Text style={s.emptySubtitle}>
                No {activeTab.label} entries found in synced Tally vouchers for the selected period.
              </Text>
            </View>
          )
        )}

        {/* Late Challans */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Top 5 Late Challans</Text>
          {challansLoading ? (
            <ActivityIndicator size="small" color={COLORS.brandPrimary} style={{ marginVertical: 12 }} />
          ) : !hasChallans ? (
            <Text style={s.challansUnavailable}>
              Late challans: Not available from current Tally data
            </Text>
          ) : (
            challans.map((item, idx) => (
              <View key={idx} style={[s.challanRow, idx < challans.length - 1 && s.challanBorder]}>
                <Text style={s.challanRank}>{idx + 1}.</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.challanId}>{item.return_period ?? item.challan_no ?? '-'}</Text>
                  <Text style={s.challanMeta}>{item.tax_type} · Due: {fmtDate(item.due_date)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.challanAmt}>{fmt(item.tax_amount)}</Text>
                  <Text style={s.challanLate}>{item.late_days ?? '-'} days late</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Transactions List — grouped by month */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>{activeTab.label} Transactions</Text>
            {txnsTotal > 0 && (
              <Text style={s.cardCount}>{txnsTotal} records</Text>
            )}
          </View>

          {txnsLoading ? (
            <ActivityIndicator size="small" color={COLORS.brandPrimary} style={{ marginVertical: 16 }} />
          ) : txnsError ? (
            <View style={s.errorBanner}>
              <Ionicons name="alert-circle-outline" size={14} color={'#E74C3C'} />
              <Text style={s.errorTxt}>{txnsError}</Text>
              <TouchableOpacity onPress={() => loadTxns(activeTab)}>
                <Text style={s.retryTxt}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : txns.length === 0 ? (
            <View style={s.emptyInline}>
              <Text style={s.emptyInlineTxt}>No {activeTab.label} data in synced Tally vouchers</Text>
            </View>
          ) : (
            groupedTxns.map((group) => {
              const collapsed = collapsedMonths.has(group.month);
              return (
                <View key={group.month} style={s.monthGroup}>
                  {/* Month header (collapsible) */}
                  <TouchableOpacity
                    style={s.monthGroupHeader}
                    onPress={() => toggleMonth(group.month)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.monthGroupLabel}>{group.month}</Text>
                    <View style={s.monthGroupRight}>
                      <Text style={s.monthGroupCount}>{group.items.length} entries</Text>
                      <Ionicons
                        name={collapsed ? 'chevron-down' : 'chevron-up'}
                        size={14} color={COLORS.textSecondary}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Rows */}
                  {!collapsed && group.items.map((txn, idx) => (
                    <TouchableOpacity
                      key={txn.id}
                      style={[s.txnRow, idx < group.items.length - 1 && s.txnBorder]}
                      activeOpacity={0.7}
                      onPress={() => router.push(`/document/${txn.voucher_guid}` as any)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.txnParty} numberOfLines={1}>
                          {txn.party_ledger_name || txn.tax_ledger_name || '-'}
                        </Text>
                        <Text style={s.txnMeta}>
                          {txn.voucher_number ? `${txn.voucher_number} · ` : ''}
                          {fmtDate(txn.voucher_date)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <Text style={s.txnAmt}>{fmt(txn.tax_amount)}</Text>
                        {txn.transaction_nature && (
                          <Text style={s.txnNature}>{txn.transaction_nature}</Text>
                        )}
                        <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
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

  fyStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 7, backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  fyStripTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.brandPrimary },

  tabBarWrapper: {
    height: 52, backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, overflow: 'hidden',
  },
  tabBarContent: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 9, gap: 8,
  },
  tabPill: {
    height: 34, paddingHorizontal: 14, borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.pageBg, justifyContent: 'center',
    alignItems: 'center', flexShrink: 0, flexDirection: 'row', gap: 6,
  },
  tabPillActive:    { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.cardBg },
  tabTxt:           { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabTxtActive:     { color: COLORS.brandPrimary, fontWeight: '700' },
  tabBadge: {
    backgroundColor: COLORS.borderDefault, borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  tabBadgeActive:   { backgroundColor: COLORS.brandPrimary + '22' },
  tabBadgeTxt:      { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  tabBadgeTxtActive:{ color: COLORS.brandPrimary },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  centered: { alignItems: 'center', paddingVertical: 24 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF5F5', borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: '#FED7D7',
    padding: SPACING.sm, marginBottom: SPACING.sm,
  },
  errorTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: '#C53030' },
  retryTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary },

  statsCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    marginBottom: SPACING.sm, overflow: 'hidden',
  },
  statsRow:  { flexDirection: 'row' },
  statCell:  { flex: 1, paddingHorizontal: SPACING.md, paddingVertical: 16 },
  statDivV:  { width: 1, backgroundColor: COLORS.borderDefault },
  statDivH:  { height: 1, backgroundColor: COLORS.borderDefault },
  statLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500', marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },

  emptyCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    alignItems: 'center', padding: 32, gap: 8, marginBottom: SPACING.sm,
  },
  emptyTitle:    { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  emptySubtitle: { fontSize: 12, color: COLORS.textTertiary, textAlign: 'center' },

  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  cardCount: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },

  challansUnavailable: {
    fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary,
    fontStyle: 'italic', paddingVertical: 8,
  },
  challanRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 8,
  },
  challanBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  challanRank:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textTertiary, width: 18 },
  challanId:     { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  challanMeta:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  challanAmt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  challanLate:   { fontSize: TYPOGRAPHY.xs, color: '#E53E3E', marginTop: 2 },

  emptyInline:    { paddingVertical: 16, alignItems: 'center' },
  emptyInlineTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, textAlign: 'center' },

  // ── Month groups ─────────────────────────────────────────────────────────────
  monthGroup: {
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault, marginTop: 4,
  },
  monthGroupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10,
  },
  monthGroupLabel: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary,
  },
  monthGroupRight: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  monthGroupCount: {
    fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary,
  },

  txnRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 8,
  },
  txnBorder:  { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  txnParty:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  txnMeta:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  txnAmt:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  txnNature:  { fontSize: 10, color: COLORS.textTertiary, marginTop: 2 },


});
