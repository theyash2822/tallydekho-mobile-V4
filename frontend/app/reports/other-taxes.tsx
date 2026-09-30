import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { openVoucherPreview } from '../../src/utils/openVoucherPreview';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n';
import {
  getOtherTaxesSummary,
  getOtherTaxesTransactions,
  getOtherTaxesLateChallans,
} from '../../src/services/api';

// ── Tab Config ───────────────────────────────────────────────────────────────
const TABS = [
  { labelKey: 'screens.reportsOtherTaxes.tabTds', taxType: 'TDS' },
  { labelKey: 'screens.reportsOtherTaxes.tabTcs', taxType: 'TCS' },
  { labelKey: 'screens.reportsOtherTaxes.tabVat', taxType: 'VAT' },
  { labelKey: 'screens.reportsOtherTaxes.tabCess', taxType: 'CESS' },
  { labelKey: 'screens.reportsOtherTaxes.tabExciseDuty', taxType: 'EXCISE_DUTY' },
  { labelKey: 'screens.reportsOtherTaxes.tabServiceTax', taxType: 'SERVICE_TAX' },
  { labelKey: 'screens.reportsOtherTaxes.tabImportDuty', taxType: 'IMPORT_DUTY' },
  { labelKey: 'screens.reportsOtherTaxes.tabExportDuty', taxType: 'EXPORT_DUTY' },
  { labelKey: 'screens.reportsOtherTaxes.tabWht', taxType: 'WITHHOLDING_TAX' },
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
  taxable_amount?: number | null;
  transaction_nature: string | null;
  financial_year?: string | null;
}

// ── Nature badge config ──────────────────────────────────────────────────────────────────
const NATURE_CFG: Record<string, { bg: string; text: string; icon: string; labelKey?: string; label?: string }> = {
  input:      { bg: '#F0FBF4', text: '#2D7D46', icon: 'arrow-down-circle-outline', labelKey: 'screens.reportsOtherTaxes.natureInput' },
  output:     { bg: '#FFF7ED', text: '#D97706', icon: 'arrow-up-circle-outline',   labelKey: 'screens.reportsOtherTaxes.natureOutput' },
  settlement: { bg: '#EFF6FF', text: '#1D4ED8', icon: 'checkmark-circle-outline',  labelKey: 'screens.reportsOtherTaxes.natureSettlement' },
  adjustment: { bg: '#F5F3FF', text: '#7C3AED', icon: 'swap-horizontal-outline',   labelKey: 'screens.reportsOtherTaxes.natureAdjustment' },
};
const getNatureCfg = (n: string | null) =>
  NATURE_CFG[(n || 'other').toLowerCase()] ??
  { bg: '#F4F4F5', text: '#71717A', icon: 'ellipse-outline', labelKey: n ? undefined : 'screens.reportsOtherTaxes.natureOther', label: n || undefined };

// ── Helpers ──────────────────────────────────────────────────────────────────
const UNDATED_KEY = 'Undated Entries';
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
      key = UNDATED_KEY;
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(txn);
  }
  return Array.from(map.entries()).map(([month, items]) => ({ month, items }));
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function OtherTaxesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { company: selectedCompany, selectedFY } = useAuth();

  const [activeTab, setActiveTab] = useState<TabItem>(TABS[0]);

  // Select mode
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  const clearSelect = () => setSelected(new Set());

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
  const fetchSummary = useCallback(() => {
    if (!companyGuid) return;
    getOtherTaxesSummary(companyGuid, fyParam ? { fy: fyParam } : {})
      .then((res) => {
        setSummary(res?.data ?? []);
      })
      .catch((e: any) => {
        setSummaryError(e?.message ?? i18n.t('screens.reportsOtherTaxes.loadSummaryFailed'));
      })
      .finally(() => {
        setSummaryLoading(false);
      });
  }, [companyGuid, fyParam]);

  const loadSummary = useCallback(() => {
    if (!companyGuid) return;
    setSummaryLoading(true);
    setSummaryError(null);
    fetchSummary();
  }, [companyGuid, fetchSummary]);

  // ── Load Transactions ───────────────────────────────────────────────────────
  const fetchTxns = useCallback((tab: TabItem) => {
    if (!companyGuid) return;
    const params: any = {
      taxType: tab.taxType,
      limit:   500,
      page:    1,
      ...(fyParam ? { fy: fyParam } : {}),
    };
    getOtherTaxesTransactions(companyGuid, params)
      .then((res) => {
        const rows: TaxTxn[] = res?.data ?? [];
        setTxns(rows);
        setTxnsTotal(res?.meta?.total ?? rows.length);
      })
      .catch((e: any) => {
        setTxnsError(e?.message ?? i18n.t('screens.reportsOtherTaxes.loadTxnsFailed'));
      })
      .finally(() => {
        setTxnsLoading(false);
      });
  }, [companyGuid, fyParam]);

  const loadTxns = useCallback((tab: TabItem) => {
    if (!companyGuid) return;
    setTxnsLoading(true);
    setTxnsError(null);
    fetchTxns(tab);
  }, [companyGuid, fetchTxns]);

  // ── Load Late Challans ──────────────────────────────────────────────────────
  const fetchChallans = useCallback((tab: TabItem) => {
    if (!companyGuid) return;
    const params: any = { taxType: tab.taxType, ...(fyParam ? { fy: fyParam } : {}) };
    getOtherTaxesLateChallans(companyGuid, params)
      .then((res) => {
        setChallans(res?.data ?? []);
        setHasChallans(res?.has_challan_data ?? false);
      })
      .catch(() => {
        setChallans([]); setHasChallans(false);
      })
      .finally(() => {
        setChallansLoading(false);
      });
  }, [companyGuid, fyParam]);

  // ── Initial + FY change ─────────────────────────────────────────────────────
  const [prevSummaryDeps, setPrevSummaryDeps] = useState<unknown[] | null>(null);
  if (prevSummaryDeps === null || prevSummaryDeps[0] !== companyGuid || prevSummaryDeps[1] !== fyParam) {
    setPrevSummaryDeps([companyGuid, fyParam]);
    if (companyGuid) {
      setSummaryLoading(true);
      setSummaryError(null);
    }
  }

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // ── Tab change → reload txns + challans ────────────────────────────────────
  const tabDeps = [activeTab, companyGuid, fyParam];
  const [prevTabDeps, setPrevTabDeps] = useState<unknown[] | null>(null);
  if (prevTabDeps === null || tabDeps.some((d, i) => d !== prevTabDeps[i])) {
    setPrevTabDeps(tabDeps);
    setTxns([]);
    setCollapsedMonths(new Set());
    if (companyGuid) {
      setTxnsLoading(true);
      setTxnsError(null);
      setChallansLoading(true);
    }
  }

  useEffect(() => {
    fetchTxns(activeTab);
    fetchChallans(activeTab);
  }, [activeTab, fetchTxns, fetchChallans]);

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
  const activeLabel = t(activeTab.labelKey);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('reports.otherTaxes')}</Text>
        <View style={s.iconBtn} />
      </View>

      {/* FY Strip */}
      {selectedFY && (
        <View style={s.fyStrip}>
          <Ionicons name="calendar-outline" size={13} color={COLORS.brandPrimary} />
          <Text style={s.fyStripTxt}>{selectedFY.label ?? t('screens.reportsOtherTaxes.currentFy')}</Text>
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
                <Text style={[s.tabTxt, isActive && s.tabTxtActive]}>{t(tab.labelKey)}</Text>
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
              <Text style={s.retryTxt}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats Card (always FY-level) */}
        {!summaryLoading && !summaryError && (
          activeSummary ? (
            <View style={s.statsCard}>
              <View style={s.statsRow}>
                <View style={s.statCell}>
                  <Text style={s.statLabel}>{t('screens.reportsOtherTaxes.totalTaxAmount')}</Text>
                  <Text style={s.statValue}>{fmt(activeSummary.totalTaxAmount)}</Text>
                </View>
                <View style={s.statDivV} />
                <View style={s.statCell}>
                  <Text style={s.statLabel}>{t('nav.vouchers')}</Text>
                  <Text style={s.statValue}>{activeSummary.voucherCount}</Text>
                </View>
              </View>
              <View style={s.statDivH} />
              <View style={s.statsRow}>
                <View style={s.statCell}>
                  <Text style={s.statLabel}>{t('screens.reportsOtherTaxes.lastTransaction')}</Text>
                  <Text style={s.statValue}>{fmtDate(activeSummary.lastTransactionDate)}</Text>
                </View>
                <View style={s.statDivV} />
                <View style={s.statCell}>
                  <Text style={s.statLabel}>{t('screens.reportsOtherTaxes.taxType')}</Text>
                  <Text style={s.statValue}>{activeLabel}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={s.emptyCard}>
              <Ionicons name="receipt-outline" size={40} color={COLORS.textTertiary} />
              <Text style={s.emptyTitle}>{t('screens.reportsOtherTaxes.noDataTitle', { tax: activeLabel })}</Text>
              <Text style={s.emptySubtitle}>
                {t('screens.reportsOtherTaxes.noDataSub', { tax: activeLabel })}
              </Text>
            </View>
          )
        )}

        {/* Late Challans */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('screens.reportsOtherTaxes.lateChallans')}</Text>
          {challansLoading ? (
            <ActivityIndicator size="small" color={COLORS.brandPrimary} style={{ marginVertical: 12 }} />
          ) : !hasChallans ? (
            <Text style={s.challansUnavailable}>
              {t('screens.reportsOtherTaxes.challansUnavailable')}
            </Text>
          ) : (
            challans.map((item, idx) => (
              <View key={idx} style={[s.challanRow, idx < challans.length - 1 && s.challanBorder]}>
                <Text style={s.challanRank}>{idx + 1}.</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.challanId}>{item.return_period ?? item.challan_no ?? '-'}</Text>
                  <Text style={s.challanMeta}>{t('screens.reportsOtherTaxes.challanMeta', { taxType: item.tax_type, date: fmtDate(item.due_date) })}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.challanAmt}>{fmt(item.tax_amount)}</Text>
                  <Text style={s.challanLate}>{t('screens.reportsOtherTaxes.daysLate', { days: item.late_days ?? '-' })}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Transactions section — tiles directly on pageBg */}
        {(txnsTotal > 0 || txnsLoading) && (
          <View style={s.txnSectionHeader}>
            <Text style={s.txnSectionTitle}>{t('screens.reportsOtherTaxes.txnsTitle', { tax: activeLabel })}</Text>
            {txnsTotal > 0 && <Text style={s.txnSectionCount}>{t('screens.reportsOtherTaxes.records', { count: txnsTotal })}</Text>}
          </View>
        )}

        {txnsLoading ? (
          <ActivityIndicator size="small" color={COLORS.brandPrimary} style={{ marginVertical: 16 }} />
        ) : txnsError ? (
          <View style={[s.errorBanner, { marginHorizontal: SPACING.md }]}>
            <Ionicons name="alert-circle-outline" size={14} color={'#E74C3C'} />
            <Text style={s.errorTxt}>{txnsError}</Text>
            <TouchableOpacity onPress={() => loadTxns(activeTab)}>
              <Text style={s.retryTxt}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : txns.length === 0 ? (
          <View style={s.emptyInline}>
            <Text style={s.emptyInlineTxt}>{t('screens.reportsOtherTaxes.noDataInline', { tax: activeLabel })}</Text>
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
                    <Text style={s.monthGroupLabel}>{group.month === UNDATED_KEY ? t('screens.reportsOtherTaxes.undated') : group.month}</Text>
                    <View style={s.monthGroupRight}>
                      <Text style={s.monthGroupCount}>{t('screens.reportsOtherTaxes.entries', { count: group.items.length })}</Text>
                      <Ionicons
                        name={collapsed ? 'chevron-down' : 'chevron-up'}
                        size={14} color={COLORS.textSecondary}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Tile cards */}
                  {!collapsed && group.items.map((txn) => {
                    const nat   = getNatureCfg(txn.transaction_nature);
                    const isSel = selected.has(String(txn.id));
                    const base  = parseFloat(String(txn.taxable_amount ?? 0));
                    return (
                      <TouchableOpacity
                        key={txn.id}
                        style={[s.txnCard, isSel && s.txnCardSelected]}
                        activeOpacity={0.8}
                        onPress={() => {
                          if (selected.size > 0) { toggleSelect(String(txn.id)); }
                          else { openVoucherPreview(router, { guid: txn.voucher_guid }); }
                        }}
                        onLongPress={() => toggleSelect(String(txn.id))}
                        delayLongPress={500}
                      >
                        {/* Top row: voucher# • type */}
                        <View style={s.txnCardTop}>
                          <Text style={s.txnCardRef}>
                            {txn.voucher_number || '—'}
                          </Text>
                          <Text style={s.txnCardSep}> • </Text>
                          <Text style={s.txnCardType}>{txn.voucher_type || '—'}</Text>
                        </View>

                        {/* Nature badge */}
                        <View style={[s.natureBadge, { backgroundColor: nat.bg }]}>
                          <Ionicons name={nat.icon as any} size={11} color={nat.text} />
                          <Text style={[s.natureBadgeTxt, { color: nat.text }]}>{nat.labelKey ? t(nat.labelKey) : nat.label}</Text>
                        </View>

                        {/* Body: icon + party/ledger/date + amount */}
                        <View style={s.txnCardBody}>
                          <View style={[s.txnCardIcon, { backgroundColor: nat.bg }]}>
                            <Ionicons name={nat.icon as any} size={20} color={nat.text} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.txnCardParty} numberOfLines={1}>
                              {txn.party_ledger_name || '—'}
                            </Text>
                            <Text style={s.txnCardLedger} numberOfLines={1}>
                              {txn.tax_ledger_name}
                            </Text>
                            <Text style={s.txnCardDate}>{fmtDate(txn.voucher_date)}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.txnCardAmt}>{fmt(txn.tax_amount)}</Text>
                            {base > 0 && (
                              <Text style={s.txnCardBase}>{t('screens.reportsOtherTaxes.base', { amount: fmt(base) })}</Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })
          )}

        <View style={{ height: selected.size > 0 ? 90 : 32 }} />
      </ScrollView>

      {/* Select / Export bar */}
      {selected.size > 0 && (
        <View style={s.selectBar}>
          <View style={s.selectLeft}>
            <Text style={s.selectCount}>{t('common.selected', { count: selected.size })}</Text>
            <TouchableOpacity onPress={clearSelect} hitSlop={{top:8,bottom:8,left:8,right:8}} activeOpacity={0.7}>
              <Text style={s.selectCancelTxt}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={s.selectExportBtn}
            activeOpacity={0.85}
            onPress={() => {
              const lines = txns
                .filter(t => selected.has(String(t.id)))
                .map(t => `${t.voucher_number || '-'}  ${t.party_ledger_name || '-'}  ${fmt(t.tax_amount)}  ${t.transaction_nature || '-'}`);
              const { Share } = require('react-native');
              Share.share({
                message: `TallyDekho — ${t('screens.reportsOtherTaxes.txnsTitle', { tax: activeLabel })}\n${lines.join('\n')}`,
                title: t('screens.reportsOtherTaxes.exportTitle', { tax: activeLabel }),
              }).catch(() => {});
              clearSelect();
            }}
          >
            <Ionicons name="share-outline" size={16} color={COLORS.white} />
            <Text style={s.selectExportTxt}>{t('screens.reportsOtherTaxes.export')}</Text>
          </TouchableOpacity>
        </View>
      )}
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
  scrollContent: { paddingTop: SPACING.md },

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
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden',
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
    alignItems: 'center', padding: 32, gap: 8,
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
  },
  emptyTitle:    { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  emptySubtitle: { fontSize: 12, color: COLORS.textTertiary, textAlign: 'center' },

  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
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

  txnSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: 6, paddingTop: 2,
  },
  txnSectionTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  txnSectionCount: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },

  // ── Tile cards ────────────────────────────────────────────────────────────────────
  txnCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, marginHorizontal: SPACING.md, marginBottom: 8, gap: 8,
  },
  txnCardSelected: { borderColor: COLORS.brandPrimary, borderWidth: 2, backgroundColor: COLORS.brandPrimary + '06' },
  txnCardTop:  { flexDirection: 'row', alignItems: 'center' },
  txnCardRef:  { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  txnCardSep:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  txnCardType: { fontSize: TYPOGRAPHY.xs, fontWeight: '500', color: COLORS.textSecondary },
  natureBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  natureBadgeTxt: { fontSize: 10, fontWeight: '700' },
  txnCardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  txnCardIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  txnCardParty:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  txnCardLedger: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  txnCardDate:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  txnCardAmt:    { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  txnCardBase:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },

  // ── Select / Export bar ────────────────────────────────────────────────────────────────────
  selectBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14, paddingBottom: 20,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 8,
  },
  selectLeft:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  selectCount:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  selectCancelTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  selectExportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: RADIUS.md,
  },
  selectExportTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },


});
