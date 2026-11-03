/**
 * The e-way bill coverage screen was folded into the list header KPIs
 * (spec 2026-11-03 §4); this route only redirects.
 */
import { Redirect } from 'expo-router';

export default function EWBComplianceScreen() {
  return <Redirect href="/reports/ewb-list" />;
}
