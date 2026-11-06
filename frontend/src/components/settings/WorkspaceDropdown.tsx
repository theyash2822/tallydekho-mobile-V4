/**
 * Workspace switcher of the Settings profile card: a dropdown hung under the workspace row, built
 * like the company / FY dropdowns of the Home header (src/components/Header.tsx).
 * - The Modal is mounted only while open, and a switch is applied only after it has unmounted:
 *   switching re-renders the whole app, and doing that while a Modal is closing froze Android.
 * - Owners rename a workspace inline; the card stays above the keyboard while they type.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView, TextInput,
  ActivityIndicator, Alert, Keyboard, Platform, useWindowDimensions,
  type LayoutChangeEvent, type ScrollViewInstance,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import type { WorkspaceSummary } from '../../context/WorkspaceContext';

/** Window frame of the row the dropdown hangs from, as `measureInWindow` reports it. */
export type DropdownAnchor = { x: number; y: number; width: number; height: number };

type Props = {
  visible: boolean;
  anchor: DropdownAnchor | null;
  workspaces: WorkspaceSummary[];
  workspaceId: string | null;
  isUnavailable: (w: WorkspaceSummary) => boolean;
  onSwitch: (id: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onClose: () => void;
};

type MenuProps = Omit<Props, 'visible' | 'anchor' | 'onSwitch'> & {
  anchor: DropdownAnchor;
  onSelect: (id: string) => void;
};

const ANCHOR_GAP = 4;
/** The profile card's side margins. */
const SIDE_MARGIN = SPACING.md;
const LIST_MAX_HEIGHT = 360;
/** Keeps the title and a row being renamed visible when little room is left under the anchor. */
const MIN_CARD_HEIGHT = 160;

export default function WorkspaceDropdown({ visible, anchor, onSwitch, onClose, ...menu }: Props) {
  const pendingIdRef = useRef<string | null>(null);

  // Runs after the commit that unmounted the Modal.
  useEffect(() => {
    const id = pendingIdRef.current;
    if (!id || visible) return;
    pendingIdRef.current = null;
    onSwitch(id).catch(() => {});
  }, [visible, onSwitch]);

  if (!visible || !anchor) return null;
  return (
    <WorkspaceMenu
      {...menu}
      anchor={anchor}
      onClose={onClose}
      onSelect={(id) => {
        if (id !== menu.workspaceId) pendingIdRef.current = id;
        onClose();
      }}
    />
  );
}

function WorkspaceMenu({ anchor, workspaces, workspaceId, isUnavailable, onRename, onSelect, onClose }: MenuProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // The backdrop takes the window size directly, as in Header.tsx: sized via flex/absoluteFill
  // it did not catch taps outside the card on device.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const rowTops = useRef(new Map<string, number>());

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt, (e) => setKeyboardTop(e.endCoordinates.screenY));
    const subHide = Keyboard.addListener(hideEvt, () => setKeyboardTop(null));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const top = anchor.y + anchor.height + ANCHOR_GAP;
  const bottom = keyboardTop ?? windowHeight - insets.bottom;
  const maxHeight = Math.max(bottom - top - SPACING.sm, MIN_CARD_HEIGHT);

  // A row being renamed grows and the list shrinks for the keyboard: scroll that row into view.
  const revealRenaming = () => {
    if (!renamingId) return;
    scrollRef.current?.scrollTo({ y: rowTops.current.get(renamingId) ?? 0, animated: true });
  };

  const saveRename = async (id: string) => {
    setRenameBusy(true);
    try {
      await onRename(id, renameText);
      setRenamingId(null);
      Alert.alert(t('screens.settings.renamed'), t('screens.settings.workspaceNameUpdated'));
    } catch (e: any) {
      Alert.alert(t('screens.settings.renameFailed'), e?.message || t('screens.settings.tryAgain'));
    } finally {
      setRenameBusy(false);
    }
  };

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Pressable
        testID="workspace-dropdown-backdrop"
        style={[styles.backdrop, { width: windowWidth, height: windowHeight }]}
        onPress={onClose}
      >
        <View
          style={[styles.dropdown, { top, maxHeight }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.dropdownArrow, { marginLeft: Math.max(anchor.x - SIDE_MARGIN, 0) }]} />
          <Text style={styles.dropdownTitle}>{t('screens.settings.switchWorkspace')}</Text>
          <ScrollView
            ref={scrollRef}
            style={styles.list}
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onLayout={revealRenaming}
            onContentSizeChange={revealRenaming}
          >
            {workspaces.map((w) => {
              const selected = w.id === workspaceId;
              const unavailable = isUnavailable(w);
              const isOwnerRow = String(w.membershipType || '').toUpperCase() === 'OWNER';
              const trackTop = (e: LayoutChangeEvent) => {
                rowTops.current.set(w.id, e.nativeEvent.layout.y);
              };

              if (renamingId === w.id) {
                return (
                  <View
                    key={w.id}
                    style={[styles.optionRow, styles.renameRow, selected && styles.optionRowActive]}
                    onLayout={trackTop}
                  >
                    <TextInput
                      value={renameText}
                      onChangeText={setRenameText}
                      autoFocus
                      style={styles.renameInput}
                      placeholder={t('screens.settings.workspaceName')}
                      placeholderTextColor={COLORS.textTertiary}
                    />
                    <View style={styles.renameActions}>
                      <TouchableOpacity
                        style={styles.renameBtn}
                        disabled={renameBusy}
                        onPress={() => saveRename(w.id)}
                      >
                        {renameBusy ? <ActivityIndicator size="small" color={COLORS.white} /> : (
                          <Text style={styles.renameBtnTxt}>{t('common.save')}</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.renameBtn, styles.renameBtnGhost]}
                        onPress={() => setRenamingId(null)}
                      >
                        <Text style={[styles.renameBtnTxt, styles.renameBtnGhostTxt]}>{t('common.cancel')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={w.id}
                  testID={`workspace-option-${w.id}`}
                  style={[styles.optionRow, selected && styles.optionRowActive, unavailable && styles.optionRowUnavailable]}
                  disabled={unavailable}
                  onPress={() => onSelect(w.id)}
                  onLayout={trackTop}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: unavailable }}
                >
                  <View style={styles.optionLeft}>
                    <View style={[styles.coIcon, selected && styles.coIconActive]}>
                      <Text style={[styles.coIconText, selected && { color: COLORS.white }]}>
                        {w.name?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.optionText, selected && styles.optionTextActive]} numberOfLines={1}>
                        {w.name}
                      </Text>
                      <Text style={styles.optionSub} numberOfLines={2}>
                        {unavailable
                          ? t('screens.settings.accessUnavailable')
                          : `${
                              isOwnerRow
                                ? t('screens.settings.owner')
                                : (w.roleDisplayName || w.role_display_name || w.roleSystemKey || w.role_system_key || t('screens.settings.member'))
                            }${w.tallyConnection ? ` · ${w.tallyConnection}` : ''}`}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.optionRight}>
                    {isOwnerRow && !unavailable ? (
                      <TouchableOpacity
                        testID={`workspace-rename-${w.id}`}
                        hitSlop={8}
                        style={styles.renameIconBtn}
                        onPress={() => {
                          setRenamingId(w.id);
                          setRenameText(w.name);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.edit')}
                      >
                        <Ionicons name="pencil-outline" size={16} color={COLORS.brandPrimary} />
                      </TouchableOpacity>
                    ) : null}
                    {selected && !unavailable ? (
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.brandPrimary} />
                    ) : null}
                    {unavailable ? <Ionicons name="lock-closed-outline" size={16} color={COLORS.textTertiary} /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0 },
  dropdown: {
    position: 'absolute', left: SIDE_MARGIN, right: SIDE_MARGIN,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden', elevation: 16,
    boxShadow: '0 6px 14px rgba(0, 0, 0, 0.18)',
  },
  dropdownArrow: {
    width: 10, height: 10, backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderLeftWidth: 1, borderColor: COLORS.borderDefault,
    alignSelf: 'flex-start', marginTop: -5,
    transform: [{ rotate: '45deg' }],
  },
  dropdownTitle: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  // flexGrow 0: a card capped by maxHeight would otherwise stretch the list into an empty gap.
  list: { flexGrow: 0, flexShrink: 1, maxHeight: LIST_MAX_HEIGHT },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  optionRowActive: { backgroundColor: COLORS.activeBg },
  optionRowUnavailable: { opacity: 0.55 },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  optionRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginLeft: SPACING.sm },
  coIcon: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.borderDefault,
    alignItems: 'center', justifyContent: 'center',
  },
  coIconActive: { backgroundColor: COLORS.brandPrimary },
  coIconText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  optionText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  optionTextActive: { fontWeight: '700', color: COLORS.brandPrimary },
  optionSub: { fontSize: 10, color: COLORS.textTertiary, marginTop: 1 },
  renameIconBtn: { padding: SPACING.xs },
  renameRow: { flexDirection: 'column', alignItems: 'stretch', gap: SPACING.sm },
  renameInput: {
    borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, backgroundColor: COLORS.pageBg,
  },
  renameActions: { flexDirection: 'row', gap: SPACING.sm },
  renameBtn: {
    backgroundColor: COLORS.brandPrimary, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, minWidth: 72, alignItems: 'center',
  },
  renameBtnGhost: { backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault },
  renameBtnTxt: { color: COLORS.white, fontWeight: '700', fontSize: TYPOGRAPHY.sm },
  renameBtnGhostTxt: { color: COLORS.textPrimary },
});
