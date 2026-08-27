/**
 * BottomModalShell — shared RN Modal bottom-sheet layout for stock/ledger forms.
 *
 * Pattern (iOS + Android safe):
 *   Modal → flex:1 + justifyContent flex-end root
 *        → absolute-fill overlay (tap to dismiss)
 *        → KAV width 100% wrapping only the sheet
 *        → sheet: handle + title + optional headerExtra + ScrollView body + sticky footer
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/colors';
import { modalStyles as ms } from './StockFormHelpers';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Custom title row left side (overrides title string) */
  titleNode?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Content between title and scroll body (e.g. search bar) */
  headerExtra?: React.ReactNode;
  /** Pass ScrollView ref when parent needs scrollToEnd */
  scrollRef?: React.RefObject<ScrollView | null>;
  /** Disable KAV (e.g. transfer sheets that rely on keyboard insets) */
  keyboardAvoiding?: boolean;
  sheetStyle?: ViewStyle;
  scrollContentStyle?: ViewStyle;
  scrollProps?: React.ComponentProps<typeof ScrollView>;
};

export function BottomModalShell({
  visible,
  onClose,
  title,
  titleNode,
  children,
  footer,
  headerExtra,
  scrollRef,
  keyboardAvoiding = true,
  sheetStyle,
  scrollContentStyle,
  scrollProps,
}: Props) {
  const insets = useSafeAreaInsets();

  const sheet = (
    <View style={[ms.sheet, { paddingBottom: 0 }, sheetStyle]}>
      <View style={ms.handle} />

      <View style={ms.titleRow}>
        {titleNode ?? <Text style={ms.title}>{title}</Text>}
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {headerExtra}

      <ScrollView
        ref={scrollRef as any}
        style={ms.scrollBody}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[ms.scroll, scrollContentStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        {...scrollProps}
      >
        {children}
      </ScrollView>

      {footer ? (
        <View style={[ms.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={shell.root}>
        <TouchableOpacity
          style={[shell.overlay, StyleSheet.absoluteFillObject]}
          activeOpacity={1}
          onPress={onClose}
        />
        {keyboardAvoiding ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
            style={shell.kav}
          >
            {sheet}
          </KeyboardAvoidingView>
        ) : (
          sheet
        )}
      </View>
    </Modal>
  );
}

const shell = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  kav: {
    width: '100%',
  },
});
