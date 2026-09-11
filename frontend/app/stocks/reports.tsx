import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import Svg, { Path, Circle, G, Line } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { getStockDashboard } from '../../src/services/api';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useTranslation } from 'react-i18next';

const SW = Dimensions.get('window').width;
const ACCENT = '#A89060';

interface ReportItem { id: string; label: string; desc: string; icon: string; route: string; }
const REPORTS: ReportItem[] = [
  { id: 'stock-ledger', label: 'Stock Ledger',              desc: 'Item-wise inward & outward log',   icon: 'book-outline',            route: '/stocks/stock-ledger' },
  { id: 'valuation',    label: 'Valuation Summary',         desc: 'Total stock value by category',    icon: 'document-text-outline',   route: '/stocks/valuation-summary' },
  { id: 'expiry',       label: 'Expiry Schedule',           desc: 'Items expiring by date',           icon: 'timer-outline',           route: '/stocks/expiry-schedule' },
  { id: 'fast-slow',    label: 'Fast vs Slow Moving',       desc: 'Velocity analysis of all SKUs',    icon: 'swap-horizontal-outline', route: '/stocks/fast-slow' },
  { id: 'transfer',     label: 'Transfer History',          desc: 'Inter-warehouse stock transfers',  icon: 'repeat-outline',          route: '/stocks/transfer-history' },
  { id: 'snapshot',     label: 'Stock Snapshot',            desc: 'Point-in-time stock position',     icon: 'camera-outline',          route: '/stocks/stock-snapshot' },
  { id: 'negative',     label: 'Negative Stock Exceptions', desc: 'Items with below-zero quantities', icon: 'alert-circle-outline',    route: '/stocks/negative-stock' },
];

function TrendAreaChart({ data }: { data: { label: string; value: number }[] }) {
  const [sel, setSel] = useState(Math.max(0, data.length - 1));
  const W = SW - SPACING.md * 2 - SPACING.md * 2;
  const H = 120;
  const PAD = 10;
  if (!data.length) {
    return (
      <View style={{ height: H + 22, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: COLORS.textTertiary, fontSize: TYPOGRAPHY.xs }}>No trend data yet</Text>
      </View>
    );
  }
  const vals = data.map(d => d.value);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const range = max - min || 1;
  const stepX = data.length > 1 ? (W - PAD * 2) / (data.length - 1) : 0;
  const pts = data.map((d, i) => ({
    x: PAD + i * stepX,
    y: PAD + (1 - (d.value - min) / range) * (H - PAD * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${line} L ${pts[pts.length - 1].x} ${H - PAD} L ${pts[0].x} ${H - PAD} Z`;
  const sp = pts[sel] || pts[0];

  return (
    <View style={{ width: W, height: H + 22 }}>
      <Svg width={W} height={H + 22}>
        <Line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke={COLORS.borderDefault} strokeWidth={1} />
        <Line x1={sp.x} y1={PAD} x2={sp.x} y2={H - PAD} stroke={ACCENT} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
        <Path d={area} fill="rgba(168,144,96,0.12)" />
        <Path d={line} stroke={ACCENT} strokeWidth={2} fill="none" />
        {pts.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === sel ? 5 : 2.5}
            fill={i === sel ? ACCENT : COLORS.cardBg}
            stroke={ACCENT}
            strokeWidth={1.5}
          />
        ))}
      </Svg>
      <View style={[t.tip, { left: Math.min(Math.max(sp.x - 26, 0), W - 52), top: Math.max(sp.y - 30, 0) }]} pointerEvents="none">
        <Text style={t.tipTxt}>₹{data[sel]?.value?.toFixed(1) ?? '0'}L</Text>
      </View>
      <View style={StyleSheet.absoluteFill}>
        {pts.map((p, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.6}
            onPress={() => setSel(i)}
            style={{ position: 'absolute', left: p.x - 18, top: 0, width: 36, height: H }}
          />
        ))}
        {data.map((d, i) => (
          <Text
            key={i}
            style={[t.xlabel, { left: pts[i].x - 18, width: 36, color: i === sel ? COLORS.textPrimary : COLORS.textTertiary }]}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const t = StyleSheet.create({
  tip: {
    position: 'absolute',
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    minWidth: 52,
    alignItems: 'center',
  },
  tipTxt: { color: COLORS.white, fontSize: 10, fontWeight: '800' },
  xlabel: { position: 'absolute', bottom: 0, fontSize: 9, fontWeight: '600', textAlign: 'center' },
});

function Donut({ data, selected, onSelect, size = 128, stroke = 20 }: {
  data: { label: string; value: number; color: string }[];
  selected: number | null;
  onSelect: (i: number) => void;
  size?: number; stroke?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={COLORS.borderDefault} strokeWidth={stroke} fill="none" />
        {data.map((d, i) => {
          const len = (d.value / total) * C;
          const active = selected === null || selected === i;
          const el = (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={d.color}
              strokeWidth={selected === i ? stroke + 4 : stroke}
              strokeOpacity={active ? 1 : 0.25}
              fill="none"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              onPress={() => onSelect(i)}
            />
          );
          offset += len;
          return el;
        })}
      </G>
    </Svg>
  );
}

export default function StockReportsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { company } = useAuth();
  const companyGuid = company?.guid;
  const { formatAmountCompact } = useSettings();

  const [data, setData] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selCat, setSelCat] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!companyGuid) return;
    setApiError(null);
    setIsLoading(true);
    try {
      const res = await getStockDashboard(companyGuid);
      setData(res?.data ?? res);
    } catch (err: any) {
      setApiError(err?.message || 'Failed to load stock reports');
    } finally {
      setIsLoading(false);
    }
  }, [companyGuid]);

  useEffect(() => { load(); }, [load]);

  const composition = Array.isArray(data?.composition) ? data.composition : [];
  const trend = Array.isArray(data?.trend) ? data.trend : [];
  const compTotal = composition.reduce((s: number, c: any) => s + (Number(c.value) || 0), 0);
  const toggleCat = (i: number) => setSelCat(prev => (prev === i ? null : i));
  const fmtL = (v: number) => formatAmountCompact(Math.round(v));

  const centerVal = selCat === null ? fmtL(compTotal) : fmtL(composition[selCat]?.value || 0);
  const centerLbl = selCat === null ? 'Total' : composition[selCat]?.label;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {apiError && <ErrorBanner message={apiError} onRetry={load} />}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('stocks.stockReports')}</Text>
        <View style={s.headerBtn} />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={COLORS.brandPrimary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.summary}>
            <View style={s.sumCell}>
              <View style={[s.sumDot, { backgroundColor: ACCENT }]} />
              <Text style={s.sumValue}>{formatAmountCompact(Math.round(Number(data?.totalValue) || 0))}</Text>
              <Text style={s.sumLabel}>Total Value</Text>
            </View>
            <View style={s.sumSep} />
            <View style={s.sumCell}>
              <View style={[s.sumDot, { backgroundColor: COLORS.warning }]} />
              <Text style={s.sumValue}>{Number(data?.totalItems ?? 0).toLocaleString('en-IN')}</Text>
              <Text style={s.sumLabel}>SKUs</Text>
            </View>
            <View style={s.sumSep} />
            <View style={s.sumCell}>
              <View style={[s.sumDot, { backgroundColor: COLORS.positive }]} />
              <Text style={s.sumValue}>{data?.turnover ?? '0x'}</Text>
              <Text style={s.sumLabel}>Turnover</Text>
            </View>
          </View>

          <View style={s.card}>
            <View style={s.cardHead}>
              <View>
                <Text style={s.cardTitle}>Stock Value Trend</Text>
                <Text style={s.cardSub}>Tap a point to see its value</Text>
              </View>
              <View style={[s.trendPill, { backgroundColor: data?.valueTrendPositive ? COLORS.positiveBg : COLORS.negativeBg }]}>
                <Ionicons
                  name={data?.valueTrendPositive ? 'trending-up' : 'trending-down'}
                  size={13}
                  color={data?.valueTrendPositive ? COLORS.positive : COLORS.negative}
                />
                <Text style={[s.trendTxt, { color: data?.valueTrendPositive ? COLORS.positive : COLORS.negative }]}>
                  {data?.valueTrendPositive ? '+' : ''}{data?.valueTrendPct ?? 0}%
                </Text>
              </View>
            </View>
            <TrendAreaChart data={trend} />
          </View>

          {composition.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Value by Category</Text>
              <View style={s.donutRow}>
                <View style={s.donutWrap}>
                  <Donut data={composition} selected={selCat} onSelect={toggleCat} />
                  <View style={s.donutCenter}>
                    <Text style={s.donutCenterVal}>{centerVal}</Text>
                    <Text style={s.donutCenterLbl} numberOfLines={1}>{centerLbl}</Text>
                  </View>
                </View>
                <View style={s.legend}>
                  {composition.map((c: any, i: number) => {
                    const pct = compTotal > 0 ? Math.round((Number(c.value) / compTotal) * 100) : 0;
                    const active = selCat === i;
                    return (
                      <TouchableOpacity
                        key={c.label}
                        style={[s.legendRow, active && s.legendRowActive]}
                        activeOpacity={0.7}
                        onPress={() => toggleCat(i)}
                      >
                        <View style={[s.legendDot, { backgroundColor: c.color }]} />
                        <Text style={[s.legendLabel, active && { color: COLORS.textPrimary }]} numberOfLines={1}>{c.label}</Text>
                        <Text style={s.legendPct}>{pct}%</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          <Text style={s.sectionLabel}>All Reports</Text>
          <View style={s.listCard}>
            {REPORTS.map((item, idx) => (
              <View key={item.id}>
                <TouchableOpacity style={s.row} onPress={() => safePush(router, item.route as any)} activeOpacity={0.7}>
                  <View style={s.iconBox}>
                    <Ionicons name={item.icon as any} size={20} color={COLORS.textSecondary} />
                  </View>
                  <View style={s.rowInfo}>
                    <Text style={s.rowLabel}>{item.label}</Text>
                    <Text style={s.rowDesc}>{item.desc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
                </TouchableOpacity>
                {idx < REPORTS.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  headerBtn: { width: 40 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  scroll: { padding: SPACING.md, gap: SPACING.md },
  summary: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    paddingVertical: 14,
  },
  sumCell: { flex: 1, alignItems: 'center', gap: 3 },
  sumDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 2 },
  sumValue: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.4 },
  sumLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '500' },
  sumSep: { width: 1, height: 34, backgroundColor: COLORS.borderDefault },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: SPACING.sm },
  cardTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: 0.1 },
  cardSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2, fontWeight: '500' },
  trendPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full },
  trendTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  donutRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm, gap: SPACING.md },
  donutWrap: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', alignItems: 'center', pointerEvents: 'none' },
  donutCenterVal: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.4 },
  donutCenterLbl: { fontSize: 10, color: COLORS.textTertiary, fontWeight: '600', marginTop: 1, maxWidth: 90, textAlign: 'center' },
  legend: { flex: 1, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 6, borderRadius: RADIUS.sm },
  legendRowActive: { backgroundColor: COLORS.pageBg },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendLabel: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  legendPct: { fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, fontWeight: '700' },
  sectionLabel: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2, marginBottom: -4, paddingLeft: 4,
  },
  listCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowInfo: { flex: 1, gap: 2 },
  rowLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  rowDesc: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: SPACING.md + 40 + 12 },
});
