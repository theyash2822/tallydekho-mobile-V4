import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';
import { useSettings } from '../context/SettingsContext';

// Supports both the legacy mock shape AND the new API shape
interface Activity {
  id: string;
  type: string;
  // API shape
  guid?: string | null;
  route?: string | null;
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
  title?: string;
  onSeeAll?: () => void;
}

const ActivityItem: React.FC<{ item: Activity; onPress: () => void }> = ({ item, onPress }) => {
  const { formatAmountCompact } = useSettings();
  // Prefer API shape, fall back to legacy shape
  const title  = item.label       ?? item.description ?? '';
  const sub    = item.party       ?? '';
  const timing = item.date        ?? item.time        ?? '';
  const isCredit = item.type === 'credit' || (item as any).is_credit === true;
  const isDebit  = item.type === 'debit';
  // Use raw amount if available, otherwise fall back to pre-formatted string
  const amount = (item as any).amount_raw != null
    ? (isCredit ? '+' : '-') + formatAmountCompact((item as any).amount_raw)
    : (item.amount ?? '');

  // Derive avatar initial: from party or avatar field
  const initial = (item.party?.[0] ?? item.avatar?.[0] ?? 'T').toUpperCase();

  return (
    <TouchableOpacity
      testID={`activity-item-${item.id}`}
      style={styles.item}
      onPress={onPress}
      disabled={!(item.guid || item.route)}
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

const RecentActivity: React.FC<RecentActivityProps> = ({ activities, title = 'Recent Activity' }) => {
  const router = useRouter();
  const safeActivities = Array.isArray(activities) ? activities : [];
  const displayed = safeActivities.slice(0, 6);

  const handlePress = (item: Activity) => {
    if (item.route) {
      router.push(item.route as any);
      return;
    }
    if (!item.guid) return;
    router.push(`/document/${item.guid}` as any);
  };

  return (
    <View testID="recent-activity" style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>{title}</Text>
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
