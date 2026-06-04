import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, TextInput, ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { createWarehouse, getWarehouses } from '../../src/services/api';

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
  const { company, isPaired } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  // Form fields — only what Tally needs
  const [name,    setName]    = useState('');
  const [parent,  setParent]  = useState('');
  const [address, setAddress] = useState('');

  // Parent autocomplete
  const [warehouseNames, setWarehouseNames] = useState<string[]>(['Primary']);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = warehouseNames.filter(w =>
    w.toLowerCase().includes(parent.toLowerCase()) && w !== parent
  );

  // Load existing warehouses for parent autocomplete
  useEffect(() => {
    if (!company?.guid) return;
    getWarehouses(company.guid).then((res: any) => {
      const names: string[] = (res?.data ?? []).map((w: any) => w.name).filter(Boolean);
      // Always include Primary at top
      const all = ['Primary', ...names.filter(n => n !== 'Primary')];
      setWarehouseNames(all);
    }).catch(() => {});
  }, [company?.guid]);

  const handleSave = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Name Required', text2: 'Please enter a warehouse name.' });
      return;
    }
    if (!isPaired) {
      Toast.show({ type: 'error', text1: 'Not Paired', text2: 'Please pair with Tally Desktop first.' });
      return;
    }
    try {
      setSubmitting(true);
      await createWarehouse({
        companyGuid:  company?.guid,
        companyName:  company?.name,
        name:         name.trim(),
        parentGodown: parent.trim() || 'Primary',
        address:      address.trim() || undefined,
      });
      Toast.show({ type: 'success', text1: 'Warehouse Created', text2: `"${name}" sent to Tally successfully.` });
      setTimeout(() => router.back(), 1200);
    } catch (err: any) {
      const raw = err?.message || '';
      // Give user-friendly message for common Tally errors
      const msg = raw.includes('does not exist')
        ? `Parent godown not found in Tally. Leave Parent empty or enter an exact godown name from Tally.`
        : raw.includes('timeout')
        ? 'Tally not responding. Make sure Tally Prime is open.'
        : raw || 'Could not create warehouse.';
      Toast.show({ type: 'error', text1: 'Failed', text2: msg });
    } finally {
      setSubmitting(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header — no RegularOptionalToggle */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Add Warehouse</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.form}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name — required */}
          <Text style={s.label}>Warehouse Name <Text style={s.star}>*</Text></Text>
          <ThemedInput
            placeholder="e.g. Delhi Warehouse"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <Text style={s.hint}>This name will be created as a Godown in Tally</Text>

          {/* Parent — with autocomplete */}
          <Text style={s.label}>Parent Godown</Text>
          <View style={{ position: 'relative', zIndex: 10 }}>
            <ThemedInput
              placeholder="Leave empty for top-level warehouse"
              value={parent}
              onChangeText={v => { setParent(v); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <View style={s.suggestions}>
                {suggestions.slice(0, 6).map(w => (
                  <TouchableOpacity
                    key={w}
                    style={s.suggestionItem}
                    onPress={() => { setParent(w); setShowSuggestions(false); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="business-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={s.suggestionTxt}>{w}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <Text style={s.hint}>Leave empty for a top-level warehouse. Type to search existing godowns as parent.</Text>

          {/* Address — optional */}
          <Text style={s.label}>Address <Text style={s.optional}>(optional)</Text></Text>
          <ThemedInput
            placeholder="e.g. Plot 42, Industrial Area, Delhi"
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={3}
            style={s.textarea}
          />

          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[s.saveBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={submitting}
          >
            {submitting && <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 8 }} />}
            <Text style={s.saveBtnTxt}>{submitting ? 'Saving...' : 'Create Warehouse'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.pageBg },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  form:        { padding: SPACING.md },
  label:       { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, marginTop: 20 },
  star:        { color: COLORS.negative },
  optional:    { fontSize: TYPOGRAPHY.xs, fontWeight: '400', color: COLORS.textTertiary },
  hint:        { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 6 },
  input:       { borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, backgroundColor: COLORS.cardBg },
  inputFocused:{ borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  textarea:    { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },

  // Autocomplete
  suggestions:    { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, marginTop: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 6, zIndex: 999 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  suggestionTxt:  { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },

  footer:    { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  saveBtn:   { backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  saveBtnTxt:{ fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
