import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// ── Mock Data ─────────────────────────────────────────────────────────────────
const UNMATCHED = [
  { id: '1',  invoiceNo: 'XYD-0909A', type: 'Sales',    errorType: 'HSN error',     party: 'Netaji Industries',  date: '25 July 2025', amount: '\u20b93,60,000' },
  { id: '2',  invoiceNo: 'XYD-0908B', type: 'Sales',    errorType: 'HSN error',     party: 'ABC Corporation',    date: '24 July 2025', amount: '\u20b92,80,000' },
  { id: '3',  invoiceNo: 'XYD-0907C', type: 'Sales',    errorType: 'HSN error',     party: 'XYZ Limited',        date: '23 July 2025', amount: '\u20b91,95,000' },
  { id: '4',  invoiceNo: 'XYD-0906D', type: 'Sales',    errorType: 'HSN error',     party: 'Tech Solutions Ltd', date: '22 July 2025', amount: '\u20b94,20,000' },
  { id: '5',  invoiceNo: 'XYD-0905E', type: 'Sales',    errorType: 'HSN error',     party: 'Global Industries',  date: '21 July 2025', amount: '\u20b91,80,000' },
  { id: '6',  invoiceNo: 'XYD-0904F', type: 'Sales',    errorType: 'HSN error',     party: 'Prime Services',     date: '20 July 2025', amount: '\u20b93,20,000' },
  { id: '7',  invoiceNo: 'XYD-0903G', type: 'Sales',    errorType: 'HSN error',     party: 'Innovation Corp',    date: '19 July 2025', amount: '\u20b92,75,000' },
  { id: '8',  invoiceNo: 'XYD-0902H', type: 'Purchase', errorType: 'Rate mismatch', party: 'Metro Traders',      date: '18 July 2025', amount: '\u20b91,50,000' },
  { id: '9',  invoiceNo: 'XYD-0901I', type: 'Sales',    errorType: 'GSTIN error',   party: 'Sunrise Exports',    date: '17 July 2025', amount: '\u20b95,10,000' },
  { id: '10', invoiceNo: 'XYD-0900J', type: 'Sales',    errorType: 'HSN error',     party: 'Apex Distributors',  date: '16 July 2025', amount: '\u20b92,10,000' },
];

// Error type config — all using brand palette
const ERROR_CFG: Record<string, { badgeBg: string; dotColor: string; textColor: string }> = {
  'HSN error':     { badgeBg: '#FEE2E2', dotColor: '#DC2626', textColor: '#DC2626' },
  'Rate mismatch': { badgeBg: '#FEF3C7', dotColor: '#D97706', textColor: '#D97706' },
  'GSTIN error':   { badgeBg: '#F3E8FF', dotColor: '#7C3AED', textColor: '#7C3AED' },
};
const DEFAULT_ERR = { badgeBg: '#FEE2E2', dotColor: '#DC2626', textColor: '#DC2626' };

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function UnmatchedListScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Unmatched List</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* ── List ────────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
      >
        {UNMATCHED.map((item) => {
          const cfg = ERROR_CFG[item.errorType] ?? DEFAULT_ERR;

          return (
            <TouchableOpacity
              key={item.id}
              style={s.card}
              onPress={() => router.push(`/document/${item.id}` as any)}
              activeOpacity={0.8}
            >
              {/* Top row: error badge + invoice ID + type */}
              <View style={s.cardTopRow}>
                <View style={[s.errorBadge, { backgroundColor: cfg.badgeBg }]}>
                  <View style={[s.errorDot, { backgroundColor: cfg.dotColor }]} />
                  <Text style={[s.errorTxt, { color: cfg.textColor }]}>
                    {item.errorType}
                  </Text>
                </View>
                <Text style={s.invId}>{item.invoiceNo}</Text>
                <Text style={s.invSep}> \u2022 </Text>
                <Text style={s.invType}>{item.type}</Text>
              </View>

              {/* Body row: warning icon + party name + amount */}
              <View style={s.cardBody}>
                <View style={s.warningWrap}>
                  <Ionicons name="warning" size={20} color="#DC2626" />
                </View>
                <View style={s.partyBlock}>
                  <Text style={s.partyName}>{item.party}</Text>
                  <Text style={s.partyDate}>{item.date}</Text>
                </View>
                <Text style={s.amount}>{item.amount}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
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
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary,
  },

  // List
  listContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  // Card
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    marginBottom: SPACING.sm,
    gap: 8,
  },

  // Top row
  cardTopRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  errorBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  errorDot:  { width: 7, height: 7, borderRadius: 4 },
  errorTxt:  { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  invId:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  invSep:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  invType:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },

  // Body row
  cardBody: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 2,
  },
  warningWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FEF2F2',
    alignItems: 'center', justifyContent: 'center',
  },
  partyBlock: { flex: 1, gap: 3 },
  partyName:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  partyDate:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  amount:     { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
});
