import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, Modal, KeyboardAvoidingView,
  Platform, Linking, Animated, Alert, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { getLedgers } from '../../src/services/api';
import { MOCK_LEDGERS } from '../../src/data/mockData';
import FilterBottomSheet, { FilterRadioRow } from '../../src/components/FilterBottomSheet';

type FilterType = 'All' | 'Debit' | 'Credit';
type NatureType = 'All' | 'Assets' | 'Liabilities' | 'Income' | 'Expense';

interface LedgerItem {
  id: string;
  name: string;
  group: string;
  balance: string;
  type: 'credit' | 'debit';
  nature?: string;
  phone?: string;
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
const NATURE_FILTER_OPTIONS: NatureType[] = ['Assets', 'Liabilities', 'Income', 'Expense'];

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  activeNature: NatureType;
  onApply: (nature: NatureType) => void;
}

function FilterModal({ visible, onClose, activeNature, onApply }: FilterModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<'Nature' | 'Group'>('Nature');
  const [localNature, setLocalNature] = useState<NatureType>(activeNature);
  const [groupSearch, setGroupSearch] = useState('');

  React.useEffect(() => {
    if (visible) setLocalNature(activeNature);
  }, [visible, activeNature]);

  const CATEGORIES = ['Nature', 'Group'] as const;
  const isFiltered = localNature !== 'All';

  return (
    <FilterBottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter Ledgers"
      activeCount={isFiltered ? 1 : 0}
      onClear={() => setLocalNature('All')}
      onApply={() => onApply(localNature)}
      applyLabel="Apply Filters"
    >
      {/* Tab selector: Nature | Group */}
      <View style={fm.tabs}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[fm.tab, selectedCategory === cat && fm.tabActive]}
            onPress={() => setSelectedCategory(cat)}
            activeOpacity={0.7}
          >
            <Text style={[fm.tabTxt, selectedCategory === cat && fm.tabTxtActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {selectedCategory === 'Nature' ? (
        <View>
          <FilterRadioRow
            label="All"
            selected={localNature === 'All'}
            onPress={() => setLocalNature('All')}
          />
          {NATURE_FILTER_OPTIONS.map(opt => (
            <FilterRadioRow
              key={opt}
              label={opt}
              selected={localNature === opt}
              onPress={() => setLocalNature(localNature === opt ? 'All' : opt)}
            />
          ))}
        </View>
      ) : (
        <View style={fm.groupPanel}>
          <View style={fm.searchBox}>
            <Ionicons name="search" size={14} color={COLORS.textTertiary} />
            <TextInput
              style={fm.searchInput}
              placeholder="Search Group..."
              placeholderTextColor={COLORS.textTertiary}
              value={groupSearch}
              onChangeText={setGroupSearch}
            />
          </View>
          <Text style={fm.groupHint}>Filter by ledger group name</Text>
        </View>
      )}
    </FilterBottomSheet>
  );
}

// ─── Main Ledger Screen ───────────────────────────────────────────────────────
export default function LedgerScreen() {
  const router = useRouter();
  const filterBtnRef = useRef<TouchableOpacity>(null);
  const [data, setData] = useState<LedgerItem[]>(MOCK_LEDGERS);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('All');
  const [activeNature, setActiveNature] = useState<NatureType>('All');
  const [sortType, setSortType] = useState<'alpha' | 'amount'>('alpha');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showFilter, setShowFilter] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showTypeSheet, setShowTypeSheet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hideZero, setHideZero] = useState(false);
  const [showFilterDrop, setShowFilterDrop] = useState(false);
  const [filterDropPos, setFilterDropPos] = useState({ x: 16, y: 200 });

  // ── Multi-select state ─────────────────────────────────────────────────────
  const [selected,    setSelected]    = useState<string[]>([]);
  const [selectMode,  setSelectMode]  = useState(false);

  const enterSelectMode = (id: string) => {
    setSelectMode(true);
    setSelected([id]);
  };
  const toggleSelect = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };
  const cancelSelectMode = () => { setSelectMode(false); setSelected([]); };
  const selectAll = () => setSelected(filtered.map(i => i.id));

  const handleShareMock = async () => {
    try {
      await Share.share({
        message: `TallyDekho — Sharing ${selected.length} ledger(s) as PDF\n` +
          filtered.filter(i => selected.includes(i.id)).map(i => `• ${i.name}: ${i.balance}`).join('\n'),
        title: 'Share Ledger Report',
      });
    } catch {
      Alert.alert('Share PDF', `${selected.length} ledger(s) ready to share as PDF.`);
    }
    cancelSelectMode();
  };

  // Toggle sort: clicking same type flips direction, clicking new type sets asc
  const handleSort = (type: 'alpha' | 'amount') => {
    if (sortType === type) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortType(type);
      setSortDir('asc');
    }
  };

  useEffect(() => { getLedgers().then((d: any) => setData(d)); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const d = await getLedgers() as any;
    setData(d);
    setRefreshing(false);
  };

  const isZeroBalance = (balance: string) => {
    const num = parseInt(balance.replace(/[^0-9]/g, ''), 10);
    return isNaN(num) || num === 0;
  };

  const openFilterDrop = () => {
    filterBtnRef.current?.measureInWindow((x, y, _w, h) => {
      setFilterDropPos({ x: x - 8, y: y + h + 4 });
      setShowFilterDrop(true);
    });
  };

  const filtered = data
    .filter(item => {
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.group.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'All' ||
        (filter === 'Debit' && item.type === 'debit') ||
        (filter === 'Credit' && item.type === 'credit');
      const matchZero = hideZero ? !isZeroBalance(item.balance) : true;
      const matchNature = activeNature === 'All' || item.nature === activeNature;
      return matchSearch && matchFilter && matchZero && matchNature;
    })
    .sort((a, b) => {
      if (sortType === 'alpha') {
        // A-Z / Z-A sort by name
        return sortDir === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else {
        // ↑ Low to High / ↓ High to Low sort by balance amount
        const aAmt = parseInt(a.balance.replace(/[^0-9]/g, ''), 10) || 0;
        const bAmt = parseInt(b.balance.replace(/[^0-9]/g, ''), 10) || 0;
        return sortDir === 'asc' ? aAmt - bAmt : bAmt - aAmt;
      }
    });

  return (
    <SafeAreaView testID="ledger-screen" style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {selectMode ? `${selected.length} Selected` : 'Ledgers'}
        </Text>
        <View style={styles.headerActions}>
          {selectMode ? (
            <>
              <TouchableOpacity
                style={styles.headerTextBtn}
                onPress={selectAll}
                activeOpacity={0.7}
              >
                <Text style={styles.headerTextBtnPrimary}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerTextBtn}
                onPress={cancelSelectMode}
                activeOpacity={0.7}
              >
                <Text style={styles.headerTextBtnCancel}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                testID="add-ledger-btn"
                style={styles.headerIconBtn}
                onPress={() => setShowCreate(true)}
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
            </>
          )}
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

      {/* Filter Bar: ≡ All ▾ dropdown  |  Hide Zero  |  Sort */}
      <View style={styles.tabRow}>
        {/* ≡ All ▾ dropdown button */}
        <TouchableOpacity
          ref={filterBtnRef}
          style={[styles.filterDropBtn, filter !== 'All' && styles.filterDropBtnActive]}
          onPress={openFilterDrop}
          activeOpacity={0.8}
        >
          <Ionicons name="list" size={15} color={filter !== 'All' ? COLORS.brandPrimary : COLORS.textSecondary} />
          <Text style={[styles.filterDropBtnTxt, filter !== 'All' && styles.filterDropBtnTxtActive]}>
            {filter}
          </Text>
          <Ionicons
            name={showFilterDrop ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={filter !== 'All' ? COLORS.brandPrimary : COLORS.textSecondary}
          />
        </TouchableOpacity>

        {/* Right side: Hide Zero + Sort */}
        <View style={styles.rightControls}>

          {/* Hide ₹0 — clean filled chip, no Switch inside */}
          <TouchableOpacity
            style={[styles.hideZeroChip, hideZero && styles.hideZeroChipOn]}
            onPress={() => setHideZero(v => !v)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={hideZero ? 'eye-off' : 'eye-outline'}
              size={13}
              color={hideZero ? '#fff' : COLORS.textSecondary}
            />
            <Text style={[styles.hideZeroChipTxt, hideZero && styles.hideZeroChipTxtOn]}>
              Hide ₹0
            </Text>
          </TouchableOpacity>

          {/* Sort buttons: A-Z toggle + ₁-₉ toggle */}
          <View style={styles.sortBtns}>
            {/* Alphabetical sort */}
            <TouchableOpacity
              style={[styles.sortBtn, sortType === 'alpha' && styles.sortBtnActive]}
              onPress={() => handleSort('alpha')}
              activeOpacity={0.7}
            >
              <Text style={[styles.sortBtnLabel, sortType === 'alpha' && styles.sortBtnLabelActive]}>
                {sortType === 'alpha' && sortDir === 'desc' ? 'Z–A' : 'A–Z'}
              </Text>
              <Ionicons
                name={sortType === 'alpha' && sortDir === 'desc' ? 'arrow-up' : 'arrow-down'}
                size={11}
                color={sortType === 'alpha' ? COLORS.brandPrimary : COLORS.textTertiary}
              />
            </TouchableOpacity>

            {/* Amount sort */}
            <TouchableOpacity
              style={[styles.sortBtn, sortType === 'amount' && styles.sortBtnActive]}
              onPress={() => handleSort('amount')}
              activeOpacity={0.7}
            >
              <Text style={[styles.sortBtnLabel, sortType === 'amount' && styles.sortBtnLabelActive]}>₹</Text>
              <Ionicons
                name={sortType === 'amount' && sortDir === 'desc' ? 'arrow-down' : 'arrow-up'}
                size={11}
                color={sortType === 'amount' ? COLORS.brandPrimary : COLORS.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Active nature badge (shows when a nature filter is applied) */}
      {activeNature !== 'All' && (
        <View style={styles.activeBadgeRow}>
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeTxt}>{activeNature}</Text>
            <TouchableOpacity onPress={() => setActiveNature('All')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={14} color={COLORS.brandPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Inline floating dropdown: All / Credit / Debit */}
      <Modal
        visible={showFilterDrop}
        transparent
        animationType="none"
        onRequestClose={() => setShowFilterDrop(false)}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setShowFilterDrop(false)}
        >
          <View style={[styles.floatDropCard, { top: filterDropPos.y, left: filterDropPos.x }]}>
            {[
              { v: 'All' as FilterType, icon: 'list', label: 'All' },
              { v: 'Credit' as FilterType, icon: 'arrow-down-circle-outline', label: 'Credit' },
              { v: 'Debit' as FilterType, icon: 'arrow-up-circle-outline', label: 'Debit' },
            ].map((opt, idx) => (
              <TouchableOpacity
                key={opt.v}
                style={[styles.floatDropItem, idx < 2 && styles.floatDropItemBorder, filter === opt.v && styles.floatDropItemActive]}
                onPress={() => { setFilter(opt.v); setShowFilterDrop(false); }}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={opt.icon as any}
                  size={16}
                  color={filter === opt.v ? COLORS.brandPrimary : COLORS.textSecondary}
                />
                <Text style={[styles.floatDropTxt, filter === opt.v && styles.floatDropTxtActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Ledger List */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />
        }
      >
        <View style={styles.list}>
          {filtered.map(item => {
            const hasPhone = !!(item.phone);
            const isSelected = selected.includes(item.id);

            const renderRightActions = (
              _progress: Animated.AnimatedInterpolation<number>,
              dragX: Animated.AnimatedInterpolation<number>
            ) => {
              const scale = dragX.interpolate({
                inputRange: [-160, 0],
                outputRange: [1, 0.5],
                extrapolate: 'clamp',
              });
              return (
                <Animated.View style={[styles.swipeActions, { transform: [{ scale }] }]}>
                  {/* Call button */}
                  <TouchableOpacity
                    style={styles.callAction}
                    onPress={() => Linking.openURL(`tel:${item.phone}`)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="call" size={22} color="#fff" />
                    <Text style={styles.actionLabel}>Call</Text>
                  </TouchableOpacity>
                  {/* WhatsApp button */}
                  <TouchableOpacity
                    style={styles.waAction}
                    onPress={() => Linking.openURL(`https://wa.me/91${item.phone}`)}
                    activeOpacity={0.85}
                  >
                    <FontAwesome5 name="whatsapp" size={22} color="#fff" />
                    <Text style={styles.actionLabel}>WhatsApp</Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            };

            const cardContent = (
              <TouchableOpacity
                testID={`ledger-item-${item.id}`}
                style={[styles.itemCard, isSelected && styles.itemCardSelected]}
                activeOpacity={0.7}
                onPress={() => {
                  if (selectMode) { toggleSelect(item.id); }
                  else { router.push(`/ledger/${item.id}` as any); }
                }}
                onLongPress={() => enterSelectMode(item.id)}
                delayLongPress={500}
              >
                {/* Avatar / Checkbox */}
                <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                  {isSelected
                    ? <Ionicons name="checkmark" size={20} color={COLORS.white} />
                    : <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                  }
                </View>
                {/* Info */}
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemGroup}>{item.group}</Text>
                </View>
                {/* Right: balance + Cr/Dr badge */}
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
            );

            return hasPhone && !selectMode ? (
              <Swipeable
                key={item.id}
                renderRightActions={renderRightActions}
                rightThreshold={40}
                overshootRight={false}
                friction={2}
                containerStyle={{ borderRadius: RADIUS.md, overflow: 'hidden' }}
              >
                {cardContent}
              </Swipeable>
            ) : (
              <View key={item.id}>{cardContent}</View>
            );
          })}

          {filtered.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="journal-outline" size={48} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>No ledgers found</Text>
            </View>
          )}
        </View>

        <View style={{ height: selectMode ? 100 : 80 }} />
      </ScrollView>

      {/* ── Multi-select Share Bar ─────────────────────────────────────── */}
      {selectMode && (
        <View style={styles.shareBar}>
          <View style={styles.shareLeft}>
            <Text style={styles.shareCount}>{selected.length} selected</Text>
            <TouchableOpacity
              onPress={cancelSelectMode}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text style={styles.shareCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.shareActionBtn, selected.length === 0 && { opacity: 0.5 }]}
            onPress={handleShareMock}
            activeOpacity={0.85}
            disabled={selected.length === 0}
          >
            <Ionicons name="share-outline" size={16} color={COLORS.white} />
            <Text style={styles.shareActionTxt}>Share PDF / XLS</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modals */}
      <CreateLedgerModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={(d) => console.log('New ledger:', d)}
      />
      <FilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        activeNature={activeNature}
        onApply={(nature) => setActiveNature(nature)}
      />
      {/* Ledger Type Selection Sheet */}
      <Modal visible={showTypeSheet} transparent animationType="slide" onRequestClose={() => setShowTypeSheet(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowTypeSheet(false)} />
          <View style={fm.tsSheet}>
            <View style={fm.tsHandle} />
            <Text style={fm.tsTitle}>Add Ledger</Text>
            <Text style={fm.tsSubtitle}>Select ledger group type</Text>
            {[
              { type: 'sundry_creditor', label: 'Sundry Creditors', icon: 'person-add-outline', color: COLORS.positive, desc: 'Vendor/supplier accounts' },
              { type: 'sundry_debtor', label: 'Sundry Debtors', icon: 'person-outline', color: COLORS.info, desc: 'Customer/party accounts' },
              { type: 'duties_taxes', label: 'Duties and Taxes', icon: 'receipt-outline', color: COLORS.warning, desc: 'GST, TDS and duty accounts' },
              { type: 'custom', label: 'Custom Groups', icon: 'settings-outline', color: COLORS.textSecondary, desc: 'Custom ledger under any group' },
            ].map(opt => (
              <TouchableOpacity key={opt.type} style={fm.tsOption} onPress={() => { setShowTypeSheet(false); router.push(`/ledger/create?type=${opt.type}` as any); }} activeOpacity={0.7}>
                <View style={[fm.tsIconWrap, { backgroundColor: opt.color + '18' }]}>
                  <Ionicons name={opt.icon as any} size={22} color={opt.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={fm.tsOptionLabel}>{opt.label}</Text>
                  <Text style={fm.tsOptionDesc}>{opt.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
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
  // ≡ All ▾ dropdown button
  filterDropBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg, minWidth: 90,
  },
  filterDropBtnActive: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandPrimary + '12' },
  filterDropBtnTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  filterDropBtnTxtActive: { color: COLORS.brandPrimary },
  // Floating dropdown card (from the ≡ All button)
  floatDropCard: {
    position: 'absolute',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    minWidth: 160,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 8,
    overflow: 'hidden',
  },
  floatDropItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  floatDropItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  floatDropItemActive: { backgroundColor: COLORS.brandPrimary + '0D' },
  floatDropTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, fontWeight: '500' },
  floatDropTxtActive: { color: COLORS.brandPrimary, fontWeight: '700' },
  // Active nature badge row
  activeBadgeRow: {
    flexDirection: 'row', paddingHorizontal: SPACING.md, paddingVertical: 6,
    backgroundColor: COLORS.pageBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.brandPrimary + '15', borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.brandPrimary + '40',
  },
  activeBadgeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.brandPrimary },
  // Right controls
  rightControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Hide ₹0 chip — filled green when active, grey outline when off
  hideZeroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
  },
  hideZeroChipOn: {
    borderColor: COLORS.brandPrimary,
    backgroundColor: COLORS.brandPrimary,
  },
  hideZeroChipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  hideZeroChipTxtOn: { color: '#FFFFFF' },
  // Sort buttons
  sortBtns: { flexDirection: 'row', gap: 4 },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 9, paddingVertical: 7,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.pageBg,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
  },
  sortBtnActive: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandPrimary + '12' },
  sortBtnLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textTertiary },
  sortBtnLabelActive: { color: COLORS.brandPrimary },
  scroll: { flex: 1 },
  list: { padding: SPACING.md, gap: 8 },
  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBg,
    padding: 14, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  // Swipe right-actions container
  swipeActions: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  // Call action — dark charcoal
  callAction: {
    width: 80,
    backgroundColor: COLORS.textPrimary,
    alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  // WhatsApp action — official green
  waAction: {
    width: 80,
    backgroundColor: '#25D366',
    alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  actionLabel: {
    fontSize: 11, fontWeight: '700', color: '#fff',
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

  // ── Multi-select styles ────────────────────────────────────────────────────
  itemCardSelected: {
    borderColor: COLORS.brandPrimary,
    borderWidth: 2,
    backgroundColor: COLORS.brandPrimary + '08',
  },
  avatarSelected: {
    backgroundColor: COLORS.brandPrimary,
  },
  headerTextBtn: {
    paddingHorizontal: 10, paddingVertical: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTextBtnPrimary: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary,
  },
  headerTextBtnCancel: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.negative,
  },
  shareBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 8,
  },
  shareLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  shareCount: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  shareCancelTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  shareActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  shareActionTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
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

// Filter Modal Styles — two-panel design
const fm = StyleSheet.create({
  // ── Filter Modal — tab selector & group search ────────────────────────────
  tabs: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: RADIUS.full, borderWidth: 1.5,
    borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg,
  },
  tabActive:   { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandPrimary },
  tabTxt:      { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabTxtActive:{ color: COLORS.white, fontWeight: '700' },
  groupPanel:  { paddingBottom: SPACING.md },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.pageBg,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  groupHint: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, paddingHorizontal: SPACING.md },
  // Type Sheet styles (kept for the "Add Ledger" type sheet)
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
