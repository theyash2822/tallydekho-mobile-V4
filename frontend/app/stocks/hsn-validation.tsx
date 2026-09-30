import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { getHsnValidation, alterStockItem, checkHsnCode } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import SearchBar from '../../src/components/SearchBar';
import { safePush } from '../../src/utils/safeNavigation';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n';

type Filter = 'all' | 'missing' | 'bad_format' | 'unknown' | 'ok';

const STATUS_LABEL_KEY: Record<string, string> = {
  ok: 'common.ok',
  missing: 'screens.stocksHsnValidation.missing',
  bad_format: 'screens.stocksHsnValidation.badFormat',
  unknown: 'screens.stocksHsnValidation.notInList',
};

export default function HsnValidationScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { company } = useAuth();
  const companyGuid = company?.guid;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState({ missing: 0, bad_format: 0, unknown: 0, ok: 0, total: 0 });
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const [enterItem, setEnterItem] = useState<any | null>(null);
  const [hsnDraft, setHsnDraft] = useState('');
  const [hsnHint, setHsnHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchValidation = useCallback(() => {
    if (!companyGuid) return;
    getHsnValidation(companyGuid)
      .then((res: any) => {
        const data = res?.data;
        setEnabled(data?.enabled !== false);
        setItems(data?.items || []);
        setCounts(data?.counts || { missing: 0, bad_format: 0, unknown: 0, ok: 0, total: 0 });
      })
      .catch((e: any) => {
        setError(e?.message || i18n.t('screens.stocksHsnValidation.loadFailed'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [companyGuid]);

  const load = () => {
    if (!companyGuid) return;
    setLoading(true);
    setError(null);
    fetchValidation();
  };

  const [loadedFor, setLoadedFor] = useState<{ guid: string | undefined } | null>(null);
  if (!loadedFor || loadedFor.guid !== companyGuid) {
    setLoadedFor({ guid: companyGuid });
    if (companyGuid) {
      setLoading(true);
      setError(null);
    }
  }

  useEffect(() => { fetchValidation(); }, [fetchValidation]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (filter !== 'all' && it.status !== filter) return false;
      if (!q) return true;
      return (
        (it.name || '').toLowerCase().includes(q) ||
        (it.displayName || '').toLowerCase().includes(q) ||
        (it.hsn || '').toLowerCase().includes(q) ||
        (it.sku || '').toLowerCase().includes(q)
      );
    });
  }, [items, filter, query]);

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: t('common.all'), count: counts.total },
    { id: 'missing', label: t('screens.stocksHsnValidation.missing'), count: counts.missing },
    { id: 'unknown', label: t('screens.stocksHsnValidation.notInList'), count: counts.unknown },
    { id: 'bad_format', label: t('screens.stocksHsnValidation.format'), count: counts.bad_format },
  ];

  const openEnterHsn = (it: any) => {
    setEnterItem(it);
    setHsnDraft(it.hsn || '');
    setHsnHint(null);
  };

  const saveHsn = async () => {
    if (!companyGuid || !enterItem) return;
    const code = hsnDraft.trim();
    if (!code) {
      Toast.show({ type: 'error', text1: t('screens.stocksHsnValidation.enterCode') });
      return;
    }
    setSaving(true);
    try {
      const check: any = await checkHsnCode(code);
      if (check?.data?.valid === false) {
        setHsnHint(t('screens.stocksHsnValidation.invalidHint'));
        Toast.show({ type: 'error', text1: t('screens.stocksHsnValidation.invalid'), text2: t('screens.stocksHsnValidation.notAccepted') });
        return;
      }
      const res: any = await alterStockItem({
        companyGuid,
        companyName: company?.name || '',
        existingName: enterItem.name,
        changes: { hsnCode: code },
      });
      setItems((prev) => prev.map((x) => (
        x.id === enterItem.id
          ? { ...x, hsn: code, status: 'ok', message: '' }
          : x
      )));
      setCounts((prev) => ({
        ...prev,
        ok: (prev.ok || 0) + 1,
        [enterItem.status]: Math.max(0, ((prev as any)[enterItem.status] || 0) - 1),
      }));
      setEnterItem(null);
      Toast.show({
        type: 'success',
        text1: res?.queued ? t('screens.stocksHsnValidation.queued') : t('screens.stocksHsnValidation.saved'),
        text2: res?.queued
          ? t('screens.stocksHsnValidation.queuedSub')
          : t('screens.stocksHsnValidation.updated', { name: enterItem.displayName || enterItem.name }),
      });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: t('screens.stocksHsnValidation.saveFailed'), text2: e?.message || t('screens.stocksHsnValidation.tryAgain') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('screens.stocksHsnValidation.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {!enabled ? (
        <View style={s.empty}>
          <Ionicons name="shield-checkmark-outline" size={40} color={COLORS.textTertiary} />
          <Text style={s.emptyTitle}>{t('screens.stocksHsnValidation.offTitle')}</Text>
          <Text style={s.emptySub}>{t('screens.stocksHsnValidation.offSub')}</Text>
          <TouchableOpacity
            style={s.cta}
            onPress={() => safePush(router, '/stocks/settings' as any)}
            activeOpacity={0.8}
          >
            <Text style={s.ctaTxt}>{t('screens.stocksHsnValidation.openSettings')}</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: 10 }}>
          <CardSkeleton height={72} />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
        </ScrollView>
      ) : (
        <>
          <View style={s.chipRow}>
            {chips.map((c) => {
              const active = filter === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setFilter(c.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipTxt, active && s.chipTxtActive]}>
                    {c.label} {c.count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ paddingHorizontal: SPACING.md, marginBottom: 8 }}>
            <SearchBar value={query} onChangeText={setQuery} placeholder={t('screens.stocksHsnValidation.searchPh')} />
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: 40 }}>
            {filtered.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="checkmark-circle-outline" size={40} color={COLORS.positive} />
                <Text style={s.emptyTitle}>{t('screens.stocksHsnValidation.noItems')}</Text>
                <Text style={s.emptySub}>{t('screens.stocksHsnValidation.noMatch')}</Text>
              </View>
            ) : (
              filtered.map((it) => (
                <View key={it.id} style={s.row}>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    activeOpacity={0.8}
                    onPress={() => safePush(router, `/stocks/item-detail?id=${it.id}&name=${encodeURIComponent(it.name)}` as any)}
                  >
                    <Text style={s.rowName} numberOfLines={1}>{it.displayName || it.name}</Text>
                    <Text style={s.rowMeta} numberOfLines={1}>
                      {it.hsn ? t('screens.stocksHsnValidation.hsnLabel', { hsn: it.hsn }) : t('screens.stocksHsnValidation.noHsn')}
                      {it.group ? ` · ${it.group}` : ''}
                    </Text>
                    {!!it.message && <Text style={s.rowMsg}>{it.message}</Text>}
                  </TouchableOpacity>
                  <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    <View style={[s.badge, it.status === 'ok' && s.badgeOk]}>
                      <Text style={[s.badgeTxt, it.status === 'ok' && s.badgeTxtOk]}>
                        {STATUS_LABEL_KEY[it.status] ? t(STATUS_LABEL_KEY[it.status]) : it.status}
                      </Text>
                    </View>
                    {it.status !== 'ok' && (
                      <TouchableOpacity style={s.enterBtn} onPress={() => openEnterHsn(it)} activeOpacity={0.8}>
                        <Text style={s.enterBtnTxt}>{it.hsn ? t('screens.stocksHsnValidation.editHsn') : t('screens.stocksHsnValidation.enterHsn')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </>
      )}

      <Modal visible={!!enterItem} transparent animationType="slide" onRequestClose={() => setEnterItem(null)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setEnterItem(null)} />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{t('screens.stocksHsnValidation.enterHsn')}</Text>
            <Text style={s.modalSub} numberOfLines={2}>{enterItem?.displayName || enterItem?.name}</Text>
            <TextInput
              style={s.modalInput}
              value={hsnDraft}
              onChangeText={(v) => { setHsnDraft(v); setHsnHint(null); }}
              placeholder={t('screens.stocksHsnValidation.codePh')}
              placeholderTextColor={COLORS.textTertiary}
              keyboardType="number-pad"
              maxLength={8}
              autoFocus
              onBlur={async () => {
                const code = hsnDraft.trim();
                if (!code) { setHsnHint(null); return; }
                try {
                  const res: any = await checkHsnCode(code);
                  if (res?.data?.valid === false) {
                    setHsnHint(t('screens.stocksHsnValidation.invalidHint'));
                  } else setHsnHint(null);
                } catch { setHsnHint(null); }
              }}
            />
            {!!hsnHint && <Text style={s.modalHint}>{hsnHint}</Text>}
            <TouchableOpacity
              style={[s.modalSave, saving && { opacity: 0.6 }]}
              onPress={saveHsn}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.modalSaveTxt}>{t('screens.stocksHsnValidation.saveToTally')}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: { width: 40 },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary,
  },
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: 12,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: RADIUS.full, borderWidth: 1,
    borderColor: COLORS.borderStrong, backgroundColor: COLORS.cardBg,
  },
  chipActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  chipTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  chipTxtActive: { color: '#fff', fontWeight: '600' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  rowName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  rowMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  rowMsg: { fontSize: 11, color: '#92400E', marginTop: 4 },
  badge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: RADIUS.sm, backgroundColor: '#FFFBEB',
  },
  badgeOk: { backgroundColor: '#ECFDF5' },
  badgeTxt: { fontSize: 10, fontWeight: '700', color: '#92400E' },
  badgeTxtOk: { color: '#047857' },
  enterBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: RADIUS.sm, backgroundColor: COLORS.textPrimary,
  },
  enterBtnTxt: { fontSize: 11, fontWeight: '700', color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  emptySub: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, textAlign: 'center', lineHeight: 20 },
  cta: {
    marginTop: 12, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: COLORS.textPrimary, borderRadius: RADIUS.md,
  },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: TYPOGRAPHY.sm },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: SPACING.md, paddingBottom: 32,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong,
    alignSelf: 'center', marginBottom: 12,
  },
  modalTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  modalSub: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginTop: 4, marginBottom: 14 },
  modalInput: {
    height: 44, paddingHorizontal: 12, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderStrong, backgroundColor: COLORS.pageBg,
    fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary,
  },
  modalHint: { fontSize: 11, color: '#92400E', marginTop: 8 },
  modalSave: {
    marginTop: 16, height: 48, borderRadius: RADIUS.md,
    backgroundColor: COLORS.textPrimary, alignItems: 'center', justifyContent: 'center',
  },
  modalSaveTxt: { color: '#fff', fontWeight: '700', fontSize: TYPOGRAPHY.base },
});
