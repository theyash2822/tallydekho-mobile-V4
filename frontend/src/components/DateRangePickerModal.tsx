/**
 * Shared DateRangePickerModal
 * Wire in/out: ISO YYYY-MM-DD. Display: Settings date_format.
 * Bounds: Home FY (minDate/maxDate). Clear → full FY when bounds exist.
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';
import { useSettings } from '../context/SettingsContext';
import { formatDate } from '../utils/format';
import {
  dateToISO,
  parseISODate,
  resolveFyPreset,
  isISODate,
} from '../utils/dateRange';

// ── Legacy helpers (create-forms / older call sites) ───────────────────────────
/** @deprecated Prefer ISO state + formatDate. Kept for create-* screens. */
export function parseDMY(str: string): Date | null {
  if (!str) return null;
  if (isISODate(str.slice(0, 10))) return parseISODate(str);
  const p = str.split('/');
  if (p.length < 3) return null;
  const year = parseInt(p[2], 10) < 100 ? 2000 + parseInt(p[2], 10) : parseInt(p[2], 10);
  return new Date(year, parseInt(p[1], 10) - 1, parseInt(p[0], 10));
}

/** @deprecated Prefer formatDate(iso, settings). */
export function fmtDMY(d: Date): string {
  return (
    String(d.getDate()).padStart(2, '0') + '/' +
    String(d.getMonth() + 1).padStart(2, '0') + '/' +
    String(d.getFullYear())
  );
}

/** @deprecated Prefer keeping ISO in state. */
export function isoToDMY(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}

/** @deprecated Prefer ISO from modal Apply. Also accepts ISO passthrough. */
export function dmyToISO(dmy: string): string {
  if (!dmy) return '';
  if (isISODate(dmy.slice(0, 10))) return dmy.slice(0, 10);
  const p = dmy.split('/');
  if (p.length < 3) return '';
  const year = parseInt(p[2], 10) < 100 ? 2000 + parseInt(p[2], 10) : parseInt(p[2], 10);
  return `${year}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS_CAL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const QUICK_PRESETS = [
  { key: 'this_month' as const, label: 'This Month' },
  { key: 'last_1' as const, label: 'Last 1 Month' },
  { key: 'last_3' as const, label: 'Last 3 Months' },
];

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  /** ISO YYYY-MM-DD */
  fromDate: string;
  /** ISO YYYY-MM-DD */
  toDate: string;
  /** ISO — FY start (Home) */
  minDate?: string;
  /** ISO — FY end (Home) */
  maxDate?: string;
  /** onApply receives ISO from/to. Clear with FY bounds → full FY. */
  onApply: (from: string, to: string) => void;
  onClose: () => void;
}

export default function DateRangePickerModal({
  visible, fromDate, toDate, onApply, onClose, minDate, maxDate,
}: Props) {
  const { settings } = useSettings();
  const fmtSettings = {
    currency: settings.currency,
    number_format: settings.number_format,
    decimal_places: settings.decimal_places,
    date_format: settings.date_format,
  };
  const display = (d: Date) => formatDate(dateToISO(d), fmtSettings);
  const placeholder =
    settings.date_format === 'YYYY-MM-DD' ? '----/--/--' :
    settings.date_format === 'DD-MM-YYYY' ? '--/--/----' :
    '--/--/----';
  // Use hyphen separators when the Settings style uses hyphens
  const emptyLabel = (settings.date_format === 'DD-MM-YYYY' || settings.date_format === 'YYYY-MM-DD')
    ? placeholder.replace(/\//g, '-')
    : placeholder;

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const minD = minDate ? parseISODate(minDate) : null;
  const maxD = maxDate ? parseISODate(maxDate) : null;

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selFrom, setSelFrom] = useState<Date | null>(null);
  const [selTo, setSelTo] = useState<Date | null>(null);
  const [step, setStep] = useState<'from' | 'to'>('from');

  useEffect(() => {
    if (!visible) return;
    // Accept ISO (preferred) or legacy DMY from unmigrated callers
    const f = parseISODate(fromDate) || parseDMY(fromDate);
    const t = parseISODate(toDate) || parseDMY(toDate);
    setSelFrom(f);
    setSelTo(t);
    setStep(f && !t ? 'to' : 'from');
    const ref = f || (maxD && maxD < today ? maxD : today);
    setViewYear(ref.getFullYear());
    setViewMonth(ref.getMonth());
  }, [visible]);

  const calDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
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

  const cellDate = (d: number) => new Date(viewYear, viewMonth, d, 12);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const isStart = (d: number) => !!selFrom && sameDay(cellDate(d), selFrom);
  const isEnd = (d: number) => !!selTo && sameDay(cellDate(d), selTo);
  const isInRange = (d: number) => {
    if (!selFrom || !selTo) return false;
    const dt = cellDate(d);
    return dt > selFrom && dt < selTo;
  };
  const isTodayD = (d: number) => sameDay(cellDate(d), today);
  const isDisabled = (d: number) => {
    const dt = cellDate(d);
    if (minD && dt < minD) return true;
    if (maxD && dt > maxD) return true;
    return false;
  };

  const handleDayPress = (day: number) => {
    if (isDisabled(day)) return;
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

  const setPreset = (key: 'this_month' | 'last_1' | 'last_3') => {
    const { from, to } = resolveFyPreset(key, { from: minDate, to: maxDate });
    const f = parseISODate(from);
    const t = parseISODate(to);
    if (!f || !t) return;
    setSelFrom(f); setSelTo(t); setStep('from');
    setViewYear(f.getFullYear()); setViewMonth(f.getMonth());
  };

  const canApply = !!selFrom && !!selTo;

  const handleApply = () => {
    if (!canApply || !selFrom || !selTo) return;
    onApply(dateToISO(selFrom), dateToISO(selTo));
    onClose();
  };

  /** Clear → full Home FY (product rule), not “all time”. */
  const handleClear = () => {
    if (minDate && maxDate) {
      const f = parseISODate(minDate);
      const t = parseISODate(maxDate);
      setSelFrom(f); setSelTo(t); setStep('from');
      onApply(minDate, maxDate);
    } else {
      setSelFrom(null); setSelTo(null); setStep('from');
      onApply('', '');
    }
    onClose();
  };

  const stepHint =
    !selFrom ? 'Tap any date to set the start' :
    step === 'to' ? 'Now tap to set the end date' :
    selTo ? 'Tap a date to start a new range' : '';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>Select Date Range</Text>

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

          <View style={s.rangeDisplay}>
            <View style={[
              s.rangeDate,
              step === 'from' && !selTo && s.rangeDateCurr,
              selFrom && selTo && s.rangeDateDone,
            ]}>
              <Text style={s.rangeDateLabel}>FROM</Text>
              <View style={s.rangeDateRow}>
                <Ionicons name="calendar-outline" size={12} color={selFrom ? COLORS.brandPrimary : COLORS.textTertiary} />
                <Text style={[s.rangeDateVal, !selFrom && s.rangeDateEmpty]} numberOfLines={1}>
                  {selFrom ? display(selFrom) : emptyLabel}
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
                <Text style={[s.rangeDateVal, !selTo && s.rangeDateEmpty]} numberOfLines={1}>
                  {selTo ? display(selTo) : emptyLabel}
                </Text>
              </View>
            </View>
          </View>

          <Text style={s.stepHint}>{stepHint}</Text>

          <View style={s.navRow}>
            <TouchableOpacity style={s.navBtn} onPress={prevMonth} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={s.monthYear}>{MONTHS_CAL[viewMonth]} {viewYear}</Text>
            <TouchableOpacity style={s.navBtn} onPress={nextMonth} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={s.dayHeaders}>
            {DAY_LABELS.map(d => <Text key={d} style={s.dayHeader}>{d}</Text>)}
          </View>

          <View style={s.calGrid}>
            {calDays.map((day, idx) => {
              if (day === null) return <View key={idx} style={s.calCell} />;
              const start = isStart(day);
              const end = isEnd(day);
              const inRange = isInRange(day);
              const td = isTodayD(day);
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

          <View style={s.btnRow}>
            <TouchableOpacity style={s.clearBtn} onPress={handleClear} activeOpacity={0.7}>
              <Text style={s.clearTxt}>Reset to FY</Text>
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
  presetsRow: { gap: 8, paddingBottom: 14 },
  presetChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: COLORS.pageBg, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  presetChipText: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
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
  rangeDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rangeDateVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 1 },
  rangeDateEmpty: { color: COLORS.textTertiary, fontWeight: '400' },
  rangeArrow: { width: 24, alignItems: 'center' },
  stepHint: {
    fontSize: 11, color: COLORS.textTertiary, textAlign: 'center',
    fontStyle: 'italic', marginBottom: 10, minHeight: 16,
  },
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
  dayHeaders: { flexDirection: 'row', marginBottom: 4 },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: COLORS.textTertiary },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  calCell: { width: `${100 / 7}%` as any, alignItems: 'center', paddingVertical: 2 },
  calCellInRange: { backgroundColor: 'rgba(26,26,26,0.07)', width: `${100 / 7}%` as any, alignItems: 'center', paddingVertical: 2 },
  calDay: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  calDaySel: { backgroundColor: COLORS.brandPrimary },
  calDayToday: { borderWidth: 1.5, borderColor: COLORS.brandPrimary },
  calDayTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary },
  calDayTxtSel: { color: COLORS.white, fontWeight: '700' },
  calDayTxtToday: { color: COLORS.brandPrimary, fontWeight: '700' },
  calDayTxtRange: { color: COLORS.textPrimary, fontWeight: '600' },
  calDayDisabled: { opacity: 0.25 },
  calDayTxtDisabled: { color: COLORS.textTertiary },
  btnRow: { flexDirection: 'row', gap: 10 },
  clearBtn: {
    flex: 1, paddingVertical: 14, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center',
  },
  clearTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
  applyBtn: {
    flex: 2, flexDirection: 'row', gap: 6, paddingVertical: 14,
    borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  applyBtnDis: { backgroundColor: COLORS.borderStrong },
  applyTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
