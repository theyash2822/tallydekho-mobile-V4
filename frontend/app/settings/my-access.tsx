/**
 * My Access — read-only summary of role, modules, data scope and sensitive-data policy for the current
 * Workspace, with the same information as the web portal. Mobile can view; roles and scopes are changed
 * on the Web Portal.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { useAuth } from '../../src/context/AuthContext';
import { getCompanies } from '../../src/services/api';
import { buildMyAccessView, type CompanyRef } from '../../src/utils/myAccess';

function Chip({ label }: { label: string }) {
  return (
    <View style={s.chip}>
      <Text style={s.chipTxt} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

export default function MyAccessScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { company } = useAuth();
  const {
    workspaceId,
    workspace,
    access,
    entryMode,
    pairingStatus,
    demoMode,
    isOwner,
    isOwnerOrAdmin,
    sensitivePolicies,
    hasCapability,
  } = useWorkspace();

  // The company scope holds GUIDs; the company list (the same one the company switcher uses) names them.
  const scopedCompanies = access?.scopes?.companies;
  const needsCompanyNames = !isOwner && Array.isArray(scopedCompanies) && scopedCompanies.length > 0;
  const [companies, setCompanies] = useState<CompanyRef[]>([]);
  useEffect(() => {
    if (!needsCompanyNames) return;
    let cancelled = false;
    getCompanies()
      .then((res: any) => {
        if (!cancelled && Array.isArray(res?.data)) setCompanies(res.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [needsCompanyNames, workspaceId]);

  const view = useMemo(() => buildMyAccessView({
    isOwner,
    isOwnerOrAdmin,
    workspaceName: workspace?.name,
    companyName: company?.name,
    pairingStatus,
    demoMode,
    membershipStatus: access?.membershipStatus || workspace?.membershipStatus,
    roleDisplayName: access?.role?.displayName,
    entryMode,
    can: hasCapability,
    scopes: access?.scopes,
    companies: company ? [company, ...companies] : companies,
    sensitivePolicies,
  }, t), [
    isOwner, isOwnerOrAdmin, workspace, company, pairingStatus, demoMode, access, entryMode,
    hasCapability, companies, sensitivePolicies, t,
  ]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('screens.settingsMyAccess.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Section title={t('screens.settingsMyAccess.workspace')}>
          {view.workspace.map((r) => <Row key={r.key} label={r.label} value={r.value} />)}
        </Section>

        <Section title={t('screens.settingsMyAccess.yourRole')}>
          {view.role.map((r) => <Row key={r.key} label={r.label} value={r.value} />)}
          <Text style={s.hint}>{view.roleHint}</Text>
        </Section>

        <Section title={t('screens.settingsMyAccess.modulesTitle')}>
          <View style={s.moduleGrid}>
            {view.modules.map((m) => (
              <View key={m.cap} style={s.moduleItem} testID={`my-access-module-${m.cap}`}>
                <View style={s.moduleIcon}>
                  {m.open
                    ? <Ionicons name="checkmark" size={16} color={COLORS.positive} />
                    : <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />}
                </View>
                <Text style={[s.moduleLabel, !m.open && s.moduleLabelLocked]} numberOfLines={1}>{m.label}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title={t('screens.settingsMyAccess.dataScope')}>
          {view.scopes.map((b) => (b.value ? (
            <Row key={b.key} label={b.label} value={b.value} />
          ) : (
            <View key={b.key} style={s.scopeBlock}>
              <Text style={s.scopeLabel}>{b.label}</Text>
              <View style={s.chipRow}>
                {b.names.map((name, i) => <Chip key={`${b.key}-${i}`} label={name} />)}
                {b.more ? <Chip label={b.more} /> : null}
              </View>
            </View>
          )))}
        </Section>

        <Section title={t('screens.settingsMyAccess.sensitivePolicy')}>
          {view.sensitive.map((p) => <Row key={p.key} label={p.label} value={p.value} />)}
          <Text style={s.hint}>{view.sensitiveHint}</Text>
        </Section>

        <Text style={s.footnote}>{view.footnote}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  content: { padding: SPACING.md, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary,
    marginBottom: 10, letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 12, paddingVertical: 6,
  },
  rowLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, flex: 1 },
  rowValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary, flex: 1.2, textAlign: 'right' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg, maxWidth: '100%',
  },
  chipTxt: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  hint: { marginTop: 10, fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, lineHeight: 16 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  moduleItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingRight: 8 },
  moduleIcon: { width: 16, alignItems: 'center' },
  moduleLabel: { flexShrink: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  moduleLabelLocked: { fontWeight: '500', color: COLORS.textTertiary },
  scopeBlock: { paddingVertical: 6 },
  scopeLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  footnote: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, lineHeight: 16, paddingHorizontal: 4 },
});
