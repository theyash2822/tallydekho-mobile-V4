import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, ActivityIndicator, Pressable, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// ─────────────────────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────────────────────
type AccountType = 'SAVING' | 'CURRENT' | 'OD' | 'CC';
type SaveState   = 'idle' | 'saving' | 'saved';

interface BankAccount {
  id: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  branch: string;
  accountType: AccountType;
  isPrimary: boolean;
  gradient: readonly [string, string];
}

interface BankFormData {
  accountNumber: string;
  ifsc: string;
  bankName: string;
  branch: string;
  accountType: AccountType;
}

const CARD_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#1B5E40', '#0D3B2E'],
  ['#1B3A5E', '#0D2040'],
  ['#1B4A55', '#0D2C35'],
  ['#3D1A5E', '#200D40'],
  ['#5E3A1B', '#401A0D'],
];

const ACCOUNT_TYPES: AccountType[] = ['SAVING', 'CURRENT', 'OD', 'CC'];

const EMPTY_FORM: BankFormData = {
  accountNumber: '', ifsc: '', bankName: '', branch: '', accountType: 'SAVING',
};

const MOCK_ACCOUNTS: BankAccount[] = [
  { id: '1', accountNumber: '1234767680002253', ifsc: 'HDFC0090923', bankName: 'HDFC Bank', branch: 'Mumbai Branch', accountType: 'SAVING',  isPrimary: true,  gradient: CARD_GRADIENTS[0] },
  { id: '2', accountNumber: '9876543210001234', ifsc: 'HDFC0090924', bankName: 'HDFC Bank', branch: 'Delhi Branch',  accountType: 'CURRENT', isPrimary: false, gradient: CARD_GRADIENTS[1] },
  { id: '3', accountNumber: '5678901234567890', ifsc: 'SBIN0001234', bankName: 'SBI',        branch: 'Pune Branch',  accountType: 'SAVING',  isPrimary: false, gradient: CARD_GRADIENTS[2] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const maskAccountNo = (acNo: string): string => {
  if (!acNo || acNo.length < 4) return `•••• ${acNo || '----'}`;
  return `•••• ${acNo.slice(-4)}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// AccountTypePicker
// ─────────────────────────────────────────────────────────────────────────────
function AccountTypePicker({ value, onChange }: { value: AccountType; onChange: (v: AccountType) => void }) {
  return (
    <View style={atp.row}>
      {ACCOUNT_TYPES.map(type => (
        <TouchableOpacity
          key={type}
          style={[atp.chip, value === type && atp.chipActive]}
          onPress={() => onChange(type)}
          activeOpacity={0.7}
        >
          <Text style={[atp.chipTxt, value === type && atp.chipActiveTxt]}>{type}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const atp = StyleSheet.create({
  row:          { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  chip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.borderStrong, backgroundColor: COLORS.pageBg },
  chipActive:   { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipTxt:      { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  chipActiveTxt:{ color: COLORS.white },
});

// ─────────────────────────────────────────────────────────────────────────────
// BankFormSheet — Add & Edit
// ─────────────────────────────────────────────────────────────────────────────
function BankFormSheet({
  visible, mode, initialData, previewGradient, onClose, onSave, onDelete,
}: {
  visible: boolean;
  mode: 'add' | 'edit';
  initialData?: BankFormData;
  previewGradient?: readonly [string, string];
  onClose: () => void;
  onSave: (data: BankFormData) => void;
  onDelete?: () => void;
}) {
  const [form, setForm]           = useState<BankFormData>(initialData || EMPTY_FORM);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  React.useEffect(() => {
    if (visible) { setForm(initialData || EMPTY_FORM); setSaveState('idle'); }
  }, [visible]);

  const setField = (field: keyof BankFormData, value: string | AccountType) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = () => {
    if (!form.accountNumber.trim() || !form.ifsc.trim() || !form.bankName.trim() || !form.branch.trim()) {
      Toast.show({ type: 'error', text1: 'Incomplete', text2: 'Please fill all required fields.' });
      return;
    }
    setSaveState('saving');
    setTimeout(() => {
      setSaveState('saved');
      setTimeout(() => { onSave(form); onClose(); setSaveState('idle'); }, 800);
    }, 1400);
  };

  const gradColors = (previewGradient || CARD_GRADIENTS[1]) as [string, string];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={bfs.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={bfs.sheet}>
          <View style={bfs.handle} />

          {/* Header */}
          <View style={bfs.hdr}>
            <Text style={bfs.title}>{mode === 'add' ? 'Add Bank' : 'Edit Bank'}</Text>
            <View style={bfs.hdrRight}>
              {mode === 'edit' && onDelete && (
                <TouchableOpacity onPress={onDelete} style={bfs.iconBtn} activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={20} color={COLORS.negative} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={bfs.iconBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Mini preview card (edit mode) */}
          {mode === 'edit' && (
            <LinearGradient colors={gradColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={bfs.previewCard}>
              <View style={bfs.previewTop}>
                <View style={bfs.bankPill}>
                  <Text style={bfs.bankPillTxt} numberOfLines={1}>{form.bankName || 'Bank Name'}</Text>
                </View>
                <Text style={bfs.previewAcNo}>A/c {maskAccountNo(form.accountNumber || '0000')}</Text>
              </View>
              <Text style={bfs.previewIfsc}>{form.ifsc || '— —'}</Text>
              <View style={bfs.previewBottom}>
                <Text style={bfs.previewBranch}>{form.branch || 'Branch'}</Text>
                <Text style={bfs.previewType}>{form.accountType}</Text>
              </View>
            </LinearGradient>
          )}

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Account Number */}
            <View style={bfs.field}>
              <Text style={bfs.label}>Account Number</Text>
              <TextInput
                style={bfs.input} value={form.accountNumber}
                onChangeText={t => setField('accountNumber', t)}
                placeholder="Enter account number" placeholderTextColor={COLORS.textTertiary}
                keyboardType="number-pad"
              />
            </View>

            {/* IFSC */}
            <View style={bfs.field}>
              <Text style={bfs.label}>IFSC</Text>
              <TextInput
                style={bfs.input} value={form.ifsc}
                onChangeText={t => setField('ifsc', t.toUpperCase())}
                placeholder="Enter IFSC" placeholderTextColor={COLORS.textTertiary}
                autoCapitalize="characters"
              />
            </View>

            {/* Bank Name + Branch row */}
            <View style={bfs.rowTwo}>
              <View style={[bfs.field, { flex: 1 }]}>
                <Text style={bfs.label}>Bank Name</Text>
                <TextInput
                  style={bfs.input} value={form.bankName}
                  onChangeText={t => setField('bankName', t)}
                  placeholder="Bank Name" placeholderTextColor={COLORS.textTertiary}
                />
              </View>
              <View style={[bfs.field, { flex: 1 }]}>
                <Text style={bfs.label}>Branch</Text>
                <TextInput
                  style={bfs.input} value={form.branch}
                  onChangeText={t => setField('branch', t)}
                  placeholder="Branch" placeholderTextColor={COLORS.textTertiary}
                />
              </View>
            </View>

            {/* Account Type */}
            <View style={bfs.field}>
              <Text style={bfs.label}>Account Type</Text>
              <AccountTypePicker value={form.accountType} onChange={v => setField('accountType', v as AccountType)} />
            </View>
            <View style={{ height: 8 }} />
          </ScrollView>

          {/* Save / Cancel */}
          <TouchableOpacity
            style={[bfs.saveBtn, saveState === 'saving' && bfs.savingBtn, saveState === 'saved' && bfs.savedBtn]}
            onPress={handleSave}
            disabled={saveState !== 'idle'}
            activeOpacity={0.85}
          >
            {saveState === 'saving' ? (
              <><ActivityIndicator size="small" color={COLORS.white} /><Text style={bfs.saveTxt}>Saving...</Text></>
            ) : saveState === 'saved' ? (
              <><Ionicons name="checkmark-circle" size={18} color={COLORS.white} /><Text style={bfs.saveTxt}>Saved</Text></>
            ) : (
              <Text style={bfs.saveTxt}>Save</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={bfs.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={bfs.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <View style={{ height: 24 }} />
        </View>
      </View>
    </Modal>
  );
}
const bfs = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: SPACING.lg, paddingTop: 12 },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginBottom: 16 },
  hdr:         { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  title:       { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  hdrRight:    { flexDirection: 'row', gap: 4, alignItems: 'center' },
  iconBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  previewCard: { borderRadius: 14, padding: SPACING.md, marginBottom: SPACING.md },
  previewTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  bankPill:    { backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full },
  bankPillTxt: { fontSize: 11, fontWeight: '700', color: '#111' },
  previewAcNo: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  previewIfsc: { fontSize: 16, fontWeight: '800', color: COLORS.white, letterSpacing: 1.2, marginBottom: SPACING.sm },
  previewBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  previewBranch: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  previewType:   { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  field:   { marginBottom: SPACING.md },
  label:   { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:   { borderWidth: 1.5, borderColor: COLORS.borderStrong, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, backgroundColor: COLORS.pageBg },
  rowTwo:  { flexDirection: 'row', gap: 10 },
  saveBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, marginTop: SPACING.sm, marginBottom: 10 },
  savingBtn:  { backgroundColor: COLORS.textTertiary },
  savedBtn:   { backgroundColor: COLORS.positive },
  saveTxt:    { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.white },
  cancelBtn:  { alignItems: 'center', paddingVertical: 14, backgroundColor: COLORS.activeBg, borderRadius: RADIUS.md },
  cancelTxt:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
});

// ─────────────────────────────────────────────────────────────────────────────
// DeleteSheet
// ─────────────────────────────────────────────────────────────────────────────
function DeleteSheet({ visible, count, onClose, onConfirm }: {
  visible: boolean; count: number; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={del.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={del.sheet}>
          <View style={del.handle} />
          <View style={del.iconWrap}>
            <View style={del.iconCircle}>
              <Ionicons name="trash-outline" size={28} color={COLORS.negative} />
            </View>
          </View>
          <Text style={del.title}>Delete Bank Account{count > 1 ? 's' : ''}?</Text>
          <Text style={del.sub}>
            Are you sure you want to delete {count > 1 ? `${count} bank accounts` : 'this bank account'}?{'\n'}
            This action will permanently remove the account and its related transaction history from the system.
          </Text>
          <TouchableOpacity style={del.deleteBtn} onPress={onConfirm} activeOpacity={0.85}>
            <Ionicons name="trash-outline" size={16} color={COLORS.white} />
            <Text style={del.deleteTxt}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={del.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={del.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <View style={{ height: 24 }} />
        </View>
      </View>
    </Modal>
  );
}
const del = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: SPACING.lg, paddingTop: 12 },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginBottom: 20 },
  iconWrap:   { alignItems: 'center', marginBottom: 14 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 8 },
  sub:        { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 8 },
  deleteBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.negative, borderRadius: RADIUS.md, paddingVertical: 15, marginBottom: 10 },
  deleteTxt:  { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.white },
  cancelBtn:  { alignItems: 'center', paddingVertical: 14, backgroundColor: COLORS.activeBg, borderRadius: RADIUS.md },
  cancelTxt:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
});

// ─────────────────────────────────────────────────────────────────────────────
// BankCard
// ─────────────────────────────────────────────────────────────────────────────
function BankCard({ account, isSelecting, isSelected, onPress, onLongPress }: {
  account: BankAccount;
  isSelecting: boolean; isSelected: boolean;
  onPress: () => void; onLongPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={2000} style={bc.wrapper}>
      <LinearGradient
        colors={account.gradient as [string, string]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={bc.card}
      >
        {/* Top: Bank pill + masked A/c */}
        <View style={bc.topRow}>
          <View style={bc.bankPill}>
            <Text style={bc.bankPillTxt} numberOfLines={1}>{account.bankName}</Text>
          </View>
          <View style={bc.dot} />
          <Text style={bc.maskedAcNo}>A/c {maskAccountNo(account.accountNumber)}</Text>
        </View>

        {/* Middle: IFSC / account ref */}
        <Text style={bc.ifscTxt}>{account.ifsc}</Text>

        {/* Bottom: Branch + type */}
        <View style={bc.bottomRow}>
          <Text style={bc.branchTxt}>{account.branch}</Text>
          <Text style={bc.typeBadge}>{account.accountType}</Text>
        </View>

        {/* Multi-select overlay */}
        {isSelecting && (
          <View style={[bc.selOverlay, isSelected && bc.selOverlayActive]}>
            {isSelected && (
              <View style={bc.checkCircle}>
                <Ionicons name="checkmark" size={14} color={COLORS.brandPrimary} />
              </View>
            )}
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}
const bc = StyleSheet.create({
  wrapper:  { marginBottom: SPACING.md },
  card:     { borderRadius: 18, padding: 18, minHeight: 165 },
  topRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bankPill: { backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full, maxWidth: 130 },
  bankPillTxt: { fontSize: 11, fontWeight: '800', color: '#111', letterSpacing: 0.2 },
  dot:      { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  maskedAcNo: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.88)', flex: 1 },
  ifscTxt:  { fontSize: 22, fontWeight: '800', color: COLORS.white, letterSpacing: 2, marginVertical: 16 },
  bottomRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' },
  branchTxt:{ fontSize: 12, color: 'rgba(255,255,255,0.78)', fontWeight: '500' },
  typeBadge:{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.95)', letterSpacing: 1.2 },
  selOverlay:       { ...StyleSheet.absoluteFillObject, borderRadius: 18, borderWidth: 2.5, borderColor: 'transparent' },
  selOverlayActive: { borderColor: COLORS.white, backgroundColor: 'rgba(0,0,0,0.28)' },
  checkCircle: { position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// SwipeableCard
// ─────────────────────────────────────────────────────────────────────────────
function SwipeableCard({ account, isSelecting, isSelected, onPress, onLongPress, onEditPress }: {
  account: BankAccount;
  isSelecting: boolean; isSelected: boolean;
  onPress: () => void; onLongPress: () => void; onEditPress: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  const renderRightActions = useCallback(() => (
    <TouchableOpacity
      style={sw.editAction}
      onPress={() => { swipeRef.current?.close(); onEditPress(); }}
      activeOpacity={0.85}
    >
      <Ionicons name="pencil-outline" size={20} color={COLORS.white} />
      <Text style={sw.editTxt}>Edit{'\n'}Detail</Text>
    </TouchableOpacity>
  ), [onEditPress]);

  if (isSelecting) {
    return (
      <BankCard
        account={account} isSelecting={isSelecting} isSelected={isSelected}
        onPress={onPress} onLongPress={onLongPress}
      />
    );
  }

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      friction={2} rightThreshold={60} overshootRight={false}
    >
      <BankCard
        account={account} isSelecting={isSelecting} isSelected={isSelected}
        onPress={onPress} onLongPress={onLongPress}
      />
    </Swipeable>
  );
}
const sw = StyleSheet.create({
  editAction: { backgroundColor: COLORS.brandPrimary, borderRadius: 18, marginBottom: SPACING.md, marginLeft: 8, width: 76, alignItems: 'center', justifyContent: 'center', gap: 5 },
  editTxt:    { fontSize: 11, fontWeight: '700', color: COLORS.white, textAlign: 'center', lineHeight: 14 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function BankFeedsScreen() {
  const router = useRouter();

  const [accounts,     setAccounts]     = useState<BankAccount[]>(MOCK_ACCOUNTS);
  const [isSelecting,  setIsSelecting]  = useState(false);
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [showAdd,      setShowAdd]      = useState(false);
  const [editTarget,   setEditTarget]   = useState<BankAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'multi' | null>(null);

  // ── Selection handlers ─────────────────────────────────────────────────────
  const handleLongPress = (id: string) => {
    Vibration.vibrate(40);
    setIsSelecting(true);
    setSelectedIds(new Set([id]));
  };

  const handleCardPress = (id: string) => {
    if (!isSelecting) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const cancelSelection = () => { setIsSelecting(false); setSelectedIds(new Set()); };

  // ── Save/delete handlers ────────────────────────────────────────────────────
  const handleAddSave = (data: BankFormData) => {
    const grad = CARD_GRADIENTS[accounts.length % CARD_GRADIENTS.length];
    setAccounts(prev => [...prev, { id: Date.now().toString(), ...data, isPrimary: prev.length === 0, gradient: grad }]);
    Toast.show({ type: 'success', text1: 'Bank Added', text2: `${data.bankName} account saved.` });
  };

  const handleEditSave = (data: BankFormData) => {
    if (!editTarget) return;
    setAccounts(prev => prev.map(a => a.id === editTarget.id ? { ...a, ...data } : a));
    setEditTarget(null);
    Toast.show({ type: 'success', text1: 'Updated', text2: 'Bank account updated successfully.' });
  };

  const confirmDelete = () => {
    if (deleteTarget === 'single' && editTarget) {
      setAccounts(prev => prev.filter(a => a.id !== editTarget.id));
      setEditTarget(null);
      Toast.show({ type: 'info', text1: 'Deleted', text2: 'Bank account removed.' });
    } else if (deleteTarget === 'multi') {
      setAccounts(prev => prev.filter(a => !selectedIds.has(a.id)));
      cancelSelection();
      Toast.show({ type: 'info', text1: 'Deleted', text2: `${selectedIds.size} account(s) removed.` });
    }
    setDeleteTarget(null);
  };

  const editFormData: BankFormData | undefined = editTarget
    ? { accountNumber: editTarget.accountNumber, ifsc: editTarget.ifsc, bankName: editTarget.bankName, branch: editTarget.branch, accountType: editTarget.accountType }
    : undefined;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* ─── Normal Header ──────────────────────────────────────────────── */}
        {!isSelecting ? (
          <View style={s.hdr}>
            <TouchableOpacity onPress={() => router.back()} style={s.back} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={s.hdrTitle}>Bank Feeds</Text>
            <TouchableOpacity onPress={() => setShowAdd(true)} style={s.addBtn} activeOpacity={0.85}>
              <Ionicons name="add" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        ) : (
          /* ─── Multi-select Header ─────────────────────────────────────── */
          <View style={s.selHdr}>
            <TouchableOpacity onPress={cancelSelection} style={s.selBtn} activeOpacity={0.7}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.hdrTitle}>{selectedIds.size} Selected</Text>
            <TouchableOpacity
              style={s.selBtn}
              onPress={() => selectedIds.size > 0 && setDeleteTarget('multi')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="trash-outline" size={22}
                color={selectedIds.size > 0 ? COLORS.negative : COLORS.textTertiary}
              />
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Info banner ──────────────────────────────────────────────── */}
          <View style={s.infoBanner}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.textSecondary} />
            <Text style={s.infoBannerTxt}>
              Connect your bank accounts to auto-reconcile transactions with Tally entries.
            </Text>
          </View>

          {/* ─── Cards ────────────────────────────────────────────────────── */}
          {accounts.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="wallet-outline" size={52} color={COLORS.textTertiary} />
              <Text style={s.emptyTxt}>No bank accounts added yet</Text>
              <Text style={s.emptySub}>Tap "+" at the top to add your first bank account</Text>
            </View>
          ) : (
            accounts.map(account => (
              <View key={account.id}>
                {account.isPrimary && (
                  <View style={s.primaryRow}>
                    <Text style={s.primaryTxt}>★  PRIMARY ACCOUNT</Text>
                  </View>
                )}
                <SwipeableCard
                  account={account}
                  isSelecting={isSelecting}
                  isSelected={selectedIds.has(account.id)}
                  onPress={() => handleCardPress(account.id)}
                  onLongPress={() => handleLongPress(account.id)}
                  onEditPress={() => setEditTarget(account)}
                />
              </View>
            ))
          )}

          {accounts.length > 0 && !isSelecting && (
            <Text style={s.hintTxt}>
              ↔ Swipe a card left to edit  ·  Hold 2s to multi-select
            </Text>
          )}
        </ScrollView>

        {/* ─── Sheets ─────────────────────────────────────────────────────── */}
        <BankFormSheet
          visible={showAdd}
          mode="add"
          onClose={() => setShowAdd(false)}
          onSave={handleAddSave}
        />
        <BankFormSheet
          visible={!!editTarget}
          mode="edit"
          initialData={editFormData}
          previewGradient={editTarget?.gradient}
          onClose={() => setEditTarget(null)}
          onSave={handleEditSave}
          onDelete={() => setDeleteTarget('single')}
        />
        <DeleteSheet
          visible={!!deleteTarget}
          count={deleteTarget === 'multi' ? selectedIds.size : 1}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />

      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  hdr:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  selHdr:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  hdrTitle:{ flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  back:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  addBtn:  { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  selBtn:  { width: 60, height: 40, alignItems: 'center', justifyContent: 'center' },
  cancelTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  scroll: { padding: SPACING.md, paddingBottom: 48 },

  infoBanner:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: COLORS.activeBg, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.borderStrong },
  infoBannerTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20 },

  primaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 },
  primaryTxt: { fontSize: 10, fontWeight: '800', color: COLORS.textTertiary, letterSpacing: 1, textTransform: 'uppercase' },

  emptyWrap: { alignItems: 'center', paddingVertical: 64 },
  emptyTxt:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary, marginTop: 16 },
  emptySub:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, marginTop: 4, textAlign: 'center' },

  hintTxt: { fontSize: 11, color: COLORS.textTertiary, textAlign: 'center', marginTop: 4, lineHeight: 18 },
});
