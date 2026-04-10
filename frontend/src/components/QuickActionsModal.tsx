import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Animated, TextInput, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';
import { QUICK_ACTIONS } from '../data/mockData';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface QuickActionsModalProps {
  visible: boolean;
  onClose: () => void;
  onItemPress?: (item: { id: string; label: string; route: string }) => void;
}

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  sales: 'trending-up',
  purchase: 'cart',
  voucher: 'card',
  inventory: 'cube',
  ledgers: 'journal',
};

const QuickActionsModal: React.FC<QuickActionsModalProps> = ({
  visible,
  onClose,
  onItemPress,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  const toggleSection = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const filteredActions = searchText
    ? QUICK_ACTIONS.map(section => ({
        ...section,
        items: section.items.filter(item =>
          item.label.toLowerCase().includes(searchText.toLowerCase())
        ),
      })).filter(s => s.items.length > 0)
    : QUICK_ACTIONS;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View testID="quick-actions-overlay" style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <View testID="quick-actions-sheet" style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header Row */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Quick Actions</Text>
            <TouchableOpacity testID="close-quick-actions" onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={COLORS.textTertiary} />
            <TextInput
              testID="quick-actions-search"
              style={styles.searchInput}
              placeholder="Search actions..."
              placeholderTextColor={COLORS.textTertiary}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>

          {/* Accordion List */}
          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredActions.map(section => {
              const isExpanded = expandedId === section.id || (searchText.length > 0);
              const iconName = ICON_MAP[section.id] || 'grid';

              return (
                <View key={section.id} style={styles.section}>
                  {/* Section Header */}
                  <TouchableOpacity
                    testID={`qa-section-${section.id}`}
                    style={[styles.sectionHeader, isExpanded && styles.sectionHeaderActive]}
                    onPress={() => toggleSection(section.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.iconCircle, isExpanded && styles.iconCircleActive]}>
                      <Ionicons
                        name={iconName}
                        size={18}
                        color={isExpanded ? COLORS.brandPrimary : COLORS.textSecondary}
                      />
                    </View>
                    <Text style={[styles.sectionLabel, isExpanded && styles.sectionLabelActive]}>
                      {section.label}
                    </Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={COLORS.textSecondary}
                    />
                  </TouchableOpacity>

                  {/* Sub Items */}
                  {isExpanded && (
                    <View style={styles.subItems}>
                      {section.items.map((item, idx) => (
                        <TouchableOpacity
                          key={item.id}
                          testID={`qa-item-${item.id}`}
                          style={[
                            styles.subItem,
                            idx === section.items.length - 1 && styles.subItemLast,
                          ]}
                          onPress={() => {
                            onItemPress?.(item);
                            onClose();
                          }}
                          activeOpacity={0.6}
                        >
                          <Text style={styles.subItemText}>{item.label}</Text>
                          <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Bottom Close Button */}
          <View style={styles.bottomRow}>
            <TouchableOpacity
              testID="qa-bottom-close"
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
    backgroundColor: COLORS.overlay,
  },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderStrong,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
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
    marginBottom: 8,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.base,
    color: COLORS.textPrimary,
  },
  list: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  section: {
    marginBottom: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  sectionHeaderActive: {
    backgroundColor: COLORS.activeBg,
    borderColor: COLORS.borderStrong,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: {
    backgroundColor: COLORS.hoverBg,
  },
  sectionLabel: {
    flex: 1,
    fontSize: TYPOGRAPHY.md,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  sectionLabelActive: {
    fontWeight: '600',
  },
  subItems: {
    marginTop: 2,
    marginLeft: 12,
    paddingLeft: 50,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.borderDefault,
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingRight: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
  },
  subItemLast: {
    borderBottomWidth: 0,
  },
  subItemText: {
    fontSize: TYPOGRAPHY.base,
    color: COLORS.textSecondary,
    fontWeight: '400',
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
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});

export default QuickActionsModal;
