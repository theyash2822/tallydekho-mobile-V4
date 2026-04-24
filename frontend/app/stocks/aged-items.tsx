import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// ─── DATA ─────────────────────────────────────────────────────────────────────

const AGED_ITEMS = [
  { id: 'AG01', name: 'Legacy VGA Monitor 19"', sku: 'VGA-MON19', age: 365, value: '₹1,800', unitPrice: 1800, qty: 4,  category: 'Displays',    warehouse: 'Mumbai'    },
  { id: 'AG02', name: 'CD/DVD Writer 52x',       sku: 'DVD-52X',   age: 310, value: '₹1,200', unitPrice: 1200, qty: 7,  category: 'Storage',     warehouse: 'Delhi'     },
  { id: 'AG03', name: 'PS/2 Keyboard',           sku: 'PS2-KB01',  age: 290, value: '₹900',   unitPrice: 900,  qty: 12, category: 'Peripherals', warehouse: 'Mumbai'    },
  { id: 'AG04', name: 'D-Sub VGA Cable 1.8m',    sku: 'VGA-1.8',   age: 245, value: '₹1,500', unitPrice: 1500, qty: 18, category: 'Cables',      warehouse: 'Bangalore' },
  { id: 'AG05', name: 'IDE HDD 80GB',            sku: 'IDE-80GB',  age: 210, value: '₹2,400', unitPrice: 2400, qty: 3,  category: 'Storage',     warehouse: 'Chennai'   },
  { id: 'AG06', name: 'Fax Machine M60',         sku: 'FAX-M60',   age: 180, value: '₹3,500', unitPrice: 3500, qty: 2,  category: 'Office',      warehouse: 'Delhi'     },
  { id: 'AG07', name: 'Inkjet Cartridge HP45',   sku: 'INK-HP45',  age: 165, value: '₹4,200', unitPrice: 4200, qty: 25, category: 'Consumables', warehouse: 'Mumbai'    },
  { id: 'AG08', name: 'LAN Hub 8-Port',          sku: 'HUB-8P',    age: 150, value: '₹2,800', unitPrice: 2800, qty: 5,  category: 'Networking',  warehouse: 'Bangalore' },
  { id: 'AG09', name: 'USB 2.0 Flash Drive 4GB', sku: 'USB2-4G',   age: 120, value: '₹3,600', unitPrice: 3600, qty: 30, category: 'Storage',     warehouse: 'Kolkata'   },
  { id: 'AG10', name: 'Parallel Port LPT Cable', sku: 'LPT-1.5',   age: 95,  value: '₹600',   unitPrice: 600,  qty: 8,  category: 'Cables',      warehouse: 'Chennai'   },
];

const MAX_TOTAL_VALUE = Math.max(...AGED_ITEMS.map(i => i.unitPrice * i.qty));

const AGE_CONFIG = (days: number) => {
  if (days >= 300) return { label: '10m+',  color: '#DC2626', bg: '#FEF2F2' };
  if (days >= 180) return { label: '6-10m', color: '#D97706', bg: '#FFFBEB' };
  if (days >= 90)  return { label: '3-6m',  color: '#2563EB', bg: '#EFF6FF' };
  return                  { label: '<3m',   color: '#6B7280', bg: '#F3F4F6' };
};

const FILTER_OPTIONS = ['All', '>10m', '6-10m', '3-6m', '<3m'] as const;
type FilterOpt = typeof FILTER_OPTIONS[number];

function passesFilter(days: number, f: FilterOpt): boolean {
  if (f === 'All')   return true;
  if (f === '>10m')  return days >= 300;
  if (f === '6-10m') return days >= 180 && days < 300;
  if (f === '3-6m')  return days >= 90  && days < 180;
  return days < 90;
}

const TABS = ['By Age', 'By Value', 'By Category'] as const;
type TabOpt = typeof TABS[number];

type AgedItem = typeof AGED_ITEMS[0];

// ─── BY-AGE ITEM CARD ─────────────────────────────────────────────────────────

function AgeCard({ item }: { item: AgedItem }) {
  const ac = AGE_CONFIG(item.age);
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemTop}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.itemMeta}>{item.sku} · {item.warehouse}</Text>
        </View>
        <View style={[styles.ageBadge, { backgroundColor: ac.bg }]}>
          <Ionicons name="time-outline" size={11} color={ac.color} />
          <Text style={[styles.ageText, { color: ac.color }]}>{item.age}d</Text>
        </View>
      </View>
      <View style={styles.itemStats}>
        {[
          { label: 'Qty',      value: `${item.qty} units` },
          { label: 'Value',    value: item.value },
          { label: 'Category', value: item.category },
          { label: 'Age Band', value: ac.label },
        ].map(s => (
          <View key={s.label} style={styles.statCell}>
            <Text style={styles.statLabel}>{s.label}</Text>
            <Text style={styles.statVal}>{s.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── BY-VALUE ITEM CARD ───────────────────────────────────────────────────────

function ValueCard({ item, rank }: { item: AgedItem; rank: number }) {
  const total  = item.unitPrice * item.qty;
  const pct    = Math.round((total / MAX_TOTAL_VALUE) * 100);
  const ac     = AGE_CONFIG(item.age);
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemTop}>
        <View style={styles.rankCircle}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.itemMeta}>{item.sku} · {item.category}</Text>
        </View>
        <View style={styles.valueSide}>
          <Text style={styles.totalValueTxt}>₹{total.toLocaleString('en-IN')}</Text>
          <Text style={styles.perUnitTxt}>{item.value} / unit</Text>
        </View>
      </View>
      <View style={styles.valueBarRow}>
        <View style={styles.valueBarTrack}>
          <View style={[styles.valueBarFill, { width: `${pct}%` as any }]} />
        </View>
        <View style={[styles.ageBadge, { backgroundColor: ac.bg, marginLeft: 8 }]}>
          <Text style={[styles.ageText, { color: ac.color }]}>{ac.label}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── BY-CATEGORY GROUP ────────────────────────────────────────────────────────

function CategoryGroup({ cat, items }: { cat: string; items: AgedItem[] }) {
  const [open, setOpen] = useState(true);
  const total  = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const maxAge = Math.max(...items.map(i => i.age));

  return (
    <View style={styles.catGroup}>
      <TouchableOpacity
        style={styles.catHeader}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.7}
      >
        <View style={styles.catHeaderL}>
          <Ionicons name="folder-outline" size={15} color={COLORS.brandPrimary} />
          <Text style={styles.catName}>{cat}</Text>
          <View style={styles.catBadge}>
            <Text style={styles.catBadgeTxt}>{items.length}</Text>
          </View>
        </View>
        <View style={styles.catHeaderR}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.catTotal}>₹{total.toLocaleString('en-IN')}</Text>
            <Text style={styles.catMaxAge}>Max age: {maxAge}d</Text>
          </View>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={15} color={COLORS.textTertiary}
          />
        </View>
      </TouchableOpacity>

      {open && items.map(item => {
        const ac = AGE_CONFIG(item.age);
        return (
          <View key={item.id} style={styles.catRow}>
            <View style={styles.catRowL}>
              <Text style={styles.catItemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.catItemMeta}>{item.qty} units · {item.warehouse}</Text>
            </View>
            <View style={styles.catRowR}>
              <View style={[styles.ageBadge, { backgroundColor: ac.bg }]}>
                <Text style={[styles.ageText, { color: ac.color }]}>{item.age}d</Text>
              </View>
              <Text style={styles.catItemVal}>
                ₹{(item.unitPrice * item.qty).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function AgedItemsScreen() {
  const router    = useRouter();
  const [filter,    setFilter]    = useState<FilterOpt>('All');
  const [activeTab, setActiveTab] = useState<TabOpt>('By Age');

  const filtered = AGED_ITEMS.filter(i => passesFilter(i.age, filter));

  const byAge      = [...filtered].sort((a, b) => b.age - a.age);
  const byValue    = [...filtered].sort(
    (a, b) => (b.unitPrice * b.qty) - (a.unitPrice * a.qty),
  );
  const cats       = [...new Set(filtered.map(i => i.category))].sort();
  const grouped    = cats.reduce<Record<string, AgedItem[]>>((acc, cat) => {
    acc[cat] = filtered.filter(i => i.category === cat);
    return acc;
  }, {});

  const totalValue = filtered.reduce((s, i) => s + i.unitPrice * i.qty, 0);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Aged Inventory</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Summary banner */}
      <View style={styles.banner}>
        <View style={styles.bannerLeft}>
          <Ionicons name="time-outline" size={28} color="#D97706" />
          <View>
            <Text style={styles.bannerVal}>₹{totalValue.toLocaleString('en-IN')}</Text>
            <Text style={styles.bannerLabel}>Total aged stock value</Text>
          </View>
        </View>
        <View style={styles.bannerRight}>
          <Text style={styles.bannerCount}>{filtered.length}</Text>
          <Text style={styles.bannerLabel}>SKUs affected</Text>
        </View>
      </View>

      {/* Age-band filter chips */}
      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {activeTab === 'By Age' && byAge.map(item => (
          <AgeCard key={item.id} item={item} />
        ))}

        {activeTab === 'By Value' && byValue.map((item, idx) => (
          <ValueCard key={item.id} item={item} rank={idx + 1} />
        ))}

        {activeTab === 'By Category' && cats.map(cat => (
          <CategoryGroup key={cat} cat={cat} items={grouped[cat]} />
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: {
    flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700',
    color: COLORS.textPrimary, textAlign: 'center',
  },

  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1, borderBottomColor: '#FDE68A',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
  },
  bannerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerRight: { alignItems: 'flex-end' },
  bannerVal:   { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: '#D97706' },
  bannerCount: { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: COLORS.textPrimary },
  bannerLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },

  filterRow: {
    flexDirection: 'row', paddingHorizontal: SPACING.md, paddingVertical: 10,
    gap: 6, backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  filterChip:       {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  filterChipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  filterText:       { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  filterTextActive: { color: COLORS.white },

  tabBar:      {
    flexDirection: 'row', backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  tabItem:     {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive:{ borderBottomColor: COLORS.brandPrimary },
  tabText:     { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textTertiary },
  tabTextActive:{ color: COLORS.textPrimary },

  scroll:  { flex: 1 },
  content: { padding: SPACING.md, gap: 10 },

  // Shared card
  itemCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  itemTop:  {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 10,
  },
  itemInfo: { flex: 1, marginRight: 8 },
  itemName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  ageBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  ageText:  { fontSize: 11, fontWeight: '700' },

  // By-Age specifics
  itemStats:  { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  statCell:   { width: '50%' },
  statLabel:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  statVal:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary, marginTop: 2 },

  // By-Value specifics
  rankCircle:   {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.activeBg,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  rankText:     { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  valueSide:    { alignItems: 'flex-end' },
  totalValueTxt:{ fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  perUnitTxt:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 1 },
  valueBarRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  valueBarTrack:{ flex: 1, height: 6, backgroundColor: COLORS.borderDefault, borderRadius: 3, overflow: 'hidden' },
  valueBarFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.brandPrimary },

  // By-Category specifics
  catGroup:  {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden',
  },
  catHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: SPACING.md,
  },
  catHeaderL:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  catHeaderR:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  catName:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  catBadge:  {
    backgroundColor: COLORS.activeBg,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
  },
  catBadgeTxt:{ fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  catTotal:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  catMaxAge: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  catRow:    {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  catRowL:      { flex: 1, marginRight: 8 },
  catRowR:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catItemName:  { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  catItemMeta:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 1 },
  catItemVal:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
});
