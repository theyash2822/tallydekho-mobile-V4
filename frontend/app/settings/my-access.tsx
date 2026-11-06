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
import { ScreenHeader } from '../../src/components/ScreenHeader';
import ShimmerPlaceholder from '../../src/components/ShimmerPlaceholder';
import {
  InfoRow, ListRow, SettingsCard, StatusPill, type IconName, type Tone,
} from '../../src/components/settings/SettingsKit';
import {
  buildMyAccessView, SCOPE_CHIP_LIMIT, type CompanyRef, type ScopeRow, type SensitiveLevel,
} from '../../src/utils/myAccess';

const MODULE_ICON: Record<string, IconName> = {
  'dashboard.view': 'grid-outline',
  'sales.view': 'trending-up-outline',
  'purchase.view': 'cart-outline',
  'vouchers.view': 'document-text-outline',
  'inventory.view': 'cube-outline',
  'expenses.view': 'wallet-outline',
  'financials.view': 'bar-chart-outline',
  'compliance.view': 'shield-checkmark-outline',
  'ledgers.view': 'book-outline',
  'audit_trail.view': 'time-outline',
  'ai_insights.view': 'sparkles-outline',
};

const SENSITIVE_TONE: Record<SensitiveLevel, Tone> = {
  visible: 'positive',
  masked: 'warning',
  hidden: 'neutral',
  default: 'neutral',
};

const NO_COMPANIES: CompanyRef[] = [];
const CHIP_SHIMMER_WIDTHS = [88, 120, 72];
const CHIP_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/** Names listed in a data scope; an entry known only by its id shows a placeholder, never the id. */
function ScopeChips({ row, loading }: { row: ScopeRow; loading: boolean }) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  if (loading) {
    return (
      <View style={s.chipRow} testID={`my-access-scope-${row.key}-loading`}>
        {CHIP_SHIMMER_WIDTHS.map((width) => (
          <ShimmerPlaceholder key={width} width={width} height={26} borderRadius={RADIUS.full} />
        ))}
      </View>
    );
  }
  const named = row.chips.filter((c) => c.named);
  const unnamed = row.chips.length - named.length;
  const shown = showAll ? named : named.slice(0, SCOPE_CHIP_LIMIT);
  return (
    <>
      <View style={s.chipRow}>
        {shown.map((c, i) => (
          <View key={`${row.key}-${i}`} style={s.chip}>
            <Text style={s.chipTxt} numberOfLines={1}>{c.text}</Text>
          </View>
        ))}
        {unnamed > 0 ? (
          <View style={[s.chip, s.chipMuted]}>
            <Text style={[s.chipTxt, s.chipTxtMuted]} numberOfLines={1}>
              {unnamed === 1
                ? t('screens.settingsMyAccess.nameUnavailable', 'Name unavailable')
                : t('screens.settingsMyAccess.namesUnavailable', { number: unnamed, defaultValue: '{{number}} names unavailable' })}
            </Text>
          </View>
        ) : null}
      </View>
      {named.length > SCOPE_CHIP_LIMIT ? (
        <TouchableOpacity
          style={s.showAll}
          onPress={() => setShowAll((v) => !v)}
          activeOpacity={0.7}
          hitSlop={CHIP_HIT_SLOP}
          accessibilityRole="button"
          testID={`my-access-scope-${row.key}-toggle`}
        >
          <Text style={s.showAllTxt}>
            {showAll
              ? t('screens.settingsMyAccess.showLess', 'Show less')
              : t('screens.settingsMyAccess.showAll', { total: named.length, defaultValue: 'Show all ({{total}})' })}
          </Text>
          <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textPrimary} />
        </TouchableOpacity>
      ) : null}
    </>
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
  const [companyList, setCompanyList] = useState<{ workspaceId: string | null; list: CompanyRef[] } | null>(null);
  useEffect(() => {
    if (!needsCompanyNames) return;
    let cancelled = false;
    getCompanies()
      .then((res: any) => {
        if (!cancelled) setCompanyList({ workspaceId, list: Array.isArray(res?.data) ? res.data : [] });
      })
      .catch(() => {
        if (!cancelled) setCompanyList({ workspaceId, list: [] });
      });
    return () => { cancelled = true; };
  }, [needsCompanyNames, workspaceId]);
  const companiesLoaded = companyList?.workspaceId === workspaceId;
  const companies = companiesLoaded && companyList ? companyList.list : NO_COMPANIES;
  const companiesLoading = needsCompanyNames && !companiesLoaded;

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

  // Workspace name and role lead the summary card, so their sections list the rest.
  const workspaceName = view.workspace.find((r) => r.key === 'name')?.value || '—';
  const role = view.role.find((r) => r.key === 'role')?.value;
  const workspaceRows = view.workspace.filter((r) => r.key !== 'name');
  const roleRows = view.role.filter((r) => r.key !== 'role');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader title={t('screens.settingsMyAccess.title')} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <SettingsCard testID="my-access-summary">
          <View style={s.summaryTop}>
            <View style={s.summaryIcon}>
              <Ionicons
                name={isOwner ? 'key-outline' : isOwnerOrAdmin ? 'shield-checkmark-outline' : 'person-outline'}
                size={22}
                color={COLORS.textPrimary}
              />
            </View>
            <View style={s.summaryMain}>
              <Text style={s.summaryLabel}>{t('screens.settingsMyAccess.workspace')}</Text>
              <Text style={s.summaryName} numberOfLines={2}>{workspaceName}</Text>
            </View>
            {role ? <StatusPill label={role} tone="info" /> : null}
          </View>
          <Text style={s.summaryHint}>{view.roleHint}</Text>
        </SettingsCard>

        <SettingsCard title={t('screens.settingsMyAccess.workspace')}>
          {workspaceRows.map((r, i) => (
            <InfoRow key={r.key} label={r.label} value={r.value} last={i === workspaceRows.length - 1} />
          ))}
        </SettingsCard>

        {roleRows.length > 0 ? (
          <SettingsCard title={t('screens.settingsMyAccess.yourRole')}>
            {roleRows.map((r, i) => (
              <InfoRow key={r.key} label={r.label} value={r.value} last={i === roleRows.length - 1} />
            ))}
          </SettingsCard>
        ) : null}

        <SettingsCard title={t('screens.settingsMyAccess.modulesTitle')}>
          {view.modules.map((m, i) => (
            <ListRow
              key={m.cap}
              testID={`my-access-module-${m.cap}`}
              icon={MODULE_ICON[m.cap] || 'apps-outline'}
              title={m.label}
              dimmed={!m.open}
              last={i === view.modules.length - 1}
              right={m.open
                ? <StatusPill label={t('screens.settingsMyAccess.moduleOpen', 'Open')} tone="positive" />
                : <StatusPill label={t('screens.settingsMyAccess.moduleLocked', 'Locked')} icon="lock-closed-outline" />}
            />
          ))}
        </SettingsCard>

        <SettingsCard title={t('screens.settingsMyAccess.dataScope')}>
          {view.scopes.map((b, i) => {
            const last = i === view.scopes.length - 1;
            if (b.value) return <InfoRow key={b.key} label={b.label} value={b.value} last={last} />;
            return (
              <InfoRow key={b.key} label={b.label} last={last}>
                <ScopeChips row={b} loading={b.key === 'companies' && companiesLoading} />
              </InfoRow>
            );
          })}
        </SettingsCard>

        <SettingsCard title={t('screens.settingsMyAccess.sensitivePolicy')}>
          {view.sensitive.map((p, i) => {
            const last = i === view.sensitive.length - 1;
            if (p.level === 'default') return <InfoRow key={p.key} label={p.label} value={p.value} last={last} />;
            return (
              <ListRow
                key={p.key}
                title={p.label}
                last={last}
                right={<StatusPill label={p.value} tone={SENSITIVE_TONE[p.level]} />}
              />
            );
          })}
          <Text style={s.hint}>{view.sensitiveHint}</Text>
        </SettingsCard>

        <Text style={s.footnote}>{view.footnote}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryIcon: {
    width: 44, height: 44, borderRadius: RADIUS.full, backgroundColor: COLORS.activeBg,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryMain: { flex: 1 },
  summaryLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginBottom: 2 },
  summaryName: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  summaryHint: {
    fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 19,
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.xs },
  chip: {
    maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg,
  },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  chipMuted: { borderStyle: 'dashed', borderColor: COLORS.borderStrong, backgroundColor: COLORS.cardBg },
  chipTxtMuted: { fontWeight: '500', color: COLORS.textTertiary },
  showAll: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, alignSelf: 'flex-start', marginTop: 10 },
  showAllTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  hint: { marginTop: SPACING.sm, fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, lineHeight: 16 },
  footnote: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, lineHeight: 16, paddingHorizontal: SPACING.xs },
});
