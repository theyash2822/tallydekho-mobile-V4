import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const AMBER    = '#A89060';
const AMBER_BG = '#A8906018';

type TxStatus = 'draft' | 'in-transit' | 'received' | 'cancelled';

interface ShippingItem {
  id: string; name: string; sku: string; price: string; count: string;
}

interface TransferDetail {
  id: string; ref: string; status: TxStatus;
  from: string; fromDate: string;
  to: string;   toDate: string;
  items: ShippingItem[];
}

// ── Mock detail map (keyed by transfer id) ────────────────────────────────────
const DETAIL_MAP: Record<string, TransferDetail> = {
  tx1: {
    id: 'tx1', ref: '#TX-2456', status: 'in-transit',
    from: 'Jaipur', fromDate: '1 Aug 2025', to: 'Delhi', toDate: '1 Aug 2025',
    items: [
      { id: 'i1', name: 'Palladium Power Cells', sku: 'PRD-1002-ABC', price: '₹95,750', count: '3 Items' },
      { id: 'i2', name: 'Mercury Solar Pack',    sku: 'PRD-1003-DEF', price: '₹45,200', count: '5 Items' },
      { id: 'i3', name: 'Titan Alloy Frame',     sku: 'PRD-1004-GHI', price: '₹12,600', count: '2 Items' },
    ],
  },
  tx2: {
    id: 'tx2', ref: '#TX-2457', status: 'in-transit',
    from: 'Mumbai', fromDate: '1 Aug 2025', to: 'Pune', toDate: '1 Aug 2025',
    items: [
      { id: 'i1', name: 'USB-C Hub Pro',      sku: 'PRD-2001-ABC', price: '₹8,500',  count: '5 Items'  },
      { id: 'i2', name: 'Wireless Keyboard',  sku: 'PRD-2002-DEF', price: '₹12,000', count: '3 Items'  },
      { id: 'i3', name: 'Optical Mouse',      sku: 'PRD-2003-GHI', price: '₹3,200',  count: '8 Items'  },
      { id: 'i4', name: 'HDMI Cable 2m',      sku: 'PRD-2004-JKL', price: '₹950',    count: '10 Items' },
      { id: 'i5', name: 'Screen Protector',   sku: 'PRD-2005-MNO', price: '₹450',    count: '20 Items' },
    ],
  },
  tx3: {
    id: 'tx3', ref: '#TX-2450', status: 'received',
    from: 'Delhi', fromDate: '28 Jul 2025', to: 'Hyderabad', toDate: '30 Jul 2025',
    items: [
      { id: 'i1', name: 'Mechanical Keyboard', sku: 'PRD-3001-ABC', price: '₹6,500',  count: '7 Items' },
      { id: 'i2', name: 'Monitor 24"',         sku: 'PRD-3002-DEF', price: '₹18,000', count: '3 Items' },
      { id: 'i3', name: 'Laptop Stand',        sku: 'PRD-3003-GHI', price: '₹2,800',  count: '6 Items' },
      { id: 'i4', name: 'Gaming Headset',      sku: 'PRD-3004-JKL', price: '₹4,500',  count: '4 Items' },
    ],
  },
  tx4: {
    id: 'tx4', ref: '#TX-2445', status: 'draft',
    from: 'Chennai', fromDate: '2 Jul 2025', to: 'Kolkata', toDate: '',
    items: [
      { id: 'i1', name: 'Webcam HD 1080p',  sku: 'PRD-4001-ABC', price: '₹3,200', count: '2 Items' },
      { id: 'i2', name: 'USB Microphone',   sku: 'PRD-4002-DEF', price: '₹5,800', count: '1 Item'  },
    ],
  },
  tx5: {
    id: 'tx5', ref: '#TX-2440', status: 'cancelled',
    from: 'Kolkata', fromDate: '28 Jun 2025', to: 'Bhubaneswar', toDate: '',
    items: [
      { id: 'i1', name: 'Portable Charger', sku: 'PRD-5001-ABC', price: '₹2,200', count: '4 Items' },
      { id: 'i2', name: 'Cable Organizer',  sku: 'PRD-5002-DEF', price: '₹450',   count: '8 Items' },
      { id: 'i3', name: 'Earbuds BT',       sku: 'PRD-5003-GHI', price: '₹1,800', count: '6 Items' },
    ],
  },
  tx6: {
    id: 'tx6', ref: '#TX-2435', status: 'received',
    from: 'Pune', fromDate: '15 Jul 2025', to: 'Mumbai', toDate: '18 Jul 2025',
    items: [
      { id: 'i1', name: 'Smart LED Bulb',   sku: 'PRD-6001-ABC', price: '₹800',   count: '20 Items' },
      { id: 'i2', name: 'Power Strip',      sku: 'PRD-6002-DEF', price: '₹1,200', count: '10 Items' },
      { id: 'i3', name: 'Extension Cord 3m',sku: 'PRD-6003-GHI', price: '₹650',   count: '8 Items'  },
      { id: 'i4', name: 'WiFi Router',      sku: 'PRD-6004-JKL', price: '₹3,500', count: '3 Items'  },
    ],
  },
  tx7: {
    id: 'tx7', ref: '#TX-2430', status: 'in-transit',
    from: 'Jaipur', fromDate: '22 Jun 2025', to: 'Mumbai', toDate: '12 Jul 2025',
    items: [
      { id: 'i1', name: 'Laptop Bag 15"',  sku: 'PRD-7001-ABC', price: '₹2,500', count: '8 Items'  },
      { id: 'i2', name: 'Mouse Pad XL',    sku: 'PRD-7002-DEF', price: '₹850',   count: '12 Items' },
      { id: 'i3', name: 'Cooling Pad',     sku: 'PRD-7003-GHI', price: '₹1,600', count: '6 Items'  },
    ],
  },
  tx8: {
    id: 'tx8', ref: '#TX-2425', status: 'draft',
    from: 'Delhi', fromDate: '20 Jun 2025', to: 'Chennai', toDate: '',
    items: [
      { id: 'i1', name: 'Document Scanner', sku: 'PRD-8001-ABC', price: '₹8,500', count: '1 Item' },
    ],
  },
};

const STATUS_CFG: Record<TxStatus, { color: string; bg: string; label: string; icon: any }> = {
  'draft':      { color: COLORS.warning,  bg: COLORS.warningBg,  label: 'Draft',      icon: 'document-outline'         },
  'in-transit': { color: AMBER,           bg: AMBER_BG,          label: 'In Transit', icon: 'car-outline'              },
  'received':   { color: COLORS.positive, bg: COLORS.positiveBg, label: 'Received',   icon: 'checkmark-circle-outline' },
  'cancelled':  { color: COLORS.negative, bg: COLORS.negativeBg, label: 'Cancelled',  icon: 'close-circle-outline'     },
};

// Step definitions
const STEPS: { label: string; icon: any }[] = [
  { label: 'Created',    icon: 'archive-outline'  },
  { label: 'Dispatched', icon: 'car-outline'      },
  { label: 'Received',   icon: 'download-outline' },
];

// Which steps are completed for each status
const STEP_STATES: Record<TxStatus, boolean[]> = {
  'draft':      [true,  false, false],
  'in-transit': [true,  true,  false],
  'received':   [true,  true,  true ],
  'cancelled':  [true,  false, false],
};

const FALLBACK: TransferDetail = DETAIL_MAP['tx1'];

export default function TransferDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = (params.id as string) || 'tx1';

  const detail    = DETAIL_MAP[id] || FALLBACK;
  const cfg        = STATUS_CFG[detail.status];
  const stepStates = STEP_STATES[detail.status];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Details</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Transfer ID + Status Badge ──────────────────────────────────── */}
        <View style={s.idStatusRow}>
          <Text style={s.transferId}>{detail.ref}</Text>
          <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={12} color={cfg.color} />
            <Text style={[s.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* ── Progress Stepper ──────────────────────────────────────────── */}
        <View style={s.stepperCard}>
          {/* Circles + connector lines */}
          <View style={s.stepperRow}>
            {STEPS.map((step, idx) => {
              const done  = stepStates[idx];
              const isLast = idx === STEPS.length - 1;
              const nextDone = !isLast && stepStates[idx + 1];
              return (
                <React.Fragment key={step.label}>
                  {/* Step circle */}
                  <View style={[s.stepCircle, done ? s.stepCircleDone : s.stepCircleEmpty]}>
                    <Ionicons name={step.icon} size={18} color={done ? '#fff' : COLORS.borderStrong} />
                  </View>
                  {/* Connector line */}
                  {!isLast && (
                    nextDone ? (
                      <View style={s.stepLineSolid} />
                    ) : (
                      <View style={s.stepLineDashed}>
                        {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(i => (
                          <View key={i} style={s.stepDash} />
                        ))}
                      </View>
                    )
                  )}
                </React.Fragment>
              );
            })}
          </View>
          {/* Step labels */}
          <View style={s.stepLabelsRow}>
            {STEPS.map((step, idx) => (
              <View key={step.label} style={s.stepLabelCol}>
                <Text style={[s.stepLabel, !stepStates[idx] && s.stepLabelGrey]}>
                  {step.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── From / To Location Row ──────────────────────────────────────── */}
        <View style={s.locationCard}>
          <View style={s.locationCol}>
            <Text style={s.locationCity}>{detail.from}</Text>
            <Text style={s.locationDate}>{detail.fromDate}</Text>
          </View>
          <View style={s.locationDivider} />
          <View style={[s.locationCol, { alignItems: 'flex-end' }]}>
            <Text style={[s.locationCity, { textAlign: 'right' }]}>{detail.to}</Text>
            <Text style={[s.locationDate, { textAlign: 'right' }]}>{detail.toDate || '—'}</Text>
          </View>
        </View>

        {/* ── Items In Shipping ───────────────────────────────────────────── */}
        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionTitle}>Items In Shipping</Text>
        </View>
        <View style={s.itemsCard}>
          {detail.items.map((item, idx) => (
            <View
              key={item.id}
              style={[s.itemRow, idx < detail.items.length - 1 && s.itemRowBorder]}
            >
              {/* Image placeholder */}
              <View style={s.itemImgBox}>
                <Ionicons name="cube-outline" size={20} color={COLORS.textTertiary} />
              </View>
              {/* Name + SKU */}
              <View style={s.itemInfo}>
                <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.itemSku}>{item.sku}</Text>
              </View>
              {/* Price + Count */}
              <View style={s.itemRight}>
                <Text style={s.itemPrice}>{item.price}</Text>
                <Text style={s.itemCount}>{item.count}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.pageBg },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  idStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: SPACING.sm },
  transferId:  { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full },
  statusTxt:   { fontSize: 11, fontWeight: '700' },

  // ── Progress Stepper ──────────────────────────────────────────────────────
  stepperCard:   { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault },
  stepperRow:    { flexDirection: 'row', alignItems: 'center' },
  stepCircle:    { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stepCircleDone:  { backgroundColor: COLORS.brandPrimary },
  stepCircleEmpty: { borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.borderStrong },
  stepLineSolid:   { flex: 1, height: 2, backgroundColor: COLORS.brandPrimary },
  stepLineDashed:  { flex: 1, height: 2, flexDirection: 'row', overflow: 'hidden' },
  stepDash:        { width: 6, height: 2, backgroundColor: COLORS.borderStrong, marginRight: 3 },
  stepLabelsRow:   { flexDirection: 'row', marginTop: 8 },
  stepLabelCol:    { flex: 1, alignItems: 'center' },
  stepLabel:       { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center' },
  stepLabelGrey:   { color: COLORS.textTertiary },

  // ── Location ──────────────────────────────────────────────────────────────
  locationCard:    { flexDirection: 'row', alignItems: 'stretch', marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  locationCol:     { flex: 1 },
  locationCity:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  locationDate:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },
  locationDivider: { width: 1, backgroundColor: COLORS.borderDefault, marginHorizontal: SPACING.sm },

  // ── Items In Shipping ─────────────────────────────────────────────────────
  sectionHeaderRow: { marginHorizontal: SPACING.md, marginBottom: SPACING.sm },
  sectionTitle:     { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  itemsCard:        { marginHorizontal: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  itemRow:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 12 },
  itemRowBorder:    { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  itemImgBox:       { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  itemInfo:         { flex: 1 },
  itemName:         { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  itemSku:          { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  itemRight:        { alignItems: 'flex-end', minWidth: 70 },
  itemPrice:        { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemCount:        { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
});
