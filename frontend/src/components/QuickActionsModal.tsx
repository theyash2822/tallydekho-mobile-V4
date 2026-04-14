import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const BRAND_GREEN = '#2D7D46';
const LIGHT_GREEN_BG = '#EAF7EE';
const LIGHT_GREEN_BORDER = '#A8D5B0';
const CLOSE_BTN_GREEN = '#1B5E20';

interface QuickActionsModalProps {
  visible: boolean;
  onClose: () => void;
  onItemPress?: (item: { id: string; label: string; route: string }) => void;
}

const SECTIONS = [
  {
    id: 'sales',
    label: 'Sales',
    icon: 'trending-up-outline' as const,
    items: [
      { id: 'sale-invoice',   label: 'Create Invoice',       route: '/sales/create-invoice' },
      { id: 'sale-quotation', label: 'Create Quotation',      route: '/sales/create-quotation' },
      { id: 'sale-order',     label: 'Create Sales Orders',   route: '/sales/create-order' },
      { id: 'sale-delivery',  label: 'Create Delivery Note',  route: '/sales/create-delivery-note' },
      { id: 'sale-credit',    label: 'Credit Note',           route: '/sales/create-credit-note' },
    ],
  },
  {
    id: 'purchase',
    label: 'Purchase',
    icon: 'cart-outline' as const,
    items: [
      { id: 'pur-invoice', label: 'Purchase Invoice', route: '/purchase/create-invoice' },
      { id: 'pur-order',   label: 'Purchase Order',   route: '/purchase/create-order' },
      { id: 'pur-debit',   label: 'Debit Note',       route: '/purchase/create-debit-note' },
    ],
  },
  {
    id: 'voucher',
    label: 'Voucher',
    icon: 'card-outline' as const,
    items: [
      { id: 'vou-receipt', label: 'Receipt Voucher', route: '/voucher/create-receipt' },
      { id: 'vou-payment', label: 'Payment Voucher', route: '/voucher/create-payment' },
      { id: 'vou-journal', label: 'Journal Entry',   route: '/voucher/create-journal' },
      { id: 'vou-contra',  label: 'Contra Entry',    route: '/voucher/create-contra' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: 'cube-outline' as const,
    items: [
      { id: 'inv-adjust',    label: 'Stock Adjustment', route: '/stocks/create-adjustment' },
      { id: 'inv-transfer',  label: 'Stock Transfer',   route: '/stocks/create-transfer' },
      { id: 'inv-item',      label: 'Add Item',         route: '/stocks/create-item' },
      { id: 'inv-warehouse', label: 'Add Warehouse',    route: '/stocks/create-warehouse' },
    ],
  },
  {
    id: 'ledgers',
    label: 'Ledgers',
    icon: 'desktop-outline' as const,
    items: [
      { id: 'led-creditors', label: 'Sundry Creditors', route: '/ledger/sundry-creditors' },
      { id: 'led-debtors',   label: 'Sundry Debtors',   route: '/ledger/sundry-debtors' },
      { id: 'led-taxes',     label: 'Duties & Taxes',   route: '/ledger/duties-taxes' },
      { id: 'led-custom',    label: 'Custom Groups',    route: '/ledger/custom-groups' },
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
              return (
                <View
                  key={section.id}
                  style={[
                    s.sectionCard,
                    isExpanded && s.sectionCardActive,
                  ]}
                >
                  {/* Section Header Row */}
                  <TouchableOpacity
                    style={s.sectionRow}
                    onPress={() => toggleSection(section.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[s.iconCircle, isExpanded && s.iconCircleActive]}>
                      <Ionicons name={section.icon} size={22} color={BRAND_GREEN} />
                    </View>
                    <Text style={s.sectionLabel}>{section.label}</Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={COLORS.textSecondary}
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
                          <Text style={s.subItemText}>{item.label}</Text>
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
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: {
    borderColor: COLORS.borderStrong,
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
  },
  subItem: {
    paddingVertical: 12,
    paddingLeft: 76,
    paddingRight: 14,
  },
  subItemText: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: '500',
    color: '#6B7280',
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
    backgroundColor: CLOSE_BTN_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  } as any,
});

export default QuickActionsModal;
