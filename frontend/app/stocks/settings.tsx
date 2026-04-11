import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

export default function StockSettingsScreen() {
  const router = useRouter();
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [reorderAlerts, setReorderAlerts]   = useState(true);
  const [expiryAlerts, setExpiryAlerts]     = useState(false);
  const [autoReorder, setAutoReorder]       = useState(false);
  const [barcodeSound, setBarcodeSound]     = useState(true);

  const SETTINGS_ROWS = [
    { label: 'Low Stock Alerts',    desc: 'Notify when items fall below reorder point', value: lowStockAlerts, setter: setLowStockAlerts },
    { label: 'Reorder Reminders',   desc: 'Daily digest of pending reorders',          value: reorderAlerts,  setter: setReorderAlerts  },
    { label: 'Expiry Notifications', desc: 'Alert 30 days before item expiry',         value: expiryAlerts,   setter: setExpiryAlerts   },
    { label: 'Auto Reorder',        desc: 'Automatically create PO when stock is low', value: autoReorder,    setter: setAutoReorder    },
    { label: 'Barcode Scan Sound',  desc: 'Play a sound on successful scan',           value: barcodeSound,   setter: setBarcodeSound   },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stock Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Alerts & Notifications */}
        <Text style={styles.sectionLabel}>ALERTS & NOTIFICATIONS</Text>
        <View style={styles.card}>
          {SETTINGS_ROWS.map((row, idx) => (
            <View key={row.label} style={[styles.settingRow, idx < SETTINGS_ROWS.length - 1 && styles.rowBorder]}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowDesc}>{row.desc}</Text>
              </View>
              <Switch
                value={row.value}
                onValueChange={row.setter}
                trackColor={{ false: COLORS.borderDefault, true: COLORS.brandPrimary + '60' }}
                thumbColor={row.value ? COLORS.brandPrimary : '#f4f3f4'}
              />
            </View>
          ))}
        </View>

        {/* Reorder Defaults */}
        <Text style={styles.sectionLabel}>REORDER DEFAULTS</Text>
        <View style={styles.card}>
          {[
            { label: 'Default Lead Time', value: '7 days', icon: 'time-outline' },
            { label: 'Safety Stock Factor', value: '1.5x', icon: 'shield-outline' },
            { label: 'Default Supplier', value: 'ABC Traders', icon: 'business-outline' },
          ].map((item, idx, arr) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.settingRow, idx < arr.length - 1 && styles.rowBorder]}
              onPress={() => Alert.alert(item.label, `Current: ${item.value}`)}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Ionicons name={item.icon as any} size={18} color={COLORS.textSecondary} style={{ marginBottom: 2 }} />
                <Text style={styles.rowLabel}>{item.label}</Text>
              </View>
              <View style={styles.valueRow}>
                <Text style={styles.valueText}>{item.value}</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Warehouse Defaults */}
        <Text style={styles.sectionLabel}>WAREHOUSE</Text>
        <View style={styles.card}>
          {[
            { label: 'Default Warehouse', value: 'Mumbai Central', icon: 'business-outline' },
            { label: 'Valuation Method',   value: 'FIFO',           icon: 'layers-outline' },
            { label: 'Unit of Measure',    value: 'Nos.',           icon: 'cube-outline' },
          ].map((item, idx, arr) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.settingRow, idx < arr.length - 1 && styles.rowBorder]}
              onPress={() => Alert.alert(item.label, `Current: ${item.value}`)}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Ionicons name={item.icon as any} size={18} color={COLORS.textSecondary} style={{ marginBottom: 2 }} />
                <Text style={styles.rowLabel}>{item.label}</Text>
              </View>
              <View style={styles.valueRow}>
                <Text style={styles.valueText}>{item.value}</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.pageBg },
  header:  {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  scroll:       { flex: 1 },
  sectionLabel: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  card:       { backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14 },
  rowBorder:  { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  rowLeft:    { flex: 1, marginRight: 12 },
  rowLabel:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  rowDesc:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  valueRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  valueText:  { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.brandPrimary },
});
