import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { updateAlertSettings } from '../../src/services/api';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CustomCheckbox
// ─────────────────────────────────────────────────────────────────────────────
function CustomCheckbox({
  value, onChange, label,
}: {
  value: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <TouchableOpacity style={cbx.row} onPress={() => onChange(!value)} activeOpacity={0.7}>
      <View style={[cbx.box, value && cbx.boxChecked]}>
        {value && <Ionicons name="checkmark" size={13} color={COLORS.white} />}
      </View>
      <Text style={cbx.label}>{label}</Text>
    </TouchableOpacity>
  );
}
const cbx = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: {
    width: 22, height: 22, borderRadius: 5,
    borderWidth: 2, borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center', justifyContent: 'center',
  },
  boxChecked: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  label: { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary, flex: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. StepperBox — bordered card with title + stepper + sublabel
// ─────────────────────────────────────────────────────────────────────────────
function StepperBox({
  label, value, sublabel, onChange, min = 1, max = 30,
}: {
  label: string; value: number; sublabel: string;
  onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <View style={sb.box}>
      <Text style={sb.label}>{label}</Text>
      <View style={sb.row}>
        <TouchableOpacity
          style={[sb.btn, value <= min && sb.btnDisabled]}
          onPress={() => onChange(Math.max(min, value - 1))}
          activeOpacity={0.7}
          disabled={value <= min}
        >
          <Ionicons name="remove" size={18} color={value <= min ? COLORS.textTertiary : COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={sb.val}>{value}</Text>
        <TouchableOpacity
          style={[sb.btn, value >= max && sb.btnDisabled]}
          onPress={() => onChange(Math.min(max, value + 1))}
          activeOpacity={0.7}
          disabled={value >= max}
        >
          <Ionicons name="add" size={18} color={value >= max ? COLORS.textTertiary : COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
      <Text style={sb.sublabel}>{sublabel}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
    padding: 12, alignItems: 'center', gap: 6,
  },
  label: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '600',
    color: COLORS.textSecondary, textAlign: 'center',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%', justifyContent: 'space-between',
  },
  btn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  btnDisabled: { opacity: 0.4 },
  val: {
    fontSize: TYPOGRAPHY.lg, fontWeight: '800',
    color: COLORS.textPrimary, minWidth: 32, textAlign: 'center',
  },
  sublabel: {
    fontSize: 10, fontWeight: '500',
    color: COLORS.textTertiary, textAlign: 'center',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ChannelChips
// ─────────────────────────────────────────────────────────────────────────────
type Channels = { push: boolean; email: boolean; whatsapp: boolean; sms: boolean };
const CHANNEL_LIST: { key: keyof Channels; label: string }[] = [
  { key: 'push',      label: 'Push'      },
  { key: 'email',     label: 'Email'     },
  { key: 'whatsapp',  label: 'WhatsApp'  },
  { key: 'sms',       label: 'SMS'       },
];

function ChannelChips({
  value, onChange,
}: {
  value: Channels; onChange: (v: Channels) => void;
}) {
  return (
    <View style={cc.wrap}>
      <Text style={cc.label}>Channel</Text>
      <View style={cc.row}>
        {CHANNEL_LIST.map(ch => {
          const active = value[ch.key];
          return (
            <TouchableOpacity
              key={ch.key}
              style={[cc.chip, active && cc.chipActive]}
              onPress={() => onChange({ ...value, [ch.key]: !active })}
              activeOpacity={0.7}
            >
              <Text style={[cc.chipTxt, active && cc.chipTxtActive]}>{ch.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
const cc = StyleSheet.create({
  wrap: { marginTop: SPACING.md },
  label: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '600',
    color: COLORS.textSecondary, marginBottom: SPACING.sm,
  },
  row:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
  },
  chipActive:   { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipTxt:      { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  chipTxtActive:{ color: COLORS.white, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. SectionDivider
// ─────────────────────────────────────────────────────────────────────────────
function SectionDivider() {
  return <View style={{ height: 1, backgroundColor: COLORS.borderDefault, marginVertical: SPACING.md }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function ComplianceRemindersScreen() {
  const router = useRouter();

  // ── GST ─────────────────────────────────────────────────────────────────
  const [gst, setGst] = useState({
    gstr1Days: 3, gstr3bDays: 3, autoPause: true,
    channels: { push: true, email: false, whatsapp: false, sms: false } as Channels,
  });
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => setIsDirty(true);

  // ── E-Invoice ────────────────────────────────────────────────────────────
  const [einv, setEinv] = useState({
    irnDays: 3,
    channels: { push: true, email: false, whatsapp: false, sms: false } as Channels,
  });

  // ── E-Way Bill ───────────────────────────────────────────────────────────
  const [ewb, setEwb] = useState({
    expiryHours: 4,
    channels: { push: true, email: false, whatsapp: false, sms: false } as Channels,
  });

  // ── Other Taxes ──────────────────────────────────────────────────────────
  const [other, setOther] = useState({
    tdsDays: 3, vatDays: 3,
    channels: { push: true, email: false, whatsapp: false, sms: false } as Channels,
  });

  const save = async () => {
    try {
      await updateAlertSettings({
        compliance_reminders: {
          einvoice: einv,
          ewb,
          other_taxes: other,
        },
      });
      Toast.show({ type: 'success', text1: 'Saved', text2: 'Compliance reminders updated.' });
      setIsDirty(false);
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not save. Try again.' });
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Compliance Reminders</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ════════════════════════════════════════════════════
            GST CARD
        ════════════════════════════════════════════════════ */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="receipt-outline" size={18} color={COLORS.positive} />
            <Text style={s.cardTitle}>GST</Text>
          </View>

          {/* Two side-by-side steppers */}
          <View style={s.stepperRow}>
            <StepperBox
              label="GSTR-1 filing"
              value={gst.gstr1Days}
              sublabel="Days before due"
              onChange={v => setGst(p => ({ ...p, gstr1Days: v }))}
            />
            <View style={{ width: 12 }} />
            <StepperBox
              label="GSTR-3B filing"
              value={gst.gstr3bDays}
              sublabel="Days before due"
              onChange={v => setGst(p => ({ ...p, gstr3bDays: v }))}
            />
          </View>

          {/* Auto-pause checkbox */}
          <SectionDivider />
          <View style={s.checkboxRow}>
            <Text style={s.checkboxGroupLabel}>Auto-pause</Text>
            <CustomCheckbox
              value={gst.autoPause}
              onChange={v => setGst(p => ({ ...p, autoPause: v }))}
              label="If No Sales"
            />
          </View>

          {/* Channel chips */}
          <ChannelChips
            value={gst.channels}
            onChange={v => setGst(p => ({ ...p, channels: v }))}
          />
        </View>

        {/* ════════════════════════════════════════════════════
            E-INVOICE CARD
        ════════════════════════════════════════════════════ */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="barcode-outline" size={18} color={COLORS.info} />
            <Text style={s.cardTitle}>E-Invoice</Text>
          </View>

          {/* Full-width single stepper */}
          <StepperBox
            label="IRN error digest"
            value={einv.irnDays}
            sublabel="Days before due"
            onChange={v => setEinv(p => ({ ...p, irnDays: v }))}
          />

          <ChannelChips
            value={einv.channels}
            onChange={v => setEinv(p => ({ ...p, channels: v }))}
          />
        </View>

        {/* ════════════════════════════════════════════════════
            E-WAY BILL CARD
        ════════════════════════════════════════════════════ */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="document-outline" size={18} color={COLORS.warning} />
            <Text style={s.cardTitle}>E-Way Bill</Text>
          </View>

          <StepperBox
            label="Expiry reminder"
            value={ewb.expiryHours}
            sublabel="h before validity end"
            onChange={v => setEwb(p => ({ ...p, expiryHours: v }))}
            max={72}
          />

          <ChannelChips
            value={ewb.channels}
            onChange={v => setEwb(p => ({ ...p, channels: v }))}
          />
        </View>

        {/* ════════════════════════════════════════════════════
            OTHER TAXES CARD
        ════════════════════════════════════════════════════ */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="card-outline" size={18} color="#7C3AED" />
            <Text style={s.cardTitle}>Other Taxes</Text>
          </View>

          {/* Two side-by-side steppers */}
          <View style={s.stepperRow}>
            <StepperBox
              label="TDS payment"
              value={other.tdsDays}
              sublabel="Days before 7th"
              onChange={v => setOther(p => ({ ...p, tdsDays: v }))}
            />
            <View style={{ width: 12 }} />
            <StepperBox
              label="VAT return"
              value={other.vatDays}
              sublabel="Days before due"
              onChange={v => setOther(p => ({ ...p, vatDays: v }))}
            />
          </View>

          <ChannelChips
            value={other.channels}
            onChange={v => setOther(p => ({ ...p, channels: v }))}
          />
        </View>

        {/* Save */}
        <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.8}>
          <Text style={s.saveTxt}>Save Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: COLORS.pageBg },
  hdr:   {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  back:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700',
    color: COLORS.textPrimary, textAlign: 'center',
  },
  scroll: { padding: SPACING.md, paddingBottom: 40 },

  // Card
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  cardHdr:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },

  // Side-by-side steppers
  stepperRow: { flexDirection: 'row', alignItems: 'stretch' },

  // Auto-pause group
  checkboxGroupLabel: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '600',
    color: COLORS.textSecondary, marginBottom: 10,
  },
  checkboxRow: { gap: 4 },

  // Save
  saveBtn: {
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 15, alignItems: 'center', marginTop: SPACING.sm,
  },
  saveTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
