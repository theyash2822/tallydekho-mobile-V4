/**
 * Shared voucher list row — clean 2-column layout.
 *
 * Left (start):  party · voucher no · date
 * Right (end):   type badge · amount · status badge
 *
 * No status dot, no circular return-arrow icon.
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, TYPOGRAPHY, RADIUS } from '../constants/colors';
import { VoucherTypeBadge } from './voucherHomeFilters';

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

/** Colored payment-status chip (Paid / Unpaid). */
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

/** Direct / Indirect expense type chip. */
export function ExpenseTypeBadge({ type }: { type: 'direct' | 'indirect' | string }) {
  const isDirect = String(type).toLowerCase() === 'direct';
  return (
    <View style={[st.typePill, isDirect ? st.typeDirect : st.typeIndirect]}>
      <Text style={[st.typePillTxt, isDirect ? st.typeDirectTxt : st.typeIndirectTxt]}>
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
  /** Payment status key — renders PaymentStatusBadge when set. */
  status?: string;
  /** Sales/Purchase: built-in VoucherTypeBadge. */
  module?: 'sales' | 'purchase';
  docType?: string;
  voucherType?: string;
  isOptional?: boolean;
  /** Override / custom type chip (e.g. ExpenseTypeBadge). Wins over module badge. */
  typeBadge?: React.ReactNode;
  /** Hide status chip (e.g. if not applicable). */
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

  return (
    <View style={[st.row, style]}>
      <View style={st.left}>
        <Text style={st.party} numberOfLines={1}>{party || '—'}</Text>
        <Text style={st.id} numberOfLines={1}>{voucherNo || '—'}</Text>
        <Text style={st.date} numberOfLines={1}>{date || ''}</Text>
      </View>
      <View style={st.right}>
        {typeNode ? <View style={st.typeWrap}>{typeNode}</View> : null}
        <Text style={st.amount} numberOfLines={1}>{amount}</Text>
        {showStatus ? <PaymentStatusBadge status={status!} /> : null}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flex: 1,
  },
  left: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
    maxWidth: '48%',
  },
  party: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  id: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  date: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textTertiary,
  },
  typeWrap: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignSelf: 'flex-end',
  },
  statusTxt: {
    fontSize: 10,
    fontWeight: '700',
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignSelf: 'flex-end',
  },
  typeDirect: { backgroundColor: '#EFF6FF', borderColor: '#2563EB66' },
  typeIndirect: { backgroundColor: '#FFF7ED', borderColor: '#EA580C66' },
  typePillTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  typeDirectTxt: { color: '#2563EB' },
  typeIndirectTxt: { color: '#EA580C' },
});
