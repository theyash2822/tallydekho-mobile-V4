/**
 * Switch FY — full screen (NO RN Modal).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useWorkspace } from '../src/context/WorkspaceContext';
import { getCompanyYears } from '../src/services/api';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../src/constants/colors';

type FyObj = { label: string; startDate: string; endDate: string; finYear?: string };

export default function SwitchFyScreen() {
  const router = useRouter();
  const { company, selectedFY, setSelectedFY } = useAuth();
  const { pairingStatus, filterScoped, demoMode } = useWorkspace();
  const [rows, setRows] = useState<FyObj[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!company?.guid) {
        setLoading(false);
        return;
      }
      try {
        const res: any = await getCompanyYears(company.guid);
        const mapped: FyObj[] = (res?.data ?? []).map((r: any) => ({
          label: r.label,
          startDate: r.begin_date,
          endDate: r.end_date,
          finYear: r.fin_year,
        }));
        const fyObjs = (demoMode || String(pairingStatus).toUpperCase() !== 'CONNECTED')
          ? mapped
          : (filterScoped(mapped, 'fys') as FyObj[]);
        if (!cancelled) setRows(fyObjs);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [company?.guid, demoMode, pairingStatus, filterScoped]);

  const onSelect = useCallback(async (fy: FyObj) => {
    await setSelectedFY(fy);
    router.back();
  }, [router, setSelectedFY]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Financial Year</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.brandPrimary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.startDate || item.label}
          contentContainerStyle={{ padding: SPACING.md }}
          ListEmptyComponent={
            <Text style={styles.empty}>No financial years found</Text>
          }
          renderItem={({ item }) => {
            const active = selectedFY?.startDate === item.startDate || selectedFY?.label === item.label;
            return (
              <TouchableOpacity
                style={[styles.row, active && styles.rowActive]}
                onPress={() => onSelect(item)}
                activeOpacity={0.7}
              >
                <Text style={[styles.name, active && styles.nameActive]}>{item.label}</Text>
                {active && <Ionicons name="checkmark" size={18} color={COLORS.brandPrimary} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  rowActive: { backgroundColor: COLORS.activeBg, borderColor: COLORS.borderStrong },
  name: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  nameActive: { fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 40, color: COLORS.textTertiary },
});
