import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { currentTenantKey, logoFeature, dropLegacyKeys } from '../../src/utils/tenantStorage';
import { getCompanyProfile, uploadCompanyLogo, getCompanyLogo } from '../../src/services/api';
import { useTranslation } from 'react-i18next';

// ── Tally formatting ──────────────────────────────────────────────────────────
const TALLY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Tally dates arrive as YYYYMMDD (demo data as YYYY-MM-DD); shown the way Tally shows them. */
function formatTallyDate(value: unknown): string {
  const raw = String(value ?? '').trim();
  const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(raw);
  const month = m ? TALLY_MONTHS[Number(m[2]) - 1] : undefined;
  return m && month ? `${Number(m[3])}-${month}-${m[1]}` : raw;
}

function formatSyncedAt(value: unknown): string {
  const n = Number(value);
  if (!n) return '';
  return new Date(n < 1e12 ? n * 1000 : n).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function TallyField({ label, value, last }: { label: string; value?: string | null; last?: boolean }) {
  return (
    <View style={[s.fieldWrap, !last && s.fieldBorder]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={s.fieldValue} selectable>{value || '—'}</Text>
    </View>
  );
}

type Loaded = { guid: string; profile: Record<string, any> | null; error: string };

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CompanyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { company } = useAuth();
  const { isOwner, hasCapability } = useWorkspace();
  const canEditLogo = isOwner || hasCapability('company.profile.edit');
  const companyGuid = company?.guid;

  // Tally company master for the selected company, read-only.
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!companyGuid) return;
    let cancelled = false;
    getCompanyProfile(companyGuid)
      .then((res: any) => {
        if (!cancelled) setLoaded({ guid: companyGuid, profile: res?.data || {}, error: '' });
      })
      .catch((err: any) => {
        if (!cancelled) setLoaded({ guid: companyGuid, profile: null, error: err?.message || '' });
      });
    return () => { cancelled = true; };
  }, [companyGuid, reloadKey]);

  const current = loaded?.guid === companyGuid ? loaded : null;
  const profile = current?.profile || null;
  const loading = !!companyGuid && !current;

  // Logo — load from backend (cross-device), fallback to AsyncStorage cache
  const [logo, setLogo] = useState<{ guid: string; uri: string | null } | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoUri = logo && logo.guid === companyGuid ? logo.uri : null;

  useEffect(() => {
    if (!companyGuid) return;
    let cancelled = false;
    const cacheKey = currentTenantKey(companyGuid, logoFeature());
    dropLegacyKeys([`company_logo_${companyGuid}`]);
    const fromCache = () => AsyncStorage.getItem(cacheKey)
      .then(uri => { if (!cancelled) setLogo({ guid: companyGuid, uri: uri || null }); })
      .catch(() => {});
    getCompanyLogo(companyGuid).then((res: any) => {
      const url = res?.data?.logo_url;
      if (!url) return fromCache();
      if (!cancelled) setLogo({ guid: companyGuid, uri: url });
      AsyncStorage.setItem(cacheKey, url).catch(() => {});
    }).catch(fromCache);
    return () => { cancelled = true; };
  }, [companyGuid]);

  const pickLogo = async () => {
    if (!companyGuid || logoUploading || !canEditLogo) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('screens.settingsCompany.permissionNeeded'), t('screens.settingsCompany.permissionMsg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    const guid = companyGuid;
    const previous = logoUri;
    const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
    setLogo({ guid, uri: dataUri });
    setLogoUploading(true);
    try {
      await uploadCompanyLogo(guid, dataUri);
      AsyncStorage.setItem(currentTenantKey(guid, logoFeature()), dataUri).catch(() => {});
      Toast.show({ type: 'success', text1: t('company.logoUpdated'), text2: t('company.logoUpdatedDesc') });
    } catch (err: any) {
      setLogo(cur => (cur?.guid === guid ? { guid, uri: previous } : cur));
      Toast.show({ type: 'error', text1: t('company.logoUploadFailed'), text2: err?.message || t('common.tryAgain') });
    } finally {
      setLogoUploading(false);
    }
  };

  const retry = () => {
    setLoaded(null);
    setReloadKey(k => k + 1);
  };

  const syncedAt = formatSyncedAt(profile?.profile_synced_at);

  return (
    <SafeAreaView style={s.safe}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('company.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Company Logo ── */}
        <View style={s.logoSection}>
          <TouchableOpacity style={s.logoWrap} onPress={pickLogo} activeOpacity={0.85} disabled={logoUploading || !canEditLogo}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={s.logoImg} resizeMode="contain" />
            ) : (
              <View style={s.logoPlaceholder}>
                <Text style={s.logoInitials}>
                  {(company?.name || 'CO').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            {logoUploading ? (
              <View style={s.cameraBadge}><ActivityIndicator size="small" color={COLORS.white} /></View>
            ) : canEditLogo ? (
              <View style={s.cameraBadge}><Ionicons name="camera" size={13} color={COLORS.white} /></View>
            ) : null}
          </TouchableOpacity>
          <Text style={s.logoLabel}>{t('company.logo')}</Text>
          <Text style={s.logoHint}>{t(canEditLogo ? 'company.logoHint' : 'company.readOnly')}</Text>
        </View>

        {/* ── Tally notice ── */}
        <View style={s.notice}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.info} />
          <Text style={s.noticeText}>{t('company.tallyNotice')}</Text>
        </View>

        {loading ? (
          <View style={s.stateBox}>
            <ActivityIndicator size="small" color={COLORS.brandPrimary} />
          </View>
        ) : current?.error ? (
          <View style={s.stateBox}>
            <Text style={s.stateTitle}>{t('company.loadFailed')}</Text>
            <Text style={s.stateHint}>{current.error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={retry} activeOpacity={0.7}>
              <Text style={s.retryText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── Company Identity ── */}
            <View style={s.card}>
              <Text style={s.cardTitle}>{t('company.identity')}</Text>
              <TallyField label={t('company.name')} value={profile?.name || company?.name} />
              <TallyField label={t('company.mailingName')} value={profile?.formal_name} />
              <TallyField label={t('company.gstin')} value={profile?.gstin} />
              <TallyField label={t('company.pan')} value={profile?.pan} last />
            </View>

            {/* ── Contact Details ── */}
            <View style={s.card}>
              <Text style={s.cardTitle}>{t('company.contact')}</Text>
              <TallyField label={t('company.address')} value={profile?.address} />
              <TallyField label={t('company.state')} value={profile?.state} />
              <TallyField label={t('company.country')} value={profile?.country} />
              <TallyField label={t('company.pincode')} value={profile?.pincode} />
              <TallyField label={t('company.email')} value={profile?.email} />
              <TallyField label={t('company.mobile')} value={profile?.mobile} />
              <TallyField label={t('company.phone')} value={profile?.phone} />
              <TallyField label={t('company.website')} value={profile?.website} last />
            </View>

            {/* ── Financial Year ── */}
            <View style={s.card}>
              <Text style={s.cardTitle}>{t('company.financial')}</Text>
              <TallyField label={t('company.fyBeginning')} value={formatTallyDate(profile?.fy_start)} />
              <TallyField label={t('company.booksBeginning')} value={formatTallyDate(profile?.books_from)} last />
            </View>

            <Text style={s.syncedText}>
              {syncedAt ? t('company.tallySyncedAt', { time: syncedAt }) : t('company.tallyNotSynced')}
            </Text>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: {
    flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700',
    color: COLORS.textPrimary, textAlign: 'center',
  },
  scroll: { flex: 1 },

  // Logo
  logoSection: {
    alignItems: 'center', paddingTop: SPACING.lg, paddingBottom: SPACING.md,
  },
  logoWrap: { position: 'relative', marginBottom: 8 },
  logoImg: {
    width: 90, height: 90, borderRadius: 12,
    backgroundColor: COLORS.borderDefault,
  },
  logoPlaceholder: {
    width: 90, height: 90, borderRadius: 12,
    backgroundColor: COLORS.cardBg,
    borderWidth: 2, borderColor: COLORS.borderDefault, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  logoInitials: {
    fontSize: 28, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 1,
  },
  cameraBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: COLORS.pageBg,
  },
  logoLabel: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '600',
    color: COLORS.textPrimary, marginBottom: 3,
  },
  logoHint: { fontSize: 11, color: COLORS.textTertiary },

  // Tally notice
  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: SPACING.md, padding: SPACING.md,
    backgroundColor: COLORS.infoBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  noticeText: {
    flex: 1, fontSize: TYPOGRAPHY.sm, lineHeight: 19,
    color: COLORS.textPrimary, fontWeight: '500',
  },

  // Cards
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md, marginTop: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: SPACING.sm,
  },

  // Fields
  fieldWrap:   { paddingVertical: 12 },
  fieldBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  fieldLabel:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginBottom: 5 },
  fieldValue:  { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },

  syncedText: {
    fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary,
    marginHorizontal: SPACING.md, marginTop: SPACING.md,
  },

  // Loading / error
  stateBox: {
    alignItems: 'center', gap: 6,
    marginHorizontal: SPACING.md, marginTop: SPACING.md, padding: SPACING.lg,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  stateTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  stateHint:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center' },
  retryBtn: {
    marginTop: 6, paddingHorizontal: 16, paddingVertical: 7,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.full,
  },
  retryText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
});
