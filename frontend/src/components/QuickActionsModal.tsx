import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Per-section theme colors from the app's color system
const SECTION_COLORS: Record<string, { color: string; bg: string }> = {
  sales:     { color: COLORS.positive,  bg: COLORS.positiveBg },  // Green — revenue/income
  purchase:  { color: COLORS.negative,  bg: COLORS.negativeBg },  // Red — outgoing cost
  voucher:   { color: COLORS.warning,   bg: COLORS.warningBg  },  // Amber — cash movement
  inventory: { color: COLORS.info,      bg: COLORS.infoBg     },  // Blue — stock data
  ledgers:   { color: COLORS.brandPrimary, bg: COLORS.activeBg },  // Dark — official records
};

interface QuickActionsModalProps {
  visible: boolean;
  onClose: () => void;
  onItemPress?: (item: { id: string; label: string; route: string }) => void;
}

const SECTIONS = [
  {
    id: 'sales',
    label: 'Sales',
    icon: 'receipt-outline' as const,
    items: [
      { id: 'sale-invoice',   label: 'Create Invoice',       route: '/sales/create-invoice',        icon: 'document-text-outline' as const },
      { id: 'sale-quotation', label: 'Create Quotation',      route: '/sales/create-quotation',      icon: 'clipboard-outline' as const },
      { id: 'sale-order',     label: 'Create Sales Orders',   route: '/sales/create-order',          icon: 'list-outline' as const },
      { id: 'sale-delivery',  label: 'Create Delivery Note',  route: '/sales/create-delivery-note',  icon: 'car-outline' as const },
      { id: 'sale-credit',    label: 'Credit Note',           route: '/sales/create-credit-note',    icon: 'return-up-back-outline' as const },
    ],
  },
  {
    id: 'purchase',
    label: 'Purchase',
    icon: 'bag-handle-outline' as const,
    items: [
      { id: 'pur-invoice', label: 'Purchase Invoice', route: '/purchase/create-invoice',   icon: 'document-text-outline' as const },
      { id: 'pur-order',   label: 'Purchase Order',   route: '/purchase/create-order',     icon: 'bag-outline' as const },
      { id: 'pur-debit',   label: 'Debit Note',       route: '/purchase/create-debit-note', icon: 'remove-circle-outline' as const },
    ],
  },
  {
    id: 'voucher',
    label: 'Voucher',
    icon: 'wallet-outline' as const,
    items: [
      { id: 'vou-receipt', label: 'Receipt Voucher', route: '/voucher/create-receipt', icon: 'cash-outline' as const },
      { id: 'vou-payment', label: 'Payment Voucher', route: '/voucher/create-payment', icon: 'send-outline' as const },
      { id: 'vou-journal', label: 'Journal Entry',   route: '/voucher/create-journal', icon: 'journal-outline' as const },
      { id: 'vou-contra',  label: 'Contra Entry',    route: '/voucher/create-contra',  icon: 'swap-horizontal-outline' as const },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: 'layers-outline' as const,
    items: [
      { id: 'inv-adjust',    label: 'Stock Adjustment', route: '/stocks/create-adjustment', icon: 'options-outline' as const },
      { id: 'inv-transfer',  label: 'Stock Transfer',   route: '/stocks/create-transfer',   icon: 'arrow-forward-circle-outline' as const },
      { id: 'inv-item',      label: 'Add Item',         route: '/stocks/create-item',       icon: 'add-circle-outline' as const },
      { id: 'inv-warehouse', label: 'Add Warehouse',    route: '/stocks/create-warehouse',  icon: 'business-outline' as const },
    ],
  },
  {
    id: 'ledgers',
    label: 'Ledgers',
    icon: 'book-outline' as const,
    items: [
      { id: 'led-creditors', label: 'Sundry Creditors', route: '/ledger/create?type=sundry_creditor', icon: 'person-add-outline' as const },
      { id: 'led-debtors',   label: 'Sundry Debtors',   route: '/ledger/create?type=sundry_debtor',   icon: 'person-outline' as const },
      { id: 'led-taxes',     label: 'Duties & Taxes',   route: '/ledger/create?type=duties_taxes',    icon: 'pricetag-outline' as const },
      { id: 'led-custom',    label: 'Custom Groups',    route: '/ledger/create?type=custom',          icon: 'settings-outline' as const },
    ],
  },
];

const QuickActionsModal: React.FC<QuickActionsModalProps> = ({ visible, onClose, onItemPress }) => {
  const router = useRouter();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (sectionId: string) => {
    setExpandedSection(prev => (prev === sectionId ? null : sectionId));
  };

  const handleItemPress = (item: { id: string; label: string; route: string }) => {
    onItemPress?.({ id: item.id, label: item.label, route: item.route });
    onClose();
    router.push(item.route as any);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} onPress={onClose} activeOpacity={1} />

        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Quick Actions</Text>
            <TouchableOpacity onPress={onClose} style={s.headerClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Accordion Sections */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            bounces={false}
          >
            {SECTIONS.map(section => {
              const isExpanded = expandedSection === section.id;
              const theme = SECTION_COLORS[section.id];
              return (
                <View
                  key={section.id}
                  style={[
                    s.sectionCard,
                    isExpanded && { borderColor: theme.color + '60', borderLeftWidth: 3, borderLeftColor: theme.color },
                  ]}
                >
                  {/* Section Header Row */}
                  <TouchableOpacity
                    style={s.sectionRow}
                    onPress={() => toggleSection(section.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[s.iconCircle, { backgroundColor: theme.bg }]}>
                      <Ionicons name={section.icon} size={22} color={theme.color} />
                    </View>
                    <Text style={s.sectionLabel}>{section.label}</Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={isExpanded ? theme.color : COLORS.textSecondary}
                    />
                  </TouchableOpacity>

                  {/* Expanded Sub-items */}
                  {isExpanded && (
                    <View style={s.subList}>
                      {section.items.map(item => (
                        <TouchableOpacity
                          key={item.id}
                          style={s.subItem}
                          onPress={() => handleItemPress(item)}
                          activeOpacity={0.6}
                        >
                          <View style={[s.subItemIconWrap, { backgroundColor: theme.bg }]}>
                            <Ionicons name={item.icon} size={15} color={theme.color} />
                          </View>
                          <Text style={s.subItemText}>{item.label}</Text>
                          <Ionicons name="chevron-forward" size={14} color={theme.color + '80'} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
            <View style={{ height: 8 }} />
          </ScrollView>

          {/* Bottom Close Button */}
          <View style={s.bottomRow}>
            <TouchableOpacity style={s.bottomClose} onPress={onClose} activeOpacity={0.8}>
              <Ionicons name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#F4F4F4',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.92,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: 20,
    paddingBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    gap: 10,
  },
  // Section card
  sectionCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  sectionCardActive: {
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.cardBg,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  // Sub-items
  subList: {
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDefault,
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
  },
  subItemIconWrap: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subItemText: {
    flex: 1,
    fontSize: TYPOGRAPHY.base,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  // Bottom close
  bottomRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  bottomClose: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  } as any,
});

export default QuickActionsModal;
