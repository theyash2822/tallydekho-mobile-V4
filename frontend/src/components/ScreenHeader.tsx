/**
 * Locked screen header — circular back button, centered title, optional right slot.
 * Matches Sales / Purchase / Expense hub chrome.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/colors';

export type ScreenHeaderProps = {
  title: string;
  onBack?: () => void;
  /** Custom left slot (e.g. close in selection mode). Overrides onBack. */
  left?: React.ReactNode;
  right?: React.ReactNode;
  style?: ViewStyle;
};

export function ScreenHeader({ title, onBack, left, right, style }: ScreenHeaderProps) {
  return (
    <View style={[s.header, style]}>
      {left ?? (
        onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={s.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={s.sideSlot} />
        )
      )}
      <Text style={s.title} numberOfLines={1}>{title}</Text>
      {right ?? <View style={s.sideSlot} />}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideSlot: { width: 36, height: 36 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
