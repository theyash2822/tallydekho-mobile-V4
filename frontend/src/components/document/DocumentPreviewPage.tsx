import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Share, Alert, Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import { VoucherDocument } from '../../types/document';
import { formatCurrency, amountInWords, DOC_TYPE_CONFIG, generateDocumentHTML } from '../../utils/documentHelpers';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { getUserSettings, getCompanyLogo } from '../../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Voucher config constants (mirrors voucher-config.tsx)
// ─────────────────────────────────────────────────────────────────────────────
const VOUCHER_CONFIG_KEY = 'voucherConfig';

const DOC_TYPE_TO_CONFIG_ID: Record<string, string> = {
  'sales_invoice':    'sales_inv',
  'purchase_invoice': 'purchase_inv',
  'sales_order':      'sales_order',
  'purchase_order':   'purchase_order',
  'quotation':        'quotation',
  'credit_note':      'credit_note',
  'debit_note':       'debit_note',
  'delivery_note':    'delivery_note',
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility Components
// ─────────────────────────────────────────────────────────────────────────────

const Divider = ({ style }: { style?: object }) => (
  <View style={[{ height: 1, backgroundColor: COLORS.borderDefault }, style]} />
);

const SectionLabel = ({ title }: { title: string }) => (
  <View style={ds.sectionLabelWrap}>
    <View style={ds.sectionLabelAccent} />
    <Text style={ds.sectionLabelText}>{title}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// DocNavBar — top navigation bar
// ─────────────────────────────────────────────────────────────────────────────
function DocNavBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={ds.navBar}>
      <TouchableOpacity onPress={onBack} style={ds.navBack} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Text style={ds.navTitle} numberOfLines={1}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DocHeader — company letterhead + document type badge + number + date
// ─────────────────────────────────────────────────────────────────────────────
function DocHeader({ doc }: { doc: VoucherDocument }) {
  const cfg = DOC_TYPE_CONFIG[doc.documentType] ?? {
    label: String(doc.documentType).replace(/_/g, ' '),
    color: '#374151',
    bg: '#F3F4F6',
  };
  return (
    <View style={ds.card}>
      {/* Document type badge */}
      <View style={[ds.docBadge, { backgroundColor: cfg.bg }]}>
        <Text style={[ds.docBadgeText, { color: cfg.color }]}>
          {cfg.label.toUpperCase()}
        </Text>
      </View>

      {/* Company name */}
      <Text style={ds.companyName}>{doc.company.name}</Text>
      <Text style={ds.companyAddress}>{doc.company.address}</Text>

      {/* GSTIN + PAN chips */}
      <View style={ds.chipRow}>
        {doc.company.gstin && (
          <View style={ds.chip}>
            <Text style={ds.chipLabel}>GSTIN </Text>
            <Text style={ds.chipValue}>{doc.company.gstin}</Text>
          </View>
        )}
        {doc.company.pan && (
          <View style={ds.chip}>
            <Text style={ds.chipLabel}>PAN </Text>
            <Text style={ds.chipValue}>{doc.company.pan}</Text>
          </View>
        )}
      </View>

      {/* Contact row */}
      {(doc.company.phone || doc.company.email) && (
        <View style={ds.contactRow}>
          {doc.company.phone && (
            <View style={ds.contactItem}>
              <Ionicons name="call-outline" size={11} color={COLORS.textTertiary} />
              <Text style={ds.contactText}>{doc.company.phone}</Text>
            </View>
          )}
          {doc.company.email && (
            <View style={ds.contactItem}>
              <Ionicons name="mail-outline" size={11} color={COLORS.textTertiary} />
              <Text style={ds.contactText}>{doc.company.email}</Text>
            </View>
          )}
        </View>
      )}

      <Divider style={{ marginVertical: 16 }} />

      {/* Document number + date row */}
      <View style={ds.docMetaRow}>
        <View style={{ flex: 1 }}>
          <Text style={ds.metaSmallLabel}>DOCUMENT NO.</Text>
          <Text style={ds.docNumber}>{doc.documentNumber}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={ds.metaSmallLabel}>DATE</Text>
          <Text style={ds.docDate}>{doc.date}</Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PartySection — Bill To / Ship To
// ─────────────────────────────────────────────────────────────────────────────
function PartySection({ doc }: { doc: VoucherDocument }) {
  if (!doc.party && !doc.billing && !doc.shipping) return null;

  const hasShipping = !!(doc.shipping?.line1 || doc.shipping?.city);

  return (
    <View style={ds.card}>
      <SectionLabel title="PARTY DETAILS" />
      <View style={ds.partyRow}>
        {/* Bill To */}
        <View style={{ flex: 1 }}>
          <Text style={ds.partyColLabel}>BILL TO</Text>
          <Text style={ds.partyName}>
            {doc.party?.name || doc.billing?.name || '—'}
          </Text>
          {doc.billing?.line1 && (
            <Text style={ds.partyAddr}>{doc.billing.line1}</Text>
          )}
          {(doc.billing?.city || doc.billing?.state) && (
            <Text style={ds.partyAddr}>
              {[doc.billing?.city, doc.billing?.state, doc.billing?.pincode]
                .filter(Boolean)
                .join(', ')}
            </Text>
          )}
          {doc.party?.gstin && (
            <Text style={ds.partyGstin}>GSTIN: {doc.party.gstin}</Text>
          )}
          {doc.party?.phone && (
            <View style={[ds.contactItem, { marginTop: 4 }]}>
              <Ionicons name="call-outline" size={11} color={COLORS.textTertiary} />
              <Text style={ds.contactText}>{doc.party.phone}</Text>
            </View>
          )}
        </View>

        {/* Ship To */}
        {hasShipping && (
          <>
            <View style={ds.partySep} />
            <View style={{ flex: 1 }}>
              <Text style={ds.partyColLabel}>SHIP TO</Text>
              {doc.shipping?.name && (
                <Text style={ds.partyName}>{doc.shipping.name}</Text>
              )}
              {doc.shipping?.line1 && (
                <Text style={ds.partyAddr}>{doc.shipping.line1}</Text>
              )}
              {(doc.shipping?.city || doc.shipping?.state) && (
                <Text style={ds.partyAddr}>
                  {[doc.shipping?.city, doc.shipping?.state, doc.shipping?.pincode]
                    .filter(Boolean)
                    .join(', ')}
                </Text>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MetaGrid — reference numbers, supply details, payment terms
// ─────────────────────────────────────────────────────────────────────────────
function MetaGrid({ doc }: { doc: VoucherDocument }) {
  if (!doc.metadata) return null;
  const m = doc.metadata;

  const pairs: { label: string; value: string }[] = ([
    m.placeOfSupply    ? { label: 'Place of Supply',  value: m.placeOfSupply }    : null,
    m.orderRef         ? { label: 'Order / PO Ref',   value: m.orderRef }         : null,
    m.invoiceRef       ? { label: 'Invoice Ref',      value: m.invoiceRef }       : null,
    m.paymentTerms     ? { label: 'Payment Terms',    value: m.paymentTerms }     : null,
    m.dueDate          ? { label: 'Due Date',          value: m.dueDate }          : null,
    m.eway             ? { label: 'E-Way Bill No.',    value: m.eway }             : null,
    m.vehicleNo        ? { label: 'Vehicle No.',       value: m.vehicleNo }        : null,
    m.transportDetails ? { label: 'Transport',         value: m.transportDetails } : null,
    m.warehouse        ? { label: 'Warehouse',         value: m.warehouse }        : null,
    m.costCentre       ? { label: 'Cost Centre',       value: m.costCentre }       : null,
  ] as (null | { label: string; value: string })[]).filter(Boolean) as { label: string; value: string }[];

  if (pairs.length === 0) return null;

  return (
    <View style={ds.card}>
      <SectionLabel title="REFERENCE & DETAILS" />
      <View style={ds.metaGrid}>
        {pairs.map((p, i) => (
          <View
            key={i}
            style={[
              ds.metaCell,
              i % 2 === 0 ? { paddingRight: 10 } : { paddingLeft: 10 },
              i >= pairs.length - (pairs.length % 2 === 0 ? 2 : 1)
                ? { borderBottomWidth: 0 }
                : {},
            ]}
          >
            <Text style={ds.metaCellLabel}>{p.label}</Text>
            <Text style={ds.metaCellValue}>{p.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ItemsTable — horizontally scrollable goods/services line items
// ─────────────────────────────────────────────────────────────────────────────
function ItemsTable({ doc }: { doc: VoucherDocument }) {
  if (!doc.items || doc.items.length === 0) return null;
  const hasDiscount = doc.items.some(i => (i.discount ?? 0) > 0);

  const W = { idx: 28, name: 150, hsn: 56, qty: 58, rate: 82, disc: 54, tax: 52, amt: 92 };

  return (
    <View style={ds.card}>
      <SectionLabel title="ITEMS" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
        <View>
          {/* Table header */}
          <View style={ds.tblHeader}>
            <Text style={[ds.th, { width: W.idx }]}>#</Text>
            <Text style={[ds.th, { width: W.name }]}>ITEM</Text>
            <Text style={[ds.th, { width: W.hsn }]}>HSN</Text>
            <Text style={[ds.th, ds.thR, { width: W.qty }]}>QTY</Text>
            <Text style={[ds.th, ds.thR, { width: W.rate }]}>RATE</Text>
            {hasDiscount && (
              <Text style={[ds.th, ds.thR, { width: W.disc }]}>DISC</Text>
            )}
            <Text style={[ds.th, ds.thR, { width: W.tax }]}>TAX%</Text>
            <Text style={[ds.th, ds.thR, { width: W.amt }]}>AMOUNT</Text>
          </View>

          {/* Item rows */}
          {doc.items.map((item, idx) => (
            <View
              key={item.id}
              style={[
                ds.tblRow,
                idx % 2 === 0 ? ds.tblRowEven : ds.tblRowOdd,
                idx === doc.items!.length - 1 && ds.tblRowLast,
              ]}
            >
              <Text style={[ds.td, { width: W.idx, color: COLORS.textTertiary }]}>
                {idx + 1}
              </Text>
              <View style={{ width: W.name }}>
                <Text style={ds.tdBold} numberOfLines={2}>{item.name}</Text>
                {item.description && (
                  <Text style={ds.tdSub} numberOfLines={1}>{item.description}</Text>
                )}
              </View>
              <Text style={[ds.td, { width: W.hsn }]}>{item.hsn || '—'}</Text>
              <Text style={[ds.td, ds.tdR, { width: W.qty }]}>
                {item.qty} {item.unit}
              </Text>
              <Text style={[ds.td, ds.tdR, { width: W.rate }]}>
                {formatCurrency(item.rate)}
              </Text>
              {hasDiscount && (
                <Text style={[ds.td, ds.tdR, { width: W.disc, color: COLORS.warning }]}>
                  {item.discount ? `${item.discount}%` : '—'}
                </Text>
              )}
              <Text style={[ds.td, ds.tdR, { width: W.tax, color: COLORS.textSecondary }]}>
                {item.taxPct ? `${item.taxPct}%` : '—'}
              </Text>
              <Text style={[ds.td, ds.tdR, ds.tdBoldR, { width: W.amt }]}>
                {formatCurrency(item.amount)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {/* Swipe hint */}
      <View style={ds.scrollHintRow}>
        <Ionicons name="swap-horizontal-outline" size={11} color={COLORS.textTertiary} />
        <Text style={ds.scrollHintText}>Swipe table to see all columns</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LedgerTable — Dr/Cr entries for voucher documents
// ─────────────────────────────────────────────────────────────────────────────
function LedgerTable({ doc }: { doc: VoucherDocument }) {
  if (!doc.ledgerEntries || doc.ledgerEntries.length === 0) return null;

  return (
    <View style={ds.card}>
      <SectionLabel title="LEDGER ENTRIES" />

      {/* Header */}
      <View style={ds.tblHeader}>
        <Text style={[ds.th, { flex: 1 }]}>PARTICULARS</Text>
        <Text style={[ds.th, ds.thR, { width: 100 }]}>DEBIT (₹)</Text>
        <Text style={[ds.th, ds.thR, { width: 100 }]}>CREDIT (₹)</Text>
      </View>

      {/* Entry rows */}
      {doc.ledgerEntries.map((entry, idx) => (
        <View
          key={entry.id}
          style={[
            ds.tblRow,
            idx % 2 === 0 ? ds.tblRowEven : ds.tblRowOdd,
            idx === doc.ledgerEntries!.length - 1 && ds.tblRowLast,
          ]}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={ds.tdBold}>{entry.particulars}</Text>
            {entry.narration && (
              <Text style={ds.tdSub}>{entry.narration}</Text>
            )}
          </View>
          <Text
            style={[
              ds.td, ds.tdR, { width: 100 },
              entry.debit
                ? { color: COLORS.negative, fontWeight: '700' }
                : { color: COLORS.textTertiary },
            ]}
          >
            {entry.debit ? formatCurrency(entry.debit) : '—'}
          </Text>
          <Text
            style={[
              ds.td, ds.tdR, { width: 100 },
              entry.credit
                ? { color: COLORS.positive, fontWeight: '700' }
                : { color: COLORS.textTertiary },
            ]}
          >
            {entry.credit ? formatCurrency(entry.credit) : '—'}
          </Text>
        </View>
      ))}

      {/* Totals row */}
      <View style={ds.ledgerTotals}>
        <Text style={[ds.ledgerTotalLabel, { flex: 1 }]}>TOTAL</Text>
        <Text style={[ds.ledgerTotalAmt, { width: 100, color: COLORS.negative }]}>
          {doc.totals.drTotal ? formatCurrency(doc.totals.drTotal) : '—'}
        </Text>
        <Text style={[ds.ledgerTotalAmt, { width: 100, color: COLORS.positive }]}>
          {doc.totals.crTotal ? formatCurrency(doc.totals.crTotal) : '—'}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TaxBreakdown — GST / tax summary table
// ─────────────────────────────────────────────────────────────────────────────
function TaxBreakdown({ doc }: { doc: VoucherDocument }) {
  if (!doc.taxes || doc.taxes.length === 0) return null;
  const hasCGST = doc.taxes.some(t => t.cgst);
  const hasIGST = doc.taxes.some(t => t.igst);

  return (
    <View style={ds.card}>
      <SectionLabel title="TAX SUMMARY" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
        <View>
          <View style={ds.tblHeader}>
            <Text style={[ds.th, { width: 148 }]}>TAX TYPE</Text>
            <Text style={[ds.th, { width: 42 }]}>RATE</Text>
            <Text style={[ds.th, ds.thR, { width: 96 }]}>TAXABLE</Text>
            {hasCGST && <Text style={[ds.th, ds.thR, { width: 84 }]}>CGST</Text>}
            {hasCGST && <Text style={[ds.th, ds.thR, { width: 84 }]}>SGST</Text>}
            {hasIGST && <Text style={[ds.th, ds.thR, { width: 84 }]}>IGST</Text>}
            <Text style={[ds.th, ds.thR, { width: 84 }]}>TAX TOTAL</Text>
          </View>

          {doc.taxes.map((tax, idx) => (
            <View
              key={idx}
              style={[
                ds.tblRow,
                idx % 2 === 0 ? ds.tblRowEven : ds.tblRowOdd,
                idx === doc.taxes!.length - 1 && ds.tblRowLast,
              ]}
            >
              <Text style={[ds.td, { width: 148 }]} numberOfLines={2}>
                {tax.description}
              </Text>
              <Text style={[ds.td, { width: 42 }]}>{tax.rate}%</Text>
              <Text style={[ds.td, ds.tdR, { width: 96 }]}>
                {formatCurrency(tax.taxableAmount)}
              </Text>
              {hasCGST && (
                <Text style={[ds.td, ds.tdR, { width: 84 }]}>
                  {tax.cgst ? formatCurrency(tax.cgst) : '—'}
                </Text>
              )}
              {hasCGST && (
                <Text style={[ds.td, ds.tdR, { width: 84 }]}>
                  {tax.sgst ? formatCurrency(tax.sgst) : '—'}
                </Text>
              )}
              {hasIGST && (
                <Text style={[ds.td, ds.tdR, { width: 84 }]}>
                  {tax.igst ? formatCurrency(tax.igst) : '—'}
                </Text>
              )}
              <Text style={[ds.td, ds.tdR, ds.tdBoldR, { width: 84 }]}>
                {formatCurrency(tax.total)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TotalsSummary — subtotals, tax breakdown, grand total, amount in words
// ─────────────────────────────────────────────────────────────────────────────
function TotalsSummary({ doc }: { doc: VoucherDocument }) {
  const t = doc.totals;
  type RowStyle = 'default' | 'bold' | 'subtracted' | 'added';

  const rows: { label: string; value: string; style?: RowStyle }[] = [];

  if (t.subtotal !== undefined)
    rows.push({ label: 'Subtotal', value: formatCurrency(t.subtotal) });
  if (t.discount)
    rows.push({ label: 'Discount  (−)', value: formatCurrency(t.discount), style: 'subtracted' });
  if (t.taxableAmount !== undefined && t.discount)
    rows.push({ label: 'Taxable Amount', value: formatCurrency(t.taxableAmount), style: 'bold' });
  if (t.cgstTotal)
    rows.push({ label: 'CGST  (+)', value: formatCurrency(t.cgstTotal), style: 'added' });
  if (t.sgstTotal)
    rows.push({ label: 'SGST  (+)', value: formatCurrency(t.sgstTotal), style: 'added' });
  if (t.igstTotal)
    rows.push({ label: 'IGST  (+)', value: formatCurrency(t.igstTotal), style: 'added' });
  if (t.taxTotal)
    rows.push({ label: 'Total Tax', value: formatCurrency(t.taxTotal), style: 'bold' });
  if (t.roundOff !== undefined && t.roundOff !== 0)
    rows.push({
      label: 'Round Off',
      value: (t.roundOff > 0 ? '+ ' : '− ') + formatCurrency(Math.abs(t.roundOff)),
      style: t.roundOff < 0 ? 'subtracted' : 'added',
    });

  return (
    <View style={ds.card}>
      <SectionLabel title="AMOUNT SUMMARY" />

      {rows.map((row, i) => (
        <View key={i} style={ds.sumRow}>
          <Text style={[ds.sumLabel, row.style === 'bold' && ds.sumLabelBold]}>
            {row.label}
          </Text>
          <Text
            style={[
              ds.sumValue,
              row.style === 'subtracted' && { color: COLORS.negative },
              row.style === 'added'       && { color: COLORS.textSecondary },
              row.style === 'bold'        && ds.sumValueBold,
            ]}
          >
            {row.value}
          </Text>
        </View>
      ))}

      <Divider style={{ marginTop: 10 }} />

      {/* Grand Total */}
      <View style={ds.grandTotal}>
        <Text style={ds.grandTotalLabel}>GRAND TOTAL</Text>
        <Text style={ds.grandTotalValue}>{formatCurrency(t.total)}</Text>
      </View>

      {/* Balance due (if different) */}
      {t.balanceDue !== undefined && t.balanceDue !== t.total && (
        <View style={[ds.sumRow, { marginTop: 12 }]}>
          <View style={ds.balanceBadge}>
            <Text style={ds.balanceBadgeText}>BALANCE DUE</Text>
          </View>
          <Text style={ds.balanceValue}>{formatCurrency(t.balanceDue)}</Text>
        </View>
      )}

      {/* Amount in words */}
      <View style={ds.amtWords}>
        <Text style={ds.amtWordsLabel}>Amount in Words</Text>
        <Text style={ds.amtWordsText}>{amountInWords(t.total)}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PaymentBlock — payment mode, bank, reference details
// ─────────────────────────────────────────────────────────────────────────────
function PaymentBlock({ doc }: { doc: VoucherDocument }) {
  if (!doc.paymentDetails) return null;
  const p = doc.paymentDetails;

  const rows: { label: string; value: string }[] = ([
    p.mode           ? { label: 'Payment Mode',    value: p.mode }           : null,
    p.bankName       ? { label: 'Bank',            value: p.bankName }       : null,
    p.accountNo      ? { label: 'Account No.',     value: p.accountNo }      : null,
    p.ifsc           ? { label: 'IFSC Code',       value: p.ifsc }           : null,
    p.upi            ? { label: 'UPI ID',          value: p.upi }            : null,
    p.chequeNo       ? { label: 'Cheque No.',      value: p.chequeNo }       : null,
    p.transactionRef ? { label: 'Transaction Ref', value: p.transactionRef } : null,
    p.instrumentDate ? { label: 'Instrument Date', value: p.instrumentDate } : null,
  ] as (null | { label: string; value: string })[]).filter(Boolean) as { label: string; value: string }[];

  return (
    <View style={ds.card}>
      <SectionLabel title="PAYMENT DETAILS" />
      {/* Mode badge */}
      {p.mode && (
        <View style={ds.modeRow}>
          <View style={ds.modeBadge}>
            <Ionicons name="card-outline" size={13} color={COLORS.info} />
            <Text style={ds.modeBadgeText}>{p.mode}</Text>
          </View>
        </View>
      )}
      {rows.slice(1).map((row, i) => (
        <View
          key={i}
          style={[
            ds.payRow,
            i === rows.length - 2 && { borderBottomWidth: 0 },
          ]}
        >
          <Text style={ds.payLabel}>{row.label}</Text>
          <Text style={ds.payValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NarrationBlock — narration text + terms & conditions
// ─────────────────────────────────────────────────────────────────────────────
function NarrationBlock({ doc }: { doc: VoucherDocument }) {
  if (!doc.narration && !doc.terms) return null;

  return (
    <View style={ds.card}>
      {doc.narration && (
        <>
          <SectionLabel title="NARRATION" />
          <View style={ds.narrationBox}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={14}
              color={COLORS.textTertiary}
              style={{ marginTop: 2 }}
            />
            <Text style={ds.narrationText}>{doc.narration}</Text>
          </View>
        </>
      )}

      {doc.narration && doc.terms && <Divider style={{ marginVertical: 16 }} />}

      {doc.terms && (
        <>
          <SectionLabel title="TERMS & CONDITIONS" />
          <Text style={ds.termsText}>{doc.terms}</Text>
        </>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FooterBlock — declaration + signature lines + system note
// ─────────────────────────────────────────────────────────────────────────────
function FooterBlock({ doc }: { doc: VoucherDocument }) {
  if (!doc.footerInfo) return null;
  const f = doc.footerInfo;

  return (
    <View style={ds.card}>
      {f.declaration && (
        <Text style={ds.declarationText}>{f.declaration}</Text>
      )}

      {(f.receiverNote || f.authorizedSignatory) && (
        <View style={ds.sigRow}>
          {f.receiverNote && (
            <View style={ds.sigBox}>
              <View style={{ flex: 1 }} />
              <View style={ds.sigLine} />
              <Text style={ds.sigName}>{f.receiverNote}</Text>
            </View>
          )}
          {f.authorizedSignatory && (
            <View style={[ds.sigBox, { alignItems: 'flex-end' }]}>
              <View style={{ flex: 1 }} />
              <View style={ds.sigLine} />
              <Text style={ds.sigName}>{f.authorizedSignatory}</Text>
              <Text style={ds.sigSub}>Authorized Signatory</Text>
            </View>
          )}
        </View>
      )}

      {f.systemNote && (
        <Text style={ds.systemNote}>{f.systemNote}</Text>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionBar — fixed bottom bar: Share | WhatsApp | Download PDF
// ─────────────────────────────────────────────────────────────────────────────
function ActionBar({ doc }: { doc: VoucherDocument }) {
  const insets = useSafeAreaInsets();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const { company } = useAuth();
  const logoUriRef = useRef<string | null>(null);
  const voucherConfigRef = useRef<Record<string, any> | null>(null);

  // Load company logo from AsyncStorage once
  useEffect(() => {
    if (company?.guid) {
      AsyncStorage.getItem(`company_logo_${company.guid}`)
        .then(uri => { logoUriRef.current = uri; })
        .catch(() => {});
    }
  }, [company?.guid]);

  // Load voucher config: backend first (cross-device), then AsyncStorage fallback
  useEffect(() => {
    getUserSettings().then((res: any) => {
      const serverConfig = res?.data?.voucher_config;
      if (serverConfig) {
        const parsed = typeof serverConfig === 'string' ? JSON.parse(serverConfig) : serverConfig;
        voucherConfigRef.current = parsed;
        AsyncStorage.setItem(VOUCHER_CONFIG_KEY, JSON.stringify(parsed)).catch(() => {});
      } else {
        AsyncStorage.getItem(VOUCHER_CONFIG_KEY)
          .then(json => { if (json) voucherConfigRef.current = JSON.parse(json); })
          .catch(() => {});
      }
    }).catch(() => {
      AsyncStorage.getItem(VOUCHER_CONFIG_KEY)
        .then(json => { if (json) voucherConfigRef.current = JSON.parse(json); })
        .catch(() => {});
    });
  }, []);

  // Shared PDF helper — loading reset BEFORE shareAsync to prevent UI hang
  const generateAndSharePDF = async (
    setLoading: (v: boolean) => void,
    dialogTitle: string,
    fallback?: () => Promise<void>
  ) => {
    setLoading(true);
    try {
      const configId = DOC_TYPE_TO_CONFIG_ID[doc.documentType];
      const format = ((voucherConfigRef.current?.[configId]?.format) ?? 1) as 1 | 2 | 3;
      const terms = (voucherConfigRef.current?.[configId]?.terms ?? []) as string[];
      const html = generateDocumentHTML(doc, logoUriRef.current, format, terms);
      const { uri } = await Print.printToFileAsync({ html, base64: false, width: 595, height: 842 });
      setLoading(false); // Reset BEFORE shareAsync (shareAsync blocks until sheet dismissed)
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle, UTI: 'com.adobe.pdf' });
      } else if (fallback) {
        await fallback();
      } else {
        await Share.share({ url: uri, title: doc.documentNumber });
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert('PDF Error', 'Could not generate PDF. Please try again.');
    }
  };

  const handleShare    = () => generateAndSharePDF(setShareLoading, `Share ${doc.documentNumber}`);
  const handleWhatsApp = () => generateAndSharePDF(setPdfLoading, `${doc.documentNumber} via WhatsApp`,
    async () => {
      const msg = encodeURIComponent(`${doc.documentTitle}\n${doc.documentNumber}\n${formatCurrency(doc.totals.total)}`);
      await Linking.openURL(`whatsapp://send?text=${msg}`);
    }
  );
  const handlePDF = () => generateAndSharePDF(setPdfLoading, `${doc.documentNumber}.pdf`);

    return (
    <View style={[ds.actionBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      <TouchableOpacity style={ds.actionBtn} onPress={handleShare} activeOpacity={0.75} disabled={shareLoading}>
        {shareLoading
          ? <ActivityIndicator size="small" color={COLORS.white} />
          : <Ionicons name="share-outline" size={21} color={COLORS.white} />}
        <Text style={ds.actionBtnText}>{shareLoading ? 'Generating…' : 'Share PDF'}</Text>
      </TouchableOpacity>

      <View style={ds.actionSep} />

      <TouchableOpacity style={ds.actionBtn} onPress={handlePDF} activeOpacity={0.75} disabled={pdfLoading}>
        {pdfLoading
          ? <ActivityIndicator size="small" color={COLORS.white} />
          : <Ionicons name="document-outline" size={21} color={COLORS.white} />
        }
        <Text style={ds.actionBtnText}>{pdfLoading ? 'Generating…' : 'Download PDF'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DocumentPreviewPage — main orchestrator (default export)
// ─────────────────────────────────────────────────────────────────────────────
export default function DocumentPreviewPage({ document: doc }: { document: VoucherDocument }) {
  const router = useRouter();

  return (
    <SafeAreaView style={ds.safe} edges={['top', 'left', 'right']}>
      <DocNavBar title={doc.documentTitle} onBack={() => router.back()} />

      <ScrollView
        style={ds.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={ds.scrollContent}
      >
        <DocHeader doc={doc} />
        <PartySection doc={doc} />
        <MetaGrid doc={doc} />

        {/* Conditional: ItemsTable for invoice types */}
        {doc.items && doc.items.length > 0 && <ItemsTable doc={doc} />}

        {/* Tax breakdown only if items exist */}
        {doc.taxes && doc.taxes.length > 0 && <TaxBreakdown doc={doc} />}

        {/* Conditional: LedgerTable for voucher types */}
        {doc.ledgerEntries && doc.ledgerEntries.length > 0 && (
          <LedgerTable doc={doc} />
        )}

        <TotalsSummary doc={doc} />
        <PaymentBlock doc={doc} />
        <NarrationBlock doc={doc} />
        <FooterBlock doc={doc} />

        <View style={{ height: 20 }} />
      </ScrollView>

      <ActionBar doc={doc} />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const ds = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: COLORS.pageBg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.md },

  // ── Navigation bar ──────────────────────────────────────────────────────────
  navBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  navBack:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: {
    flex: 1, textAlign: 'center',
    fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary,
  },

  // ── Card container ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },

  // ── Section label with accent bar ───────────────────────────────────────────
  sectionLabelWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
  },
  sectionLabelAccent: {
    width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.brandPrimary,
  },
  sectionLabelText: {
    fontSize: 10, fontWeight: '800', color: COLORS.textTertiary,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },

  // ── Doc Header ──────────────────────────────────────────────────────────────
  docBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full, marginBottom: 12,
  },
  docBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },

  companyName: {
    fontSize: TYPOGRAPHY.xl, fontWeight: '800',
    color: COLORS.textPrimary, marginBottom: 5, lineHeight: 30,
  },
  companyAddress: {
    fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary,
    lineHeight: 18, marginBottom: 10,
  },

  chipRow:     { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  chip:        {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  chipLabel:   { fontSize: 10, fontWeight: '700', color: COLORS.textTertiary },
  chipValue:   { fontSize: 10, fontWeight: '700', color: COLORS.textPrimary },

  contactRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  contactText: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },

  docMetaRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  metaSmallLabel: {
    fontSize: 10, fontWeight: '700', color: COLORS.textTertiary,
    letterSpacing: 0.8, marginBottom: 3,
  },
  docNumber: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  docDate:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  // ── Party section ────────────────────────────────────────────────────────────
  partyRow:     { flexDirection: 'row' },
  partySep:     { width: 1, backgroundColor: COLORS.borderDefault, marginHorizontal: 14 },
  partyColLabel: {
    fontSize: 10, fontWeight: '800', color: COLORS.textTertiary,
    letterSpacing: 1, marginBottom: 7,
  },
  partyName:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 3 },
  partyAddr:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, lineHeight: 17, marginBottom: 1 },
  partyGstin:   { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary, marginTop: 4 },

  // ── Meta grid ────────────────────────────────────────────────────────────────
  metaGrid:      { flexDirection: 'row', flexWrap: 'wrap' },
  metaCell:      {
    width: '50%', paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  metaCellLabel: { fontSize: 10, color: COLORS.textTertiary, fontWeight: '600', marginBottom: 2 },
  metaCellValue: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '600' },

  // ── Table shared ─────────────────────────────────────────────────────────────
  tblHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.pageBg,
    paddingVertical: 9, paddingHorizontal: 2,
    borderBottomWidth: 1.5, borderBottomColor: COLORS.borderStrong,
  },
  tblRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 2,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    minHeight: 38,
  },
  tblRowEven: { backgroundColor: COLORS.cardBg },
  tblRowOdd:  { backgroundColor: COLORS.hoverBg },
  tblRowLast: { borderBottomWidth: 0 },

  th:      { fontSize: 10, fontWeight: '800', color: COLORS.textTertiary, letterSpacing: 0.5 },
  thR:     { textAlign: 'right' },
  td:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary },
  tdBold:  { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  tdSub:   { fontSize: 10, color: COLORS.textTertiary, marginTop: 2 },
  tdR:     { textAlign: 'right' },
  tdBoldR: { fontWeight: '700', textAlign: 'right' },

  scrollHintRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  scrollHintText: { fontSize: 10, color: COLORS.textTertiary, fontStyle: 'italic' },

  // ── Ledger totals ────────────────────────────────────────────────────────────
  ledgerTotals: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm,
    paddingVertical: 11, paddingHorizontal: 2, marginTop: 4,
    borderTopWidth: 1.5, borderTopColor: COLORS.borderStrong,
  },
  ledgerTotalLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.textPrimary },
  ledgerTotalAmt:   { fontSize: TYPOGRAPHY.xs, fontWeight: '800', textAlign: 'right' },

  // ── Totals summary ───────────────────────────────────────────────────────────
  sumRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  sumLabel:      { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  sumLabelBold:  { fontWeight: '700', color: COLORS.textPrimary },
  sumValue:      { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  sumValueBold:  { fontWeight: '800' },

  grandTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 16, paddingHorizontal: SPACING.md, marginTop: 12,
  },
  grandTotalLabel: { fontSize: TYPOGRAPHY.sm,  fontWeight: '800', color: COLORS.white, letterSpacing: 0.8 },
  grandTotalValue: { fontSize: TYPOGRAPHY.lg,  fontWeight: '800', color: COLORS.white },

  balanceBadge: {
    backgroundColor: COLORS.warningBg, borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.warning,
  },
  balanceBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.warning, letterSpacing: 0.5 },
  balanceValue:     { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.warning },

  amtWords: {
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm,
    padding: 12, marginTop: 14,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  amtWordsLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textTertiary, marginBottom: 4 },
  amtWordsText:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, fontStyle: 'italic', lineHeight: 18 },

  // ── Payment block ────────────────────────────────────────────────────────────
  modeRow:       { marginBottom: 12 },
  modeBadge:     {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: COLORS.infoBg, borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  modeBadgeText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.info },

  payRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  payLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  payValue: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary,
    textAlign: 'right', flex: 1, marginLeft: 8,
  },

  // ── Narration / Terms ────────────────────────────────────────────────────────
  narrationBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, padding: 12,
  },
  narrationText: {
    flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary,
    lineHeight: 20, fontStyle: 'italic',
  },
  termsText: {
    fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, lineHeight: 19,
  },

  // ── Footer ───────────────────────────────────────────────────────────────────
  declarationText: {
    fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, lineHeight: 18,
    fontStyle: 'italic', textAlign: 'center',
    marginBottom: 20, paddingHorizontal: SPACING.sm,
  },
  sigRow:  { flexDirection: 'row', gap: 24, marginTop: 8 },
  sigBox:  { flex: 1, minHeight: 70, justifyContent: 'flex-end' },
  sigLine: { height: 1, backgroundColor: COLORS.borderStrong, marginBottom: 8 },
  sigName: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  sigSub:  { fontSize: 10, color: COLORS.textTertiary, marginTop: 2 },
  systemNote: {
    fontSize: 10, color: COLORS.textTertiary, textAlign: 'center',
    marginTop: 16, fontStyle: 'italic',
  },

  // ── Action bar ───────────────────────────────────────────────────────────────
  actionBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.brandPrimary,
    paddingTop: 12, paddingHorizontal: SPACING.md,
  },
  actionBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 6,
  },
  actionBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.white, letterSpacing: 0.3 },
  actionSep:     { width: 1, height: 38, backgroundColor: 'rgba(255,255,255,0.12)' },
});
