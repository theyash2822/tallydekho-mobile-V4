import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
  LayoutAnimation, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import BrandSwitch from '../../src/components/forms/BrandSwitch';
import { useAuth } from '../../src/context/AuthContext';
import { getInventorySettings, saveInventorySettings } from '../../src/services/api';
import { useTranslation } from 'react-i18next';

// LayoutAnimation works without UIManager.setLayoutAnimationEnabledExperimental
// on New Architecture (Expo SDK 53+); that API is a no-op and only logs a warning.

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
  batch_tracking_app_enabled:     boolean;
  expiry_tracking_app_enabled:    boolean;
  allow_negative_stock_app:       boolean;
  hsn_verification_enabled:       boolean;
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
  batch_tracking_app_enabled:     false,
  expiry_tracking_app_enabled:    false,
  allow_negative_stock_app:       false,
  hsn_verification_enabled:       true,
};

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
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company } = useAuth();
  const companyGuid = company?.guid;

  // ── Loading / saving state
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [isDirty,   setIsDirty]   = useState(false);
  const [loadError, setLoadError] = useState(false);

  // ── Numeric draft state: allows clearing and retyping without snapping to 0
  // Keys: Settings field names + 'expiry_days'
  const [drafts, setDrafts] = useState<Record<string, string>>({});

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
  const [expandedWh,     setExpandedWh]     = useState<string | null>(null);
  const [productDispOpen, setProductDispOpen] = useState(false);
  const [fastSlowOpen,   setFastSlowOpen]   = useState(false);
  const [tallyBatchStats, setTallyBatchStats] = useState<{ batch_enabled_count: number; expiry_enabled_count: number; total_stock_items: number } | null>(null);

  // ── Load settings on mount
  const loadSettings = useCallback(async () => {
    if (!companyGuid) { setLoading(false); return; }
    setDrafts({}); // clear any stale drafts on reload
    try {
      const res = await getInventorySettings(companyGuid);
      if (res?.success && res.data) {
        const { settings: srv, available_uoms, warehouses: wh, tally_derived } = res.data;
        if (tally_derived?.batch_stats) setTallyBatchStats(tally_derived.batch_stats);
        // Merge UoMs — if loaded unit isn't in the list, prepend it so checkmark shows
        if (available_uoms?.length) {
          const loadedUnit = srv?.default_unit_for_new_items;
          const merged = loadedUnit && !available_uoms.includes(loadedUnit)
            ? [loadedUnit, ...available_uoms]
            : available_uoms;
          setAvailableUoms(merged);
        }
        if (wh?.length) setWarehouses(wh);
        if (srv) {
          setSettings(prev => ({
            ...prev,
            ...srv,
            // Ensure nested objects are proper (pg jsonb comes as plain obj)
            inventory_aging_rules:   srv.inventory_aging_rules   || prev.inventory_aging_rules,
            low_stock_alerts:        srv.low_stock_alerts        || prev.low_stock_alerts,
            negative_stock_alerts:   srv.negative_stock_alerts   || prev.negative_stock_alerts,
            expiry_alerts:           srv.expiry_alerts           || prev.expiry_alerts,
            fast_slow_moving_alerts: srv.fast_slow_moving_alerts || prev.fast_slow_moving_alerts,
            warehouse_code_map:      srv.warehouse_code_map      || {},
            cycle_count_frequency_map: srv.cycle_count_frequency_map || {},
            archive_stock_layers_map:  srv.archive_stock_layers_map  || {},
          }));
        }
      }
    } catch (e) {
      console.warn('[StockSettings] load failed:', e);
      setLoadError(true);
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

  // ── Numeric draft helpers — prevent integer snapping while user types ──
  // Display value: show draft string if mid-edit, else show the committed number
  const dv = (key: string, val: number): string =>
    drafts[key] !== undefined ? drafts[key] : String(val);

  // Update handler for numeric fields
  const numChange = (key: keyof Settings, raw: string) => {
    setDrafts(prev => ({ ...prev, [key]: raw }));
    setIsDirty(true);
    if (raw === '') return; // allow empty while typing
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 0) update(key, n as Settings[typeof key]);
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

  const updateExpiryAlert = (channel: keyof AlertChannels) => {
    setSettings(prev => ({
      ...prev,
      expiry_alerts: { ...prev.expiry_alerts, [channel]: !prev.expiry_alerts[channel] },
    }));
    setIsDirty(true);
  };

  const updateWhCode = (whId: string, code: string) => {
    setSettings(prev => ({ ...prev, warehouse_code_map: { ...prev.warehouse_code_map, [whId]: code } }));
    setIsDirty(true);
  };

  // ── Save — flush any remaining drafts before sending
  const handleSave = async () => {
    if (!companyGuid) return;
    setSaving(true);
    try {
      // Flush numeric drafts into settings snapshot
      const numKeys: Array<keyof Settings> = [
        'purchase_buffer_days', 'default_low_stock_level',
        'fast_moving_top_pct', 'slow_moving_no_movement_days', 'dead_stock_no_movement_days',
      ];
      const flushed: Partial<Settings> = {};
      for (const key of numKeys) {
        const d = drafts[key as string];
        if (d !== undefined) {
          const n = parseInt(d, 10);
          if (!isNaN(n) && n >= 0) (flushed as any)[key] = n;
        }
      }
      // Flush expiry days draft
      let flushedExpiry = settings.expiry_alerts;
      if (drafts['expiry_days'] !== undefined) {
        const n = parseInt(drafts['expiry_days'], 10);
        if (!isNaN(n) && n >= 1) flushedExpiry = { ...flushedExpiry, daysBefore: n };
      }
      const finalSettings: Settings = {
        ...settings,
        ...flushed,
        expiry_alerts: flushedExpiry,
      };
      await saveInventorySettings(companyGuid, finalSettings);
      setDrafts({});
      setIsDirty(false);
      Toast.show({ type: 'success', text1: 'Settings saved successfully' });
    } catch {
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
          <Text style={s.headerTitle}>{t('stocks.settings')}</Text>
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

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('stocks.settings')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Load error banner */}
      {loadError && (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color="#B91C1C" />
          <Text style={s.errorBannerText}>Failed to load settings. Showing defaults — save only if correct.</Text>
          <TouchableOpacity onPress={() => { setLoadError(false); setLoading(true); loadSettings(); }} activeOpacity={0.7}>
            <Text style={s.errorBannerRetry}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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

              {/* Default Unit (display fallback when Tally unit is blank) */}
              <TouchableOpacity
                style={s.fieldRow}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setUomOpen(v => !v); }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Default Unit</Text>
                  <Text style={s.fieldSub}>App/web only — used when an item or voucher line has no unit from Tally</Text>
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
                  <Text style={s.fieldSub}>App-only — added into Reorder Queue suggest qty (not written to Tally)</Text>
                </View>
                <View style={s.inputWithUnit}>
                  <TextInput
                    style={s.inlineInput}
                    value={dv('purchase_buffer_days', s_obj.purchase_buffer_days)}
                    onChangeText={v => numChange('purchase_buffer_days', v)}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                  <Text style={s.unitLabel}>Days</Text>
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
            <Text style={s.sectionTitle}>{t('stocks.warehouses')}</Text>
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
                      {/* Warehouse Code → Tally Godown Alias (append-only) */}
                      <View style={s.whFieldColRow}>
                        <Text style={s.whFieldLabel}>Warehouse Code</Text>
                        <TextInput
                          style={[s.whInput, { maxWidth: undefined, width: '100%', textAlign: 'left', marginTop: 6 }]}
                          value={s_obj.warehouse_code_map[wh.id] || ''}
                          onChangeText={v => updateWhCode(wh.id, v)}
                          placeholder="e.g. JPR-MAIN"
                          placeholderTextColor={COLORS.textTertiary}
                          autoCapitalize="characters"
                          maxLength={20}
                        />
                        <Text style={[s.fieldSub, { marginTop: 6 }]}>
                          Saved as Tally Godown Alias. Existing aliases are kept — we only add this code.
                        </Text>
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

              {/* Batch / Lot Tracking — UX gate; sync default from Tally */}
              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Text style={s.fieldLabel}>Batch / Lot Tracking</Text>
                  <Text style={s.fieldSub}>
                    Shows batch fields in the app. Enable the same in Tally for books to match.
                    {tallyBatchStats
                      ? ` Tally: ${tallyBatchStats.batch_enabled_count}/${tallyBatchStats.total_stock_items} items.`
                      : ''}
                  </Text>
                </View>
                <BrandSwitch
                  value={s_obj.batch_tracking_app_enabled}
                  onValueChange={v => update('batch_tracking_app_enabled', v)}
                />
              </View>
              {s_obj.batch_tracking_app_enabled && (
                <View style={s.tallyPendingWrap}>
                  <Ionicons name="information-circle-outline" size={12} color={AMBER} />
                  <Text style={s.tallyPendingText}>App preference. We don’t change Tally company features from here.</Text>
                </View>
              )}

              <View style={s.divider} />

              {/* Expiry-Date Tracking */}
              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Text style={s.fieldLabel}>Expiry-Date Tracking</Text>
                  <Text style={s.fieldSub}>
                    Shows expiry fields when batch is used.
                    {tallyBatchStats
                      ? ` Tally: ${tallyBatchStats.expiry_enabled_count}/${tallyBatchStats.total_stock_items} items.`
                      : ''}
                  </Text>
                </View>
                <BrandSwitch
                  value={s_obj.expiry_tracking_app_enabled}
                  onValueChange={v => update('expiry_tracking_app_enabled', v)}
                />
              </View>
              {s_obj.expiry_tracking_app_enabled && (
                <View style={s.tallyPendingWrap}>
                  <Ionicons name="information-circle-outline" size={12} color={AMBER} />
                  <Text style={s.tallyPendingText}>App preference. Enable expiry on stock items in Tally Prime for existing items.</Text>
                </View>
              )}

              <View style={s.divider} />

              {/* Allow Negative Stock */}
              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Text style={s.fieldLabel}>Allow Negative Stock</Text>
                  <Text style={s.fieldSub}>When off, the app warns before an outbound that would go below zero (no hard block)</Text>
                </View>
                <BrandSwitch
                  value={s_obj.allow_negative_stock_app}
                  onValueChange={v => update('allow_negative_stock_app', v)}
                />
              </View>

              <View style={s.divider} />

              {/* HSN Code Verification */}
              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Text style={s.fieldLabel}>HSN Code Verification</Text>
                  <Text style={s.fieldSub}>Flag items whose HSN is missing or not in our GST list. Soft warning only — never blocks save.</Text>
                </View>
                <BrandSwitch
                  value={s_obj.hsn_verification_enabled !== false}
                  onValueChange={v => update('hsn_verification_enabled', v)}
                />
              </View>

              <View style={s.divider} />

              {/* Default Low Stock Level */}
              <View style={s.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Default Low Stock Level</Text>
                  <Text style={s.fieldSub}>Items with qty 1…this level count as Low Stock</Text>
                </View>
                <View style={s.inputWithUnit}>
                  <TextInput
                    style={s.inlineInput}
                    value={dv('default_low_stock_level', s_obj.default_low_stock_level)}
                    onChangeText={v => numChange('default_low_stock_level', v)}
                    keyboardType="numeric"
                    maxLength={6}
                  />
                  <Text style={s.unitLabel}>Units</Text>
                </View>
              </View>

              <View style={s.divider} />

              {/* Fast / Slow / Dead — FY-based, app+web read only */}
              <TouchableOpacity
                style={s.fieldRow}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setFastSlowOpen(v => !v); }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Fast / Slow / Dead Moving</Text>
                  <Text style={s.fieldSub}>Classification for stock reports (current FY)</Text>
                </View>
                <Ionicons name={fastSlowOpen ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textTertiary} />
              </TouchableOpacity>
              {fastSlowOpen && (
                <View style={s.fastSlowWrap}>
                  <Text style={s.fastSlowSectionLabel}>Fast Moving — Top %</Text>
                  <View style={s.fastSlowRow}>
                    <TextInput
                      style={[s.inlineInput, { width: 70 }]}
                      value={dv('fast_moving_top_pct', s_obj.fast_moving_top_pct)}
                      onChangeText={v => numChange('fast_moving_top_pct', v)}
                      keyboardType="numeric"
                      maxLength={3}
                    />
                    <Text style={s.unitLabel}>% of active items by outward qty</Text>
                  </View>

                  <Text style={s.fastSlowSectionLabel}>Slow Moving — No movement for</Text>
                  <View style={s.fastSlowRow}>
                    <TextInput
                      style={[s.inlineInput, { width: 70 }]}
                      value={dv('slow_moving_no_movement_days', s_obj.slow_moving_no_movement_days)}
                      onChangeText={v => numChange('slow_moving_no_movement_days', v)}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    <Text style={s.unitLabel}>Days</Text>
                  </View>

                  <Text style={s.fastSlowSectionLabel}>Dead Stock — No movement for</Text>
                  <View style={s.fastSlowRow}>
                    <TextInput
                      style={[s.inlineInput, { width: 70 }]}
                      value={dv('dead_stock_no_movement_days', s_obj.dead_stock_no_movement_days)}
                      onChangeText={v => numChange('dead_stock_no_movement_days', v)}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    <Text style={s.unitLabel}>Days</Text>
                  </View>
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
                      value={drafts['expiry_days'] !== undefined ? drafts['expiry_days'] : String(s_obj.expiry_alerts.daysBefore)}
                      onChangeText={v => {
                        setDrafts(prev => ({ ...prev, expiry_days: v }));
                        setIsDirty(true);
                        if (v !== '') {
                          const n = parseInt(v, 10);
                          if (!isNaN(n) && n >= 1) update('expiry_alerts', { ...s_obj.expiry_alerts, daysBefore: n });
                        }
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
      </KeyboardAvoidingView>

      {/* ── Fixed Bottom Action Bar */}
      {isDirty && (
        <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={s.cancelBtn}
            onPress={() => { setIsDirty(false); setDrafts({}); loadSettings(); }}
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

  // Error banner
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#FECACA',
  },
  errorBannerText:  { flex: 1, fontSize: TYPOGRAPHY.xs, color: '#B91C1C', fontWeight: '500' },
  errorBannerRetry: { fontSize: TYPOGRAPHY.xs, color: '#B91C1C', fontWeight: '700', textDecorationLine: 'underline' },

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

  // Tally controlled badge + pending note
  tallyBadgeWrap: { paddingHorizontal: SPACING.md, paddingBottom: 10 },
  tallyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: COLORS.hoverBg,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm,
  },
  tallyBadgeText: { fontSize: 10, color: AMBER, fontWeight: '600' },
  tallyPendingWrap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#FDE68A',
  },
  tallyPendingText: { flex: 1, fontSize: TYPOGRAPHY.xs, color: '#92400E', fontWeight: '500', lineHeight: 16 },

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
