import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, KeyboardAvoidingView, Platform,
  LayoutAnimation, UIManager, Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import BrandSwitch from '../../src/components/forms/BrandSwitch';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AMBER = '#A89060';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Warehouse {
  id: string;
  name: string;
  location: string;
  code: string;
  cycleFreq: string;
  archiveMonths: string;
}

interface AlertChannels {
  inApp: boolean;
  email: boolean;
  wa: boolean;
}

interface AddWarehouseForm {
  name: string;
  location: string;
  code: string;
  cycleFreq: string;
  archiveMonths: string;
  narration: string;
  racks: string[];
  contactName: string;
  contactMobile: string;
  contactEmail: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const INITIAL_WAREHOUSES: Warehouse[] = [
  { id: 'wh1', name: 'Evermore Distribution', location: 'New Delhi, India', code: 'JPR-MAIN', cycleFreq: 'Weekly', archiveMonths: '24' },
  { id: 'wh2', name: 'Brightstar Logistics', location: 'Mumbai, India', code: 'MUM-001', cycleFreq: 'Monthly', archiveMonths: '12' },
  { id: 'wh3', name: 'Clearview Supply', location: 'Bangalore, India', code: 'BLR-002', cycleFreq: 'Quarterly', archiveMonths: '36' },
];

const UOM_OPTIONS = ['Pieces', 'Kilogram', 'Meters', 'Liters', 'Grams', 'Boxes', 'Units'];
const CYCLE_OPTIONS = ['Daily', 'Weekly', 'Monthly', 'Quarterly'];

const BLANK_FORM: AddWarehouseForm = {
  name: '', location: '', code: '', cycleFreq: 'Weekly', archiveMonths: '24',
  narration: '', racks: [''], contactName: '', contactMobile: '', contactEmail: '',
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function StockSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Accordion state
  const [openSections, setOpenSections] = useState({
    general: true, warehouse: false, items: false, alerts: false,
  });

  // ── General
  const [reorderBuffer, setReorderBuffer] = useState('7');
  const [archiveLedger, setArchiveLedger]  = useState('24');
  const [defaultUom, setDefaultUom]        = useState('Pieces');
  const [uomOpen, setUomOpen]              = useState(false);

  // ── Warehouse
  const [warehouses, setWarehouses]         = useState<Warehouse[]>(INITIAL_WAREHOUSES);
  const [expandedWh, setExpandedWh]         = useState<string | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addForm, setAddForm]               = useState<AddWarehouseForm>(BLANK_FORM);

  // ── Items
  const [batchTracking, setBatchTracking]   = useState(false);
  const [expiryTracking, setExpiryTracking] = useState(false);
  const [allowNegative, setAllowNegative]   = useState(false);
  const [defaultReorder, setDefaultReorder] = useState('20');
  const [itemsUom, setItemsUom]             = useState('Pieces');
  const [itemsUomOpen, setItemsUomOpen]     = useState(false);

  // ── Alerts
  const [lowStockCh, setLowStockCh]   = useState<AlertChannels>({ inApp: true,  email: false, wa: false });
  const [negStockCh, setNegStockCh]   = useState<AlertChannels>({ inApp: true,  email: true,  wa: false });
  const [expiryDays, setExpiryDays]   = useState('30');
  const [expiryCh, setExpiryCh]       = useState<AlertChannels>({ inApp: true,  email: false, wa: false });

  // ── Toast handled by react-native-toast-message (global in _layout.tsx)

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const toggleSection = (key: keyof typeof openSections) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleWh = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedWh(prev => (prev === id ? null : id));
  };

  const updateWarehouse = (id: string, field: keyof Warehouse, val: string) => {
    setWarehouses(prev => prev.map(w => (w.id === id ? { ...w, [field]: val } : w)));
  };

  const toggleChannel = (
    setter: React.Dispatch<React.SetStateAction<AlertChannels>>,
    key: keyof AlertChannels,
  ) => setter(prev => ({ ...prev, [key]: !prev[key] }));

  const addRack = () => setAddForm(f => ({ ...f, racks: [...f.racks, ''] }));
  const updateRack = (i: number, val: string) => {
    const r = [...addForm.racks]; r[i] = val;
    setAddForm(f => ({ ...f, racks: r }));
  };
  const removeRack = (i: number) => {
    const r = addForm.racks.filter((_, idx) => idx !== i);
    setAddForm(f => ({ ...f, racks: r.length ? r : [''] }));
  };

  const showToast = (msg: string) => {
    Toast.show({ type: 'success', text1: msg });
  };

  const handleAddWarehouse = () => {
    if (!addForm.name.trim()) return;
    const newWh: Warehouse = {
      id: `wh${Date.now()}`,
      name: addForm.name.trim(),
      location: addForm.location.trim() || 'India',
      code: addForm.code.trim(),
      cycleFreq: addForm.cycleFreq,
      archiveMonths: addForm.archiveMonths || '24',
    };
    setWarehouses(prev => [...prev, newWh]);
    setAddForm(BLANK_FORM);
    setAddModalVisible(false);
    // Auto-expand warehouse section
    if (!openSections.warehouse) {
      setOpenSections(prev => ({ ...prev, warehouse: true }));
    }
  };

  // ─── Render channel chips (inline helper – NOT a component) ─────────────────
  const renderChips = (
    channels: AlertChannels,
    setter: React.Dispatch<React.SetStateAction<AlertChannels>>,
  ) => (
    <View style={s.chipRow}>
      <TouchableOpacity
        style={[s.chip, channels.inApp && s.chipActive]}
        onPress={() => toggleChannel(setter, 'inApp')}
        activeOpacity={0.7}
      >
        <Ionicons name="notifications-outline" size={12} color={channels.inApp ? '#fff' : COLORS.textSecondary} />
        <Text style={[s.chipText, channels.inApp && s.chipTextActive]}>In-app</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.chip, channels.email && s.chipActive]}
        onPress={() => toggleChannel(setter, 'email')}
        activeOpacity={0.7}
      >
        <Ionicons name="mail-outline" size={12} color={channels.email ? '#fff' : COLORS.textSecondary} />
        <Text style={[s.chipText, channels.email && s.chipTextActive]}>Email</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.chip, channels.wa && s.chipActive]}
        onPress={() => toggleChannel(setter, 'wa')}
        activeOpacity={0.7}
      >
        <Ionicons name="logo-whatsapp" size={12} color={channels.wa ? '#fff' : COLORS.textSecondary} />
        <Text style={[s.chipText, channels.wa && s.chipTextActive]}>WA</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── JSX ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Stock Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ══════════════════════════════════════════════
            CARD 1 — GENERAL
        ══════════════════════════════════════════════ */}
        <View style={s.card}>
          <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection('general')} activeOpacity={0.7}>
            <View style={s.sectionIconWrap}>
              <Ionicons name="settings-outline" size={18} color={COLORS.textSecondary} />
            </View>
            <Text style={s.sectionTitle}>General</Text>
            <Ionicons name={openSections.general ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>

          {openSections.general && (
            <View style={s.sectionBody}>
              {/* Global Reorder Buffer */}
              <View style={s.fieldRow}>
                <Text style={s.fieldLabel}>Global Reorder Buffer</Text>
                <View style={s.inputWithUnit}>
                  <TextInput
                    style={s.inlineInput}
                    value={reorderBuffer}
                    onChangeText={setReorderBuffer}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                  <Text style={s.unitLabel}>Days</Text>
                </View>
              </View>

              <View style={s.divider} />

              {/* Auto-archive ledger */}
              <View style={s.fieldRow}>
                <Text style={s.fieldLabel}>Auto-archive ledger after</Text>
                <View style={s.inputWithUnit}>
                  <TextInput
                    style={s.inlineInput}
                    value={archiveLedger}
                    onChangeText={setArchiveLedger}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                  <Text style={s.unitLabel}>Months</Text>
                </View>
              </View>

              <View style={s.divider} />

              {/* Default UoM */}
              <TouchableOpacity style={s.fieldRow} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setUomOpen(v => !v); }} activeOpacity={0.7}>
                <Text style={s.fieldLabel}>Default UoM</Text>
                <View style={s.dropdownTrigger}>
                  <Text style={s.dropdownValue}>{defaultUom}</Text>
                  <Ionicons name={uomOpen ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textTertiary} />
                </View>
              </TouchableOpacity>

              {uomOpen && (
                <View style={s.uomList}>
                  {UOM_OPTIONS.map(uom => (
                    <TouchableOpacity
                      key={uom}
                      style={s.uomRow}
                      onPress={() => { setDefaultUom(uom); setUomOpen(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.uomText, defaultUom === uom && s.uomTextActive]}>{uom}</Text>
                      {defaultUom === uom && <Ionicons name="checkmark" size={16} color={AMBER} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* ══════════════════════════════════════════════
            CARD 2 — WAREHOUSE
        ══════════════════════════════════════════════ */}
        <View style={[s.card, s.cardGap]}>
          <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection('warehouse')} activeOpacity={0.7}>
            <View style={s.sectionIconWrap}>
              <Ionicons name="business-outline" size={18} color={COLORS.textSecondary} />
            </View>
            <Text style={s.sectionTitle}>Warehouse</Text>
            <Ionicons name={openSections.warehouse ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>

          {openSections.warehouse && (
            <View style={s.sectionBody}>
              {warehouses.map((wh, idx) => (
                <View key={wh.id}>
                  {idx > 0 && <View style={s.divider} />}

                  {/* Warehouse header row */}
                  <TouchableOpacity style={s.whRow} onPress={() => toggleWh(wh.id)} activeOpacity={0.7}>
                    <View style={s.whIconWrap}>
                      <Ionicons name="business" size={16} color={COLORS.textSecondary} />
                    </View>
                    <View style={s.whInfo}>
                      <Text style={s.whName}>{wh.name}</Text>
                      <Text style={s.whLoc}>{wh.location}</Text>
                    </View>
                    <Ionicons
                      name={expandedWh === wh.id ? 'chevron-up' : 'chevron-forward'}
                      size={16}
                      color={COLORS.textTertiary}
                    />
                  </TouchableOpacity>

                  {/* Expanded warehouse fields */}
                  {expandedWh === wh.id && (
                    <View style={s.whFields}>
                      {/* Code */}
                      <View style={s.whFieldRow}>
                        <Text style={s.whFieldLabel}>Code</Text>
                        <TextInput
                          style={s.whInput}
                          value={wh.code}
                          onChangeText={v => updateWarehouse(wh.id, 'code', v)}
                          autoCapitalize="characters"
                          maxLength={20}
                          placeholderTextColor={COLORS.textTertiary}
                        />
                      </View>

                      {/* Cycle-count frequency */}
                      <View style={s.whFieldColRow}>
                        <Text style={s.whFieldLabel}>Cycle-count frequency</Text>
                        <View style={s.cycleOptions}>
                          {CYCLE_OPTIONS.map(opt => (
                            <TouchableOpacity
                              key={opt}
                              style={[s.cyclePill, wh.cycleFreq === opt && s.cyclePillActive]}
                              onPress={() => updateWarehouse(wh.id, 'cycleFreq', opt)}
                              activeOpacity={0.7}
                            >
                              <Text style={[s.cyclePillText, wh.cycleFreq === opt && s.cyclePillTextActive]}>
                                {opt}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      {/* Auto-archive */}
                      <View style={s.whFieldRow}>
                        <Text style={s.whFieldLabel}>Auto-archive layers older than</Text>
                        <View style={s.inputWithUnit}>
                          <TextInput
                            style={s.inlineInput}
                            value={wh.archiveMonths}
                            onChangeText={v => updateWarehouse(wh.id, 'archiveMonths', v)}
                            keyboardType="numeric"
                            maxLength={3}
                            placeholderTextColor={COLORS.textTertiary}
                          />
                          <Text style={s.unitLabel}>Months</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              ))}

              <View style={s.divider} />

              {/* Add Warehouse */}
              <TouchableOpacity style={s.addWhRow} onPress={() => setAddModalVisible(true)} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={20} color={AMBER} />
                <Text style={s.addWhText}>Add Warehouse</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ══════════════════════════════════════════════
            CARD 3 — ITEMS
        ══════════════════════════════════════════════ */}
        <View style={[s.card, s.cardGap]}>
          <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection('items')} activeOpacity={0.7}>
            <View style={s.sectionIconWrap}>
              <Ionicons name="cube-outline" size={18} color={COLORS.textSecondary} />
            </View>
            <Text style={s.sectionTitle}>Items</Text>
            <Ionicons name={openSections.items ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>

          {openSections.items && (
            <View style={s.sectionBody}>
              {/* Batch / Lot Tracking */}
              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Text style={s.fieldLabel}>Batch / Lot Tracking</Text>
                  <Text style={s.fieldSub}>Track items by batch or lot number</Text>
                </View>
                <BrandSwitch value={batchTracking} onValueChange={setBatchTracking} />
              </View>

              <View style={s.divider} />

              {/* Expiry-Date Tracking */}
              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Text style={s.fieldLabel}>Expiry-Date Tracking</Text>
                  <Text style={s.fieldSub}>Track expiry dates for stock items</Text>
                </View>
                <BrandSwitch value={expiryTracking} onValueChange={setExpiryTracking} />
              </View>

              <View style={s.divider} />

              {/* Allow Negative Stock */}
              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Text style={s.fieldLabel}>Allow Negative Stock</Text>
                  <Text style={s.fieldSub}>Permit stock quantity to go below zero</Text>
                </View>
                <BrandSwitch value={allowNegative} onValueChange={setAllowNegative} />
              </View>

              <View style={s.divider} />

              {/* Default Reorder Point */}
              <View style={s.fieldRow}>
                <Text style={s.fieldLabel}>Default Reorder Point</Text>
                <View style={s.inputWithUnit}>
                  <TextInput
                    style={s.inlineInput}
                    value={defaultReorder}
                    onChangeText={setDefaultReorder}
                    keyboardType="numeric"
                    maxLength={6}
                  />
                  <Text style={s.unitLabel}>Units</Text>
                </View>
              </View>

              <View style={s.divider} />

              {/* UoM */}
              <TouchableOpacity
                style={s.fieldRow}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setItemsUomOpen(v => !v); }}
                activeOpacity={0.7}
              >
                <Text style={s.fieldLabel}>UoM</Text>
                <View style={s.dropdownTrigger}>
                  <Text style={s.dropdownValue}>{itemsUom}</Text>
                  <Ionicons name={itemsUomOpen ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textTertiary} />
                </View>
              </TouchableOpacity>

              {itemsUomOpen && (
                <View style={s.uomList}>
                  {UOM_OPTIONS.map(uom => (
                    <TouchableOpacity
                      key={uom}
                      style={s.uomRow}
                      onPress={() => { setItemsUom(uom); setItemsUomOpen(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.uomText, itemsUom === uom && s.uomTextActive]}>{uom}</Text>
                      {itemsUom === uom && <Ionicons name="checkmark" size={16} color={AMBER} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* ══════════════════════════════════════════════
            CARD 4 — ALERTS
        ══════════════════════════════════════════════ */}
        <View style={[s.card, s.cardGap]}>
          <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection('alerts')} activeOpacity={0.7}>
            <View style={s.sectionIconWrap}>
              <Ionicons name="notifications-outline" size={18} color={COLORS.textSecondary} />
            </View>
            <Text style={s.sectionTitle}>Alerts</Text>
            <Ionicons name={openSections.alerts ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>

          {openSections.alerts && (
            <View style={s.sectionBody}>
              {/* Low-Stock */}
              <View style={s.alertBlock}>
                <Text style={s.alertLabel}>Low-Stock</Text>
                {renderChips(lowStockCh, setLowStockCh)}
              </View>

              <View style={s.divider} />

              {/* Negative Stock */}
              <View style={s.alertBlock}>
                <Text style={s.alertLabel}>Negative Stock</Text>
                {renderChips(negStockCh, setNegStockCh)}
              </View>

              <View style={s.divider} />

              {/* Expiry */}
              <View style={s.alertBlock}>
                <View style={s.alertExpiryRow}>
                  <Text style={s.alertLabel}>Expiry</Text>
                  <View style={s.inputWithUnit}>
                    <TextInput
                      style={s.inlineInput}
                      value={expiryDays}
                      onChangeText={setExpiryDays}
                      keyboardType="numeric"
                      maxLength={3}
                    />
                    <Text style={s.unitLabel}>Days before</Text>
                  </View>
                </View>
                {renderChips(expiryCh, setExpiryCh)}
              </View>
            </View>
          )}
        </View>

        {/* Bottom spacer for the fixed action bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Fixed Bottom Action Bar */}
      <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.saveBtn} onPress={() => showToast('Settings saved successfully')} activeOpacity={0.8}>
          <Text style={s.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* ══════════════════════════════════════════════
          ADD WAREHOUSE BOTTOM SHEET MODAL
      ══════════════════════════════════════════════ */}      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable style={s.modalOverlay} onPress={() => setAddModalVisible(false)}>
            <Pressable style={s.modalSheet} onPress={e => e.stopPropagation()}>
              {/* Handle bar */}
              <View style={s.modalHandle} />

              {/* Modal Header */}
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Add Warehouse</Text>
                <TouchableOpacity onPress={() => setAddModalVisible(false)} activeOpacity={0.7} style={s.modalCloseBtn}>
                  <Ionicons name="close" size={22} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={s.modalScroll}
              >
                {/* ── Warehouse Code */}
                <Text style={s.modalLabel}>Warehouse Code <Text style={s.required}>*</Text></Text>
                <TextInput
                  style={s.modalInput}
                  value={addForm.code}
                  onChangeText={v => setAddForm(f => ({ ...f, code: v }))}
                  placeholder="e.g. MUM-MAIN"
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="characters"
                />

                {/* ── Warehouse Name */}
                <Text style={s.modalLabel}>Warehouse Name <Text style={s.required}>*</Text></Text>
                <TextInput
                  style={s.modalInput}
                  value={addForm.name}
                  onChangeText={v => setAddForm(f => ({ ...f, name: v }))}
                  placeholder="e.g. Mumbai Central"
                  placeholderTextColor={COLORS.textTertiary}
                />

                {/* ── Address */}
                <Text style={s.modalLabel}>Address</Text>
                <TextInput
                  style={[s.modalInput, s.modalInputMulti]}
                  value={addForm.location}
                  onChangeText={v => setAddForm(f => ({ ...f, location: v }))}
                  placeholder="Full address with pincode..."
                  placeholderTextColor={COLORS.textTertiary}
                  multiline
                  numberOfLines={2}
                />

                {/* ── Narration */}
                <Text style={s.modalLabel}>Narration</Text>
                <TextInput
                  style={s.modalInput}
                  value={addForm.narration}
                  onChangeText={v => setAddForm(f => ({ ...f, narration: v }))}
                  placeholder="Optional notes..."
                  placeholderTextColor={COLORS.textTertiary}
                />

                {/* ── Cycle-count frequency */}
                <Text style={s.modalLabel}>Cycle-count Frequency</Text>
                <View style={[s.cycleOptions, { marginBottom: SPACING.md }]}>
                  {CYCLE_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[s.cyclePill, addForm.cycleFreq === opt && s.cyclePillActive]}
                      onPress={() => setAddForm(f => ({ ...f, cycleFreq: opt }))}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.cyclePillText, addForm.cycleFreq === opt && s.cyclePillTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* ── Racks */}
                <Text style={s.modalLabel}>Racks</Text>
                {addForm.racks.map((rack, i) => (
                  <View key={i} style={s.rackRow}>
                    <TextInput
                      style={[s.modalInput, s.rackInput]}
                      value={rack}
                      onChangeText={v => updateRack(i, v)}
                      placeholder={`Rack ${i + 1} label`}
                      placeholderTextColor={COLORS.textTertiary}
                    />
                    {addForm.racks.length > 1 && (
                      <TouchableOpacity onPress={() => removeRack(i)} activeOpacity={0.7} style={s.rackRemoveBtn}>
                        <Ionicons name="close-circle" size={20} color={COLORS.textTertiary} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity style={s.addRackBtn} onPress={addRack} activeOpacity={0.7}>
                  <Ionicons name="add-outline" size={16} color={AMBER} />
                  <Text style={s.addRackText}>Add Rack</Text>
                </TouchableOpacity>

                {/* ── Contact Person */}
                <Text style={s.modalLabel}>Contact Person</Text>
                <TextInput
                  style={s.modalInput}
                  value={addForm.contactName}
                  onChangeText={v => setAddForm(f => ({ ...f, contactName: v }))}
                  placeholder="Name"
                  placeholderTextColor={COLORS.textTertiary}
                />
                <TextInput
                  style={s.modalInput}
                  value={addForm.contactMobile}
                  onChangeText={v => setAddForm(f => ({ ...f, contactMobile: v }))}
                  placeholder="Mobile number"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={s.modalInput}
                  value={addForm.contactEmail}
                  onChangeText={v => setAddForm(f => ({ ...f, contactEmail: v }))}
                  placeholder="Email address"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                {/* ── Modal Action Buttons */}
                <View style={s.modalActions}>
                  <TouchableOpacity style={s.modalCancelBtn} onPress={() => setAddModalVisible(false)} activeOpacity={0.7}>
                    <Text style={s.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.modalSaveBtn, !addForm.name.trim() && s.modalSaveBtnDisabled]}
                    onPress={handleAddWarehouse}
                    activeOpacity={0.8}
                    disabled={!addForm.name.trim()}
                  >
                    <Text style={s.modalSaveText}>Add Warehouse</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  headerBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  // ── Cards
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  cardGap: { marginTop: SPACING.sm },

  // ── Section header (accordion trigger)
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 15,
    gap: 10,
  },
  sectionIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: COLORS.hoverBg,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  sectionBody:  { borderTopWidth: 1, borderTopColor: COLORS.borderDefault },

  // ── Field rows
  divider:   { height: 1, backgroundColor: COLORS.borderDefault },
  fieldRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14 },
  fieldLabel:{ fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary, flex: 1, paddingRight: SPACING.sm },
  fieldSub:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },

  // ── Inline input + unit
  inputWithUnit: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inlineInput: {
    width: 62, height: 36, paddingHorizontal: 10,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderStrong,
    fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary,
    textAlign: 'center',
  },
  unitLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },

  // ── Dropdown trigger
  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dropdownValue:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },

  // ── UoM list (inline dropdown)
  uomList: { borderTopWidth: 1, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  uomRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 12 },
  uomText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  uomTextActive: { color: COLORS.textPrimary, fontWeight: '700' },

  // ── Warehouse rows
  whRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, gap: 10 },
  whIconWrap: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: COLORS.hoverBg,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  whInfo:    { flex: 1 },
  whName:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  whLoc:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  whFields:  { backgroundColor: COLORS.pageBg, paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  whFieldRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  whFieldColRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  whFieldLabel:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, flex: 1 },
  whInput: {
    flex: 1, maxWidth: 140, height: 34, paddingHorizontal: 10,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderStrong,
    fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary,
    textAlign: 'right',
  },

  // ── Cycle-count pills
  cycleOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  cyclePill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.cardBg,
  },
  cyclePillActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  cyclePillText:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  cyclePillTextActive: { color: '#fff', fontWeight: '600' },

  // ── Add warehouse row
  addWhRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
  },
  addWhText: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },

  // ── Toggle rows (Items section)
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
  },
  toggleInfo: { flex: 1, marginRight: 12 },

  // ── Alerts
  alertBlock:     { paddingHorizontal: SPACING.md, paddingVertical: 12 },
  alertLabel:     { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 10 },
  alertExpiryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  chipRow:        { flexDirection: 'row', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.cardBg,
  },
  chipActive:     { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  chipText:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  // ── Bottom action bar
  bottomBar: {
    flexDirection: 'row', gap: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  cancelBtn: {
    flex: 1, height: 48, alignItems: 'center', justifyContent: 'center',
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.cardBg,
  },
  cancelBtnText: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  saveBtn: {
    flex: 1, height: 48, alignItems: 'center', justifyContent: 'center',
    borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary,
  },
  saveBtnText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#fff' },

  // ── Modal
  modalOverlay: {
    flex: 1, backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    maxHeight: '92%',
    paddingHorizontal: SPACING.md,
  },
  modalHandle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: COLORS.borderStrong,
    alignSelf: 'center', marginTop: 10, marginBottom: 6,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    marginBottom: SPACING.md,
  },
  modalTitle:    { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  modalCloseBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalScroll:   { paddingBottom: SPACING.md },

  modalLabel: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 6, marginTop: SPACING.md,
  },
  required: { color: COLORS.negative },
  modalInput: {
    height: 44, backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary,
    marginBottom: 4,
  },
  modalInputMulti: { height: 70, paddingTop: 12, textAlignVertical: 'top' },

  // ── Rack rows
  rackRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  rackInput:     { flex: 1, marginBottom: 0 },
  rackRemoveBtn: { padding: 4 },
  addRackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 4,
  },
  addRackText: { fontSize: TYPOGRAPHY.sm, color: AMBER, fontWeight: '600' },

  // ── Modal action buttons
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  modalCancelBtn: {
    flex: 1, height: 46, alignItems: 'center', justifyContent: 'center',
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderStrong,
  },
  modalCancelText: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  modalSaveBtn: {
    flex: 2, height: 46, alignItems: 'center', justifyContent: 'center',
    borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary,
  },
  modalSaveBtnDisabled: { opacity: 0.4 },
  modalSaveText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#fff' },
});
