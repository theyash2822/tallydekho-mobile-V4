import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getLedgers } from '../../src/services/api';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';

// ── Tab Config ───────────────────────────────────────────────────────────────
const TABS = ['TDS', 'TCS', 'Import Duty', 'Export Duty', 'Excise Duty', 'VAT', 'Cess'] as const;
type TaxTab = typeof TABS[number];

// Tax stats — populated from Tally ledger data
const TAB_STATS: Record<TaxTab, { label: string; value: string }[]> = {
  'TDS': [], 'TCS': [], 'Import Duty': [], 'Export Duty': [], 'Excise Duty': [], 'VAT': [], 'Cess': [],
};

// Late Challans (shared mock)
const LATE_CHALLANS: any[] = []; // TODO: fetch from TDS/GST API when available

// Recent Activity (shared mock)
// RECENT_ACTIVITY: fetch from API when tax activity endpoint is available

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function OtherTaxesScreen() {
  const router = useRouter();
  const [activeTab,      setActiveTab]      = useState<TaxTab>('TDS');
  const [fromDate,       setFromDate]       = useState('');
  const [toDate,         setToDate]         = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const isDateActive = fromDate.length > 0 && toDate.length > 0;
  const stats = TAB_STATS[activeTab];

  return (
    <SafeAreaView style={s.safe}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Other Taxes</Text>
        <TouchableOpacity style={s.iconBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
          <Ionicons
            name="calendar-outline" size={20}
            color={isDateActive ? COLORS.brandPrimary : COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Date Strip */}
      <TouchableOpacity style={s.dateStrip} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={13} color={isDateActive ? COLORS.brandPrimary : COLORS.textTertiary} />
        <Text style={[s.dateStripTxt, isDateActive && s.dateStripActive]}>
          {isDateActive ? `${fromDate}  \u2192  ${toDate}` : 'All Dates'}
        </Text>
        {!isDateActive && <Ionicons name="chevron-down" size={11} color={COLORS.textTertiary} />}
        {isDateActive && (
          <TouchableOpacity
            onPress={() => { setFromDate(''); setToDate(''); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color={COLORS.brandPrimary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Tax Tab Bar */}
      <View style={s.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabBarContent}
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[s.tabPill, activeTab === tab && s.tabPillActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabTxt, activeTab === tab && s.tabTxtActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {/* Stats 2×2 card — only shown when data is available */}
        {stats.length === 0 && (
          <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
            <Ionicons name="receipt-outline" size={40} color={COLORS.textTertiary} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.textSecondary }}>No {activeTab} data available</Text>
            <Text style={{ fontSize: 12, color: COLORS.textTertiary, textAlign: 'center' }}>{activeTab} details are not tracked in the current Tally sync</Text>
          </View>
        )}
        {stats.length >= 4 && (<View style={s.statsCard}>
          {/* Row 1 */}
          <View style={s.statsRow}>
            <View style={s.statCell}>
              <Text style={s.statLabel}>{stats[0].label}</Text>
              <Text style={s.statValue}>{stats[0].value}</Text>
            </View>
            <View style={s.statDivV} />
            <View style={s.statCell}>
              <Text style={s.statLabel}>{stats[1].label}</Text>
              <Text style={s.statValue}>{stats[1].value}</Text>
            </View>
          </View>
          {/* Divider */}
          <View style={s.statDivH} />
          {/* Row 2 */}
          <View style={s.statsRow}>
            <View style={s.statCell}>
              <Text style={s.statLabel}>{stats[2].label}</Text>
              <Text style={s.statValue}>{stats[2].value}</Text>
            </View>
            <View style={s.statDivV} />
            <View style={[s.statCell, !stats[3].label && { opacity: 0 }]}>
              <Text style={s.statLabel}>{stats[3].label}</Text>
              <Text style={s.statValue}>{stats[3].value}</Text>
            </View>
          </View>
        </View>)}

        {/* Top 5 Late Challans */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Top 5 Late Challans</Text>
          {LATE_CHALLANS.map((item, idx) => (
            <View key={item.id} style={[s.challanRow, idx < LATE_CHALLANS.length - 1 && s.challanBorder]}>
              <Text style={s.challanRank}>{idx + 1}.</Text>
              <Text style={s.challanId}>{item.id}</Text>
              <Text style={s.challanAmt}>{item.amount}</Text>
              <Text style={s.challanDue}>{item.due}</Text>
            </View>
          ))}
        </View>

        {/* Recent Activity */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Recent Activity</Text>
          {([] as any[]).map((item: any, idx: number) => (
            <View key={idx} style={[s.actRow, false && s.actBorder]}>
              <Text style={s.actTxt}>{item.text}</Text>
              <Text style={s.actTime}>{item.time}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Sticky Bottom — Open Register */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          style={s.openRegBtn}
          onPress={() =>
            router.push({ pathname: '/reports/other-taxes-register', params: { tab: activeTab } } as any)
          }
          activeOpacity={0.85}
        >
          <Text style={s.openRegTxt}>Open Register</Text>
        </TouchableOpacity>
      </View>

      <DateRangePickerModal
        visible={showDatePicker}
        fromDate={fromDate}
        toDate={toDate}
        onApply={(f, t) => { if (f && t) { setFromDate(f); setToDate(t); } }}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  iconBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },

  // Date strip
  dateStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  dateStripTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  dateStripActive: { color: COLORS.brandPrimary },

  // Tab bar
  tabBarWrapper: {
    height: 52,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  tabBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 9,
    gap: 8,
  },
  tabPill: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.pageBg,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  tabPillActive: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.cardBg },
  tabTxt:        { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabTxtActive:  { color: COLORS.brandPrimary, fontWeight: '700' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  // Stats card (2×2 grid)
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
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },

  // Generic card
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },

  // Late Challans
  challanRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, gap: 8,
  },
  challanBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  challanRank:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textTertiary, width: 18 },
  challanId:     { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  challanAmt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, width: 52, textAlign: 'right' },
  challanDue:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, width: 68, textAlign: 'right' },

  // Recent Activity
  actRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
  },
  actBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  actTxt:    { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary },
  actTime:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },

  // Bottom sticky bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    paddingBottom: 20,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 6,
  },
  openRegBtn: {
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 15, alignItems: 'center',
  },
  openRegTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white, letterSpacing: 0.3 },
});
