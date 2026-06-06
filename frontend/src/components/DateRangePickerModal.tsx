/**
 * Shared DateRangePickerModal
 * Full calendar grid with quick presets and FROM → TO range selection.
 * Used by: ledger/[id].tsx, reports/financial.tsx
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';

// ── Date helpers ──────────────────────────────────────────────────────────────
export function parseDMY(str: string): Date | null {
  if (!str) return null;
  const p = str.split('/');
  if (p.length < 3) return null;
  const year = parseInt(p[2]) < 100 ? 2000 + parseInt(p[2]) : parseInt(p[2]);
  return new Date(year, parseInt(p[1]) - 1, parseInt(p[0]));
}

export function fmtDMY(d: Date): string {
  return (
    String(d.getDate()).padStart(2, '0') + '/' +
    String(d.getMonth() + 1).padStart(2, '0') + '/' +
    String(d.getFullYear()).slice(-2)
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS_CAL   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const QUICK_PRESETS = [
  { key: 'this_month', label: 'This Month'    },
  { key: 'last_1',     label: 'Last 1 Month'  },
  { key: 'last_3',     label: 'Last 3 Months' },
];

// Convert ISO 'YYYY-MM-DD' to 'DD/MM/YY'
export function isoToDMY(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y.slice(-2)}`;
}

// Convert 'DD/MM/YY' to ISO 'YYYY-MM-DD'
export function dmyToISO(dmy: string): string {
  if (!dmy) return '';
  const p = dmy.split('/');
  if (p.length < 3) return '';
  const year = parseInt(p[2]) < 100 ? 2000 + parseInt(p[2]) : parseInt(p[2]);
  return `${year}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  visible:   boolean;
  fromDate:  string;
  toDate:    string;
  minDate?:  string; // ISO 'YYYY-MM-DD' — earliest selectable date (FY start)
  maxDate?:  string; // ISO 'YYYY-MM-DD' — latest selectable date (FY end)
  onApply:   (from: string, to: string) => void;
  onClose:   () => void;
}

export default function DateRangePickerModal({
  visible, fromDate, toDate, onApply, onClose, minDate, maxDate,
}: Props) {
  const today = new Date();
  const minD = minDate ? new Date(minDate + 'T00:00:00') : null;
  const maxD = maxDate ? new Date(maxDate + 'T00:00:00') : null;

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selFrom,   setSelFrom]   = useState<Date | null>(null);
  const [selTo,     setSelTo]     = useState<Date | null>(null);
  const [step,      setStep]      = useState<'from' | 'to'>('from');

  // Sync selection when sheet opens
  useEffect(() => {
    if (visible) {
      const f = parseDMY(fromDate);
      const t = parseDMY(toDate);
      setSelFrom(f);
      setSelTo(t);
      setStep(f && !t ? 'to' : 'from');
      const ref = f || today;
      setViewYear(ref.getFullYear());
      setViewMonth(ref.getMonth());
    }
  }, [visible]);

  // Build calendar grid for current view month
  const calDays = useMemo(() => {
    const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const cellDate   = (d: number) => new Date(viewYear, viewMonth, d);
  const isStart    = (d: number) => !!selFrom && cellDate(d).getTime() === selFrom.getTime();
  const isEnd      = (d: number) => !!selTo   && cellDate(d).getTime() === selTo.getTime();
  const isInRange  = (d: number) => {
    if (!selFrom || !selTo) return false;
    const dt = cellDate(d); return dt > selFrom && dt < selTo;
  };
  const isTodayD   = (d: number) =>
    today.getDate() === d && today.getMonth() === viewMonth && today.getFullYear() === viewYear;
  const isDisabled = (d: number) => {
    const dt = cellDate(d);
    if (minD && dt < minD) return true;
    if (maxD && dt > maxD) return true;
    return false;
  };

  const handleDayPress = (day: number) => {
    if (isDisabled(day)) return; // block out-of-FY dates
    const pressed = cellDate(day);
    if (step === 'from' || (selFrom && selTo)) {
      setSelFrom(pressed); setSelTo(null); setStep('to');
    } else {
      if (selFrom && pressed < selFrom) {
        setSelTo(selFrom); setSelFrom(pressed);
      } else {
        setSelTo(pressed);
      }
      setStep('from');
    }
  };

  // Quick presets — clamp to FY bounds when minDate/maxDate are provided
  const clampToFY = (d: Date): Date => {
    if (minD && d < minD) return new Date(minD);
    if (maxD && d > maxD) return new Date(maxD);
    return d;
  };
  const setPreset = (key: string) => {
    const m = today.getMonth(), y = today.getFullYear();
    let f: Date, t: Date = new Date(today);
    if (key === 'this_month') {
      f = new Date(y, m, 1);
      t = new Date(y, m + 1, 0);
    } else if (key === 'last_1') {
      f = new Date(today); f.setDate(f.getDate() - 30);
      t = new Date(today);
    } else {
      f = new Date(y, m - 2, 1);
      t = new Date(y, m + 1, 0);
    }
    // Clamp to selected FY bounds
    f = clampToFY(f);
    t = clampToFY(t);
    setSelFrom(f); setSelTo(t); setStep('from');
    setViewYear(f.getFullYear()); setViewMonth(f.getMonth());
  };

  const canApply = !!selFrom && !!selTo;

  const handleApply = () => {
    if (canApply) { onApply(fmtDMY(selFrom!), fmtDMY(selTo!)); onClose(); }
  };
  const handleClear = () => {
    setSelFrom(null); setSelTo(null); setStep('from');
    onApply('', ''); onClose();
  };

  const stepHint =
    !selFrom      ? 'Tap any date to set the start'      :
    step === 'to' ? 'Now tap to set the end date'        :
    selTo         ? 'Tap a date to start a new range'    : '';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>

          {/* Handle + Title */}
          <View style={s.handle} />
          <Text style={s.title}>Select Date Range</Text>

          {/* Quick Presets */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.presetsRow}
          >
            {QUICK_PRESETS.map(p => (
              <TouchableOpacity
                key={p.key}
                style={s.presetChip}
                onPress={() => setPreset(p.key)}
                activeOpacity={0.7}
              >
                <Text style={s.presetChipText}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* FROM → TO display */}
          <View style={s.rangeDisplay}>
            <View style={[
              s.rangeDate,
              step === 'from' && !selTo && s.rangeDateCurr,
              selFrom && selTo && s.rangeDateDone,
            ]}>
              <Text style={s.rangeDateLabel}>FROM</Text>
              <View style={s.rangeDateRow}>
                <Ionicons name="calendar-outline" size={12} color={selFrom ? COLORS.brandPrimary : COLORS.textTertiary} />
                <Text style={[s.rangeDateVal, !selFrom && s.rangeDateEmpty]}>
                  {selFrom ? fmtDMY(selFrom) : '--/--/--'}
                </Text>
              </View>
            </View>
            <View style={s.rangeArrow}>
              <Ionicons name="arrow-forward" size={14} color={COLORS.textTertiary} />
            </View>
            <View style={[
              s.rangeDate,
              step === 'to' && s.rangeDateCurr,
              selFrom && selTo && s.rangeDateDone,
            ]}>
              <Text style={s.rangeDateLabel}>TO</Text>
              <View style={s.rangeDateRow}>
                <Ionicons name="calendar-outline" size={12} color={selTo ? COLORS.brandPrimary : COLORS.textTertiary} />
                <Text style={[s.rangeDateVal, !selTo && s.rangeDateEmpty]}>
                  {selTo ? fmtDMY(selTo) : '--/--/--'}
                </Text>
              </View>
            </View>
          </View>

          {/* Step hint */}
          <Text style={s.stepHint}>{stepHint}</Text>

          {/* Month navigation */}
          <View style={s.navRow}>
            <TouchableOpacity style={s.navBtn} onPress={prevMonth} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={s.monthYear}>{MONTHS_CAL[viewMonth]} {viewYear}</Text>
            <TouchableOpacity style={s.navBtn} onPress={nextMonth} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={s.dayHeaders}>
            {DAY_LABELS.map(d => <Text key={d} style={s.dayHeader}>{d}</Text>)}
          </View>

          {/* Calendar grid */}
          <View style={s.calGrid}>
            {calDays.map((day, idx) => {
              if (day === null) return <View key={idx} style={s.calCell} />;
              const start   = isStart(day);
              const end     = isEnd(day);
              const inRange = isInRange(day);
              const td      = isTodayD(day);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[s.calCell, inRange && s.calCellInRange]}
                  onPress={() => handleDayPress(day)}
                  activeOpacity={isDisabled(day) ? 1 : 0.7}
                  disabled={isDisabled(day)}
                >
                  <View style={[
                    s.calDay,
                    (start || end) && s.calDaySel,
                    td && !start && !end && s.calDayToday,
                    isDisabled(day) && s.calDayDisabled,
                  ]}>
                    <Text style={[
                      s.calDayTxt,
                      (start || end) && s.calDayTxtSel,
                      td && !start && !end && s.calDayTxtToday,
                      inRange && s.calDayTxtRange,
                      isDisabled(day) && s.calDayTxtDisabled,
                    ]}>{day}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Action buttons */}
          <View style={s.btnRow}>
            <TouchableOpacity style={s.clearBtn} onPress={handleClear} activeOpacity={0.7}>
              <Text style={s.clearTxt}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.applyBtn, !canApply && s.applyBtnDis]}
              onPress={handleApply}
              disabled={!canApply}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.white} />
              <Text style={s.applyTxt}>Apply Filter</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 14 }} />
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.48)' },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SPACING.md, paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, backgroundColor: COLORS.borderStrong,
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  title: {
    fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary,
    textAlign: 'center', marginBottom: 14,
  },

  // Quick presets
  presetsRow: { gap: 8, paddingBottom: 14 },
  presetChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: COLORS.pageBg, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  presetChipText: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },

  // FROM → TO display
  rangeDisplay: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  rangeDate: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center',
  },
  rangeDateCurr: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.activeBg },
  rangeDateDone: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.activeBg },
  rangeDateLabel: {
    fontSize: 9, fontWeight: '800', color: COLORS.textTertiary,
    letterSpacing: 1.1, marginBottom: 4, textTransform: 'uppercase',
  },
  rangeDateRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rangeDateVal:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  rangeDateEmpty: { color: COLORS.textTertiary, fontWeight: '400' },
  rangeArrow:     { width: 24, alignItems: 'center' },

  // Step hint
  stepHint: {
    fontSize: 11, color: COLORS.textTertiary, textAlign: 'center',
    fontStyle: 'italic', marginBottom: 10, minHeight: 16,
  },

  // Month navigation
  navRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  navBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  monthYear: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },

  // Day headers
  dayHeaders: { flexDirection: 'row', marginBottom: 4 },
  dayHeader:  { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: COLORS.textTertiary },

  // Calendar grid
  calGrid:        { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  calCell:        { width: `${100 / 7}%` as any, alignItems: 'center', paddingVertical: 2 },
  calCellInRange: { backgroundColor: 'rgba(26,26,26,0.07)', width: `${100 / 7}%` as any, alignItems: 'center', paddingVertical: 2 },
  calDay:         { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  calDaySel:      { backgroundColor: COLORS.brandPrimary },
  calDayToday:    { borderWidth: 1.5, borderColor: COLORS.brandPrimary },
  calDayTxt:      { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary },
  calDayTxtSel:   { color: COLORS.white, fontWeight: '700' },
  calDayTxtToday: { color: COLORS.brandPrimary, fontWeight: '700' },
  calDayTxtRange:    { color: COLORS.textPrimary, fontWeight: '600' },
  calDayDisabled:    { opacity: 0.25 },
  calDayTxtDisabled: { color: COLORS.textTertiary },

  // Action buttons
  btnRow:    { flexDirection: 'row', gap: 10 },
  clearBtn:  {
    flex: 1, paddingVertical: 14, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center',
  },
  clearTxt:  { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
  applyBtn:  {
    flex: 2, flexDirection: 'row', gap: 6, paddingVertical: 14,
    borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  applyBtnDis: { backgroundColor: COLORS.borderStrong },
  applyTxt:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
