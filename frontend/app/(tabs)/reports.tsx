import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
  PanResponder, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Path, Circle, Line, G, Text as SvgText, Rect,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_REPORTS } from '../../src/data/mockData';
import { getFinancialData } from '../../src/services/api';
import { FinancialChartSkeleton } from '../../src/components/Skeleton';

const SCREEN_W = Dimensions.get('window').width;
// Card width (screen - outer margins). Content area inside card (card - card padding).
const CARD_W = SCREEN_W - SPACING.md * 2;
const CONTENT_W = CARD_W - SPACING.md * 2;

// ── Chart palette ─────────────────────────────────────────────────────────────
const C_GREEN  = '#2D7D46';
const C_GOLD   = '#D97706';
const C_GREY   = '#E0DED6';
const C_GRID   = '#E8E7E1';

// ── AI Insights static data ────────────────────────────────────────────────────
const AI_FORECAST  = [280,260,300,320,310,340,330,360,350,370,360,390,
                      380,400,395,420,410,430,420,445,435,455,445,460];
const AI_ACTUAL    = [260,240,280,270,310,380,420,400,380,450,490,540,
                      580,630,680,740,800,860,820,900,940,980,1020,990];
const AI_X = ['Wk 1','Wk 2','Wk 3','Wk 4','Wk 5','Wk 6','Wk 7','Wk 8'];

// ── Value formatter (lakh/crore aware) ────────────────────────────────────────
function fmtVal(v: number): string {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000)   return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)     return `₹${(v / 1000).toFixed(0)}k`;
  return `₹${Math.round(v)}`;
}

// ── Logarithmic Y-scale helpers ───────────────────────────────────────────────
const MIN_LOG = 2;  // log10(100)
const MAX_LOG = 5;  // log10(100k)
const LOG_RANGE = MAX_LOG - MIN_LOG;

function logY(value: number, chartH: number, padTop: number): number {
  const v = Math.max(value, 100);
  const l = Math.min(Math.log10(v), MAX_LOG);
  return padTop + chartH - ((l - MIN_LOG) / LOG_RANGE) * chartH;
}

const Y_GRID = [100, 1000, 10000, 100000];
const Y_LABELS = ['₹100', '₹1k', '₹10k', '₹100k'];

// ── Build smooth polyline path ────────────────────────────────────────────────
function buildPath(
  values: number[],
  chartW: number, chartH: number,
  padLeft: number, padTop: number,
): string {
  const n = values.length;
  return values
    .map((v, i) => {
      const x = padLeft + (i / (n - 1)) * chartW;
      const y = logY(v, chartH, padTop);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

// ══════════════════════════════════════════════════════════════════════════════
// Multi-Line Chart  (log scale + optional touch tooltip)
// ══════════════════════════════════════════════════════════════════════════════
interface LineChartProps {
  lines: { values: number[]; color: string; label: string; latestLabel: string }[];
  xLabels: string[];
  legendPosition?: 'top-right' | 'bottom';
  interactive?: boolean;
}

function LogLineChart({ lines, xLabels, legendPosition = 'top-right', interactive = false }: LineChartProps) {
  const [tooltipIdx, setTooltipIdx] = useState<number | null>(null);
  const hideTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PAD_LEFT   = 40;
  const PAD_RIGHT  = 8;
  const PAD_TOP    = 12;
  const PAD_BOTTOM = 28;

  const svgW   = CONTENT_W;
  const svgH   = 160;
  const chartW = svgW - PAD_LEFT - PAD_RIGHT;
  const chartH = svgH - PAD_TOP - PAD_BOTTOM;
  const nPts   = lines[0].values.length;
  const nLbls  = xLabels.length;
  const ptsPerLabel = nPts / nLbls;

  // Stale-closure refs
  const nPtsRef   = useRef(nPts);
  const chartWRef = useRef(chartW);
  const padLRef   = useRef(PAD_LEFT);
  nPtsRef.current   = nPts;
  chartWRef.current = chartW;
  padLRef.current   = PAD_LEFT;

  const getX = (i: number) => PAD_LEFT + (i / (nPts - 1)) * chartW;

  // Touch handler
  const handleTouch = useCallback((lx: number) => {
    if (!interactive) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const idx = Math.round(((lx - padLRef.current) / chartWRef.current) * (nPtsRef.current - 1));
    setTooltipIdx(Math.max(0, Math.min(nPtsRef.current - 1, idx)));
  }, [interactive]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:     () => interactive,
      onMoveShouldSetPanResponder:      () => interactive,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant:   (e) => handleTouch(e.nativeEvent.locationX),
      onPanResponderMove:    (e) => handleTouch(e.nativeEvent.locationX),
      onPanResponderRelease: () => { hideTimer.current = setTimeout(() => setTooltipIdx(null), 2000); },
    })
  ).current;

  // Tooltip label & values
  const tooltipLabelIdx = tooltipIdx !== null ? Math.floor(tooltipIdx / ptsPerLabel) : null;
  const tooltipXLabel   = tooltipLabelIdx !== null ? xLabels[Math.min(tooltipLabelIdx, nLbls - 1)] : '';
  const tooltipX        = tooltipIdx !== null ? getX(tooltipIdx) : 0;

  return (
    <View>
      {legendPosition === 'top-right' && (
        <View style={lc.legendTopRight}>
          {lines.map(l => (
            <View key={l.label} style={lc.legendRow}>
              <View style={[lc.dot, { backgroundColor: l.color }]} />
              <Text style={lc.legendLbl}>{l.label}</Text>
              <Text style={lc.legendVal}> : {l.latestLabel}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Touch tooltip bubble */}
      {interactive && tooltipIdx !== null && (
        <View style={[lc.tooltip, {
          left: Math.max(0, Math.min(svgW - 120, tooltipX - 55)),
        }]}>
          <Text style={lc.tooltipHdr}>{tooltipXLabel}</Text>
          {lines.map(l => (
            <View key={l.label} style={lc.tooltipRow}>
              <View style={[lc.tooltipDot, { backgroundColor: l.color }]} />
              <Text style={lc.tooltipLbl}>{l.label.split(' ')[0]}</Text>
              <Text style={lc.tooltipVal}>{fmtVal(l.values[tooltipIdx])}</Text>
            </View>
          ))}
        </View>
      )}

      <View {...(interactive ? pan.panHandlers : {})}>
        <Svg width={svgW} height={svgH}>
          {/* Grid lines + Y labels */}
          {Y_GRID.map((v, i) => {
            const y = logY(v, chartH, PAD_TOP);
            return (
              <G key={v}>
                <Line
                  x1={PAD_LEFT} y1={y.toFixed(1)}
                  x2={(PAD_LEFT + chartW).toFixed(1)} y2={y.toFixed(1)}
                  stroke={C_GRID} strokeWidth={1}
                />
                <SvgText
                  x={(PAD_LEFT - 4).toFixed(1)} y={(y + 3.5).toFixed(1)}
                  textAnchor="end" fontSize={8} fill={COLORS.textTertiary}
                >
                  {Y_LABELS[i]}
                </SvgText>
              </G>
            );
          })}

          {/* Bottom axis */}
          <Line
            x1={PAD_LEFT} y1={(PAD_TOP + chartH).toFixed(1)}
            x2={(PAD_LEFT + chartW).toFixed(1)} y2={(PAD_TOP + chartH).toFixed(1)}
            stroke={C_GRID} strokeWidth={1}
          />
          <SvgText
            x={(PAD_LEFT - 4).toFixed(1)} y={(PAD_TOP + chartH + 4).toFixed(1)}
            textAnchor="end" fontSize={8} fill={COLORS.textTertiary}
          >0</SvgText>

          {/* X-axis labels */}
          {xLabels.map((lbl, j) => {
            const centerIdx = j * ptsPerLabel + ptsPerLabel / 2;
            const x = PAD_LEFT + (centerIdx / (nPts - 1)) * chartW;
            return (
              <SvgText key={lbl} x={x.toFixed(1)} y={(svgH - 4).toFixed(1)}
                textAnchor="middle" fontSize={8.5} fill={COLORS.textSecondary}
              >{lbl}</SvgText>
            );
          })}

          {/* Lines */}
          {lines.map(l => (
            <Path
              key={l.label}
              d={buildPath(l.values, chartW, chartH, PAD_LEFT, PAD_TOP)}
              stroke={l.color} strokeWidth={2} fill="none"
              strokeLinecap="round" strokeLinejoin="round"
            />
          ))}

          {/* Dots at latest points */}
          {lines.map(l => {
            const lastVal = l.values[l.values.length - 1];
            const lx = PAD_LEFT + chartW;
            const ly = logY(lastVal, chartH, PAD_TOP);
            return <Circle key={`dot-${l.label}`} cx={lx.toFixed(1)} cy={ly.toFixed(1)} r={4} fill="#1A1A1A" />;
          })}

          {/* Crosshair on touch */}
          {interactive && tooltipIdx !== null && (
            <>
              <Line
                x1={tooltipX.toFixed(1)} y1={PAD_TOP.toFixed(1)}
                x2={tooltipX.toFixed(1)} y2={(PAD_TOP + chartH).toFixed(1)}
                stroke={COLORS.textTertiary} strokeWidth={1} strokeDasharray="3,3"
              />
              {lines.map(l => {
                const cy = logY(l.values[tooltipIdx], chartH, PAD_TOP);
                return <Circle key={`cross-${l.label}`} cx={tooltipX.toFixed(1)} cy={cy.toFixed(1)} r={4} fill={l.color} stroke={COLORS.white} strokeWidth={1.5} />;
              })}
            </>
          )}
        </Svg>
      </View>

      {legendPosition === 'bottom' && (
        <View style={lc.legendBottom}>
          {lines.map(l => (
            <View key={l.label} style={lc.legendRow}>
              <View style={[lc.dot, { backgroundColor: l.color }]} />
              <Text style={lc.legendLblBottom}>{l.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const lc = StyleSheet.create({
  legendTopRight: {
    position: 'absolute',
    top: 4, right: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 6,
    borderWidth: 1, borderColor: C_GREY,
    zIndex: 10,
    gap: 3,
  },
  legendRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:          { width: 8, height: 8, borderRadius: 4 },
  legendLbl:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  legendVal:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, fontWeight: '600' },
  legendBottom: { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingTop: 4 },
  legendLblBottom: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },

  // Touch tooltip
  tooltip: {
    position: 'absolute',
    top: 0,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    zIndex: 20,
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
    minWidth: 110,
  },
  tooltipHdr:  { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  tooltipRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tooltipDot:  { width: 7, height: 7, borderRadius: 4 },
  tooltipLbl:  { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  tooltipVal:  { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
});

// ══════════════════════════════════════════════════════════════════════════════
// Interactive Line Chart — linear scale, touch + web-hover tooltip
// ══════════════════════════════════════════════════════════════════════════════
interface ILineChartProps {
  lines: { values: number[]; color: string; label: string }[];
  xLabels: string[];
  isLoading?: boolean;
}

function InteractiveLineChart({ lines, xLabels, isLoading }: ILineChartProps) {
  const [tooltipIdx, setTooltipIdx] = useState<number | null>(null);

  const PAD_LEFT   = 52;
  const PAD_RIGHT  = 10;
  const PAD_TOP    = 14;
  const PAD_BOTTOM = 28;
  const svgW  = CONTENT_W;
  const svgH  = 190;
  const chartW = svgW - PAD_LEFT - PAD_RIGHT;
  const chartH = svgH - PAD_TOP - PAD_BOTTOM;
  const n = lines[0]?.values.length ?? 0;

  // Linear scale: compute bounds with 12% padding
  const allValues = lines.flatMap(l => l.values);
  const rawMin = allValues.length > 0 ? Math.min(...allValues) : 0;
  const rawMax = allValues.length > 0 ? Math.max(...allValues) : 1;
  const pad    = (rawMax - rawMin) * 0.12;
  const minVal = Math.max(0, rawMin - pad);
  const maxVal = rawMax + pad;
  const range  = maxVal - minVal || 1;

  const getX = (i: number) => PAD_LEFT + (n > 1 ? (i / (n - 1)) * chartW : chartW / 2);
  const getY = (v: number) => PAD_TOP + chartH - ((v - minVal) / range) * chartH;

  const buildLinePath = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'}${getX(i).toFixed(1)},${getY(v).toFixed(1)}`).join(' ');

  // 5 horizontal grid lines
  const yGrid = Array.from({ length: 5 }, (_, i) => minVal + (range / 4) * i);

  // ── Stale-closure-safe refs for PanResponder ──
  const nRef      = useRef(n);
  const chartWRef = useRef(chartW);
  const padLRef   = useRef(PAD_LEFT);
  nRef.current      = n;
  chartWRef.current = chartW;
  padLRef.current   = PAD_LEFT;

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouch = useCallback((touchX: number) => {
    const _n = nRef.current;
    if (_n === 0) return;
    const idx = Math.max(0, Math.min(_n - 1,
      Math.round(((touchX - padLRef.current) / chartWRef.current) * (_n - 1))
    ));
    setTooltipIdx(idx);
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:       () => true,
      onMoveShouldSetPanResponder:        () => true,
      onPanResponderTerminationRequest:   () => false,
      onPanResponderGrant:  (e) => { if (hideTimer.current) clearTimeout(hideTimer.current); handleTouch(e.nativeEvent.locationX); },
      onPanResponderMove:   (e) => handleTouch(e.nativeEvent.locationX),
      onPanResponderRelease: () => { hideTimer.current = setTimeout(() => setTooltipIdx(null), 2000); },
    })
  ).current;

  // Web mouse hover
  const webProps = Platform.OS === 'web' ? {
    onMouseMove: (e: any) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      handleTouch(e.clientX - e.currentTarget.getBoundingClientRect().left);
    },
    onMouseLeave: () => setTooltipIdx(null),
  } : {};

  if (isLoading) {
    return <FinancialChartSkeleton />;
  }

  // Tooltip position — clamp so it never overflows card edges
  const TOOLTIP_W = 168;
  const tx = tooltipIdx !== null ? getX(tooltipIdx) : 0;
  const tooltipLeft = tooltipIdx !== null
    ? Math.min(Math.max(tx - TOOLTIP_W / 2, PAD_LEFT - 8), CONTENT_W - TOOLTIP_W)
    : 0;

  return (
    <View style={{ position: 'relative' }} {...pan.panHandlers} {...(webProps as any)}>
      <Svg width={svgW} height={svgH}>

        {/* Y-grid + labels */}
        {yGrid.map((v, i) => {
          const y = getY(v);
          return (
            <G key={i}>
              <Line
                x1={PAD_LEFT} y1={y.toFixed(1)}
                x2={(PAD_LEFT + chartW).toFixed(1)} y2={y.toFixed(1)}
                stroke={C_GRID} strokeWidth={1}
              />
              <SvgText
                x={(PAD_LEFT - 5).toFixed(1)} y={(y + 4).toFixed(1)}
                textAnchor="end" fontSize={8} fill={COLORS.textTertiary}
              >
                {fmtVal(v)}
              </SvgText>
            </G>
          );
        })}

        {/* X-axis baseline */}
        <Line
          x1={PAD_LEFT} y1={(PAD_TOP + chartH).toFixed(1)}
          x2={(PAD_LEFT + chartW).toFixed(1)} y2={(PAD_TOP + chartH).toFixed(1)}
          stroke={C_GRID} strokeWidth={1}
        />

        {/* X-axis labels */}
        {xLabels.map((lbl, j) => (
          <SvgText
            key={`xl-${j}`}
            x={getX(j).toFixed(1)}
            y={(svgH - 5).toFixed(1)}
            textAnchor="middle" fontSize={8.5} fill={COLORS.textSecondary}
          >
            {lbl}
          </SvgText>
        ))}

        {/* Data lines */}
        {lines.map(l => (
          <Path
            key={l.label}
            d={buildLinePath(l.values)}
            stroke={l.color} strokeWidth={2.5}
            fill="none" strokeLinecap="round" strokeLinejoin="round"
          />
        ))}

        {/* Vertical crosshair */}
        {tooltipIdx !== null && (
          <Line
            x1={tx.toFixed(1)} y1={PAD_TOP.toString()}
            x2={tx.toFixed(1)} y2={(PAD_TOP + chartH).toFixed(1)}
            stroke={COLORS.textSecondary} strokeWidth={1} strokeDasharray="4,3"
          />
        )}

        {/* Highlight dots at crosshair */}
        {tooltipIdx !== null && lines.map(l => (
          <Circle
            key={`hd-${l.label}`}
            cx={tx.toFixed(1)} cy={getY(l.values[tooltipIdx]).toFixed(1)}
            r={5} fill={l.color} stroke="#fff" strokeWidth={2}
          />
        ))}
      </Svg>

      {/* Floating tooltip bubble */}
      {tooltipIdx !== null && (
        <View style={[ilc.tooltip, { left: tooltipLeft, top: PAD_TOP }]}>
          <Text style={ilc.month}>{xLabels[tooltipIdx]}</Text>
          {lines.map(l => (
            <View key={l.label} style={ilc.row}>
              <View style={[ilc.dot, { backgroundColor: l.color }]} />
              <Text style={ilc.label}>{l.label}</Text>
              <Text style={ilc.val}>{fmtVal(l.values[tooltipIdx])}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const ilc = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    minWidth: 168,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 100,
  },
  month: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: '700',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 7,
  },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dot:   { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  val:   { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
});

// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// GST Gauge — interactive semicircle, brand-toned, touch-to-scrub
// ══════════════════════════════════════════════════════════════════════════════
const GST_MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];

interface GSTGaugeProps {
  filedCount: number;   // 0-12
  needleIndex: number;  // default needle position (month index)
}

// gap between arc segments (~2.3°)
const GAUGE_GAP = 0.04;

function GSTGauge({ filedCount, needleIndex }: GSTGaugeProps) {
  const [activeMonth, setActiveMonth] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const svgW    = CONTENT_W;
  const svgH    = 222;
  const cx      = svgW / 2;
  const cy      = 196;
  const outerR  = 112;
  const innerR  = 70;
  const labelR  = outerR + 20;

  // Needle follows touch, falls back to needleIndex
  const displayIdx  = activeMonth ?? needleIndex;
  const needleAngle = Math.PI - (displayIdx + 0.5) * (Math.PI / 12);
  const needleLen   = innerR - 8;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy - needleLen * Math.sin(needleAngle);

  // Map touch → month index
  const handleGaugeTouch = useCallback((lx: number, ly: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const dx = lx - cx;
    const dy = cy - ly;                // flip y (SVG y goes down)
    if (dy < -10) return;              // below baseline
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < innerR * 0.5) return;  // too close to pivot
    const angle = Math.atan2(dy, dx);
    if (angle < 0 || angle > Math.PI) return;
    const idx = Math.min(11, Math.max(0, Math.floor((Math.PI - angle) / (Math.PI / 12))));
    setActiveMonth(idx);
  }, [cx, cy, innerR]);

  const gaugeRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:     () => true,
      onMoveShouldSetPanResponder:      () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant:   (e) => handleGaugeTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderMove:    (e) => handleGaugeTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderRelease: () => {
        hideTimer.current = setTimeout(() => setActiveMonth(null), 2200);
      },
    })
  ).current;

  const tooltipMonth = GST_MONTHS[displayIdx];
  const tooltipFiled = displayIdx < filedCount;

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={gauge.title}>GST filed</Text>

      {/* Tooltip chip — visible only while touching */}
      {activeMonth !== null ? (
        <View style={gauge.tooltipWrap}>
          <Text style={gauge.tooltipMonth}>{tooltipMonth}</Text>
          <View style={[gauge.tooltipBadge, {
            backgroundColor: tooltipFiled ? COLORS.brandPrimary : '#A89060',
          }]}>
            <Text style={gauge.tooltipBadgeTxt}>
              {tooltipFiled ? '✓ Filed' : '● Pending'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={gauge.tooltipWrap}>
          <Text style={gauge.tooltipHint}>Touch arc to explore</Text>
        </View>
      )}

      <View {...gaugeRef.panHandlers}>
        <Svg width={svgW} height={svgH}>

          {GST_MONTHS.map((month, i) => {
            const angleDeg = 180 - (i + 0.5) * 15;
            const angleRad = (angleDeg * Math.PI) / 180;

            const aR = Math.PI - (i + 1) * (Math.PI / 12) + GAUGE_GAP;
            const aL = Math.PI - i       * (Math.PI / 12) - GAUGE_GAP;

            const pt = (a: number, r: number) => ({
              x: cx + r * Math.cos(a),
              y: cy - r * Math.sin(a),
            });

            const o1 = pt(aR, outerR); const o2 = pt(aL, outerR);
            const i1 = pt(aR, innerR); const i2 = pt(aL, innerR);

            const d = [
              `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
              `A ${outerR} ${outerR} 0 0 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
              `L ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
              `A ${innerR} ${innerR} 0 0 0 ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
              'Z',
            ].join(' ');

            const isFiled  = i < filedCount;
            const isActive = i === activeMonth;

            // Label outside arc
            const lx = cx + labelR * Math.cos(angleRad);
            let extraY = 4;
            if (i === 0 || i === 11)      extraY = 16;
            else if (i === 1 || i === 10) extraY = 9;
            const ly = cy - labelR * Math.sin(angleRad) + extraY;

            let anchor: 'end' | 'start' | 'middle';
            if (angleDeg > 108)     anchor = 'end';
            else if (angleDeg < 72) anchor = 'start';
            else                    anchor = 'middle';

            return (
              <G key={month}>
                <Path
                  d={d}
                  fill={isFiled ? COLORS.brandPrimary : COLORS.borderDefault}
                  opacity={isActive ? 1 : isFiled ? 0.82 : 0.65}
                />
                <SvgText
                  x={lx.toFixed(2)} y={ly.toFixed(2)}
                  textAnchor={anchor}
                  fontSize={isActive ? 9 : 8}
                  fill={isActive ? COLORS.textPrimary : isFiled ? COLORS.textSecondary : COLORS.textTertiary}
                  fontWeight={isActive ? '700' : isFiled ? '600' : '400'}
                >
                  {month}
                </SvgText>
              </G>
            );
          })}

          {/* Needle */}
          <Line
            x1={cx.toFixed(2)} y1={cy.toFixed(2)}
            x2={nx.toFixed(2)} y2={ny.toFixed(2)}
            stroke={COLORS.brandPrimary} strokeWidth={2.5} strokeLinecap="round"
          />
          {/* Pivot cap */}
          <Circle cx={cx.toFixed(2)} cy={cy.toFixed(2)} r={8}  fill={COLORS.brandPrimary} />
          <Circle cx={cx.toFixed(2)} cy={cy.toFixed(2)} r={3}  fill={COLORS.cardBg} />
        </Svg>
      </View>
    </View>
  );
}

const gauge = StyleSheet.create({
  title: {
    fontSize: TYPOGRAPHY.md, fontWeight: '700',
    color: COLORS.textPrimary, textAlign: 'center',
    marginTop: 4, marginBottom: 2,
  },
  tooltipWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    minHeight: 28, marginBottom: 2,
  },
  tooltipMonth:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  tooltipBadge:    { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  tooltipBadgeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
  tooltipHint:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontStyle: 'italic' },
});

// ══════════════════════════════════════════════════════════════════════════════
// Audit Progress Bar — brand-toned + touch tooltip
// ══════════════════════════════════════════════════════════════════════════════
interface AuditBarProps {
  label: string;
  count: number;
  total: number;
  color?: string;
}

function AuditProgressBar({ label, count, total, color = COLORS.brandPrimary }: AuditBarProps) {
  const [touchX, setTouchX]     = useState<number | null>(null);
  const [barWidth, setBarWidth]  = useState(1);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filled = (total - count) / total;
  const pct    = Math.round(filled * 100);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:     () => true,
      onMoveShouldSetPanResponder:      () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant:   (e) => { if (hideTimer.current) clearTimeout(hideTimer.current); setTouchX(e.nativeEvent.locationX); },
      onPanResponderMove:    (e) => setTouchX(e.nativeEvent.locationX),
      onPanResponderRelease: () => { hideTimer.current = setTimeout(() => setTouchX(null), 1800); },
    })
  ).current;

  return (
    <View>
      <View style={ap.row}>
        <Text style={ap.label}>{label}</Text>
        <Text style={ap.count}>{count}</Text>
      </View>

      {/* Tooltip */}
      {touchX !== null && (
        <View style={[ap.tooltip, {
          left: Math.max(0, Math.min(barWidth - 96, touchX - 48)),
        }]}>
          <Text style={ap.tooltipTxt}>{pct}% reconciled</Text>
        </View>
      )}

      <View
        {...pan.panHandlers}
        style={ap.track}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        <View style={[ap.fill, { width: `${filled * 100}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const ap = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  count: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  track: {
    height: 10, backgroundColor: COLORS.borderDefault,
    borderRadius: 5, overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 5 },
  // touch tooltip
  tooltip: {
    position: 'absolute',
    bottom: 16,
    backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10, paddingVertical: 5,
    zIndex: 10,
  },
  tooltipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
});

// ══════════════════════════════════════════════════════════════════════════════
// Section Card wrapper
// ══════════════════════════════════════════════════════════════════════════════
interface SectionCardProps {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
  onPress?: () => void;
}

function SectionCard({ iconName, title, children, onPress }: SectionCardProps) {
  return (
    <View style={sc.card}>
      {/* Header */}
      <TouchableOpacity style={sc.header} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
        <View style={sc.iconBox}>
          <Ionicons name={iconName} size={14} color={COLORS.textSecondary} />
        </View>
        <Text style={sc.title}>{title}</Text>
        <Ionicons name="chevron-forward" size={18} color={onPress ? COLORS.brandPrimary : COLORS.textTertiary} />
      </TouchableOpacity>
      {/* Content */}
      <View style={sc.body}>{children}</View>
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: TYPOGRAPHY.base,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  body: {
    padding: SPACING.md,
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// Main Reports Screen
// ══════════════════════════════════════════════════════════════════════════════
export default function ReportsScreen() {
  const router = useRouter();

  // Financial chart data — fetched from API (falls back to mock data)
  const [finData, setFinData] = useState<{
    months: string[];
    revenue: number[];
    expenses: number[];
  } | null>(null);
  const [finLoading, setFinLoading] = useState(true);

  useEffect(() => {
    getFinancialData().then((d) => {
      setFinData(d);
      setFinLoading(false);
    }).catch(() => setFinLoading(false));
  }, []);

  return (
    <SafeAreaView testID="reports-screen" style={styles.safe}>
      {/* Page Header — mirrors Ledger screen style */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >

        {/* ── 1. Financial ───────────────────────────────────────────────── */}
        <SectionCard iconName="stats-chart-outline" title="Financial" onPress={() => router.push('/reports/financial' as any)}>
          <InteractiveLineChart
            isLoading={finLoading}
            lines={finData ? [
              { values: finData.revenue,  color: C_GREEN,    label: 'Revenue'  },
              { values: finData.expenses, color: '#A89060',  label: 'Expenses' },
            ] : []}
            xLabels={finData?.months ?? []}
          />
        </SectionCard>

        {/* ── 2. Compliance ─────────────────────────────────────────────── */}
        <SectionCard iconName="shield-checkmark-outline" title="Compliance" onPress={() => router.push('/reports/compliance' as any)}>
          {/* GST gauge: 9 filed (Apr-Dec), needle between Dec & Jan */}
          <GSTGauge filedCount={9} needleIndex={8} />
        </SectionCard>

        {/* ── 3. Audit Trail ────────────────────────────────────────────── */}
        <SectionCard iconName="git-branch-outline" title="Audit Trail" onPress={() => router.push('/reports/audit-trail' as any)}>
          <AuditProgressBar
            label="Unreconciled vouchers"
            count={14}
            total={100}
          />
        </SectionCard>

        {/* ── 4. AI Insights ────────────────────────────────────────────── */}
        <SectionCard iconName="sparkles-outline" title="AI Insights" onPress={() => router.push('/reports/ai-insights' as any)}>
          <LogLineChart
            lines={[
              { values: AI_FORECAST, color: COLORS.brandPrimary, label: 'Sales forecast', latestLabel: '₹460' },
              { values: AI_ACTUAL,   color: '#A89060',           label: 'Actual',          latestLabel: '₹990' },
            ]}
            xLabels={AI_X}
            legendPosition="bottom"
            interactive
          />
        </SectionCard>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.pageBg },
  scroll:  { flex: 1 },
  content: { paddingTop: SPACING.md },

  // Page header — mirrors Ledger screen
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
