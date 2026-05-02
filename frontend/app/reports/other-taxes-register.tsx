import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Share, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getVouchers } from '../../src/services/api';
import { ErrorBanner } from '../../src/components/ApiStateViews';

// Invoice data loaded from API

const STATUS_CFG: Record<string, { bg: string; text: string; icon: string }> = {
  Paid:    { bg: '#F0FBF4', text: '#2D7D46', icon: 'checkmark-circle' },
  Pending: { bg: '#FEF3C7', text: '#D97706', icon: 'time'             },
  Late:    { bg: '#FEF2F2', text: '#DC2626', icon: 'warning'          },
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function OtherTaxesRegisterScreen() {
  const router  = useRouter();
  const params  = useLocalSearchParams<{ tab?: string }>();
  const tabName = params.tab ?? 'TDS';

  const { company, selectedFY } = useAuth();
  const companyGuid = company?.guid;
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!companyGuid) return;
    setIsLoading(true);
    const fyParams = selectedFY ? { from: selectedFY.startDate, to: selectedFY.endDate } : {};
    getVouchers(companyGuid, undefined, { ...fyParams, limit: '200' }).then((res: any) => {
      const rows = (res?.data ?? []).filter((r: any) =>
        (r.voucher_type||'').toLowerCase().includes('sales') ||
        (r.voucher_type||'').toLowerCase().includes('purchase')
      );
      setInvoices(rows.map((r: any) => ({
        id: r.guid || String(r.id),
        invoiceNo: r.voucher_number || '',
        type: (r.voucher_type||'').toLowerCase().includes('purchase') ? 'Purchase' : 'Sales',
        party: r.party_name || '—',
        date: r.date || '',
        amount: Math.abs(+r.amount||0).toLocaleString('en-IN'),
        status: r.is_cancelled ? 'Cancelled' : 'Posted',
      })));
    }).catch((err: any) => setApiError(err?.message || 'Failed'))
      .finally(() => setIsLoading(false));
  }, [companyGuid, selectedFY?.startDate]);

  const [selected,    setSelected]    = useState<string[]>([]);
  const selectMode = selected.length > 0;

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const cancelSelect = () => setSelected([]);

  const handleExport = async () => {
    const lines = invoices
      .filter(i => selected.includes(i.id))
      .map(i => `${i.invoiceNo}  ${i.party}  \u20b9${i.amount}  ${i.status}`);
    try {
      await Share.share({
        message: `TallyDekho \u2014 ${tabName} Register\n${lines.join('\n')}`,
        title:   `${tabName} Register Export`,
      });
    } catch {
      Alert.alert('Export', `${selected.length} invoice(s) ready to export as PDF.`);
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
        <Text style={s.headerTitle} numberOfLines={1}>
          {selectMode ? `${selected.length} Selected` : `${tabName} Register`}
        </Text>
        {selectMode ? (
          <TouchableOpacity
            style={s.headerTextBtn}
            onPress={() => setSelected(invoices.map(i => i.id))}
            activeOpacity={0.7}
          >
            <Text style={s.headerTextBtnTxt}>Select All</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 76 }} />
        )}
      </View>

      {/* Invoice List */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>
        {invoices.map((item) => {
          const cfg        = STATUS_CFG[item.status] ?? STATUS_CFG.Pending;
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
              {/* Top row: Invoice No + type + status badge */}
              <View style={s.cardTopRow}>
                <Text style={s.invoiceNo}>{item.invoiceNo}</Text>
                <Text style={s.sep}> \u2022 </Text>
                <Text style={s.type}>{item.type}</Text>
                <View style={{ flex: 1 }} />
                <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[s.statusTxt, { color: cfg.text }]}>{item.status}</Text>
                </View>
              </View>

              {/* Body: icon + party + date + amount */}
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

        <View style={{ height: selectMode ? 100 : 40 }} />
      </ScrollView>

      {/* ── Export bar — ONLY visible when items are selected ─────────────── */}
      {selectMode && (
        <View style={s.exportBar}>
          <View style={s.exportLeft}>
            <Text style={s.exportCount}>{selected.length} selected</Text>
            <TouchableOpacity
              onPress={cancelSelect}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text style={s.exportCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.exportActionBtn} onPress={handleExport} activeOpacity={0.85}>
            <Ionicons name="document-text-outline" size={16} color={COLORS.white} />
            <Text style={s.exportActionTxt}>Export as PDF</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
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

  // Invoice cards
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, marginBottom: SPACING.sm, gap: 10,
  },
  cardSelected: {
    borderColor: COLORS.brandPrimary, borderWidth: 2,
    backgroundColor: COLORS.brandPrimary + '06',
  },

  cardTopRow: { flexDirection: 'row', alignItems: 'center' },
  invoiceNo:  { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  sep:        { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  type:       { fontSize: TYPOGRAPHY.xs, fontWeight: '500', color: COLORS.textSecondary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusTxt:   { fontSize: 11, fontWeight: '700' },

  cardBody:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  partyBlock: { flex: 1, gap: 3 },
  partyName:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  dateStr:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  amount:     { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },

  // Export bar (shown only when >=1 selected)
  exportBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14, paddingBottom: 20,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 8,
  },
  exportLeft:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  exportCount:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  exportCancelTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  exportActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: RADIUS.md,
  },
  exportActionTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
});
