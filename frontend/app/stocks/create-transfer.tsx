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
const RACKS = ['Rack A-1', 'Rack A-2', 'Rack B-1', 'Rack B-2', 'Bay 12', 'Bay 14', 'Bin C-3'];
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

export default function CreateStockTransferScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company } = useAuth();
  const companyGuid = company?.guid;
  const [entryType, setEntryType] = useState<EntryType>('regular');

  // Warehouses from API
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
  const [sourceRack, setSourceRack] = useState('');
  const [onHandQty, setOnHandQty] = useState('');
  const [batchSerial, setBatchSerial] = useState('');
  const [destWarehouse, setDestWarehouse] = useState('');
  const [destRack, setDestRack] = useState('');
  const [qtyToTransfer, setQtyToTransfer] = useState('');
  const [narration, setNarration] = useState('');

  const filteredWH = warehouses.filter(w =>
    !warehouseSearch || w.toLowerCase().includes(warehouseSearch.toLowerCase())
  );

  const handleTransfer = () => {
    if (!destWarehouse) { Alert.alert('Required', 'Please select a destination warehouse.'); return; }
    if (!qtyToTransfer) { Alert.alert('Required', 'Please enter quantity to transfer.'); return; }
    Alert.alert('✓ Transfer Done', 'Stock transfer has been initiated successfully.', [{ text: 'OK', onPress: () => router.back() }]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Stock Transfer</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.form}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search / Select Source Warehouse */}
          <Text style={s.label}>Source Warehouse</Text>
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
                placeholder="Search source warehouse…"
              />
              {whLoading && <ActivityIndicator size="small" color={COLORS.brandPrimary} style={{ marginTop: 8 }} />}
              {whDropOpen && !whLoading && (
                <View style={s.dropList}>
                  {filteredWH.slice(0, 8).map((w, idx, arr) => (
                    <TouchableOpacity
                      key={w}
                      style={[s.dropItem, idx === arr.length - 1 && { borderBottomWidth: 0 }]}
                      onPress={() => { setSelectedWarehouse(w); setWarehouseSearch(''); setWhDropOpen(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={s.dropTxt}>{w}</Text>
                    </TouchableOpacity>
                  ))}
                  {filteredWH.length === 0 && (
                    <View style={s.dropItem}>
                      <Text style={[s.dropTxt, { color: COLORS.textTertiary }]}>No warehouses found</Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {/* Source Rack */}
          <FormDropdown
            label="Source Rack"
            value={sourceRack}
            options={RACKS.map(s => ({ label: s, value: s }))}
            placeholder="Select rack"
            onSelect={o => setSourceRack(o.value)}
          />

          {/* On-hand Qty + Batch / Serial Picker */}
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>On-hand Qty</Text>
              <ThemedInput placeholder="Enter quantity" value={onHandQty} onChangeText={setOnHandQty} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Batch / Serial Picker</Text>
              <ThemedInput placeholder="Enter batch no." value={batchSerial} onChangeText={setBatchSerial} />
            </View>
          </View>

          {/* Destination Warehouse */}
          <FormDropdown
            label="Destination Warehouse"
            required
            value={destWarehouse}
            options={warehouses.map(s => ({ label: s, value: s }))}
            placeholder="Select warehouse"
            onSelect={o => setDestWarehouse(o.value)}
          />

          {/* Destination Rack + Qty to Transfer */}
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <FormDropdown
                label="Destination Rack"
                value={destRack}
                options={RACKS.map(s => ({ label: s, value: s }))}
                placeholder="Select rack"
                onSelect={o => setDestRack(o.value)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Quantity to Transfer <Text style={s.star}>*</Text></Text>
              <ThemedInput placeholder="Enter quantity" value={qtyToTransfer} onChangeText={setQtyToTransfer} keyboardType="numeric" />
            </View>
          </View>

          {/* Narration */}
          <Text style={s.label}>Narration</Text>
          <ThemedInput
            placeholder="Enter transfer notes..."
            value={narration} onChangeText={setNarration}
            multiline numberOfLines={3}
            style={s.textarea}
          />

          <View style={{ height: 16 }} />
        </ScrollView>

        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={s.saveBtn} onPress={handleTransfer} activeOpacity={0.85}>
            <Text style={s.saveBtnTxt}>Transfer</Text>
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
