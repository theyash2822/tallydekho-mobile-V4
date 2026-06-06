import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { useAuth } from '../../src/context/AuthContext';
import { getKPILoansODs } from '../../src/services/api';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { useSettings } from '../../src/context/SettingsContext';

const { width: SW } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────────────────────
const KPI_DATA = [
  { id: 'principal', icon: 'cash-outline',        label: 'Total Principal',    amount: '₹12.4 M', trend: '+8.5%',  positive: true  },
  { id: 'utilised',  icon: 'trending-up-outline', label: 'Utilised',           amount: '₹8.2 M',  trend: '+12.3%', positive: true  },
  { id: 'emi',       icon: 'calendar-outline',    label: 'EMI Due this Month', amount: '₹4.2 M',  trend: '+5.7%',  positive: true  },
  { id: 'avgrate',   icon: 'stats-chart-outline', label: 'Avg Rate',           amount: '₹185 K',  trend: '+2.1%',  positive: true  },
  { id: 'maturity',  icon: 'business-outline',    label: 'Next Maturity',      amount: '8.5%',    trend: '-0.2%',  positive: false },
];

const LOAN_CARDS = [
  {
    id: 'hdfc', type: 'loan', name: 'HDFC Term Loan', maturity: '14 Aug 26',
    gradient: ['#1B5E40', '#0D3B2E'] as const,
    stats: [
      { label: 'Principal', value: '₹5.30 M' },
      { label: 'Rate',      value: '8.5% fixed' },
      { label: 'EMIs',      value: '₹185 K (next 14 Jul)' },
    ],
  },
  {
    id: 'sbi', type: 'loan', name: 'SBI Home Loan', maturity: '15 Mar 28',
    gradient: ['#7A5C2E', '#4A3318'] as const,
    stats: [
      { label: 'Principal', value: '₹5.00 M' },
      { label: 'Rate',      value: '7.8% fixed' },
      { label: 'EMIs',      value: '₹165 K (next 25 Jul)' },
    ],
  },
  {
    id: 'axis', type: 'od', name: 'Axis OD', maturity: 'Revolving',
    gradient: ['#1B2E5E', '#0D1A40'] as const,
    stats: [
      { label: 'Limit',    value: '₹3.00 M' },
      { label: 'Utilised', value: '₹1.80 M' },
      { label: 'Interest', value: '₹42 K (next 10 Jul)' },
    ],
  },
];

const OUTSTANDING_DATA = [
  { id: 'jul', month: 'Jul 25', amount: '₹200 L', paidPct: 41, outstandingPct: 59, principal: '₹11,80,000', paid: '₹4,85,000', remaining: '₹6,95,000' },
  { id: 'jun', month: 'Jun 25', amount: '₹175 L', paidPct: 37, outstandingPct: 63, principal: '₹10,30,000', paid: '₹3,81,000', remaining: '₹6,49,000' },
  { id: 'may', month: 'May 25', amount: '₹220 L', paidPct: 34, outstandingPct: 66, principal: '₹12,96,000', paid: '₹4,41,000', remaining: '₹8,55,000' },
  { id: 'apr', month: 'Apr 25', amount: '₹160 L', paidPct: 30, outstandingPct: 70, principal: '₹9,42,000',  paid: '₹2,83,000', remaining: '₹6,59,000' },
  { id: 'mar', month: 'Mar 25', amount: '₹190 L', paidPct: 26, outstandingPct: 74, principal: '₹11,20,000', paid: '₹2,91,000', remaining: '₹8,29,000' },
  { id: 'feb', month: 'Feb 25', amount: '₹210 L', paidPct: 22, outstandingPct: 78, principal: '₹12,38,000', paid: '₹2,72,000', remaining: '₹9,66,000' },
];

const OD_DATA = [
  { id: 'd1', date: '3 Jun',  amount: '₹200 L', pct: 59, limit: '₹30,00,000', utilised: '₹17,70,000', available: '₹12,30,000' },
  { id: 'd2', date: '20 Jun', amount: '₹175 L', pct: 63, limit: '₹30,00,000', utilised: '₹18,90,000', available: '₹11,10,000' },
  { id: 'd3', date: '27 Jun', amount: '₹220 L', pct: 90, limit: '₹30,00,000', utilised: '₹27,00,000', available: '₹3,00,000'  },
  { id: 'd4', date: '04 Jul', amount: '₹160 L', pct: 80, limit: '₹30,00,000', utilised: '₹24,00,000', available: '₹6,00,000'  },
  { id: 'd5', date: '11 Jul', amount: '₹190 L', pct: 74, limit: '₹30,00,000', utilised: '₹22,20,000', available: '₹7,80,000'  },
];

const UPCOMING_EMIS = [
  { id: 'e1', loan: 'HDFC Term Loan', tag: 'Jul EMI #18', date: '10 Jul', amount: '₹185 K', overdue: false },
  { id: 'e2', loan: 'Axis OD',        tag: 'OD Interest', date: '10 Jul', amount: '₹42 K',  overdue: true  },
  { id: 'e3', loan: 'HDFC Term Loan', tag: 'Jul EMI #19', date: '14 Jul', amount: '₹185 K', overdue: false },
  { id: 'e4', loan: 'SBI Home Loan',  tag: 'Jul EMI #12', date: '25 Jul', amount: '₹165 K', overdue: false },
];

const OD_REPAYMENTS = [
  { id: 'r1', loan: 'Axis OD', tag: 'OD Interest', date: '10 Jul', amount: '₹42 K', overdue: true  },
  { id: 'r2', loan: 'Axis OD', tag: 'OD Interest', date: '10 Aug', amount: '₹42 K', overdue: false },
  { id: 'r3', loan: 'Axis OD', tag: 'OD Interest', date: '10 Sep', amount: '₹42 K', overdue: false },
];

// Calendar date → event maps
const EMI_DATES: Record<number, { loan: string; tag: string; amount: string }[]> = {
  10: [
    { loan: 'HDFC Term Loan', tag: 'Jul EMI #18', amount: '₹185 K' },
    { loan: 'Axis OD',        tag: 'OD Interest', amount: '₹42 K'  },
  ],
  14: [{ loan: 'HDFC Term Loan', tag: 'Jul EMI #19', amount: '₹185 K' }],
  25: [{ loan: 'SBI Home Loan',  tag: 'Jul EMI #12', amount: '₹165 K' }],
};

const OD_DATES: Record<number, { loan: string; tag: string; amount: string }[]> = {
  10: [{ loan: 'Axis OD', tag: 'OD Interest', amount: '₹42 K' }],
};

const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components: Bar & Dot Progress
// ─────────────────────────────────────────────────────────────────────────────
const BarProgress = ({ pct }: { pct: number }) => {
  const filled = Math.round(pct / 10);
  return (
    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end' }}>
      {Array(10).fill(0).map((_, i) => (
        <View key={i} style={{
          width: 5, height: 18, borderRadius: 2,
          backgroundColor: i < filled ? COLORS.textPrimary : COLORS.borderDefault,
        }} />
      ))}
    </View>
  );
};

const DotProgress = ({ pct }: { pct: number }) => {
  const filled = Math.round(pct / 10);
  return (
    <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
      {Array(10).fill(0).map((_, i) => (
        <View key={i} style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: i < filled ? COLORS.brandPrimary : COLORS.borderDefault,
        }} />
      ))}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Outstanding Detail Tooltip Modal
// ─────────────────────────────────────────────────────────────────────────────
type OutstandingRow = typeof OUTSTANDING_DATA[0];
type OdRow = typeof OD_DATA[0];

function OutstandingDetailModal({
  item,
  onClose,
}: {
  item: OutstandingRow | null;
  onClose: () => void;
}) {
  if (!item) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={dm.overlay} activeOpacity={1} onPress={onClose}>
        <View style={dm.card}>
          <View style={dm.cardHeader}>
            <Text style={dm.cardTitle}>{item.month} — Outstanding Detail</Text>
            <TouchableOpacity onPress={onClose} style={dm.closeBtn}>
              <Ionicons name="close" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={dm.row}>
            <Text style={dm.lbl}>Total Principal</Text>
            <Text style={dm.val}>{item.principal}</Text>
          </View>
          <View style={dm.divider} />
          <View style={dm.row}>
            <Text style={dm.lbl}>Amount Paid</Text>
            <Text style={[dm.val, { color: COLORS.positive }]}>{item.paid}</Text>
          </View>
          <View style={dm.divider} />
          <View style={dm.row}>
            <Text style={dm.lbl}>Outstanding Balance</Text>
            <Text style={[dm.val, { color: COLORS.negative }]}>{item.remaining}</Text>
          </View>
          <View style={dm.divider} />
          <View style={dm.row}>
            <Text style={dm.lbl}>% Outstanding</Text>
            <Text style={dm.val}>{item.outstandingPct}%</Text>
          </View>
          {/* Mini progress bar */}
          <View style={dm.barWrap}>
            <View style={[dm.barFill, { width: `${item.paidPct}%` as any }]} />
          </View>
          <View style={dm.barLabels}>
            <Text style={dm.barLblLeft}>Paid {item.paidPct}%</Text>
            <Text style={dm.barLblRight}>Remaining {item.outstandingPct}%</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OD Detail Tooltip Modal
// ─────────────────────────────────────────────────────────────────────────────
function OdDetailModal({
  item,
  onClose,
}: {
  item: OdRow | null;
  onClose: () => void;
}) {
  if (!item) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={dm.overlay} activeOpacity={1} onPress={onClose}>
        <View style={dm.card}>
          <View style={dm.cardHeader}>
            <Text style={dm.cardTitle}>{item.date} — OD Utilisation</Text>
            <TouchableOpacity onPress={onClose} style={dm.closeBtn}>
              <Ionicons name="close" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={dm.row}>
            <Text style={dm.lbl}>OD Limit</Text>
            <Text style={dm.val}>{item.limit}</Text>
          </View>
          <View style={dm.divider} />
          <View style={dm.row}>
            <Text style={dm.lbl}>Utilised</Text>
            <Text style={[dm.val, { color: COLORS.negative }]}>{item.utilised}</Text>
          </View>
          <View style={dm.divider} />
          <View style={dm.row}>
            <Text style={dm.lbl}>Available</Text>
            <Text style={[dm.val, { color: COLORS.positive }]}>{item.available}</Text>
          </View>
          <View style={dm.divider} />
          <View style={dm.row}>
            <Text style={dm.lbl}>% Utilised</Text>
            <Text style={[dm.val, item.pct >= 80 && { color: COLORS.negative }]}>{item.pct}%</Text>
          </View>
          {/* Dot indicator */}
          <View style={{ marginTop: 12 }}>
            <DotProgress pct={item.pct} />
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified Calendar Modal (EMI or OD mode)
// ─────────────────────────────────────────────────────────────────────────────
function LoanCalendarModal({
  visible,
  onClose,
  mode,
}: {
  visible: boolean;
  onClose: () => void;
  mode: 'emi' | 'od';
}) {
  const [viewYear,  setViewYear]  = useState(2025);
  const [viewMonth, setViewMonth] = useState(6); // July
  const [selDate,   setSelDate]   = useState<number | null>(null);

  const dateMap = mode === 'emi' ? EMI_DATES : OD_DATES;
  const title   = mode === 'emi' ? 'Upcoming EMI Calendar' : 'OD Repayment Calendar';

  const calDays = useMemo(() => {
    const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
    setSelDate(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
    setSelDate(null);
  };

  // For OD mode, 10th of every month has an event
  const hasEvent = (day: number) => {
    if (mode === 'emi') return !!dateMap[day];
    return day === 10;
  };

  const getEvents = (day: number) => {
    if (mode === 'emi') return dateMap[day] ?? [];
    if (day === 10) return OD_DATES[10] ?? [];
    return [];
  };

  const selectedEvents = selDate ? getEvents(selDate) : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cs.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={cs.sheet}>
          <View style={cs.handle} />
          <View style={cs.sheetHeader}>
            <Text style={cs.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={cs.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Month nav */}
          <View style={cs.navRow}>
            <TouchableOpacity style={cs.navBtn} onPress={prevMonth} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={cs.monthYear}>{MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity style={cs.navBtn} onPress={nextMonth} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={cs.dayRow}>
            {DAY_LABELS.map(d => <Text key={d} style={cs.dayLabel}>{d}</Text>)}
          </View>

          {/* Calendar grid */}
          <View style={cs.grid}>
            {calDays.map((day, idx) => {
              if (!day) return <View key={idx} style={cs.cell} />;
              const marked     = hasEvent(day);
              const isSelected = selDate === day;
              return (
                <TouchableOpacity
                  key={idx}
                  style={cs.cell}
                  onPress={() => setSelDate(isSelected ? null : day)}
                  activeOpacity={0.7}
                >
                  <View style={[cs.dayCircle, marked && cs.dayEmi, isSelected && cs.daySelected]}>
                    <Text style={[cs.dayTxt, marked && cs.dayEmiTxt, isSelected && cs.daySelectedTxt]}>
                      {day}
                    </Text>
                  </View>
                  {marked && !isSelected && <View style={cs.emiDot} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={cs.legend}>
            <View style={cs.legendItem}>
              <View style={[cs.legendDot, { backgroundColor: COLORS.brandPrimary }]} />
              <Text style={cs.legendTxt}>
                {mode === 'emi' ? 'EMI / Interest due' : 'OD Interest due (10th)'}
              </Text>
            </View>
          </View>

          {/* Selected date events */}
          {selDate !== null && (
            <View style={cs.emiList}>
              <Text style={cs.emiListTitle}>
                {selDate} {MONTHS[viewMonth]} — {mode === 'emi' ? 'EMIs Due' : 'OD Repayment'}
              </Text>
              {selectedEvents.length === 0 ? (
                <Text style={cs.noEmi}>No payment due on this date</Text>
              ) : (
                selectedEvents.map((e, i) => (
                  <View key={i} style={[cs.emiRow, i < selectedEvents.length - 1 && cs.emiRowBorder]}>
                    <View style={cs.emiIcon}>
                      <Ionicons name="business-outline" size={16} color={COLORS.brandPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={cs.emiLoan}>{e.loan}</Text>
                      <Text style={cs.emiTag}>{e.tag}</Text>
                    </View>
                    <Text style={cs.emiAmt}>{e.amount}</Text>
                  </View>
                ))
              )}
            </View>
          )}
          <View style={{ height: 20 }} />
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function LoansODsScreen() {
  const { company, selectedFY} = useAuth();
  const companyGuid = company?.guid;
  const [apiData, setApiData] = React.useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  React.useEffect(() => {
    if (!companyGuid) return;
    getKPILoansODs(companyGuid).then((res: any) => { if (res?.data) setApiData(res.data); }).catch(() => {}).finally(() => setIsLoading(false));
  }, [companyGuid]);

  const router  = useRouter();
  const kpiRef  = useRef<FlatList>(null);
  const loanRef = useRef<FlatList>(null);

  const [kpiIdx,          setKpiIdx]          = useState(0);
  const [loanIdx,         setLoanIdx]          = useState(0);
  const [activeTab,       setActiveTab]        = useState<'outstanding' | 'od'>('outstanding');
  const [overdueOn,       setOverdueOn]        = useState(false);
  const [dateFrom,        setDateFrom]         = useState('31/03/25');
  const [dateTo,          setDateTo]           = useState('23/04/25');
  const [showDatePick,    setShowDatePick]     = useState(false);
  const [showCalendar,    setShowCalendar]     = useState(false);
  const [selOutstanding,  setSelOutstanding]   = useState<OutstandingRow | null>(null);
  const [selOdRow,        setSelOdRow]         = useState<OdRow | null>(null);

  // Auto-scroll KPI every 4s
  useEffect(() => {
    const t = setInterval(() => {
      setKpiIdx(prev => {
        const next = (prev + 1) % KPI_DATA.length;
        kpiRef.current?.scrollToOffset({ offset: next * SW, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const fmtRange = () => {
    const fmt = (s: string) => {
      const p = s.split('/');
      if (p.length < 3) return s;
      const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${parseInt(p[0])} ${m[parseInt(p[1]) - 1]}`;
    };
    if (!dateFrom && !dateTo) return 'Select Range';
    if (dateFrom && !dateTo) return fmt(dateFrom);
    return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
  };

  const filteredEmis = overdueOn ? UPCOMING_EMIS.filter(e => e.overdue) : UPCOMING_EMIS;
  const filteredOdRepay = overdueOn ? OD_REPAYMENTS.filter(r => r.overdue) : OD_REPAYMENTS;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Loans/ODs</Text>
        <View style={s.headerBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {isLoading ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <CardSkeleton height={100} />
            {[...Array(4)].map((_, i) => <LedgerRowSkeleton key={i} />)}
          </View>
        ) : <>

        {/* ── KPI Carousel ─────────────────────────────────────────────── */}
        <View style={s.kpiSection}>
          <FlatList
            ref={kpiRef}
            horizontal pagingEnabled
            data={KPI_DATA}
            keyExtractor={i => i.id}
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
            onScrollToIndexFailed={() => {}}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              setKpiIdx(Math.round(e.nativeEvent.contentOffset.x / SW));
            }}
            renderItem={({ item }) => (
              <View style={s.kpiItem}>
                <View style={s.kpiCard}>
                  <View style={s.kpiIconBox}>
                    <Ionicons name={item.icon as any} size={20} color={COLORS.textSecondary} />
                  </View>
                  <View style={s.kpiTextWrap}>
                    <Text style={s.kpiLabel}>{item.label}</Text>
                    <Text style={s.kpiAmount} numberOfLines={1} adjustsFontSizeToFit>{item.amount}</Text>
                  </View>
                  <View style={[s.kpiTrendBadge, {
                    backgroundColor: item.positive ? COLORS.positiveBg : COLORS.negativeBg,
                  }]}>
                    <Ionicons name={item.positive ? 'trending-up' : 'trending-down'} size={11}
                      color={item.positive ? COLORS.positive : COLORS.negative} />
                    <Text style={[s.kpiTrendTxt, { color: item.positive ? COLORS.positive : COLORS.negative }]}>
                      {item.trend}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          />
          <View style={s.dots}>
            {KPI_DATA.map((_, i) => <View key={i} style={[s.dot, i === kpiIdx && s.dotActive]} />)}
          </View>
        </View>

        {/* ── Loan / OD Cards ──────────────────────────────────────────── */}
        <View style={s.loanSection}>
          <FlatList
            ref={loanRef}
            horizontal pagingEnabled
            data={LOAN_CARDS}
            keyExtractor={b => b.id}
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
            onScrollToIndexFailed={() => {}}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              setLoanIdx(Math.round(e.nativeEvent.contentOffset.x / SW));
            }}
            renderItem={({ item: card }) => (
              <View style={s.loanItem}>
                <LinearGradient
                  colors={card.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.loanCard}
                >
                  <View style={s.loanTopRow}>
                    <Text style={s.loanName}>{card.name}</Text>
                    <Text style={s.loanMaturity}>Maturity: {card.maturity}</Text>
                  </View>
                  <View style={s.loanStatsRow}>
                    {card.stats.map((st: any, i: number) => (
                      <View key={i} style={s.loanStat}>
                        <Text style={s.loanStatLabel}>{st.label}</Text>
                        <Text style={s.loanStatValue}>{st.value}</Text>
                      </View>
                    ))}
                  </View>
                </LinearGradient>
              </View>
            )}
          />
          <View style={s.dots}>
            {LOAN_CARDS.map((_, i) => <View key={i} style={[s.dot, i === loanIdx && s.dotActive]} />)}
          </View>
        </View>

        {/* ── Two Tabs ─────────────────────────────────────────────────── */}
        <View style={s.tabCard}>
          <View style={s.tabRow}>
            {(['outstanding', 'od'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text style={[s.tabBtnTxt, activeTab === tab && s.tabBtnTxtActive]}>
                  {tab === 'outstanding' ? 'Outstanding (6m)' : 'OD utilisation (30D)'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.tabContent}>
            {activeTab === 'outstanding'
              ? OUTSTANDING_DATA.map((row, idx) => (
                  <TouchableOpacity
                    key={row.id}
                    style={[s.dataRow, idx < OUTSTANDING_DATA.length - 1 && s.dataRowBorder]}
                    onPress={() => setSelOutstanding(row)}
                    activeOpacity={0.75}
                  >
                    <View style={s.dataIcon}>
                      <Ionicons name="cash-outline" size={18} color={COLORS.textSecondary} />
                    </View>
                    <View style={s.dataInfo}>
                      <Text style={s.dataMain}>{row.month}</Text>
                      <Text style={s.dataSub}>{row.amount} outstanding</Text>
                    </View>
                    <BarProgress pct={row.outstandingPct} />
                    <Text style={s.dataPct}>{row.outstandingPct}%</Text>
                  </TouchableOpacity>
                ))
              : OD_DATA.map((row, idx) => (
                  <TouchableOpacity
                    key={row.id}
                    style={[s.dataRow, idx < OD_DATA.length - 1 && s.dataRowBorder]}
                    onPress={() => setSelOdRow(row)}
                    activeOpacity={0.75}
                  >
                    <View style={s.dataIcon}>
                      <Ionicons name="settings-outline" size={18} color={COLORS.textSecondary} />
                    </View>
                    <View style={s.dataInfo}>
                      <Text style={s.dataMain}>{row.date}</Text>
                      <Text style={s.dataSub}>{row.amount} utilised</Text>
                    </View>
                    <DotProgress pct={row.pct} />
                    <Text style={s.dataPct}>{row.pct}%</Text>
                  </TouchableOpacity>
                ))
            }
          </View>
        </View>

        {/* ── Bottom Section — dynamic per tab ────────────────────────── */}
        <View style={s.emiSection}>
          <TouchableOpacity
            style={s.emiHeadingRow}
            onPress={() => setShowCalendar(true)}
            activeOpacity={0.7}
          >
            <Text style={s.emiHeading}>
              {activeTab === 'outstanding' ? 'Upcoming EMI' : 'OD Repayments'}
            </Text>
            <View style={s.emiCalBtn}>
              <Ionicons name="calendar-outline" size={15} color={COLORS.brandPrimary} />
              <Text style={s.emiCalBtnTxt}>View Calendar</Text>
            </View>
          </TouchableOpacity>

          {/* List items */}
          {(activeTab === 'outstanding' ? filteredEmis : filteredOdRepay).map((e, idx) => {
            const list = activeTab === 'outstanding' ? filteredEmis : filteredOdRepay;
            return (
              <View key={e.id} style={[s.emiRow, idx < list.length - 1 && s.emiRowBorder]}>
                <View style={s.emiIconBox}>
                  <Ionicons name="business-outline" size={18} color={COLORS.brandPrimary} />
                </View>
                <View style={s.emiInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.emiLoan}>{e.loan}</Text>
                    <View style={s.emiTagBadge}>
                      <Text style={s.emiTagTxt}>{e.tag}</Text>
                    </View>
                  </View>
                  <Text style={s.emiDate}>{e.date}</Text>
                </View>
                <Text style={[s.emiAmt, e.overdue && { color: COLORS.negative }]}>{e.amount}</Text>
              </View>
            );
          })}

          {(activeTab === 'outstanding' ? filteredEmis : filteredOdRepay).length === 0 && (
            <View style={s.emptyState}>
              <Text style={s.emptyTxt}>
                {overdueOn ? 'No overdue items found' : 'No upcoming items'}
              </Text>
            </View>
          )}
        </View>

        </>
        }
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <DateRangePickerModal
        visible={showDatePick}
        fromDate={dateFrom}
        toDate={dateTo}
        onApply={(f, t) => { setDateFrom(f); setDateTo(t); }}
        onClose={() => setShowDatePick(false)}
        minDate={selectedFY?.startDate}
        maxDate={selectedFY?.endDate}
      />

      <LoanCalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        mode={activeTab === 'outstanding' ? 'emi' : 'od'}
      />

      <OutstandingDetailModal
        item={selOutstanding}
        onClose={() => setSelOutstanding(null)}
      />

      <OdDetailModal
        item={selOdRow}
        onClose={() => setSelOdRow(null)}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  scroll: { paddingTop: SPACING.md },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:   { width: 40 },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  filterRow:             { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.md, marginBottom: SPACING.md },
  dateChip:              { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault },
  dateChipTxt:           { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  overdueChip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  overdueChipActive:     { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  overdueChipTxt:        { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  overdueChipTxtActive:  { color: COLORS.white },

  kpiSection:    { marginBottom: SPACING.md },
  kpiItem:       { width: SW },
  kpiCard:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  kpiIconBox:    { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  kpiTextWrap:   { flex: 1, gap: 2 },
  kpiLabel:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  kpiAmount:     { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  kpiTrendBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.full, flexShrink: 0 },
  kpiTrendTxt:   { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  dots:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10 },
  dot:       { width: 5,  height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  dotActive: { width: 16, height: 5, borderRadius: 3, backgroundColor: COLORS.textPrimary },

  loanSection:   { marginBottom: SPACING.md },
  loanItem:      { width: SW },
  loanCard:      { marginHorizontal: SPACING.md, borderRadius: RADIUS.xl, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16, gap: 20 },
  loanTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loanName:      { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: '#FFFFFF' },
  loanMaturity:  { fontSize: TYPOGRAPHY.xs, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  loanStatsRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  loanStat:      { gap: 3 },
  loanStatLabel: { fontSize: TYPOGRAPHY.xs, color: 'rgba(255,255,255,0.65)' },
  loanStatValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#FFFFFF' },

  tabCard:         { marginHorizontal: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden', marginBottom: SPACING.md },
  tabRow:          { flexDirection: 'row', backgroundColor: COLORS.pageBg, margin: 4, borderRadius: RADIUS.md, padding: 3 },
  tabBtn:          { flex: 1, paddingVertical: 8, borderRadius: RADIUS.sm, alignItems: 'center' },
  tabBtnActive:    { backgroundColor: COLORS.cardBg },
  tabBtnTxt:       { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  tabBtnTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  tabContent:      { paddingHorizontal: SPACING.md, paddingBottom: 8 },
  dataRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  dataRowBorder:   { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dataIcon:        { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dataInfo:        { flex: 1 },
  dataMain:        { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  dataSub:         { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 1 },
  dataPct:         { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, width: 38, textAlign: 'right', flexShrink: 0 },

  emiSection:    { marginHorizontal: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, paddingHorizontal: SPACING.md, paddingTop: 14, paddingBottom: 4 },
  emiHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  emiHeading:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  emiCalBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: COLORS.activeBg, borderRadius: RADIUS.full },
  emiCalBtnTxt:  { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.brandPrimary },
  emiRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  emiRowBorder:  { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  emiIconBox:    { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emiInfo:       { flex: 1 },
  emiLoan:       { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  emiTagBadge:   { paddingHorizontal: 7, paddingVertical: 2, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault },
  emiTagTxt:     { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600' },
  emiDate:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  emiAmt:        { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 0 },
  emptyState:    { paddingVertical: 20, alignItems: 'center' },
  emptyTxt:      { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
});

// ─────────────────────────────────────────────────────────────────────────────
// Detail Modal Styles
// ─────────────────────────────────────────────────────────────────────────────
const dm = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.md },
  card:       { width: '100%', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.xl, padding: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  closeBtn:   { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  divider:    { height: 1, backgroundColor: COLORS.borderDefault },
  lbl:        { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  val:        { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  barWrap:    { height: 8, backgroundColor: COLORS.borderDefault, borderRadius: 4, marginTop: 14, overflow: 'hidden' },
  barFill:    { height: 8, backgroundColor: COLORS.positive, borderRadius: 4 },
  barLabels:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  barLblLeft: { fontSize: TYPOGRAPHY.xs, color: COLORS.positive, fontWeight: '600' },
  barLblRight:{ fontSize: TYPOGRAPHY.xs, color: COLORS.negative, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Calendar Modal Styles
// ─────────────────────────────────────────────────────────────────────────────
const cs = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.48)' },
  sheet:      { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: SPACING.md, paddingTop: 12, maxHeight: '90%' },
  handle:     { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  closeBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  navRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  monthYear:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  dayRow:     { flexDirection: 'row', marginBottom: 6 },
  dayLabel:   { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: COLORS.textTertiary },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  cell:       { width: `${100 / 7}%` as any, alignItems: 'center', paddingVertical: 3 },
  dayCircle:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayEmi:     { backgroundColor: COLORS.activeBg, borderWidth: 1.5, borderColor: COLORS.brandPrimary },
  daySelected:{ backgroundColor: COLORS.brandPrimary },
  dayTxt:     { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary },
  dayEmiTxt:  { color: COLORS.brandPrimary, fontWeight: '700' },
  daySelectedTxt: { color: COLORS.white, fontWeight: '700' },
  emiDot:     { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.brandPrimary, marginTop: 1 },
  legend:     { flexDirection: 'row', gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendTxt:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  emiList:    { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: 6 },
  emiListTitle:{ fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  emiRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  emiRowBorder:{ borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  emiIcon:    { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.activeBg, alignItems: 'center', justifyContent: 'center' },
  emiLoan:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  emiTag:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 1 },
  emiAmt:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 0 },
  noEmi:      { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 12 },
});
