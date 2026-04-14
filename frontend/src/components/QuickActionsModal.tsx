import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, TextInput, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface QuickActionsModalProps {
  visible: boolean;
  onClose: () => void;
  onItemPress?: (item: { id: string; label: string; route: string }) => void;
}

// Flat list of quick actions — organized by section
const ALL_ACTIONS = [
  // Sales
  { id: 'sale-invoice',   section: 'Sales',     label: 'New Sales Invoice',    icon: 'document-text',         color: '#2D7D46', bg: '#F0FBF4',  route: '/sales/create-invoice' },
  { id: 'sale-order',     section: 'Sales',     label: 'New Sales Order',       icon: 'clipboard',             color: '#2D7D46', bg: '#F0FBF4',  route: '/sales/create-order' },
  { id: 'sale-quotation', section: 'Sales',     label: 'New Quotation',         icon: 'chatbubble-ellipses',   color: '#2D7D46', bg: '#F0FBF4',  route: '/sales/create-quotation' },
  { id: 'sale-credit',    section: 'Sales',     label: 'Credit Note',           icon: 'return-down-back',      color: '#7C3AED', bg: '#F5F3FF',  route: '/sales/create-credit-note' },
  { id: 'sale-delivery',  section: 'Sales',     label: 'Delivery Note',         icon: 'cube',                  color: '#0891B2', bg: '#ECFEFF',  route: '/sales/create-delivery-note' },
  // Purchase
  { id: 'pur-invoice',    section: 'Purchase',  label: 'New Purchase Invoice',  icon: 'cart',                  color: '#2563EB', bg: '#EFF6FF',  route: '/purchase/create-invoice' },
  { id: 'pur-order',      section: 'Purchase',  label: 'New Purchase Order',    icon: 'bag-handle',            color: '#2563EB', bg: '#EFF6FF',  route: '/purchase/create-order' },
  { id: 'pur-debit',      section: 'Purchase',  label: 'Debit Note',            icon: 'return-up-forward',     color: '#C0392B', bg: '#FDECEA',  route: '/purchase/create-debit-note' },
  // Vouchers
  { id: 'vou-receipt',    section: 'Vouchers',  label: 'Receipt Voucher',       icon: 'download',              color: '#2D7D46', bg: '#F0FBF4',  route: '/voucher/receipt' },
  { id: 'vou-payment',    section: 'Vouchers',  label: 'Payment Voucher',       icon: 'send',                  color: '#DC2626', bg: '#FDECEA',  route: '/voucher/payment' },
  { id: 'vou-journal',    section: 'Vouchers',  label: 'Journal Entry',         icon: 'bookmarks',             color: '#7C3AED', bg: '#F5F3FF',  route: '/voucher/journal' },
  { id: 'vou-contra',     section: 'Vouchers',  label: 'Contra Entry',          icon: 'swap-horizontal',       color: '#0891B2', bg: '#ECFEFF',  route: '/voucher/contra' },
  // Inventory
  { id: 'inv-adjust',     section: 'Inventory', label: 'Stock Adjustment',      icon: 'settings',              color: '#D97706', bg: '#FFFBEB',  route: '/stocks/create-adjustment' },
  { id: 'inv-transfer',   section: 'Inventory', label: 'Stock Transfer',        icon: 'swap-horizontal',       color: '#0891B2', bg: '#ECFEFF',  route: '/stocks/create-transfer' },
  { id: 'inv-item',       section: 'Inventory', label: 'Add New Item',          icon: 'add-circle',            color: '#2563EB', bg: '#EFF6FF',  route: '/stocks/create-item' },
  // Ledger
  { id: 'led-create',     section: 'Ledger',    label: 'Create Ledger',         icon: 'person-add',            color: '#7C3AED', bg: '#F5F3FF',  route: '/ledger/create' },
  { id: 'led-custom',     section: 'Ledger',    label: 'Custom Entry',          icon: 'pencil',                color: '#1A1A1A', bg: '#F0EFE9',  route: '/ledger/create?type=custom' },
];

const SECTIONS = ['Sales', 'Purchase', 'Vouchers', 'Inventory', 'Ledger'] as const;

const SECTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Sales: 'trending-up',
  Purchase: 'cart',
  Vouchers: 'card',
  Inventory: 'cube',
  Ledger: 'journal',
};

const QuickActionsModal: React.FC<QuickActionsModalProps> = ({
  visible,
  onClose,
  onItemPress,
}) => {
  const router = useRouter();
  const [searchText, setSearchText] = useState('');

  const filtered = searchText
    ? ALL_ACTIONS.filter(a => a.label.toLowerCase().includes(searchText.toLowerCase()))
    : ALL_ACTIONS;

  const handlePress = (item: typeof ALL_ACTIONS[0]) => {
    onItemPress?.({ id: item.id, label: item.label, route: item.route });
    onClose();
    router.push(item.route as any);
  };

  // Group by section
  const grouped = SECTIONS.map(sec => ({
    section: sec,
    items: filtered.filter(a => a.section === sec),
  })).filter(g => g.items.length > 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Quick Actions</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={COLORS.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search actions..."
              placeholderTextColor={COLORS.textTertiary}
              value={searchText}
              onChangeText={setSearchText}
              autoCorrect={false}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Actions List */}
          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {grouped.map(({ section, items }) => (
              <View key={section} style={styles.sectionBlock}>
                {/* Section Header */}
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconBox}>
                    <Ionicons name={SECTION_ICONS[section]} size={14} color={COLORS.textSecondary} />
                  </View>
                  <Text style={styles.sectionLabel}>{section}</Text>
                </View>

                {/* Grid of action tiles */}
                <View style={styles.tileGrid}>
                  {items.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.tile}
                      onPress={() => handlePress(item)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.tileIcon, { backgroundColor: item.bg }]}>
                        <Ionicons name={item.icon as any} size={20} color={item.color} />
                      </View>
                      <Text style={styles.tileLabel} numberOfLines={2}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            {filtered.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={40} color={COLORS.textTertiary} />
                <Text style={styles.emptyText}>No actions found for "{searchText}"</Text>
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Bottom Close Button */}
          <View style={styles.bottomRow}>
            <TouchableOpacity
              style={styles.bottomCloseBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={22} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.88,
    paddingBottom: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderStrong,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
  },
  sheetTitle: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.base,
    color: COLORS.textPrimary,
    padding: 0,
  },
  list: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  sectionBlock: {
    marginTop: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: '30%',
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md,
    padding: 10,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    minHeight: 80,
    justifyContent: 'center',
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.textSecondary,
  },
  bottomRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  bottomCloseBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
  } as any,
});

export default QuickActionsModal;
