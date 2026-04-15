import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';

interface RackRow { id: string; rack: string; label: string; }
const WEB = Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any });

function ThemedInput({
  style, onFocus: of_, onBlur: ob_, ...props
}: React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[s.input, focused && s.inputFocused, WEB, style]}
      placeholderTextColor={COLORS.textTertiary}
      onFocus={e => { setFocused(true); of_?.(e); }}
      onBlur={e => { setFocused(false); ob_?.(e); }}
      {...props}
    />
  );
}

export default function CreateWarehouseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [entryType, setEntryType] = useState<EntryType>('regular');

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [racks, setRacks] = useState<RackRow[]>([]);
  const [newRack, setNewRack] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [narration, setNarration] = useState('');

  const addRack = () => {
    if (!newRack.trim()) return;
    setRacks(prev => [...prev, { id: Date.now().toString(), rack: newRack.trim(), label: newLabel.trim() }]);
    setNewRack('');
    setNewLabel('');
  };

  const removeRack = (id: string) => setRacks(prev => prev.filter(r => r.id !== id));

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Required', 'Warehouse name is required.'); return; }
    Alert.alert('✓ Warehouse Saved', `"${name}" has been created.`, [{ text: 'OK', onPress: () => router.back() }]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Add Warehouse</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.form}
          keyboardShouldPersistTaps="handled"
        >
          {/* Warehouse Code */}
          <Text style={s.label}>Warehouse Code <Text style={s.star}>*</Text></Text>
          <ThemedInput placeholder="Add Code" value={code} onChangeText={setCode} />

          {/* Name */}
          <Text style={s.label}>Name <Text style={s.star}>*</Text></Text>
          <ThemedInput placeholder="Add Name" value={name} onChangeText={setName} />

          {/* Phone + Email */}
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Phone Number</Text>
              <ThemedInput placeholder="Enter Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Email</Text>
              <ThemedInput placeholder="Enter Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>

          {/* Address */}
          <Text style={s.label}>Address</Text>
          <ThemedInput
            placeholder="Enter full address"
            value={address} onChangeText={setAddress}
            multiline numberOfLines={3}
            style={s.textarea}
          />

          {/* Zip Code */}
          <Text style={s.label}>Zip Code</Text>
          <ThemedInput placeholder="Zip Code" value={zipCode} onChangeText={setZipCode} keyboardType="numeric" />

          {/* Racks */}
          <Text style={s.label}>Racks</Text>
          {racks.map(r => (
            <View key={r.id} style={s.rackRow}>
              <View style={[s.rackInput, { flex: 1 }]}>
                <Text style={s.rackVal}>{r.rack}</Text>
              </View>
              <View style={[s.rackInput, { flex: 1 }]}>
                <Text style={s.rackVal}>{r.label || '—'}</Text>
              </View>
              <TouchableOpacity style={s.rackDel} onPress={() => removeRack(r.id)} activeOpacity={0.7}>
                <Ionicons name="close" size={16} color={COLORS.negative} />
              </TouchableOpacity>
            </View>
          ))}
          {/* New rack entry row */}
          <View style={s.rackRow}>
            <TextInput
              style={[s.rackInput, { flex: 1 }, WEB]}
              placeholder="Enter Racks"
              placeholderTextColor={COLORS.textTertiary}
              value={newRack}
              onChangeText={setNewRack}
            />
            <TextInput
              style={[s.rackInput, { flex: 1 }, WEB]}
              placeholder="Enter Label"
              placeholderTextColor={COLORS.textTertiary}
              value={newLabel}
              onChangeText={setNewLabel}
            />
            <TouchableOpacity style={s.rackAdd} onPress={addRack} activeOpacity={0.7}>
              <Ionicons name="add" size={18} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Narration */}
          <Text style={s.label}>Narration</Text>
          <ThemedInput
            placeholder="Enter Narration"
            value={narration} onChangeText={setNarration}
            multiline numberOfLines={3}
            style={s.textarea}
          />

          <View style={{ height: 16 }} />
        </ScrollView>

        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={s.saveBtnTxt}>Save</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  form: { padding: SPACING.md },
  label: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: 8, marginTop: 16 },
  star: { color: COLORS.negative },
  input: {
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: TYPOGRAPHY.base,
    color: COLORS.textPrimary, backgroundColor: COLORS.cardBg,
  },
  inputFocused: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  textarea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  row2: { flexDirection: 'row', gap: 12 },
  // Racks
  rackRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  rackInput: {
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: TYPOGRAPHY.base,
    color: COLORS.textPrimary, backgroundColor: COLORS.cardBg,
  },
  rackVal: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '600' },
  rackDel: {
    width: 36, height: 44, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.negativeBg, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.negative + '30',
  },
  rackAdd: {
    width: 36, height: 44, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  footer: {
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg,
  },
  saveBtn: {
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 15, alignItems: 'center',
  },
  saveBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
