import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { safePush } from '../../src/utils/safeNavigation';
import { openVoucherPreview } from '../../src/utils/openVoucherPreview';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { parseISODate } from '../../src/utils/dateRange';
import { useAuth } from '../../src/context/AuthContext';
import { fyInfoToParam } from '../../src/context/AuthContext';
import { getGSTDetail, getGSTSummary } from '../../src/services/api';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useSettings } from '../../src/context/SettingsContext';
import { LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { shareSummaryTablePdf, companyFromAuth } from '../../src/utils/multiShare';

// ── GSTR Tabs ─────────────────────────────────────────────────────────────────
const GSTR_TABS = [
  'GSTR-1', 'GSTR-2A', 'GSTR-2B', 'GSTR-3B',
  'GSTR-4', 'GSTR-5', 'GSTR-5A', 'GSTR-6',
  'GSTR-7', 'GSTR-8', 'GSTR-9', 'GSTR-10', 'GSTR-11',
];

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function monthLabel(d: Date): string {
  return `${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

interface Invoice {
  id: string;
  guid?: string;
  invoiceNo: string;
  type: string;
  party: string;
  date: string;
  dateObj: Date;
  amount: string;
  matched: boolean;
  gstr: string[];
  gstSection?: string;
  gstr3bSection?: string;
  partyGstin?: string;
  isNilRated?: boolean;
  isExempt?: boolean;
  partyRegistrationType?: string;
  itcEligibility?: string;
  gstLedgerNames?: string;
  classificationReason?: string;
}

function mapVoucher(r: any, idx: number, tab: string, fmt: (n: number) => string): Invoice {
  return {
    id: r.guid || r.id ? `${r.guid || r.id}` : `row-${tab}-${idx}`,
    guid: r.guid || '',
    invoiceNo: r.voucher_number || '',
    type: r.voucher_type || 'Sales',
    party: r.party_name || '',
    date: r.date || '',
    dateObj: new Date(r.date || Date.now()),
    amount: fmt(Math.abs(+r.amount || 0)),
    matched: !!(r.irn),
    gstr: [tab],
    gstSection: r.gst_section || undefined,
    gstr3bSection: r.gstr3b_section || undefined,
    partyGstin: r.party_gstin || undefined,
    isNilRated: !!(r.is_nil_rated),
    isExempt: !!(r.is_exempt),
    partyRegistrationType: r.party_registration_type || undefined,
    itcEligibility: r.itc_eligibility || undefined,
    gstLedgerNames: r.gst_ledger_names || undefined,
    classificationReason: r.classification_reason || undefined,
  };
}

function getSectionDotStyle(section: string) {
  if (section === 'B2B' || section === 'B2B Interstate') return { backgroundColor: '#6366F1' };
  if (section === 'B2C') return { backgroundColor: '#22C55E' };
  if (section === 'Export') return { backgroundColor: '#F97316' };
  if (section === 'SEZ') return { backgroundColor: '#0EA5E9' };
  if (section === 'Nil/Exempt') return { backgroundColor: '#94A3B8' };
  return { backgroundColor: '#D1D5DB' };
}

function getSectionBadgeStyle(section: string) {
  if (section === 'B2B' || section === 'B2B Interstate') return { backgroundColor: '#EEF2FF' };
  if (section === 'B2C') return { backgroundColor: '#F0FDF4' };
  if (section === 'Export') return { backgroundColor: '#FFF7ED' };
  if (section === 'SEZ') return { backgroundColor: '#F0F9FF' };
  if (section === 'RCM') return { backgroundColor: '#FEF2F2' };
  if (section?.startsWith('ITC')) return { backgroundColor: '#F5F3FF' };
  return { backgroundColor: '#F3F4F6' };
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function GSTScreen() {
  const { t } = useTranslation();
  const { formatAmount, formatDate } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const companyGuid = company?.guid;

  const fyFrom = selectedFY?.startDate ?? '';
  const fyTo = selectedFY?.endDate ?? '';

  const [isGSTApplicable, setIsGSTApplicable] = useState(true);
  const [gstNotApplicableMsg, setGstNotApplicableMsg] = useState('');
  const [liveInvoices, setLiveInvoices] = useState<Invoice[]>([]);
  const [apiGroups, setApiGroups] = useState<{ month: string; invoices: Invoice[] }[]>([]);
  const [gstr3bSummary, setGstr3bSummary] = useState<any>(null);
  const [gstSummaryData, setGstSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [activeTab,      setActiveTab]      = useState('GSTR-1');
  const [fromDate,       setFromDate]       = useState(fyFrom);
  const [toDate,         setToDate]         = useState(fyTo);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selected,       setSelected]       = useState<string[]>([]);
  const [isSharing,      setIsSharing]      = useState(false);

  const [prevFy, setPrevFy] = useState({ fyFrom, fyTo });
  if (prevFy.fyFrom !== fyFrom || prevFy.fyTo !== fyTo) {
    setPrevFy({ fyFrom, fyTo });
    if (fyFrom && fyTo) {
      setFromDate(fyFrom);
      setToDate(fyTo);
    }
  }

  // ── Collapsible months ────────────────────────────────────────────────────
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  const toggleMonth = useCallback((month: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }, []);

  // ── Collapsible GSTR-1 sections ───────────────────────────────────────────
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = useCallback((sec: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev); next.has(sec) ? next.delete(sec) : next.add(sec); return next;
    });
  }, []);

  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // ── Fetch GST summary card data ───────────────────────────────────────────
  useEffect(() => {
    if (!companyGuid) return;
    let cancelled = false;
    const fyParam = fyInfoToParam(selectedFY);
    getGSTSummary(companyGuid, fyParam ? { fy: fyParam } : {})
      .then((res: any) => {
        if (cancelled) return;
        if (res?.summary) setGstSummaryData(res.summary);
        setSummaryError(null);
      })
      .catch((err: any) => { if (!cancelled) setSummaryError(err?.message || t('screens.reportsGst.loadFailed')); });
    return () => { cancelled = true; };
  }, [companyGuid, selectedFY, reloadKey]);

  // ── Fetch on tab/FY change ────────────────────────────────────────────────
  const [detailKey, setDetailKey] = useState<{
    companyGuid?: string; activeTab: string; selectedFY: typeof selectedFY; reloadKey: number;
  } | null>(null);
  if (
    !detailKey || detailKey.companyGuid !== companyGuid || detailKey.activeTab !== activeTab
    || detailKey.selectedFY !== selectedFY || detailKey.reloadKey !== reloadKey
  ) {
    setDetailKey({ companyGuid, activeTab, selectedFY, reloadKey });
    if (companyGuid) {
      setLiveInvoices([]);
      setApiGroups([]);
      setGstr3bSummary(null);
      setLoading(true);
      setDetailError(null);
      setCollapsedMonths(new Set());
    }
  }

  useEffect(() => {
    if (!companyGuid) return;
    const fyParam = fyInfoToParam(selectedFY);

    getGSTDetail(companyGuid, {
      type: activeTab,
      ...(fyParam ? { fy: fyParam } : {}),
    }).then((res: any) => {
      if (res?.meta?.country_applicable === false) {
        setIsGSTApplicable(false);
        setGstNotApplicableMsg(res.meta.message || t('screens.reportsGst.notApplicableMsg'));
        setLoading(false);
        return;
      }
      // GSTR-3B: set summary card data (shown above the list)
      if (res?.meta?.is_summary && res?.summary) {
        setGstr3bSummary(res.summary);
      }
      // ALL tabs: populate voucher list from data array
      const rows: any[] = res?.data ?? [];
      setLiveInvoices(rows.map((r: any, idx: number) => mapVoucher(r, idx, activeTab, formatAmount)));
      // Use API pre-grouped data if available
      if (res?.groups?.length > 0) {
        const mapped = (res.groups as any[]).map((g: any) => ({
          month: g.month,
          invoices: (g.vouchers as any[]).map((r: any, idx: number) =>
            mapVoucher(r, idx, activeTab, formatAmount)
          ),
        }));
        setApiGroups(mapped);
      } else {
        setApiGroups([]);
      }
      setLoading(false);
    }).catch((err: any) => {
      setDetailError(err?.message || t('screens.reportsGst.loadFailed'));
      setLoading(false);
    });
  }, [companyGuid, activeTab, selectedFY, reloadKey]);

  const isDateActive = !!(fromDate && toDate) && (fromDate !== fyFrom || toDate !== fyTo);

  // ── Filter by date range ──────────────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    return liveInvoices.filter((inv) => {
      if (!isDateActive) return true;
      const from = parseISODate(fromDate);
      const to   = parseISODate(toDate);
      if (from && to) {
        to.setHours(23, 59, 59, 999);
        if (!(inv.dateObj >= from && inv.dateObj <= to)) return false;
      }
      return true;
    });
  }, [liveInvoices, isDateActive, fromDate, toDate]);

  // ── Group by month: use API groups if available, else group client-side ──
  const groupedInvoices = useMemo(() => {
    // All tabs including GSTR-1 now use month-based collapsible grouping
    // Use API groups if available (already grouped by backend)
    if (apiGroups.length > 0) return apiGroups;
    // Fallback: group on client from filteredInvoices
    const groups: { month: string; invoices: Invoice[] }[] = [];
    const monthMap = new Map<string, Invoice[]>();
    const sorted = [...filteredInvoices].sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    for (const inv of sorted) {
      const m = monthLabel(inv.dateObj);
      if (!monthMap.has(m)) {
        monthMap.set(m, []);
        groups.push({ month: m, invoices: monthMap.get(m)! });
      }
      monthMap.get(m)!.push(inv);
    }
    return groups;
  }, [activeTab, filteredInvoices, apiGroups]);

  // ── GSTR-1 section sub-groups ────────────────────────────────────────────────
  const gstr1Sections = useMemo(() => {
    if (activeTab !== 'GSTR-1') return null;
    const order = ['B2B', 'B2B Interstate', 'B2C', 'Export', 'SEZ', 'Nil/Exempt', 'Other'];
    const map = new Map<string, Invoice[]>();
    for (const inv of filteredInvoices) {
      const sec = inv.gstSection || 'Other';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(inv);
    }
    return order.filter(s => map.has(s)).map(s => ({ section: s, invoices: map.get(s)! }));
  }, [activeTab, filteredInvoices]);

  const unmatchedCount = gstSummaryData?.unmatchedCount ?? liveInvoices.filter(inv => !inv.matched).length;

  // ── Not applicable for country ────────────────────────────────────────────
  if (!isGSTApplicable) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('screens.reportsGst.gstReports')}</Text>
          <View style={{width:44}} />
        </View>
        <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:24}}>
          <Ionicons name="information-circle-outline" size={48} color={COLORS.textTertiary} />
          <Text style={{fontSize:16,fontWeight:'700',color:COLORS.textPrimary,marginTop:12,textAlign:'center'}}>{t('screens.reportsGst.notApplicable')}</Text>
          <Text style={{fontSize:14,color:COLORS.textSecondary,marginTop:8,textAlign:'center'}}>{gstNotApplicableMsg}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleShareSelected = async () => {
    if (selected.length === 0 || isSharing) return;
    const items = filteredInvoices.filter(inv => selected.includes(inv.id));
    setIsSharing(true);
    try {
      const metrics = [
        { label: t('screens.reportsGst.gstCollected'), value: gstSummaryData ? formatAmount(gstSummaryData.gstCollected) : '—' },
        { label: t('screens.reportsGst.itcBalance'), value: gstSummaryData ? formatAmount(gstSummaryData.itcBalance) : '—' },
        { label: t('screens.reportsGst.netPayable'), value: gstSummaryData ? formatAmount(gstSummaryData.netPayable) : '—' },
        { label: t('screens.reportsGst.tab'), value: activeTab },
      ];
      await shareSummaryTablePdf({
        company: companyFromAuth(company),
        title: t('screens.reportsGst.pdfTitle', { tab: activeTab }),
        period: fromDate && toDate ? `${formatDate(fromDate)} → ${formatDate(toDate)}` : undefined,
        metrics,
        columns: [t('pdf.invoice'), t('screens.reportsGst.colType'), t('voucher.party'), t('voucher.date'), t('voucher.amount'), t('screens.reportsGst.colSection')],
        rows: items.map(inv => [
          inv.invoiceNo,
          inv.type,
          inv.party,
          inv.date,
          inv.amount,
          inv.gstSection || inv.gstr3bSection || '',
        ]),
      }, { onBeforeShare: () => setIsSharing(false) });
      setSelected([]);
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || t('screens.reportsGst.shareFailed'));
    } finally {
      setIsSharing(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelected([]);
    setLoading(true);
    setCollapsedSections(new Set());
  };

  // ── Render individual invoice card ───────────────────────────────────────
  const renderInvoiceCard = (inv: Invoice) => {
    const isSelected = selected.includes(inv.id);
    const sectionToShow = activeTab === 'GSTR-3B' ? inv.gstr3bSection : inv.gstSection;
    return (
      <TouchableOpacity
        key={inv.id}
        style={[s.invoiceCard, isSelected && s.invoiceCardSelected]}
        onPress={() => {
          if (selected.length > 0) {
            toggleSelect(inv.id);
          } else {
            openVoucherPreview(router, { guid: inv.guid, docType: inv.type });
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
        {sectionToShow && (
          <View style={[s.sectionBadge, getSectionBadgeStyle(sectionToShow)]}>
            <Text style={s.sectionBadgeTxt}>{sectionToShow}</Text>
          </View>
        )}
        <View style={s.invBodyRow}>
          <View style={[s.statusIcon, { backgroundColor: inv.matched ? '#F0FBF4' : '#FEF2F2' }]}>
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
  };

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('reports.gst')}</Text>
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
          {fromDate && toDate ? `${formatDate(fromDate)}  →  ${formatDate(toDate)}` : t('screens.reportsGst.allDates')}
        </Text>
        {!isDateActive && <Ionicons name="chevron-down" size={11} color={COLORS.textTertiary} />}
        {isDateActive && (
          <TouchableOpacity onPress={() => { setFromDate(fyFrom); setToDate(fyTo); }} hitSlop={{top:8,bottom:8,left:8,right:8}}>
            <Ionicons name="close-circle" size={16} color={COLORS.brandPrimary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        {(detailError || summaryError) && (
          <ErrorBanner message={(detailError || summaryError) as string} onRetry={() => setReloadKey(k => k + 1)} />
        )}

        {/* ── Summary Card ─────────────────────────────────────────────── */}
        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>{t('screens.reportsGst.gstCollected')}</Text>
            <Text style={s.summaryValue}>{gstSummaryData ? formatAmount(gstSummaryData.gstCollected) : '—'}</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>{t('screens.reportsGst.itcBalance')}</Text>
            <Text style={s.summaryValue}>{gstSummaryData ? formatAmount(gstSummaryData.itcBalance) : '—'}</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>{t('screens.reportsGst.netPayable')}</Text>
            <Text style={s.summaryValue}>{gstSummaryData ? formatAmount(gstSummaryData.netPayable) : '—'}</Text>
          </View>
        </View>

        {/* ── Unmatched CTA ────────────────────────────────────────────── */}
        {unmatchedCount > 0 && (
          <TouchableOpacity
            style={s.unmatchedBtn}
            onPress={() => safePush(router, '/reports/unmatched-list' as any)}
            activeOpacity={0.85}
          >
            <Text style={s.unmatchedBtnTxt}>{t('screens.reportsGst.unmatchedInvoices', { count: unmatchedCount })}</Text>
          </TouchableOpacity>
        )}

        {/* ── GST Ledger Section ───────────────────────────────────────── */}
        <Text style={s.sectionLabel}>{t('screens.reportsGst.gstLedger')}</Text>

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


        {/* ── GSTR-2A/2B: Portal info banner ─────────────────────────── */}
        {(activeTab === 'GSTR-2A' || activeTab === 'GSTR-2B') && (
          <View style={s.portalInfoBanner}>
            <View style={s.portalInfoIconRow}>
              <Ionicons name="cloud-outline" size={18} color={COLORS.brandPrimary} />
              <Text style={s.portalInfoTitle}>{t('screens.reportsGst.portalTitle')}</Text>
            </View>
            <Text style={s.portalInfoTxt}>
              {t('screens.reportsGst.portalInfo')}
            </Text>
          </View>
        )}

        {/* ── GSTR-3B Summary Card (above voucher list) ────────────────── */}
        {gstr3bSummary && (
          <View style={s.gst3bCard}>
            <Text style={s.gst3bTitle}>{t('screens.reportsGst.gstr3bSummary')}</Text>
            {[
              { id: 'outward', label: t('screens.reportsGst.outwardSupply'), value: gstr3bSummary.outwardSupply,  color: COLORS.positive },
              { id: 'inward', label: t('screens.reportsGst.inwardSupply'),  value: gstr3bSummary.inwardSupply,   color: COLORS.textSecondary },
              { id: 'outputTax', label: t('screens.reportsGst.outputTax'),    value: gstr3bSummary.outputTax,      color: (COLORS as any).negative || '#E53935' },
              { id: 'itc', label: t('screens.reportsGst.inputTaxCredit'),     value: gstr3bSummary.inputTaxCredit, color: COLORS.positive },
              { id: 'netGst', label: t('screens.reportsGst.netGstPayable'),      value: gstr3bSummary.netTaxPayable,  color: (COLORS as any).negative || '#E53935' },
            ].map(row => (
              <View key={row.id} style={s.gst3bRow}>
                <Text style={s.gst3bLabel}>{row.label}</Text>
                <Text style={[s.gst3bValue, { color: row.color }]}>
                  ₹{row.value?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Shimmer skeleton while loading ──────────────────────────── */}
        {loading && (
          <View style={s.shimmerWrap}>
            {[...Array(6)].map((_, i) => <LedgerRowSkeleton key={`sk-${i}`} />)}
          </View>
        )}

        {/* ── No Vouchers empty state ───────────────────────────────────── */}
        {!loading && filteredInvoices.length === 0 && (
          <View style={s.emptyBox}>
            <Ionicons name="document-outline" size={48} color={COLORS.textTertiary} />
            <Text style={[s.emptyTxt, { fontWeight: '700', color: COLORS.textPrimary, marginTop: 4 }]}>
              {t('screens.reportsGst.noVouchers')}
            </Text>
            <Text style={[s.emptyTxt, { fontSize: 12, marginTop: 2 }]}>
              {t('screens.reportsGst.noTransactionsFor', { tab: activeTab })}
            </Text>
          </View>
        )}

        {/* ── All tabs: month-based collapsible grouping ── */}
        {!loading && groupedInvoices.length > 0 && (
          groupedInvoices.map(({ month, invoices: monthInvoices }) => {
            const isCollapsed = collapsedMonths.has(month);
            return (
              <View key={month}>
                <TouchableOpacity
                  style={s.monthHeader}
                  onPress={() => toggleMonth(month)}
                  activeOpacity={0.75}
                >
                  <Text style={s.monthHeaderTxt}>{month}</Text>
                  <View style={s.monthHeaderRight}>
                    <Text style={s.monthHeaderCount}>
                      {t(monthInvoices.length !== 1 ? 'screens.reportsGst.vouchersCount' : 'screens.reportsGst.voucherCount', { count: monthInvoices.length })}
                    </Text>
                    <Ionicons
                      name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                      size={15}
                      color={COLORS.textSecondary}
                    />
                  </View>
                </TouchableOpacity>
                {!isCollapsed && monthInvoices.map((inv) => renderInvoiceCard(inv))}
              </View>
            );
          })
        )}

        <View style={{ height: selected.length > 0 ? 90 : 40 }} />
      </ScrollView>

      {/* ── Share Bar ────────────────────────────────────────────────────── */}
      {selected.length > 0 && (
        <View style={[s.shareBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.shareLeft}>
            <Text style={s.shareCount}>{t('common.selected', { count: selected.length })}</Text>
            <TouchableOpacity onPress={() => setSelected([])} hitSlop={{top:8,bottom:8,left:8,right:8}} activeOpacity={0.7}>
              <Text style={s.shareCancelTxt}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[s.shareActionBtn, isSharing && { opacity: 0.6 }]}
            activeOpacity={0.85}
            onPress={handleShareSelected}
            disabled={isSharing}
          >
            {isSharing
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Ionicons name="share-outline" size={16} color={COLORS.white} />
            }
            <Text style={s.shareActionTxt}>{isSharing ? t('screens.reportsGst.preparing') : t('pdf.sharePdf')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Date Range Modal ─────────────────────────────────────────────── */}
      <DateRangePickerModal
        visible={showDatePicker}
        fromDate={fromDate || fyFrom}
        toDate={toDate || fyTo}
        minDate={fyFrom || undefined}
        maxDate={fyTo || undefined}
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

  // GSTR-3B summary card
  gst3bCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xs,
    marginBottom: SPACING.md,
  },
  gst3bTitle: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary,
    marginBottom: 8, letterSpacing: 0.3,
  },
  gst3bRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  gst3bLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, flex: 1 },
  gst3bValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },

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

  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 4 },
  emptyTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, fontWeight: '500', textAlign: 'center' },

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

  sectionBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 4, marginTop: 2,
  },
  sectionBadgeTxt: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  portalInfoBanner: {
    flexDirection: 'column', gap: 6,
    backgroundColor: '#EEF6FF',
    borderRadius: RADIUS.md, padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  portalInfoIconRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  portalInfoTitle: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary,
  },
  portalInfoTxt: {
    fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, lineHeight: 18,
  },
  portalInfoLink: {
    color: COLORS.textPrimary, fontWeight: '600',
  },
  sectionGroupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 4,
    marginTop: SPACING.md, marginBottom: 6,
    backgroundColor: COLORS.pageBg,
    borderBottomWidth: 2, borderBottomColor: COLORS.brandPrimary + '30',
  },
  sectionGroupLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionGroupTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  sectionDot: { width: 10, height: 10, borderRadius: 5 },

  shareBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    gap: 12,
  },
  shareLeft:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  shareCount:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  shareCancelTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textSecondary },
  shareActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: RADIUS.md,
  },
  shareActionTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
});
