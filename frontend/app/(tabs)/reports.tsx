import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import Header from '../../src/components/Header';
import { getReports } from '../../src/services/api';
import { MOCK_REPORTS } from '../../src/data/mockData';

const REPORT_SECTIONS = [
  {
    id: 'financial',
    title: 'Financial Reports',
    icon: 'trending-up-outline',
    items: [
      { id: 'pl', label: 'Profit & Loss', icon: 'analytics-outline', desc: 'Income, expenses & net profit' },
      { id: 'bs', label: 'Balance Sheet', icon: 'scale-outline', desc: 'Assets, liabilities & equity' },
      { id: 'tb', label: 'Trial Balance', icon: 'list-outline', desc: 'Debit & credit balances' },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance',
    icon: 'shield-checkmark-outline',
    items: [
      { id: 'gst', label: 'GST Filing', icon: 'receipt-outline', desc: 'IGST, CGST, SGST summary' },
      { id: 'eway', label: 'E-Way Bills', icon: 'car-outline', desc: '265 generated, 33 pending' },
      { id: 'einvoice', label: 'E-Invoicing', icon: 'document-text-outline', desc: 'IRN generation & status' },
      { id: 'othertax', label: 'Other Taxes', icon: 'cash-outline', desc: 'TDS, TCS, Excise, VAT' },
    ],
  },
  {
    id: 'audit',
    title: 'Audit & Logs',
    icon: 'search-outline',
    items: [
      { id: 'trail', label: 'Audit Trail', icon: 'time-outline', desc: 'All user actions & changes' },
      { id: 'daybook', label: 'Day Book', icon: 'calendar-outline', desc: 'Daily transaction summary' },
    ],
  },
  {
    id: 'ai',
    title: 'AI Insights',
    icon: 'bulb-outline',
    items: [
      { id: 'insights', label: 'AI Financial Insights', icon: 'sparkles-outline', desc: 'Smart analysis & recommendations' },
    ],
  },
];

export default function ReportsScreen() {
  const [reports, setReports] = useState(MOCK_REPORTS);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { getReports().then((d: any) => setReports(d)); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const d = await getReports() as any;
    setReports(d);
    setRefreshing(false);
  };

  return (
    <SafeAreaView testID="reports-screen" style={styles.safe}>
      <Header companyName="Reports" />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
      >
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{reports.salesSummary.today}</Text>
            <Text style={styles.summaryLabel}>Today's Sales</Text>
            <Text style={styles.summaryGrowth}>▲ 12%</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{reports.salesSummary.mtd}</Text>
            <Text style={styles.summaryLabel}>MTD Sales</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{reports.salesSummary.ytd}</Text>
            <Text style={styles.summaryLabel}>YTD Sales</Text>
          </View>
        </View>

        {/* E-way Bills Quick Stats */}
        <View testID="eway-stats" style={styles.ewayCard}>
          <View style={styles.ewayHeader}>
            <Ionicons name="car-outline" size={18} color={COLORS.textPrimary} />
            <Text style={styles.ewayTitle}>E-Way Bills</Text>
            <Text style={styles.ewayFy}>FY 2025-26</Text>
          </View>
          <View style={styles.ewayStats}>
            {[
              { label: 'Generated', value: reports.ewayBills.generated, color: COLORS.positive },
              { label: 'Pending', value: reports.ewayBills.pending, color: COLORS.warning },
              { label: 'Errors', value: reports.ewayBills.errors, color: COLORS.negative },
              { label: 'Expiring', value: reports.ewayBills.expiring, color: COLORS.info },
            ].map(stat => (
              <View key={stat.label} style={styles.ewayStat}>
                <Text style={[styles.ewayStatValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.ewayStatLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Report Sections */}
        {REPORT_SECTIONS.map(section => (
          <View key={section.id} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon as any} size={16} color={COLORS.textSecondary} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <View key={item.id}>
                  <TouchableOpacity
                    testID={`report-${item.id}`}
                    style={styles.reportItem}
                    activeOpacity={0.7}
                  >
                    <View style={styles.reportIconBox}>
                      <Ionicons name={item.icon as any} size={18} color={COLORS.textSecondary} />
                    </View>
                    <View style={styles.reportInfo}>
                      <Text style={styles.reportLabel}>{item.label}</Text>
                      <Text style={styles.reportDesc}>{item.desc}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
                  </TouchableOpacity>
                  {idx < section.items.length - 1 && <View style={styles.itemSep} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  scroll: { flex: 1 },
  summaryRow: { flexDirection: 'row', gap: 8, padding: SPACING.md },
  summaryCard: {
    flex: 1, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  summaryValue: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  summaryLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },
  summaryGrowth: { fontSize: TYPOGRAPHY.xs, color: COLORS.positive, marginTop: 2, fontWeight: '600' },
  ewayCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md, marginBottom: SPACING.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  ewayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  ewayTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  ewayFy: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  ewayStats: { flexDirection: 'row', justifyContent: 'space-between' },
  ewayStat: { alignItems: 'center' },
  ewayStatValue: { fontSize: TYPOGRAPHY.xl, fontWeight: '700' },
  ewayStatLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  section: { marginBottom: SPACING.sm },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.md, paddingVertical: 8,
  },
  sectionTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCard: {
    backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden',
  },
  reportItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
  },
  reportIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center',
  },
  reportInfo: { flex: 1 },
  reportLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  reportDesc: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  itemSep: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 66 },
});
