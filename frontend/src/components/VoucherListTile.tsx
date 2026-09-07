/**
 * Shared voucher list row — compact 2-column layout.
 *
 * Left:  party · voucher no · date
 * Right: amount
 *        [type chip] [Paid/Unpaid]  ← same row
 *
 * Type chips: remapped multi-color (no red / green / black-white).
 * Paid = green, Unpaid = red.
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, TYPOGRAPHY, RADIUS } from '../constants/colors';
import { VoucherTypeBadge } from './voucherHomeFilters';

/** Flatten Tally multi-party JSON ledger labels for list tiles. */
export function formatPartyLabel(raw?: string | null): string {
  if (raw == null) return '';
  const t = String(raw).trim();
  if (!t) return '';
  if (t.startsWith('[')) {
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x ?? '').trim()).filter(Boolean).join(', ');
      }
    } catch { /* ignore */ }
    return t.replace(/^\[|\]$/g, '').replace(/"/g, '').split(',').map((s) => s.trim()).filter(Boolean).join(', ');
  }
  return t;
}

export const PAYMENT_STATUS_COLOR: Record<string, string> = {
  paid:   '#2D7D46',
  unpaid: '#DC2626',
};
export const PAYMENT_STATUS_BG: Record<string, string> = {
  paid:   '#F0FBF4',
  unpaid: '#FFF0F0',
};
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid:   'Paid',
  unpaid: 'Unpaid',
};

/** Paid (green) / Unpaid (red) chip. */
export function PaymentStatusBadge({ status }: { status: string }) {
  const key = String(status || '').toLowerCase();
  const color = PAYMENT_STATUS_COLOR[key] ?? COLORS.textTertiary;
  const bg = PAYMENT_STATUS_BG[key] ?? '#F5F5F5';
  const label = PAYMENT_STATUS_LABEL[key] ?? status;
  return (
    <View style={[st.statusBadge, { backgroundColor: bg, borderColor: color }]}>
      <Text style={[st.statusTxt, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** Direct / Indirect — theme info blue / warning amber (not red/green/B&W). */
export function ExpenseTypeBadge({ type }: { type: 'direct' | 'indirect' | string }) {
  const isDirect = String(type).toLowerCase() === 'direct';
  const color = isDirect ? '#2563EB' : '#D97706';
  const bg = isDirect ? '#EFF6FF' : '#FFFBEB';
  return (
    <View style={[st.typePill, { backgroundColor: bg, borderColor: color + '66' }]}>
      <Text style={[st.typePillTxt, { color }]}>
        {isDirect ? 'Direct' : 'Indirect'}
      </Text>
    </View>
  );
}

export type VoucherListTileProps = {
  party: string;
  voucherNo: string;
  date: string;
  amount: string;
  status?: string;
  module?: 'sales' | 'purchase';
  docType?: string;
  voucherType?: string;
  isOptional?: boolean;
  /** Override type chip (e.g. ExpenseTypeBadge). Wins over module badge. */
  typeBadge?: React.ReactNode;
  hideStatus?: boolean;
  style?: ViewStyle;
};

export function VoucherListTile({
  party,
  voucherNo,
  date,
  amount,
  status,
  module,
  docType,
  voucherType,
  isOptional,
  typeBadge,
  hideStatus,
  style,
}: VoucherListTileProps) {
  const typeNode = typeBadge ?? (
    module ? (
      <VoucherTypeBadge
        module={module}
        docType={docType}
        voucher_type={voucherType}
        is_optional={isOptional}
      />
    ) : null
  );

  const showStatus = !hideStatus && !!status;
  const showChipRow = !!typeNode || showStatus;

  return (
    <View style={[st.row, style]}>
      <View style={st.left}>
        <Text style={st.party} numberOfLines={1}>{formatPartyLabel(party) || '—'}</Text>
        <Text style={st.id} numberOfLines={1}>{voucherNo || '—'}</Text>
        <Text style={st.date} numberOfLines={1}>{date || ''}</Text>
      </View>
      <View style={st.right}>
        <Text style={st.amount} numberOfLines={1}>{amount}</Text>
        {showChipRow ? (
          <View style={st.chipRow}>
            {typeNode}
            {showStatus ? <PaymentStatusBadge status={status!} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flex: 1,
  },
  left: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
    maxWidth: '52%',
    flexShrink: 0,
  },
  party: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  id: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
    lineHeight: 15,
  },
  date: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textTertiary,
    lineHeight: 15,
  },
  amount: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'right',
    lineHeight: 18,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 4,
  },
  typePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    maxWidth: 110,
  },
  typePillTxt: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  statusTxt: {
    fontSize: 9,
    fontWeight: '700',
  },
});
