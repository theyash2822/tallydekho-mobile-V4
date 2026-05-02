import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getWarehouseDetail } from '../../src/services/api';
import { ErrorBanner } from '../../src/components/ApiStateViews';

const DIR_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  inward:  { icon: 'arrow-down-outline',        color: COLORS.positive, bg: COLORS.positiveBg },
  outward: { icon: 'arrow-up-outline',           color: COLORS.negative, bg: COLORS.negativeBg },
  transfer:{ icon: 'swap-horizontal-outline',    color: COLORS.info,     bg: COLORS.infoBg },
};

const VOUCHER_ICON: Record<string, string> = {
  'Sales Invoice': 'arrow-up-outline',
  'Purchase Invoice': 'arrow-down-outline',
  'Sales': 'arrow-up-outline',
  'Purchase': 'arrow-down-outline',
  'Payment': 'send-outline',
  'Receipt': 'download-outline',
};

export default function WarehouseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const { company } = useAuth();
  const companyGuid = company?.guid;

  const [wh, setWh] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const load = () => {
    if (!companyGuid || !params.id) return;
    setIsLoading(true);
    setApiError(null);
    getWarehouseDetail(companyGuid, params.id)
      .then((res: any) => { if (res?.data) setWh(res.data); })
      .catch((err: any) => setApiError(err?.message || 'Failed to load warehouse'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, [companyGuid, params.id]);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          {wh?.name || params.name || 'Warehouse Detail'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {apiError && <ErrorBanner message={apiError} onRetry={load} />}

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.brandPrimary} />
        </View>
      ) : !wh ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="business-outline" size={48} color={COLORS.textTertiary} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.textSecondary, marginTop: 12 }}>
            Warehouse not found
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* Info Card */}
          <View style={s.infoCard}>
            <View style={s.infoRow}>
              <Ionicons name="business-outline" size={18} color={COLORS.textSecondary} />
              <Text style={s.infoLabel}>Name</Text>
              <Text style={s.infoValue}>{wh.name}</Text>
            </View>
            {!!wh.parent && (
              <View style={s.infoRow}>
                <Ionicons name="git-branch-outline" size={18} color={COLORS.textSecondary} />
                <Text style={s.infoLabel}>Group</Text>
                <Text style={s.infoValue}>{wh.parent}</Text>
              </View>
            )}
            {!!wh.address && (
              <View style={s.infoRow}>
                <Ionicons name="location-outline" size={18} color={COLORS.textSecondary} />
                <Text style={s.infoLabel}>Address</Text>
                <Text style={s.infoValue}>{wh.address}</Text>
              </View>
            )}
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statValue}>{Math.round(wh.total_qty).toLocaleString('en-IN')}</Text>
              <Text style={s.statLabel}>Net Qty</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statValue}>{wh.skus}</Text>
              <Text style={s.statLabel}>Stock Items</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statValue}>{wh.activity?.length || 0}</Text>
              <Text style={s.statLabel}>Transactions</Text>
            </View>
          </View>

          {/* Recent Activity */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Recent Activity</Text>
            <Text style={s.sectionCount}>{wh.activity?.length || 0} entries</Text>
          </View>

          {(!wh.activity || wh.activity.length === 0) ? (
            <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
              <Ionicons name="document-text-outline" size={40} color={COLORS.textTertiary} />
              <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>No stock activity yet</Text>
            </View>
          ) : (
            <View style={s.activityCard}>
              {wh.activity.map((a: any, idx: number) => {
                const dir = DIR_CONFIG[a.direction] || DIR_CONFIG.outward;
                const icon = VOUCHER_ICON[a.type] || dir.icon;
                return (
                  <View key={idx}>
                    <View style={s.actRow}>
                      <View style={[s.actIcon, { backgroundColor: dir.bg }]}>
                        <Ionicons name={icon as any} size={16} color={dir.color} />
                      </View>
                      <View style={s.actInfo}>
                        <Text style={s.actType}>{a.type || a.direction}</Text>
                        <Text style={s.actStock} numberOfLines={1}>{a.stock_name}</Text>
                        <Text style={s.actDate}>{a.date} · {a.ref}</Text>
                      </View>
                      <Text style={[s.actQty, { color: a.direction === 'inward' ? COLORS.positive : COLORS.negative }]}>
                        {a.direction === 'inward' ? '+' : '-'}{Math.abs(a.qty).toLocaleString('en-IN')}
                      </Text>
                    </View>
                    {idx < wh.activity.length - 1 && <View style={s.divider} />}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.pageBg },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  shareBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  infoCard:     { backgroundColor: COLORS.cardBg, margin: SPACING.md, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault, gap: 12 },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel:    { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, width: 70 },
  infoValue:    { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  statsRow:     { flexDirection: 'row', gap: 10, marginHorizontal: SPACING.md, marginBottom: SPACING.md },
  statCard:     { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  statValue:    { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  statLabel:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 4 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: SPACING.md, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  sectionCount: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  activityCard: { backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  actRow:       { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: 12 },
  actIcon:      { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  actInfo:      { flex: 1, gap: 2 },
  actType:      { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  actStock:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  actDate:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  actQty:       { fontSize: TYPOGRAPHY.base, fontWeight: '700' },
  divider:      { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 62 },
});
