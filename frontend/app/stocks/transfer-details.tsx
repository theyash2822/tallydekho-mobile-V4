import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const ITEMS = [
  { id: 'I1', name: 'JBL Speaker – BT50', sku: 'JBL-BT50', qty: 20, unit: 'Pcs' },
  { id: 'I2', name: 'USB Type-C Cable 2m', sku: 'USB-C-2M', qty: 50, unit: 'Pcs' },
  { id: 'I3', name: 'HDMI Cable 3m', sku: 'HDMI-3M', qty: 15, unit: 'Pcs' },
];

export default function TransferDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const transferId = params.id as string || 'TRF-0042';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Transfer Details</Text>
        <TouchableOpacity style={s.shareBtn}>
          <Ionicons name="share-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        <View style={s.statusBanner}>
          <View style={s.statusIcon}>
            <Ionicons name="checkmark-circle" size={28} color="#2D7D46" />
          </View>
          <View style={s.statusInfo}>
            <Text style={s.statusTitle}>Transfer Completed</Text>
            <Text style={s.statusSub}>{transferId} · 25 May 2025, 11:34 AM</Text>
          </View>
        </View>

        {/* Route Card */}
        <View style={s.routeCard}>
          <View style={s.routeFrom}>
            <Ionicons name="business-outline" size={20} color={COLORS.textSecondary} />
            <View>
              <Text style={s.routeLabel}>From</Text>
              <Text style={s.routeWH}>Main Warehouse</Text>
              <Text style={s.routeCity}>Mumbai, MH</Text>
            </View>
          </View>
          <View style={s.routeArrow}>
            <Ionicons name="arrow-forward" size={20} color={COLORS.brandPrimary} />
          </View>
          <View style={s.routeTo}>
            <Ionicons name="business-outline" size={20} color={COLORS.textSecondary} />
            <View>
              <Text style={s.routeLabel}>To</Text>
              <Text style={s.routeWH}>Delhi Godown</Text>
              <Text style={s.routeCity}>Delhi, DL</Text>
            </View>
          </View>
        </View>

        {/* Meta Info */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Transfer Info</Text>
          {[
            { label: 'Transfer ID', value: transferId },
            { label: 'Transfer Date', value: '25 May 2025' },
            { label: 'Requested By', value: 'Ravi Kumar' },
            { label: 'Approved By', value: 'Sunil Sharma' },
            { label: 'Mode', value: 'Inter-Godown' },
            { label: 'Status', value: 'Completed' },
          ].map(row => (
            <View key={row.label} style={s.infoRow}>
              <Text style={s.infoLabel}>{row.label}</Text>
              <Text style={[s.infoValue, row.label === 'Status' && { color: '#2D7D46', fontWeight: '700' }]}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Items Transferred */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Items Transferred</Text>
          {ITEMS.map((item, i) => (
            <View key={item.id} style={[s.itemRow, i < ITEMS.length - 1 && s.rowBorder]}>
              <View style={s.itemIcon}>
                <Ionicons name="cube-outline" size={18} color={COLORS.brandPrimary} />
              </View>
              <View style={s.itemInfo}>
                <Text style={s.itemName}>{item.name}</Text>
                <Text style={s.itemSku}>{item.sku}</Text>
              </View>
              <View style={s.itemQty}>
                <Text style={s.itemQtyVal}>{item.qty}</Text>
                <Text style={s.itemQtyUnit}>{item.unit}</Text>
              </View>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={s.totalLbl}>Total Items Transferred</Text>
            <Text style={s.totalVal}>{ITEMS.length} SKUs / {ITEMS.reduce((a, i) => a + i.qty, 0)} units</Text>
          </View>
        </View>

        {/* Notes */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Narration</Text>
          <Text style={s.narration}>Inter-godown transfer for Delhi warehouse restock. All items verified and packed securely.</Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  shareBtn: { width: 40, alignItems: 'flex-end' },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, margin: SPACING.md, backgroundColor: '#F0FBF4', borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: '#BBF7D0' },
  statusIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#2D7D46' },
  statusSub: { fontSize: TYPOGRAPHY.xs, color: '#4ADE80', marginTop: 2 },
  routeCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  routeFrom: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  routeArrow: { paddingHorizontal: 10 },
  routeTo: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  routeLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textTertiary, textTransform: 'uppercase' },
  routeWH: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  routeCity: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  card: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  infoLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  infoValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  itemIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  itemSku: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  itemQty: { alignItems: 'flex-end' },
  itemQtyVal: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary },
  itemQtyUnit: { fontSize: 10, color: COLORS.textTertiary },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 6 },
  totalLbl: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary },
  totalVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  narration: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 22 },
});
