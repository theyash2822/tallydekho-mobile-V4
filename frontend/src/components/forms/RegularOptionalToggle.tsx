import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY, RADIUS } from '../../constants/colors';

export type EntryType = 'regular' | 'optional';

interface Props {
  value: EntryType;
  onChange: (v: EntryType) => void;
}

export default function RegularOptionalToggle({ value, onChange }: Props) {
  return (
    <View style={s.wrap}>
      <TouchableOpacity
        style={[s.btn, value === 'regular' && s.regActive]}
        onPress={() => onChange('regular')}
        activeOpacity={0.8}
      >
        <Text style={[s.txt, value === 'regular' && s.activeTxt]}>REG</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.btn, value === 'optional' && s.optActive]}
        onPress={() => onChange('optional')}
        activeOpacity={0.8}
      >
        <Text style={[s.txt, value === 'optional' && s.activeTxt]}>OPT</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    overflow: 'hidden',
    backgroundColor: COLORS.pageBg,
  },
  btn: { paddingHorizontal: 10, paddingVertical: 5 },
  txt: { fontSize: 10, fontWeight: '800', color: COLORS.textTertiary, letterSpacing: 0.5 },
  regActive: { backgroundColor: COLORS.brandPrimary },
  optActive: { backgroundColor: '#D97706' },
  activeTxt: { color: '#fff' },
});
