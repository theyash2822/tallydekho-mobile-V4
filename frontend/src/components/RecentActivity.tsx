import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';

interface Activity {
  id: string;
  type: string;
  description: string;
  time: string;
  isUser: boolean;
  avatar?: string;
}

interface RecentActivityProps {
  activities: Activity[];
  onSeeAll?: () => void;
}

const ActivityItem: React.FC<{ item: Activity }> = ({ item }) => (
  <View testID={`activity-item-${item.id}`} style={styles.item}>
    {item.isUser ? (
      <View style={styles.iconBox}>
        <Ionicons name="document-text-outline" size={16} color={COLORS.textSecondary} />
      </View>
    ) : (
      <View style={[styles.avatarBox]}>
        <Text style={styles.avatarText}>{item.avatar?.charAt(0) || 'U'}</Text>
      </View>
    )}
    <Text style={[styles.description, { flex: 1 }]} numberOfLines={1}>
      {item.description}
    </Text>
    <Text style={styles.time}>{item.time}</Text>
  </View>
);

const RecentActivity: React.FC<RecentActivityProps> = ({ activities, onSeeAll }) => (
  <View testID="recent-activity" style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.title}>Recent Activity</Text>
      <TouchableOpacity testID="see-all-activity" onPress={onSeeAll} activeOpacity={0.7}>
        <Text style={styles.seeAll}>See all</Text>
      </TouchableOpacity>
    </View>
    <View style={styles.card}>
      {activities.map((item, idx) => (
        <View key={item.id}>
          <ActivityItem item={item} />
          {idx < activities.length - 1 && <View style={styles.sep} />}
        </View>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  seeAll: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.positive,
    fontWeight: '500',
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 13,
    gap: 10,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.activeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  description: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.textPrimary,
    fontWeight: '400',
    flex: 1,
  },
  time: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.positive,
    fontWeight: '500',
  },
  sep: {
    height: 1,
    backgroundColor: COLORS.borderDefault,
    marginLeft: 58,
  },
});

export default RecentActivity;
