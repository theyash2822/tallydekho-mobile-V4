/**
 * My Access — read-only role / capability / scope summary for current Workspace.
 * Mobile can view; cannot edit roles or scopes (Web Portal).
 */
import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { useAuth } from '../../src/context/AuthContext';

const ENTRY_LABEL: Record<string, string> = {
  BOTH: 'Regular + Optional',
  REGULAR_ONLY: 'Regular only',
  OPTIONAL_ONLY: 'Optional only',
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
      ? 'Owner'
      : access?.role?.displayName || access?.role?.systemKey || 'Member';

  const membershipStatus = access?.membershipStatus || workspace?.membershipStatus || 'ACTIVE';

  const capList = useMemo(() => {
    const arr = Array.from(capabilities || []).map(String).sort();
    if (access?.membershipType === 'OWNER' && arr.length === 0) {
      return ['All capabilities (Owner)'];
    }
    return arr;
  }, [capabilities, access?.membershipType]);

  const scopeBlocks = useMemo(() => {
    const blocks: { title: string; items: string[]; open: boolean }[] = [
      { title: 'Companies', items: scopes.companies || [], open: !(scopes.companies?.length) },
      { title: 'Financial years', items: scopes.financialYears || [], open: !(scopes.financialYears?.length) },
      { title: 'Ledgers / parties', items: scopes.ledgers || [], open: !(scopes.ledgers?.length) },
      { title: 'Godowns / warehouses', items: scopes.godowns || [], open: !(scopes.godowns?.length) },
      { title: 'Cost centres', items: scopes.costCentres || [], open: !(scopes.costCentres?.length) },
    ];
    return blocks;
  }, [scopes]);

  const policyRows = useMemo(() => {
    const keys = Object.keys(sensitivePolicies || {});
    if (!keys.length) {
      return isOwnerOrAdmin
        ? [{ key: 'default', label: 'Sensitive fields', value: 'Visible (Owner/Admin default)' }]
        : [{ key: 'default', label: 'Sensitive fields', value: 'Follows role policy (server-enforced)' }];
    }
    return keys.sort().map((key) => {
      const raw = (sensitivePolicies as any)[key];
      const vis =
        raw === true || raw === 'VISIBLE' ? 'Visible' :
        raw === 'MASKED' ? 'Masked' :
        'Hidden';
      return { key, label: key.replace(/_/g, ' '), value: vis };
    });
  }, [sensitivePolicies, isOwnerOrAdmin]);

  const moduleChecks = [
    { label: 'Dashboard', cap: 'dashboard.view' },
    { label: 'Sales', cap: 'sales.view' },
    { label: 'Purchase', cap: 'purchase.view' },
    { label: 'Inventory', cap: 'inventory.view' },
    { label: 'Financials', cap: 'financials.view' },
    { label: 'PDF share', cap: 'document.pdf.generate' },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Access</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Section title="Workspace">
          <Row label="Name" value={workspace?.name || '—'} />
          <Row label="Company" value={company?.name || '—'} />
          <Row label="Pairing" value={pairingStatus || 'UNPAIRED'} />
          <View style={s.chipRow}>
            {demoMode ? <Chip label="Demo Mode" tone="warn" /> : <Chip label="Live data" tone="ok" />}
            <Chip label={membershipStatus} tone={membershipStatus === 'ACTIVE' ? 'ok' : 'warn'} />
          </View>
        </Section>

        <Section title="Your role">
          <Row label="Access" value={roleLabel} />
          <Row label="Entry mode" value={ENTRY_LABEL[entryMode] || entryMode || 'BOTH'} />
          {isOwnerOrAdmin ? (
            <Text style={s.hint}>Owner/Admin can pair Tally, approve Hard Sync/Restore, and configure integrations.</Text>
          ) : (
            <Text style={s.hint}>Role and scopes are managed by the Workspace Owner on the Web Portal.</Text>
          )}
        </Section>

        <Section title="Modules you can open">
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

        <Section title="Effective capabilities">
          {capList.length === 0 ? (
            <Text style={s.empty}>No capability list returned — backend remains the authority on write/read.</Text>
          ) : (
            <View style={s.chipRow}>
              {capList.slice(0, 40).map((c) => (
                <Chip key={c} label={c} />
              ))}
              {capList.length > 40 ? <Chip label={`+${capList.length - 40} more`} /> : null}
            </View>
          )}
        </Section>

        <Section title="Data scope">
          {scopeBlocks.map((b) => (
            <View key={b.title} style={s.scopeBlock}>
              <Text style={s.scopeTitle}>{b.title}</Text>
              {b.open ? (
                <Text style={s.scopeOpen}>Unrestricted (or Owner)</Text>
              ) : (
                <View style={s.chipRow}>
                  {b.items.slice(0, 12).map((item) => (
                    <Chip key={item} label={item} />
                  ))}
                  {b.items.length > 12 ? <Chip label={`+${b.items.length - 12} more`} /> : null}
                </View>
              )}
            </View>
          ))}
        </Section>

        <Section title="Sensitive data policy">
          {policyRows.map((p) => (
            <Row key={p.key} label={p.label} value={p.value} />
          ))}
          <Text style={s.hint}>
            Values may already be masked or omitted by the server. Mobile never overrides a deny.
          </Text>
        </Section>

        <Text style={s.footnote}>
          This screen is informational. Changing roles, seats, or scopes is available only on the Web Portal for the Workspace Owner.
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
