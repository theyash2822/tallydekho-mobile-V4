import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

/** Parse DD/MM/YY string → Date, returns null if invalid */
function parseDMY(str: string): Date | null {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length < 3) return null;
  const [dd, mm, yy] = parts;
  const year = parseInt(yy) < 100 ? 2000 + parseInt(yy) : parseInt(yy);
  const d = new Date(year, parseInt(mm) - 1, parseInt(dd));
  return isNaN(d.getTime()) ? null : d;
}

/** Format Date → DD/MM/YY */
export function formatDMY(d: Date): string {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
}

interface Props {
  visible: boolean;
  value: string;       // DD/MM/YY
  onSelect: (dateStr: string) => void;
  onClose: () => void;
  title?: string;
}

export default function DatePickerModal({ visible, value, onSelect, onClose, title = 'Select Date' }: Props) {
  const today = new Date();
  const initDate = parseDMY(value) || today;

  const [viewYear, setViewYear]   = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());
  const [selected, setSelected]   = useState<Date | null>(parseDMY(value));

  // Sync when modal re-opens
  useEffect(() => {
    if (visible) {
      const d = parseDMY(value) || today;
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setSelected(parseDMY(value));
    }
  }, [visible]);

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

  const isToday = (day: number) =>
    today.getDate() === day && today.getMonth() === viewMonth && today.getFullYear() === viewYear;
  const isSelected = (day: number) =>
    !!selected && selected.getDate() === day && selected.getMonth() === viewMonth && selected.getFullYear() === viewYear;

  const handleConfirm = () => {
    if (selected) { onSelect(formatDMY(selected)); onClose(); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.sheet}>
        {/* Handle */}
        <View style={s.handle} />
        <Text style={s.title}>{title}</Text>

        {/* Month/Year Navigation */}
        <View style={s.navRow}>
          <TouchableOpacity style={s.navBtn} onPress={prevMonth} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.monthYear}>{MONTHS[viewMonth]} {viewYear}</Text>
          <TouchableOpacity style={s.navBtn} onPress={nextMonth} activeOpacity={0.7}>
            <Ionicons name="chevron-forward" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Day Headers */}
        <View style={s.dayHeaders}>
          {DAY_LABELS.map(d => (
            <Text key={d} style={s.dayHeader}>{d}</Text>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={s.grid}>
          {calDays.map((day, idx) => (
            <View key={idx} style={s.cell}>
              {day !== null ? (
                <TouchableOpacity
                  style={[
                    s.dayBtn,
                    isSelected(day) && s.dayBtnSel,
                    isToday(day) && !isSelected(day) && s.dayBtnToday,
                  ]}
                  onPress={() => setSelected(new Date(viewYear, viewMonth, day))}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    s.dayTxt,
                    isSelected(day) && s.dayTxtSel,
                    isToday(day) && !isSelected(day) && s.dayTxtToday,
                  ]}>{day}</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.dayBtn} />
              )}
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={s.btnRow}>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.confirmBtn, !selected && s.confirmBtnDis]}
            onPress={handleConfirm}
            disabled={!selected}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={16} color={COLORS.white} />
            <Text style={s.confirmTxt}>
              {selected ? `Select ${formatDMY(selected)}` : 'Choose a date'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const CELL_SIZE = 44;

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl,
  },
  handle: { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  title: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 16 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  monthYear: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  dayHeaders: { flexDirection: 'row', marginBottom: 8 },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', marginBottom: 4 },
  dayBtn: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: CELL_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  dayBtnSel: { backgroundColor: COLORS.brandPrimary },
  dayBtnToday: { borderWidth: 1.5, borderColor: COLORS.brandPrimary },
  dayTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '500', color: COLORS.textPrimary },
  dayTxtSel: { color: COLORS.white, fontWeight: '700' },
  dayTxtToday: { color: COLORS.brandPrimary, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center' },
  cancelTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
  confirmBtn: { flex: 2, flexDirection: 'row', gap: 6, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  confirmBtnDis: { backgroundColor: COLORS.borderStrong },
  confirmTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
