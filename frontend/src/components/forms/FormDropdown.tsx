import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  StyleSheet, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';

export interface DropdownOption { label: string; value: string; }

interface Props {
  label: string;
  value: string;
  options: DropdownOption[];
  onSelect: (opt: DropdownOption) => void;
  placeholder?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
  disabled?: boolean;
}

export default function FormDropdown({
  label, value, options, onSelect,
  placeholder = 'Select...', required, containerStyle, disabled
}: Props) {
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const selected = options.find(o => o.value === value);

  return (
    <View style={[s.wrap, containerStyle]}>
      <Text style={s.label}>
        {label}
        {required ? <Text style={s.star}> *</Text> : null}
      </Text>
      <TouchableOpacity
        style={[s.btn, disabled && s.btnDisabled]}
        onPress={() => !disabled && setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={[s.btnTxt, !value && s.placeholder]} numberOfLines={1}>
          {selected?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setVisible(false)} />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>{label}</Text>
          <FlatList
            data={options}
            keyExtractor={item => item.value}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.option, item.value === value && s.optionActive]}
                onPress={() => { onSelect(item); setVisible(false); }}
                activeOpacity={0.7}
              >
                <Text style={[s.optionTxt, item.value === value && s.optionActiveTxt]}>
                  {item.label}
                </Text>
                {item.value === value ? (
                  <Ionicons name="checkmark" size={18} color={COLORS.brandPrimary} />
                ) : null}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={s.sep} />}
          />
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },
  label: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  star: { color: COLORS.negative },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48,
  },
  btnDisabled: { backgroundColor: COLORS.pageBg },
  btnTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, flex: 1, marginRight: 8 },
  placeholder: { color: COLORS.textTertiary },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '65%', paddingTop: 12,
  },
  handle: { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, paddingHorizontal: SPACING.md, marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14 },
  optionActive: { backgroundColor: COLORS.pageBg },
  optionTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  optionActiveTxt: { fontWeight: '700', color: COLORS.brandPrimary },
  sep: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: SPACING.md },
});
