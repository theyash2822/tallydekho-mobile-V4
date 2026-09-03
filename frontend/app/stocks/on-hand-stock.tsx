import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import SearchBar from '../../src/components/SearchBar';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { EntityListTile } from '../../src/components/EntityListTile';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { getStocks } from '../../src/services/api';
import { useTranslation } from 'react-i18next';

const STOCK_ICON_BG = '#E8E7E1';

function OnHandCard({
  item, onPress,
}: {
  item: any; onPress: () => void;
}) {
  return (
    <EntityListTile
      name={item.displayName || item.name}
      subtitle={`${item.sku} · ${item.category}`}
      onPress={onPress}
      avatar={<Ionicons name="cube-outline" size={20} color={COLORS.textPrimary} />}
      avatarBgColor={STOCK_ICON_BG}
      avatarRadius={RADIUS.md}
      trailing={(
        <View style={sc.right}>
          <Text style={sc.value}>{item.value}</Text>
          <View style={[sc.qtyBadge, item.qty <= 10 && sc.qtyLow]}>
            <Text style={[sc.qtyTxt, item.qty <= 10 && sc.qtyLowTxt]}>{item.qty} units</Text>
          </View>
        </View>
      )}
    />
  );
}

const sc = StyleSheet.create({
  right:    { alignItems: 'flex-end', gap: 4 },
  value:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  qtyBadge: { backgroundColor: COLORS.pageBg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: COLORS.borderDefault },
  qtyLow:   { backgroundColor: COLORS.negativeBg, borderColor: COLORS.negative + '40' },
  qtyTxt:   { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },
  qtyLowTxt:{ color: COLORS.negative },
});

export default function OnHandStockScreen() {
  const { t } = useTranslation();
  const { selectedFY, company, lastSyncAt } = useAuth();
  const companyGuid = company?.guid;
  const router = useRouter();
  const { formatAmount } = useSettings();

  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [calOpen, setCalOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(() => {
    if (!companyGuid) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setApiError(null);
    getStocks(companyGuid, { limit: '1000' })
      .then((res: any) => {
        const raw = res?.data?.items ?? [];
        const mapped = raw
          .filter((r: any) => +(r.closing_qty || 0) > 0)
          .map((r: any) => ({
            id: r.guid || String(r.id),
            name: r.displayName || r.name || '',
            displayName: r.displayName || r.name || '',
            sku: r.sku || r.alias || r.hsn || '—',
            category: r.category || r.group_name || 'Other',
            qty: +(r.closing_qty || 0),
            value: r.closing_value
              ? formatAmount(Math.round(+r.closing_value))
              : formatAmount(0),
          }));
        setItems(mapped);
      })
      .catch((e: any) => setApiError(e?.message || 'Failed to load stock'))
      .finally(() => setIsLoading(false));
  }, [companyGuid, formatAmount]);

  useEffect(() => { load(); }, [load, lastSyncAt]);

  const filtered = items.filter(
    (i: any) =>
      (i.name || '').toLowerCase().includes(query.toLowerCase()) ||
      (i.sku || '').toLowerCase().includes(query.toLowerCase()),
  );

  const totalQty = items.reduce((s: number, i: any) => s + (i.qty || 0), 0);
  const lowStock = items.filter((i: any) => (i.qty || 0) <= 10).length;
  const dateLabel = dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : 'All Time';

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title={t('stocks.onHand')}
        onBack={() => router.back()}
        right={(
          <TouchableOpacity style={styles.calBtn} onPress={() => setCalOpen(true)} activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={20} color={COLORS.brandPrimary} />
          </TouchableOpacity>
        )}
      />

      {apiError && <ErrorBanner message={apiError} onRetry={load} />}

      {(dateFrom || dateTo) && (
        <View style={styles.dateBar}>
          <Ionicons name="calendar-outline" size={13} color={'#A89060'} />
          <Text style={styles.dateBarTxt}>{dateLabel}</Text>
          <TouchableOpacity onPress={() => { setDateFrom(''); setDateTo(''); }}>
            <Ionicons name="close-circle" size={15} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.summaryRow}>
        {[
          { label: 'No. of SKUs', value: `${items.length}` },
          { label: 'Quantity', value: totalQty.toLocaleString('en-IN') },
          { label: 'Low Stock', value: `${lowStock}`, warn: lowStock > 0 },
        ].map((s, i) => (
          <View key={i} style={styles.summaryItem}>
            <Text style={[styles.summaryVal, s.warn && { color: COLORS.negative }]}>{s.value}</Text>
            <Text style={styles.summaryLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <SearchBar value={query} onChangeText={setQuery} placeholder="Search items..." />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>{filtered.length} items</Text>
        {isLoading && (
          <>
            <LedgerRowSkeleton />
            <LedgerRowSkeleton />
            <LedgerRowSkeleton />
          </>
        )}
        {!isLoading && filtered.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={32} color={COLORS.textTertiary} />
            <Text style={styles.emptyTxt}>No on-hand stock found</Text>
          </View>
        )}
        {!isLoading && filtered.map(item => (
          <OnHandCard
            key={item.id}
            item={item}
            onPress={() => router.push(`/stocks/item-detail?id=${item.id}` as any)}
          />
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>

      <DateRangePickerModal
        visible={calOpen}
        fromDate={dateFrom}
        toDate={dateTo}
        onClose={() => setCalOpen(false)}
        onApply={(from, to) => { setDateFrom(from); setDateTo(to); }}
        minDate={selectedFY?.startDate}
        maxDate={selectedFY?.endDate}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  calBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dateBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FBF7EE', paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#F0E8D5',
  },
  dateBarTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: '#A89060' },
  summaryRow:  {
    flexDirection: 'row', backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, paddingVertical: 12,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal:  { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  summaryLabel:{ fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  scroll:  { flex: 1 },
  content: { padding: SPACING.md, gap: 8 },
  sectionLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textTertiary, marginBottom: 4 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
});
