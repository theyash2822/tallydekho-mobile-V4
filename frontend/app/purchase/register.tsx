import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_PURCHASE_REGISTER } from '../../src/data/mockData';

const STATUS_COLORS: Record<string, string> = {
  paid:   COLORS.positive,
  unpaid: COLORS.negative,
  irm:    '#9CA3AF',
};

const STATUS_LABELS: Record<string, string> = {
  paid:   'Paid',
  unpaid: 'Unpaid',
  irm:    'IRM',
};

export default function PurchaseRegisterScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const data = MOCK_PURCHASE_REGISTER;

  const filtered = data.invoices.filter(
    inv =>
      !search ||
      inv.vendor.toLowerCase().includes(search.toLowerCase()) ||
      inv.id.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Purchase Register</Text>
        <TouchableOpacity style={styles.headerAction}>
          <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── Filters ────────────────────────────────────────────── */}
        <View style={styles.filterRow}>
          <TouchableOpacity style={[styles.dropdown, { flex: 1.4 }]}>
            <Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} />
            <Text style={styles.dropdownText}>June 25</Text>
            <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdown}>
            <Text style={styles.dropdownText}>Status</Text>
            <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdown}>
            <Text style={styles.dropdownText}>FY 2025-26</Text>
            <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Search ─────────────────────────────────────────────── */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search invoices, vendors..."
            placeholderTextColor={COLORS.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Stats Row ──────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          {[
            { label: 'Total', value: data.summary.total },
            { label: 'Tax',   value: data.summary.tax },
            { label: 'Avg',   value: data.summary.avg },
            { label: 'Docs',  value: String(data.summary.docs) },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                {s.value}
              </Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Today Summary Banner ────────────────────────────────── */}
        <View style={styles.todayBanner}>
          <View>
            <Text style={styles.todayLabel}>Today's Purchases</Text>
            <Text style={styles.todayAmount}>₹74,500</Text>
          </View>
          <View style={styles.todayBadge}>
            <Ionicons name="trending-up" size={12} color={COLORS.positive} />
            <Text style={styles.todayChange}>+8.7%</Text>
          </View>
        </View>

        {/* ── Invoice List ────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Purchase Invoices</Text>
          <TouchableOpacity style={styles.menuBtn}>
            <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.invoiceContainer}>
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={32} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>No invoices found</Text>
            </View>
          ) : (
            filtered.map((inv, idx) => (
              <View key={inv.id}>
                <TouchableOpacity
                  style={styles.invoiceRow}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/document/${inv.id}?type=sales_invoice` as any)}
                >
                  <View style={styles.invLeft}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: STATUS_COLORS[inv.status] || '#9CA3AF' },
                      ]}
                    />
                    <View style={styles.invInfo}>
                      <View style={styles.invTopRow}>
                        <Text
                          style={[
                            styles.statusLabel,
                            { color: STATUS_COLORS[inv.status] || '#9CA3AF' },
                          ]}
                        >
                          {STATUS_LABELS[inv.status] || inv.status}
                        </Text>
                        <Text style={styles.invoiceId}>{inv.id}</Text>
                      </View>
                      <Text style={styles.vendorName}>{inv.vendor}</Text>
                      <Text style={styles.invMeta}>{inv.date} · {inv.time}</Text>
                    </View>
                  </View>
                  <View style={styles.invRight}>
                    <Text style={styles.invAmount}>{inv.amount}</Text>
                    <View style={styles.viewBtn}>
                      <Ionicons name="eye-outline" size={13} color={COLORS.info} />
                      <Text style={styles.viewBtnText}>Preview</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                {idx < filtered.length - 1 && <View style={styles.divider} />}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle:  { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  headerAction: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scroll:       { flex: 1 },

  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md,
  },
  dropdown: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    paddingHorizontal: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.borderDefault, flex: 1,
  },
  dropdownText: { flex: 1, fontSize: 12, color: COLORS.textSecondary },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    marginHorizontal: SPACING.md, marginTop: SPACING.sm,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchInput:  { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },

  statsRow:     { flexDirection: 'row', gap: 8, marginHorizontal: SPACING.md, marginTop: SPACING.md },
  statCard: {
    flex: 1, backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  statValue:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  statLabel:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },

  todayBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    marginHorizontal: SPACING.md, marginTop: SPACING.sm,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  todayLabel:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginBottom: 3 },
  todayAmount: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  todayBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: COLORS.positiveBg, borderRadius: RADIUS.full,
  },
  todayChange: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.positive },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: SPACING.sm,
  },
  sectionTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  menuBtn:      { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  invoiceContainer: {
    backgroundColor: COLORS.cardBg,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  invoiceRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    gap: 12,
  },
  invLeft:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  statusDot:    { width: 9, height: 9, borderRadius: 5, marginTop: 4 },
  invInfo:      { flex: 1, gap: 3 },
  invTopRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusLabel:  { fontSize: TYPOGRAPHY.xs, fontWeight: '600' },
  invoiceId:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  vendorName:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  invMeta:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  invRight:     { alignItems: 'flex-end', gap: 8 },
  invAmount:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: COLORS.infoBg, borderRadius: RADIUS.md,
  },
  viewBtnText: { fontSize: TYPOGRAPHY.xs, color: COLORS.info, fontWeight: '600' },
  divider:      { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 16 },

  emptyState:   { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText:    { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
});
