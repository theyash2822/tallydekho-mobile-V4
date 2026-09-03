import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/colors';

export type TxnListRowProps = {
  icon: string;
  title: string;
  refLabel?: string;
  subtitle: string;
  amount: string;
  onPress?: () => void;
  showBorder?: boolean;
  style?: ViewStyle;
};

export function TxnListRow({
  icon,
  title,
  refLabel,
  subtitle,
  amount,
  onPress,
  showBorder = true,
  style,
}: TxnListRowProps) {
  const body = (
    <View style={[s.row, showBorder && s.border, style]}>
      <View style={s.iconBox}>
        <Ionicons name={icon as any} size={17} color={COLORS.textSecondary} />
      </View>
      <View style={s.info}>
        <View style={s.topRow}>
          <Text style={s.mode}>{title}</Text>
          {refLabel ? <Text style={s.ref}> · {refLabel}</Text> : null}
        </View>
        <Text style={s.sub} numberOfLines={1}>{subtitle}</Text>
      </View>
      <View style={s.right}>
        <Text style={s.amt}>{amount}</Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {body}
      </TouchableOpacity>
    );
  }
  return body;
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    gap: 10,
  },
  border: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  mode: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  ref: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  sub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  right: { alignItems: 'flex-end', flexShrink: 0 },
  amt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
});
