import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal, { isoToDMY, dmyToISO } from '../../src/components/DateRangePickerModal';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { getKPIReceivables } from '../../src/services/api';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useTranslation } from 'react-i18next';

const { width: SW } = Dimensions.get('window');

function fmtDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function openCall(phone?: string) {
  const digits = String(phone || '').replace(/[^0-9+]/g, '');
  if (!digits) { Alert.alert('No phone', 'Phone number not available'); return; }
  Linking.openURL(`tel:${digits}`).catch(() => Alert.alert('Error', 'Could not open phone app'));
}

function openWhatsApp(phone?: string) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) { Alert.alert('No phone', 'Phone number not available'); return; }
  const num = digits.startsWith('91') && digits.length > 10 ? digits : `91${digits}`;
  Linking.openURL(`https://wa.me/${num}`).catch(() => Alert.alert('Error', 'Could not open WhatsApp'));
}

export default function ReceivablesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { company, selectedFY, lastSyncAt } = useAuth();
  const { formatAmountCompact, formatAmount } = useSettings();
  const companyGuid = company?.guid;

  const agingRef = useRef<FlatList>(null);
  const [agingIdx, setAgingIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'recent' | 'overdue'>('recent');
  const [showDatePick, setShowDatePick] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set());
  const [apiData, setApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const overdueOn = activeChips.has('overdue');
  const receiptsOn = activeChips.has('receipts');

  const load = useCallback(async () => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    try {
      const params: Record<string, string> = {};
      const fromIso = dateFrom ? dmyToISO(dateFrom) : '';
      const toIso = dateTo ? dmyToISO(dateTo) : '';
      if (fromIso) params.from = fromIso;
      if (toIso) params.to = toIso;
      if (overdueOn) params.overdue = '1';
      const res: any = await getKPIReceivables(companyGuid, params);
      setApiData(res?.data ?? res);
    } catch (err: any) {
      setApiError(err?.message || 'Failed to load receivables');
      setApiData(null);
    } finally {
      setIsLoading(false);
    }
  }, [companyGuid, dateFrom, dateTo, overdueOn, lastSyncAt]);

  useEffect(() => { load(); }, [load]);

  const agingCards = useMemo(() => {
    const total = Number(apiData?.total ?? apiData?.accountingBalance) || 0;
    const rows = Array.isArray(apiData?.aging) ? apiData.aging : [];
    const totalTrend = apiData?.trend_pct;
    const hasTotalTrend = totalTrend != null && Number.isFinite(Number(totalTrend));
    const cards = [
      {
        id: 'total',
        icon: 'documents-outline',
        label: 'Total Due',
        amount: formatAmountCompact(Math.round(total)),
        trend: hasTotalTrend ? `${Number(totalTrend) >= 0 ? '+' : ''}${Number(totalTrend)}%` : null,
        positive: hasTotalTrend ? Number(totalTrend) >= 0 : true,
      },
      ...rows.map((a: any) => {
        const trend = a.trend;
        const hasTrend = trend != null && Number.isFinite(Number(trend));
        return {
          id: a.bucket,
          icon: 'calendar-outline',
          label: a.label || a.bucket,
          amount: formatAmountCompact(Math.round(Number(a.amount) || 0)),
          trend: hasTrend ? `${Number(trend) >= 0 ? '+' : ''}${Number(trend)}%` : null,
          positive: hasTrend ? Number(trend) >= 0 : true,
        };
      }),
    ];
    return cards;
  }, [apiData, formatAmountCompact]);

  const bills = useMemo(() => {
    const rows = Array.isArray(apiData?.bills) ? apiData.bills : [];
    return rows.map((b: any, i: number) => ({
      id: `bill-${i}-${b.ref || 'x'}`,
      party: b.party,
      ref: b.ref,
      date: b.date || b.dueDate || b.billDate,
      amount: Math.abs(Number(b.amount) || 0),
      status: b.status,
      voucherGuid: b.voucherGuid || b.voucher_guid || null,
    }));
  }, [apiData]);

  const overdueParties = useMemo(() => {
    const rows = Array.isArray(apiData?.parties) ? apiData.parties : [];
    return rows
      .filter((p: any) => (Number(p.overdueOutstanding) || Number(p.days_overdue) || 0) > 0)
      .map((p: any, i: number) => ({
        id: `party-${i}-${p.name || 'x'}`,
        party: p.name,
        days: Number(p.days_overdue) || Number(p.oldestOverdueDays) || 0,
        amount: Math.abs(Number(p.overdueOutstanding) || Number(p.amount) || 0),
        phone: p.phone || '',
      }));
  }, [apiData]);

  const receipts = useMemo(() => {
    const rows = Array.isArray(apiData?.receipts) ? apiData.receipts : [];
    return rows.map((r: any, i: number) => ({
      id: `rc-${i}-${r.guid || r.voucher_number || 'x'}`,
      guid: r.guid,
      party: r.party_name,
      ref: r.voucher_number,
      date: r.date,
      amount: Math.abs(Number(r.amount) || 0),
      type: r.voucher_type,
    }));
  }, [apiData]);

  const toggleChip = (chip: 'overdue' | 'receipts') => {
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) {
        next.delete(chip);
        if (chip === 'overdue') setActiveTab('recent');
      } else {
        next.add(chip);
        if (chip === 'overdue') setActiveTab('overdue');
      }
      return next;
    });
  };

  const fmtRange = () => {
    const fmt = (s: string) => {
      const parts = s.split('/');
      if (parts.length < 3) return s;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${parseInt(parts[0], 10)} ${months[parseInt(parts[1], 10) - 1]}`;
    };
    if (!dateFrom && !dateTo) return 'All dates';
    if (dateFrom && !dateTo) return fmt(dateFrom);
    return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('kpi.receivables')}</Text>
        <View style={s.headerBtn} />
      </View>

      <View style={s.filterRow}>
        <TouchableOpacity style={s.dateChip} onPress={() => setShowDatePick(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          <Text style={s.dateChipTxt}>{fmtRange()}</Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.filterChip, overdueOn && s.filterChipActive]}
          onPress={() => toggleChip('overdue')}
          activeOpacity={0.7}
        >
          <Text style={[s.filterChipTxt, overdueOn && s.filterChipActiveTxt]}>{t('kpi.overdue')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.filterChip, receiptsOn && s.filterChipActive]}
          onPress={() => toggleChip('receipts')}
          activeOpacity={0.7}
        >
          <Text style={[s.filterChipTxt, receiptsOn && s.filterChipActiveTxt]}>{t('kpi.receiptsFilter')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {apiError && <ErrorBanner message={apiError} onRetry={load} />}

        {isLoading ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <CardSkeleton height={100} />
            {[0, 1, 2, 3].map((i) => <LedgerRowSkeleton key={i} />)}
          </View>
        ) : (
          <>
            <View style={s.agingSection}>
              <FlatList
                ref={agingRef}
                horizontal
                pagingEnabled
                nestedScrollEnabled
                decelerationRate="fast"
                disableIntervalMomentum
                data={agingCards}
                keyExtractor={(i) => i.id}
                showsHorizontalScrollIndicator={false}
                getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
                onScrollToIndexFailed={() => {}}
                onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                  setAgingIdx(Math.round(e.nativeEvent.contentOffset.x / SW));
                }}
                renderItem={({ item }) => (
                  <View style={s.agingItem}>
                    <View style={s.agingCard}>
                      <View style={s.agingIconBox}>
                        <Ionicons name={item.icon as any} size={24} color={COLORS.textSecondary} />
                      </View>
                      <View style={s.agingTextWrap}>
                        <Text style={s.agingLabel}>{item.label}</Text>
                        <Text style={s.agingAmount} numberOfLines={1} adjustsFontSizeToFit>{item.amount}</Text>
                      </View>
                      {item.trend != null ? (
                        <View style={[
                          s.trendBadge,
                          { backgroundColor: item.positive ? COLORS.positiveBg : COLORS.negativeBg },
                        ]}>
                          <Ionicons
                            name={item.positive ? 'trending-up' : 'trending-down'}
                            size={11}
                            color={item.positive ? COLORS.positive : COLORS.negative}
                          />
                          <Text style={[
                            s.trendTxt,
                            { color: item.positive ? COLORS.positive : COLORS.negative },
                          ]}>
                            {item.trend}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                )}
              />
              <View style={s.dots}>
                {agingCards.map((_, i) => (
                  <View key={i} style={[s.dot, i === agingIdx && s.dotActive]} />
                ))}
              </View>
            </View>

            <View style={s.tabCard}>
              {receiptsOn ? (
                <View style={s.listWrap}>
                  <Text style={s.sectionHint}>Live receipts (party settlements)</Text>
                  {receipts.length === 0 ? (
                    <View style={s.empty}><Text style={s.emptyTxt}>No receipts in range</Text></View>
                  ) : receipts.map((item: any, idx: number) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[s.listRow, idx < receipts.length - 1 && s.listRowBorder]}
                      activeOpacity={0.7}
                      onPress={() => item.guid && router.push(`/document/${item.guid}` as any)}
                    >
                      <View style={s.partyIconBox}>
                        <Ionicons name="arrow-down-outline" size={18} color={COLORS.positive} />
                      </View>
                      <View style={s.listInfo}>
                        <View style={s.listTopRow}>
                          <Text style={s.listParty} numberOfLines={1}>{item.party || '—'}</Text>
                          <Text style={s.listRef}>{` · ${item.ref || '—'}`}</Text>
                        </View>
                        <Text style={s.listDate}>{fmtDate(item.date)} · {item.type || 'Receipt'}</Text>
                      </View>
                      <Text style={[s.listAmount, { color: COLORS.positive }]}>
                        +{formatAmount(Math.round(item.amount))}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <>
                  <View style={s.tabRow}>
                    {(['recent', 'overdue'] as const).map((tab) => (
                      <TouchableOpacity
                        key={tab}
                        style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
                        onPress={() => setActiveTab(tab)}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.tabBtnTxt, activeTab === tab && s.tabBtnTxtActive]}>
                          {tab === 'recent' ? 'Recent Outstandings' : 'Overdue Parties'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {activeTab === 'recent' ? (
                    <View style={s.listWrap}>
                      {bills.length === 0 ? (
                        <View style={s.empty}><Text style={s.emptyTxt}>No outstanding bills</Text></View>
                      ) : bills.map((item: any, idx: number) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[s.listRow, idx < bills.length - 1 && s.listRowBorder]}
                          activeOpacity={item.voucherGuid ? 0.7 : 1}
                          disabled={!item.voucherGuid}
                          onPress={() => {
                            if (!item.voucherGuid) return;
                            router.push(`/document/${item.voucherGuid}?type=sales_invoice` as any);
                          }}
                        >
                          <View style={s.partyIconBox}>
                            <Ionicons name="document-text-outline" size={18} color={COLORS.textSecondary} />
                          </View>
                          <View style={s.listInfo}>
                            <View style={s.listTopRow}>
                              <Text style={s.listParty} numberOfLines={1}>{item.party}</Text>
                              <Text style={s.listRef}>{` · ${item.ref || '—'}`}</Text>
                            </View>
                            <Text style={s.listDate}>{fmtDate(item.date)}</Text>
                          </View>
                          <Text style={s.listAmount}>{formatAmount(Math.round(item.amount))}</Text>
                          {!!item.voucherGuid && (
                            <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={s.listWrap}>
                      {overdueParties.length === 0 ? (
                        <View style={s.empty}><Text style={s.emptyTxt}>No overdue parties</Text></View>
                      ) : overdueParties.map((item: any, idx: number) => (
                        <View
                          key={item.id}
                          style={[s.listRow, idx < overdueParties.length - 1 && s.listRowBorder]}
                        >
                          <View style={s.partyIconBox}>
                            <Ionicons name="business-outline" size={18} color={COLORS.textSecondary} />
                          </View>
                          <View style={s.listInfo}>
                            <Text style={s.listParty} numberOfLines={1}>{item.party}</Text>
                            <Text style={[s.listDate, { color: COLORS.negative }]}>{item.days}d overdue</Text>
                          </View>
                          <Text style={[s.listAmount, { color: COLORS.negative, marginRight: 6 }]}>
                            {formatAmount(Math.round(item.amount))}
                          </Text>
                          {!!item.phone && (
                            <View style={s.contactRow}>
                              <TouchableOpacity style={s.contactBtn} onPress={() => openCall(item.phone)} activeOpacity={0.7}>
                                <Ionicons name="call" size={14} color="#fff" />
                              </TouchableOpacity>
                              <TouchableOpacity style={[s.contactBtn, s.waBtn]} onPress={() => openWhatsApp(item.phone)} activeOpacity={0.7}>
                                <FontAwesome5 name="whatsapp" size={14} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <DateRangePickerModal
        visible={showDatePick}
        fromDate={dateFrom || isoToDMY(selectedFY?.startDate || '')}
        toDate={dateTo || isoToDMY(selectedFY?.endDate || '')}
        onApply={(f, t) => { setDateFrom(f); setDateTo(t); }}
        onClose={() => setShowDatePick(false)}
        minDate={selectedFY?.startDate}
        maxDate={selectedFY?.endDate}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  scroll: { paddingTop: SPACING.sm },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn: { width: 40 },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault },
  dateChipTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  filterChipTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  filterChipActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  filterChipActiveTxt: { color: '#FFFFFF' },

  agingSection: { marginTop: SPACING.md, marginBottom: SPACING.sm },
  agingItem: { width: SW },
  agingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, paddingHorizontal: 16, paddingVertical: 16, marginHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  agingIconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  agingTextWrap: { flex: 1, gap: 4 },
  agingLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  agingAmount: { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: COLORS.textPrimary },
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, flexShrink: 0 },
  trendTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  dotActive: { width: 16, height: 5, borderRadius: 3, backgroundColor: COLORS.textPrimary },

  tabCard: { marginHorizontal: SPACING.md, marginTop: SPACING.sm, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  tabRow: { flexDirection: 'row', backgroundColor: COLORS.pageBg, margin: 4, borderRadius: RADIUS.md, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.sm, alignItems: 'center' },
  tabBtnActive: { backgroundColor: COLORS.cardBg },
  tabBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  tabBtnTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  sectionHint: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 4, marginTop: 8 },

  listWrap: { paddingHorizontal: SPACING.md, paddingBottom: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 10 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  partyIconBox: { width: 42, height: 42, borderRadius: 8, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  listInfo: { flex: 1 },
  listTopRow: { flexDirection: 'row', alignItems: 'center' },
  listParty: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 1 },
  listRef: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  listDate: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  listAmount: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 0 },
  contactRow: { flexDirection: 'row', gap: 6 },
  contactBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.textPrimary, alignItems: 'center', justifyContent: 'center' },
  waBtn: { backgroundColor: '#25D366' },
  empty: { padding: 24, alignItems: 'center' },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
});
