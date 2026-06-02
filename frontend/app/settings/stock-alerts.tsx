import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { getAlertSettings, updateAlertSettings, getStocks, getStockGroups } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

const EXPIRY_OPTIONS = ['7 Days', '15 Days', '30 Days', '60 Days', '90 Days'];

// ─────────────────────────────────────────────────────────────────────────────
// 1. CustomCheckbox — square themed checkbox
// ─────────────────────────────────────────────────────────────────────────────
function CustomCheckbox({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <TouchableOpacity style={cbx.row} onPress={() => onChange(!value)} activeOpacity={0.7}>
      <View style={[cbx.box, value && cbx.boxChecked]}>
        {value && <Ionicons name="checkmark" size={13} color={COLORS.white} />}
      </View>
      <Text style={cbx.label}>{label}</Text>
    </TouchableOpacity>
  );
}
const cbx = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  box: {
    width: 22, height: 22, borderRadius: 5,
    borderWidth: 2, borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center', justifyContent: 'center',
  },
  boxChecked: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  label: { fontSize: TYPOGRAPHY.base, fontWeight: '500', color: COLORS.textPrimary, flex: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PickerSheet — simple option list bottom sheet
// ─────────────────────────────────────────────────────────────────────────────
function PickerSheet({
  visible, title, options, selected, onSelect, onClose,
}: {
  visible: boolean; title: string; options: string[];
  selected: string; onSelect: (v: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={psh.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={psh.sheet}>
          <View style={psh.handle} />
          <Text style={psh.title}>{title}</Text>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              style={psh.optRow}
              onPress={() => { onSelect(opt); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={[psh.optTxt, opt === selected && psh.optTxtActive]}>{opt}</Text>
              {opt === selected && (
                <Ionicons name="checkmark" size={18} color={COLORS.brandPrimary} />
              )}
            </TouchableOpacity>
          ))}
          <View style={{ height: 20 }} />
        </View>
      </View>
    </Modal>
  );
}
const psh = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SPACING.lg, paddingTop: 12, paddingBottom: 8,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong,
    alignSelf: 'center', marginBottom: 16,
  },
  title: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  optRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  optTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, fontWeight: '500' },
  optTxtActive: { color: COLORS.brandPrimary, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DrumColumn + TimePickerSheet (same as notification-channels)
// ─────────────────────────────────────────────────────────────────────────────
const ITEM_H  = 52;
const VISIBLE = 5;
const DRUM_H  = ITEM_H * VISIBLE;

function DrumColumn({
  items, selected, onSelect,
}: {
  items: string[]; selected: string; onSelect: (v: string) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const idx = items.indexOf(selected);

  const handleLayout = () => {
    if (scrollRef.current && idx >= 0) {
      scrollRef.current.scrollTo({ y: idx * ITEM_H, animated: false });
    }
  };
  const handleScrollEnd = (e: any) => {
    const i = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.y / ITEM_H), items.length - 1));
    onSelect(items[i]);
  };

  return (
    <View style={dc.wrapper}>
      <View style={dc.selectionBg} pointerEvents="none" />
      <View style={dc.topFade}    pointerEvents="none" />
      <View style={dc.bottomFade} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onLayout={handleLayout}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
      >
        {items.map(item => {
          const isSel = item === selected;
          return (
            <TouchableOpacity
              key={item} style={dc.item} activeOpacity={0.6}
              onPress={() => {
                onSelect(item);
                scrollRef.current?.scrollTo({ y: items.indexOf(item) * ITEM_H, animated: true });
              }}
            >
              <Text style={[dc.itemTxt, isSel && dc.itemTxtSel]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
const dc = StyleSheet.create({
  wrapper: { flex: 1, height: DRUM_H, overflow: 'hidden', position: 'relative' },
  item:    { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemTxt: { fontSize: 18, fontWeight: '400', color: COLORS.textTertiary },
  itemTxtSel: { fontSize: 24, fontWeight: '700', color: COLORS.brandPrimary },
  selectionBg: {
    position: 'absolute', left: 4, right: 4,
    top: ITEM_H * Math.floor(VISIBLE / 2), height: ITEM_H,
    borderRadius: 10, backgroundColor: COLORS.pageBg,
    borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: COLORS.borderStrong, zIndex: 0,
  },
  topFade: {
    position: 'absolute', left: 0, right: 0, top: 0,
    height: ITEM_H * Math.floor(VISIBLE / 2),
    backgroundColor: 'rgba(255,255,255,0.72)', zIndex: 1,
  },
  bottomFade: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: ITEM_H * Math.floor(VISIBLE / 2),
    backgroundColor: 'rgba(255,255,255,0.72)', zIndex: 1,
  },
});

const HOURS   = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55'];
const PERIODS = ['AM','PM'];

function parseTime(t: string) {
  const m = t.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  return m
    ? { h: m[1].padStart(2,'0'), mi: m[2].padStart(2,'0'), p: m[3].toUpperCase() }
    : { h: '05', mi: '00', p: 'PM' };
}

function TimePickerSheet({
  visible, label, initialTime, onClose, onConfirm,
}: {
  visible: boolean; label: string; initialTime: string;
  onClose: () => void; onConfirm: (t: string) => void;
}) {
  const { h: ih, mi: im, p: ip } = parseTime(initialTime);
  const [selH, setSelH] = useState(ih);
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => setIsDirty(true);
  const [selM, setSelM] = useState(im);
  const [selP, setSelP] = useState(ip);

  useEffect(() => {
    if (visible) {
      const { h, mi, p } = parseTime(initialTime);
      setSelH(h); setSelM(mi); setSelP(p);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tp.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={tp.sheet}>
          <View style={tp.handle} />
          <Text style={tp.label}>{label}</Text>
          <View style={tp.drums}>
            <DrumColumn items={HOURS}   selected={selH} onSelect={setSelH} />
            <Text style={tp.colon}>:</Text>
            <DrumColumn items={MINUTES} selected={selM} onSelect={setSelM} />
            <View style={{ width: 16 }} />
            <DrumColumn items={PERIODS} selected={selP} onSelect={setSelP} />
          </View>
          <View style={tp.btnRow}>
            <TouchableOpacity style={tp.cancelBtn} onPress={onClose} activeOpacity={0.75}>
              <Text style={tp.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={tp.doneBtn}
              onPress={() => onConfirm(`${selH}:${selM} ${selP}`)}
              activeOpacity={0.85}
            >
              <Text style={tp.doneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 24 }} />
        </View>
      </View>
    </Modal>
  );
}
const tp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SPACING.lg, paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong,
    alignSelf: 'center', marginBottom: 16,
  },
  label: {
    fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary,
    textAlign: 'center', marginBottom: 20,
  },
  drums:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  colon:  { fontSize: 28, fontWeight: '700', color: COLORS.brandPrimary, marginHorizontal: 4, marginBottom: 4 },
  btnRow: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: RADIUS.md,
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    alignItems: 'center',
  },
  cancelTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },
  doneBtn:   { flex: 2, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center' },
  doneTxt:   { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.white },
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. ItemSelectorSheet — multi-select with search
// ─────────────────────────────────────────────────────────────────────────────
function ItemSelectorSheet({
  visible, category, currentSelection, onClose, onConfirm, realItems, realGroups,
}: {
  visible: boolean;
  category: 'group' | 'item';
  currentSelection: string[];
  onClose: () => void;
  onConfirm: (names: string[]) => void;
  realItems: string[];
  realGroups: string[];
}) {
  const allItems = category === 'item' ? realItems : realGroups;
  const [search,  setSearch]  = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set(currentSelection));
  const markDirty = () => {};

  useEffect(() => {
    if (visible) { setSearch(''); setChecked(new Set(currentSelection)); }
  }, [visible]);

  const filtered = allItems.filter(i => i.toLowerCase().includes(search.toLowerCase()));

  const toggle = (name: string) =>
    setChecked(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={iss.overlay}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={iss.sheet}>
          <View style={iss.handle} />
          <Text style={iss.title}>
            {category === 'item' ? 'Select Items' : 'Select Groups'}
          </Text>

          {/* Search bar */}
          <View style={iss.searchWrap}>
            <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
            <TextInput
              style={iss.searchInput}
              value={search}
              onChangeText={v => { setSearch(v); markDirty(); }}
              placeholder={`Search ${category === 'item' ? 'items' : 'groups'}…`}
              placeholderTextColor={COLORS.textTertiary}
              selectionColor={COLORS.brandPrimary}
              autoFocus
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Count pill */}
          {checked.size > 0 && (
            <View style={iss.countPill}>
              <Text style={iss.countTxt}>{checked.size} selected</Text>
            </View>
          )}

          {/* List */}
          <FlatList
            data={filtered}
            keyExtractor={item => item}
            style={iss.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isChecked = checked.has(item);
              return (
                <TouchableOpacity
                  style={iss.listRow}
                  onPress={() => toggle(item)}
                  activeOpacity={0.7}
                >
                  <View style={[iss.checkbox, isChecked && iss.checkboxChecked]}>
                    {isChecked && <Ionicons name="checkmark" size={13} color={COLORS.white} />}
                  </View>
                  <Text style={[iss.listRowTxt, isChecked && iss.listRowTxtActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={iss.empty}>
                <Ionicons name="search-outline" size={28} color={COLORS.textTertiary} />
                <Text style={iss.emptyTxt}>No results found</Text>
              </View>
            }
          />

          {/* Footer */}
          <View style={iss.footer}>
            <TouchableOpacity style={iss.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={iss.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={iss.doneBtn}
              onPress={() => { onConfirm(Array.from(checked)); onClose(); }}
              activeOpacity={0.85}
            >
              <Text style={iss.doneTxt}>
                Done {checked.size > 0 ? `(${checked.size})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const iss = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, maxHeight: '78%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong,
    alignSelf: 'center', marginBottom: 14,
  },
  title: {
    fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary,
    paddingHorizontal: SPACING.lg, marginBottom: 12,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: SPACING.lg, marginBottom: 8,
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
  },
  searchInput: {
    flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, padding: 0,
  },
  countPill: {
    alignSelf: 'flex-start', marginHorizontal: SPACING.lg, marginBottom: 6,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  countTxt: { fontSize: 11, color: COLORS.white, fontWeight: '700' },
  list:     { maxHeight: 300 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: SPACING.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 5,
    borderWidth: 2, borderColor: COLORS.borderStrong, backgroundColor: COLORS.cardBg,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  listRowTxt:      { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, fontWeight: '500', flex: 1 },
  listRowTxtActive:{ color: COLORS.textPrimary, fontWeight: '700' },
  empty:   { alignItems: 'center', padding: 28, gap: 8 },
  emptyTxt:{ fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
  footer: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: SPACING.lg, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: RADIUS.md,
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    alignItems: 'center',
  },
  cancelTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },
  doneBtn:   { flex: 2, paddingVertical: 13, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center' },
  doneTxt:   { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.white },
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type SelectedEntry = { name: string; reorderPoint: number };

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function StockAlertsScreen() {
  const { company } = useAuth();
  const companyGuid = company?.guid;

  // Real items + groups for the selector
  const [realItems,  setRealItems]  = useState<string[]>([]);
  const [realGroups, setRealGroups] = useState<string[]>([]);

  // Load alert settings + stock items/groups from backend
  React.useEffect(() => {
    getAlertSettings().then((res: any) => {
      if (res?.data) {
        // Settings loaded — future: populate specific fields when UI is wired
      }
    }).catch(() => {});

    if (!companyGuid) return;

    // Load real stock items
    getStocks(companyGuid, { limit: '500' })
      .then((res: any) => {
        const rows: any[] = res?.data?.items || res?.data || [];
        setRealItems(rows.map((r: any) => r.name).filter(Boolean));
      })
      .catch(() => {});

    // Load real stock groups
    getStockGroups(companyGuid)
      .then((res: any) => {
        const groups: any[] = res?.data || [];
        setRealGroups(groups.map((g: any) => g.name).filter(Boolean));
      })
      .catch(() => {});
  }, [companyGuid]);

  const saveToBackend = async (extraData?: any) => {
    try {
      await updateAlertSettings({
        stock_alerts: {
          category,
          selected_entries: selectedEntries,
          include_negative: includeNeg,
          expiry_days: expiryDays,
          tracked_batches: trackedBatches,
          group_by_warehouse: groupByWh,
          channels,
          frequency: freq,
          send_time: sendTime,
        },
        ...(extraData || {}),
      });
    } catch {}
  };

  const router = useRouter();

  // ── Low Stock ────────────────────────────────────────────────────────────
  const [category,        setCategory]        = useState<'group' | 'item'>('group');
  const [selectedEntries, setSelectedEntries] = useState<SelectedEntry[]>([]);
  const [includeNeg,      setIncludeNeg]      = useState(false);
  const [showSelector,    setShowSelector]    = useState(false);

  // ── Expiry ───────────────────────────────────────────────────────────────
  const [expiryDays,       setExpiryDays]       = useState('30 Days');
  const [trackedBatches,   setTrackedBatches]   = useState(true);
  const [groupByWh,        setGroupByWh]        = useState(false);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);

  // ── Delivery & Schedule ──────────────────────────────────────────────────
  const [channels, setChannels] = useState({ push: true, email: false, whatsapp: true, sms: false });
  const [freq,     setFreq]     = useState<'immediate' | 'daily' | 'weekly'>('daily');
  const [sendTime, setSendTime] = useState('05:00 PM');
  const [showTimePicker, setShowTimePicker] = useState(false);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCategoryChange = (cat: 'group' | 'item') => {
    setCategory(cat);
    setSelectedEntries([]); // clear selection when category changes
  };

  const handleSelectorConfirm = (names: string[]) => {
    setSelectedEntries(prev => {
      const map = new Map(prev.map(e => [e.name, e]));
      return names.map(n => map.get(n) ?? { name: n, reorderPoint: 5 });
    });
  };

  const updateReorder = (name: string, delta: number) =>
    setSelectedEntries(prev =>
      prev.map(e => e.name === name
        ? { ...e, reorderPoint: Math.max(0, e.reorderPoint + delta) }
        : e
      )
    );

  const removeEntry = (name: string) =>
    setSelectedEntries(prev => prev.filter(e => e.name !== name));

  const save = () => { saveToBackend(); Toast.show({ type: 'success', text1: 'Saved', text2: 'Stock alert preferences updated.' }); };

  const currentNames = selectedEntries.map(e => e.name);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Low Stock & Expiry Alerts</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ════════════════════════════════════════════════════════
            LOW STOCK CARD
        ════════════════════════════════════════════════════════ */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.negative} />
            <Text style={s.cardTitle}>Low Stock</Text>
          </View>

          {/* Category chips */}
          <Text style={s.fieldLabel}>Alert Category</Text>
          <View style={s.chipRow}>
            {(['group', 'item'] as const).map(cat => (
              <TouchableOpacity
                key={cat}
                style={[s.chip, category === cat && s.chipActive]}
                onPress={() => handleCategoryChange(cat)}
                activeOpacity={0.7}
              >
                <Text style={[s.chipTxt, category === cat && s.chipTxtActive]}>
                  {cat === 'group' ? 'Group wise' : 'Item wise'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Select Items / Groups field */}
          <TouchableOpacity
            style={s.selectField}
            onPress={() => setShowSelector(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
            <Text style={[s.selectTxt, selectedEntries.length > 0 && s.selectTxtActive]}>
              {selectedEntries.length === 0
                ? `Select ${category === 'group' ? 'Groups' : 'Items'}`
                : `${selectedEntries.length} ${category === 'group' ? 'Group' : 'Item'}${selectedEntries.length !== 1 ? 's' : ''} selected`
              }
            </Text>
            <Ionicons name="chevron-down" size={14} color={COLORS.textTertiary} />
          </TouchableOpacity>

          {/* Selected entries with individual reorder point steppers */}
          {selectedEntries.length > 0 && (
            <View style={s.entriesList}>
              {/* Column header */}
              <View style={s.entriesHeader}>
                <Text style={s.entriesHeaderTxt}>
                  {category === 'group' ? 'Group' : 'Item'}
                </Text>
                <Text style={[s.entriesHeaderTxt, { marginRight: 38 }]}>Reorder Pt.</Text>
              </View>
              {selectedEntries.map((entry, idx) => (
                <View key={entry.name} style={[s.entryRow, idx > 0 && s.entryBorder]}>
                  <Text style={s.entryName} numberOfLines={1}>{entry.name}</Text>
                  <View style={s.entryRight}>
                    {/* Mini stepper */}
                    <View style={s.miniStepper}>
                      <TouchableOpacity
                        style={s.miniBtn}
                        onPress={() => updateReorder(entry.name, -1)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="remove" size={14} color={COLORS.textPrimary} />
                      </TouchableOpacity>
                      <Text style={s.miniVal}>{entry.reorderPoint}</Text>
                      <TouchableOpacity
                        style={s.miniBtn}
                        onPress={() => updateReorder(entry.name, 1)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={14} color={COLORS.textPrimary} />
                      </TouchableOpacity>
                    </View>
                    {/* Remove */}
                    <TouchableOpacity style={s.removeBtn} onPress={() => removeEntry(entry.name)} activeOpacity={0.7}>
                      <Ionicons name="close" size={14} color={COLORS.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Include Negative Stock — square checkbox */}
          <View style={s.divider} />
          <CustomCheckbox
            value={includeNeg}
            onChange={setIncludeNeg}
            label="Include Negative Stock"
          />
        </View>

        {/* ════════════════════════════════════════════════════════
            EXPIRY ALERTS CARD
        ════════════════════════════════════════════════════════ */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="time-outline" size={18} color={COLORS.warning} />
            <Text style={s.cardTitle}>Expiry Alerts</Text>
          </View>

          <Text style={s.fieldLabel}>Alert Before</Text>
          <TouchableOpacity
            style={s.selectField}
            onPress={() => setShowExpiryPicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
            <Text style={s.selectTxtActive}>{expiryDays}</Text>
            <Ionicons name="chevron-down" size={14} color={COLORS.textTertiary} />
          </TouchableOpacity>

          {/* Chips — tracked batches + group by warehouse (always one row) */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: SPACING.md }}>
            {[
              { key: 'tracked', label: 'Only track batches', val: trackedBatches, set: setTrackedBatches },
              { key: 'group',   label: 'Group by warehouse', val: groupByWh,      set: setGroupByWh      },
            ].map(item => (
              <View key={item.key} style={{ flex: 1, overflow: 'hidden' }}>
                <TouchableOpacity
                  style={[s.expiryChip, item.val && s.expiryChipActive, { width: '100%' }]}
                  onPress={() => item.set(p => !p)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.expiryChipTxt, item.val && s.expiryChipTxtActive]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* ════════════════════════════════════════════════════════
            DELIVERY & SCHEDULE CARD
        ════════════════════════════════════════════════════════ */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="send-outline" size={18} color={COLORS.info} />
            <Text style={s.cardTitle}>Delivery & Schedule</Text>
          </View>

          {/* Channel chips */}
          <Text style={s.fieldLabel}>Channels</Text>
          <View style={s.chipRow}>
            {(Object.entries(channels) as [keyof typeof channels, boolean][]).map(([k, v]) => (
              <TouchableOpacity
                key={k}
                style={[s.chip, v && s.chipActive]}
                onPress={() => setChannels(prev => ({ ...prev, [k]: !v }))}
                activeOpacity={0.7}
              >
                <Text style={[s.chipTxt, v && s.chipTxtActive]}>
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Frequency chips */}
          <Text style={[s.fieldLabel, { marginTop: SPACING.md }]}>Frequency</Text>
          <View style={s.chipRow}>
            {([
              { id: 'immediate', label: 'Immediate' },
              { id: 'daily',     label: 'Daily' },
              { id: 'weekly',    label: 'Weekly' },
            ] as const).map(f => (
              <TouchableOpacity
                key={f.id}
                style={[s.chip, freq === f.id && s.chipActive]}
                onPress={() => setFreq(f.id)}
                activeOpacity={0.7}
              >
                <Text style={[s.chipTxt, freq === f.id && s.chipTxtActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Send time — only when Daily or Weekly */}
          {(freq === 'daily' || freq === 'weekly') && (
            <View style={{ marginTop: SPACING.md }}>
              <Text style={s.fieldLabel}>Send Time</Text>
              <TouchableOpacity
                style={s.selectField}
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
                <Text style={s.selectTxtActive}>{sendTime}</Text>
                <Ionicons name="chevron-down" size={14} color={COLORS.textTertiary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.8}>
          <Text style={s.saveTxt}>Save Settings</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Modals ───────────────────────────────────────────────── */}
      <ItemSelectorSheet
        visible={showSelector}
        category={category}
        currentSelection={currentNames}
        onClose={() => setShowSelector(false)}
        onConfirm={handleSelectorConfirm}
        realItems={realItems}
        realGroups={realGroups}
      />

      <PickerSheet
        visible={showExpiryPicker}
        title="Alert Before"
        options={EXPIRY_OPTIONS}
        selected={expiryDays}
        onSelect={setExpiryDays}
        onClose={() => setShowExpiryPicker(false)}
      />

      <TimePickerSheet
        visible={showTimePicker}
        label="Select Send Time"
        initialTime={sendTime}
        onClose={() => setShowTimePicker(false)}
        onConfirm={(t) => { setSendTime(t); setShowTimePicker(false); }}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: COLORS.pageBg },
  hdr:   {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  back:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  scroll:{ padding: SPACING.md, paddingBottom: 40 },

  // Card
  card:     {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  cardHdr:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  cardTitle:{ fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  fieldLabel:{ fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.sm },

  // Chips (category / channels / frequency)
  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
  },
  chipActive:   { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipTxt:      { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  chipTxtActive:{ color: COLORS.white, fontWeight: '700' },

  // Tappable select field
  selectField: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
    marginTop: SPACING.sm,
  },
  selectTxt:      { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textTertiary, fontWeight: '500' },
  selectTxtActive:{ flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary,   fontWeight: '600' },

  // Selected entries list
  entriesList: {
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault,
    marginTop: SPACING.md, overflow: 'hidden',
  },
  entriesHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: COLORS.pageBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  entriesHeaderTxt: { fontSize: 10, fontWeight: '700', color: COLORS.textTertiary, letterSpacing: 0.8 },
  entryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    gap: 8, backgroundColor: COLORS.cardBg,
  },
  entryBorder: { borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  entryName:   { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '600' },
  entryRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniStepper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  miniBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  miniVal: {
    width: 28, textAlign: 'center',
    fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary,
  },
  removeBtn: {
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },

  // Separator above checkbox
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: 4 },

  // Expiry chips (can wrap to two lines)
  expiryChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 8, paddingVertical: 9,
    borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
  },
  expiryChipActive:   { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  expiryChipTxt:      { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', textAlign: 'center' },
  expiryChipTxtActive:{ color: COLORS.white, fontWeight: '700' },

  // Save button
  saveBtn: {
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 15, alignItems: 'center', marginTop: SPACING.sm,
  },
  saveTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
