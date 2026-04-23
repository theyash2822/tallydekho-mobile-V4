import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_SALES_REGISTER } from '../../src/data/mockData';

const AMBER    = '#A89060';
const AMBER_BG = '#FDF9F4';
const { width: SW } = Dimensions.get('window');

const STATUS_COLOR: Record<string, string> = {
  paid:        COLORS.positive,
  unpaid:      COLORS.negative,
  irm:         COLORS.textTertiary,
  credit_note: COLORS.warning,
};
const STATUS_LABEL: Record<string, string> = {
  paid:        'Paid',
  unpaid:      'Unpaid',
  irm:         'IRM',
  credit_note: 'Credit Note',
};

export default function SalesRegisterScreen() {
  const router = useRouter();
  const data   = MOCK_SALES_REGISTER;

  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('All');
  const [dropdown, setDropdown] = useState(false);

  const filtered = data.invoices.filter(inv => {
    const matchSearch =
      !search ||
      inv.party.toLowerCase().includes(search.toLowerCase()) ||
      inv.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filter === 'All' || STATUS_LABEL[inv.status] === filter;
    return matchSearch && matchStatus;
  });

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Sales Register</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Filter Row ──────────────────────────────────────────────── */}
      <View style={s.filterRow}>
        {/* Date Range */}
        <TouchableOpacity style={s.datePill} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          <Text style={s.dateTxt}>30 Sep–22 Apr</Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Status Dropdown */}
        <View style={s.statusWrap}>
          <TouchableOpacity
            style={[s.statusPill, dropdown && s.statusPillOpen]}
            onPress={() => setDropdown(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={s.statusTxt}>{filter}</Text>
            <Ionicons
              name={dropdown ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>

          {dropdown && (
            <View style={s.dropMenu}>
              {['All', 'Paid', 'Unpaid'].map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={s.dropItem}
                  activeOpacity={0.7}
                  onPress={() => { setFilter(opt); setDropdown(false); }}
                >
                  <Text style={[s.dropTxt, filter === opt && s.dropTxtActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Overlay to close dropdown */}
      {dropdown && (
        <TouchableOpacity
          style={s.dropOverlay}
          onPress={() => setDropdown(false)}
          activeOpacity={1}
        />
      )}

      {/* ── Search Bar ──────────────────────────────────────────────── */}
      <View style={s.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.textTertiary} />
        <TextInput
          style={s.searchInput}
          placeholder="Search invoices, parties..."
          placeholderTextColor={COLORS.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Stats 2×2 Grid ──────────────────────────────────────────── */}
        <View style={s.statsGrid}>
          {[
            { label: 'Total', value: data.summary.total },
            { label: 'Tax',   value: data.summary.tax   },
            { label: 'AVG',   value: data.summary.avg   },
            { label: 'Docs',  value: String(data.summary.docs) },
          ].map(stat => (
            <View key={stat.label} style={s.statCell}>
              <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Section Header ──────────────────────────────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Sales Invoices</Text>
          <Text style={s.sectionCount}>{filtered.length} records</Text>
        </View>

        {/* ── Invoice List ────────────────────────────────────────────── */}
        <View style={s.listCard}>
          {filtered.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="search-outline" size={32} color={COLORS.textTertiary} />
              <Text style={s.emptyTxt}>No invoices found</Text>
            </View>
          ) : (
            filtered.map((inv, idx) => (
              <View key={inv.id}>
                <TouchableOpacity
                  style={s.invRow}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/document/${inv.id}?type=sales_invoice` as any)}
                >
                  {/* Left: status dot + info */}
                  <View style={s.invLeft}>
                    <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[inv.status] || COLORS.textTertiary }]} />
                    <View style={s.invInfo}>
                      <View style={s.invTopRow}>
                        <Text style={[s.statusLbl, { color: STATUS_COLOR[inv.status] || COLORS.textTertiary }]}>
                          {STATUS_LABEL[inv.status] || inv.status}
                        </Text>
                        <Text style={s.invId}>• {inv.id}</Text>
                      </View>
                      <Text style={s.invParty}>{inv.party}</Text>
                      <Text style={s.invMeta}>{inv.date} | {inv.time}</Text>
                    </View>
                  </View>

                  {/* Right: amount + tally icon */}
                  <View style={s.invRight}>
                    <Text style={s.invAmt}>{inv.amount}</Text>
                    <View style={s.tallyIcon}>
                      <Ionicons name="return-down-back-outline" size={13} color={AMBER} />
                    </View>
                  </View>
                </TouchableOpacity>
                {idx < filtered.length - 1 && <View style={s.divider} />}
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
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
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary,
  },

  // Filter Row
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    zIndex: 20,
  },
  datePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  dateTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  statusWrap: { position: 'relative', zIndex: 100 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.borderDefault, minWidth: 88,
  },
  statusPillOpen: { borderColor: COLORS.brandPrimary },
  statusTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  dropMenu: {
    position: 'absolute', top: 46, right: 0,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault,
    minWidth: 130, zIndex: 200,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 8,
  },
  dropItem: {
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  dropTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
  dropTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  dropOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.cardBg,
    marginHorizontal: SPACING.md, marginTop: SPACING.md,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginHorizontal: SPACING.md, marginTop: SPACING.md,
    gap: 10,
  },
  statCell: {
    width: (SW - SPACING.md * 2 - 10) / 2,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md, padding: 14,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  statValue: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 4 },

  // Section Header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: SPACING.sm,
  },
  sectionTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  sectionCount: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },

  // Invoice List
  listCard: {
    backgroundColor: COLORS.cardBg,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  invRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 10,
  },
  invLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  invInfo: { flex: 1, gap: 3 },
  invTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusLbl: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  invId:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  invParty:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  invMeta:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  invRight:  { alignItems: 'flex-end', gap: 8 },
  invAmt:    { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  tallyIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: AMBER_BG,
    alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: SPACING.md },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTxt:   { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
});
