/**
 * Locked outer card for Recent voucher rows (wraps VoucherListTile).
 */
import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../constants/colors';

export type ListTileShellProps = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  activeOpacity?: number;
};

export function ListTileShell({
  children,
  onPress,
  style,
  activeOpacity = 0.7,
}: ListTileShellProps) {
  return (
    <TouchableOpacity
      style={[s.shell, style]}
      activeOpacity={activeOpacity}
      onPress={onPress}
      disabled={!onPress}
    >
      {children}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  shell: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
});
