import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';

// Supports both the legacy mock shape AND the new API shape
interface Activity {
  id: string;
  type: string;
  // API shape
  label?: string;
  amount?: string;
  date?: string;
  party?: string;
  // Legacy mock shape
  description?: string;
  time?: string;
  isUser?: boolean;
  avatar?: string;
}

interface RecentActivityProps {
  activities: Activity[];
  onSeeAll?: () => void;
}

// ── Map activity label prefix → voucher type ─────────────────────────────────
function resolveVoucherType(label: string = ''): string {
  const l = label.toLowerCase();
  if (l.startsWith('sales invoice'))    return 'receivable_invoice';
  if (l.startsWith('purchase invoice')) return 'payable_invoice';
  if (l.startsWith('purchase order'))   return 'payable_invoice';
  if (l.startsWith('payment received')) return 'receipt';
  if (l.startsWith('expense voucher'))  return 'payment';
  if (l.startsWith('bank transfer'))    return 'journal';
  if (l.startsWith('credit note'))      return 'credit_note';
  if (l.startsWith('debit note'))       return 'debit_note';
  if (l.startsWith('delivery note'))    return 'delivery_note';
  if (l.startsWith('contra'))           return 'contra';
  return 'payment';
}

// Extract voucher number from label like "Sales Invoice #INV-2847"
function extractVoucherNo(label: string = ''): string {
  const match = label.match(/#([A-Z0-9\-]+)/i);
  return match ? match[1] : '';
}

const ActivityItem: React.FC<{ item: Activity; onPress: () => void }> = ({ item, onPress }) => {
  // Prefer API shape, fall back to legacy shape
  const title  = item.label       ?? item.description ?? '';
  const sub    = item.party       ?? '';
  const timing = item.date        ?? item.time        ?? '';
  const amount = item.amount      ?? '';
  const isCredit = item.type === 'credit';
  const isDebit  = item.type === 'debit';

  // Derive avatar initial: from party or avatar field
  const initial = (item.party?.[0] ?? item.avatar?.[0] ?? 'T').toUpperCase();

  return (
    <TouchableOpacity
      testID={`activity-item-${item.id}`}
      style={styles.item}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Icon / Avatar */}
      {isCredit || isDebit ? (
        <View style={[styles.txIcon, isCredit ? styles.txIconCredit : styles.txIconDebit]}>
          <Ionicons
            name={isCredit ? 'arrow-down' : 'arrow-up'}
            size={15}
            color={isCredit ? COLORS.positive : COLORS.negative}
          />
        </View>
      ) : item.isUser ? (
        <View style={styles.iconBox}>
          <Ionicons name="document-text-outline" size={16} color={COLORS.textSecondary} />
        </View>
      ) : (
        <View style={styles.avatarBox}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      )}

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
      </View>

      {/* Right: amount + time */}
      <View style={styles.right}>
        {amount ? (
          <Text style={[styles.amount, isCredit ? styles.amountCredit : isDebit ? styles.amountDebit : {}]}>
            {amount}
          </Text>
        ) : null}
        <Text style={styles.time}>{timing}</Text>
      </View>
    </TouchableOpacity>
  );
};

const RecentActivity: React.FC<RecentActivityProps> = ({ activities }) => {
  const router = useRouter();
  const displayed = activities.slice(0, 6);

  const handlePress = (item: Activity) => {
    const label      = item.label ?? item.description ?? '';
    const voucherType = resolveVoucherType(label);
    const voucherNumber = extractVoucherNo(label);
    // Strip sign prefix from amount ("+₹18,400" → "₹18,400")
    const cleanAmount = (item.amount ?? '').replace(/^[+\-]/, '');

    router.push({
      pathname: '/voucher/preview' as any,
      params: {
        type:          voucherType,
        voucherNumber: voucherNumber,
        date:          item.date ?? item.time ?? '',
        party:         item.party ?? '',
        paidTo:        item.party ?? '',
        receivedFrom:  item.party ?? '',
        customer:      item.party ?? '',
        supplier:      item.party ?? '',
        amount:        cleanAmount,
        narration:     '\u2014',
      },
    });
  };

  return (
    <View testID="recent-activity" style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
      </View>
      <View style={styles.card}>
        {displayed.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={28} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No recent activity</Text>
          </View>
        ) : (
          displayed.map((item, idx) => (
            <View key={item.id}>
              <ActivityItem item={item} onPress={() => handlePress(item)} />
              {idx < displayed.length - 1 && <View style={styles.sep} />}
            </View>
          ))
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginHorizontal: SPACING.md, marginBottom: SPACING.md },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  sectionTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  seeAll: { fontSize: TYPOGRAPHY.sm, color: COLORS.brandPrimary, fontWeight: '600' },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 13, gap: 10,
  },
  // Credit/debit icon
  txIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  txIconCredit: { backgroundColor: COLORS.pageBg },
  txIconDebit:  { backgroundColor: COLORS.pageBg },
  // Legacy icon/avatar
  iconBox: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarBox: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.activeBg,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  // Body
  body: { flex: 1, gap: 2 },
  title: { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary },
  sub:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  // Right
  right: { alignItems: 'flex-end', gap: 3 },
  amount: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  amountCredit: { color: COLORS.positive },
  amountDebit:  { color: COLORS.negative },
  time: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  sep:  { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 58 },
  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
});

export default RecentActivity;
