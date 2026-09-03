import React from 'react';
import { Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, RADIUS } from '../constants/colors';

export type ViewAllButtonProps = {
  label: string;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
  variant?: 'pill' | 'inline';
};

export function ViewAllButton({ label, onPress, style, testID, variant = 'pill' }: ViewAllButtonProps) {
  if (variant === 'inline') {
    return (
      <TouchableOpacity
        testID={testID}
        style={[s.inlineBtn, style]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={s.inlineTxt}>{label}</Text>
        <Ionicons name="chevron-forward" size={14} color={COLORS.textPrimary} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      testID={testID}
      style={[s.btn, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={s.txt}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={COLORS.textPrimary} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    alignSelf: 'center',
    marginTop: 4,
    minWidth: 150,
  },
  txt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  inlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  inlineTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
});
