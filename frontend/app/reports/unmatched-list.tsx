import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const UNMATCHED = [
  { id: 'U1', party: 'Raj Enterprises', gstin: '27AABCE1234F1Z5', voucher: 'INV-2025-042', date: '25 May', ourAmt: '₹18,000', theirAmt: '₹17,500', diff: '₹500', type: 'Amount Mismatch' },
  { id: 'U2', party: 'Kumar & Sons', gstin: '07AADCK9876G2Z1', voucher: 'INV-2025-039', date: '22 May', ourAmt: '₹35,400', theirAmt: null, diff: '₹35,400', type: 'Missing in 2A' },
  { id: 'U3', party: 'Delhi Distributors', gstin: '07AABCD5678H1Z3', voucher: 'INV-2025-036', date: '20 May', ourAmt: '₹62,000', theirAmt: '₹61,800', diff: '₹200', type: 'Amount Mismatch' },
  { id: 'U4', party: 'Mumbai Wholesale', gstin: '27AABCM2345J3Z9', voucher: 'INV-2025-031', date: '15 May', ourAmt: null, theirAmt: '₹28,000', diff: '₹28,000', type: 'Extra in 2A' },
  { id: 'U5', party: 'Sharma Traders', gstin: '24AABCS3456K4Z2', voucher: 'INV-2025-028', date: '12 May', ourAmt: '₹45,000', theirAmt: '₹45,000', diff: '₹0', type: 'GSTIN Mismatch' },
];

const TYPE_CONFIG: Record<string, { color: string; bg: string }> = {
  'Amount Mismatch': { color: '#D97706', bg: '#FFFBEB' },
  'Missing in 2A': { color: '#DC2626', bg: '#FDECEA' },
  'Extra in 2A': { color: '#7C3AED', bg: '#F5F3FF' },
  'GSTIN Mismatch': { color: '#2563EB', bg: '#EFF6FF' },
};

export default function UnmatchedListScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const filtered = activeFilter === 'All' ? UNMATCHED : UNMATCHED.filter(u => u.type === activeFilter);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Unmatched List</Text>
        <TouchableOpacity style={s.exportBtn}>
          <Ionicons name="share-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={s.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterContent}>
          {['All', 'Amount Mismatch', 'Missing in 2A', 'Extra in 2A', 'GSTIN Mismatch'].map(f => (
            <TouchableOpacity key={f} style={[s.chip, activeFilter === f && s.chipActive]} onPress={() => setActiveFilter(f)} activeOpacity={0.7}>
              <Text style={[s.chipTxt, activeFilter === f && s.chipActiveTxt]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Summary Strip */}
      <View style={s.summaryStrip}>
        <View style={s.summaryItem}>
          <Text style={s.summaryVal}>{UNMATCHED.length}</Text>
          <Text style={s.summaryLbl}>Total Unmatched</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={[s.summaryVal, { color: '#DC2626' }]}>3</Text>
          <Text style={s.summaryLbl}>Needs Attention</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={[s.summaryVal, { color: '#D97706' }]}>₹64,100</Text>
          <Text style={s.summaryLbl}>Total Diff.</Text>
        </View>
      </View>

      {selected.length > 0 && (
        <View style={s.selectionBar}>
          <Text style={s.selectionTxt}>{selected.length} selected</Text>
          <TouchableOpacity style={s.selectionBtn} onPress={() => setSelected([])} activeOpacity={0.7}>
            <Text style={s.selectionBtnTxt}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {filtered.map((item, i) => {
          const cfg = TYPE_CONFIG[item.type] || { color: '#666', bg: '#F5F5F5' };
          const isSelected = selected.includes(item.id);
          return (
            <TouchableOpacity
              key={item.id}
              style={[s.row, isSelected && s.rowSelected, i < filtered.length - 1 && s.rowBorder]}
              onPress={() => toggleSelect(item.id)}
              onLongPress={() => toggleSelect(item.id)}
              activeOpacity={0.85}
            >
              <View style={[s.checkbox, isSelected && s.checkboxActive]}>
                {isSelected && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
              </View>
              <View style={s.rowContent}>
                <View style={s.rowTop}>
                  <Text style={s.partyName}>{item.party}</Text>
                  <View style={[s.typeBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[s.typeTxt, { color: cfg.color }]}>{item.type}</Text>
                  </View>
                </View>
                <View style={s.rowMid}>
                  <Text style={s.voucherRef}>{item.voucher} · {item.date}</Text>
                  <Text style={s.gstin}>{item.gstin}</Text>
                </View>
                <View style={s.rowBottom}>
                  <View style={s.amtCol}>
                    <Text style={s.amtLbl}>Our Books</Text>
                    <Text style={s.amtVal}>{item.ourAmt || '—'}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={12} color={COLORS.textTertiary} />
                  <View style={s.amtCol}>
                    <Text style={s.amtLbl}>GSTR-2A</Text>
                    <Text style={s.amtVal}>{item.theirAmt || '—'}</Text>
                  </View>
                  <View style={[s.diffBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[s.diffTxt, { color: cfg.color }]}>Diff: {item.diff}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action */}
      <View style={s.actionBar}>
        <TouchableOpacity style={s.pdfBtn} activeOpacity={0.8}>
          <Ionicons name="document-text-outline" size={16} color={COLORS.white} />
          <Text style={s.actionBtnTxt}>Share PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.pdfBtn, { backgroundColor: '#2D7D46' }]} activeOpacity={0.8}>
          <Ionicons name="grid-outline" size={16} color={COLORS.white} />
          <Text style={s.actionBtnTxt}>Export XLS</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  exportBtn: { width: 40, alignItems: 'flex-end' },
  filterBar: { backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  filterContent: { paddingHorizontal: SPACING.md, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault },
  chipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  chipActiveTxt: { color: COLORS.white },
  summaryStrip: { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  summaryVal: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary },
  summaryLbl: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: COLORS.borderDefault },
  selectionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 8, backgroundColor: '#1A1A1A' },
  selectionTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.white },
  selectionBtn: { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.full },
  selectionBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.white },
  row: { backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowSelected: { backgroundColor: '#F0EFE9' },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  rowContent: { flex: 1, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  partyName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  typeTxt: { fontSize: 10, fontWeight: '700' },
  rowMid: { gap: 2 },
  voucherRef: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  gstin: { fontSize: 10, color: COLORS.textTertiary, fontFamily: 'monospace' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  amtCol: { alignItems: 'center' },
  amtLbl: { fontSize: 10, color: COLORS.textTertiary },
  amtVal: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, marginLeft: 'auto' as any },
  diffTxt: { fontSize: 10, fontWeight: '700' },
  actionBar: { flexDirection: 'row', gap: 10, padding: SPACING.md, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  pdfBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.brandPrimary, paddingVertical: 12, borderRadius: RADIUS.md },
  actionBtnTxt: { color: COLORS.white, fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
});
