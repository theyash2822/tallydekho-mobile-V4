/**
 * Global search results — the same grouped hits as the web portal (vouchers, ledgers, stock items),
 * in the app's card style. Every hit opens its own record.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';
import { useSettings } from '../context/SettingsContext';
import { safePush } from '../utils/safeNavigation';
import { openVoucherPreview } from '../utils/openVoucherPreview';
import { buildSearchSections, searchHitRoute, MATCHED_LABELS, type SearchHit } from '../utils/globalSearch';
import { ActivityRowSkeleton } from './ShimmerPlaceholder';

const ICON: Record<string, any> = { voucher: 'document-text-outline', ledger: 'book-outline', stock: 'cube-outline' };

function Highlight({ text, q, style }: { text: string; q: string; style: any }) {
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) return <Text style={style} numberOfLines={1}>{text}</Text>;
  return (
    <Text style={style} numberOfLines={1}>
      {text.slice(0, at)}<Text style={s.mark}>{text.slice(at, at + q.length)}</Text>{text.slice(at + q.length)}
    </Text>
  );
}

type Props = { query: string; hits: SearchHit[]; loading: boolean; fyFrom?: string; fyTo?: string };

export default function GlobalSearchResults({ query, hits, loading, fyFrom, fyTo }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const { formatAmount, formatDate } = useSettings();
  const q = query.trim();
  const sections = buildSearchSections(hits);

  const open = (hit: any) => {
    if (hit.kind === 'voucher' && hit.guid) {
      openVoucherPreview(router, { guid: hit.guid, docType: hit.voucher_type ? String(hit.voucher_type) : null });
      return;
    }
    const route = searchHitRoute(hit);
    if (route) safePush(router, route as any);
  };

  if (loading && hits.length === 0) {
    return (
      <View testID="search-loading" style={[s.card, s.section]}>
        {[0, 1, 2, 3].map((i) => <ActivityRowSkeleton key={i} />)}
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View testID="search-empty" style={s.empty}>
        <Ionicons name="search" size={32} color={COLORS.textTertiary} />
        <Text style={s.emptyTitle}>{t('dashboard.noResults', { query: q, defaultValue: `No matches for "${q}"` })}</Text>
        <Text style={s.emptySub}>
          {t('search.emptyHint', { defaultValue: 'Try a voucher number, party, amount, GSTIN, reference, item, HSN or barcode.' })}
        </Text>
      </View>
    );
  }

  return (
    <View testID="search-results">
      {sections.map((sec) => (
        <View key={sec.id} style={s.section} testID={`search-section-${sec.id}`}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>{t(sec.titleKey, { defaultValue: sec.title })}</Text>
            <Text style={s.sectionCount}>{sec.items.length}</Text>
          </View>
          <View style={s.card}>
            {sec.items.map((hit: any, idx: number) => {
              let title = String(hit.label || '');
              let sub = '';
              let right: string | null = null;
              let rightSub: string | null = null;
              let tag: string | null = null;
              if (hit.kind === 'voucher') {
                title = hit.voucher_number || title;
                sub = [hit.party, hit.date ? formatDate(hit.date) : ''].filter(Boolean).join(' · ');
                right = hit.amount != null ? formatAmount(hit.amount) : null;
                tag = hit.voucher_type || null;
              } else if (hit.kind === 'ledger') {
                sub = [hit.group, hit.gstin].filter(Boolean).join(' · ');
                right = hit.balance != null ? formatAmount(hit.balance) : null;
                rightSub = hit.balance != null ? hit.balance_type : null;
                tag = hit.is_party ? t('search.party', { defaultValue: 'Party' }) : t('search.ledger', { defaultValue: 'Ledger' });
              } else if (hit.kind === 'stock') {
                sub = [hit.group, hit.hsn ? `HSN ${hit.hsn}` : ''].filter(Boolean).join(' · ');
                right = hit.qty != null ? String(hit.qty) : null;
                rightSub = hit.qty != null ? hit.unit || null : null;
              }
              const matched = hit.matched ? MATCHED_LABELS[hit.matched] || hit.matched : null;
              return (
                <View key={`${hit.kind}-${hit.guid || idx}`}>
                  <TouchableOpacity testID={`search-hit-${hit.kind}-${idx}`} style={s.row} activeOpacity={0.7} onPress={() => open(hit)}>
                    <View style={s.iconBox}>
                      <Ionicons name={ICON[hit.kind] || 'document-outline'} size={16} color={COLORS.textSecondary} />
                    </View>
                    <View style={s.body}>
                      <View style={s.titleRow}>
                        <Highlight text={title} q={q} style={s.title} />
                        {tag ? <View style={s.tag}><Text style={s.tagTxt} numberOfLines={1}>{tag}</Text></View> : null}
                      </View>
                      {sub ? <Highlight text={sub} q={q} style={s.sub} /> : null}
                      {matched ? (
                        <Text style={s.matched}>{t('search.matched', { field: t(`search.field.${hit.matched}`, { defaultValue: matched }), defaultValue: `Matched ${matched}` })}</Text>
                      ) : null}
                    </View>
                    {right ? (
                      <View style={s.right}>
                        <Text style={s.amount}>{right}</Text>
                        {rightSub ? <Text style={s.rightSub}>{rightSub}</Text> : null}
                      </View>
                    ) : null}
                  </TouchableOpacity>
                  {idx < sec.items.length - 1 && <View style={s.sep} />}
                </View>
              );
            })}
          </View>
        </View>
      ))}
      {fyFrom && fyTo ? (
        <Text style={s.scope}>
          {t('search.vouchersIn', { defaultValue: 'Vouchers in' })} {formatDate(fyFrom)} – {formatDate(fyTo)}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginHorizontal: SPACING.md, marginBottom: SPACING.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sectionTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  sectionCount: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textTertiary },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, gap: 10 },
  iconBox: { width: 34, height: 34, borderRadius: 8, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  mark: { backgroundColor: COLORS.activeBg, color: COLORS.textPrimary },
  tag: { flexShrink: 0, maxWidth: 110, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm, backgroundColor: COLORS.pageBg },
  tagTxt: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },
  sub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  matched: { fontSize: 10, color: COLORS.textTertiary },
  right: { alignItems: 'flex-end', gap: 2 },
  amount: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  rightSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  sep: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 58 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: SPACING.lg, gap: 8 },
  emptyTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  emptySub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, textAlign: 'center' },
  scope: { fontSize: 11, color: COLORS.textTertiary, textAlign: 'right', marginHorizontal: SPACING.md, marginTop: -4 },
});
