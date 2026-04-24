import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Pressable, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';

// ── Types ─────────────────────────────────────────────────────────────────────
type ViewMode = 'chronological' | 'byItem' | 'byDocument';
type TxnType  = 'Sales' | 'Purchase' | 'Transfer' | 'Adjustment' | 'Opening';

interface TxEntry {
  id: string; sku: string; item: string; batch: string;
  txnId: string; docRef: string; docType: string;
  date: string; time: string; qty: number;
  unitCost: string; balance: string; value: string;
  warehouse: string; postedBy: string; note: string;
  type: TxnType;
}

// ── Mock Data ─────────────────────────────────────────────────────────────────
const WAREHOUSES = ['WH-001 Main', 'WH-002 Echo Depot', 'WH-003 Sierra Storage'];
const TXN_TYPES: TxnType[] = ['Sales', 'Purchase', 'Transfer', 'Adjustment', 'Opening'];

const MOCK_TXN: TxEntry[] = [
  { id: 't1',  sku: 'SKU-2987', item: 'Black JBL',       batch: '#BS-2407', txnId: 'TXN-10231', docRef: 'INV-8881', docType: 'Sales Invoice',   date: 'Dec 15, 2024', time: '14:23', qty: -50,  unitCost: '₹275',   balance: '₹12,000', value: '₹13,750',  warehouse: 'WH-002', postedBy: 'Rina Kusuma', note: '-',             type: 'Sales'    },
  { id: 't2',  sku: 'SKU-2987', item: 'Black JBL',       batch: '#BS-2408', txnId: 'TXN-10232', docRef: 'PO-00124',  docType: 'Purchase Order',  date: 'Dec 14, 2024', time: '11:30', qty:  100, unitCost: '₹260',   balance: '₹28,000', value: '₹26,000',  warehouse: 'WH-001', postedBy: 'Amit Shah',   note: 'Restock',       type: 'Purchase' },
  { id: 't3',  sku: 'SKU-2987', item: 'Black JBL',       batch: '#BS-2407', txnId: 'TXN-10233', docRef: 'ST-00082',  docType: 'Transfer',        date: 'Dec 13, 2024', time: '09:15', qty: -30,  unitCost: '₹275',   balance: '₹8,250',  value: '₹9,100',   warehouse: 'WH-002', postedBy: 'Dev Sharma',  note: 'To WH-001',    type: 'Transfer' },
  { id: 't4',  sku: 'SKU-2987', item: 'Black JBL',       batch: '#BS-2409', txnId: 'TXN-10234', docRef: 'INV-8879',  docType: 'Sales Invoice',   date: 'Dec 12, 2024', time: '16:45', qty: -20,  unitCost: '₹275',   balance: '₹5,500',  value: '₹6,200',   warehouse: 'WH-001', postedBy: 'Rina Kusuma', note: '-',             type: 'Sales'    },
  { id: 't5',  sku: 'SKU-3104', item: 'USB-C Hub',       batch: '#UC-1102', txnId: 'TXN-10235', docRef: 'PO-00125',  docType: 'Purchase Order',  date: 'Dec 11, 2024', time: '10:00', qty:  200, unitCost: '₹1,200', balance: '₹2,40,000', value: '₹2,20,000', warehouse: 'WH-001', postedBy: 'Priya Nair',  note: 'Q4 restock',   type: 'Purchase' },
  { id: 't6',  sku: 'SKU-3104', item: 'USB-C Hub',       batch: '#UC-1102', txnId: 'TXN-10236', docRef: 'INV-8882',  docType: 'Sales Invoice',   date: 'Dec 10, 2024', time: '13:20', qty: -80,  unitCost: '₹1,200', balance: '₹96,000', value: '₹1,08,000', warehouse: 'WH-001', postedBy: 'Rina Kusuma', note: '-',             type: 'Sales'    },
  { id: 't7',  sku: 'SKU-4211', item: 'Wireless Mouse',  batch: '#WM-0541', txnId: 'TXN-10237', docRef: 'ADJ-00011', docType: 'Adjustment',      date: 'Dec 09, 2024', time: '08:00', qty:   15, unitCost: '₹850',   balance: '₹12,750', value: '₹11,900',  warehouse: 'WH-003', postedBy: 'Dev Sharma',  note: 'Cycle count',  type: 'Adjustment'},
  { id: 't8',  sku: 'SKU-4211', item: 'Wireless Mouse',  batch: '#WM-0542', txnId: 'TXN-10238', docRef: 'PO-00126',  docType: 'Purchase Order',  date: 'Dec 08, 2024', time: '14:50', qty:  150, unitCost: '₹820',   balance: '₹1,23,000', value: '₹1,08,000', warehouse: 'WH-003', postedBy: 'Amit Shah',   note: '-',            type: 'Purchase' },
  { id: 't9',  sku: 'SKU-4211', item: 'Wireless Mouse',  batch: '#WM-0541', txnId: 'TXN-10239', docRef: 'INV-8883',  docType: 'Sales Invoice',   date: 'Dec 07, 2024', time: '11:10', qty: -60,  unitCost: '₹850',   balance: '₹51,000', value: '₹58,500',  warehouse: 'WH-003', postedBy: 'Rina Kusuma', note: '-',             type: 'Sales'    },
  { id: 't10', sku: 'SKU-1055', item: 'Laptop 15" Pro',  batch: '#LP-0010', txnId: 'TXN-10240', docRef: 'OB-00001',  docType: 'Opening Balance', date: 'Apr 01, 2024', time: '00:00', qty:   12, unitCost: '₹82,000', balance: '₹9,84,000', value: '₹9,84,000', warehouse: 'WH-001', postedBy: 'Admin',       note: 'Opening',      type: 'Opening'  },
];

const TYPE_COLOR: Record<TxnType, string> = {
  Sales: '#A89060', Purchase: COLORS.textPrimary, Transfer: '#7C3AED', Adjustment: '#D97706', Opening: '#3A3A3A',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function StockLedgerScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();

  // View & UI state
  const [viewMode,    setViewMode]    = useState<ViewMode>('chronological');
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());
  const [selected,    setSelected]    = useState<Set<string>>(new Set());

  // Filter modal
  const [showFilter,  setShowFilter]  = useState(false);
  const [showDatePick,setShowDatePick]= useState(false);

  // Applied filters
  const [dateFrom,    setDateFrom]    = useState('01/04/24');
  const [dateTo,      setDateTo]      = useState('15/12/24');
  const [selWH,       setSelWH]       = useState<Set<string>>(new Set());
  const [itemSearch,  setItemSearch]  = useState('');
  const [batchSearch, setBatchSearch] = useState('');
  const [selTypes,    setSelTypes]    = useState<Set<TxnType>>(new Set());

  // Draft filters (inside modal before Apply)
  const [draftWH,    setDraftWH]    = useState<Set<string>>(new Set());
  const [draftItem,  setDraftItem]  = useState('');
  const [draftBatch, setDraftBatch] = useState('');
  const [draftTypes, setDraftTypes] = useState<Set<TxnType>>(new Set());
  const [draftFrom,  setDraftFrom]  = useState('01/04/24');
  const [draftTo,    setDraftTo]    = useState('15/12/24');

  // Open filter → copy applied → draft
  const openFilter = () => {
    setDraftWH(new Set(selWH));
    setDraftItem(itemSearch);
    setDraftBatch(batchSearch);
    setDraftTypes(new Set(selTypes));
    setDraftFrom(dateFrom);
    setDraftTo(dateTo);
    setShowFilter(true);
  };

  const applyFilters = () => {
    setSelWH(new Set(draftWH));
    setItemSearch(draftItem);
    setBatchSearch(draftBatch);
    setSelTypes(new Set(draftTypes));
    setDateFrom(draftFrom);
    setDateTo(draftTo);
    setShowFilter(false);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const fmtDateLabel = (s: string) => {
    const p = s.split('/');
    if (p.length < 3) return s;
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${p[0]} ${m[parseInt(p[1])-1]} ${p[2]}`;
  };

  // Filtered transactions
  const filtered = useMemo(() => MOCK_TXN.filter(t => {
    if (selWH.size    > 0 && ![...selWH].some(w => t.warehouse.includes(w.split(' ')[0])))   return false;
    if (selTypes.size > 0 && !selTypes.has(t.type))       return false;
    if (itemSearch && !t.item.toLowerCase().includes(itemSearch.toLowerCase())) return false;
    if (batchSearch && !t.batch.toLowerCase().includes(batchSearch.toLowerCase())) return false;
    return true;
  }), [selWH, selTypes, itemSearch, batchSearch]);

  const activeFilterCount =
    selWH.size + selTypes.size +
    (itemSearch ? 1 : 0) + (batchSearch ? 1 : 0);

  // ── Grouped data ────────────────────────────────────────────────────────────
  // By Item: group by sku
  const byItemGroups = useMemo(() => {
    const map = new Map<string, TxEntry[]>();
    filtered.forEach(t => { const k = `${t.item}|${t.sku}`; if (!map.has(k)) map.set(k, []); map.get(k)!.push(t); });
    return [...map.entries()].map(([key, items]) => ({ key, item: items[0].item, sku: items[0].sku, value: items[0].balance, items }));
  }, [filtered]);

  // By Document: group by docRef
  const byDocGroups = useMemo(() => {
    const map = new Map<string, TxEntry[]>();
    filtered.forEach(t => { if (!map.has(t.docRef)) map.set(t.docRef, []); map.get(t.docRef)!.push(t); });
    return [...map.entries()].map(([docRef, items]) => ({ docRef, docType: items[0].docType, date: items[0].date, warehouse: items[0].warehouse, items, value: items[0].value }));
  }, [filtered]);

  // ── Render helpers ──────────────────────────────────────────────────────────
  const DetailRow = ({ label, value, label2, value2 }: { label: string; value: string; label2?: string; value2?: string }) => (
    <View style={s.detailRow}>
      <View style={s.detailCol}>
        <Text style={s.detailLbl}>{label}</Text>
        <Text style={s.detailVal}>{value}</Text>
      </View>
      {label2 && (
        <View style={s.detailCol}>
          <Text style={s.detailLbl}>{label2}</Text>
          <Text style={s.detailVal}>{value2 ?? ''}</Text>
        </View>
      )}
    </View>
  );

  // ── Chronological Card ───────────────────────────────────────────────────────
  const renderChronCard = (tx: TxEntry) => {
    const isExp  = expanded.has(tx.id);
    const isSel  = selected.has(tx.id);
    const tc     = TYPE_COLOR[tx.type];
    const isIn   = tx.qty > 0;
    return (
      <TouchableOpacity
        key={tx.id}
        style={[s.card, isSel && s.cardSel]}
        activeOpacity={0.7}
        onPress={() => selected.size > 0 ? toggleSelect(tx.id) : toggleExpand(tx.id)}
        onLongPress={() => toggleSelect(tx.id)}
      >
        <View style={s.cardTop}>
          <View style={s.avatar}>
            {isSel
              ? <Ionicons name="checkmark" size={16} color="#fff" />
              : <Text style={s.avatarTxt}>{tx.item.charAt(0)}</Text>
            }
          </View>
          <View style={s.cardInfo}>
            <Text style={s.cardTitle}>{tx.sku}</Text>
            <Text style={s.cardSub}>{tx.date} · {tx.time}</Text>
          </View>
          <View style={s.cardRight}>
            <Text style={[s.cardQty, { color: isIn ? COLORS.positive : COLORS.negative }]}>
              {isIn ? '+' : ''}{tx.qty}
            </Text>
            <Ionicons name={isExp ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textTertiary} />
          </View>
        </View>
        {isExp && (
          <View style={s.expandBody}>
            <View style={s.expandDivider} />
            <DetailRow label="Item"       value={tx.item}      label2="Batch/Serial" value2={tx.batch}    />
            <DetailRow label="Unit cost"  value={tx.unitCost}  label2="Balance"      value2={tx.balance}  />
            <DetailRow label="TxN ID"     value={tx.txnId}     label2="Doc Ref"      value2={tx.docRef}   />
            <DetailRow label="Posted-by"  value={tx.postedBy}                                              />
            <DetailRow label="Note"       value={tx.note}                                                  />
            <View style={[s.typePill, { backgroundColor: tc + '18', alignSelf: 'flex-start', marginTop: 6 }]}>
              <Text style={[s.typePillTxt, { color: tc }]}>{tx.type}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── By Item Card ─────────────────────────────────────────────────────────────
  const renderByItemCard = (grp: typeof byItemGroups[0]) => {
    const isExp = expanded.has(grp.key);
    const isSel = grp.items.every(t => selected.has(t.id));
    return (
      <TouchableOpacity
        key={grp.key}
        style={[s.card, isSel && s.cardSel]}
        activeOpacity={0.7}
        onPress={() => selected.size > 0
          ? grp.items.forEach(t => toggleSelect(t.id))
          : toggleExpand(grp.key)
        }
        onLongPress={() => grp.items.forEach(t => toggleSelect(t.id))}
      >
        <View style={s.cardTop}>
          <View style={s.avatar}>
            {isSel
              ? <Ionicons name="checkmark" size={16} color="#fff" />
              : <Text style={s.avatarTxt}>{grp.item.charAt(0)}</Text>
            }
          </View>
          <View style={s.cardInfo}>
            <Text style={s.cardTitle}>{grp.item} · {grp.sku}</Text>
            <Text style={s.cardSub}>{grp.items.length} transaction{grp.items.length !== 1 ? 's' : ''}</Text>
          </View>
          <View style={s.cardRight}>
            <Text style={s.cardValue}>{grp.value}</Text>
            <Ionicons name={isExp ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textTertiary} />
          </View>
        </View>
        {isExp && (
          <View style={s.expandBody}>
            {grp.items.map((tx, i) => (
              <View key={tx.id}>
                {i > 0 && <View style={s.innerDivider} />}
                <View style={s.expandDivider} />
                <DetailRow label="Date"    value={tx.date}    label2="TxN ID"   value2={tx.txnId}   />
                <DetailRow label="Doc Ref" value={tx.docRef}  label2="Quantity" value2={`${tx.qty > 0 ? '+' : ''}${tx.qty} pcs`} />
                <DetailRow label="Balance" value={tx.balance}                                        />
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── By Document Card ──────────────────────────────────────────────────────────
  const renderByDocCard = (grp: typeof byDocGroups[0]) => {
    const isExp = expanded.has(grp.docRef);
    return (
      <View key={grp.docRef} style={s.docGroup}>
        {/* Document Group Header */}
        <View style={s.docHeader}>
          <View style={s.docTypeBadge}>
            <Text style={s.docTypeTxt}>{grp.docType}</Text>
          </View>
          <View style={s.docMeta}>
            <Text style={s.docMetaTxt}>{grp.date}</Text>
            <View style={s.docDot} />
            <Text style={s.docMetaTxt}>{grp.warehouse}</Text>
          </View>
        </View>
        {/* Document Card */}
        <TouchableOpacity
          style={[s.card, { marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 0 }]}
          activeOpacity={0.7}
          onPress={() => toggleExpand(grp.docRef)}
          onLongPress={() => grp.items.forEach(t => toggleSelect(t.id))}
        >
          <View style={s.cardTop}>
            <View style={[s.avatar, { backgroundColor: COLORS.pageBg }]}>
              <Ionicons name="document-outline" size={18} color={COLORS.brandPrimary} />
            </View>
            <View style={s.cardInfo}>
              <Text style={s.cardTitle}>{grp.docRef}</Text>
              <Text style={s.cardSub}>{grp.items.length} item{grp.items.length !== 1 ? 's' : ''}</Text>
            </View>
            <View style={s.cardRight}>
              <Text style={s.cardValue}>{grp.value}</Text>
              <Ionicons name={isExp ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textTertiary} />
            </View>
          </View>
          {isExp && (
            <View style={s.expandBody}>
              {grp.items.map((tx, i) => (
                <View key={tx.id}>
                  {i > 0 && <View style={s.innerDivider} />}
                  <View style={s.expandDivider} />
                  <DetailRow label="Item"      value={tx.item}      label2="Batch/Serial" value2={tx.batch}    />
                  <DetailRow label="Unit cost" value={tx.unitCost}  label2="Balance"      value2={tx.balance}  />
                  <DetailRow label="Posted-by" value={tx.postedBy}                                              />
                  <DetailRow label="Note"      value={tx.note}                                                  />
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // ── Filter Modal ─────────────────────────────────────────────────────────────
  const FilterModal = () => (
    <Modal visible={showFilter} transparent animationType="slide" onRequestClose={() => setShowFilter(false)}>
      <Pressable style={s.modalOverlay} onPress={() => setShowFilter(false)}>
        <Pressable style={[s.modalSheet, { paddingBottom: insets.bottom + 16 }]} onPress={e => e.stopPropagation()}>
          {/* Handle */}
          <View style={s.modalHandle} />
          {/* Title */}
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Filter</Text>
            <TouchableOpacity onPress={() => setShowFilter(false)} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {/* Date Range */}
            <View style={s.filterSection}>
              <Text style={s.filterSectionTitle}>Date range</Text>
              <TouchableOpacity style={s.dateRangeRow} onPress={() => setShowDatePick(true)} activeOpacity={0.7}>
                <View style={s.dateField}>
                  <Ionicons name="calendar-outline" size={14} color={COLORS.textTertiary} />
                  <Text style={s.dateFieldTxt}>{fmtDateLabel(draftFrom)}</Text>
                </View>
                <Text style={s.dateTo}>To</Text>
                <View style={s.dateField}>
                  <Ionicons name="calendar-outline" size={14} color={COLORS.textTertiary} />
                  <Text style={s.dateFieldTxt}>{fmtDateLabel(draftTo)}</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Warehouse */}
            <View style={s.filterSection}>
              <Text style={s.filterSectionTitle}>Warehouse</Text>
              <View style={s.chipWrap}>
                {WAREHOUSES.map(w => {
                  const active = draftWH.has(w);
                  return (
                    <TouchableOpacity
                      key={w}
                      style={[s.filterChip, active && s.filterChipActive]}
                      onPress={() => {
                        const n = new Set(draftWH);
                        active ? n.delete(w) : n.add(w);
                        setDraftWH(n);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.filterChipTxt, active && s.filterChipTxtActive]}>{w}</Text>
                      {active && <Ionicons name="close" size={12} color="#fff" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Item / SKU Search */}
            <View style={s.filterSection}>
              <Text style={s.filterSectionTitle}>Item / SKU</Text>
              <View style={s.searchInput}>
                <Ionicons name="search-outline" size={15} color={COLORS.textTertiary} />
                <TextInput
                  style={s.searchTxt}
                  placeholder="Search product"
                  placeholderTextColor={COLORS.textTertiary}
                  value={draftItem}
                  onChangeText={setDraftItem}
                />
              </View>
            </View>

            {/* Batch / Serial */}
            <View style={s.filterSection}>
              <Text style={s.filterSectionTitle}>Batch / Serial</Text>
              <View style={s.searchInput}>
                <Ionicons name="search-outline" size={15} color={COLORS.textTertiary} />
                <TextInput
                  style={s.searchTxt}
                  placeholder="Search product"
                  placeholderTextColor={COLORS.textTertiary}
                  value={draftBatch}
                  onChangeText={setDraftBatch}
                />
              </View>
            </View>

            {/* Txn Type */}
            <View style={s.filterSection}>
              <Text style={s.filterSectionTitle}>Txn type</Text>
              <View style={s.typeList}>
                {TXN_TYPES.map(t => {
                  const active = draftTypes.has(t);
                  return (
                    <TouchableOpacity
                      key={t}
                      style={s.typeRow}
                      onPress={() => {
                        const n = new Set(draftTypes);
                        active ? n.delete(t) : n.add(t);
                        setDraftTypes(n);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.typeRowTxt, active && s.typeRowTxtActive]}>{t}</Text>
                      <View style={[s.checkbox, active && s.checkboxActive]}>
                        {active && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Buttons */}
          <View style={s.modalFooter}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowFilter(false)} activeOpacity={0.7}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.applyBtn} onPress={applyFilters} activeOpacity={0.8}>
              <Text style={s.applyTxt}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>

      <DateRangePickerModal
        visible={showDatePick}
        fromDate={draftFrom}
        toDate={draftTo}
        onApply={(f, t) => { setDraftFrom(f); setDraftTo(t); }}
        onClose={() => setShowDatePick(false)}
      />
    </Modal>
  );

  // ── Main Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Stock Ledger</Text>
        <TouchableOpacity style={s.headerBtn} onPress={openFilter} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={22} color={COLORS.textPrimary} />
          {activeFilterCount > 0 && (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeTxt}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* View Mode Tabs */}
      <View style={s.tabRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabScroll}>
          {([
            { key: 'chronological', icon: 'time-outline',        label: 'Chronological' },
            { key: 'byItem',        icon: 'cube-outline',         label: 'By Item'       },
            { key: 'byDocument',    icon: 'document-text-outline', label: 'By Document'  },
          ] as { key: ViewMode; icon: string; label: string }[]).map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, viewMode === tab.key && s.tabActive]}
              onPress={() => { setViewMode(tab.key); setExpanded(new Set()); }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon as any}
                size={14}
                color={viewMode === tab.key ? '#fff' : COLORS.textSecondary}
              />
              <Text style={[s.tabTxt, viewMode === tab.key && s.tabTxtActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Summary Strip */}
      <View style={s.summaryStrip}>
        <View style={s.summaryItem}>
          <Text style={s.summaryVal}>{filtered.length}</Text>
          <Text style={s.summaryLbl}>Entries</Text>
        </View>
        <View style={s.summarySep} />
        <View style={s.summaryItem}>
          <Text style={[s.summaryVal, { color: COLORS.positive }]}>
            +{filtered.filter(t => t.qty > 0).reduce((a, t) => a + t.qty, 0)}
          </Text>
          <Text style={s.summaryLbl}>Total In</Text>
        </View>
        <View style={s.summarySep} />
        <View style={s.summaryItem}>
          <Text style={[s.summaryVal, { color: COLORS.negative }]}>
            {filtered.filter(t => t.qty < 0).reduce((a, t) => a + t.qty, 0)}
          </Text>
          <Text style={s.summaryLbl}>Total Out</Text>
        </View>
        <View style={s.summarySep} />
        <View style={s.summaryItem}>
          <Text style={s.summaryVal}>₹9.84L</Text>
          <Text style={s.summaryLbl}>Value</Text>
        </View>
      </View>

      {/* List */}
      <ScrollView style={s.list} showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>
        {viewMode === 'chronological' && filtered.map(renderChronCard)}
        {viewMode === 'byItem'        && byItemGroups.map(renderByItemCard)}
        {viewMode === 'byDocument'    && byDocGroups.map(renderByDocCard)}
        {filtered.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="document-outline" size={48} color={COLORS.borderDefault} />
            <Text style={s.emptyTxt}>No transactions found</Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Multi-select bottom bar */}
      {selected.size > 0 && (
        <View style={[s.selBar, { paddingBottom: insets.bottom || 16 }]}>
          <TouchableOpacity onPress={() => setSelected(new Set())} activeOpacity={0.7} style={s.selCancel}>
            <Ionicons name="close" size={18} color={COLORS.textPrimary} />
            <Text style={s.selCancelTxt}>{selected.size} selected</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.selShare} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={16} color="#fff" />
            <Text style={s.selShareTxt}>Share PDF</Text>
          </TouchableOpacity>
        </View>
      )}

      <FilterModal />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 12, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  filterBadge: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  filterBadgeTxt: { fontSize: 9, fontWeight: '700', color: '#fff' },

  // View Mode Tabs
  tabRow:    { backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  tabScroll: { paddingHorizontal: SPACING.md, paddingVertical: 10, gap: 8 },
  tab:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  tabActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  tabTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabTxtActive: { color: '#fff' },

  // Summary Strip
  summaryStrip: { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  summaryItem:  { flex: 1, paddingVertical: 12, alignItems: 'center', gap: 2 },
  summarySep:   { width: 1, backgroundColor: COLORS.borderDefault, marginVertical: 8 },
  summaryVal:   { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  summaryLbl:   { fontSize: 10, color: COLORS.textSecondary },

  // List
  list:        { flex: 1 },
  listContent: { padding: SPACING.md, gap: 10 },

  // Cards
  card:    { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  cardSel: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACING.md },

  avatar:    { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },

  cardInfo:  { flex: 1, gap: 3 },
  cardTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  cardSub:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardQty:   { fontSize: TYPOGRAPHY.base, fontWeight: '800' },
  cardValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  expandBody:    { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  expandDivider: { height: 1, backgroundColor: COLORS.borderDefault, marginBottom: SPACING.sm },
  innerDivider:  { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: SPACING.sm },

  detailRow: { flexDirection: 'row', marginBottom: 8 },
  detailCol: { flex: 1, gap: 2 },
  detailLbl: { fontSize: 10, color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  detailVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },

  typePill:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  typePillTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  // By Document
  docGroup:   { gap: 0 },
  docHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingBottom: 6 },
  docTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.brandPrimary + '18' },
  docTypeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.brandPrimary },
  docMeta:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docMetaTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  docDot:     { width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.textTertiary },

  // Selection bar
  selBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: 12, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  selCancel:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selCancelTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  selShare:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.textPrimary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: RADIUS.full },
  selShareTxt:{ fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#fff' },

  // Empty
  empty:    { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },

  // Filter Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet:   { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%', paddingHorizontal: SPACING.md },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderDefault, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, marginBottom: 8 },
  modalTitle:   { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },

  filterSection:      { marginBottom: 20 },
  filterSectionTitle: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },

  dateRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateField:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  dateFieldTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  dateTo:       { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },

  chipWrap:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  filterChipActive:{ backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  filterChipTxt:   { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textSecondary },
  filterChipTxtActive: { color: '#fff', fontWeight: '600' },

  searchInput: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  searchTxt:   { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, padding: 0 },

  typeList:   { borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  typeRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  typeRowTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
  typeRowTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  checkbox:       { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },

  modalFooter: { flexDirection: 'row', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  cancelBtn:   { flex: 1, paddingVertical: 16, borderRadius: RADIUS.lg, backgroundColor: COLORS.pageBg, alignItems: 'center' },
  cancelTxt:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  applyBtn:    { flex: 1, paddingVertical: 16, borderRadius: RADIUS.lg, backgroundColor: COLORS.textPrimary, alignItems: 'center' },
  applyTxt:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
});
