import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
  LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import BrandSwitch from '../../src/components/forms/BrandSwitch';
import { useAuth } from '../../src/context/AuthContext';
import { getInventorySettings, saveInventorySettings } from '../../src/services/api';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AMBER = '#A89060';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AlertChannels { inApp: boolean; email: boolean; whatsapp: boolean; }
interface ExpiryAlerts extends AlertChannels { daysBefore: number; }
interface InventoryAgingRules { buckets: string[]; }

interface Settings {
  // General
  product_display_field:          string;
  default_unit_for_new_items:     string;
  purchase_buffer_days:           number;
  reorder_calc_mode:              string;
  low_stock_threshold_mode:       string;
  archive_old_stock_months:       number;
  // Warehouses
  warehouse_code_map:             Record<string, string>;
  cycle_count_frequency_map:      Record<string, string>;
  archive_stock_layers_map:       Record<string, number>;
  // Items
  default_low_stock_level:        number;
  inventory_aging_rules:          InventoryAgingRules;
  fast_moving_top_pct:            number;
  slow_moving_no_movement_days:   number;
  dead_stock_no_movement_days:    number;
  movement_analysis_period_days:  number;
  // Alerts
  low_stock_alerts:               AlertChannels;
  negative_stock_alerts:          AlertChannels;
  expiry_alerts:                  ExpiryAlerts;
  fast_slow_moving_alerts:        AlertChannels;
}

interface Warehouse { id: string; name: string; parent: string; address: string; }

const DEFAULT_SETTINGS: Settings = {
  product_display_field:          'auto',
  default_unit_for_new_items:     'Nos',
  purchase_buffer_days:           7,
  reorder_calc_mode:              'hybrid',
  low_stock_threshold_mode:       'reorder_level',
  archive_old_stock_months:       24,
  warehouse_code_map:             {},
  cycle_count_frequency_map:      {},
  archive_stock_layers_map:       {},
  default_low_stock_level:        20,
  inventory_aging_rules:          { buckets: ['0-30','31-60','61-90','90+'] },
  fast_moving_top_pct:            20,
  slow_moving_no_movement_days:   90,
  dead_stock_no_movement_days:    180,
  movement_analysis_period_days:  90,
  low_stock_alerts:               { inApp: true,  email: false, whatsapp: false },
  negative_stock_alerts:          { inApp: true,  email: true,  whatsapp: false },
  expiry_alerts:                  { inApp: true,  email: false, whatsapp: false, daysBefore: 30 },
  fast_slow_moving_alerts:        { inApp: false, email: false, whatsapp: false },
};

const CYCLE_OPTIONS = ['Daily', 'Weekly', 'Monthly', 'Quarterly'];
const ANALYSIS_PERIOD_OPTIONS = [30, 60, 90, 180];

// ─── Radio option row ─────────────────────────────────────────────────────────
function RadioRow({
  label, sublabel, selected, onPress,
}: { label: string; sublabel?: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.radioRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.radioCircle, selected && s.radioCircleActive]}>
        {selected && <View style={s.radioInner} />}
      </View>
      <View style={s.radioTextWrap}>
        <Text style={[s.radioLabel, selected && s.radioLabelActive]}>{label}</Text>
        {!!sublabel && <Text style={s.radioSub}>{sublabel}</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function StockSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company } = useAuth();
  const companyGuid = company?.guid;

  // ── Loading / saving state
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [isDirty, setIsDirty]   = useState(false);

  // ── API data
  const [availableUoms, setAvailableUoms]   = useState<string[]>(['Nos','Kg','Ltr','Box','Pcs','Meter']);
  const [warehouses,    setWarehouses]       = useState<Warehouse[]>([]);

  // ── Settings state
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // ── Accordion state
  const [openSections, setOpenSections] = useState({
    general: true, warehouse: false, items: false, alerts: false,
  });

  // ── Sub-open state inside sections
  const [uomOpen,        setUomOpen]        = useState(false);
  const [itemsUomOpen,   setItemsUomOpen]   = useState(false);
  const [expandedWh,     setExpandedWh]     = useState<string | null>(null);
  const [productDispOpen, setProductDispOpen] = useState(false);
  const [reorderModeOpen, setReorderModeOpen] = useState(false);
  const [lowStockModeOpen, setLowStockModeOpen] = useState(false);
  const [agingOpen,      setAgingOpen]      = useState(false);
  const [fastSlowOpen,   setFastSlowOpen]   = useState(false);

  // ── Load settings on mount
  const loadSettings = useCallback(async () => {
    if (!companyGuid) { setLoading(false); return; }
    try {
      const res = await getInventorySettings(companyGuid);
      if (res?.success && res.data) {
        const { settings: srv, available_uoms, warehouses: wh } = res.data;
        if (available_uoms?.length) setAvailableUoms(available_uoms);
        if (wh?.length) setWarehouses(wh);
        if (srv) {
          setSettings(prev => ({
            ...prev,
            ...srv,
            // Ensure nested objects are proper (pg jsonb comes as plain obj)
            inventory_aging_rules:  srv.inventory_aging_rules  || prev.inventory_aging_rules,
            low_stock_alerts:       srv.low_stock_alerts       || prev.low_stock_alerts,
            negative_stock_alerts:  srv.negative_stock_alerts  || prev.negative_stock_alerts,
            expiry_alerts:          srv.expiry_alerts          || prev.expiry_alerts,
            fast_slow_moving_alerts:srv.fast_slow_moving_alerts|| prev.fast_slow_moving_alerts,
            warehouse_code_map:     srv.warehouse_code_map     || {},
            cycle_count_frequency_map: srv.cycle_count_frequency_map || {},
            archive_stock_layers_map:  srv.archive_stock_layers_map  || {},
          }));
        }
      }
    } catch (e) {
      console.warn('[StockSettings] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [companyGuid]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // ── Setters
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const updateAlertChannel = (
    key: 'low_stock_alerts' | 'negative_stock_alerts' | 'fast_slow_moving_alerts',
    channel: keyof AlertChannels,
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], [channel]: !(prev[key] as AlertChannels)[channel] },
    }));
    setIsDirty(true);
  };

  const updateExpiryAlert = (channel: keyof ExpiryAlerts) => {
    setSettings(prev => {
      const ea = prev.expiry_alerts;
      if (channel === 'daysBefore') return prev; // handled separately
      return { ...prev, expiry_alerts: { ...ea, [channel]: !ea[channel] } };
    });
    setIsDirty(true);
  };

  const updateWhCode = (whId: string, code: string) => {
    setSettings(prev => ({ ...prev, warehouse_code_map: { ...prev.warehouse_code_map, [whId]: code } }));
    setIsDirty(true);
  };
  const updateWhCycle = (whId: string, freq: string) => {
    setSettings(prev => ({ ...prev, cycle_count_frequency_map: { ...prev.cycle_count_frequency_map, [whId]: freq } }));
    setIsDirty(true);
  };
  const updateWhArchive = (whId: string, months: string) => {
    const n = parseInt(months) || 24;
    setSettings(prev => ({ ...prev, archive_stock_layers_map: { ...prev.archive_stock_layers_map, [whId]: n } }));
    setIsDirty(true);
  };

  // ── Save
  const handleSave = async () => {
    if (!companyGuid) return;
    setSaving(true);
    try {
      await saveInventorySettings(companyGuid, settings);
      setIsDirty(false);
      Toast.show({ type: 'success', text1: 'Settings saved successfully' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  // ── Accordion
  const toggleSection = (key: keyof typeof openSections) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSections(prev => {
      const all = (Object.keys(prev) as (keyof typeof openSections)[]).reduce(
        (a, k) => ({ ...a, [k]: false }), {} as typeof openSections,
      );
      return { ...all, [key]: !prev[key] };
    });
  };

  const toggleWh = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedWh(prev => (prev === id ? null : id));
  };

  // ── Chip row renderer (alerts)
  const renderChips = (
    channels: AlertChannels,
    onToggle: (ch: keyof AlertChannels) => void,
  ) => (
    <View style={s.chipRow}>
      {([['inApp','notifications-outline','In-App'], ['email','mail-outline','Email'], ['whatsapp','logo-whatsapp','WA']] as [keyof AlertChannels, string, string][]).map(([k, icon, label]) => (
        <TouchableOpacity
          key={k}
          style={[s.chip, channels[k] && s.chipActive]}
          onPress={() => onToggle(k)}
          activeOpacity={0.7}
        >
          <Ionicons name={icon as any} size={12} color={channels[k] ? '#fff' : COLORS.textSecondary} />
          <Text style={[s.chipText, channels[k] && s.chipTextActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Loading screen
  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Stock Settings</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={AMBER} />
          <Text style={s.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const s_obj = settings;

  // ── Label helpers
  const productDisplayLabel: Record<string, string> = {
    auto: 'Auto Detect (Recommended)', name: 'Stock Name',
    alias: 'Alias', part_number: 'Part Number', description: 'Description',
  };
  const reorderModeLabel: Record<string, string> = {
    hybrid: 'Hybrid Recommended', tally_reorder: 'Tally Reorder Level',
    sales_velocity: 'Sales Velocity', default_low_stock: 'Default Low Stock Level',
  };
  const lowStockModeLabel: Record<string, string> = {
    reorder_level: 'Reorder Level', safety_stock: 'Safety Stock',
    days_of_cover: 'Days of Cover', custom_percentage: 'Custom Percentage',
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
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
        keyboardDismissMode="interactive"
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

              {/* Product Display Name */}
              <TouchableOpacity
                style={s.fieldRow}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setProductDispOpen(v => !v); }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Product Display Name</Text>
                  <Text style={s.fieldSub}>Controls how products appear in TallyDekho</Text>
                </View>
                <View style={s.dropdownTrigger}>
                  <Text style={s.dropdownValue}>{productDisplayLabel[s_obj.product_display_field] || 'Auto Detect'}</Text>
                  <Ionicons name={productDispOpen ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textTertiary} />
                </View>
              </TouchableOpacity>
              {productDispOpen && (
                <View style={s.radioGroup}>
                  {([
                    ['auto',        'Auto Detect (Recommended)', 'Picks the most readable field automatically'],
                    ['name',        'Stock Name',                undefined],
                    ['alias',       'Alias',                     undefined],
                    ['part_number', 'Part Number',               undefined],
                    ['description', 'Description',               undefined],
                  ] as [string, string, string | undefined][]).map(([val, label, sub]) => (
                    <RadioRow
                      key={val}
                      label={label}
                      sublabel={sub}
                      selected={s_obj.product_display_field === val}
                      onPress={() => { update('product_display_field', val); setProductDispOpen(false); }}
                    />
                  ))}
                </View>
              )}

              <View style={s.divider} />

              {/* Default Unit for New Items */}
              <TouchableOpacity
                style={s.fieldRow}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setUomOpen(v => !v); }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Default Unit for New Items</Text>
                  <Text style={s.fieldSub}>From Tally masters — Hybrid</Text>
                </View>
                <View style={s.dropdownTrigger}>
                  <Text style={s.dropdownValue}>{s_obj.default_unit_for_new_items || 'Nos'}</Text>
                  <Ionicons name={uomOpen ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textTertiary} />
                </View>
              </TouchableOpacity>
              {uomOpen && (
                <View style={s.uomList}>
                  {availableUoms.map(uom => {
                    const selected = s_obj.default_unit_for_new_items === uom;
                    return (
                      <TouchableOpacity
                        key={uom}
                        style={s.uomRow}
                        onPress={() => { update('default_unit_for_new_items', uom); setUomOpen(false); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.uomText, selected && s.uomTextActive]}>{uom}</Text>
                        {selected && <Ionicons name="checkmark" size={16} color={AMBER} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={s.divider} />

              {/* Purchase Buffer Days */}
              <View style={s.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Purchase Buffer Days</Text>
                  <Text style={s.fieldSub}>Extra buffer added to reorder recommendations</Text>
                </View>
                <View style={s.inputWithUnit}>
                  <TextInput
                    style={s.inlineInput}
                    value={String(s_obj.purchase_buffer_days)}
                    onChangeText={v => update('purchase_buffer_days', parseInt(v) || 0)}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                  <Text style={s.unitLabel}>Days</Text>
                </View>
              </View>

              <View style={s.divider} />

              {/* Reorder Calculation Mode */}
              <TouchableOpacity
                style={s.fieldRow}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setReorderModeOpen(v => !v); }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Reorder Calculation Mode</Text>
                </View>
                <View style={s.dropdownTrigger}>
                  <Text style={s.dropdownValue}>{reorderModeLabel[s_obj.reorder_calc_mode] || 'Hybrid'}</Text>
                  <Ionicons name={reorderModeOpen ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textTertiary} />
                </View>
              </TouchableOpacity>
              {reorderModeOpen && (
                <View style={s.radioGroup}>
                  {([
                    ['hybrid',           'Hybrid Recommended',    'Combines Tally levels + sales velocity'],
                    ['tally_reorder',    'Tally Reorder Level',   'Uses reorder level set in Tally masters'],
                    ['sales_velocity',   'Sales Velocity',        'Based on historical movement rate'],
                    ['default_low_stock','Default Low Stock Level','Uses fixed threshold from settings'],
                  ] as [string, string, string][]).map(([val, label, sub]) => (
                    <RadioRow
                      key={val}
                      label={label}
                      sublabel={sub}
                      selected={s_obj.reorder_calc_mode === val}
                      onPress={() => { update('reorder_calc_mode', val); setReorderModeOpen(false); }}
                    />
                  ))}
                </View>
              )}

              <View style={s.divider} />

              {/* Low Stock Threshold Mode */}
              <TouchableOpacity
                style={s.fieldRow}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setLowStockModeOpen(v => !v); }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Low Stock Threshold Mode</Text>
                </View>
                <View style={s.dropdownTrigger}>
                  <Text style={s.dropdownValue}>{lowStockModeLabel[s_obj.low_stock_threshold_mode] || 'Reorder Level'}</Text>
                  <Ionicons name={lowStockModeOpen ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textTertiary} />
                </View>
              </TouchableOpacity>
              {lowStockModeOpen && (
                <View style={s.radioGroup}>
                  {([
                    ['reorder_level',    'Reorder Level',       undefined],
                    ['safety_stock',     'Safety Stock',        undefined],
                    ['days_of_cover',    'Days of Cover',       undefined],
                    ['custom_percentage','Custom Percentage',   undefined],
                  ] as [string, string, string | undefined][]).map(([val, label, sub]) => (
                    <RadioRow
                      key={val}
                      label={label}
                      sublabel={sub}
                      selected={s_obj.low_stock_threshold_mode === val}
                      onPress={() => { update('low_stock_threshold_mode', val); setLowStockModeOpen(false); }}
                    />
                  ))}
                </View>
              )}

              <View style={s.divider} />

              {/* Archive Old Stock Activity */}
              <View style={s.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Archive Old Stock Activity</Text>
                  <Text style={s.fieldSub}>Auto-archive ledger entries older than</Text>
                </View>
                <View style={s.inputWithUnit}>
                  <TextInput
                    style={s.inlineInput}
                    value={String(s_obj.archive_old_stock_months)}
                    onChangeText={v => update('archive_old_stock_months', parseInt(v) || 24)}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                  <Text style={s.unitLabel}>Months</Text>
                </View>
              </View>

            </View>
          )}
        </View>

        {/* ══════════════════════════════════════════════
            CARD 2 — WAREHOUSES
        ══════════════════════════════════════════════ */}
        <View style={[s.card, s.cardGap]}>
          <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection('warehouse')} activeOpacity={0.7}>
            <View style={s.sectionIconWrap}>
              <Ionicons name="business-outline" size={18} color={COLORS.textSecondary} />
            </View>
            <Text style={s.sectionTitle}>Warehouses</Text>
            <Ionicons name={openSections.warehouse ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>

          {openSections.warehouse && (
            <View style={s.sectionBody}>
              {warehouses.length === 0 && (
                <View style={s.emptyWrap}>
                  <Ionicons name="business-outline" size={28} color={COLORS.textTertiary} />
                  <Text style={s.emptyText}>No warehouses synced yet</Text>
                  <Text style={s.emptySub}>Sync from Tally to see your godowns here</Text>
                </View>
              )}
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
                      {!!wh.address && <Text style={s.whLoc}>{wh.address}</Text>}
                      {!wh.address && !!wh.parent && <Text style={s.whLoc}>Under: {wh.parent}</Text>}
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
                      {/* Warehouse Code */}
                      <View style={s.whFieldRow}>
                        <Text style={s.whFieldLabel}>Warehouse Code</Text>
                        <TextInput
                          style={s.whInput}
                          value={s_obj.warehouse_code_map[wh.id] || ''}
                          onChangeText={v => updateWhCode(wh.id, v)}
                          placeholder="e.g. JPR-MAIN"
                          placeholderTextColor={COLORS.textTertiary}
                          autoCapitalize="characters"
                          maxLength={20}
                        />
                      </View>

                      {/* Cycle-count frequency */}
                      <View style={s.whFieldColRow}>
                        <Text style={s.whFieldLabel}>Cycle Count Frequency</Text>
                        <View style={s.cycleOptions}>
                          {CYCLE_OPTIONS.map(opt => {
                            const active = (s_obj.cycle_count_frequency_map[wh.id] || 'Weekly') === opt;
                            return (
                              <TouchableOpacity
                                key={opt}
                                style={[s.cyclePill, active && s.cyclePillActive]}
                                onPress={() => updateWhCycle(wh.id, opt)}
                                activeOpacity={0.7}
                              >
                                <Text style={[s.cyclePillText, active && s.cyclePillTextActive]}>{opt}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      {/* Archive Stock Layers */}
                      <View style={s.whFieldRow}>
                        <Text style={s.whFieldLabel}>Archive Stock Layers older than</Text>
                        <View style={s.inputWithUnit}>
                          <TextInput
                            style={s.inlineInput}
                            value={String(s_obj.archive_stock_layers_map[wh.id] ?? 24)}
                            onChangeText={v => updateWhArchive(wh.id, v)}
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
                  <Text style={s.fieldSub}>Tally Supported — applies to future items by default</Text>
                </View>
                <BrandSwitch
                  value={false}
                  onValueChange={() => { /* Tally write-back: future scope */ }}
                />
              </View>
              <View style={s.tallyBadgeWrap}>
                <View style={s.tallyBadge}>
                  <Ionicons name="sync-outline" size={10} color={AMBER} />
                  <Text style={s.tallyBadgeText}>Tally Controlled</Text>
                </View>
              </View>

              <View style={s.divider} />

              {/* Expiry-Date Tracking */}
              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Text style={s.fieldLabel}>Expiry-Date Tracking</Text>
                  <Text style={s.fieldSub}>Requires batch tracking enabled</Text>
                </View>
                <BrandSwitch
                  value={false}
                  onValueChange={() => { /* Tally write-back: future scope */ }}
                />
              </View>
              <View style={s.tallyBadgeWrap}>
                <View style={s.tallyBadge}>
                  <Ionicons name="sync-outline" size={10} color={AMBER} />
                  <Text style={s.tallyBadgeText}>Tally Controlled</Text>
                </View>
              </View>

              <View style={s.divider} />

              {/* Allow Negative Stock */}
              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Text style={s.fieldLabel}>Allow Negative Stock</Text>
                  <Text style={s.fieldSub}>Permit stock quantity to go below zero</Text>
                </View>
                <BrandSwitch
                  value={false}
                  onValueChange={() => { /* Tally write-back: future scope */ }}
                />
              </View>
              <View style={s.tallyBadgeWrap}>
                <View style={s.tallyBadge}>
                  <Ionicons name="sync-outline" size={10} color={AMBER} />
                  <Text style={s.tallyBadgeText}>Tally Controlled</Text>
                </View>
              </View>

              <View style={s.divider} />

              {/* Default Low Stock Level */}
              <View style={s.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Default Low Stock Level</Text>
                  <Text style={s.fieldSub}>Fallback when item has no reorder level in Tally</Text>
                </View>
                <View style={s.inputWithUnit}>
                  <TextInput
                    style={s.inlineInput}
                    value={String(s_obj.default_low_stock_level)}
                    onChangeText={v => update('default_low_stock_level', parseInt(v) || 0)}
                    keyboardType="numeric"
                    maxLength={6}
                  />
                  <Text style={s.unitLabel}>Units</Text>
                </View>
              </View>

              <View style={s.divider} />

              {/* Inventory Aging Rules */}
              <TouchableOpacity
                style={s.fieldRow}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setAgingOpen(v => !v); }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Inventory Aging Rules</Text>
                  <Text style={s.fieldSub}>Define stock age classification buckets</Text>
                </View>
                <Ionicons name={agingOpen ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textTertiary} />
              </TouchableOpacity>
              {agingOpen && (
                <View style={s.agingWrap}>
                  {(['0-30 Days','31-60 Days','61-90 Days','90+ Days'] as string[]).map((label, i) => {
                    const bucket = ['0-30','31-60','61-90','90+'][i];
                    const active  = s_obj.inventory_aging_rules.buckets.includes(bucket);
                    return (
                      <TouchableOpacity
                        key={bucket}
                        style={[s.agingPill, active && s.agingPillActive]}
                        onPress={() => {
                          const buckets = active
                            ? s_obj.inventory_aging_rules.buckets.filter(b => b !== bucket)
                            : [...s_obj.inventory_aging_rules.buckets, bucket];
                          update('inventory_aging_rules', { buckets });
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.agingPillText, active && s.agingPillTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={s.divider} />

              {/* Fast / Slow Moving Analysis */}
              <TouchableOpacity
                style={s.fieldRow}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setFastSlowOpen(v => !v); }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Fast / Slow Moving Analysis</Text>
                  <Text style={s.fieldSub}>Thresholds for classifying stock movement</Text>
                </View>
                <Ionicons name={fastSlowOpen ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textTertiary} />
              </TouchableOpacity>
              {fastSlowOpen && (
                <View style={s.fastSlowWrap}>

                  {/* Analysis Period */}
                  <Text style={s.fastSlowSectionLabel}>Analysis Period</Text>
                  <View style={s.periodPillRow}>
                    {ANALYSIS_PERIOD_OPTIONS.map(days => {
                      const active = s_obj.movement_analysis_period_days === days;
                      return (
                        <TouchableOpacity
                          key={days}
                          style={[s.cyclePill, active && s.cyclePillActive]}
                          onPress={() => update('movement_analysis_period_days', days)}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.cyclePillText, active && s.cyclePillTextActive]}>{days}d</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Fast Moving */}
                  <Text style={s.fastSlowSectionLabel}>Fast Moving — Top %</Text>
                  <View style={s.fastSlowRow}>
                    <TextInput
                      style={[s.inlineInput, { width: 70 }]}
                      value={String(s_obj.fast_moving_top_pct)}
                      onChangeText={v => update('fast_moving_top_pct', parseInt(v) || 0)}
                      keyboardType="numeric"
                      maxLength={3}
                    />
                    <Text style={s.unitLabel}>% of items by sales volume</Text>
                  </View>

                  {/* Slow Moving */}
                  <Text style={s.fastSlowSectionLabel}>Slow Moving — No movement for</Text>
                  <View style={s.fastSlowRow}>
                    <TextInput
                      style={[s.inlineInput, { width: 70 }]}
                      value={String(s_obj.slow_moving_no_movement_days)}
                      onChangeText={v => update('slow_moving_no_movement_days', parseInt(v) || 0)}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    <Text style={s.unitLabel}>Days</Text>
                  </View>

                  {/* Dead Stock */}
                  <Text style={s.fastSlowSectionLabel}>Dead Stock — No movement for</Text>
                  <View style={s.fastSlowRow}>
                    <TextInput
                      style={[s.inlineInput, { width: 70 }]}
                      value={String(s_obj.dead_stock_no_movement_days)}
                      onChangeText={v => update('dead_stock_no_movement_days', parseInt(v) || 0)}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    <Text style={s.unitLabel}>Days</Text>
                  </View>
                </View>
              )}

              <View style={s.divider} />

              {/* Unit for New Items (Items section) */}
              <TouchableOpacity
                style={s.fieldRow}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setItemsUomOpen(v => !v); }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Unit for New Items</Text>
                  <Text style={s.fieldSub}>Hybrid — from Tally UoM masters</Text>
                </View>
                <View style={s.dropdownTrigger}>
                  <Text style={s.dropdownValue}>{s_obj.default_unit_for_new_items || 'Nos'}</Text>
                  <Ionicons name={itemsUomOpen ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textTertiary} />
                </View>
              </TouchableOpacity>
              {itemsUomOpen && (
                <View style={s.uomList}>
                  {availableUoms.map(uom => {
                    const selected = s_obj.default_unit_for_new_items === uom;
                    return (
                      <TouchableOpacity
                        key={uom}
                        style={s.uomRow}
                        onPress={() => { update('default_unit_for_new_items', uom); setItemsUomOpen(false); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.uomText, selected && s.uomTextActive]}>{uom}</Text>
                        {selected && <Ionicons name="checkmark" size={16} color={AMBER} />}
                      </TouchableOpacity>
                    );
                  })}
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

              {/* Low Stock Alerts */}
              <View style={s.alertBlock}>
                <Text style={s.alertLabel}>Low Stock Alerts</Text>
                {renderChips(s_obj.low_stock_alerts, ch => updateAlertChannel('low_stock_alerts', ch))}
              </View>

              <View style={s.divider} />

              {/* Negative Stock Alerts */}
              <View style={s.alertBlock}>
                <Text style={s.alertLabel}>Negative Stock Alerts</Text>
                {renderChips(s_obj.negative_stock_alerts, ch => updateAlertChannel('negative_stock_alerts', ch))}
              </View>

              <View style={s.divider} />

              {/* Expiry Alerts */}
              <View style={s.alertBlock}>
                <View style={s.alertExpiryRow}>
                  <Text style={s.alertLabel}>Expiry Alerts</Text>
                  <View style={s.inputWithUnit}>
                    <TextInput
                      style={s.inlineInput}
                      value={String(s_obj.expiry_alerts.daysBefore)}
                      onChangeText={v => {
                        const n = parseInt(v) || 30;
                        update('expiry_alerts', { ...s_obj.expiry_alerts, daysBefore: n });
                      }}
                      keyboardType="numeric"
                      maxLength={3}
                    />
                    <Text style={s.unitLabel}>Days before</Text>
                  </View>
                </View>
                {renderChips(
                  { inApp: s_obj.expiry_alerts.inApp, email: s_obj.expiry_alerts.email, whatsapp: s_obj.expiry_alerts.whatsapp },
                  ch => updateExpiryAlert(ch),
                )}
              </View>

              <View style={s.divider} />

              {/* Fast/Slow Moving Alerts */}
              <View style={s.alertBlock}>
                <Text style={s.alertLabel}>Fast / Slow Moving Alerts</Text>
                {renderChips(s_obj.fast_slow_moving_alerts, ch => updateAlertChannel('fast_slow_moving_alerts', ch))}
              </View>

            </View>
          )}
        </View>

        {/* Bottom spacer */}
        <View style={{ height: isDirty ? 100 : 32 }} />
      </ScrollView>

      {/* ── Fixed Bottom Action Bar */}
      {isDirty && (
        <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={s.cancelBtn}
            onPress={() => { setIsDirty(false); loadSettings(); }}
            activeOpacity={0.7}
            disabled={saving}
          >
            <Text style={s.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            activeOpacity={0.8}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.saveBtnText}>Save Settings</Text>
            }
          </TouchableOpacity>
        </View>
      )}
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

  // Loading
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },

  // Cards
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  cardGap: { marginTop: SPACING.sm },

  // Section header
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

  // Field rows
  divider:   { height: 1, backgroundColor: COLORS.borderDefault },
  fieldRow:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
  },
  fieldLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary, flex: 1, paddingRight: SPACING.sm },
  fieldSub:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },

  // Inline input + unit
  inputWithUnit: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inlineInput: {
    width: 62, height: 36, paddingHorizontal: 10,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderStrong,
    fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary,
    textAlign: 'center',
  },
  unitLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },

  // Dropdown trigger
  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dropdownValue:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },

  // Radio group
  radioGroup: {
    backgroundColor: COLORS.pageBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    paddingVertical: 4,
  },
  radioRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: SPACING.md, paddingVertical: 12,
  },
  radioCircle: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: COLORS.borderStrong,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  radioCircleActive: { borderColor: AMBER },
  radioInner:  { width: 8, height: 8, borderRadius: 4, backgroundColor: AMBER },
  radioTextWrap: { flex: 1 },
  radioLabel:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  radioLabelActive: { color: COLORS.textPrimary, fontWeight: '700' },
  radioSub:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },

  // UoM list (inline dropdown)
  uomList: { borderTopWidth: 1, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  uomRow:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
  },
  uomText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  uomTextActive: { color: COLORS.textPrimary, fontWeight: '700' },

  // Tally controlled badge
  tallyBadgeWrap: { paddingHorizontal: SPACING.md, paddingBottom: 10 },
  tallyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: COLORS.hoverBg,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm,
  },
  tallyBadgeText: { fontSize: 10, color: AMBER, fontWeight: '600' },

  // Warehouse rows
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

  // Cycle-count pills
  cycleOptions:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  cyclePill:          {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.cardBg,
  },
  cyclePillActive:    { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  cyclePillText:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  cyclePillTextActive:{ color: '#fff', fontWeight: '600' },

  // Empty warehouse
  emptyWrap: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  emptySub:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },

  // Toggle rows (Items)
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
  },
  toggleInfo: { flex: 1, marginRight: 12 },

  // Inventory Aging
  agingWrap:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: SPACING.md, paddingBottom: 14 },
  agingPill:         {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.cardBg,
  },
  agingPillActive:   { backgroundColor: AMBER, borderColor: AMBER },
  agingPillText:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  agingPillTextActive:{ color: '#fff', fontWeight: '700' },

  // Fast/Slow Moving
  fastSlowWrap:          { paddingHorizontal: SPACING.md, paddingBottom: 14 },
  fastSlowSectionLabel:  {
    fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 8,
  },
  fastSlowRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  periodPillRow:{ flexDirection: 'row', gap: 8 },

  // Alerts
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

  // Bottom action bar
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
    flex: 2, height: 48, alignItems: 'center', justifyContent: 'center',
    borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary,
  },
  saveBtnText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#fff' },
});
