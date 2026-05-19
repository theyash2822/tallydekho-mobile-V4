import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { useAuth } from '../../src/context/AuthContext';
import { getEWBStatus } from '../../src/services/api';
import { fyInfoToParam } from '../../src/context/AuthContext';



export default function EWBComplianceScreen() {
  const router = useRouter();
  const { company, selectedFY } = useAuth();
  const [fromDate,       setFromDate]       = useState('');
  const [toDate,         setToDate]         = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [ewbStatus,      setEwbStatus]      = useState<any>(null);
  const [loading,        setLoading]        = useState(true);

  const isDateActive = fromDate.length > 0 && toDate.length > 0;

  useEffect(() => {
    if (!company?.guid) return;
    setLoading(true);
    const fyParam = fyInfoToParam(selectedFY);
    getEWBStatus(company.guid, fyParam ? { fy: fyParam } : {})
      .then((res: any) => { if (res?.data) setEwbStatus(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [company?.guid, selectedFY]);

  const generatedCount  = ewbStatus?.generated_count  ?? 0;
  const pendingCount    = ewbStatus?.pending_count     ?? 0;
  const expiringCount   = ewbStatus?.expiring_count    ?? 0;
  const errorCount      = ewbStatus?.error_count       ?? 0;
  const isConnected     = ewbStatus?.integration_connected ?? false;
  const transportBreakdown = ewbStatus?.transport_breakdown ?? [];
  const hasAnyData      = generatedCount > 0;

  return (
    <SafeAreaView style={s.safe}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>E-Way Bill</Text>
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
          {isDateActive ? `${fromDate}  →  ${toDate}` : 'All Dates'}
        </Text>
        {!isDateActive && <Ionicons name="chevron-down" size={11} color={COLORS.textTertiary} />}
        {isDateActive && (
          <TouchableOpacity onPress={() => { setFromDate(''); setToDate(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={COLORS.brandPrimary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* ── Empty State: no EWBs + portal not connected ── */}
        {!loading && !hasAnyData && !isConnected && (
          <View style={s.emptyState}>
            <Ionicons name="document-outline" size={56} color={COLORS.borderStrong} />
            <Text style={s.emptyTitle}>No E-Way Bills Found</Text>
            <Text style={s.emptyMsg}>
              Connect your E-Way Bill portal in Settings to view and manage E-Way Bills.
            </Text>
          </View>
        )}

        {/* ── Empty State: portal connected but no EWBs yet ── */}
        {!loading && !hasAnyData && isConnected && (
          <View style={s.emptyState}>
            <Ionicons name="cloud-done-outline" size={56} color={COLORS.brandPrimary} />
            <Text style={s.emptyTitle}>Portal Connected</Text>
            <Text style={s.emptyMsg}>No E-Way Bills generated yet for this period.</Text>
          </View>
        )}

        {/* ── Real data (generated > 0) ── */}
        {hasAnyData && (
          <>
            {/* Stats 2×2 grid */}
            <View style={s.statsCard}>
              <View style={s.statsRow}>
                <View style={s.statCell}>
                  <Text style={s.statLabel}>Pending Gen</Text>
                  <Text style={s.statValue}>{pendingCount}</Text>
                </View>
                <View style={s.statDivV} />
                <View style={s.statCell}>
                  <Text style={s.statLabel}>Errors</Text>
                  <Text style={[s.statValue, { color: '#DC2626' }]}>{errorCount}</Text>
                </View>
              </View>
              <View style={s.statDivH} />
              <View style={s.statsRow}>
                <View style={s.statCell}>
                  <Text style={s.statLabel}>Expiring {'<'}24h</Text>
                  <Text style={[s.statValue, { color: '#D97706' }]}>{expiringCount}</Text>
                </View>
                <View style={s.statDivV} />
                <View style={s.statCell}>
                  <Text style={s.statLabel}>Generated</Text>
                  <Text style={[s.statValue, { color: '#2D7D46' }]}>{generatedCount}</Text>
                </View>
              </View>
            </View>

            {/* Generated CTA */}
            <TouchableOpacity
              style={s.generatedBtn}
              onPress={() => router.push('/reports/ewb-list' as any)}
              activeOpacity={0.85}
            >
              <Text style={s.generatedBtnTxt}>Generated  {generatedCount}</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
            </TouchableOpacity>

            {/* Transport Mode (real data) */}
            {transportBreakdown.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Transport Mode</Text>
                <View style={s.modesGrid}>
                  {transportBreakdown.map((tm: any) => (
                    <View key={tm.mode} style={s.modeCell}>
                      <Text style={s.modeName}>{tm.mode}</Text>
                      <Text style={s.modeCount}>{tm.count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* View Details — opens portal */}
            <TouchableOpacity
              style={s.viewDetailsBtn}
              onPress={() => Linking.openURL('https://ewaybillgst.gov.in/')}
              activeOpacity={0.85}
            >
              <Text style={s.viewDetailsTxt}>View on Portal</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

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
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
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
    paddingVertical: 9, backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  dateStripTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },

  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 80, paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary,
    marginTop: 16, textAlign: 'center',
  },
  emptyMsg: {
    fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary,
    marginTop: 8, textAlign: 'center', lineHeight: 20,
  },
  dateStripActive: { color: COLORS.brandPrimary },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  // Stats
  statsCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    marginBottom: SPACING.sm, overflow: 'hidden',
  },
  statsRow: { flexDirection: 'row' },
  statCell: { flex: 1, paddingHorizontal: SPACING.md, paddingVertical: 14 },
  statDivV: { width: 1, backgroundColor: COLORS.borderDefault },
  statDivH: { height: 1, backgroundColor: COLORS.borderDefault },
  statLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500', marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },

  // Generated CTA
  generatedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 15, marginBottom: SPACING.sm,
  },
  generatedBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white, letterSpacing: 0.5 },

  // Card
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },

  // Donut layout
  donutRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendList: { flex: 1, gap: 8 },
  legendItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 3, paddingHorizontal: 6, borderRadius: 6,
  },
  legendItemActive: { backgroundColor: COLORS.pageBg },
  legendDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  legendLbl: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  legendPct: { fontSize: TYPOGRAPHY.sm, fontWeight: '800' },

  // Tooltip (shared for both charts)
  tooltip: {
    marginTop: 12, borderLeftWidth: 3, borderLeftColor: COLORS.brandPrimary,
    paddingLeft: 10, paddingVertical: 9,
    backgroundColor: COLORS.pageBg, borderRadius: 6,
  },
  tooltipTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },

  // Transport
  modesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeCell: {
    width: '47%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.md, paddingVertical: 12,
  },
  modeName:  { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textSecondary },
  modeCount: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary },

  // Activity
  actRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
  },
  actBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  actTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary, flex: 1 },
  actTime:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },

  // View Details
  viewDetailsBtn: {
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 15, alignItems: 'center', marginBottom: SPACING.sm,
  },
  viewDetailsTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white, letterSpacing: 0.2 },
});
