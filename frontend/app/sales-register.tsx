import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../src/constants/colors';
import { getSalesInvoices } from '../src/services/api';

type InvoiceStatus = 'all' | 'pending_irn' | 'generated';

interface Invoice {
  id: string;
  party: string;
  amount: string;
  date: string;
  status: string;
  dueDate: string;
}

const STATUS_FILTERS: { key: InvoiceStatus; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'pending_irn', label: 'Pending IRN' },
  { key: 'generated',   label: 'IRN Generated' },
];

export default function SalesRegisterScreen() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [activeFilter, setActiveFilter] = useState<InvoiceStatus>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const res = await getSalesInvoices() as any;
    setInvoices(res.invoices || []);
    setPendingCount(res.pending_irn_count || 0);
    setTotal(res.total || 0);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filtered = activeFilter === 'all'
    ? invoices
    : invoices.filter(i => i.status === activeFilter);

  const renderItem = ({ item }: { item: Invoice }) => {
    const isPending = item.status === 'pending_irn';
    return (
      <TouchableOpacity style={styles.invoiceCard} activeOpacity={0.75}>
        {/* Top row */}
        <View style={styles.invoiceHeader}>
          <Text style={styles.invoiceId}>{item.id}</Text>
          <View style={[styles.statusBadge, isPending ? styles.badgePending : styles.badgeGenerated]}>
            <Text style={[styles.statusText, isPending ? styles.statusPending : styles.statusGenerated]}>
              {isPending ? 'Pending IRN' : 'IRN Generated'}
            </Text>
          </View>
        </View>

        {/* Party name */}
        <Text style={styles.partyName}>{item.party}</Text>

        {/* Bottom row */}
        <View style={styles.invoiceFooter}>
          <View style={styles.footerItem}>
            <Ionicons name="calendar-outline" size={13} color={COLORS.textTertiary} />
            <Text style={styles.footerText}>{item.date}</Text>
          </View>
          <View style={styles.footerItem}>
            <Ionicons name="time-outline" size={13} color={COLORS.textTertiary} />
            <Text style={styles.footerText}>Due {item.dueDate}</Text>
          </View>
          <Text style={styles.invoiceAmount}>{item.amount}</Text>
        </View>

        {/* Generate IRN CTA for pending */}
        {isPending && (
          <TouchableOpacity style={styles.generateBtn} activeOpacity={0.8}>
            <Ionicons name="flash-outline" size={13} color={COLORS.white} />
            <Text style={styles.generateBtnText}>Generate IRN</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sales Register</Text>
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.7}>
          <Ionicons name="add" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, styles.statCardWarning]}>
          <View style={styles.statCardInner}>
            <Ionicons name="warning-outline" size={14} color="#D97706" />
            <Text style={[styles.statValue, { color: '#D97706' }]}>{pendingCount}</Text>
          </View>
          <Text style={styles.statLabel}>Pending IRN</Text>
        </View>
        <View style={[styles.statCard, styles.statCardSuccess]}>
          <Text style={[styles.statValue, { color: COLORS.positive }]}>{total - pendingCount}</Text>
          <Text style={styles.statLabel}>Generated</Text>
        </View>
      </View>

      {/* IRN Alert Banner */}
      {pendingCount > 0 && (
        <View style={styles.irnBanner}>
          <Ionicons name="warning-outline" size={15} color="#D97706" />
          <Text style={styles.irnBannerText}>
            {pendingCount} invoice{pendingCount > 1 ? 's' : ''} pending IRN generation
          </Text>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, activeFilter === f.key && styles.filterTabActive]}
            onPress={() => setActiveFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, activeFilter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Invoice List */}
      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={COLORS.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>No invoices found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  statCard: {
    flex: 1, backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md, padding: 12,
    alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  statCardWarning: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  statCardSuccess: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  statCardInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },

  // IRN Banner
  irnBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#FDE68A',
  },
  irnBannerText: { fontSize: TYPOGRAPHY.sm, color: '#92400E', fontWeight: '500' },

  // Filters
  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.pageBg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  filterTabActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  filterText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  filterTextActive: { color: COLORS.white, fontWeight: '700' },

  // List
  listContent: { padding: SPACING.md, gap: 12, paddingBottom: 100 },

  // Invoice Card
  invoiceCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    gap: 8,
  },
  invoiceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  invoiceId: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgeGenerated: { backgroundColor: COLORS.positiveBg },
  statusText: { fontSize: TYPOGRAPHY.xs, fontWeight: '600' },
  statusPending: { color: '#D97706' },
  statusGenerated: { color: COLORS.positive },
  partyName: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  invoiceFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  invoiceAmount: { marginLeft: 'auto', fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.md, alignSelf: 'flex-start',
    marginTop: 4,
  },
  generateBtnText: { fontSize: TYPOGRAPHY.sm, color: COLORS.white, fontWeight: '700' },

  // States
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: TYPOGRAPHY.base, color: COLORS.textTertiary },
});
