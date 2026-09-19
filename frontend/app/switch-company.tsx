/**
 * Switch Company — full screen (NO RN Modal).
 * Avoids Android freeze from Modal under @gorhom/bottom-sheet.
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
import { getCompanies } from '../src/services/api';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../src/constants/colors';
import { filterCompaniesForPairing } from '../src/utils/isDemoCompany';
import { toAuthCompany, companyExternalId } from '../src/utils/companyIdentity';

function companyGuid(c: any): string {
  return companyExternalId(c);
}

export default function SwitchCompanyScreen() {
  const router = useRouter();
  const { company, setCompany } = useAuth();
  const { pairingStatus, filterScoped, demoMode } = useWorkspace();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Demo Mode: nothing to switch — leave this screen
    if (demoMode) {
      router.back();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res: any = await getCompanies();
        const list = Array.isArray(res?.data) ? res.data : [];
        const paired = filterCompaniesForPairing(list, pairingStatus);
        const live = String(pairingStatus || '').toUpperCase() === 'CONNECTED'
          || String(pairingStatus || '').toUpperCase() === 'RECONNECTING';
        const cos = live ? filterScoped(paired, 'companies') : paired;
        if (!cancelled) setRows(cos);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pairingStatus, filterScoped, demoMode, router]);

  const onSelect = useCallback(async (co: any) => {
    if (busy) return;
    const guid = companyGuid(co);
    if (!guid) return;
    if (guid === companyGuid(company)) {
      router.back();
      return;
    }
    if (demoMode) {
      router.back();
      return;
    }
    setBusy(true);
    try {
      await setCompany(toAuthCompany({ ...co, guid }) || { guid, name: co.name, gstin: co.gstin || null });
      router.back();
    } catch {
      setBusy(false);
    }
  }, [busy, company, demoMode, router, setCompany]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Switch Company</Text>
        <View style={{ width: 36 }} />
      </View>

      {demoMode ? null : loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.brandPrimary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => companyGuid(item) || item.name}
          contentContainerStyle={{ padding: SPACING.md }}
          ListEmptyComponent={
            <Text style={styles.empty}>No companies available</Text>
          }
          renderItem={({ item }) => {
            const active = companyGuid(item) === companyGuid(company);
            return (
              <TouchableOpacity
                style={[styles.row, active && styles.rowActive]}
                onPress={() => onSelect(item)}
                disabled={busy}
                activeOpacity={0.7}
              >
                <View style={[styles.avatar, active && styles.avatarActive]}>
                  <Text style={[styles.avatarText, active && { color: COLORS.white }]}>
                    {item.name?.[0] || '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, active && styles.nameActive]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {!!item.gstin && (
                    <Text style={styles.sub} numberOfLines={1}>{item.gstin}</Text>
                  )}
                </View>
                {active && <Ionicons name="checkmark-circle" size={20} color={COLORS.brandPrimary} />}
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
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  rowActive: { backgroundColor: COLORS.activeBg, borderColor: COLORS.borderStrong },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center',
  },
  avatarActive: { backgroundColor: COLORS.brandPrimary },
  avatarText: { fontWeight: '700', color: COLORS.textPrimary },
  name: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  nameActive: { fontWeight: '700' },
  sub: { fontSize: 11, color: COLORS.textTertiary, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, color: COLORS.textTertiary },
});
