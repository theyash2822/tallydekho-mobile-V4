import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';

type TaxTab = 'TDS' | 'TCS' | 'Import Duty' | 'Export Duty' | 'Excise' | 'VAT' | 'Cess';
const TAX_TABS: TaxTab[] = ['TDS', 'TCS', 'Import Duty', 'Export Duty', 'Excise', 'VAT', 'Cess'];

const PERIODS: DropdownOption[] = [
  { label: 'This Month', value: 'month' },
  { label: 'Quarterly', value: 'quarter' },
  { label: 'Half Yearly', value: 'half' },
  { label: 'Yearly', value: 'year' },
];

const TAX_DATA: Record<TaxTab, { label: string; value: string; color: string; icon: string }[]> = {
  TDS: [
    { label: 'Deducted',     value: '₹1,24,000', color: COLORS.info,     icon: 'remove-circle-outline' },
    { label: 'Remitted',     value: '₹98,000',   color: COLORS.positive, icon: 'checkmark-circle-outline' },
    { label: 'Pending Pay',  value: '₹26,000',   color: COLORS.warning,  icon: 'time-outline' },
    { label: 'Late Fee',     value: '₹0',         color: COLORS.negative, icon: 'warning-outline' },
    { label: 'Total Challan',value: '8',           color: '#7C3AED',       icon: 'document-outline' },
    { label: 'Next Due',     value: '7 Jul 25',   color: COLORS.info,     icon: 'calendar-outline' },
  ],
  TCS: [
    { label: 'Collected',    value: '₹42,000',   color: COLORS.info,     icon: 'add-circle-outline' },
    { label: 'Remitted',     value: '₹38,000',   color: COLORS.positive, icon: 'checkmark-circle-outline' },
    { label: 'Pending',      value: '₹4,000',    color: COLORS.warning,  icon: 'time-outline' },
    { label: 'Late Fee',     value: '₹0',         color: COLORS.negative, icon: 'warning-outline' },
    { label: 'Total Challan',value: '3',           color: '#7C3AED',       icon: 'document-outline' },
    { label: 'Next Due',     value: '7 Jul 25',   color: COLORS.info,     icon: 'calendar-outline' },
  ],
  'Import Duty': [
    { label: 'Assessed',     value: '₹2,80,000', color: COLORS.info,     icon: 'boat-outline' },
    { label: 'Paid',         value: '₹2,80,000', color: COLORS.positive, icon: 'checkmark-circle-outline' },
    { label: 'Pending',      value: '₹0',         color: COLORS.warning,  icon: 'time-outline' },
    { label: 'IGST Paid',    value: '₹50,400',   color: '#7C3AED',       icon: 'receipt-outline' },
    { label: 'Customs Duty', value: '₹2,29,600', color: COLORS.info,     icon: 'document-outline' },
    { label: 'Shipments',    value: '6',           color: COLORS.textSecondary, icon: 'cube-outline' },
  ],
  'Export Duty': [
    { label: 'Applicable',   value: '₹18,000',   color: COLORS.info,     icon: 'airplane-outline' },
    { label: 'Paid',         value: '₹18,000',   color: COLORS.positive, icon: 'checkmark-circle-outline' },
    { label: 'Refund Clm.',  value: '₹4,200',    color: '#7C3AED',       icon: 'arrow-undo-outline' },
    { label: 'IGST Refund',  value: '₹8,100',    color: COLORS.positive, icon: 'cash-outline' },
    { label: 'Shipments',    value: '4',           color: COLORS.textSecondary, icon: 'cube-outline' },
    { label: 'Next Deadline','value': 'N/A',        color: COLORS.textTertiary, icon: 'calendar-outline' },
  ],
  Excise: [
    { label: 'Assessable Val', value: '₹8,40,000', color: COLORS.info,    icon: 'flask-outline' },
    { label: 'Duty Payable',   value: '₹84,000',   color: COLORS.warning, icon: 'time-outline' },
    { label: 'Duty Paid',      value: '₹84,000',   color: COLORS.positive,icon: 'checkmark-circle-outline' },
    { label: 'Returns Filed',  value: '2/2',        color: COLORS.positive,icon: 'document-text-outline' },
    { label: 'Cess',           value: '₹1,680',    color: '#7C3AED',      icon: 'receipt-outline' },
    { label: 'Next Due',       value: '30 Jun 25', color: COLORS.info,    icon: 'calendar-outline' },
  ],
  VAT: [
    { label: 'Output VAT',  value: '₹62,000',   color: COLORS.info,     icon: 'trending-up' },
    { label: 'Input VAT',   value: '₹38,000',   color: '#7C3AED',       icon: 'trending-down' },
    { label: 'Net VAT',     value: '₹24,000',   color: COLORS.warning,  icon: 'calculator-outline' },
    { label: 'Paid',        value: '₹20,000',   color: COLORS.positive, icon: 'checkmark-circle-outline' },
    { label: 'Pending',     value: '₹4,000',    color: COLORS.negative, icon: 'time-outline' },
    { label: 'Returns',     value: '1/1',        color: COLORS.positive, icon: 'document-text-outline' },
  ],
  Cess: [
    { label: 'Total Cess',   value: '₹12,000',  color: COLORS.info,     icon: 'layers-outline' },
    { label: 'GST Cess',     value: '₹8,400',   color: '#7C3AED',       icon: 'receipt-outline' },
    { label: 'Education Cess', value: '₹2,400', color: COLORS.warning,  icon: 'school-outline' },
    { label: 'Other Cess',   value: '₹1,200',   color: COLORS.info,     icon: 'add-circle-outline' },
    { label: 'Paid',         value: '₹12,000',  color: COLORS.positive, icon: 'checkmark-circle-outline' },
    { label: 'Balance',      value: '₹0',        color: COLORS.textSecondary, icon: 'wallet-outline' },
  ],
};

export default function OtherTaxesScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState('month');
  const [activeTab, setActiveTab] = useState<TaxTab>('TDS');

  const data = TAX_DATA[activeTab];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Other Taxes</Text>
        <TouchableOpacity style={s.exportBtn} activeOpacity={0.7}>
          <Ionicons name="download-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll} contentContainerStyle={s.tabsContent}>
        {TAX_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[s.tabTxt, activeTab === tab && s.tabTxtActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Period Filter */}
        <View style={s.filterRow}>
          <FormDropdown
            label="Period"
            value={period}
            options={PERIODS}
            onSelect={o => setPeriod(o.value)}
            placeholder="Select period"
            containerStyle={{ flex: 1, marginBottom: 0 }}
          />
          <View style={s.fyBadge}><Text style={s.fyTxt}>FY 2025-26</Text></View>
        </View>

        {/* Summary Grid */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{activeTab} Summary</Text>
          <View style={s.grid}>
            {data.map(item => (
              <View key={item.label} style={s.gridCell}>
                <View style={[s.cellIcon, { backgroundColor: item.color + '18' }]}>
                  <Ionicons name={item.icon as any} size={16} color={item.color} />
                </View>
                <Text style={s.cellValue}>{item.value}</Text>
                <Text style={s.cellLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Status Banner */}
        <View style={s.statusBanner}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.positive} />
          <Text style={s.statusTxt}>{activeTab} compliance is up to date for this period.</Text>
        </View>

        {/* Share Button */}
        <TouchableOpacity style={s.shareBtn} activeOpacity={0.8}>
          <Ionicons name="share-outline" size={18} color={COLORS.white} />
          <Text style={s.shareTxt}>Share PDF</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.pageBg },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.sm, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  exportBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tabsScroll:  { backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  tabsContent: { paddingHorizontal: SPACING.sm, paddingVertical: 4, gap: 4 },
  tab:         { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.borderDefault },
  tabActive:   { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  tabTxt:      { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textSecondary },
  tabTxtActive:{ color: COLORS.white, fontWeight: '700' },
  scroll:  { flex: 1 },
  filterRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, margin: SPACING.md },
  fyBadge:   { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.activeBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  fyTxt:     { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  card:      { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCell:  { width: '47%', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, padding: SPACING.sm, gap: 4, alignItems: 'flex-start' },
  cellIcon:  { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cellValue: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  cellLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.positiveBg, borderRadius: RADIUS.md, padding: SPACING.md },
  statusTxt:    { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.positive, lineHeight: 20 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 14 },
  shareTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
