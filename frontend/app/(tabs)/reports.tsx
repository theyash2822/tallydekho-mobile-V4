import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Path, Circle, Line, G, Text as SvgText, Rect,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../src/components/Header';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_REPORTS, MOCK_USER } from '../../src/data/mockData';

const SCREEN_W = Dimensions.get('window').width;
// Card width (screen - outer margins). Content area inside card (card - card padding).
const CARD_W = SCREEN_W - SPACING.md * 2;
const CONTENT_W = CARD_W - SPACING.md * 2;

// ── Chart palette ─────────────────────────────────────────────────────────────
const C_GREEN  = '#2D7D46';
const C_GOLD   = '#D97706';
const C_GREY   = '#E0DED6';
const C_GRID   = '#E8E7E1';

// ── Chart data (24 points for 8 time periods → 3 pts/period for dense lines) ──
const FIN_REVENUE  = [280,250,320,290,380,340,420,390,450,480,420,500,
                      520,480,560,530,580,550,610,580,640,610,650,680];
const FIN_EXPENSES = [18000,16000,21000,25000,28000,23000,35000,30000,
                      42000,45000,38000,52000,55000,48000,62000,58000,
                      52000,70000,68000,62000,75000,78000,70000,72000];
const FIN_X = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'];

const AI_FORECAST  = [280,260,300,320,310,340,330,360,350,370,360,390,
                      380,400,395,420,410,430,420,445,435,455,445,460];
const AI_ACTUAL    = [260,240,280,270,310,380,420,400,380,450,490,540,
                      580,630,680,740,800,860,820,900,940,980,1020,990];
const AI_X = ['Wk 1','Wk 2','Wk 3','Wk 4','Wk 5','Wk 6','Wk 7','Wk 8'];

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
// Multi-Line Chart
// ══════════════════════════════════════════════════════════════════════════════
interface LineChartProps {
  lines: { values: number[]; color: string; label: string; latestLabel: string }[];
  xLabels: string[];
  legendPosition?: 'top-right' | 'bottom';
}

function LogLineChart({ lines, xLabels, legendPosition = 'top-right' }: LineChartProps) {
  const PAD_LEFT   = 40;
  const PAD_RIGHT  = 8;
  const PAD_TOP    = 12;
  const PAD_BOTTOM = 28;

  const svgW = CONTENT_W;
  const svgH = 160;
  const chartW = svgW - PAD_LEFT - PAD_RIGHT;
  const chartH = svgH - PAD_TOP - PAD_BOTTOM;
  const nPts   = lines[0].values.length;
  const nLbls  = xLabels.length;
  const ptsPerLabel = nPts / nLbls;

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

        {/* "0" label at the bottom axis line */}
        <Line
          x1={PAD_LEFT} y1={(PAD_TOP + chartH).toFixed(1)}
          x2={(PAD_LEFT + chartW).toFixed(1)} y2={(PAD_TOP + chartH).toFixed(1)}
          stroke={C_GRID} strokeWidth={1}
        />
        <SvgText
          x={(PAD_LEFT - 4).toFixed(1)}
          y={(PAD_TOP + chartH + 4).toFixed(1)}
          textAnchor="end" fontSize={8} fill={COLORS.textTertiary}
        >
          0
        </SvgText>

        {/* X-axis labels */}
        {xLabels.map((lbl, j) => {
          const centerIdx = j * ptsPerLabel + ptsPerLabel / 2;
          const x = PAD_LEFT + (centerIdx / (nPts - 1)) * chartW;
          return (
            <SvgText
              key={lbl}
              x={x.toFixed(1)}
              y={(svgH - 4).toFixed(1)}
              textAnchor="middle" fontSize={8.5} fill={COLORS.textSecondary}
            >
              {lbl}
            </SvgText>
          );
        })}

        {/* Lines */}
        {lines.map(l => (
          <Path
            key={l.label}
            d={buildPath(l.values, chartW, chartH, PAD_LEFT, PAD_TOP)}
            stroke={l.color}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Dots at latest points */}
        {lines.map(l => {
          const lastVal = l.values[l.values.length - 1];
          const lx = PAD_LEFT + chartW;
          const ly = logY(lastVal, chartH, PAD_TOP);
          return (
            <Circle key={`dot-${l.label}`}
              cx={lx.toFixed(1)} cy={ly.toFixed(1)}
              r={4} fill="#1A1A1A"
            />
          );
        })}
      </Svg>

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
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLbl: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  legendVal: { fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, fontWeight: '600' },
  legendBottom: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 20, paddingTop: 4,
  },
  legendLblBottom: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
});

// ══════════════════════════════════════════════════════════════════════════════
// GST Gauge — Fan / Semicircle
// ══════════════════════════════════════════════════════════════════════════════
const GST_MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];

interface GSTGaugeProps {
  filedCount: number;   // 0-12
  needleIndex: number;  // needle between needleIndex and needleIndex+1
}

function GSTGauge({ filedCount, needleIndex }: GSTGaugeProps) {
  const svgW   = CONTENT_W;
  const svgH   = 220;
  const cx     = svgW / 2;
  const cy     = 192;           // near bottom, leaving room for base circle
  const outerR = 106;           // fixed — fits labels within card
  const innerR = 66;
  const midR   = (outerR + innerR) / 2;   // 86
  const segH   = (outerR - innerR) * 0.82;
  const arcSpacing = (Math.PI * midR) / 12;
  const segW   = arcSpacing * 0.76;
  const labelR = outerR + 20;  // 126 — clear of segments

  // Needle: points between needleIndex and needleIndex+1 segment
  const needleAngleRad = Math.PI - (needleIndex + 1) * (Math.PI / 12);
  const needleLen = innerR - 6;
  const nx = cx + needleLen * Math.cos(needleAngleRad);
  const ny = cy - needleLen * Math.sin(needleAngleRad);

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={gauge.title}>GST filed</Text>
      <Svg width={svgW} height={svgH}>
        {GST_MONTHS.map((month, i) => {
          const angleRad = Math.PI - (i + 0.5) * (Math.PI / 12);
          const angleDeg = angleRad * (180 / Math.PI);

          // Segment center
          const segCX = cx + midR * Math.cos(angleRad);
          const segCY = cy - midR * Math.sin(angleRad);
          // Rotate rect HEIGHT along radial direction
          const rotateDeg = angleDeg - 90;

          const isFiled = i < filedCount;

          // Label — NO rotation for readability
          const labelX = cx + labelR * Math.cos(angleRad);
          const labelY = cy - labelR * Math.sin(angleRad) + 3.5; // +3.5 baseline offset

          // Smart text anchor: left-half labels end here, right-half labels start here
          let anchor: 'end' | 'start' | 'middle';
          if (angleDeg > 100) anchor = 'end';
          else if (angleDeg < 80) anchor = 'start';
          else anchor = 'middle';

          return (
            <G key={month}>
              {/* Segment pill */}
              <G transform={`translate(${segCX.toFixed(1)},${segCY.toFixed(1)}) rotate(${rotateDeg.toFixed(1)})`}>
                <Rect
                  x={(-segW / 2).toFixed(1)}
                  y={(-segH / 2).toFixed(1)}
                  width={segW.toFixed(1)}
                  height={segH.toFixed(1)}
                  rx={(segW / 2).toFixed(1)}
                  fill={isFiled ? C_GREEN : C_GREY}
                />
              </G>
              {/* Label — horizontal, no rotation */}
              <SvgText
                x={labelX.toFixed(1)}
                y={labelY.toFixed(1)}
                textAnchor={anchor}
                fontSize={8.5}
                fill={isFiled ? '#1A4D2E' : COLORS.textTertiary}
                fontWeight={isFiled ? '700' : '400'}
              >
                {month}
              </SvgText>
            </G>
          );
        })}

        {/* Needle */}
        <Line
          x1={cx.toFixed(1)} y1={cy.toFixed(1)}
          x2={nx.toFixed(1)} y2={ny.toFixed(1)}
          stroke="#1A1A1A" strokeWidth={2.5} strokeLinecap="round"
        />
        {/* Needle pivot */}
        <Circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={6} fill="#1A1A1A" />
        <Circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={10} fill="none" stroke="#1A1A1A" strokeWidth={1.5} />
      </Svg>
    </View>
  );
}

const gauge = StyleSheet.create({
  title: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 0,
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// Audit Progress Bar
// ══════════════════════════════════════════════════════════════════════════════
interface AuditBarProps {
  label: string;
  count: number;
  total: number;
  color?: string;
}

function AuditProgressBar({ label, count, total, color = C_GREEN }: AuditBarProps) {
  const filled = (total - count) / total; // reconciled fraction
  return (
    <View>
      <View style={ap.row}>
        <Text style={ap.label}>{label}</Text>
        <Text style={ap.count}>{count}</Text>
      </View>
      <View style={ap.track}>
        <View style={[ap.fill, { width: `${filled * 100}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const ap = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  count: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  track: {
    height: 10,
    backgroundColor: C_GREY,
    borderRadius: 5,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 5,
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// Section Card wrapper
// ══════════════════════════════════════════════════════════════════════════════
interface SectionCardProps {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
}

function SectionCard({ iconName, title, children }: SectionCardProps) {
  return (
    <View style={sc.card}>
      {/* Header */}
      <TouchableOpacity style={sc.header} activeOpacity={0.7}>
        <View style={sc.iconBox}>
          <Ionicons name={iconName} size={14} color={COLORS.textSecondary} />
        </View>
        <Text style={sc.title}>{title}</Text>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
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
    backgroundColor: '#EEF2FF',
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
  const r = MOCK_REPORTS;

  return (
    <SafeAreaView testID="reports-screen" style={styles.safe}>
      <Header companyName={MOCK_USER.company} fyYear={MOCK_USER.fyYear} notificationCount={1} />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Page title */}
        <Text style={styles.pageTitle}>Reports Dashboard</Text>

        {/* ── 1. Financial ───────────────────────────────────────────────── */}
        <SectionCard iconName="stats-chart-outline" title="Financial">
          <View style={{ position: 'relative' }}>
            <LogLineChart
              lines={[
                { values: FIN_REVENUE,  color: C_GREEN, label: 'Revenue',  latestLabel: '₹680' },
                { values: FIN_EXPENSES, color: C_GOLD,  label: 'Expenses', latestLabel: '₹72k' },
              ]}
              xLabels={FIN_X}
              legendPosition="top-right"
            />
          </View>
        </SectionCard>

        {/* ── 2. Compliance ─────────────────────────────────────────────── */}
        <SectionCard iconName="shield-checkmark-outline" title="Compliance">
          {/* GST gauge: 9 filed (Apr-Dec), needle between Dec & Jan */}
          <GSTGauge filedCount={9} needleIndex={8} />
        </SectionCard>

        {/* ── 3. Audit Trail ────────────────────────────────────────────── */}
        <SectionCard iconName="git-branch-outline" title="Audit Trail">
          <AuditProgressBar
            label="Unreconciled vouchers"
            count={14}
            total={100}
          />
        </SectionCard>

        {/* ── 4. AI Insights ────────────────────────────────────────────── */}
        <SectionCard iconName="sparkles-outline" title="AI Insights">
          <LogLineChart
            lines={[
              { values: AI_FORECAST, color: C_GREEN, label: 'Sales forecast', latestLabel: '₹460' },
              { values: AI_ACTUAL,   color: C_GOLD,  label: 'Actual',         latestLabel: '₹990' },
            ]}
            xLabels={AI_X}
            legendPosition="bottom"
          />
        </SectionCard>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  scroll: { flex: 1 },
  content: { paddingTop: SPACING.md },
  pageTitle: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.md,
    marginHorizontal: SPACING.md,
  },
});
