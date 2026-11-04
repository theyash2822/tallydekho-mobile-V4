/**
 * "Needs attention" → Fix sheet (spec §2.6). HSN gaps write each item with
 * POST /tally/master/stock-item-alter, party gaps write POST /tally/master/party-alter;
 * company / numbering / portal gaps only explain where to change things. An invoice dated
 * today whose gap is the invoice's own (totals, lines, dispatch, portal refusal) can be
 * corrected here: Correct invoice opens the create form on the same Tally voucher (spec 2026-11-04 §4.3).
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import { BottomModalShell } from '../forms/BottomModalShell';
import FormField from '../forms/FormField';
import { alterParty, alterStockItem } from '../../services/api';
import type { ReadinessGap, ReadinessRow } from '../../services/api';
import { SheetFooter } from './ComplianceSheets';
import { correctableRow, correctionReason, isInvoiceGap } from '../../utils/complianceRules';

type Props = {
  visible: boolean;
  row: ReadinessRow | null;
  companyGuid: string;
  companyName?: string;
  onClose: () => void;
  /** Called after a Tally write was queued so the list re-fetches readiness. */
  onSaved: () => void;
  /** `IRN_REQUIRED` gap on the EWB list → open the IRN confirmation for this row. */
  onRegisterEinvoiceFirst?: (row: ReadinessRow) => void;
  /** E-invoice list: open the correction form for a today-dated invoice (reason = what the portal said). */
  onCorrectInvoice?: (row: ReadinessRow, reason?: string) => void;
};

function gapKind(g: ReadinessGap): 'hsn' | 'party' | 'dispatch' | 'einvoice_first' | 'info' {
  const type = String(g?.fix?.type || '');
  if (type === 'stock_item_hsn' || g.code === 'HSN_MISSING') return 'hsn';
  if (type === 'party' || /^BUYER_/.test(g.code)) return 'party';
  if (type === 'dispatch' || g.code === 'DISPATCH_MISSING') return 'dispatch';
  if (type === 'einvoice_first' || g.code === 'IRN_REQUIRED') return 'einvoice_first';
  return 'info';
}

export default function FixGapSheet({ visible, row, companyGuid, companyName, onClose, onSaved, onRegisterEinvoiceFirst, onCorrectInvoice }: Props) {
  const { t } = useTranslation();
  const gaps: ReadinessGap[] = Array.isArray(row?.gaps) ? row!.gaps! : [];
  const [hsn, setHsn] = useState<Record<string, string>>({});
  const [party, setParty] = useState({ gstin: '', pincode: '', state: '' });
  const [busy, setBusy] = useState(false);
  // Inputs belong to one voucher: clear them when the sheet opens for another row.
  const [prevRowKey, setPrevRowKey] = useState<string | null>(null);
  const rowKey = visible && row ? String(row.guid) : null;
  if (rowKey && prevRowKey !== rowKey) {
    setPrevRowKey(rowKey);
    setHsn({});
    setParty({ gstin: '', pincode: '', state: '' });
  }

  const hsnGap = gaps.find((g) => gapKind(g) === 'hsn');
  const partyGap = gaps.find((g) => gapKind(g) === 'party');
  const hsnItems: { name: string; guid?: string }[] = Array.isArray(hsnGap?.fix?.items) ? hsnGap!.fix.items : [];
  const partyFields: string[] = Array.isArray(partyGap?.fix?.fields) ? partyGap!.fix.fields : ['gstin'];
  const canSave = !!(hsnGap && hsnItems.some((i) => (hsn[i.name] || '').trim())) || !!(partyGap && partyFields.some((f) => (party as any)[f]?.trim()));

  const explain = (g: ReadinessGap): string => {
    switch (gapKind(g)) {
      case 'dispatch': return t('screens.reportsEwbList.gapDispatch', { defaultValue: 'Add the dispatch details in the Generate step; nothing changes in Tally.' });
      case 'einvoice_first': return t('screens.reportsEwbList.gapIrnFirst', { defaultValue: 'E-invoicing is active for this company, so the invoice needs an IRN before an e-way bill.' });
      default: break;
    }
    switch (g.code) {
      case 'COMPANY_PINCODE_MISSING':
      case 'COMPANY_STATE_MISSING':
        return t('screens.reportsEinvoiceList.gapCompany', { defaultValue: 'Set the company address, state and pincode in Tally (Company → Alter); it reaches here with the next sync. Settings → Company shows what is synced.' });
      case 'DOC_NO_INVALID':
        return t('screens.reportsEinvoiceList.gapNumbering', { defaultValue: 'The portal accepts up to 16 characters: letters, digits, / and -. Change the voucher numbering in Tally.' });
      case 'TOTAL_MISMATCH':
        return t('screens.reportsEinvoiceList.gapTotal', { defaultValue: 'Line totals and the voucher total differ. Correct the voucher in Tally.' });
      case 'PORTAL_REJECTED':
        return t('screens.reportsEinvoiceList.gapPortal', { defaultValue: 'The portal rejected the last attempt. Fix the reason below and generate again.' });
      case 'NO_LINES':
        return t('screens.reportsEinvoiceList.gapNoLines', { defaultValue: 'The voucher has no item lines; add them in Tally.' });
      case 'LEDGER_HSN_MISSING':
        return t('screens.reportsEinvoiceList.gapLedgerHsn', {
          defaultValue: 'No stock items here, so each sales ledger line goes with the HSN/SAC of the ledger. Set HSN/SAC and GST rate in the GST details of {{ledgers}} in Tally, then sync.',
          ledgers: (Array.isArray(g.fix?.ledgers) ? g.fix.ledgers : []).map((l: any) => l?.name).filter(Boolean).join(', '),
        });
      case 'IRN_CANCELLED':
        return t('screens.reportsEwbList.gapIrnCancelled', { defaultValue: 'The e-invoice of this invoice was cancelled, so no e-way bill can be made from it. If the goods still move, raise a fresh invoice in Tally and register that.' });
      case 'FUTURE_DATED':
        return t('screens.reportsEinvoiceList.gapFutureDated', { defaultValue: 'The portal accepts a document only from its own date. This invoice is dated after today; it moves to Ready on that date.' });
      default:
        return '';
    }
  };

  const save = async () => {
    if (!row || !companyGuid) return;
    setBusy(true);
    let wrote = 0;
    try {
      if (hsnGap) {
        for (const item of hsnItems) {
          const code = (hsn[item.name] || '').trim();
          if (!code) continue;
          await alterStockItem({ companyGuid, companyName, existingName: item.name, changes: { hsnCode: code }, voucherGuid: row.guid || undefined });
          wrote += 1;
        }
      }
      if (partyGap) {
        const body: any = { companyGuid, voucherGuid: row.guid || undefined };
        if (partyGap.fix?.party_guid) body.ledgerGuid = partyGap.fix.party_guid;
        body.ledgerName = partyGap.fix?.party_name || row.party_name;
        if (party.gstin.trim()) body.gstin = party.gstin.trim().toUpperCase();
        if (party.pincode.trim()) body.pincode = party.pincode.trim();
        if (party.state.trim()) body.state = party.state.trim();
        if (body.gstin || body.pincode || body.state) {
          await alterParty(body);
          wrote += 1;
        }
      }
      if (wrote > 0) {
        Toast.show({
          type: 'success',
          text1: t('screens.reportsEinvoiceList.sentToTally', { defaultValue: 'Sent to Tally' }),
          text2: t('screens.reportsEinvoiceList.sentToTallySub', { defaultValue: 'The row moves to Ready after the next sync.' }),
        });
        onSaved();
        onClose();
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('screens.reportsEinvoiceList.couldNotSaveToTally', { defaultValue: 'Could not send the change to Tally.' }));
    } finally {
      setBusy(false);
    }
  };

  const einvoiceFirst = gaps.find((g) => gapKind(g) === 'einvoice_first');
  // The first gap the correction screen can put right carries the Correct invoice button.
  const correctGapIdx = onCorrectInvoice && row && correctableRow(row) ? gaps.findIndex(isInvoiceGap) : -1;

  return (
    <BottomModalShell
      visible={visible}
      onClose={onClose}
      title={t('screens.reportsEinvoiceList.fixTitle', { number: row?.voucher_number || '', defaultValue: 'Fix {{number}}' })}
      footer={(hsnGap || partyGap) ? (
        <SheetFooter onCancel={onClose} busy={busy} disabled={!canSave} confirmLabel={t('screens.reportsEinvoiceList.saveToTally', { defaultValue: 'Save to Tally' })} onConfirm={save} />
      ) : einvoiceFirst && onRegisterEinvoiceFirst && row ? (
        <SheetFooter onCancel={onClose} confirmLabel={t('screens.reportsEwbList.registerEinvoiceFirst', { defaultValue: 'Register e-invoice first' })} onConfirm={() => { onClose(); onRegisterEinvoiceFirst(row); }} />
      ) : undefined}
    >
      {gaps.map((g, idx) => {
        const kind = gapKind(g);
        return (
          <View key={`${g.code}-${idx}`} style={s.gap}>
            <View style={s.gapHead}>
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
              <Text style={s.gapMsg}>{g.message}</Text>
            </View>
            {kind === 'hsn' && hsnItems.map((item) => (
              <FormField
                key={item.guid || item.name}
                label={item.name}
                value={hsn[item.name] || ''}
                onChangeText={(v) => setHsn((p) => ({ ...p, [item.name]: v.replace(/\D/g, '').slice(0, 8) }))}
                keyboardType="numeric"
                placeholder={t('screens.reportsEinvoiceList.hsnPh', { defaultValue: 'HSN / SAC code' })}
              />
            ))}
            {kind === 'party' && (
              <View>
                {partyFields.includes('gstin') && (
                  <FormField label={t('company.gstin')} value={party.gstin} onChangeText={(v) => setParty((p) => ({ ...p, gstin: v.toUpperCase() }))} autoCapitalize="characters" maxLength={15} placeholder={t('screens.settingsEinvoice.gstinPh')} />
                )}
                {partyFields.includes('pincode') && (
                  <FormField label={t('screens.reportsEinvoiceList.pincode', { defaultValue: 'Pincode' })} value={party.pincode} onChangeText={(v) => setParty((p) => ({ ...p, pincode: v.replace(/\D/g, '').slice(0, 6) }))} keyboardType="numeric" />
                )}
                {partyFields.includes('state') && (
                  <FormField label={t('screens.reportsEinvoiceList.state', { defaultValue: 'State' })} value={party.state} onChangeText={(v) => setParty((p) => ({ ...p, state: v }))} />
                )}
              </View>
            )}
            {(kind === 'info' || kind === 'dispatch' || kind === 'einvoice_first') && !!explain(g) && (
              <Text style={s.explain}>{explain(g)}</Text>
            )}
            {idx === correctGapIdx && row && onCorrectInvoice && (
              <View style={s.correct}>
                <Text style={s.correctTxt}>{t('screens.reportsEinvoiceList.correctHere')}</Text>
                <TouchableOpacity style={s.correctBtn} onPress={() => onCorrectInvoice(row, correctionReason(gaps))} activeOpacity={0.85} testID="gap-correct-invoice">
                  <Ionicons name="create-outline" size={14} color={COLORS.white} />
                  <Text style={s.correctBtnTxt}>{t('screens.reportsEinvoiceList.correctInvoice')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
      {gaps.length === 0 && <Text style={s.explain}>{t('screens.reportsEinvoiceList.noGaps', { defaultValue: 'Nothing to fix.' })}</Text>}
    </BottomModalShell>
  );
}

const s = StyleSheet.create({
  gap: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, marginBottom: 4 },
  gapHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  gapMsg: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 20 },
  explain: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20, backgroundColor: COLORS.pageBg, padding: SPACING.sm, borderRadius: RADIUS.md },
  correct: { marginTop: SPACING.sm, gap: 8 },
  correctTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, lineHeight: 20 },
  correctBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 9, paddingHorizontal: 14 },
  correctBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
});
