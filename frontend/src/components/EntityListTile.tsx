/**
 * Locked entity row — avatar + name (+ optional subtitle) + amount / trailing.
 * Used for Sales parties, Purchase vendors, Expense categories, Ledger list,
 * Cash register, Stock lists.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, RADIUS } from '../constants/colors';

export type EntityListTileProps = {
  name: string;
  amount?: string;
  /** Secondary line under name (e.g. ledger group). */
  subtitle?: string;
  /** Extra line under subtitle (e.g. GSTIN). */
  meta?: string;
  /** Replaces amount on the right (e.g. Cr/Dr badge block). */
  trailing?: React.ReactNode;
  /** Custom avatar content; default = first letter. */
  avatar?: React.ReactNode;
  avatarBgColor?: string;
  /** Default 22 (circle). Use RADIUS.md for stock-style tiles. */
  avatarRadius?: number;
  /** Renders above the main row inside the card (e.g. Fast/Slow badge). */
  headerExtra?: React.ReactNode;
  /** Renders below the main row inside the card (e.g. stats grid). */
  footer?: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  alignTop?: boolean;
  borderRadius?: number;
  style?: ViewStyle;
  testID?: string;
};

export function EntityListTile({
  name,
  amount,
  subtitle,
  meta,
  trailing,
  avatar,
  avatarBgColor,
  avatarRadius,
  headerExtra,
  footer,
  selected,
  onPress,
  onLongPress,
  delayLongPress,
  alignTop,
  borderRadius = RADIUS.md,
  style,
  testID,
}: EntityListTileProps) {
  const initial = (name || '?').charAt(0).toUpperCase();

  const body = (
    <View
      testID={testID}
      style={[
        s.card,
        { borderRadius },
        alignTop && s.cardAlignTop,
        selected && s.cardSelected,
        style,
      ]}
    >
      {headerExtra}
      <View style={[s.row, alignTop && s.rowAlignTop]}>
        <View style={[
          s.avatar,
          avatarRadius != null ? { borderRadius: avatarRadius } : null,
          avatarBgColor ? { backgroundColor: avatarBgColor } : null,
          selected && s.avatarSelected,
        ]}>
          {selected ? (
            <Ionicons name="checkmark" size={20} color={COLORS.white} />
          ) : avatar ? (
            avatar
          ) : (
            <Text style={s.avatarTxt}>{initial}</Text>
          )}
        </View>
        <View style={s.info}>
          <Text style={s.name} numberOfLines={1}>{name || '—'}</Text>
          {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          {meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : null}
        </View>
        {trailing != null ? (
          trailing
        ) : amount != null ? (
          <Text style={s.amount}>{amount}</Text>
        ) : null}
      </View>
      {footer}
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={delayLongPress}
      >
        {body}
      </TouchableOpacity>
    );
  }
  return body;
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    gap: 10,
  },
  cardAlignTop: {},
  cardSelected: {
    borderColor: COLORS.brandPrimary,
    borderWidth: 2,
    backgroundColor: COLORS.brandPrimary + '08',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowAlignTop: { alignItems: 'flex-start' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarSelected: {
    backgroundColor: COLORS.brandPrimary,
  },
  avatarTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  subtitle: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  meta: { fontSize: 10, color: COLORS.positive, marginTop: 1, fontWeight: '500' },
  amount: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
});
