import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, useWindowDimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../utils/safeNavigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';
import { useWorkspace } from '../context/WorkspaceContext';

const SECTION_COLORS: Record<string, { color: string; bg: string }> = {
  sales:     { color: COLORS.positive,     bg: COLORS.positiveBg },
  purchase:  { color: COLORS.negative,     bg: COLORS.negativeBg },
  voucher:   { color: COLORS.warning,      bg: COLORS.warningBg  },
  inventory: { color: COLORS.info,         bg: COLORS.infoBg     },
  ledgers:   { color: COLORS.brandPrimary, bg: COLORS.activeBg   },
};

interface QuickActionsModalProps {
  visible: boolean;
  onClose: () => void;
  onItemPress?: (item: { id: string; label: string; route: string }) => void;
}

const SECTION_DEFS = [
  {
    id: 'sales',
    labelKey: 'quickActions.sales',
    icon: 'receipt-outline' as const,
    items: [
      { id: 'sale-invoice',  labelKey: 'quickActions.createInvoice',      route: '/sales/create-invoice',       icon: 'document-text-outline' as const },
      { id: 'sale-proforma', labelKey: 'quickActions.proformaInvoice',    route: '/sales/create-proforma',      icon: 'document-outline' as const },
      { id: 'sale-order',    labelKey: 'quickActions.createSalesOrders',  route: '/sales/create-order',         icon: 'list-outline' as const },
      { id: 'sale-delivery', labelKey: 'quickActions.createDeliveryNote', route: '/sales/create-delivery-note', icon: 'car-outline' as const },
      { id: 'sale-credit',   labelKey: 'quickActions.creditNote',          route: '/sales/create-credit-note',   icon: 'return-up-back-outline' as const },
    ],
  },
  {
    id: 'purchase',
    labelKey: 'quickActions.purchase',
    icon: 'bag-handle-outline' as const,
    items: [
      { id: 'pur-invoice', labelKey: 'quickActions.purchaseInvoice', route: '/purchase/create-invoice',   icon: 'document-text-outline' as const },
      { id: 'pur-order',   labelKey: 'quickActions.purchaseOrder',   route: '/purchase/create-order',     icon: 'bag-outline' as const },
      { id: 'pur-debit',   labelKey: 'quickActions.debitNote',       route: '/purchase/create-debit-note', icon: 'remove-circle-outline' as const },
    ],
  },
  {
    id: 'voucher',
    labelKey: 'quickActions.voucher',
    icon: 'wallet-outline' as const,
    items: [
      { id: 'vou-receipt', labelKey: 'quickActions.receiptVoucher', route: '/voucher/create-receipt', icon: 'cash-outline' as const },
      { id: 'vou-payment', labelKey: 'quickActions.paymentVoucher', route: '/voucher/create-payment', icon: 'send-outline' as const },
      { id: 'vou-expense', labelKey: 'quickActions.expenseVoucher', route: '/voucher/create-expense', icon: 'wallet-outline' as const },
      { id: 'vou-journal', labelKey: 'quickActions.journalEntry',   route: '/voucher/create-journal', icon: 'journal-outline' as const },
      { id: 'vou-contra',  labelKey: 'quickActions.contraEntry',    route: '/voucher/create-contra',  icon: 'swap-horizontal-outline' as const },
    ],
  },
  {
    id: 'inventory',
    labelKey: 'quickActions.inventory',
    icon: 'layers-outline' as const,
    items: [
      { id: 'inv-adjust',    labelKey: 'quickActions.stockAdjustment', route: '/stocks/create-adjustment', icon: 'options-outline' as const },
      { id: 'inv-transfer',  labelKey: 'quickActions.stockTransfer',   route: '/stocks/create-transfer',   icon: 'arrow-forward-circle-outline' as const },
      { id: 'inv-item',      labelKey: 'quickActions.addItem',         route: '/stocks/create-item',       icon: 'add-circle-outline' as const },
      { id: 'inv-warehouse', labelKey: 'quickActions.addWarehouse',    route: '/stocks/create-warehouse',  icon: 'business-outline' as const },
    ],
  },
  {
    id: 'ledgers',
    labelKey: 'quickActions.ledgers',
    icon: 'book-outline' as const,
    items: [
      { id: 'led-creditors', labelKey: 'quickActions.sundryCreditors', route: '/ledger/create?type=sundry_creditor', icon: 'person-add-outline' as const },
      { id: 'led-debtors',   labelKey: 'quickActions.sundryDebtors',   route: '/ledger/create?type=sundry_debtor',   icon: 'person-outline' as const },
      { id: 'led-taxes',     labelKey: 'quickActions.dutiesTaxes',   route: '/ledger/create?type=duties_taxes',    icon: 'pricetag-outline' as const },
      { id: 'led-custom',    labelKey: 'quickActions.customGroups',    route: '/ledger/create?type=custom',          icon: 'settings-outline' as const },
    ],
  },
];

const ITEM_CAPS: Record<string, string> = {
  'sale-invoice': 'sales_invoice.create',
  'sale-proforma': 'sales_invoice.create',
  'sale-order': 'sales_order.create',
  'sale-delivery': 'delivery_note.create',
  'sale-credit': 'credit_note.create',
  'pur-invoice': 'purchase_invoice.create',
  'pur-order': 'purchase_order.create',
  'pur-debit': 'debit_note.create',
  'vou-receipt': 'receipt.create',
  'vou-payment': 'payment.create',
  'vou-expense': 'expense.create',
  'vou-journal': 'journal.create',
  'vou-contra': 'contra.create',
  'inv-adjust': 'stock_adjustment.create',
  'inv-transfer': 'stock_transfer.create',
  'inv-item': 'stock_item.create',
  'inv-warehouse': 'warehouse.create',
  'led-creditors': 'ledger_master.create',
  'led-debtors': 'ledger_master.create',
  'led-taxes': 'ledger_master.create',
  'led-custom': 'ledger_master.create',
};

const QuickActionsModal: React.FC<QuickActionsModalProps> = ({ visible, onClose, onItemPress }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const { hasCapability, entryMode } = useWorkspace();

  const sections = useMemo(() => {
    return SECTION_DEFS.map((section) => {
      const items = section.items
        .filter((item) => {
          const cap = ITEM_CAPS[item.id];
          if (cap && !hasCapability(cap)) return false;
          // Entry Mode: OPTIONAL_ONLY → Proforma only (not regular invoice); Quotation via order optional
          if (item.id === 'sale-invoice' && entryMode === 'OPTIONAL_ONLY') return false;
          if (item.id === 'sale-proforma' && entryMode === 'REGULAR_ONLY') return false;
          return true;
        })
        .map((item) => ({
          ...item,
          label: t(item.labelKey),
        }));
      return {
        ...section,
        label: t(section.labelKey),
        items,
      };
    }).filter((s) => s.items.length > 0);
  }, [t, hasCapability, entryMode]);

  useEffect(() => {
    if (visible) setExpandedSection(null);
  }, [visible]);

  const toggleSection = (sectionId: string) => {
    setExpandedSection(prev => (prev === sectionId ? null : sectionId));
  };

  const handleItemPress = (item: { id: string; label: string; route: string }) => {
    onItemPress?.({ id: item.id, label: item.label, route: item.route });
    onClose();
    safePush(router, item.route as any);
  };

  const sheetBottomPad = Math.max(insets.bottom, 8) + 12;
  // Cap whole sheet only — do NOT set height/maxHeight on ScrollView (that causes
  // the empty white gap under Purchase on iOS/Android).
  const sheetMaxHeight = Math.round(windowHeight * 0.85);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        {/* flex:1 (not absoluteFill) — absoluteFill inside RN Modal collapses and kills the dim */}
        <TouchableOpacity style={s.backdrop} onPress={onClose} activeOpacity={1} />

        <View style={[s.sheet, { maxHeight: sheetMaxHeight, paddingBottom: sheetBottomPad }]}>
          <View style={s.handle} />

          <View style={s.header}>
            <Text style={s.title}>{t('quickActions.title')}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={s.headerClose}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            // flexGrow:0 → height follows section cards (no reserved blank area)
            style={s.scroll}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {sections.map(section => {
              const isExpanded = expandedSection === section.id;
              const theme = SECTION_COLORS[section.id] || {
                color: COLORS.brandPrimary,
                bg: COLORS.activeBg,
              };
              return (
                <View
                  key={section.id}
                  style={[
                    s.sectionCard,
                    isExpanded && {
                      borderColor: theme.color + '60',
                      borderLeftWidth: 3,
                      borderLeftColor: theme.color,
                    },
                  ]}
                >
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
          </ScrollView>

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
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#F4F4F4',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderStrong,
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    paddingBottom: 12,
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
    flexGrow: 0,
    flexShrink: 1,
    flex: 0,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 4,
    flexGrow: 0,
  },
  sectionCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.borderDefault,
    overflow: 'hidden',
    marginBottom: 10,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  sectionLabel: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subList: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDefault,
    paddingBottom: 4,
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderDefault,
  },
  subItemIconWrap: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  subItemText: {
    flex: 1,
    fontSize: TYPOGRAPHY.base,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  bottomRow: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  bottomClose: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'android' ? { elevation: 4 } : {}),
  },
});

export default QuickActionsModal;
