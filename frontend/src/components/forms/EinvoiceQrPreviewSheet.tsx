/**
 * Review sheet for a scanned GST e-Invoice QR (Purchase Invoice).
 * Nothing is written to the form until the user taps Apply; applied fields stay editable
 * and the invoice is never saved from here.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import { EINVOICE_DOC_TYPE_LABEL, einvoiceDateToFormDate, type EinvoiceQrSummary } from '../../utils/einvoiceQr';

export interface EinvoiceVendorMatch {
  name: string;
  gstin: string;
  gst_registration_type?: string;
  parent?: string;
  /** Present in this user's scoped Sundry Creditors picker list. */
  selectable: boolean;
}

export type EinvoiceResolveState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'done';
      matches: EinvoiceVendorMatch[];
      duplicate: { tdk_reference_no: string; tally_voucher_no?: string | null; party_name?: string | null } | null;
    };

interface Props {
  visible: boolean;
  summary: EinvoiceQrSummary | null;
  companyGstin: string | null | undefined;
  resolve: EinvoiceResolveState;
  current: { vendor: string; vendorInvNo: string; vendorInvDate: string };
  preferredVendor?: string | null;
  onCancel: () => void;
  onApply: (vendor: EinvoiceVendorMatch | null, flags: { buyerGstinMismatch: boolean }) => void;
  onAddVendor: () => void;
  onRetryResolve: () => void;
}

const fmtMoney = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EinvoiceQrPreviewSheet({
  visible, summary, companyGstin, resolve, current, preferredVendor,
  onCancel, onApply, onAddVendor, onRetryResolve,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  /** undefined = auto (preferred vendor, or the only match); null = user cleared it. */
  const [picked, setPicked] = useState<string | null | undefined>(undefined);

  const selectable = useMemo(
    () => (resolve.status === 'done' ? resolve.matches.filter(m => m.selectable) : []),
    [resolve],
  );
  const notSelectable = useMemo(
    () => (resolve.status === 'done' ? resolve.matches.filter(m => !m.selectable) : []),
    [resolve],
  );

  const autoPick = preferredVendor && selectable.some(m => m.name === preferredVendor)
    ? preferredVendor
    : selectable.length === 1 ? selectable[0].name : null;
  const effectivePick = picked === null ? null
    : picked !== undefined && selectable.some(m => m.name === picked) ? picked
    : autoPick;

  if (!summary) return null;

  const companyG = (companyGstin || '').trim().toUpperCase();
  const buyerStatus: 'match' | 'mismatch' | 'unknown' =
    !companyG ? 'unknown' : companyG === summary.buyerGstin.toUpperCase() ? 'match' : 'mismatch';
  const unsupportedDoc = summary.docType !== 'INV';
  const duplicate = resolve.status === 'done' ? resolve.duplicate : null;
  const blocked = unsupportedDoc || !!duplicate || resolve.status === 'loading';
  const pickedMatch = selectable.find(m => m.name === effectivePick) || null;

  const formDate = einvoiceDateToFormDate(summary.docDate);
  const replaces: string[] = [];
  if (current.vendorInvNo && current.vendorInvNo !== summary.docNo) replaces.push(t('screens.componentsFormsEinvoiceQrPreviewSheet.replaceInvNo', { value: current.vendorInvNo }));
  if (current.vendorInvDate && current.vendorInvDate !== formDate) replaces.push(t('screens.componentsFormsEinvoiceQrPreviewSheet.replaceInvDate', { value: current.vendorInvDate }));
  if (pickedMatch && current.vendor && current.vendor !== pickedMatch.name) replaces.push(t('screens.componentsFormsEinvoiceQrPreviewSheet.replaceVendor', { value: current.vendor }));

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
      <View style={st.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onCancel} />
        <View style={[st.sheet, { paddingBottom: insets.bottom + SPACING.md }]}>
          <View style={st.handle} />
          <View style={st.titleRow}>
            <Ionicons name="qr-code-outline" size={20} color={COLORS.brandPrimary} />
            <Text style={st.title}>{t('screens.componentsFormsEinvoiceQrPreviewSheet.title')}</Text>
            <View style={st.unverifiedChip}>
              <Ionicons name="shield-outline" size={11} color={COLORS.warning} />
              <Text style={st.unverifiedTxt}>{t('screens.componentsFormsEinvoiceQrPreviewSheet.notVerified')}</Text>
            </View>
          </View>
          <Text style={st.sub}>{t('screens.componentsFormsEinvoiceQrPreviewSheet.sub')}</Text>

          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 10, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            {unsupportedDoc ? (
              <Banner tone="negative" icon="close-circle-outline"
                text={t('screens.componentsFormsEinvoiceQrPreviewSheet.unsupportedDoc', { docType: EINVOICE_DOC_TYPE_LABEL[summary.docType] })} />
            ) : null}
            {duplicate ? (
              <Banner tone="negative" icon="copy-outline"
                text={t('screens.componentsFormsEinvoiceQrPreviewSheet.duplicate', { ref: duplicate.tally_voucher_no || duplicate.tdk_reference_no, party: duplicate.party_name ? ` (${duplicate.party_name})` : '' })} />
            ) : null}
            {buyerStatus === 'mismatch' ? (
              <Banner tone="warning" icon="warning-outline"
                text={t('screens.componentsFormsEinvoiceQrPreviewSheet.buyerMismatch', { buyer: summary.buyerGstin, company: companyG })} />
            ) : buyerStatus === 'unknown' ? (
              <Banner tone="warning" icon="help-circle-outline"
                text={t('screens.componentsFormsEinvoiceQrPreviewSheet.buyerUnknown')} />
            ) : null}

            <View style={st.card}>
              <Row label={t('screens.componentsFormsEinvoiceQrPreviewSheet.vendorInvNo')} value={summary.docNo} />
              <Row label={t('screens.componentsFormsEinvoiceQrPreviewSheet.vendorInvDate')} value={formDate} />
              <Row label={t('screens.componentsFormsEinvoiceQrPreviewSheet.document')} value={EINVOICE_DOC_TYPE_LABEL[summary.docType]} />
              <Row label={t('screens.componentsFormsEinvoiceQrPreviewSheet.invoiceTotal')} value={fmtMoney(summary.totalInvoiceValue)} />
              <Row label={t('screens.componentsFormsEinvoiceQrPreviewSheet.sellerGstin')} value={summary.sellerGstin} />
              <Row label={t('screens.componentsFormsEinvoiceQrPreviewSheet.buyerGstin')} value={summary.buyerGstin}
                badge={buyerStatus === 'match' ? { text: t('screens.componentsFormsEinvoiceQrPreviewSheet.matchesCompany'), tone: 'positive' } : undefined} />
            </View>

            <View style={st.card}>
              <Text style={st.sectionLbl}>{t('screens.componentsFormsEinvoiceQrPreviewSheet.vendor')}</Text>
              {resolve.status === 'loading' ? (
                <View style={st.inline}><ActivityIndicator size="small" color={COLORS.brandPrimary} /><Text style={st.muted}>{t('screens.componentsFormsEinvoiceQrPreviewSheet.finding')}</Text></View>
              ) : resolve.status === 'error' ? (
                <View style={{ gap: 6 }}>
                  <Text style={st.muted}>{t('screens.componentsFormsEinvoiceQrPreviewSheet.lookupFailed')}</Text>
                  <TouchableOpacity onPress={onRetryResolve} style={st.linkBtn}><Ionicons name="refresh" size={14} color={COLORS.brandPrimary} /><Text style={st.linkTxt}>{t('common.retry')}</Text></TouchableOpacity>
                </View>
              ) : selectable.length === 0 ? (
                <View style={{ gap: 6 }}>
                  <Text style={st.muted}>{t('screens.componentsFormsEinvoiceQrPreviewSheet.noVendor', { gstin: summary.sellerGstin })}</Text>
                  {notSelectable.map(m => (
                    <Text key={m.name} style={st.mutedSmall}>{t('screens.componentsFormsEinvoiceQrPreviewSheet.foundElsewhere', { name: m.name, group: m.parent || t('screens.componentsFormsEinvoiceQrPreviewSheet.anotherGroup') })}</Text>
                  ))}
                  <TouchableOpacity onPress={onAddVendor} style={st.linkBtn}><Ionicons name="add-circle-outline" size={15} color={COLORS.brandPrimary} /><Text style={st.linkTxt}>{t('screens.componentsFormsEinvoiceQrPreviewSheet.addVendor')}</Text></TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 6 }}>
                  {selectable.length > 1 ? <Text style={st.mutedSmall}>{t('screens.componentsFormsEinvoiceQrPreviewSheet.multipleVendors')}</Text> : null}
                  {selectable.map(m => {
                    const on = effectivePick === m.name;
                    return (
                      <TouchableOpacity key={m.name} style={[st.vendorOpt, on && st.vendorOptOn]} onPress={() => setPicked(on ? null : m.name)} activeOpacity={0.7}>
                        <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? COLORS.brandPrimary : COLORS.textTertiary} />
                        <View style={{ flex: 1 }}>
                          <Text style={st.vendorName}>{m.name}</Text>
                          <Text style={st.mutedSmall}>{m.gstin}{m.gst_registration_type ? ` · ${m.gst_registration_type}` : ''}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <Banner tone="info" icon="list-outline"
              text={t(summary.itemCount === 1 ? 'screens.componentsFormsEinvoiceQrPreviewSheet.qrItemsOne' : 'screens.componentsFormsEinvoiceQrPreviewSheet.qrItemsMany', { count: summary.itemCount, hsn: summary.mainHsnCode ? t('screens.componentsFormsEinvoiceQrPreviewSheet.mainHsn', { code: summary.mainHsnCode }) : '' })} />

            {replaces.length > 0 && !blocked ? (
              <Banner tone="warning" icon="swap-horizontal-outline" text={t('screens.componentsFormsEinvoiceQrPreviewSheet.willReplace', { list: replaces.join(', ') })} />
            ) : null}
          </ScrollView>

          <View style={st.btnRow}>
            <TouchableOpacity style={st.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={st.cancelTxt}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.applyBtn, blocked && { opacity: 0.45 }]}
              disabled={blocked}
              onPress={() => onApply(pickedMatch, { buyerGstinMismatch: buyerStatus === 'mismatch' })}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark" size={16} color={COLORS.white} />
              <Text style={st.applyTxt}>{t('screens.componentsFormsEinvoiceQrPreviewSheet.applyToForm')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, badge }: { label: string; value: string; badge?: { text: string; tone: 'positive' } }) {
  return (
    <View style={st.row}>
      <Text style={st.rowLbl}>{label}</Text>
      <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>
        <Text style={st.rowVal} selectable>{value}</Text>
        {badge ? <Text style={st.badgePositive}>{badge.text}</Text> : null}
      </View>
    </View>
  );
}

function Banner({ tone, icon, text }: { tone: 'negative' | 'warning' | 'info'; icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const c = tone === 'negative'
    ? { bg: COLORS.negativeBg, fg: COLORS.negative }
    : tone === 'warning' ? { bg: COLORS.warningBg, fg: COLORS.warning } : { bg: COLORS.infoBg, fg: COLORS.info };
  return (
    <View style={[st.banner, { backgroundColor: c.bg }]}>
      <Ionicons name={icon} size={16} color={c.fg} />
      <Text style={[st.bannerTxt, { color: COLORS.textPrimary }]}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: SPACING.lg, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary },
  unverifiedChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.warningBg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  unverifiedTxt: { fontSize: 11, fontWeight: '700', color: COLORS.warning },
  sub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 4, marginBottom: 12 },
  card: { borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, padding: 12, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLbl: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  rowVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'right' },
  badgePositive: { fontSize: 11, fontWeight: '600', color: COLORS.positive, marginTop: 2 },
  sectionLbl: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muted: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  mutedSmall: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 4 },
  linkTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary },
  vendorOpt: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, padding: 10 },
  vendorOptOn: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandPrimary + '10' },
  vendorName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: RADIUS.sm, padding: 10 },
  bannerTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, lineHeight: 17 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingVertical: 13 },
  cancelTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
  applyBtn: { flex: 2, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 13 },
  applyTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
