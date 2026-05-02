import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import FormDropdown from '../../src/components/forms/FormDropdown';
import { getWarehouses } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

const ADJ_REASONS = ['Damage', 'Physical Count Correction', 'Expired Goods', 'Theft / Loss', 'Production Consumption', 'Sample / Display', 'Opening Stock Entry', 'Other'];
const WEB = Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any });

function ThemedInput({ style, onFocus: of_, onBlur: ob_, ...props }: React.ComponentProps<typeof TextInput>) {
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

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.searchBox, focused && s.inputFocused]}>
      <Ionicons name="search" size={16} color={COLORS.textTertiary} />
      <TextInput
        style={[s.searchInput, WEB]}
        placeholder={placeholder || 'Search...'}
        placeholderTextColor={COLORS.textTertiary}
        value={value} onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

export default function CreateStockAdjustmentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company } = useAuth();
  const companyGuid = company?.guid;
  const [entryType, setEntryType] = useState<EntryType>('regular');

  // Warehouse data from API
  const [warehouses,        setWarehouses]        = useState<string[]>([]);
  const [whLoading,         setWhLoading]         = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [whDropOpen,        setWhDropOpen]        = useState(false);

  useEffect(() => {
    if (!companyGuid) return;
    setWhLoading(true);
    getWarehouses(companyGuid)
      .then((res: any) => {
        const data: any[] = res?.data ?? [];
        setWarehouses(data.map((w: any) => w.name ?? '').filter(Boolean));
      })
      .catch(() => {})
      .finally(() => setWhLoading(false));
  }, [companyGuid]);

  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [binRack, setBinRack] = useState('');
  const [batchSerial, setBatchSerial] = useState('');
  const [onHandQty] = useState('0'); // read-only
  const [adjQty, setAdjQty] = useState('');
  const [adjReason, setAdjReason] = useState('Damage');
  const [refNote, setRefNote] = useState('');

  const handleSave = () => {
    if (!adjQty) { Alert.alert('Required', 'Please enter adjustment quantity.'); return; }
    Alert.alert('✓ Adjustment Saved', 'Stock adjustment has been recorded.', [{ text: 'OK', onPress: () => router.back() }]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Stock Adjustment</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.form}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search / Select Warehouse */}
          <Text style={s.label}>Warehouse</Text>
          {selectedWarehouse ? (
            <TouchableOpacity
              style={s.selectedWH}
              onPress={() => { setSelectedWarehouse(''); setWarehouseSearch(''); setWhDropOpen(false); }}
              activeOpacity={0.7}
            >
              <Ionicons name="business-outline" size={16} color={COLORS.brandPrimary} />
              <Text style={s.selectedWHTxt}>{selectedWarehouse}</Text>
              <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          ) : (
            <>
              <SearchInput
                value={warehouseSearch}
                onChange={v => { setWarehouseSearch(v); setWhDropOpen(v.length > 0); }}
                placeholder="Search warehouse…"
              />
              {whLoading && <ActivityIndicator size="small" color={COLORS.brandPrimary} style={{ marginTop: 8 }} />}
              {whDropOpen && !whLoading && (
                <View style={s.dropList}>
                  {warehouses
                    .filter(w => w.toLowerCase().includes(warehouseSearch.toLowerCase()))
                    .slice(0, 8)
                    .map((w, idx, arr) => (
                      <TouchableOpacity
                        key={w}
                        style={[s.dropItem, idx === arr.length - 1 && { borderBottomWidth: 0 }]}
                        onPress={() => { setSelectedWarehouse(w); setWarehouseSearch(''); setWhDropOpen(false); }}
                        activeOpacity={0.7}
                      >
                        <Text style={s.dropTxt}>{w}</Text>
                      </TouchableOpacity>
                    ))}
                  {warehouses.filter(w => w.toLowerCase().includes(warehouseSearch.toLowerCase())).length === 0 && (
                    <View style={s.dropItem}>
                      <Text style={[s.dropTxt, { color: COLORS.textTertiary }]}>No warehouses found</Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {/* Bin / Rack + Batch / Serial Picker */}
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Bin / Rack</Text>
              <ThemedInput placeholder="Enter bin/rack" value={binRack} onChangeText={setBinRack} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Batch / Serial Picker</Text>
              <ThemedInput placeholder="Enter batch/serial" value={batchSerial} onChangeText={setBatchSerial} />
            </View>
          </View>

          {/* Current On-hand Qty (read-only) */}
          <Text style={s.label}>Current On-hand Qty</Text>
          <View style={s.readOnly}>
            <Text style={s.readOnlyTxt}>{onHandQty}</Text>
          </View>

          {/* Adjustment Qty + Reason */}
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Adjustment Quantity <Text style={s.star}>*</Text></Text>
              <ThemedInput placeholder="Enter quantity" value={adjQty} onChangeText={setAdjQty} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <FormDropdown
                label="Adjustment Reason"
                required
                value={adjReason}
                options={ADJ_REASONS.map(s => ({ label: s, value: s }))}
                onSelect={o => setAdjReason(o.value)}
                placeholder="Select reason"
              />
            </View>
          </View>

          {/* Reference / Note */}
          <Text style={s.label}>Reference / Note</Text>
          <ThemedInput
            placeholder="Enter reference or note..."
            value={refNote} onChangeText={setRefNote}
            multiline numberOfLines={3}
            style={s.textarea}
          />

          <View style={{ height: 16 }} />
        </ScrollView>

        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={s.saveBtnTxt}>Save Adjustment</Text>
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
  textarea: { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 },
  row2: { flexDirection: 'row', gap: 12 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 4, backgroundColor: COLORS.cardBg,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, paddingVertical: 9 },
  readOnly: {
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 13, backgroundColor: COLORS.pageBg,
  },
  readOnlyTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  selectBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 14, backgroundColor: COLORS.cardBg,
  },
  selectBoxOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  selectTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '600', flex: 1 },
  dropList: {
    borderWidth: 1, borderTopWidth: 0, borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
    borderBottomLeftRadius: RADIUS.md, borderBottomRightRadius: RADIUS.md, overflow: 'hidden',
  },
  dropItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  dropTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  dropTxtActive: { fontWeight: '700' },
  selectedWH:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: COLORS.brandPrimary, borderRadius: RADIUS.md, backgroundColor: COLORS.cardBg },
  selectedWHTxt: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '600' },
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
