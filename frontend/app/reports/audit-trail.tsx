import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';

const W = Dimensions.get('window').width;
const BAR_CHART_W = W - SPACING.md * 4;

const PERIODS: DropdownOption[] = [
  { label: 'This Month', value: 'month' },
  { label: 'Quarterly', value: 'quarter' },
  { label: 'Half Yearly', value: 'half' },
  { label: 'Yearly', value: 'year' },
];

// 30-day bar chart data
const BAR_DATA = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  count: Math.floor(Math.random() * 18) + 2,
}));
const maxCount = Math.max(...BAR_DATA.map(d => d.count));

function ActivityBarChart() {
  const H = 100; const PAD_B = 18; const PAD_T = 8;
  const chartH = H - PAD_B - PAD_T;
  const barW = (BAR_CHART_W / 30) - 2;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={BAR_CHART_W} height={H}>
        {BAR_DATA.map((d, i) => {
          const bh = (d.count / maxCount) * chartH;
          const x = i * (barW + 2);
          const y = PAD_T + chartH - bh;
          return (
            <G key={d.day}>
              <Rect x={x} y={y} width={barW} height={bh} rx={2}
                fill={d.count > 12 ? '#C0392B' : d.count > 7 ? '#D97706' : '#2D7D46'} opacity={0.85} />
              {(d.day === 1 || d.day % 5 === 0) && (
                <SvgText x={x + barW / 2} y={H - 3} textAnchor="middle" fontSize={7} fill={COLORS.textTertiary}>
                  {d.day}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

const STAT_CARDS = [
  { label: 'Edited',   value: '23',    color: '#D97706', icon: 'create-outline' },
  { label: 'Deleted',  value: '5',     color: '#C0392B', icon: 'trash-outline' },
  { label: 'Net Dr',   value: '₹2.4L', color: '#2D7D46', icon: 'trending-up' },
  { label: 'Net Cr',   value: '₹1.8L', color: '#2563EB', icon: 'trending-down' },
  { label: 'Created',  value: '148',   color: '#7C3AED', icon: 'add-circle-outline' },
];

const ENTRIES = [
  { id: 'a1', ref: 'INV-30979', desc: 'Sales Invoice edited — Customer: ABC Traders', date: '15 Jun 25', amount: '₹42,500', type: 'Dr', action: 'Edited' },
  { id: 'a2', ref: 'PV-00081',  desc: 'Payment Voucher created — Kumar & Sons',       date: '14 Jun 25', amount: '₹15,000', type: 'Cr', action: 'Created' },
  { id: 'a3', ref: 'INV-30975', desc: 'Invoice deleted — Sharma Electronics',          date: '13 Jun 25', amount: '₹18,750', type: 'Dr', action: 'Deleted' },
  { id: 'a4', ref: 'JV-00015',  desc: 'Journal Entry — Capital Account adjustment',   date: '13 Jun 25', amount: '₹5,000',  type: 'Cr', action: 'Created' },
  { id: 'a5', ref: 'PO-00123',  desc: 'Purchase Order edited — Delhi Suppliers',      date: '12 Jun 25', amount: '₹62,400', type: 'Dr', action: 'Edited' },
  { id: 'a6', ref: 'RV-00062',  desc: 'Receipt Voucher created — XYZ Retail',         date: '12 Jun 25', amount: '₹33,200', type: 'Cr', action: 'Created' },
];

const ACTION_COLORS: Record<string, string> = {
  Edited: '#D97706', Deleted: '#C0392B', Created: '#2D7D46',
};

export default function AuditTrailScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState('month');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Audit Trail</Text>
        <TouchableOpacity style={s.exportBtn} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={18} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Period Filter */}
        <View style={s.filterRow}>
          <FormDropdown
            label="Period"
            value={period}
            options={PERIODS}
            onSelect={o => setPeriod(o.value)}
            placeholder="Select period"
            containerStyle={{ flex: 1, marginBottom: 0 }}
          />
          <View style={s.fyBadge}>
            <Text style={s.fyText}>FY 2025-26</Text>
          </View>
        </View>

        {/* Stat Cards Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.statsScroll} contentContainerStyle={s.statsContent}>
          {STAT_CARDS.map(st => (
            <View key={st.label} style={[s.statCard, { borderTopColor: st.color }]}>
              <View style={[s.statIcon, { backgroundColor: st.color + '18' }]}>
                <Ionicons name={st.icon as any} size={16} color={st.color} />
              </View>
              <Text style={s.statVal}>{st.value}</Text>
              <Text style={s.statLbl}>{st.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Daily Activity Bar Chart */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Daily Activity (Last 30 Days)</Text>
          <View style={s.legendRow}>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#2D7D46' }]} /><Text style={s.legendTxt}>Normal</Text></View>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#D97706' }]} /><Text style={s.legendTxt}>Medium</Text></View>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#C0392B' }]} /><Text style={s.legendTxt}>High</Text></View>
          </View>
          <ActivityBarChart />
        </View>

        {/* Latest Entries */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Latest Entries</Text>
          {ENTRIES.map((entry, idx) => {
            const ac = ACTION_COLORS[entry.action] || COLORS.textSecondary;
            return (
              <View key={entry.id} style={[s.entryRow, idx < ENTRIES.length - 1 && s.entryBorder]}>
                <View style={[s.entryActionBadge, { backgroundColor: ac + '18' }]}>
                  <Text style={[s.entryActionTxt, { color: ac }]}>{entry.action}</Text>
                </View>
                <View style={s.entryInfo}>
                  <Text style={s.entryRef}>{entry.ref}</Text>
                  <Text style={s.entryDesc} numberOfLines={1}>{entry.desc}</Text>
                  <Text style={s.entryDate}>{entry.date}</Text>
                </View>
                <View style={s.entryAmt}>
                  <Text style={[s.entryAmtTxt, { color: entry.type === 'Dr' ? COLORS.positive : COLORS.negative }]}>
                    {entry.amount}
                  </Text>
                  <Text style={[s.entryDrCr, { color: entry.type === 'Dr' ? COLORS.positive : COLORS.negative }]}>
                    {entry.type}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Share Button */}
        <TouchableOpacity style={s.shareBtn} activeOpacity={0.8}>
          <Ionicons name="share-outline" size={18} color={COLORS.white} />
          <Text style={s.shareTxt}>Share PDF Report</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.pageBg },
  header:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  exportBtn:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },

  filterRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, margin: SPACING.md },
  fyBadge:   { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.activeBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  fyText:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },

  statsScroll:  { },
  statsContent: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, gap: 10 },
  statCard: {
    width: 100, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderTopWidth: 3, gap: 4, alignItems: 'center',
  },
  statIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  statVal:  { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary },
  statLbl:  { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center' },

  section:      { margin: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md },
  sectionTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  legendRow:    { flexDirection: 'row', gap: 16, marginBottom: SPACING.sm },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendTxt:    { fontSize: 11, color: COLORS.textSecondary },

  entryRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12 },
  entryBorder:      { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  entryActionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm, alignSelf: 'flex-start', minWidth: 56, alignItems: 'center' },
  entryActionTxt:   { fontSize: 10, fontWeight: '700' },
  entryInfo:        { flex: 1, gap: 2 },
  entryRef:         { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  entryDesc:        { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  entryDate:        { fontSize: 10, color: COLORS.textTertiary },
  entryAmt:         { alignItems: 'flex-end', gap: 2 },
  entryAmtTxt:      { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  entryDrCr:        { fontSize: 10, fontWeight: '600' },

  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: SPACING.md, marginBottom: SPACING.md,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 14,
  },
  shareTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
