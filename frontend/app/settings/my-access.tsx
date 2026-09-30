/**
 * My Access — read-only role / capability / scope summary for current Workspace.
 * Mobile can view; cannot edit roles or scopes (Web Portal).
 */
import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { useAuth } from '../../src/context/AuthContext';

const ENTRY_LABEL_KEY: Record<string, string> = {
  BOTH: 'screens.settingsMyAccess.entryBoth',
  REGULAR_ONLY: 'screens.settingsMyAccess.entryRegularOnly',
  OPTIONAL_ONLY: 'screens.settingsMyAccess.entryOptionalOnly',
};

function Chip({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'ok' | 'warn' }) {
  const bg =
    tone === 'ok' ? COLORS.positiveBg :
    tone === 'warn' ? COLORS.warningBg :
    COLORS.pageBg;
  const fg =
    tone === 'ok' ? COLORS.positive :
    tone === 'warn' ? COLORS.warning :
    COLORS.textSecondary;
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={[s.chipTxt, { color: fg }]} numberOfLines={1}>{label}</Text>
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
    workspace,
    access,
    entryMode,
    pairingStatus,
    demoMode,
    isOwnerOrAdmin,
    capabilities,
    scopes,
    sensitivePolicies,
    hasCapability,
  } = useWorkspace();

  const roleLabel =
    access?.membershipType === 'OWNER'
      ? t('screens.settingsMyAccess.owner')
      : access?.role?.displayName || access?.role?.systemKey || t('screens.settingsMyAccess.member');

  const membershipStatus = access?.membershipStatus || workspace?.membershipStatus || 'ACTIVE';

  const capList = useMemo(() => {
    const arr = Array.from(capabilities || []).map(String).sort();
    if (access?.membershipType === 'OWNER' && arr.length === 0) {
      return [t('screens.settingsMyAccess.allCapabilities')];
    }
    return arr;
  }, [capabilities, access?.membershipType, t]);

  const scopeBlocks = useMemo(() => {
    const blocks: { id: string; title: string; items: string[]; open: boolean }[] = [
      { id: 'companies', title: t('screens.settingsMyAccess.scopeCompanies'), items: scopes.companies || [], open: !(scopes.companies?.length) },
      { id: 'financialYears', title: t('screens.settingsMyAccess.scopeFinancialYears'), items: scopes.financialYears || [], open: !(scopes.financialYears?.length) },
      { id: 'ledgers', title: t('screens.settingsMyAccess.scopeLedgers'), items: scopes.ledgers || [], open: !(scopes.ledgers?.length) },
      { id: 'godowns', title: t('screens.settingsMyAccess.scopeGodowns'), items: scopes.godowns || [], open: !(scopes.godowns?.length) },
      { id: 'costCentres', title: t('screens.settingsMyAccess.scopeCostCentres'), items: scopes.costCentres || [], open: !(scopes.costCentres?.length) },
    ];
    return blocks;
  }, [scopes, t]);

  const policyRows = useMemo(() => {
    const keys = Object.keys(sensitivePolicies || {});
    if (!keys.length) {
      return isOwnerOrAdmin
        ? [{ key: 'default', label: t('screens.settingsMyAccess.sensitiveFields'), value: t('screens.settingsMyAccess.visibleDefault') }]
        : [{ key: 'default', label: t('screens.settingsMyAccess.sensitiveFields'), value: t('screens.settingsMyAccess.followsRolePolicy') }];
    }
    return keys.sort().map((key) => {
      const raw = (sensitivePolicies as any)[key];
      const vis =
        raw === true || raw === 'VISIBLE' ? t('screens.settingsMyAccess.visible') :
        raw === 'MASKED' ? t('screens.settingsMyAccess.masked') :
        t('screens.settingsMyAccess.hidden');
      return { key, label: key.replace(/_/g, ' '), value: vis };
    });
  }, [sensitivePolicies, isOwnerOrAdmin, t]);

  const moduleChecks = [
    { label: t('nav.dashboard'), cap: 'dashboard.view' },
    { label: t('nav.sales'), cap: 'sales.view' },
    { label: t('nav.purchase'), cap: 'purchase.view' },
    { label: t('quickActions.inventory'), cap: 'inventory.view' },
    { label: t('screens.settingsMyAccess.financials'), cap: 'financials.view' },
    { label: t('screens.settingsMyAccess.pdfShare'), cap: 'document.pdf.generate' },
  ];

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
          <Row label={t('screens.settingsMyAccess.name')} value={workspace?.name || '—'} />
          <Row label={t('screens.settingsMyAccess.company')} value={company?.name || '—'} />
          <Row label={t('screens.settingsMyAccess.pairing')} value={pairingStatus || 'UNPAIRED'} />
          <View style={s.chipRow}>
            {demoMode ? <Chip label={t('screens.settingsMyAccess.demoMode')} tone="warn" /> : <Chip label={t('screens.settingsMyAccess.liveData')} tone="ok" />}
            <Chip label={membershipStatus} tone={membershipStatus === 'ACTIVE' ? 'ok' : 'warn'} />
          </View>
        </Section>

        <Section title={t('screens.settingsMyAccess.yourRole')}>
          <Row label={t('screens.settingsMyAccess.access')} value={roleLabel} />
          <Row label={t('screens.settingsMyAccess.entryMode')} value={ENTRY_LABEL_KEY[entryMode] ? t(ENTRY_LABEL_KEY[entryMode]) : entryMode || 'BOTH'} />
          {isOwnerOrAdmin ? (
            <Text style={s.hint}>{t('screens.settingsMyAccess.ownerHint')}</Text>
          ) : (
            <Text style={s.hint}>{t('screens.settingsMyAccess.memberHint')}</Text>
          )}
        </Section>

        <Section title={t('screens.settingsMyAccess.modulesTitle')}>
          <View style={s.chipRow}>
            {moduleChecks.map((m) => (
              <Chip
                key={m.cap}
                label={`${hasCapability(m.cap) ? '✓' : '✗'} ${m.label}`}
                tone={hasCapability(m.cap) ? 'ok' : 'neutral'}
              />
            ))}
          </View>
        </Section>

        <Section title={t('screens.settingsMyAccess.capabilitiesTitle')}>
          {capList.length === 0 ? (
            <Text style={s.empty}>{t('screens.settingsMyAccess.noCapabilities')}</Text>
          ) : (
            <View style={s.chipRow}>
              {capList.slice(0, 40).map((c) => (
                <Chip key={c} label={c} />
              ))}
              {capList.length > 40 ? <Chip label={t('screens.settingsMyAccess.moreCount', { count: capList.length - 40 })} /> : null}
            </View>
          )}
        </Section>

        <Section title={t('screens.settingsMyAccess.dataScope')}>
          {scopeBlocks.map((b) => (
            <View key={b.id} style={s.scopeBlock}>
              <Text style={s.scopeTitle}>{b.title}</Text>
              {b.open ? (
                <Text style={s.scopeOpen}>{t('screens.settingsMyAccess.unrestricted')}</Text>
              ) : (
                <View style={s.chipRow}>
                  {b.items.slice(0, 12).map((item) => (
                    <Chip key={item} label={item} />
                  ))}
                  {b.items.length > 12 ? <Chip label={t('screens.settingsMyAccess.moreCount', { count: b.items.length - 12 })} /> : null}
                </View>
              )}
            </View>
          ))}
        </Section>

        <Section title={t('screens.settingsMyAccess.sensitivePolicy')}>
          {policyRows.map((p) => (
            <Row key={p.key} label={p.label} value={p.value} />
          ))}
          <Text style={s.hint}>
            {t('screens.settingsMyAccess.policyHint')}
          </Text>
        </Section>

        <Text style={s.footnote}>
          {t('screens.settingsMyAccess.footnote')}
        </Text>
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
    borderWidth: 1, borderColor: COLORS.borderDefault, maxWidth: '100%',
  },
  chipTxt: { fontSize: 11, fontWeight: '700' },
  hint: { marginTop: 10, fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, lineHeight: 16 },
  empty: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  scopeBlock: { marginBottom: 12 },
  scopeTitle: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4, textTransform: 'uppercase' },
  scopeOpen: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '600' },
  footnote: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, lineHeight: 16, paddingHorizontal: 4 },
});
