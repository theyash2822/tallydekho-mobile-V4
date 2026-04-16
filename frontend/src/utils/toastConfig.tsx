import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ToastConfig } from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, RADIUS, SPACING } from '../constants/colors';

// ── Shared toast card ─────────────────────────────────────────────────────────
function ToastCard({
  icon,
  iconColor,
  bg,
  text1,
  text2,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  bg: string;
  text1?: string;
  text2?: string;
}) {
  return (
    <View style={[ts.card, { backgroundColor: bg }]}>
      <View style={ts.iconWrap}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={ts.textWrap}>
        {text1 ? <Text style={ts.title} numberOfLines={1}>{text1}</Text> : null}
        {text2 ? <Text style={ts.sub}   numberOfLines={2}>{text2}</Text> : null}
      </View>
    </View>
  );
}

// ── Toast type configs ────────────────────────────────────────────────────────
export const toastConfig: ToastConfig = {
  // ── success — brandPrimary (#1A1A1A) background ──
  success: ({ text1, text2 }) => (
    <ToastCard
      icon="checkmark-circle"
      iconColor={COLORS.white}
      bg={COLORS.brandPrimary}
      text1={text1}
      text2={text2}
    />
  ),

  // ── error — red background ──
  error: ({ text1, text2 }) => (
    <ToastCard
      icon="close-circle"
      iconColor={COLORS.white}
      bg={COLORS.negative}
      text1={text1}
      text2={text2}
    />
  ),

  // ── info — warm grey ──
  info: ({ text1, text2 }) => (
    <ToastCard
      icon="information-circle"
      iconColor={COLORS.white}
      bg={COLORS.textSecondary}
      text1={text1}
      text2={text2}
    />
  ),
};

// ── Styles ────────────────────────────────────────────────────────────────────
const ts = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.lg,
    gap: 12,
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  iconWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '700',
    color: COLORS.white, marginBottom: 1,
  },
  sub: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '400',
    color: 'rgba(255,255,255,0.80)',
  },
});
