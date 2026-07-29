import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Share, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useSettings } from '../../src/context/SettingsContext';

const AMBER = '#1A1A1A';

const TYPE_LABELS: Record<string, string> = {
  payment:            'Payment',
  receipt:            'Receipt',
  contra:             'Contra',
  journal:            'Journal',
  credit_note:        'Credit Note',
  debit_note:         'Debit Note',
  delivery_note:      'Delivery Note',
  payable_invoice:    'Outstanding Invoice',
  receivable_invoice: 'Outstanding Invoice',
};

export default function VoucherPreviewScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const p = useLocalSearchParams<Record<string, string>>();
  const type  = (p.type as string) || 'payment';
  const title = TYPE_LABELS[type] || 'Voucher';

  // Parse JSON items for table voucher types
  let items: { no: string; item: string; qty?: string; price: string }[] = [];
  try { if (p.items) items = JSON.parse(p.items as string); } catch {}

  let deliveryItems: { no: string; item: string; qty: string }[] = [];
  try { if (p.deliveryItems) deliveryItems = JSON.parse(p.deliveryItems as string); } catch {}

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${title}\nVoucher: ${p.voucherNumber || 'N/A'}\nDate: ${p.date || 'N/A'}\nAmount: ${p.amount || 'N/A'}`,
        title: `${title} Voucher`,
      });
    } catch {
      Alert.alert('Share', 'Share via the OS share sheet');
    }
  };

  // ── Field row ───────────────────────────────────────────────────────────
  const Field = ({ label, value, last = false }: { label: string; value: string; last?: boolean }) => (
    <View style={[pv.field, !last && pv.fieldBorder]}>
      <Text style={pv.fieldLbl}>{label}</Text>
      <Text style={pv.fieldVal}>{value || '\u2014'}</Text>
    </View>
  );

  // ── Amount highlight ─────────────────────────────────────────────────────
  const AmountRow = ({ value }: { value: string }) => (
    <View style={pv.amtRow}>
      <Text style={pv.amtLbl}>Amount</Text>
      <Text style={pv.amtVal}>{value || '\u2014'}</Text>
    </View>
  );

  // ── Item table (Credit Note / Debit Note) ────────────────────────────────
  const ItemTable = ({ showQty = true }: { showQty?: boolean }) => {
    if (!items.length) {
      // Render sample data for demo
      const sampleItems = type === 'credit_note'
        ? [
            { no: '1', item: 'HR-Sheet 2 mm (2.4 × 1.2m)', qty: '10 pcs × 550', price: '₹5,50,500' },
            { no: '2', item: 'GST 18%', qty: '', price: '₹99,000' },
          ]
        : [
            { no: '1', item: 'Quality claim charge', qty: '', price: '-₹1,00,000' },
            { no: '2', item: 'GST 18%', qty: '', price: '-₹18,000' },
          ];
      return (
        <View style={pv.table}>
          <View style={pv.tHead}>
            <Text style={[pv.th, { flex: 0.25 }]}>#</Text>
            <Text style={[pv.th, { flex: 1 }]}>ITEM</Text>
            {showQty && <Text style={[pv.th, { flex: 0.7 }]}>QTY</Text>}
            <Text style={[pv.th, { flex: 0.7, textAlign: 'right' }]}>PRICE</Text>
          </View>
          {sampleItems.map((row, i) => (
            <View key={i} style={[pv.tRow, i < sampleItems.length - 1 && pv.tRowBorder]}>
              <Text style={[pv.td, { flex: 0.25 }]}>{row.no}</Text>
              <Text style={[pv.td, { flex: 1 }]} numberOfLines={2}>{row.item}</Text>
              {showQty && <Text style={[pv.td, { flex: 0.7 }]}>{row.qty || '\u2014'}</Text>}
              <Text style={[pv.td, { flex: 0.7, textAlign: 'right' }]}>{row.price}</Text>
            </View>
          ))}
          <AmountRow value={p.amount || (type === 'credit_note' ? '\u20b96,49,000' : '\u20b91,18,000')} />
        </View>
      );
    }
    return (
      <View style={pv.table}>
        <View style={pv.tHead}>
          <Text style={[pv.th, { flex: 0.25 }]}>#</Text>
          <Text style={[pv.th, { flex: 1 }]}>ITEM</Text>
          {showQty && <Text style={[pv.th, { flex: 0.7 }]}>QTY</Text>}
          <Text style={[pv.th, { flex: 0.7, textAlign: 'right' }]}>PRICE</Text>
        </View>
        {items.map((row, i) => (
          <View key={i} style={[pv.tRow, i < items.length - 1 && pv.tRowBorder]}>
            <Text style={[pv.td, { flex: 0.25 }]}>{row.no}</Text>
            <Text style={[pv.td, { flex: 1 }]} numberOfLines={2}>{row.item}</Text>
            {showQty && <Text style={[pv.td, { flex: 0.7 }]}>{row.qty || '\u2014'}</Text>}
            <Text style={[pv.td, { flex: 0.7, textAlign: 'right' }]}>{row.price}</Text>
          </View>
        ))}
        <AmountRow value={p.amount || '\u2014'} />
      </View>
    );
  };

  // ── Delivery item table ──────────────────────────────────────────────────
  const DeliveryTable = () => {
    const rows = deliveryItems;
    return (
      <View style={pv.table}>
        <View style={pv.tHead}>
          <Text style={[pv.th, { flex: 0.25 }]}>#</Text>
          <Text style={[pv.th, { flex: 1 }]}>ITEM</Text>
          <Text style={[pv.th, { flex: 0.6, textAlign: 'right' }]}>QTY</Text>
        </View>
        {rows.length === 0 ? (
          <View style={pv.tRow}>
            <Text style={[pv.td, { flex: 1 }]}>No items</Text>
          </View>
        ) : rows.map((row, i) => (
          <View key={i} style={[pv.tRow, i < rows.length - 1 && pv.tRowBorder]}>
            <Text style={[pv.td, { flex: 0.25 }]}>{row.no}</Text>
            <Text style={[pv.td, { flex: 1 }]}>{row.item}</Text>
            <Text style={[pv.td, { flex: 0.6, textAlign: 'right' }]}>{row.qty}</Text>
          </View>
        ))}
        {!!p.totalPackages && (
          <View style={pv.summaryRow}>
            <Text style={pv.sumLbl}>Total Packages</Text>
            <Text style={pv.sumVal}>{p.totalPackages}</Text>
          </View>
        )}
        <View style={[pv.summaryRow, { borderTopWidth: 1, borderTopColor: COLORS.borderDefault }]}>
          <Text style={pv.sumLbl}>Total Quantity</Text>
          <Text style={pv.sumVal}>{p.totalQty || '\u2014'}</Text>
        </View>
      </View>
    );
  };

  // ── Content by voucher type ──────────────────────────────────────────────
  const renderContent = () => {
    switch (type) {
      case 'payment':
        return (
          <>
            <Field label="VOUCHER NUMBER" value={p.voucherNumber || 'PMT-3010'} />
            <Field label="DATE" value={p.date || '10 Jul 2025'} />
            <Field label="MODE" value={p.mode || 'Bank \u2014 HDFC CA-1234 \u00b7 Ref No\u2022 UTR 214589763'} />
            <Field label="PAID TO" value={p.paidTo || p.party || '\u2014'} />
            <Field label="PAYMENT REFERENCE" value={p.paymentRef || 'IV-87087'} />
            <AmountRow value={p.amount || '\u2014'} />
            <Field label="NARRATION" value={p.narration || '\u2014'} last />
          </>
        );

      case 'receipt':
        return (
          <>
            <Field label="VOUCHER NUMBER" value={p.voucherNumber || 'RCP-2010'} />
            <Field label="DATE" value={p.date || '10 Jul 2025'} />
            <Field label="MODE" value={p.mode || 'Bank \u2014 HDFC CA-1234 \u00b7 Ref No\u2022 UTR 214589763'} />
            <Field label="RECEIVED FROM" value={p.receivedFrom || p.party || '\u2014'} />
            <Field label="PAYMENT REFERENCE" value={p.paymentRef || 'IV-87087'} />
            <AmountRow value={p.amount || '\u2014'} />
            <Field label="NARRATION" value={p.narration || '\u2014'} last />
          </>
        );

      case 'contra':
        return (
          <>
            <Field label="VOUCHER NUMBER" value={p.voucherNumber || 'CON-0044'} />
            <Field label="DATE" value={p.date || '09 Jul 2025'} />
            <Field label="TYPE" value={p.contraType || 'Cash to bank'} />
            <Field label="FROM" value={p.from || 'Cash In Hand'} />
            <Field label="TO" value={p.to || 'HDFC Bank CA-1234'} />
            <AmountRow value={p.amount || '\u2014'} />
            <Field label="NARRATION" value={p.narration || '\u2014'} last />
          </>
        );

      case 'journal':
        return (
          <>
            <Field label="VOUCHER NUMBER" value={p.voucherNumber || 'JV-0312'} />
            <Field label="DATE" value={p.date || '10 Jul 2025'} />
            <Field label="FROM" value={p.from || 'ICICI Bank CA-0123'} />
            <Field label="TO" value={p.to || 'HDFC Bank CA-1234'} />
            <AmountRow value={p.amount || '\u2014'} />
            <Field label="NARRATION" value={p.narration || '\u2014'} last />
          </>
        );

      case 'credit_note':
        return (
          <>
            <Field label="VOUCHER NUMBER" value={p.voucherNumber || 'CN-00712'} />
            <Field label="DATE" value={p.date || '09 Jul 2025'} />
            <Field label="CUSTOMER" value={p.customer || '\u2014'} />
            <Field label="AGAINST" value={p.against || '\u2014'} />
            <ItemTable showQty={true} />
            <Field label="NARRATION" value={p.narration || '\u2014'} last />
          </>
        );

      case 'debit_note':
        return (
          <>
            <Field label="VOUCHER NUMBER" value={p.voucherNumber || 'DN-00112'} />
            <Field label="DATE" value={p.date || '07 Jul 2025'} />
            <Field label="SUPPLIER" value={p.supplier || '\u2014'} />
            <Field label="AGAINST" value={p.against || '\u2014'} />
            <ItemTable showQty={false} />
            <Field label="NARRATION" value={p.narration || '\u2014'} last />
          </>
        );

      case 'delivery_note':
        return (
          <>
            <Field label="VOUCHER NUMBER" value={p.voucherNumber || '\u2014'} />
            <Field label="DATE" value={p.date || '\u2014'} />
            <Field label="CUSTOMER" value={p.customer || p.party || '\u2014'} />
            <Field label="DISPATCH FROM" value={p.dispatchFrom || '\u2014'} />
            <Field label="SHIP TO" value={p.shipTo || '\u2014'} />
            <Field label="DISPATCH MODE" value={p.dispatchMode || '\u2014'} />
            <Field label="VEHICLE / LR" value={p.vehicleLR || '\u2014'} />
            <Field label="AGAINST SO" value={p.againstSO || '\u2014'} />
            <DeliveryTable />
            <Field label="NARRATION" value={p.narration || '\u2014'} last />
          </>
        );

      // payable_invoice / receivable_invoice / default
      default:
        return (
          <>
            <Field label="VOUCHER NUMBER" value={p.voucherNumber || '\u2014'} />
            <Field label="DATE" value={p.date || '\u2014'} />
            <Field label="PARTY" value={p.party || '\u2014'} />
            <Field label="REFERENCE" value={p.paymentRef || p.voucherNumber || '\u2014'} />
            <AmountRow value={p.amount || '\u2014'} />
            <Field label="STATUS" value={p.status || 'Outstanding'} last />
          </>
        );
    }
  };

  return (
    <SafeAreaView style={pv.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={pv.header}>
        <TouchableOpacity style={pv.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={pv.headerTitle}>{title}</Text>
        <View style={pv.headerBtn} />
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={pv.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={pv.scrollContent}
      >
        <View style={pv.card}>
          {renderContent()}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Share Button */}
      <View style={pv.footer}>
        <TouchableOpacity style={pv.shareBtn} onPress={handleShare} activeOpacity={0.8}>
          <Ionicons name="share-social-outline" size={18} color={COLORS.white} />
          <Text style={pv.shareTxt}>Share</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const pv = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.pageBg },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:    { width: 40 },
  headerTitle:  { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  card:        { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },

  field:       { paddingHorizontal: SPACING.md, paddingVertical: 14 },
  fieldBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  fieldLbl:    { fontSize: 10, color: COLORS.textTertiary, fontWeight: '600', letterSpacing: 0.8, marginBottom: 5, textTransform: 'uppercase' },
  fieldVal:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },

  amtRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 16, backgroundColor: COLORS.pageBg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.borderDefault },
  amtLbl:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  amtVal:  { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },

  table:       { borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  tHead:       { flexDirection: 'row', backgroundColor: COLORS.pageBg, paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  th:          { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  tRow:        { flexDirection: 'row', paddingHorizontal: SPACING.md, paddingVertical: 12 },
  tRowBorder:  { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  td:          { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 12 },
  sumLbl:     { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  sumVal:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  footer:   { paddingHorizontal: SPACING.md, paddingVertical: 12, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  shareBtn: { backgroundColor: AMBER, borderRadius: RADIUS.lg, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
