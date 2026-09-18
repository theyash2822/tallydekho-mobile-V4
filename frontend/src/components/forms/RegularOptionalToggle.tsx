import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY, RADIUS } from '../../constants/colors';

export type EntryType = 'regular' | 'optional';
export type WorkspaceEntryMode = 'OPTIONAL_ONLY' | 'REGULAR_ONLY' | 'BOTH';

interface Props {
  value: EntryType;
  onChange: (v: EntryType) => void;
  /** Workspace RBAS Entry Mode — locks/hides options when not BOTH */
  entryMode?: WorkspaceEntryMode;
}

export function defaultEntryTypeForMode(mode?: WorkspaceEntryMode): EntryType {
  if (mode === 'OPTIONAL_ONLY') return 'optional';
  return 'regular';
}

export function entryTypeAllowed(mode: WorkspaceEntryMode | undefined, type: EntryType): boolean {
  if (!mode || mode === 'BOTH') return true;
  if (mode === 'OPTIONAL_ONLY') return type === 'optional';
  if (mode === 'REGULAR_ONLY') return type === 'regular';
  return true;
}

export default function RegularOptionalToggle({ value, onChange, entryMode = 'BOTH' }: Props) {
  if (entryMode === 'OPTIONAL_ONLY' || entryMode === 'REGULAR_ONLY') {
    // Locked to a single mode — show read-only chip
    const locked: EntryType = entryMode === 'OPTIONAL_ONLY' ? 'optional' : 'regular';
    return (
      <View style={s.wrap}>
        <View style={[s.btn, locked === 'regular' ? s.regActive : s.optActive]}>
          <Text style={[s.txt, s.activeTxt]}>{locked === 'regular' ? 'REG' : 'OPT'}</Text>
        </View>
      </View>
    );
  }

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
