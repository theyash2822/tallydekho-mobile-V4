/**
 * The e-invoice coverage screen was folded into the list header KPIs
 * (spec 2026-11-03 §4); this route only redirects.
 */
import { Redirect } from 'expo-router';

export default function EInvoiceComplianceScreen() {
  return <Redirect href="/reports/einvoice-list" />;
}
