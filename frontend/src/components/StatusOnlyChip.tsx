/** Removable "<Status> only" chip for lists opened pre-filtered (e.g. from a notification). */
import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, RADIUS } from '../constants/colors';

export default function StatusOnlyChip({ status, onClear }: { status: string; onClear: () => void }) {
  const { t } = useTranslation();
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <TouchableOpacity testID="status-only-chip" style={s.chip} onPress={onClear} activeOpacity={0.75}>
      <Text style={s.txt}>{t('common.statusOnly', { status: label, defaultValue: `${label} only` })}</Text>
      <Ionicons name="close" size={13} color={COLORS.white} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.brandPrimary,
  },
  txt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.white },
});
