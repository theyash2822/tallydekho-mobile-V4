import React, { useState, useEffect } from 'react';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

import { useAuth } from '../../src/context/AuthContext';
import { getEWBList, getCompanyCapabilities } from '../../src/services/api';

const EWB_COLORS: Record<string, string> = {
  generated: COLORS.positive,
  pending:   COLORS.warning,
  cancelled: COLORS.negative,
};

export default function EWayBillScreen() {
  const router = useRouter();
  const { company } = useAuth();
  const companyGuid = company?.guid;
  const [search, setSearch] = useState('');
  const [liveBills, setLiveBills] = useState<any[]>([]);
  const [countryApplicable, setCountryApplicable] = useState(true);
  const [notApplicableMsg, setNotApplicableMsg] = useState('');

  useEffect(() => {
    if (!companyGuid) return;
    getEWBList(companyGuid).then((res: any) => {
      if (res?.meta?.country_applicable === false) {
        setCountryApplicable(false);
        setNotApplicableMsg(res.meta.message || 'E-Way Bill not applicable for your country');
        return;
      }
      const rows = res?.data ?? [];
      setLiveBills(rows.map((r: any) => ({
        id: r.voucher_number || String(r.id),
        company: r.party_name || '',
        date: r.date || '',
        amount: `₹${Math.abs(+r.amount||0).toLocaleString('en-IN')}`,
        status: r.ewb_number ? 'generated' : 'pending',
        ewb_no: r.ewb_number || null,
      })));
    }).catch((err: any) => console.error('[API Error]', err?.message));
  }, [companyGuid]);

  const data = MOCK_EWAYBILLS;
  const allBills = liveBills.length > 0 ? liveBills : data.bills;

  const filtered = allBills.filter(
    (b: any) =>
      !search ||
      (b.company||'').toLowerCase().includes(search.toLowerCase()) ||
      b.id.toLowerCase().includes(search.toLowerCase()),
  );

  if (!countryApplicable) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
          <Text style={styles.headerTitle}>E-Way Bill</Text><View style={{width:36}} />
        </View>
        <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:24}}>
          <Ionicons name="information-circle-outline" size={48} color={COLORS.textTertiary} />
          <Text style={{fontSize:16,fontWeight:'700',color:COLORS.textPrimary,marginTop:12,textAlign:'center'}}>Not Applicable</Text>
          <Text style={{fontSize:14,color:COLORS.textSecondary,marginTop:8,textAlign:'center'}}>{notApplicableMsg}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ───────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>E-Way Bill</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Content ──────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 90 }}
      >
        {/* Filters */}
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.dropdown}>
            <Text style={styles.dropdownText}>FY 2025-26</Text>
            <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdown}>
            <Text style={styles.dropdownText}>All</Text>
            <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by company or EWB number..."
            placeholderTextColor={COLORS.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryCount, { color: COLORS.warning }]}>{data.pending}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryCount, { color: COLORS.negative }]}>{data.cancelled}</Text>
            <Text style={styles.summaryLabel}>Cancelled</Text>
          </View>
        </View>

        {/* Generated CTA */}
        <TouchableOpacity style={styles.generatedBtn} activeOpacity={0.85}>
          <View style={styles.genLeft}>
            <View style={styles.genIconBox}>
              <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} />
            </View>
            <Text style={styles.generatedBtnText}>Generated {data.generated}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
        </TouchableOpacity>

        {/* Bill List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent E-Way Bills</Text>
          <Text style={styles.sectionCount}>{filtered.length} bills</Text>
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={32} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No E-Way Bills found</Text>
          </View>
        ) : (
          <View style={styles.billContainer}>
            {filtered.map((bill, idx) => (
              <View key={bill.id}>
                <TouchableOpacity style={styles.billRow} activeOpacity={0.7}>
                  {/* Icon */}
                  <View
                    style={[
                      styles.billIconBox,
                      { backgroundColor: (EWB_COLORS[bill.status] || '#9CA3AF') + '18' },
                    ]}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color={EWB_COLORS[bill.status] || '#9CA3AF'}
                    />
                  </View>

                  {/* Info */}
                  <View style={styles.billInfo}>
                    <Text style={styles.billCompany} numberOfLines={1}>
                      {bill.company}
                    </Text>
                    <View style={styles.billMeta}>
                      <View
                        style={[
                          styles.billDot,
                          { backgroundColor: EWB_COLORS[bill.status] || '#9CA3AF' },
                        ]}
                      />
                      <Text style={styles.billMetaText}>
                        {bill.generatedAt} ·{' '}
                        {bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
                      </Text>
                    </View>
                  </View>

                  {/* Date + ID */}
                  <View style={styles.billRight}>
                    <Text style={styles.billDate}>{bill.date}</Text>
                    <Text style={styles.billId}>{bill.id}</Text>
                  </View>
                </TouchableOpacity>

                {/* Actions (Cancel + Extend Validity) */}
                {bill.status === 'generated' && (
                  <View style={styles.billActions}>
                    <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
                      <Ionicons name="close-circle-outline" size={14} color={COLORS.negative} />
                      <Text style={[styles.actionText, { color: COLORS.negative }]}>Cancel</Text>
                    </TouchableOpacity>
                    <View style={styles.actionDivider} />
                    <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
                      <Ionicons name="calendar-outline" size={14} color={COLORS.info} />
                      <Text style={[styles.actionText, { color: COLORS.info }]}>Extend Validity</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {idx < filtered.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Sticky Bottom Share Bar ───────────────────────────── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.shareRowBtn} activeOpacity={0.85}>
          <Ionicons name="share-outline" size={20} color={COLORS.white} />
          <Text style={styles.shareBtnText}>Share</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700',
    color: COLORS.textPrimary, textAlign: 'center',
  },

  scroll: { flex: 1 },

  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md,
  },
  dropdown: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    paddingHorizontal: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.borderDefault, flex: 1,
  },
  dropdownText: { flex: 1, fontSize: 12, color: COLORS.textSecondary },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    marginHorizontal: SPACING.md, marginTop: SPACING.sm,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },

  summaryRow:   { flexDirection: 'row', gap: 8, marginHorizontal: SPACING.md, marginTop: SPACING.md },
  summaryCard: {
    flex: 1, backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  summaryCount: { fontSize: TYPOGRAPHY.xxl, fontWeight: '700', color: COLORS.textPrimary },
  summaryLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginTop: 4 },

  generatedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.positive,
    marginHorizontal: SPACING.md, marginTop: SPACING.sm,
    borderRadius: RADIUS.md, paddingHorizontal: 20, paddingVertical: 16,
  },
  genLeft:          { flexDirection: 'row', alignItems: 'center', gap: 12 },
  genIconBox: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  generatedBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: SPACING.sm,
  },
  sectionTitle:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  sectionCount:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },

  billContainer: {
    backgroundColor: COLORS.cardBg,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  billRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    gap: 12,
  },
  billIconBox: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  billInfo:      { flex: 1 },
  billCompany: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '600',
    color: COLORS.textPrimary, marginBottom: 4,
  },
  billMeta:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  billDot:       { width: 6, height: 6, borderRadius: 3 },
  billMetaText:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  billRight:     { alignItems: 'flex-end' },
  billDate:      { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  billId:        { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },

  billActions: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingBottom: 12,
    gap: 0,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  actionDivider: { width: 8 },
  actionText:    { fontSize: TYPOGRAPHY.xs, fontWeight: '500' },

  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 16 },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },

  bottomBar: {
    backgroundColor: COLORS.positive,
    paddingVertical: 16, paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  shareRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shareBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
