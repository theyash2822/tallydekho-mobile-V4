/**
 * Reports → GST → Sales / Purchases on the GST portal: the invoices the portal holds for a period (GSTR-1 or IFF
 * for own sales, GSTR-2B or GSTR-2A for purchases) matched to the books. Read-only and free. The server reads the
 * portal at most every six hours, so the screen says when it was read.
 * Params: kind=sales|purchases, source=2b|2a (purchases), freq=monthly|quarterly (from the GST overview).
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { stateFromGstin } from '../../src/constants/indianStates';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { EmptyState, ErrorState } from '../../src/components/ApiStateViews';
import { CardSkeleton } from '../../src/components/ShimmerPlaceholder';
import { Callout, HeaderIconButton, StatusPill, TONE_COLORS, type Tone } from '../../src/components/settings/SettingsKit';
import {
  getGstPortalSales, getGstPortalPurchases, isGstNotConfigured,
  type GstPortalB2csLine, type GstPortalPurchaseRow, type GstPortalPurchases, type GstPortalSales, type GstPortalSalesRow,
  type GstPortalSection, type GstPortalStatus, type GstPurchaseSource,
} from '../../src/services/api';
import { safePush } from '../../src/utils/safeNavigation';
import { formatWhen, gstPeriodLabel } from '../../src/utils/complianceRules';
import {
  adjacentPeriods, periodStep, portalProblem, statusCounts, PORTAL_STATUSES, PORTAL_STATUS_TONE, type GstPortalKind,
} from '../../src/utils/gstPortal';

type PortalData = GstPortalSales | GstPortalPurchases;
type Answer = { key: string; data: PortalData | null; error: unknown };
type Translate = (key: string, options?: Record<string, unknown>) => string;
type Format = { t: Translate; amount: (n: number) => string; date: (iso: string) => string };

/** One row on screen, from a sales document, a purchase document or a B2CS line. */
type RowView = {
  key: string;
  status: GstPortalStatus;
  title: string;
  meta: string;
  taxable: number;
  tax: number;
  /** "Differs in: tax, date" */
  differs: string | null;
  /** "Portal ₹1,800 · Books ₹1,620" when both hold it with different amounts. */
  compare: string | null;
  notes: { text: string; tone: Tone }[];
};

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function GstPortalScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { formatAmount, formatDate } = useSettings();
  const { company } = useAuth();
  const { isOwnerOrAdmin, hasCapability } = useWorkspace();
  const canConfigure = isOwnerOrAdmin || hasCapability('integrations.configure');
  const params = useLocalSearchParams<{ kind?: string; source?: string; freq?: string }>();
  const kind: GstPortalKind = params.kind === 'purchases' ? 'purchases' : 'sales';
  const companyGuid = company?.guid || '';

  const [source, setSource] = useState<GstPurchaseSource>(params.source === '2a' ? '2a' : '2b');
  /** null: the server opens on the latest period with data and names it. */
  const [period, setPeriod] = useState<string | null>(null);
  const [filter, setFilter] = useState<GstPortalStatus | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  /** Whether GSTR-2B comes per quarter, as the last 2B answer showed (the overview's frequency until then). */
  const [quarterly2b, setQuarterly2b] = useState<boolean | null>(null);

  const viewKey = `${companyGuid}|${kind}|${kind === 'purchases' ? source : ''}|${period || ''}`;
  const answerRef = useRef<Answer | null>(answer);
  useLayoutEffect(() => {
    answerRef.current = answer;
  });

  useEffect(() => {
    if (!companyGuid) return;
    let cancelled = false;
    const key = viewKey;
    const request = kind === 'sales'
      ? getGstPortalSales(companyGuid, period)
      : getGstPortalPurchases(companyGuid, period, source);
    request
      .then((res) => {
        if (cancelled) return;
        const data = (res?.data ?? null) as PortalData | null;
        setAnswer({ key, data, error: null });
        if (kind === 'purchases' && source === '2b' && data?.period_label) {
          setQuarterly2b(periodStep('purchases', '2b', { label: data.period_label }) === 3);
        }
      })
      .catch((error: any) => {
        if (cancelled) return;
        // A failed refresh keeps the list already on screen for this period; the toast says it failed.
        const shown = answerRef.current;
        if (shown?.key === key && shown.data) {
          Toast.show({ type: 'error', text1: t('screens.gstPortal.loadFailed'), text2: error?.message || undefined });
          return;
        }
        setAnswer({ key, data: null, error });
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => { cancelled = true; };
  }, [companyGuid, kind, source, period, reloadKey, viewKey, t]);

  const refresh = () => {
    setRefreshing(true);
    setReloadKey((k) => k + 1);
  };

  const current = answer && answer.key === viewKey ? answer : null;
  const data = current?.data ?? null;
  const sales = kind === 'sales' ? (data as GstPortalSales | null) : null;
  const purchases = kind === 'purchases' ? (data as GstPortalPurchases | null) : null;

  const shownPeriod = data?.period || period;
  const knownFrequency = quarterly2b === null ? params.freq : quarterly2b ? 'quarterly' : 'monthly';
  const step = periodStep(kind, source, { label: data?.period_label, frequency: knownFrequency });
  const { prev, next } = shownPeriod ? adjacentPeriods(shownPeriod, step) : { prev: null, next: null };
  const periodText = data?.period_label || (shownPeriod ? gstPeriodLabel(shownPeriod) : '');
  const updatedAt = num(data?.fetched_at) > 0 ? formatWhen(new Date(num(data?.fetched_at) * 1000)) : '';

  const fmt: Format = useMemo(() => ({ t, amount: formatAmount, date: formatDate }), [t, formatAmount, formatDate]);
  const docs = useMemo<RowView[]>(() => {
    if (sales) return (sales.rows || []).map((r, i) => salesRowView(r, i, fmt));
    if (purchases) return (purchases.rows || []).map((r, i) => purchaseRowView(r, i, fmt));
    return [];
  }, [sales, purchases, fmt]);
  const b2cs = useMemo<RowView[]>(() => (sales?.b2cs || []).map((l, i) => b2csRowView(l, i, fmt)), [sales, fmt]);
  const counts = useMemo(() => statusCounts([...docs, ...b2cs]), [docs, b2cs]);
  const shownDocs = filter ? docs.filter((r) => r.status === filter) : docs;
  const shownB2cs = filter ? b2cs.filter((r) => r.status === filter) : b2cs;
  const sections: GstPortalSection[] = (data?.ready && Array.isArray(data.sections)) ? data.sections : [];

  const title = kind === 'sales' ? t('screens.gstPortal.salesTitle') : t('screens.gstPortal.purchasesTitle');
  const formName = kind === 'sales'
    ? (sales?.return_form === 'IFF' ? 'IFF' : 'GSTR-1')
    : (source === '2a' ? 'GSTR-2A' : 'GSTR-2B');

  const notReadyText = (() => {
    if (!data || data.ready) return null;
    const date = data.available_from ? formatDate(data.available_from) : '';
    if (!date) return data.message || null;
    const vars = { period: periodText, date };
    if (kind === 'sales') return t('screens.gstPortal.notReadySales', vars);
    return source === '2a' ? t('screens.gstPortal.notReady2a', vars) : t('screens.gstPortal.notReady2b', vars);
  })();

  const header = (
    <View>
      {kind === 'purchases' ? (
        <>
          <View style={s.segment} accessibilityRole="tablist">
            {(['2b', '2a'] as const).map((src) => {
              const on = source === src;
              return (
                <TouchableOpacity
                  key={src}
                  style={[s.segmentItem, on && s.segmentOn]}
                  onPress={() => setSource(src)}
                  activeOpacity={0.8}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  testID={`gst-portal-source-${src}`}
                >
                  <Text style={[s.segmentTxt, on && s.segmentTxtOn]}>{src === '2a' ? 'GSTR-2A' : 'GSTR-2B'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={s.help}>{source === '2a' ? t('screens.gstPortal.help2a') : t('screens.gstPortal.help2b')}</Text>
        </>
      ) : null}

      {shownPeriod ? (
        <View style={s.card}>
          <View style={s.periodRow}>
            <TouchableOpacity
              onPress={() => { if (prev) setPeriod(prev); }}
              disabled={!prev}
              hitSlop={HIT}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('screens.gstPortal.previousPeriod')}
              testID="gst-portal-prev"
            >
              <Ionicons name="chevron-back" size={20} color={prev ? COLORS.textPrimary : COLORS.textTertiary} />
            </TouchableOpacity>
            <View style={s.periodMid}>
              <Text style={s.periodTxt}>{periodText}</Text>
              <Text style={s.meta}>{formName}</Text>
            </View>
            <TouchableOpacity
              onPress={() => { if (next) setPeriod(next); }}
              disabled={!next}
              hitSlop={HIT}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('screens.gstPortal.nextPeriod')}
              testID="gst-portal-next"
            >
              <Ionicons name="chevron-forward" size={20} color={next ? COLORS.textPrimary : COLORS.textTertiary} />
            </TouchableOpacity>
          </View>
          {sales?.filing?.status ? (
            <View style={s.filingRow}>
              {sales.filing.status === 'filed' ? (
                <StatusPill
                  tone="positive"
                  icon="checkmark-circle-outline"
                  label={sales.filing.filed_on ? t('screens.reportsGst.filedOn', { date: formatDate(sales.filing.filed_on) }) : t('screens.reportsGst.status_filed')}
                />
              ) : (
                <StatusPill tone="warning" label={t('screens.gstPortal.notFiled')} />
              )}
              {sales.filing.arn ? <Text style={s.meta} selectable>{t('screens.gstPortal.arn', { arn: sales.filing.arn })}</Text> : null}
            </View>
          ) : null}
          {updatedAt || (period && data?.default_period && data.period !== data.default_period) ? (
            <View style={s.updatedRow}>
              {updatedAt ? <Text style={s.meta}>{t('screens.gstPortal.updated', { time: updatedAt })}</Text> : <View />}
              {period && data?.default_period && data.period !== data.default_period ? (
                <TouchableOpacity onPress={() => setPeriod(null)} hitSlop={HIT} activeOpacity={0.7} testID="gst-portal-latest">
                  <Text style={s.link}>{t('screens.gstPortal.latest', { period: data.default_period_label || gstPeriodLabel(data.default_period) })}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {notReadyText ? <Callout tone="info" text={notReadyText} style={s.block} testID="gst-portal-not-ready" /> : null}

      {data?.ready ? (
        <>
          <View style={s.tiles}>
            {sales?.summary ? (
              <>
                <Tile label={t('screens.gstPortal.tileOnPortal')} value={formatAmount(num(sales.summary.portal_tax))} sub={t('screens.gstPortal.taxableAmount', { amount: formatAmount(num(sales.summary.portal_taxable)) })} />
                <Tile label={t('screens.gstPortal.tileInBooks')} value={formatAmount(num(sales.summary.books_tax))} sub={t('screens.gstPortal.taxableAmount', { amount: formatAmount(num(sales.summary.books_taxable)) })} />
                <Tile label={t('screens.gstPortal.tileTaxDifference')} value={formatAmount(num(sales.summary.tax_difference))} tone={Math.abs(num(sales.summary.tax_difference)) >= 1 ? 'warning' : undefined} />
              </>
            ) : null}
            {purchases?.summary ? (
              <>
                <Tile label={t('screens.gstPortal.tileItcInBooks')} value={formatAmount(num(purchases.summary.itc_in_books))} />
                <Tile label={t('screens.gstPortal.tileItcAtRisk')} value={formatAmount(num(purchases.summary.itc_at_risk))} tone={num(purchases.summary.itc_at_risk) > 0 ? 'negative' : undefined} />
                <Tile label={t('screens.gstPortal.tileOnlyOnPortal')} value={formatAmount(num(purchases.summary.portal_only_tax))} tone={num(purchases.summary.portal_only_tax) > 0 ? 'info' : undefined} />
              </>
            ) : null}
          </View>

          {sections.length > 0 ? (
            <View style={s.card} testID="gst-portal-sections">
              <Text style={s.cardTitle}>{t('screens.gstPortal.sectionsTitle')}</Text>
              {sections.map((sec, i) => (
                <View key={sec.key} style={[s.sectionRow, i > 0 && s.sectionRule]}>
                  <View style={s.grow}>
                    <Text style={s.sectionName}>{sectionLabel(sec.key, sec.label, t)}</Text>
                    {sec.error ? (
                      <Text style={[s.meta, { color: COLORS.negative }]}>{t('screens.gstPortal.sectionError', { message: sec.error })}</Text>
                    ) : null}
                  </View>
                  {sec.error ? (
                    <Ionicons name="alert-circle-outline" size={18} color={COLORS.negative} />
                  ) : (
                    <View style={s.sectionNums}>
                      <Text style={s.sectionCount}>{num(sec.count)}</Text>
                      {sec.total_tax != null ? <Text style={s.meta}>{t('screens.gstPortal.taxAmount', { amount: formatAmount(num(sec.total_tax)) })}</Text> : null}
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : null}

          {counts.all > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipWrap} contentContainerStyle={s.chipRow}>
              {([null, ...PORTAL_STATUSES] as (GstPortalStatus | null)[]).map((st) => {
                const on = filter === st;
                return (
                  <TouchableOpacity
                    key={st || 'all'}
                    style={[s.chip, on && s.chipOn]}
                    onPress={() => setFilter(st)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    testID={`gst-portal-filter-${st || 'all'}`}
                  >
                    <Text style={[s.chipTxt, on && s.chipTxtOn]}>
                      {`${st ? t(`screens.gstPortal.status_${st}`) : t('common.all')} (${st ? counts[st] : counts.all})`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}
        </>
      ) : null}
    </View>
  );

  const footer = shownB2cs.length > 0 ? (
    <View style={s.b2cs} testID="gst-portal-b2cs">
      <Text style={s.cardTitle}>{t('screens.gstPortal.b2csTitle')}</Text>
      {shownB2cs.map((row) => <RowCard key={row.key} row={row} />)}
    </View>
  ) : undefined;

  const empty = (() => {
    if (!current) {
      return (
        <View>
          <CardSkeleton height={84} />
          <CardSkeleton height={84} />
          <CardSkeleton height={84} />
        </View>
      );
    }
    if (current.error) {
      return (
        <PortalProblem
          error={current.error}
          canConfigure={canConfigure}
          onOpenSettings={() => safePush(router, '/settings/gst' as any)}
          onRetry={refresh}
        />
      );
    }
    if (!data?.ready || shownB2cs.length > 0) return undefined;
    if (counts.all === 0) return <EmptyState icon="documents-outline" title={t('screens.gstPortal.emptyPeriod')} />;
    return <Text style={s.emptyFilter}>{t('screens.gstPortal.emptyStatus')}</Text>;
  })();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader
        title={title}
        onBack={() => router.back()}
        right={companyGuid ? (
          <HeaderIconButton icon="refresh" label={t('common.refresh')} onPress={refresh} busy={refreshing} testID="gst-portal-refresh" />
        ) : undefined}
      />
      {!companyGuid ? (
        <EmptyState icon="business-outline" title={t('screens.settingsGst.selectCompany')} />
      ) : (
        <FlatList
          data={current && data?.ready ? shownDocs : []}
          keyExtractor={(row) => row.key}
          renderItem={({ item }) => <RowCard row={item} />}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ListEmptyComponent={empty}
          contentContainerStyle={s.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.brandPrimary} />}
          initialNumToRender={12}
          windowSize={7}
          testID="gst-portal-list"
        />
      )}
    </SafeAreaView>
  );
}

const HIT = { top: 8, bottom: 8, left: 8, right: 8 };

function PortalProblem({ error, canConfigure, onOpenSettings, onRetry }: {
  error: unknown; canConfigure: boolean; onOpenSettings: () => void; onRetry: () => void;
}) {
  const { t } = useTranslation();
  const problem = portalProblem(error);
  if (problem === 'connect' || problem === 'expired') {
    const hint = t('screens.gstPortal.connectHint');
    return (
      <View testID="gst-portal-connect">
        <Callout tone="warning" icon="link-outline" text={problem === 'expired' ? `${t('screens.gstPortal.sessionEnded')} ${hint}` : hint} />
        {canConfigure ? (
          <TouchableOpacity style={s.problemBtn} onPress={onOpenSettings} activeOpacity={0.85} accessibilityRole="button" testID="gst-portal-open-settings">
            <Text style={s.problemBtnTxt}>{t('screens.reportsGst.connectInSettings')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }
  if (isGstNotConfigured(error)) {
    return <Callout tone="info" text={t('screens.reportsGst.notConfigured')} testID="gst-portal-not-configured" />;
  }
  if (problem === 'gstin') {
    return <Callout tone="warning" icon="business-outline" text={t('screens.gstPortal.gstinMissing')} testID="gst-portal-gstin-missing" />;
  }
  const message = problem === 'unreachable'
    ? t('screens.gstPortal.portalUnreachable')
    : problem === 'timeout'
      ? t('screens.gstPortal.portalTimeout')
      : String((error as { message?: unknown } | null)?.message || '');
  return <ErrorState title={t('screens.gstPortal.loadFailed')} message={message} onRetry={onRetry} />;
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: Tone }) {
  return (
    <View style={s.tile}>
      <Text style={s.tileLabel} numberOfLines={2}>{label}</Text>
      <Text style={[s.tileValue, tone && { color: TONE_COLORS[tone].fg }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {sub ? <Text style={s.tileSub} numberOfLines={1} adjustsFontSizeToFit>{sub}</Text> : null}
    </View>
  );
}

function RowCard({ row }: { row: RowView }) {
  const { t } = useTranslation();
  const { formatAmount } = useSettings();
  return (
    <View style={s.row} testID={`gst-portal-row-${row.status}`}>
      <View style={s.rowHead}>
        <View style={s.grow}>
          <Text style={s.rowTitle} numberOfLines={2}>{row.title}</Text>
          {row.meta ? <Text style={s.meta} numberOfLines={2}>{row.meta}</Text> : null}
        </View>
        <StatusPill label={t(`screens.gstPortal.status_${row.status}`)} tone={PORTAL_STATUS_TONE[row.status]} />
      </View>
      <View style={s.amounts}>
        <Text style={s.meta}>{t('screens.gstPortal.taxableAmount', { amount: formatAmount(row.taxable) })}</Text>
        <Text style={s.taxTxt}>{t('screens.gstPortal.taxAmount', { amount: formatAmount(row.tax) })}</Text>
      </View>
      {row.differs ? <Text style={[s.note, { color: TONE_COLORS.warning.fg }]}>{row.differs}</Text> : null}
      {row.compare ? <Text style={s.note}>{row.compare}</Text> : null}
      {row.notes.map((n) => (
        <Text key={n.text} style={[s.note, n.tone !== 'neutral' && { color: TONE_COLORS[n.tone].fg }]}>{n.text}</Text>
      ))}
    </View>
  );
}

function sectionLabel(key: string | null | undefined, fallback: string | null | undefined, t: Translate): string {
  const k = String(key || '').toLowerCase();
  return k ? t(`screens.gstPortal.section_${k}`, { defaultValue: fallback || k.toUpperCase() }) : (fallback || '');
}

function docTypeLabel(docType: string | null | undefined, t: Translate): string {
  const k = String(docType || '');
  return k ? t(`screens.gstPortal.doc_${k}`, { defaultValue: k.replace(/_/g, ' ') }) : '';
}

function differsText(reasons: readonly string[] | null | undefined, t: Translate): string | null {
  const list = Array.isArray(reasons) ? reasons : [];
  if (!list.length) return null;
  const fields = list.map((r) => t(`screens.gstPortal.reason_${r}`, { defaultValue: r.replace(/_/g, ' ') }));
  return t('screens.gstPortal.differsIn', { fields: fields.join(', ') });
}

function compareText(portalTax: number | null | undefined, booksTax: number | null | undefined, f: Format): string | null {
  if (portalTax == null || booksTax == null || Math.abs(num(portalTax) - num(booksTax)) < 0.5) return null;
  return f.t('screens.gstPortal.portalVsBooks', { portal: f.amount(num(portalTax)), books: f.amount(num(booksTax)) });
}

const joinMeta = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(' · ');

function salesRowView(r: GstPortalSalesRow, i: number, f: Format): RowView {
  const { t } = f;
  const booksVoucher = r.books?.voucher_number && r.books.voucher_number !== r.doc_no ? r.books.voucher_number : null;
  return {
    key: `s${i}-${r.section}-${r.doc_no}`,
    status: r.status,
    title: r.counterparty_name || r.counterparty_gstin || sectionLabel(r.section, null, t),
    meta: joinMeta([
      String(r.section || '').toUpperCase(),
      r.counterparty_name ? r.counterparty_gstin : null,
      docTypeLabel(r.doc_type, t),
      r.doc_no,
      r.doc_date ? f.date(r.doc_date) : null,
    ]),
    taxable: num(r.taxable_value),
    tax: num(r.total_tax),
    differs: r.status === 'mismatch' ? differsText(r.reasons, t) : null,
    compare: r.portal && r.books ? compareText(r.portal.total_tax, r.books.total_tax, f) : null,
    notes: booksVoucher ? [{ text: t('screens.gstPortal.booksVoucher', { number: booksVoucher }), tone: 'neutral' }] : [],
  };
}

function purchaseRowView(r: GstPortalPurchaseRow, i: number, f: Format): RowView {
  const { t } = f;
  const notes: RowView['notes'] = [];
  if (r.portal?.itc_available === false) notes.push({ text: t('screens.gstPortal.itcNotAvailable'), tone: 'warning' });
  if (r.portal?.filing_status === 'not_filed') notes.push({ text: t('screens.gstPortal.supplierNotFiled'), tone: 'warning' });
  const booksVoucher = r.books?.voucher_number && r.books.voucher_number !== r.doc_no ? r.books.voucher_number : null;
  if (booksVoucher) notes.push({ text: t('screens.gstPortal.booksVoucher', { number: booksVoucher }), tone: 'neutral' });
  return {
    key: `p${i}-${r.supplier_gstin}-${r.doc_no}`,
    status: r.status,
    title: r.supplier_name || r.supplier_gstin,
    meta: joinMeta([
      r.supplier_name ? r.supplier_gstin : null,
      docTypeLabel(r.doc_type, t),
      r.doc_no,
      r.doc_date ? f.date(r.doc_date) : null,
    ]),
    taxable: num(r.portal?.taxable ?? r.books?.taxable),
    tax: num(r.portal?.tax ?? r.books?.tax),
    differs: r.status === 'mismatch' ? differsText(r.reasons, t) : null,
    compare: r.portal && r.books ? compareText(r.portal.tax, r.books.tax, f) : null,
    notes,
  };
}

function b2csRowView(l: GstPortalB2csLine, i: number, f: Format): RowView {
  const { t } = f;
  const supply = String(l.supply_type || '').toUpperCase();
  const pos = String(l.place_of_supply || '');
  return {
    key: `b${i}-${supply}-${pos}-${l.rate}`,
    status: l.status,
    title: joinMeta([
      supply === 'INTER' ? t('screens.gstPortal.supplyInter') : supply === 'INTRA' ? t('screens.gstPortal.supplyIntra') : supply,
      `${num(l.rate)}%`,
    ]),
    meta: pos ? t('screens.gstPortal.placeOfSupply', { place: stateFromGstin(pos) || pos }) : '',
    taxable: num(l.taxable_value),
    tax: num(l.total_tax),
    differs: l.status === 'mismatch' ? differsText(l.reasons, t) : null,
    compare: l.portal && l.books ? compareText(l.portal.total_tax, l.books.total_tax, f) : null,
    notes: [],
  };
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl, flexGrow: 1 },
  grow: { flex: 1 },
  block: { marginBottom: SPACING.md },
  help: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, lineHeight: 17, marginBottom: SPACING.md },
  segment: {
    flexDirection: 'row', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: 3,
    borderWidth: 1, borderColor: COLORS.borderDefault, marginBottom: SPACING.sm,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: RADIUS.sm },
  segmentOn: { backgroundColor: COLORS.brandPrimary },
  segmentTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  segmentTxtOn: { color: COLORS.white, fontWeight: '700' },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.textTertiary, textTransform: 'uppercase',
    letterSpacing: 0.9, marginBottom: SPACING.xs,
  },
  periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  periodMid: { flex: 1, alignItems: 'center' },
  periodTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  filingRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm, justifyContent: 'center' },
  updatedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm,
    marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  meta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, lineHeight: 17 },
  link: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.info },
  tiles: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  tile: {
    flex: 1, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: 10,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  tileLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, minHeight: 32 },
  tileValue: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary, marginTop: 4 },
  tileSub: { fontSize: 11, color: COLORS.textTertiary, marginTop: 2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  sectionRule: { borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  sectionName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  sectionNums: { alignItems: 'flex-end' },
  sectionCount: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  chipWrap: { marginBottom: SPACING.sm, flexGrow: 0 },
  chipRow: { gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
  },
  chipOn: { backgroundColor: COLORS.cardBg, borderColor: COLORS.brandPrimary },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  chipTxtOn: { color: COLORS.brandPrimary, fontWeight: '700' },
  row: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: 12, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  rowTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  amounts: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  taxTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  note: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, lineHeight: 17, marginTop: 4 },
  b2cs: { marginTop: SPACING.sm },
  emptyFilter: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.lg },
  problemBtn: {
    alignSelf: 'flex-start', marginTop: SPACING.md, paddingVertical: 10, paddingHorizontal: 18,
    borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary,
  },
  problemBtnTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
});
