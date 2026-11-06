/**
 * Billing & Credits — informational only on Mobile.
 * Per Universal / Mobile handoff: no checkout, no seat purchase, no fake Free plan.
 * Recharge / seats / additional Workspace are Web Portal (Owner) only.
 */
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { getBillingOverview, getSeatPlan, getBillingNotices, getCreditHistory } from '../../src/services/api';
import { safePush } from '../../src/utils/safeNavigation';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ErrorState } from '../../src/components/ApiStateViews';
import { CardSkeleton } from '../../src/components/ShimmerPlaceholder';
import {
  Callout, ListRow, SettingsCard, StatusPill, type IconName, type Tone,
} from '../../src/components/settings/SettingsKit';

const WEB_PORTAL = 'https://app.auditer.com';

const HISTORY_TONE: Record<string, Tone> = {
  ADDED: 'positive',
  RETURNED: 'info',
  CHARGED: 'neutral',
  HELD: 'warning',
  EXPIRED: 'negative',
};

type Billing = {
  workspaceId: string;
  /** Set when neither the wallet nor the seat plan could be read. */
  error: string | null;
  overview: any;
  seats: any;
  notices: any[];
  history: any[];
};

/** Seconds or milliseconds since the epoch, or an ISO date, in milliseconds; 0 when absent. */
function toMs(value: unknown): number {
  if (value == null || value === '') return 0;
  const n = Number(value);
  if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function fmtDate(value: unknown): string {
  const ms = toMs(value);
  return ms ? new Date(ms).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function formatCredits(value: unknown): string {
  const n = Number(value);
  return value != null && Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
}

function signedCredits(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${abs}`;
}

const settle = (request: Promise<any>) => request.then(
  (res: any) => ({ ok: true, data: res?.data ?? null, error: '' }),
  (e: any) => ({ ok: false, data: null, error: String(e?.message || '') }),
);

async function fetchBilling(workspaceId: string): Promise<Billing> {
  const [overview, seats, notices, history] = await Promise.all([
    settle(getBillingOverview()),
    settle(getSeatPlan(workspaceId)),
    settle(getBillingNotices()),
    settle(getCreditHistory(5)),
  ]);
  return {
    workspaceId,
    error: !overview.ok && !seats.ok ? overview.error || seats.error : null,
    overview: overview.data,
    seats: seats.data,
    notices: Array.isArray(notices.data) ? notices.data : [],
    history: Array.isArray(history.data) ? history.data : [],
  };
}

function KpiTile({ icon, label, value, unit, large }: {
  icon: IconName; label: string; value: string; unit?: string; large?: boolean;
}) {
  return (
    <View style={[s.tile, s.grow]}>
      <View style={s.tileHead}>
        <Ionicons name={icon} size={16} color={COLORS.textSecondary} />
        <Text style={[s.tileLabel, s.grow]} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[s.tileValue, large && s.tileValueLarge]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {unit ? <Text style={s.tileUnit} numberOfLines={1}>{unit}</Text> : null}
    </View>
  );
}

function HistoryRow({ entry, last }: { entry: any; last: boolean }) {
  const { t } = useTranslation();
  const amount = Number(entry.amount) || 0;
  const status = String(entry.status || '').toUpperCase();
  const at = entry.createdAt ?? entry.created_at;
  const subtitle = [entry.madeBy, at ? fmtDate(at) : ''].filter(Boolean).join(' · ');
  return (
    <ListRow
      icon={amount > 0 ? 'arrow-down' : amount < 0 ? 'arrow-up' : 'swap-horizontal-outline'}
      tone={amount > 0 ? 'positive' : amount < 0 ? 'negative' : undefined}
      title={entry.what || '—'}
      subtitle={subtitle || null}
      last={last}
      right={(
        <View style={s.historyRight}>
          <Text style={[s.amount, amount > 0 && s.amountIn, amount < 0 && s.amountOut]}>{signedCredits(amount)}</Text>
          {status ? (
            <StatusPill
              label={t(`screens.settingsLicense.status${status}`, { defaultValue: status.charAt(0) + status.slice(1).toLowerCase() })}
              tone={HISTORY_TONE[status] || 'neutral'}
            />
          ) : null}
        </View>
      )}
    />
  );
}

export default function LicenseScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { workspace, workspaceId, isOwner, access } = useWorkspace();
  const roleLabel =
    access?.membershipType === 'OWNER'
      ? t('screens.settingsLicense.owner')
      : access?.role?.displayName || access?.role?.systemKey || t('screens.settingsLicense.member');

  // Owner-only, read-only summary of this workspace's billing; payments stay on the Web portal.
  const [billing, setBilling] = useState<Billing | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const activeWorkspaceRef = useRef(workspaceId);
  useLayoutEffect(() => {
    activeWorkspaceRef.current = workspaceId;
  });

  useFocusEffect(
    useCallback(() => {
      if (!isOwner || !workspaceId) return undefined;
      let alive = true;
      fetchBilling(workspaceId).then((next) => {
        if (alive) setBilling(next);
      });
      return () => { alive = false; };
    }, [isOwner, workspaceId]),
  );

  const reload = async (mode: 'refresh' | 'retry') => {
    if (!isOwner || !workspaceId) return;
    if (mode === 'refresh') setRefreshing(true);
    else setBilling(null);
    const next = await fetchBilling(workspaceId);
    if (activeWorkspaceRef.current === workspaceId) setBilling(next);
    setRefreshing(false);
  };

  const current = isOwner && billing?.workspaceId === workspaceId ? billing : null;
  const loading = isOwner && !!workspaceId && !current;
  const header = (
    <ScreenHeader title={t('screens.settingsLicense.title', 'Billing & Credits')} onBack={() => router.back()} />
  );

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        {header}
        <View style={s.content} testID="billing-loading">
          <View style={s.tiles}>
            <View style={s.grow}><CardSkeleton height={104} /></View>
            <View style={s.grow}><CardSkeleton height={104} /></View>
          </View>
          <CardSkeleton height={96} />
          <CardSkeleton height={180} />
        </View>
      </SafeAreaView>
    );
  }

  if (current?.error != null) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        {header}
        <ErrorState
          title={t('screens.settingsLicense.loadFailed', 'Could not load billing')}
          message={current.error || undefined}
          onRetry={() => reload('retry')}
        />
      </SafeAreaView>
    );
  }

  const wallet = current?.overview?.wallet;
  const fee = (current?.overview?.restrictions || []).find((r: any) => r.kind === 'TRANSFER_FEE');
  const seats = current?.seats;
  const notices: any[] = current ? current.notices.slice(0, 5) : [];
  const history: any[] = current ? current.history : [];
  const capacity = Number(seats?.capacity) || 0;
  const used = Number(seats?.occupied) || 0;
  const usedPct = capacity > 0 ? Math.min(100, Math.round((used / capacity) * 100)) : 0;

  const alerts: { key: string; tone: Tone; icon: IconName; text: string }[] = [];
  if (fee) {
    alerts.push({
      key: 'fee', tone: 'negative', icon: 'alert-circle-outline',
      text: t('screens.settingsLicense.transferFeeDue', { amount: (Number(fee.totalPaise) / 100).toLocaleString('en-IN') }),
    });
  }
  if (seats?.status === 'GRACE') {
    alerts.push({
      key: 'grace', tone: 'warning', icon: 'time-outline',
      text: t('screens.settingsLicense.seatGrace', { date: fmtDate(seats.graceUntil) }),
    });
  }
  if (seats?.status === 'PAUSED') {
    alerts.push({
      key: 'paused', tone: 'negative', icon: 'pause-circle-outline',
      text: t('screens.settingsLicense.seatPaused', { date: fmtDate(seats.retiresAt) }),
    });
  }
  if (Number(seats?.dues) > 0) {
    alerts.push({
      key: 'dues', tone: 'warning', icon: 'card-outline',
      text: t('screens.settingsLicense.seatDues', { credits: seats.dues }),
    });
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {header}
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={isOwner ? (
          <RefreshControl refreshing={refreshing} onRefresh={() => reload('refresh')} tintColor={COLORS.brandPrimary} />
        ) : undefined}
      >
        {alerts.map((a) => (
          <Callout key={a.key} tone={a.tone} icon={a.icon} text={a.text} style={s.alert} testID={`billing-alert-${a.key}`} />
        ))}

        {wallet || seats?.nextDueAt ? (
          <View style={s.tiles}>
            {wallet ? (
              <KpiTile
                icon="wallet-outline"
                label={t('screens.settingsLicense.available')}
                value={formatCredits(wallet.available ?? wallet.balanceCredits)}
                unit={t('screens.settingsLicense.credits')}
                large
              />
            ) : null}
            {seats?.nextDueAt ? (
              <KpiTile
                icon="calendar-outline"
                label={t('screens.settingsLicense.nextRenewalLabel', 'Next renewal')}
                value={fmtDate(seats.nextDueAt)}
                unit={`${formatCredits(seats.renewalCredits)} ${t('screens.settingsLicense.credits')}`}
              />
            ) : null}
          </View>
        ) : null}

        {seats ? (
          <View style={s.tile} testID="billing-seats">
            <View style={s.tileHead}>
              <Ionicons name="people-outline" size={16} color={COLORS.textSecondary} />
              <Text style={[s.tileLabel, s.grow]} numberOfLines={1}>{t('screens.settingsLicense.seats')}</Text>
              <Text style={s.seatCount}>{`${used} / ${capacity}`}</Text>
            </View>
            <View style={s.track}>
              <View style={[s.fill, { width: `${usedPct}%` as const }]} />
            </View>
            <Text style={s.tileUnit}>
              {t('screens.settingsLicense.seatLine', { capacity: seats.capacity, used: seats.occupied, free: seats.free })}
            </Text>
          </View>
        ) : null}

        {wallet ? (
          <Text style={s.caption}>
            {t('screens.settingsLicense.heldExpiring', { held: wallet.reserved ?? 0, expiring: wallet.expiringSoon ?? 0 })}
          </Text>
        ) : null}

        {history.length > 0 ? (
          <SettingsCard title={t('screens.settingsLicense.creditHistory', { defaultValue: 'Recent credit activity' })}>
            {history.map((h, i) => <HistoryRow key={h.id ?? i} entry={h} last={i === history.length - 1} />)}
          </SettingsCard>
        ) : null}

        {notices.length > 0 ? (
          <SettingsCard title={t('screens.settingsLicense.notices')}>
            {notices.map((n, i) => (
              <ListRow
                key={n.id ?? i}
                icon="notifications-outline"
                title={n.title || '—'}
                subtitle={fmtDate(n.createdAt)}
                last={i === notices.length - 1}
              />
            ))}
          </SettingsCard>
        ) : null}

        <SettingsCard>
          <ListRow
            icon="briefcase-outline"
            title={workspace?.name || '—'}
            subtitle={t('screens.settingsLicense.workspace')}
          />
          <ListRow
            icon="key-outline"
            title={t('screens.settings.myAccess')}
            right={<StatusPill label={roleLabel} tone="info" />}
            onPress={() => safePush(router, '/settings/my-access' as any)}
            last
            testID="billing-my-access"
          />
        </SettingsCard>

        <SettingsCard>
          <Text style={s.webTitle}>{t('screens.settingsLicense.billingOnWeb')}</Text>
          <Text style={s.webBody}>{t('screens.settingsLicense.billingBody')}</Text>
          {isOwner ? (
            <TouchableOpacity
              style={s.webBtn}
              onPress={() => Linking.openURL(WEB_PORTAL).catch(() => {})}
              activeOpacity={0.85}
              accessibilityRole="link"
              testID="billing-open-web"
            >
              <Text style={s.webBtnTxt}>{t('screens.settingsLicense.openWebPortal')}</Text>
              <Ionicons name="open-outline" size={16} color={COLORS.white} />
            </TouchableOpacity>
          ) : (
            <Callout tone="info" text={t('screens.settingsLicense.askOwner')} style={s.askOwner} />
          )}
        </SettingsCard>

        {isOwner ? (
          <Text style={s.footnote}>
            {t('screens.settingsLicense.footnoteWeb', 'Recharge credits and manage seats on the web portal at app.auditer.com.')}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  grow: { flex: 1 },
  alert: { marginBottom: 12 },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabel: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  tileValue: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary, marginTop: 10 },
  tileValueLarge: { fontSize: TYPOGRAPHY.xl },
  tileUnit: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  seatCount: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  track: {
    height: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.activeBg, overflow: 'hidden',
    marginTop: 12, marginBottom: SPACING.sm,
  },
  fill: { height: '100%', borderRadius: RADIUS.full, backgroundColor: COLORS.brandPrimary },
  caption: {
    fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, lineHeight: 16,
    marginBottom: SPACING.md, paddingHorizontal: SPACING.xs,
  },
  historyRight: { alignItems: 'flex-end', gap: SPACING.xs },
  amount: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  amountIn: { color: COLORS.positive },
  amountOut: { color: COLORS.negative },
  webTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  webBody: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20 },
  webBtn: {
    marginTop: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 14,
  },
  webBtnTxt: { color: COLORS.white, fontWeight: '800', fontSize: TYPOGRAPHY.base },
  askOwner: { marginTop: 12 },
  footnote: {
    fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, lineHeight: 16,
    marginHorizontal: SPACING.xs, textAlign: 'center',
  },
});
