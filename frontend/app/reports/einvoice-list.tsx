import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Share, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { fyInfoToParam } from '../../src/context/AuthContext';
import { getEInvoiceGenerated, getEInvoicePending } from '../../src/services/api';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { useSettings } from '../../src/context/SettingsContext';

// Data loaded from API

const STATUS_CFG: Record<string, { bg: string; text: string; icon: string }> = {
  Generated: { bg: '#F0FBF4', text: '#2D7D46', icon: 'checkmark-circle' },
  Pending:   { bg: '#FEF3C7', text: '#D97706', icon: 'time'             },
  Error:     { bg: '#FEF2F2', text: '#DC2626', icon: 'warning'          },
  Cancelled: { bg: '#F3F4F6', text: '#6B7280', icon: 'close-circle'     },
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function EInvoiceListScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const [invoiceData,    setInvoiceData]    = useState<any[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [selected,       setSelected]       = useState<string[]>([]);
  const [fromDate,       setFromDate]       = useState(selectedFY?.startDate || '');
  const [toDate,         setToDate]         = useState(selectedFY?.endDate   || '');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Sync dates when selectedFY loads
  const fySynced = React.useRef(false);
  useEffect(() => {
    if (selectedFY?.startDate && !fySynced.current) {
      fySynced.current = true;
      setFromDate(selectedFY.startDate);
      setToDate(selectedFY.endDate || new Date().toISOString().split('T')[0]);
    }
  }, [selectedFY?.startDate]);
  const selectMode = selected.length > 0;

  useEffect(() => {
    if (!company?.guid) return;
    setLoading(true);
    const fyParam = fyInfoToParam(selectedFY);
    const dateParams = fromDate && toDate ? { from: fromDate, to: toDate } : (fyParam ? { fy: fyParam } : {});
    // Load both generated + pending and combine
    Promise.all([
      getEInvoiceGenerated(company.guid, dateParams).catch(() => ({ data: [] })),
      getEInvoicePending(company.guid, dateParams).catch(() => ({ data: [] })),
    ]).then(([genRes, pendRes]: any[]) => {
        const mapRow = (i: any, idx: number, status: string) => ({
          id: i.id?.toString() || `${status[0]}${idx}`,
          irn: i.irn || '',
          invoiceNo: i.voucher_number || i.voucher_no || `INV-${idx}`,
          party: i.party_name || 'Unknown',
          date: i.date || '',
          amount: Math.abs(+i.amount || 0).toLocaleString('en-IN'),
          status,
        });
        const generated = (genRes?.data  || []).map((i: any, idx: number) => mapRow(i, idx, 'Generated'));
        const pending   = (pendRes?.data || []).map((i: any, idx: number) => mapRow(i, idx, 'Pending'));
        // Sort combined by date desc
        const combined  = [...generated, ...pending].sort((a, b) => b.date.localeCompare(a.date));
        setInvoiceData(combined);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [company?.guid, selectedFY, fromDate, toDate]);

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const cancelSelect = () => setSelected([]);

  const handleShare = async () => {
    const lines = invoiceData
      .filter(i => selected.includes(i.id))
      .map(i => `${i.invoiceNo}  ${i.irn}  ${i.party}  ₹${i.amount}  ${i.status}`);
    try {
      await Share.share({ message: `TallyDekho — E-Invoices\n${lines.join('\n')}`, title: 'Share E-Invoices' });
    } catch {
      Alert.alert('Share', `${selected.length} E-Invoice(s) ready to share as PDF.`);
    }
    cancelSelect();
  };

  return (
    <SafeAreaView style={s.safe}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {selectMode ? `${selected.length} Selected` : 'E-Invoices'}
        </Text>
        {selectMode ? (
          <TouchableOpacity
            style={s.headerTextBtn}
            onPress={() => setSelected(invoiceData.map(i => i.id))}
            activeOpacity={0.7}
          >
            <Text style={s.headerTextBtnTxt}>Select All</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.backBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={20}
              color={fromDate ? COLORS.brandPrimary : COLORS.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>
        {invoiceData.length === 0 && !loading && (
          <View style={{ alignItems: 'center', padding: 48, gap: 12 }}>
            <Ionicons name="receipt-outline" size={40} color={COLORS.textTertiary} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.textSecondary }}>No E-Invoices found</Text>
            <Text style={{ fontSize: 12, color: COLORS.textTertiary, textAlign: 'center' }}>IRNs generated from Tally Prime will appear here once synced.</Text>
          </View>
        )}
        {invoiceData.map((item) => {
          const cfg = STATUS_CFG[item.status] ?? STATUS_CFG.Generated;
          const isSelected = selected.includes(item.id);
          return (
            <TouchableOpacity
              key={item.id}
              style={[s.card, isSelected && s.cardSelected]}
              onPress={() => {
                if (selectMode) { toggleSelect(item.id); }
                else { router.push(`/document/${item.id}` as any); }
              }}
              onLongPress={() => toggleSelect(item.id)}
              delayLongPress={500}
              activeOpacity={0.8}
            >
              {/* Top row: Invoice No + status badge */}
              <View style={s.cardTopRow}>
                <Text style={s.invoiceNo}>{item.invoiceNo}</Text>
                <Text style={s.sep}> • </Text>
                <Text style={s.irnTxt} numberOfLines={1}>{item.irn}</Text>
                <View style={{ flex: 1 }} />
                <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[s.statusTxt, { color: cfg.text }]}>{item.status}</Text>
                </View>
              </View>

              {/* Body: icon + party + amount */}
              <View style={s.cardBody}>
                <View style={[s.iconWrap, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon as any} size={22} color={cfg.text} />
                </View>
                <View style={s.partyBlock}>
                  <Text style={s.partyName}>{item.party}</Text>
                  <Text style={s.dateStr}>{item.date}</Text>
                </View>
                <Text style={s.amount}>{'\u20b9'}{item.amount}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: selectMode ? 90 : 40 }} />
      </ScrollView>

      {/* Share bar */}
      {selectMode && (
        <View style={[s.shareBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.shareLeft}>
            <Text style={s.shareCount}>{selected.length} selected</Text>
            <TouchableOpacity onPress={cancelSelect} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
              <Text style={s.shareCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.shareActionBtn} onPress={handleShare} activeOpacity={0.85}>
            <Ionicons name="share-outline" size={16} color={COLORS.white} />
            <Text style={s.shareActionTxt}>Share PDF / XLS</Text>
          </TouchableOpacity>
        </View>
      )}
      <DateRangePickerModal
        visible={showDatePicker}
        fromDate={fromDate}
        toDate={toDate}
        minDate={selectedFY?.startDate}
        maxDate={selectedFY?.endDate}
        onApply={(f, t) => { setFromDate(f); setToDate(t); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:          { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:      { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  headerTextBtn:    { width: 76, alignItems: 'flex-end', paddingRight: 8 },
  headerTextBtnTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary },

  listContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, marginBottom: SPACING.sm, gap: 10,
  },
  cardSelected: { borderColor: COLORS.brandPrimary, borderWidth: 2, backgroundColor: COLORS.brandPrimary + '06' },

  cardTopRow: { flexDirection: 'row', alignItems: 'center' },
  invoiceNo: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  sep:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  irnTxt:    { fontSize: 10, color: COLORS.textTertiary, flex: 1, fontFamily: 'monospace' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusTxt:   { fontSize: 11, fontWeight: '700' },

  cardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  partyBlock: { flex: 1, gap: 3 },
  partyName:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  dateStr:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  amount:     { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },

  shareBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 8,
  },
  shareLeft:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  shareCount:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  shareCancelTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  shareActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: RADIUS.md,
  },
  shareActionTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
});
