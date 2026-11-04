/**
 * Choice controls for Settings → E-Invoice / E-Way Bill / GST: a Yes / No pair for the questions that decide
 * whether a rule applies, and radio rows for the behaviour choices (one-line explanation under each).
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, RADIUS } from '../../constants/colors';

export function YesNo({ value, onChange, disabled, testID }: {
  value: boolean | null | undefined; onChange: (v: boolean) => void; disabled?: boolean; testID?: string;
}) {
  const { t } = useTranslation();
  return (
    <View style={s.pair} testID={testID}>
      {([[true, t('common.yes')], [false, t('common.no')]] as const).map(([v, label]) => {
        const on = value === v;
        return (
          <TouchableOpacity
            key={String(v)}
            style={[s.chip, on && s.chipOn, disabled && { opacity: 0.5 }]}
            onPress={() => { if (!on) onChange(v); }}
            disabled={disabled}
            activeOpacity={0.7}
            testID={testID ? `${testID}-${v ? 'yes' : 'no'}` : undefined}
          >
            <Text style={[s.chipTxt, on && s.chipTxtOn]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function OptionRow({ selected, title, help, onPress, disabled, testID }: {
  selected: boolean; title: string; help?: string; onPress: () => void; disabled?: boolean; testID?: string;
}) {
  return (
    <TouchableOpacity
      style={[s.row, selected && s.rowOn, disabled && { opacity: 0.5 }]}
      onPress={() => { if (!selected) onPress(); }}
      disabled={disabled}
      activeOpacity={0.75}
      testID={testID}
    >
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={18} color={selected ? COLORS.brandPrimary : COLORS.textTertiary} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {help ? <Text style={s.rowHelp}>{help}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  pair: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  chip: { minWidth: 64, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  chipOn: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  chipTxtOn: { color: COLORS.white },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, paddingHorizontal: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, marginBottom: 8 },
  rowOn: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.pageBg },
  rowTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  rowHelp: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2, lineHeight: 16 },
});
