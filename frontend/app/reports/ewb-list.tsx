import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { useAuth } from '../../src/context/AuthContext';
import { fyInfoToParam } from '../../src/context/AuthContext';
import { getEWBList, getEWBPending } from '../../src/services/api';
import { useSettings } from '../../src/context/SettingsContext';
import { shareCompliancePdfSafely } from '../../src/utils/voucherPdf';
import { shareCompliancePdfsAsMultiPage, companyFromAuth } from '../../src/utils/multiShare';

// Data loaded from API

const STATUS_CFG: Record<string, { bg: string; text: string }> = {
  Active:   { bg: '#F0FBF4', text: '#2D7D46' },
  Expiring: { bg: '#FEF3C7', text: '#D97706' },
  Expired:  { bg: '#FEF2F2', text: '#DC2626' },
  Pending:  { bg: '#FEF3C7', text: '#D97706' },
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function EWBListScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const [ewbData, setEwbData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fromDate, setFromDate] = useState(selectedFY?.startDate || '');
  const [toDate,   setToDate]   = useState(selectedFY?.endDate   || '');
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Always sync dates when selectedFY changes
  useEffect(() => {
    if (selectedFY?.startDate) {
      setFromDate(selectedFY.startDate);
      setToDate(selectedFY.endDate || new Date().toISOString().split('T')[0]);
    }
  }, [selectedFY?.startDate, selectedFY?.endDate]);

  useEffect(() => {
    if (!company?.guid) return;
    setLoading(true);
    const fyParam = fyInfoToParam(selectedFY);
    const dateParams = fromDate && toDate ? { from: fromDate, to: toDate } : (fyParam ? { fy: fyParam } : {});
    const mapItem = (item: any, idx: number, defaultStatus: string) => ({
      id: item.guid || item.id?.toString() || `e${idx}`,
      ewbNo: item.ewb_number || item.ewb_no || '',
      type: item.voucher_type || 'Outward',
      party: item.party_name || 'Unknown',
      route: item.route || '',
      date: item.date || '',
      amount: Math.abs(+item.amount || 0).toLocaleString('en-IN'),
      status: item.ewb_status || defaultStatus,
      // Kept raw for the e-Way Bill PDF sheet.
      voucherNumber: item.voucher_number || item.voucher_no || '',
      amountValue: Math.abs(+item.amount || 0),
      ewbDate: item.ewb_date || '',
      validTill: item.valid_till || '',
      vehicleNo: item.vehicle_no || '',
      transporterId: item.transporter_id || '',
      distanceKm: item.distance_km || '',
      supplyType: item.supply_type || '',
      subSupplyType: item.sub_supply_type || '',
    });
    Promise.all([
      getEWBList(company.guid, dateParams).catch(() => ({ data: [] })),
      getEWBPending(company.guid, dateParams).catch(() => ({ data: [] })),
    ]).then(([genRes, pendRes]: any[]) => {
      const generated = (genRes?.data  || []).map((i: any, idx: number) => mapItem(i, idx, 'Active'));
      const pending   = (pendRes?.data || []).map((i: any, idx: number) => mapItem(i, idx, 'Pending'));
      const combined  = [...generated, ...pending].sort((a, b) => b.date.localeCompare(a.date));
      setEwbData(combined);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [company?.guid, selectedFY, fromDate, toDate]);
  const selectMode = selected.length > 0;

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const cancelSelect = () => setSelected([]);

  const handleSharePdf = async (item: any) => {
    setSharingId(item.id);
    await shareCompliancePdfSafely('ewaybill', {
      ewbNo: item.ewbNo,
      ewbDate: item.ewbDate || item.date,
      validTill: item.validTill,
      vehicleNo: item.vehicleNo,
      transporterId: item.transporterId,
      distanceKm: item.distanceKm,
      supplyType: item.supplyType,
      subSupplyType: item.subSupplyType,
      voucherNumber: item.voucherNumber,
      voucherType: item.type,
      date: item.date,
      partyName: item.party,
      shipTo: item.route,
      amount: item.amountValue,
    }, {
      name: company?.name,
      address: (company as any)?.address,
      gstin: (company as any)?.gstin,
    }, { onBeforeShare: () => setSharingId(null) });
    setSharingId(null);
  };

  const handleShare = async () => {
    const items = ewbData.filter(i => selected.includes(i.id) && !!i.ewbNo);
    if (!items.length) {
      Toast.show({ type: 'info', text1: 'Nothing to share', text2: 'Select e-Way Bills with a bill number.' });
      return;
    }
    if (isSharing) return;
    setIsSharing(true);
    try {
      const { shared, failed } = await shareCompliancePdfsAsMultiPage(
        'ewaybill',
        items.map(item => ({
          ewbNo: item.ewbNo,
          ewbDate: item.ewbDate || item.date,
          validTill: item.validTill,
          vehicleNo: item.vehicleNo,
          transporterId: item.transporterId,
          distanceKm: item.distanceKm,
          supplyType: item.supplyType,
          subSupplyType: item.subSupplyType,
          voucherNumber: item.voucherNumber,
          voucherType: item.type,
          date: item.date,
          partyName: item.party,
          shipTo: item.route,
          amount: item.amountValue,
        })),
        companyFromAuth(company),
        {
          fileName: `E-Way-Bills (${items.length}).pdf`,
          onBeforeShare: () => setIsSharing(false),
        }
      );
      if (failed > 0) {
        Toast.show({ type: 'info', text1: `Shared ${shared} of ${items.length}`, text2: `${failed} could not be built` });
      }
      cancelSelect();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not share PDFs.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>

      {/* Header — title stays fixed */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>E-Way Bills</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Date Filter Row */}
      <View style={s.filterRow}>
        <TouchableOpacity style={s.datePill} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          <Text style={s.dateTxt}>{fromDate} – {toDate}</Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>
        {ewbData.length === 0 && !loading && (
          <View style={{ alignItems: 'center', padding: 48, gap: 12 }}>
            <Ionicons name="document-text-outline" size={40} color={COLORS.textTertiary} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.textSecondary }}>No E-Way Bills Generated Yet</Text>
            <Text style={{ fontSize: 12, color: COLORS.textTertiary, textAlign: 'center' }}>E-Way Bills generated from Tally Prime will appear here once synced.</Text>
          </View>
        )}
        {ewbData.map((item) => {
          const cfg = STATUS_CFG[item.status] ?? STATUS_CFG.Active;
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
              {/* Top row: EWB number + type + status badge */}
              <View style={s.cardTopRow}>
                <Text style={s.ewbNo}>{item.ewbNo}</Text>
                <Text style={s.sep}> • </Text>
                <Text style={s.type}>{item.type}</Text>
                <View style={{ flex: 1 }} />
                <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[s.statusTxt, { color: cfg.text }]}>{item.status}</Text>
                </View>
              </View>

              {/* Body: icon + party / route + amount */}
              <View style={s.cardBody}>
                <View style={[s.iconWrap, { backgroundColor: cfg.bg }]}>
                  <Ionicons
                    name={item.status === 'Active' ? 'checkmark-circle' : item.status === 'Expiring' ? 'time' : 'close-circle'}
                    size={22}
                    color={cfg.text}
                  />
                </View>
                <View style={s.partyBlock}>
                  <Text style={s.partyName}>{item.party}</Text>
                  <View style={s.routeRow}>
                    <Ionicons name="navigate-outline" size={11} color={COLORS.textTertiary} />
                    <Text style={s.routeTxt}>{item.route}</Text>
                  </View>
                  <Text style={s.dateStr}>{item.date}</Text>
                </View>
                <Text style={s.amount}>{'\u20b9'}{item.amount}</Text>
              </View>

              {!!item.ewbNo && (
                <TouchableOpacity
                  style={s.rowShareBtn}
                  onPress={() => handleSharePdf(item)}
                  activeOpacity={0.85}
                  disabled={sharingId === item.id}
                >
                  {sharingId === item.id ? (
                    <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                  ) : (
                    <>
                      <Ionicons name="share-outline" size={14} color={COLORS.brandPrimary} />
                      <Text style={s.rowShareTxt}>Share PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
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
            <TouchableOpacity onPress={() => setSelected(ewbData.map(i => i.id))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
              <Text style={s.shareCancelTxt}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={cancelSelect} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
              <Text style={s.shareCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[s.shareActionBtn, isSharing && { opacity: 0.6 }]}
            onPress={handleShare}
            activeOpacity={0.85}
            disabled={isSharing}
          >
            {isSharing
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Ionicons name="share-outline" size={16} color={COLORS.white} />
            }
            <Text style={s.shareActionTxt}>{isSharing ? 'Preparing…' : 'Share PDF'}</Text>
          </TouchableOpacity>
        </View>
      )}
      {/* Date Range Modal */}
      <DateRangePickerModal
        visible={showDatePicker}
        fromDate={fromDate}
        toDate={toDate}
        minDate={selectedFY?.startDate}
        maxDate={selectedFY?.endDate}
        onApply={(from, to) => { setFromDate(from); setToDate(to); setShowDatePicker(false); }}
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
  backBtn:       { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  headerTextBtn: { width: 76, alignItems: 'flex-end', paddingRight: 8 },
  headerTextBtnTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary },

  listContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  filterRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  datePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  dateTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },

  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, marginBottom: SPACING.sm, gap: 10,
  },
  cardSelected: { borderColor: COLORS.brandPrimary, borderWidth: 2, backgroundColor: COLORS.brandPrimary + '06' },

  cardTopRow: { flexDirection: 'row', alignItems: 'center' },
  ewbNo: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  sep:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  type:  { fontSize: TYPOGRAPHY.xs, fontWeight: '500', color: COLORS.textSecondary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusTxt:   { fontSize: 11, fontWeight: '700' },

  cardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  partyBlock: { flex: 1, gap: 3 },
  partyName:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  routeRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeTxt:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
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
  shareLeft:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  shareCount:      { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  shareCancelTxt:  { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  shareActionBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: RADIUS.md,
  },
  shareActionTxt:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },

  rowShareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center',
    alignSelf: 'flex-start', minWidth: 44,
    borderWidth: 1, borderColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  rowShareTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.brandPrimary },
});
