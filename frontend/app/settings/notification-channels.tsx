import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// CustomToggle
// ─────────────────────────────────────────────────────────────────────────────
function CustomToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: value ? 1 : 0, useNativeDriver: false, tension: 60, friction: 7 }).start();
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
// Drum-roll scroll column
// ─────────────────────────────────────────────────────────────────────────────
const ITEM_H  = 52;   // height of each row in the drum
const VISIBLE = 5;    // number of rows visible (must be odd)
const DRUM_H  = ITEM_H * VISIBLE; // total visible height = 260

function DrumColumn({
  items,
  selected,
  onSelect,
}: {
  items: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const idx = items.indexOf(selected);

  // Scroll to the current selection once layout is ready
  const handleLayout = () => {
    if (scrollRef.current && idx >= 0) {
      scrollRef.current.scrollTo({ y: idx * ITEM_H, animated: false });
    }
  };

  const handleScrollEnd = (e: any) => {
    const raw = e.nativeEvent.contentOffset.y;
    const i   = Math.max(0, Math.min(Math.round(raw / ITEM_H), items.length - 1));
    onSelect(items[i]);
  };

  return (
    <View style={dc.wrapper}>
      {/* centre-line highlight */}
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
        // Padding so first/last items can reach centre
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
      >
        {items.map((item) => {
          const isSelected = item === selected;
          return (
            <TouchableOpacity
              key={item}
              style={dc.item}
              activeOpacity={0.6}
              onPress={() => {
                onSelect(item);
                const i = items.indexOf(item);
                scrollRef.current?.scrollTo({ y: i * ITEM_H, animated: true });
              }}
            >
              <Text style={[dc.itemTxt, isSelected && dc.itemTxtSel]}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const dc = StyleSheet.create({
  wrapper: {
    flex: 1,
    height: DRUM_H,
    overflow: 'hidden',
    position: 'relative',
  },
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTxt: {
    fontSize: 18,
    fontWeight: '400',
    color: COLORS.textTertiary,
  },
  itemTxtSel: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.brandPrimary,
  },
  selectionBg: {
    position: 'absolute',
    left: 4, right: 4,
    top: ITEM_H * Math.floor(VISIBLE / 2),
    height: ITEM_H,
    borderRadius: 10,
    backgroundColor: COLORS.pageBg,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: COLORS.borderStrong,
    zIndex: 0,
  },
  topFade: {
    position: 'absolute', left: 0, right: 0, top: 0,
    height: ITEM_H * Math.floor(VISIBLE / 2),
    backgroundColor: 'rgba(255,255,255,0.72)',
    zIndex: 1,
  },
  bottomFade: {
    position: 'absolute', left: 0, right: 0,
    bottom: 0,
    height: ITEM_H * Math.floor(VISIBLE / 2),
    backgroundColor: 'rgba(255,255,255,0.72)',
    zIndex: 1,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// TimePickerSheet  — bottom sheet with 3-column drum: HH | MM | AM/PM
// ─────────────────────────────────────────────────────────────────────────────
const HOURS   = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55'];
const PERIODS = ['AM','PM'];

function parseTime(t: string): { h: string; m: string; p: string } {
  const match = t.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (match) {
    return {
      h: match[1].padStart(2, '0'),
      m: match[2].padStart(2, '0'),
      p: match[3].toUpperCase(),
    };
  }
  return { h: '10', m: '00', p: 'PM' };
}

function TimePickerSheet({
  visible,
  label,
  initialTime,
  onClose,
  onConfirm,
}: {
  visible:     boolean;
  label:       string;
  initialTime: string;
  onClose:     () => void;
  onConfirm:   (t: string) => void;
}) {
  const { h: initH, m: initM, p: initP } = parseTime(initialTime);
  const [selH, setSelH] = useState(initH);
  const [selM, setSelM] = useState(initM);
  const [selP, setSelP] = useState(initP);

  // Re-sync whenever the sheet opens
  useEffect(() => {
    if (visible) {
      const { h, m, p } = parseTime(initialTime);
      setSelH(h); setSelM(m); setSelP(p);
    }
  }, [visible]);

  const handleDone = () => {
    onConfirm(`${selH}:${selM} ${selP}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tp.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={tp.sheet}>
          {/* Handle */}
          <View style={tp.handle} />
          <Text style={tp.label}>{label}</Text>

          {/* Drum columns */}
          <View style={tp.drums}>
            <DrumColumn items={HOURS}   selected={selH} onSelect={setSelH} />
            <Text style={tp.colon}>:</Text>
            <DrumColumn items={MINUTES} selected={selM} onSelect={setSelM} />
            <View style={tp.separator} />
            <DrumColumn items={PERIODS} selected={selP} onSelect={setSelP} />
          </View>

          {/* Action buttons */}
          <View style={tp.btnRow}>
            <TouchableOpacity style={tp.cancelBtn} onPress={onClose} activeOpacity={0.75}>
              <Text style={tp.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={tp.doneBtn} onPress={handleDone} activeOpacity={0.85}>
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
  drums: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  colon: {
    fontSize: 28, fontWeight: '700', color: COLORS.brandPrimary,
    marginHorizontal: 4, marginBottom: 4,
  },
  separator: { width: 16 },
  btnRow: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: RADIUS.md,
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    alignItems: 'center',
  },
  cancelTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },
  doneBtn: {
    flex: 2, paddingVertical: 14, borderRadius: RADIUS.md,
    backgroundColor: COLORS.brandPrimary, alignItems: 'center',
  },
  doneTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.white },
});

// ─────────────────────────────────────────────────────────────────────────────
// Notification channel data
// ─────────────────────────────────────────────────────────────────────────────
const CHANNELS = [
  { id:'email',    label:'Email',             icon:'mail-outline',          sub:'Get notified via email' },
  { id:'whatsapp', label:'WhatsApp',           icon:'logo-whatsapp',         sub:'Alerts on WhatsApp' },
  { id:'sms',      label:'SMS',               icon:'chatbox-outline',       sub:'Text message alerts' },
  { id:'push',     label:'Push Notification', icon:'notifications-outline', sub:'In-app push alerts' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function NotificationChannelsScreen() {
  const router = useRouter();
  const [enabled, setEnabled] = useState<Record<string,boolean>>({
    email:true, whatsapp:true, sms:false, push:true,
  });
  const [quietHours,     setQuietHours]     = useState(false);
  const [startTime,      setStartTime]      = useState('10:00 PM');
  const [endTime,        setEndTime]        = useState('07:00 AM');
  const [saturday,       setSaturday]       = useState(false);
  const [sunday,         setSunday]         = useState(true);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker,   setShowEndPicker]   = useState(false);

  const save = () => {
    Toast.show({
      type: 'success',
      text1: 'Settings Saved',
      text2: 'Notification preferences updated.',
    });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Channels & Quiet Hours</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Notification Channels ──────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="notifications-outline" size={18} color={COLORS.textSecondary} />
            <Text style={s.cardTitle}>Notification Channels</Text>
          </View>
          {CHANNELS.map((ch, idx) => (
            <View key={ch.id} style={[s.row, idx > 0 && s.rowBorder]}>
              <View style={s.chIcon}>
                <Ionicons name={ch.icon as any} size={18} color={COLORS.textSecondary} />
              </View>
              <View style={s.rowInfo}>
                <Text style={s.rowLabel}>{ch.label}</Text>
                <Text style={s.rowSub}>{ch.sub}</Text>
              </View>
              <CustomToggle
                value={enabled[ch.id]}
                onChange={v => setEnabled(prev => ({ ...prev, [ch.id]: v }))}
              />
            </View>
          ))}
        </View>

        {/* ── Quiet Hours ────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={[s.row, { paddingVertical: 14 }]}>
            <View style={s.cardHdr}>
              <Ionicons name="moon-outline" size={18} color={COLORS.textSecondary} />
              <Text style={s.cardTitle}>Quiet Hours</Text>
            </View>
            <CustomToggle value={quietHours} onChange={setQuietHours} />
          </View>

          {quietHours && (
            <View style={s.quietBody}>
              {/* Time pickers */}
              <View style={s.timeRow}>
                {/* Start Time */}
                <View style={s.timeBox}>
                  <Text style={s.timeLabel}>Start Time</Text>
                  <TouchableOpacity
                    style={s.timeField}
                    onPress={() => setShowStartPicker(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={15} color={COLORS.textSecondary} />
                    <Text style={s.timeFieldTxt}>{startTime}</Text>
                    <Ionicons name="chevron-down" size={14} color={COLORS.textTertiary} />
                  </TouchableOpacity>
                </View>

                <Ionicons name="arrow-forward" size={18} color={COLORS.textTertiary} style={{ marginTop: 20 }} />

                {/* End Time */}
                <View style={s.timeBox}>
                  <Text style={s.timeLabel}>End Time</Text>
                  <TouchableOpacity
                    style={s.timeField}
                    onPress={() => setShowEndPicker(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={15} color={COLORS.textSecondary} />
                    <Text style={s.timeFieldTxt}>{endTime}</Text>
                    <Ionicons name="chevron-down" size={14} color={COLORS.textTertiary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Weekends */}
              <Text style={s.weekendLabel}>Weekends</Text>
              <View style={s.weekendRow}>
                {[
                  { label: 'Saturday', val: saturday, set: setSaturday },
                  { label: 'Sunday',   val: sunday,   set: setSunday   },
                ].map(d => (
                  <TouchableOpacity
                    key={d.label}
                    style={[s.dayBox, d.val && s.dayBoxActive]}
                    onPress={() => d.set(!d.val)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.dayTxt, d.val && s.dayTxtActive]}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.8}>
          <Text style={s.saveTxt}>Save Settings</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Time Picker Sheets ────────────────────────────────────────── */}
      <TimePickerSheet
        visible={showStartPicker}
        label="Select Start Time"
        initialTime={startTime}
        onClose={() => setShowStartPicker(false)}
        onConfirm={(t) => { setStartTime(t); setShowStartPicker(false); }}
      />
      <TimePickerSheet
        visible={showEndPicker}
        label="Select End Time"
        initialTime={endTime}
        onClose={() => setShowEndPicker(false)}
        onConfirm={(t) => { setEndTime(t); setShowEndPicker(false); }}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: COLORS.pageBg },
  hdr:      {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  back:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:    { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  scroll:   { padding: SPACING.md, paddingBottom: 40 },

  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  cardHdr:  { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cardTitle:{ fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },

  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowBorder:{ borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  chIcon:   {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  rowInfo:  { flex: 1 },
  rowLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  rowSub:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },

  quietBody: { borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingTop: SPACING.md },
  timeRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: SPACING.md },
  timeBox:   { flex: 1 },
  timeLabel: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '600',
    color: COLORS.textSecondary, marginBottom: 6,
  },
  // Tappable time display field
  timeField: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
  },
  timeFieldTxt: {
    flex: 1, fontSize: TYPOGRAPHY.base,
    fontWeight: '600', color: COLORS.textPrimary,
  },

  weekendLabel: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '600',
    color: COLORS.textSecondary, marginBottom: SPACING.sm,
  },
  weekendRow:  { flexDirection: 'row', gap: 12 },
  dayBox:      {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  dayBoxActive:{ backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  dayTxt:      { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  dayTxtActive:{ color: COLORS.white, fontWeight: '700' },

  saveBtn: {
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 15, alignItems: 'center', marginTop: SPACING.sm,
  },
  saveTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
