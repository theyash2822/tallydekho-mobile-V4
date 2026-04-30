import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Dimensions, Share, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal, { isoToDMY } from '../../src/components/DateRangePickerModal';
import { useAuth } from '../../src/context/AuthContext';

const AMBER    = '#A89060';
const AMBER_BG = '#FDF9F4';
const { width: SW } = Dimensions.get('window');

const STATUS_COLOR: Record<string, string> = {
  paid:   '#2D7D46',
  unpaid: '#DC2626',
};
const STATUS_BG: Record<string, string> = {
  paid:   '#F0FBF4',
  unpaid: '#FFF0F0',
};
const STATUS_LABEL: Record<string, string> = {
  paid:   'Paid',
  unpaid: 'Unpaid',
};

// ─── Types ────────────────────────────────────────────────────────────
type ExpenseItem = {
  id: string; party: string; date: string;
  time: string; amount: string; status: string; type: 'direct' | 'indirect';
};
type MonthGroup = { id: string; label: string; items: ExpenseItem[] };

// ─── Month-grouped data ──────────────────────────────────────────────────
const MONTH_GROUPS: MonthGroup[] = [
  {
    id: 'apr25', label: 'Apr 25',
    items: [
      { id: 'EXP-019', party: 'Office Supplies Co.',  date: '28/04/25', time: '11:00 AM', amount: '₹2,500',  status: 'paid',   type: 'indirect' },
      { id: 'EXP-018', party: 'Electricity Board',    date: '22/04/25', time: '10:30 AM', amount: '₹4,200',  status: 'paid',   type: 'direct'   },
      { id: 'EXP-017', party: 'Legal Services',       date: '15/04/25', time: '03:00 PM', amount: '₹8,900',  status: 'unpaid', type: 'indirect' },
      { id: 'EXP-016', party: 'Transport Services',   date: '08/04/25', time: '09:00 AM', amount: '₹3,400',  status: 'paid',   type: 'direct'   },
    ],
  },
  {
    id: 'mar25', label: 'Mar 25',
    items: [
      { id: 'EXP-015', party: 'Cleaning Services',    date: '29/03/25', time: '02:00 PM', amount: '₹3,800',  status: 'paid',   type: 'indirect' },
      { id: 'EXP-014', party: 'Marketing Agency',     date: '20/03/25', time: '11:00 AM', amount: '₹5,600',  status: 'unpaid', type: 'indirect' },
      { id: 'EXP-013', party: 'Internet Provider',    date: '12/03/25', time: '09:30 AM', amount: '₹1,200',  status: 'paid',   type: 'direct'   },
    ],
  },
  {
    id: 'feb25', label: 'Feb 25',
    items: [
      { id: 'EXP-012', party: 'Security Services',    date: '25/02/25', time: '10:00 AM', amount: '₹6,800',  status: 'paid',   type: 'direct'   },
      { id: 'EXP-011', party: 'Salary - March',       date: '14/02/25', time: '11:30 AM', amount: '₹75,000', status: 'paid',   type: 'direct'   },
    ],
  },
  {
    id: 'jan25', label: 'Jan 25',
    items: [
      { id: 'EXP-001', party: 'Office Supplies Co.',  date: '01/01/26', time: '09:00 AM', amount: '₹2,500',  status: 'paid',   type: 'indirect' },
      { id: 'EXP-002', party: 'Internet Provider',    date: '31/12/25', time: '08:30 AM', amount: '₹1,200',  status: 'unpaid', type: 'direct'   },
      { id: 'EXP-003', party: 'Cleaning Services',    date: '30/12/25', time: '08:00 AM', amount: '₹3,800',  status: 'paid',   type: 'indirect' },
      { id: 'EXP-004', party: 'Marketing Agency',     date: '15/12/25', time: '07:30 PM', amount: '₹5,600',  status: 'paid',   type: 'indirect' },
      { id: 'EXP-005', party: 'Electricity Board',    date: '10/12/25', time: '06:45 PM', amount: '₹4,200',  status: 'unpaid', type: 'direct'   },
      { id: 'EXP-006', party: 'Legal Services',       date: '05/12/25', time: '05:15 PM', amount: '₹8,900',  status: 'paid',   type: 'indirect' },
      { id: 'EXP-007', party: 'Transport Services',   date: '25/11/25', time: '04:30 PM', amount: '₹3,400',  status: 'paid',   type: 'direct'   },
      { id: 'EXP-008', party: 'Security Services',    date: '20/11/25', time: '03:00 PM', amount: '₹6,800',  status: 'unpaid', type: 'direct'   },
    ],
  },
];

export default function ExpenseRegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedFY } = useAuth();
  const fyFrom = selectedFY?.startDate ?? '';
  const fyTo   = selectedFY?.endDate   ?? '';

  const [search,       setSearch]       = useState('');
  const [typeFilter,   setTypeFilter]   = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeOpen,     setTypeOpen]     = useState(false);
  const [statusOpen,   setStatusOpen]   = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fromDate, setFromDate] = useState(() => fyFrom ? isoToDMY(fyFrom) : '01/04/24');
  const [toDate,   setToDate]   = useState(() => fyTo   ? isoToDMY(fyTo)   : '31/03/25');

  // Collapsible months — all open by default
  const [expanded, setExpanded] = useState<Set<string>>(new Set(MONTH_GROUPS.map(g => g.id)));
  const toggleMonth = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Multi-select
  const [selected, setSelected] = useState<string[]>([]);
  const isSelecting = selected.length > 0;
  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  const allItems   = MONTH_GROUPS.flatMap(g => g.items);
  const selectAll  = () => setSelected(allItems.map(i => i.id));
  const clearSelect = () => setSelected([]);

  const handleShare = async () => {
    const items = allItems.filter(i => selected.includes(i.id));
    const lines = items.map(i => `${i.id}  ${i.party}  ${i.amount}  ${STATUS_LABEL[i.status] ?? i.status}`);
    try {
      await Share.share({ message: `TallyDekho — Expense Register\n${lines.join('\n')}`, title: 'Share Expenses' });
    } catch {
      Alert.alert('Share', `${selected.length} expense(s) ready to share.`);
    }
    clearSelect();
  };

  const handleExport = () => {
    Alert.alert('Export', `Exporting ${selected.length} expense(s) as Excel/PDF.`);
    clearSelect();
  };

  // Filter helper
  const filterItems = (items: ExpenseItem[]) =>
    items.filter(item => {
      const matchSearch = !search ||
        item.party.toLowerCase().includes(search.toLowerCase()) ||
        item.id.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || STATUS_LABEL[item.status] === statusFilter;
      const matchType   = typeFilter === 'All' ||
        (typeFilter === 'Direct' && item.type === 'direct') ||
        (typeFilter === 'Indirect' && item.type === 'indirect');
      return matchSearch && matchStatus && matchType;
    });

  const allFiltered = MONTH_GROUPS.flatMap(g => filterItems(g.items));
  const totalAmt = allFiltered.reduce((sum, i) => {
    const n = parseFloat(i.amount.replace(/[₹,]/g, ''));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  const taxAmt = Math.round(totalAmt * 0.18);

  const closeAll = () => { setTypeOpen(false); setStatusOpen(false); };

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ───────────────────────────────────────────── */}
      {isSelecting ? (
        <View style={s.header}>
          <TouchableOpacity onPress={clearSelect} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{selected.length} Selected</Text>
          <TouchableOpacity onPress={selectAll} activeOpacity={0.7}>
            <Text style={s.selectAllTxt}>Select All</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Expense Register</Text>
          <View style={{ width: 36 }} />
        </View>
      )}

      {/* ── 3-Filter Row ─────────────────────────────────────────── */}
      <View style={s.filterRow}>
        {/* Date Range */}
        <TouchableOpacity style={s.datePill} onPress={() => { closeAll(); setShowDatePicker(true); }} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} />
          <Text style={s.dateTxt} numberOfLines={1}>{fromDate} – {toDate}</Text>
          <Ionicons name="chevron-down" size={12} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Type Dropdown */}
        <View style={s.filterWrap}>
          <TouchableOpacity
            style={[s.filterPill, typeOpen && s.filterPillOpen]}
            onPress={() => { setStatusOpen(false); setTypeOpen(v => !v); }}
            activeOpacity={0.7}
          >
            <Text style={s.filterTxt}>{typeFilter === 'All' ? 'Type' : typeFilter}</Text>
            <Ionicons name={typeOpen ? 'chevron-up' : 'chevron-down'} size={12} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {typeOpen && (
            <View style={s.dropMenu}>
              {['All', 'Direct', 'Indirect'].map(opt => (
                <TouchableOpacity key={opt} style={s.dropItem} activeOpacity={0.7}
                  onPress={() => { setTypeFilter(opt); setTypeOpen(false); }}
                >
                  <Text style={[s.dropTxt, typeFilter === opt && s.dropTxtActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Status Dropdown */}
        <View style={s.filterWrap}>
          <TouchableOpacity
            style={[s.filterPill, statusOpen && s.filterPillOpen]}
            onPress={() => { setTypeOpen(false); setStatusOpen(v => !v); }}
            activeOpacity={0.7}
          >
            <Text style={s.filterTxt}>{statusFilter === 'All' ? 'Status' : statusFilter}</Text>
            <Ionicons name={statusOpen ? 'chevron-up' : 'chevron-down'} size={12} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {statusOpen && (
            <View style={s.dropMenu}>
              {['All', 'Paid', 'Unpaid'].map(opt => (
                <TouchableOpacity key={opt} style={s.dropItem} activeOpacity={0.7}
                  onPress={() => { setStatusFilter(opt); setStatusOpen(false); }}
                >
                  <Text style={[s.dropTxt, statusFilter === opt && s.dropTxtActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {(typeOpen || statusOpen) && (
        <TouchableOpacity style={s.dropOverlay} onPress={closeAll} activeOpacity={1} />
      )}

      {/* ── Search ─────────────────────────────────────────────── */}
      <View style={s.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.textTertiary} />
        <TextInput
          style={s.searchInput}
          placeholder="Search expenses, parties..."
          placeholderTextColor={COLORS.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: isSelecting ? 120 : 40 }}>

        {/* ── Stats Row (Total + Tax) ────────────────────────────────── */}
        <View style={s.statsRow}>
          <View style={s.statCell}>
            <Text style={s.statLabel}>Total</Text>
            <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>
              ₹{totalAmt.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statCell}>
            <Text style={s.statLabel}>Tax</Text>
            <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>
              ₹{taxAmt.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* ── Section Heading ────────────────────────────────────────── */}
        <Text style={s.sectionHeading}>List Of Expenses</Text>

        {/* ── Collapsible Month Sections ────────────────────────────── */}
        {MONTH_GROUPS.map(group => {
          const groupItems = filterItems(group.items);
          if (groupItems.length === 0) return null;
          const isOpen = expanded.has(group.id);

          return (
            <View key={group.id} style={s.monthSection}>
              <TouchableOpacity style={s.monthHeader} onPress={() => toggleMonth(group.id)} activeOpacity={0.7}>
                <View style={s.monthHeaderLeft}>
                  <View style={s.monthDot} />
                  <Text style={s.monthLabel}>{group.label}</Text>
                  <Text style={s.monthCount}>{groupItems.length} expenses</Text>
                </View>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>

              {isOpen && (
                <View style={s.listCard}>
                  {groupItems.map((item, idx) => {
                    const isSel = selected.includes(item.id);
                    return (
                      <View key={item.id}>
                        <TouchableOpacity
                          style={[s.expRow, isSel && s.expRowSelected]}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (isSelecting) toggleSelect(item.id);
                            else router.push(`/document/${item.id}?type=expense` as any);
                          }}
                          onLongPress={() => toggleSelect(item.id)}
                          delayLongPress={500}
                        >
                          {isSelecting && (
                            <View style={[s.selectCircle, isSel && s.selectCircleActive]}>
                              {isSel && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
                            </View>
                          )}
                          <View style={s.expItemWrap}>
                            {/* Status row */}
                            <View style={s.expStatusRow}>
                              <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[item.status] ?? '#9CA3AF' }]} />
                              <Text style={[s.expStatusTxt, { color: STATUS_COLOR[item.status] ?? '#9CA3AF' }]}>
                                {STATUS_LABEL[item.status] ?? item.status}
                              </Text>
                              <Text style={s.expBullet}> • </Text>
                              <Text style={s.expId}>{item.id}</Text>
                            </View>
                            {/* Content row */}
                            <View style={s.expContentRow}>
                              <View style={s.tallyIcon}>
                                <Ionicons name="return-down-back-outline" size={16} color={AMBER} />
                              </View>
                              <View style={s.expCenter}>
                                <Text style={s.expParty}>{item.party}</Text>
                                <Text style={s.expMeta}>{item.date} | {item.time}</Text>
                              </View>
                              <Text style={s.expAmt}>{item.amount}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                        {idx < groupItems.length - 1 && <View style={s.divider} />}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

      </ScrollView>

      {/* ── Multi-select Bottom Bar ──────────────────────────── */}
      {isSelecting && (
        <View style={[s.actionBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
          <View style={s.actionBarLeft}>
            <Text style={s.actionCount}>{selected.length} selected</Text>
            <TouchableOpacity onPress={clearSelect}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={s.actionBtns}>
            <TouchableOpacity style={[s.actionBtn, s.actionBtnOutline]} onPress={handleExport} activeOpacity={0.8}>
              <Ionicons name="download-outline" size={16} color={COLORS.textPrimary} />
              <Text style={s.actionBtnOutlineTxt}>Export</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={handleShare} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={16} color={COLORS.white} />
              <Text style={s.actionBtnTxt}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Date Picker ────────────────────────────────────────── */}
      <DateRangePickerModal
        visible={showDatePicker}
        fromDate={fromDate}
        toDate={toDate}
        minDate={fyFrom || undefined}
        maxDate={fyTo || undefined}
        onApply={(from, to) => { setFromDate(from); setToDate(to); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  selectAllTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary, paddingRight: 4 },

  // 3-filter row
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, zIndex: 200 },
  datePill:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault },
  dateTxt:   { flex: 1, fontSize: 11, color: COLORS.textPrimary, fontWeight: '500' },
  filterWrap:  { position: 'relative', zIndex: 100 },
  filterPill:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault },
  filterPillOpen: { borderColor: COLORS.brandPrimary },
  filterTxt:   { fontSize: 11, color: COLORS.textPrimary, fontWeight: '600' },
  dropMenu:    { position: 'absolute', top: 46, right: 0, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, minWidth: 120, zIndex: 300, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 10 },
  dropItem:    { paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dropTxt:     { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
  dropTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  dropOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },

  searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, marginTop: SPACING.md, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.borderDefault },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },

  // Stats row (2-col horizontal)
  statsRow:    { flexDirection: 'row', marginHorizontal: SPACING.md, marginTop: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  statCell:    { flex: 1, paddingHorizontal: SPACING.md, paddingVertical: 14 },
  statDivider: { width: 1, backgroundColor: COLORS.borderDefault },
  statLabel:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginBottom: 4 },
  statValue:   { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },

  sectionHeading: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginHorizontal: SPACING.md, marginTop: SPACING.lg, marginBottom: 4 },

  // Month sections
  monthSection: { marginHorizontal: SPACING.md, marginTop: SPACING.sm },
  monthHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 4 },
  monthHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brandPrimary },
  monthLabel:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  monthCount:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },

  listCard:   { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },

  expRow:         { paddingHorizontal: SPACING.md, paddingVertical: 12, gap: 8, flexDirection: 'row', alignItems: 'center' },
  expRowSelected: { backgroundColor: COLORS.brandPrimary + '08' },
  expItemWrap:    { flex: 1, gap: 8 },
  expStatusRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot:      { width: 8, height: 8, borderRadius: 4 },
  expStatusTxt:   { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  expBullet:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  expId:          { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  expContentRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tallyIcon:      { width: 34, height: 34, borderRadius: 9, backgroundColor: AMBER_BG, alignItems: 'center', justifyContent: 'center' },
  expCenter:      { flex: 1 },
  expParty:       { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  expMeta:        { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  expAmt:         { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },
  divider:        { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: SPACING.md },

  selectCircle:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  selectCircleActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },

  actionBar:     { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingHorizontal: SPACING.md, paddingTop: 14, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 10 },
  actionBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  actionCount:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  cancelTxt:     { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  actionBtns:    { flexDirection: 'row', gap: 10 },
  actionBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 13 },
  actionBtnTxt:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  actionBtnOutline:    { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault },
  actionBtnOutlineTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
});
