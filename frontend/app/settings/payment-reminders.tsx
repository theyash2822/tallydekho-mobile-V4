import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, FlatList, Animated,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// Mock party ledger data
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_PARTIES = [
  'Ashok Traders', 'Royal Furnish Co.', 'Sharma Enterprises', 'Gupta & Sons',
  'National Suppliers', 'Prime Distributors', 'ABC Corp', 'Mehta Industries',
  'Singh Electronics', 'Patel Wholesale', 'Jain Brothers', 'Kapoor Agencies',
  'Verma Stores', 'Kumar Exports', 'Desai Holdings',
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Channels = { push: boolean; email: boolean; whatsapp: boolean; sms: boolean };

interface Reminder {
  id: string;
  name: string;
  daysBefore: number;
  time: string;
  onDueDate: boolean;
  enabled: boolean;
  channels: Channels;
  exceptions: string[];
  expanded: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CustomToggle
// ─────────────────────────────────────────────────────────────────────────────
function CustomToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0, useNativeDriver: false, tension: 60, friction: 7,
    }).start();
  }, [value]);
  const trackBg = anim.interpolate({ inputRange: [0, 1], outputRange: [COLORS.borderStrong, COLORS.brandPrimary] });
  const thumbX  = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });
  return (
    <TouchableOpacity onPress={() => onChange(!value)} activeOpacity={0.85}>
      <Animated.View style={[ct.track, { backgroundColor: trackBg }]}>
        <Animated.View style={[ct.thumb, { transform: [{ translateX: thumbX }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}
const ct = StyleSheet.create({
  track: { width: 46, height: 26, borderRadius: 13, justifyContent: 'center' },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.white, elevation: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. CustomCheckbox
// ─────────────────────────────────────────────────────────────────────────────
function CustomCheckbox({
  value, onChange, label,
}: { value: boolean; onChange: (v: boolean) => void; label: string }) {
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: {
    width: 22, height: 22, borderRadius: 5,
    borderWidth: 2, borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
  },
  boxChecked: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  label: { fontSize: TYPOGRAPHY.base, fontWeight: '500', color: COLORS.textPrimary, flex: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DrumColumn + TimePickerSheet
// ─────────────────────────────────────────────────────────────────────────────
const ITEM_H  = 52;
const VISIBLE = 5;
const DRUM_H  = ITEM_H * VISIBLE;

function DrumColumn({ items, selected, onSelect }: { items: string[]; selected: string; onSelect: (v: string) => void }) {
  const scrollRef = useRef<ScrollView>(null);
  const idx = items.indexOf(selected);
  const handleLayout = () => {
    if (scrollRef.current && idx >= 0)
      scrollRef.current.scrollTo({ y: idx * ITEM_H, animated: false });
  };
  const handleEnd = (e: any) => {
    const i = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.y / ITEM_H), items.length - 1));
    onSelect(items[i]);
  };
  return (
    <View style={dc.wrapper}>
      <View style={dc.selBg}    pointerEvents="none" />
      <View style={dc.topFade}  pointerEvents="none" />
      <View style={dc.botFade}  pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onLayout={handleLayout}
        onMomentumScrollEnd={handleEnd}
        onScrollEndDrag={handleEnd}
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
      >
        {items.map(item => {
          const sel = item === selected;
          return (
            <TouchableOpacity
              key={item} style={dc.item} activeOpacity={0.6}
              onPress={() => { onSelect(item); scrollRef.current?.scrollTo({ y: items.indexOf(item) * ITEM_H, animated: true }); }}
            >
              <Text style={[dc.txt, sel && dc.txtSel]}>{item}</Text>
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
  txt:     { fontSize: 18, fontWeight: '400', color: COLORS.textTertiary },
  txtSel:  { fontSize: 24, fontWeight: '700', color: COLORS.brandPrimary },
  selBg: {
    position: 'absolute', left: 4, right: 4,
    top: ITEM_H * Math.floor(VISIBLE / 2), height: ITEM_H,
    borderRadius: 10, backgroundColor: COLORS.pageBg,
    borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: COLORS.borderStrong, zIndex: 0,
  },
  topFade: { position: 'absolute', left: 0, right: 0, top: 0, height: ITEM_H * Math.floor(VISIBLE / 2), backgroundColor: 'rgba(255,255,255,0.72)', zIndex: 1 },
  botFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: ITEM_H * Math.floor(VISIBLE / 2), backgroundColor: 'rgba(255,255,255,0.72)', zIndex: 1 },
});

const HOURS   = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55'];
const PERIODS = ['AM','PM'];

function parseTime(t: string) {
  const m = t.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  return m ? { h: m[1].padStart(2,'0'), mi: m[2].padStart(2,'0'), p: m[3].toUpperCase() } : { h:'10', mi:'00', p:'AM' };
}

function TimePickerSheet({ visible, label, initialTime, onClose, onConfirm }: {
  visible: boolean; label: string; initialTime: string;
  onClose: () => void; onConfirm: (t: string) => void;
}) {
  const { h: ih, mi: im, p: ip } = parseTime(initialTime);
  const [selH, setSelH] = useState(ih);
  const [selM, setSelM] = useState(im);
  const [selP, setSelP] = useState(ip);
  useEffect(() => {
    if (visible) { const { h, mi, p } = parseTime(initialTime); setSelH(h); setSelM(mi); setSelP(p); }
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tp.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={tp.sheet}>
          <View style={tp.handle} />
          <Text style={tp.lbl}>{label}</Text>
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
            <TouchableOpacity style={tp.doneBtn} onPress={() => onConfirm(`${selH}:${selM} ${selP}`)} activeOpacity={0.85}>
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
  sheet: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: SPACING.lg, paddingTop: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginBottom: 16 },
  lbl:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 20 },
  drums:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  colon:  { fontSize: 28, fontWeight: '700', color: COLORS.brandPrimary, marginHorizontal: 4, marginBottom: 4 },
  btnRow: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center' },
  cancelTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },
  doneBtn:   { flex: 2, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center' },
  doneTxt:   { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.white },
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. PartySelectorSheet — multi-select party ledger
// ─────────────────────────────────────────────────────────────────────────────
function PartySelectorSheet({ visible, currentSelection, onClose, onConfirm }: {
  visible: boolean; currentSelection: string[];
  onClose: () => void; onConfirm: (sel: string[]) => void;
}) {
  const [search,  setSearch]  = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set(currentSelection));
  useEffect(() => {
    if (visible) { setSearch(''); setChecked(new Set(currentSelection)); }
  }, [visible]);
  const filtered = MOCK_PARTIES.filter(p => p.toLowerCase().includes(search.toLowerCase()));
  const toggle = (name: string) =>
    setChecked(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={ps.overlay}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={ps.sheet}>
          <View style={ps.handle} />
          <Text style={ps.title}>Select Exception Parties</Text>
          <View style={ps.searchWrap}>
            <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
            <TextInput
              style={ps.searchInput} value={search} onChangeText={setSearch}
              placeholder="Search parties…" placeholderTextColor={COLORS.textTertiary}
              selectionColor={COLORS.brandPrimary} autoFocus
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          {checked.size > 0 && (
            <View style={ps.countPill}>
              <Text style={ps.countTxt}>{checked.size} selected</Text>
            </View>
          )}
          <FlatList
            data={filtered} keyExtractor={i => i} style={ps.list}
            showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isChecked = checked.has(item);
              return (
                <TouchableOpacity style={ps.row} onPress={() => toggle(item)} activeOpacity={0.7}>
                  <View style={[ps.box, isChecked && ps.boxChecked]}>
                    {isChecked && <Ionicons name="checkmark" size={13} color={COLORS.white} />}
                  </View>
                  <Text style={[ps.rowTxt, isChecked && ps.rowTxtActive]}>{item}</Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={ps.empty}>
                <Ionicons name="search-outline" size={28} color={COLORS.textTertiary} />
                <Text style={ps.emptyTxt}>No parties found</Text>
              </View>
            }
          />
          <View style={ps.footer}>
            <TouchableOpacity style={ps.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={ps.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ps.doneBtn} onPress={() => { onConfirm(Array.from(checked)); onClose(); }} activeOpacity={0.85}>
              <Text style={ps.doneTxt}>Done {checked.size > 0 ? `(${checked.size})` : ''}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const ps = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, maxHeight: '75%' },
  handle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginBottom: 14 },
  title:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, paddingHorizontal: SPACING.lg, marginBottom: 12 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: SPACING.lg, marginBottom: 8,
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, padding: 0 },
  countPill:   { alignSelf: 'flex-start', marginHorizontal: SPACING.lg, marginBottom: 6, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 4 },
  countTxt:    { fontSize: 11, color: COLORS.white, fontWeight: '700' },
  list:  { maxHeight: 260 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: SPACING.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  box:   { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: COLORS.borderStrong, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center' },
  boxChecked:    { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  rowTxt:        { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, fontWeight: '500', flex: 1 },
  rowTxtActive:  { color: COLORS.textPrimary, fontWeight: '700' },
  empty:    { alignItems: 'center', padding: 28, gap: 8 },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
  footer:   { flexDirection: 'row', gap: 12, paddingHorizontal: SPACING.lg, paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  cancelBtn:{ flex: 1, paddingVertical: 13, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center' },
  cancelTxt:{ fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },
  doneBtn:  { flex: 2, paddingVertical: 13, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center' },
  doneTxt:  { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.white },
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. ReminderCard
// ─────────────────────────────────────────────────────────────────────────────
function ReminderCard({
  reminder,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: {
  reminder: Reminder;
  index: number;
  onUpdate: (r: Reminder) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [showTimePicker,  setShowTimePicker]  = useState(false);
  const [showPartyPicker, setShowPartyPicker] = useState(false);

  const upd = (patch: Partial<Reminder>) => onUpdate({ ...reminder, ...patch });

  const toggleExpand = () => upd({ expanded: !reminder.expanded });

  const toggleChannel = (key: keyof Channels) =>
    upd({ channels: { ...reminder.channels, [key]: !reminder.channels[key] } });

  const removeException = (name: string) =>
    upd({ exceptions: reminder.exceptions.filter(e => e !== name) });

  const ordinals = ['First', 'Second', 'Third', 'Fourth'];

  return (
    <View style={rc.card}>
      {/* ── Header row ── */}
      <View style={rc.hdr}>
        <Ionicons name="alarm-outline" size={16} color={COLORS.warning} />
        {/* Editable name */}
        <TextInput
          style={rc.nameInput}
          value={reminder.name}
          onChangeText={v => upd({ name: v })}
          placeholder={`${ordinals[index]} Reminder`}
          placeholderTextColor={COLORS.textTertiary}
          selectionColor={COLORS.brandPrimary}
        />
        <CustomToggle value={reminder.enabled} onChange={v => upd({ enabled: v })} />
        {/* Collapse toggle */}
        <TouchableOpacity style={rc.collapseBtn} onPress={toggleExpand} activeOpacity={0.7}>
          <Ionicons
            name={reminder.expanded ? 'chevron-up' : 'chevron-down'}
            size={18} color={COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* ── Body (collapsible) ── */}
      {reminder.expanded && (
        <View style={rc.body}>
          <View style={rc.divider} />

          {/* Day + Time row */}
          <View style={rc.dayTimeRow}>
            {/* Day stepper */}
            <View style={rc.halfBox}>
              <Text style={rc.fieldLabel}>Day</Text>
              <View style={rc.stepper}>
                <TouchableOpacity
                  style={rc.stepBtn}
                  onPress={() => upd({ daysBefore: Math.max(0, reminder.daysBefore - 1) })}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={16} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={rc.stepVal}>{reminder.daysBefore}</Text>
                <TouchableOpacity
                  style={rc.stepBtn}
                  onPress={() => upd({ daysBefore: reminder.daysBefore + 1 })}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={16} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ width: 12 }} />

            {/* Time picker field */}
            <View style={rc.halfBox}>
              <Text style={rc.fieldLabel}>Time</Text>
              <TouchableOpacity
                style={rc.timeField}
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
                <Text style={rc.timeFieldTxt}>{reminder.time || '—'}</Text>
                <Ionicons name="chevron-down" size={12} color={COLORS.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* On Due Date checkbox */}
          <View style={[rc.divider, { marginVertical: 12 }]} />
          <CustomCheckbox
            value={reminder.onDueDate}
            onChange={v => upd({ onDueDate: v })}
            label="On Due Date"
          />

          {/* Channels */}
          <View style={[rc.divider, { marginVertical: 12 }]} />
          <Text style={rc.fieldLabel}>Channels</Text>
          <View style={rc.chipsRow}>
            {(['push','email','whatsapp','sms'] as (keyof Channels)[]).map(ch => {
              const active = reminder.channels[ch];
              return (
                <TouchableOpacity
                  key={ch}
                  style={[rc.chip, active && rc.chipActive]}
                  onPress={() => toggleChannel(ch)}
                  activeOpacity={0.7}
                >
                  <Text style={[rc.chipTxt, active && rc.chipTxtActive]}>
                    {ch.charAt(0).toUpperCase() + ch.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Exceptions List */}
          <View style={[rc.divider, { marginVertical: 12 }]} />
          <View style={rc.exceptHdr}>
            <Text style={rc.fieldLabel}>
              Exceptions List{reminder.exceptions.length > 0 ? ` (${reminder.exceptions.length})` : ''}
            </Text>
          </View>

          {/* Search / open selector */}
          <TouchableOpacity
            style={rc.exceptSearch}
            onPress={() => setShowPartyPicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={15} color={COLORS.textTertiary} />
            <Text style={rc.exceptSearchTxt}>Search parties…</Text>
            <Ionicons name="chevron-down" size={13} color={COLORS.textTertiary} />
          </TouchableOpacity>

          {/* Selected exception chips */}
          {reminder.exceptions.length > 0 && (
            <View style={rc.exceptChips}>
              {reminder.exceptions.map(e => (
                <View key={e} style={rc.exceptChip}>
                  <Text style={rc.exceptChipTxt} numberOfLines={1}>{e}</Text>
                  <TouchableOpacity onPress={() => removeException(e)} style={rc.exceptChipX} activeOpacity={0.7}>
                    <Ionicons name="close" size={11} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Remove this reminder (only for non-first reminders) */}
          {canRemove && (
            <TouchableOpacity style={rc.removeBtn} onPress={onRemove} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={14} color={COLORS.negative} />
              <Text style={rc.removeTxt}>Remove Reminder</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Modals */}
      <TimePickerSheet
        visible={showTimePicker}
        label="Select Send Time"
        initialTime={reminder.time || '10:00 AM'}
        onClose={() => setShowTimePicker(false)}
        onConfirm={t => { upd({ time: t }); setShowTimePicker(false); }}
      />
      <PartySelectorSheet
        visible={showPartyPicker}
        currentSelection={reminder.exceptions}
        onClose={() => setShowPartyPicker(false)}
        onConfirm={sel => { upd({ exceptions: sel }); setShowPartyPicker(false); }}
      />
    </View>
  );
}

const rc = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    marginBottom: SPACING.md, overflow: 'hidden',
  },
  hdr: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
  },
  nameInput: {
    flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700',
    color: COLORS.textPrimary,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.pageBg,
    // Remove native web focus outline
    outlineStyle: 'none',
  } as any,
  collapseBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  body:    { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  divider: { height: 1, backgroundColor: COLORS.borderDefault },

  fieldLabel: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '600',
    color: COLORS.textSecondary, marginBottom: 8,
  },

  // Day + Time side by side
  dayTimeRow: { flexDirection: 'row', marginTop: 12 },
  halfBox:    { flex: 1 },
  stepper:    {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
    justifyContent: 'space-between', overflow: 'hidden',
  },
  stepBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  stepVal: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },

  timeField: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    paddingHorizontal: 10, paddingVertical: 10,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
  },
  timeFieldTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },

  // Channel chips
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:     { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg, borderWidth: 1.5, borderColor: COLORS.borderDefault },
  chipActive:   { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipTxt:      { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  chipTxtActive:{ color: COLORS.white, fontWeight: '700' },

  // Exceptions
  exceptHdr:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exceptSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
  },
  exceptSearchTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, fontWeight: '500' },
  exceptChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  exceptChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    maxWidth: 160,
  },
  exceptChipTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, fontWeight: '600', flex: 1 },
  exceptChipX:   { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },

  // Remove button
  removeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 16, paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: RADIUS.md, backgroundColor: '#FEF2F2',
    borderWidth: 1, borderColor: '#FCA5A5', alignSelf: 'flex-start',
  },
  removeTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.negative, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_REMINDERS: Reminder[] = [
  {
    id: 'r1', name: 'First Reminder', daysBefore: 3, time: '10:00 AM',
    onDueDate: false, enabled: true,
    channels: { push: true, email: false, whatsapp: true, sms: false },
    exceptions: [], expanded: true,
  },
  {
    id: 'r2', name: 'Due Date Alert', daysBefore: 0, time: '09:00 AM',
    onDueDate: true, enabled: true,
    channels: { push: true, email: true, whatsapp: false, sms: false },
    exceptions: [], expanded: false,
  },
];

let nextId = 3;

export default function PaymentRemindersScreen() {
  const router = useRouter();
  const [threshold, setThreshold] = useState('500');
  const [reminders, setReminders] = useState<Reminder[]>(DEFAULT_REMINDERS);

  const updateReminder = (updated: Reminder) =>
    setReminders(prev => prev.map(r => r.id === updated.id ? updated : r));

  const removeReminder = (id: string) =>
    setReminders(prev => prev.filter(r => r.id !== id));

  const addReminder = () => {
    if (reminders.length >= 4) return;
    const ordinals = ['First', 'Second', 'Third', 'Fourth'];
    setReminders(prev => [
      ...prev,
      {
        id: `r${nextId++}`,
        name: `${ordinals[prev.length]} Reminder`,
        daysBefore: 0, time: '',
        onDueDate: false, enabled: false,
        channels: { push: false, email: false, whatsapp: false, sms: false },
        exceptions: [], expanded: true,
      },
    ]);
  };

  const save = () =>
    Toast.show({ type: 'success', text1: 'Saved', text2: 'Payment reminder settings updated.' });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Payment Reminders</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Threshold ─────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="filter-outline" size={18} color={COLORS.info} />
            <Text style={s.cardTitle}>Threshold</Text>
          </View>
          <Text style={s.cardSub}>Don't send reminders for invoices below</Text>
          <View style={s.threshRow}>
            <Text style={s.rupee}>₹</Text>
            <TextInput
              style={s.threshInput}
              value={threshold}
              onChangeText={v => { setThreshold(v); markDirty(); }}
              keyboardType="numeric"
              placeholder="500"
              placeholderTextColor={COLORS.textTertiary}
              selectionColor={COLORS.brandPrimary}
            />
          </View>
        </View>

        {/* ── List of Reminders ────────────────────────────────── */}
        <Text style={s.sectionLabel}>List of Reminders</Text>
        {reminders.map((r, idx) => (
          <ReminderCard
            key={r.id}
            reminder={r}
            index={idx}
            onUpdate={updateReminder}
            onRemove={() => removeReminder(r.id)}
            canRemove={idx > 0}
          />
        ))}

        {/* ── Add Reminder button ───────────────────────────────── */}
        {reminders.length < 4 && (
          <TouchableOpacity style={s.addBtn} onPress={addReminder} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={20} color={COLORS.brandPrimary} />
            <Text style={s.addBtnTxt}>Add Reminder</Text>
            <Text style={s.addBtnCap}>{reminders.length}/4</Text>
          </TouchableOpacity>
        )}

        {reminders.length >= 4 && (
          <View style={s.maxReached}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.textTertiary} />
            <Text style={s.maxReachedTxt}>Maximum 4 reminders reached</Text>
          </View>
        )}

        {/* ── Save ─────────────────────────────────────────────── */}
        <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.8}>
          <Text style={s.saveTxt}>Save Settings</Text>
        </TouchableOpacity>
      </ScrollView>
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

  // Threshold card
  card:     { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardHdr:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle:{ fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  cardSub:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  threshRow:{
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  rupee:      { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textSecondary, marginRight: 8 },
  threshInput:{ flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, padding: 0 },

  // Section label
  sectionLabel: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '700',
    color: COLORS.textSecondary, marginBottom: SPACING.sm,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  // Add Reminder button
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    paddingVertical: 14, paddingHorizontal: SPACING.md,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
    borderStyle: 'dashed', marginBottom: SPACING.md,
  },
  addBtnTxt: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.brandPrimary },
  addBtnCap: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600' },

  // Max reached notice
  maxReached: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, marginBottom: SPACING.md, justifyContent: 'center',
  },
  maxReachedTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '500' },

  // Save
  saveBtn: { backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 15, alignItems: 'center', marginTop: SPACING.sm },
  saveTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
