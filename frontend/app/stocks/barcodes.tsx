import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const RECENT_SCANS = [
  { id: 'S1', sku: 'PRD-1002-ABC', name: 'Black JBL Speaker',    time: '2m ago',  action: 'Add Stock' },
  { id: 'S2', sku: 'LWH-789',      name: 'Lycan Wireless HP',   time: '15m ago', action: 'Check Stock' },
  { id: 'S3', sku: 'SNY-001',      name: 'Sony WH-1000XM5',     time: '1h ago',  action: 'Transfer' },
  { id: 'S4', sku: 'JWS-456',      name: 'JBL Wired Speaker',   time: '2h ago',  action: 'Check Stock' },
];

export default function BarcodesScreen() {
  const router = useRouter();
  const [lastScan, setLastScan] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Barcode Scanner</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.scanArea}>
        {/* Camera viewfinder placeholder */}
        <View style={styles.viewfinder}>
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
          <View style={styles.scanLine} />
          <Ionicons name="barcode-outline" size={64} color="rgba(255,255,255,0.25)" style={{ marginBottom: 16 }} />
          <Text style={styles.scanHint}>Point camera at barcode / QR code</Text>
        </View>

        <TouchableOpacity
          style={styles.scanBtn}
          activeOpacity={0.85}
          onPress={() => {
            Alert.alert(
              'Camera Permission',
              'Enable camera access in Settings to use the barcode scanner.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => {} },
              ],
            );
          }}
        >
          <Ionicons name="scan-outline" size={22} color={COLORS.white} />
          <Text style={styles.scanBtnText}>Start Scanning</Text>
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <View style={styles.quickRow}>
        {[
          { label: 'Manual Entry', icon: 'keypad-outline',    color: '#2563EB', bg: '#EFF6FF', route: null },
          { label: 'Bulk Import',  icon: 'cloud-upload-outline', color: '#7C3AED', bg: '#F5F3FF', route: null },
          { label: 'Print Labels', icon: 'print-outline',     color: '#D97706', bg: '#FFFBEB', route: '/stocks/print-barcodes' },
        ].map(q => (
          <TouchableOpacity
            key={q.label}
            style={[styles.quickBtn, { backgroundColor: q.bg }]}
            onPress={() => q.route ? router.push(q.route as any) : Alert.alert(q.label, 'Feature coming soon!')}
            activeOpacity={0.7}
          >
            <Ionicons name={q.icon as any} size={20} color={q.color} />
            <Text style={[styles.quickLabel, { color: q.color }]}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent scans */}
      <View style={styles.recentSection}>
        <Text style={styles.recentTitle}>Recent Scans</Text>
        {RECENT_SCANS.map((s, idx) => (
          <View key={s.id} style={[styles.scanItem, idx < RECENT_SCANS.length - 1 && styles.scanBorder]}>
            <View style={styles.scanIcon}>
              <Ionicons name="scan-circle-outline" size={18} color={COLORS.brandPrimary} />
            </View>
            <View style={styles.scanInfo}>
              <Text style={styles.scanName}>{s.name}</Text>
              <Text style={styles.scanMeta}>{s.sku} · {s.time}</Text>
            </View>
            <View style={styles.actionBadge}>
              <Text style={styles.actionText}>{s.action}</Text>
            </View>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#0F172A' },
  header:  {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: '#F8FAFC', textAlign: 'center' },

  scanArea:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: SPACING.md },
  viewfinder: {
    width: 260, height: 200,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
  },
  cornerTL: { position: 'absolute', top: 12, left: 12, width: 24, height: 24, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#38BDF8', borderRadius: 3 },
  cornerTR: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#38BDF8', borderRadius: 3 },
  cornerBL: { position: 'absolute', bottom: 12, left: 12, width: 24, height: 24, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#38BDF8', borderRadius: 3 },
  cornerBR: { position: 'absolute', bottom: 12, right: 12, width: 24, height: 24, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#38BDF8', borderRadius: 3 },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#38BDF8', opacity: 0.6, top: '50%' },
  scanHint: { color: 'rgba(255,255,255,0.5)', fontSize: TYPOGRAPHY.xs, textAlign: 'center', paddingHorizontal: 16 },

  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0EA5E9', paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 30,
  },
  scanBtnText: { color: COLORS.white, fontSize: TYPOGRAPHY.base, fontWeight: '700' },

  quickRow: { flexDirection: 'row', gap: 10, paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  quickBtn: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: RADIUS.md },
  quickLabel: { fontSize: 10, fontWeight: '700' },

  recentSection: { backgroundColor: '#1E293B', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  recentTitle:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#94A3B8', marginBottom: 8 },
  scanItem:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  scanBorder:{ borderBottomWidth: 1, borderBottomColor: '#334155' },
  scanIcon:  { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center' },
  scanInfo:  { flex: 1 },
  scanName:  { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: '#F8FAFC' },
  scanMeta:  { fontSize: TYPOGRAPHY.xs, color: '#64748B', marginTop: 2 },
  actionBadge: { backgroundColor: '#0F3460', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  actionText:  { fontSize: 10, color: '#38BDF8', fontWeight: '600' },
});
