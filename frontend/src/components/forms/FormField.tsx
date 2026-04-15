import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, ViewStyle, Platform } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';

interface Props extends TextInputProps {
  label: string;
  required?: boolean;
  hint?: string;
  containerStyle?: ViewStyle;
}

export default function FormField({ label, required, hint, containerStyle, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.wrap, containerStyle]}>
      <Text style={s.label}>
        {label}
        {required ? <Text style={s.star}> *</Text> : null}
      </Text>
      <TextInput
        style={[
          s.input,
          rest.editable === false ? s.readOnly : null,
          focused && s.inputFocused,
          style as any,
        ]}
        placeholderTextColor={COLORS.textTertiary}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e)  => { setFocused(false); onBlur?.(e); }}
        {...rest}
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },
  label: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  star: { color: COLORS.negative },
  input: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: TYPOGRAPHY.base,
    color: COLORS.textPrimary,
    minHeight: 48,
    // Suppress browser blue outline on web
    ...Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }),
  },
  inputFocused: {
    borderColor: COLORS.brandPrimary,
    borderWidth: 1.5,
  },
  readOnly: { backgroundColor: COLORS.pageBg, color: COLORS.textSecondary },
  hint: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 4 },
});
