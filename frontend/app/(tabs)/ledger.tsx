import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, Modal, KeyboardAvoidingView,
  Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { getLedgers } from '../../src/services/api';
import { MOCK_LEDGERS } from '../../src/data/mockData';

type FilterType = 'All' | 'Debit' | 'Credit';

interface LedgerItem {
  id: string;
  name: string;
  group: string;
  balance: string;
  type: 'credit' | 'debit';
  lastUpdated: string;
}

// ─── Ledger Creation Sheet ────────────────────────────────────────────────────
interface SectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({ title, expanded, onToggle, children }: SectionProps) {
  return (
    <View style={cs.section}>
      <TouchableOpacity style={cs.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
        <Text style={cs.sectionTitle}>{title}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {expanded && <View style={cs.sectionBody}>{children}</View>}
    </View>
  );
}

const NATURE_OPTIONS = ['Assets', 'Liabilities', 'Income', 'Expenses', 'Equity'];

interface CreateLedgerModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

function CreateLedgerModal({ visible, onClose, onSave }: CreateLedgerModalProps) {
  const [ledgerName, setLedgerName] = useState('');
  const [nature, setNature] = useState('Assets');
  const [group, setGroup] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [balanceType, setBalanceType] = useState<'Dr' | 'Cr'>('Dr');
  const [narration, setNarration] = useState('');

  // Party
  const [showParty, setShowParty] = useState(false);
  const [partyName, setPartyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState('');

  // Bank
  const [showBank, setShowBank] = useState(false);
  const [beneficiary, setBeneficiary] = useState('');
  const [acNo, setAcNo] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [swift, setSwift] = useState('');
  const [branch, setBranch] = useState('');
  const [bankName, setBankName] = useState('');

  // Duties
  const [showDuties, setShowDuties] = useState(false);
  const [gstin, setGstin] = useState('');

  const [showNatureModal, setShowNatureModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!ledgerName) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    await new Promise(r => setTimeout(r, 700));
    setSaved(false);
    onSave({ ledgerName, nature, group, openingBalance, balanceType, narration });
    // Reset
    setLedgerName(''); setGroup(''); setOpeningBalance(''); setNarration('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={cs.overlay}>
        <TouchableOpacity style={cs.backdrop} onPress={onClose} activeOpacity={1} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={cs.sheetWrap}
        >
          <View style={cs.sheet}>
            <View style={cs.handle} />

            {/* Header */}
            <View style={cs.header}>
              <View>
                <Text style={cs.sheetTitle}>Ledger Creation</Text>
                <Text style={cs.sheetSubtitle}>Fill The Form For Information</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={cs.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={cs.form}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Ledger Name */}
              <Text style={cs.label}>Ledger Name</Text>
              <TextInput
                style={cs.input}
                placeholder="Enter ledger name"
                placeholderTextColor={COLORS.textTertiary}
                value={ledgerName}
                onChangeText={setLedgerName}
              />

              {/* Nature */}
              <Text style={cs.label}>Nature</Text>
              <TouchableOpacity
                style={cs.selectBox}
                onPress={() => setShowNatureModal(true)}
                activeOpacity={0.7}
              >
                <Text style={cs.selectText}>{nature}</Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>

              {/* Group */}
              <Text style={cs.label}>Group</Text>
              <View style={cs.searchBox}>
                <Ionicons name="search" size={14} color={COLORS.textTertiary} />
                <TextInput
                  style={cs.searchInput}
                  placeholder="Search Group"
                  placeholderTextColor={COLORS.textTertiary}
                  value={group}
                  onChangeText={setGroup}
                />
              </View>

              {/* Opening Balance */}
              <Text style={cs.label}>Opening Balance</Text>
              <View style={cs.balanceRow}>
                <TextInput
                  style={[cs.input, { flex: 1 }]}
                  placeholder="—"
                  placeholderTextColor={COLORS.textTertiary}
                  value={openingBalance}
                  onChangeText={setOpeningBalance}
                  keyboardType="numeric"
                />
                <View style={cs.drCrToggle}>
                  <TouchableOpacity
                    style={[cs.drCrBtn, balanceType === 'Dr' && cs.drCrBtnActive]}
                    onPress={() => setBalanceType('Dr')}
                  >
                    <Text style={[cs.drCrText, balanceType === 'Dr' && cs.drCrTextActive]}>Dr</Text>
                  </TouchableOpacity>
                  <View style={cs.drCrDivider} />
                  <TouchableOpacity
                    style={[cs.drCrBtn, balanceType === 'Cr' && cs.drCrBtnActive]}
                    onPress={() => setBalanceType('Cr')}
                  >
                    <Text style={[cs.drCrText, balanceType === 'Cr' && cs.drCrTextActive]}>Cr</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Narration */}
              <Text style={cs.label}>Narration</Text>
              <TextInput
                style={[cs.input, { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                placeholder="Enter Notes"
                placeholderTextColor={COLORS.textTertiary}
                value={narration}
                onChangeText={setNarration}
                multiline
              />

              {/* Party Section */}
              <CollapsibleSection title="Party" expanded={showParty} onToggle={() => setShowParty(!showParty)}>
                <Text style={cs.label}>Name</Text>
                <TextInput style={cs.input} placeholder="Party A" placeholderTextColor={COLORS.textTertiary} value={partyName} onChangeText={setPartyName} />
                <View style={cs.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={cs.label}>Contact number</Text>
                    <TextInput style={cs.input} placeholder="Enter phone number" placeholderTextColor={COLORS.textTertiary} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={cs.label}>Email</Text>
                    <TextInput style={cs.input} placeholder="Enter email" placeholderTextColor={COLORS.textTertiary} value={email} onChangeText={setEmail} keyboardType="email-address" />
                  </View>
                </View>
                <Text style={cs.label}>Address</Text>
                <TextInput style={[cs.input, { minHeight: 60, textAlignVertical: 'top' }]} placeholder="Enter address" placeholderTextColor={COLORS.textTertiary} value={address} onChangeText={setAddress} multiline />
                <Text style={cs.label}>Credit Limit</Text>
                <TextInput style={cs.input} placeholder="—" placeholderTextColor={COLORS.textTertiary} value={creditLimit} onChangeText={setCreditLimit} keyboardType="numeric" />
              </CollapsibleSection>

              {/* Bank Section */}
              <CollapsibleSection title="Bank" expanded={showBank} onToggle={() => setShowBank(!showBank)}>
                <Text style={cs.label}>Beneficiary Name</Text>
                <TextInput style={cs.input} placeholder="Enter beneficiary name" placeholderTextColor={COLORS.textTertiary} value={beneficiary} onChangeText={setBeneficiary} />
                <Text style={cs.label}>A/C Number</Text>
                <TextInput style={cs.input} placeholder="Enter A/C number" placeholderTextColor={COLORS.textTertiary} value={acNo} onChangeText={setAcNo} keyboardType="numeric" />
                <View style={cs.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={cs.label}>IFSC</Text>
                    <TextInput style={cs.input} placeholder="Enter IFSC number" placeholderTextColor={COLORS.textTertiary} value={ifsc} onChangeText={setIfsc} autoCapitalize="characters" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={cs.label}>SWIFT</Text>
                    <TextInput style={cs.input} placeholder="Enter phone number" placeholderTextColor={COLORS.textTertiary} value={swift} onChangeText={setSwift} />
                  </View>
                </View>
                <View style={cs.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={cs.label}>Branch</Text>
                    <TextInput style={cs.input} placeholder="—" placeholderTextColor={COLORS.textTertiary} value={branch} onChangeText={setBranch} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={cs.label}>Bank Name</Text>
                    <TextInput style={cs.input} placeholder="—" placeholderTextColor={COLORS.textTertiary} value={bankName} onChangeText={setBankName} />
                  </View>
                </View>
              </CollapsibleSection>

              {/* Duties & Taxes */}
              <CollapsibleSection title="Duties & Taxes" expanded={showDuties} onToggle={() => setShowDuties(!showDuties)}>
                <Text style={cs.label}>GSTIN</Text>
                <TextInput style={cs.input} placeholder="Enter GSTIN" placeholderTextColor={COLORS.textTertiary} value={gstin} onChangeText={setGstin} autoCapitalize="characters" />
              </CollapsibleSection>

              <View style={{ height: 24 }} />
            </ScrollView>

            {/* Save Button */}
            <View style={cs.footer}>
              <TouchableOpacity
                style={[cs.saveBtn, (saving || saved) && { opacity: 0.85 }]}
                onPress={handleSave}
                activeOpacity={0.85}
              >
                {saving ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="sync" size={18} color={COLORS.white} />
                    <Text style={cs.saveBtnText}>Saving...</Text>
                  </View>
                ) : saved ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
                    <Text style={cs.saveBtnText}>Saved!</Text>
                  </View>
                ) : (
                  <Text style={cs.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Nature Picker */}
      <Modal visible={showNatureModal} transparent animationType="fade" onRequestClose={() => setShowNatureModal(false)}>
        <View style={cs.pickerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setShowNatureModal(false)} activeOpacity={1} />
          <View style={cs.pickerBox}>
            <Text style={cs.pickerTitle}>Select Nature</Text>
            {NATURE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[cs.pickerItem, nature === opt && cs.pickerItemActive]}
                onPress={() => { setNature(opt); setShowNatureModal(false); }}
                activeOpacity={0.7}
              >
                <Text style={[cs.pickerItemText, nature === opt && cs.pickerItemTextActive]}>{opt}</Text>
                {nature === opt && <Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

// ─── Filter Modal ─────────────────────────────────────────────────────────────
interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (data: any) => void;
}

function FilterModal({ visible, onClose, onApply }: FilterModalProps) {
  const [nature, setNature] = useState('Assets');
  const [hideZero, setHideZero] = useState(false);
  const [group, setGroup] = useState('');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={fm.overlay}>
        <TouchableOpacity style={fm.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={fm.sheet}>
          <View style={fm.sheetHeader}>
            <Text style={fm.sheetTitle}>Filter</Text>
            <TouchableOpacity onPress={onClose} style={fm.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={fm.body}>
            <Text style={fm.label}>Nature</Text>
            <View style={fm.row}>
              <View style={fm.selectBox}>
                <Text style={fm.selectText}>{nature}</Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
              </View>
              <View style={fm.toggleRow}>
                <Text style={fm.toggleLabel}>Hide Zero</Text>
                <Switch
                  value={hideZero}
                  onValueChange={setHideZero}
                  trackColor={{ false: COLORS.borderDefault, true: COLORS.brandPrimary }}
                  thumbColor={COLORS.white}
                />
              </View>
            </View>

            <Text style={fm.label}>Group</Text>
            <View style={fm.searchBox}>
              <Ionicons name="search" size={14} color={COLORS.textTertiary} />
              <TextInput
                style={fm.searchInput}
                placeholder="Search Group"
                placeholderTextColor={COLORS.textTertiary}
                value={group}
                onChangeText={setGroup}
              />
            </View>
          </View>

          <View style={fm.footer}>
            <TouchableOpacity
              style={fm.applyBtn}
              onPress={() => { onApply({ nature, hideZero, group }); onClose(); }}
              activeOpacity={0.85}
            >
              <Text style={fm.applyBtnText}>Save & Use</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Ledger Screen ───────────────────────────────────────────────────────
export default function LedgerScreen() {
  const router = useRouter();
  const [data, setData] = useState<LedgerItem[]>(MOCK_LEDGERS);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('All');
  const [sortAsc, setSortAsc] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showTypeSheet, setShowTypeSheet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { getLedgers().then((d: any) => setData(d)); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const d = await getLedgers() as any;
    setData(d);
    setRefreshing(false);
  };

  const filtered = data
    .filter(item => {
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.group.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'All' ||
        (filter === 'Debit' && item.type === 'debit') ||
        (filter === 'Credit' && item.type === 'credit');
      return matchSearch && matchFilter;
    })
    .sort((a, b) => sortAsc
      ? a.name.localeCompare(b.name)
      : b.name.localeCompare(a.name)
    );

  return (
    <SafeAreaView testID="ledger-screen" style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ledgers</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            testID="add-ledger-btn"
            style={styles.headerIconBtn}
            onPress={() => setShowTypeSheet(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="ledger-filter-btn"
            style={styles.headerIconBtn}
            onPress={() => setShowFilter(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="filter" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <TextInput
            testID="ledger-search"
            style={styles.searchInput}
            placeholder="Search Ledgers..."
            placeholderTextColor={COLORS.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs + Sort */}
      <View style={styles.tabRow}>
        <View style={styles.filterTabs}>
          {(['All', 'Debit', 'Credit'] as FilterType[]).map(f => (
            <TouchableOpacity
              key={f}
              testID={`filter-tab-${f}`}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.7}
            >
              {f !== 'All' && (
                <Ionicons
                  name={f === 'Debit' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                  size={13}
                  color={filter === f ? COLORS.textPrimary : COLORS.textSecondary}
                />
              )}
              <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Sort */}
        <View style={styles.sortBtns}>
          <TouchableOpacity style={styles.sortBtn} onPress={() => setSortAsc(true)} activeOpacity={0.7}>
            <Ionicons name="arrow-up" size={14} color={sortAsc ? COLORS.textPrimary : COLORS.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sortBtn} onPress={() => setSortAsc(false)} activeOpacity={0.7}>
            <Ionicons name="arrow-down" size={14} color={!sortAsc ? COLORS.textPrimary : COLORS.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Ledger List */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />
        }
      >
        <View style={styles.list}>
          {filtered.map(item => (
            <TouchableOpacity
              key={item.id}
              testID={`ledger-item-${item.id}`}
              style={styles.itemCard}
              activeOpacity={0.7}
              onPress={() => router.push(`/ledger/${item.id}` as any)}
            >
              {/* Avatar */}
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>

              {/* Info */}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemGroup}>{item.group}</Text>
              </View>

              {/* Right: balance + badge */}
              <View style={styles.itemRight}>
                <Text style={styles.itemBalance}>{item.balance}</Text>
                <View style={[
                  styles.typeBadge,
                  { backgroundColor: item.type === 'credit' ? COLORS.positiveBg : COLORS.negativeBg }
                ]}>
                  <Text style={[
                    styles.typeText,
                    { color: item.type === 'credit' ? COLORS.positive : COLORS.negative }
                  ]}>
                    {item.type === 'credit' ? 'Cr' : 'Dr'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {filtered.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="journal-outline" size={48} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>No ledgers found</Text>
            </View>
          )}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Modals */}
      <CreateLedgerModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={(d) => console.log('New ledger:', d)}
      />
      <FilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        onApply={(d) => console.log('Filter:', d)}
      />
      {/* Ledger Type Selection Sheet */}
      <Modal visible={showTypeSheet} transparent animationType="slide" onRequestClose={() => setShowTypeSheet(false)}>
        <TouchableOpacity style={styles.tsOverlay} activeOpacity={1} onPress={() => setShowTypeSheet(false)} />
        <View style={styles.tsSheet}>
          <View style={styles.tsHandle} />
          <Text style={styles.tsTitle}>Add Ledger</Text>
          <Text style={styles.tsSubtitle}>Select ledger group type</Text>
          {[
            { type: 'sundry_creditor', label: 'Sundry Creditors', icon: 'person-add-outline', color: COLORS.positive, desc: 'Vendor/supplier accounts' },
            { type: 'sundry_debtor', label: 'Sundry Debtors', icon: 'person-outline', color: COLORS.info, desc: 'Customer/party accounts' },
            { type: 'duties_taxes', label: 'Duties and Taxes', icon: 'receipt-outline', color: COLORS.warning, desc: 'GST, TDS and duty accounts' },
            { type: 'custom', label: 'Custom Groups', icon: 'settings-outline', color: COLORS.textSecondary, desc: 'Custom ledger under any group' },
          ].map(opt => (
            <TouchableOpacity key={opt.type} style={styles.tsOption} onPress={() => { setShowTypeSheet(false); router.push(`/ledger/create?type=${opt.type}` as any); }} activeOpacity={0.7}>
              <View style={[styles.tsIconWrap, { backgroundColor: opt.color + '18' }]}>
                <Ionicons name={opt.icon as any} size={22} color={opt.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tsOptionLabel}>{opt.label}</Text>
                <Text style={styles.tsOptionDesc}>{opt.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  searchWrap: {
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },
  tabRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 8,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  filterTabs: { flexDirection: 'row', gap: 6 },
  filterTab: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
  },
  filterTabActive: {
    backgroundColor: COLORS.activeBg, borderColor: COLORS.borderStrong,
  },
  filterTabText: { fontSize: TYPOGRAPHY.xs, fontWeight: '500', color: COLORS.textSecondary },
  filterTabTextActive: { fontWeight: '700', color: COLORS.textPrimary },
  sortBtns: { flexDirection: 'row', gap: 4 },
  sortBtn: {
    width: 30, height: 30, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { flex: 1 },
  list: { padding: SPACING.md, gap: 8 },
  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    padding: 14, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  itemInfo: { flex: 1 },
  itemName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  itemGroup: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  itemRight: { alignItems: 'flex-end', gap: 6 },
  itemBalance: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  typeText: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
});

// Create Ledger Modal Styles
const cs = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: { maxHeight: '92%' },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '100%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.borderStrong,
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  sheetTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  sheetSubtitle: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center',
  },
  form: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  label: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14,
  },
  input: {
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary,
    backgroundColor: COLORS.pageBg,
  },
  selectBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.pageBg,
  },
  selectText: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.pageBg,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  balanceRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  drCrToggle: {
    flexDirection: 'row', borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, overflow: 'hidden',
  },
  drCrBtn: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: COLORS.pageBg },
  drCrBtnActive: { backgroundColor: COLORS.activeBg },
  drCrDivider: { width: 1, backgroundColor: COLORS.borderDefault },
  drCrText: { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textSecondary },
  drCrTextActive: { fontWeight: '700', color: COLORS.textPrimary },
  formRow: { flexDirection: 'row', gap: 12 },
  // Collapsible sections
  section: {
    marginTop: 8,
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: COLORS.pageBg,
  },
  sectionTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  sectionBody: {
    paddingHorizontal: 14, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
  },
  footer: {
    padding: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  saveBtn: {
    backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  // Nature picker
  pickerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerBox: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    width: '70%', overflow: 'hidden',
    elevation: 10, boxShadow: '0 0 12px rgba(0, 0, 0, 0.2)',
  },
  pickerTitle: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  pickerItemActive: { backgroundColor: COLORS.activeBg },
  pickerItemText: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  pickerItemTextActive: { fontWeight: '700', color: COLORS.brandPrimary },
});

// Filter Modal Styles
const fm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  sheetTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: SPACING.md },
  label: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.pageBg,
  },
  selectText: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.pageBg,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  footer: { padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  applyBtn: {
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 14, alignItems: 'center',
  },
  applyBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  tsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  tsSheet: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 30 },
  tsHandle: { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  tsTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary, paddingHorizontal: SPACING.md, marginBottom: 4 },
  tsSubtitle: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, paddingHorizontal: SPACING.md, marginBottom: 16 },
  tsOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: SPACING.md, paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  tsIconWrap: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  tsOptionLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  tsOptionDesc: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
});
