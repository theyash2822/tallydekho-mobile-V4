/**
 * BottomModalShell — shared RN Modal bottom-sheet layout for stock/ledger forms.
 *
 * Must sit flush to the bottom edge (full-width white sheet). Avoid KAV
 * `behavior="height"` when the keyboard is closed — that leaves a gap under
 * the Save button where the screen behind peeks through.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ViewStyle, Keyboard, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
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
  /** Enable keyboard avoidance only while keyboard is open (default true) */
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
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!visible) {
      setKeyboardOpen(false);
      return;
    }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const subHide = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [visible]);

  // Cap sheet only — do NOT put maxHeight on ScrollView (causes empty white gap).
  const sheetMaxHeight = Math.round(windowHeight * 0.92);
  const bottomPad = Math.max(insets.bottom, 12);

  const sheet = (
    <View
      style={[
        ms.sheet,
        {
          maxHeight: sheetMaxHeight,
          width: '100%',
          alignSelf: 'stretch',
          // Safe-area padding is INSIDE the sheet so white fills to the device bottom
          paddingBottom: footer ? 0 : bottomPad,
        },
        sheetStyle,
      ]}
    >
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
        // flexGrow:0 → height follows content; flexShrink:1 → compress above keyboard
        style={[shell.scroll, keyboardOpen && shell.scrollWithKeyboard]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[ms.scroll, scrollContentStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bounces={false}
        {...scrollProps}
      >
        {children}
      </ScrollView>

      {footer ? (
        <View style={[ms.footer, { paddingBottom: bottomPad, backgroundColor: COLORS.cardBg }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );

  // Only apply KAV while keyboard is open — closed KAV (esp. Android `height`)
  // lifts the sheet and leaves a gap where the list peeks under Save.
  const useKav = keyboardAvoiding && keyboardOpen;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={shell.root}>
        <TouchableOpacity
          style={shell.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        {useKav ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  kav: {
    width: '100%',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollWithKeyboard: {
    flexShrink: 1,
  },
});
