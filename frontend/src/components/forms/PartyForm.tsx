/**
 * PartyForm — shared party / ledger master form.
 *
 * Used in:
 *  - app/ledger/create.tsx          (standalone page, uses regular TextInput)
 *  - app/sales/create-invoice.tsx   (Add Customer BottomSheet, uses BottomSheetTextInput)
 *
 * Usage:
 *   const formRef = useRef<PartyFormRef>(null);
 *   <PartyForm ref={formRef} />
 *   const data = formRef.current.getData();   // on save
 *   formRef.current.reset();                  // on dismiss / after save
 *
 * Pass InputComponent={BottomSheetTextInput} when rendering inside a BottomSheet.
 */

import React, {
  useState, useImperativeHandle, forwardRef,
  ElementType, useEffect, memo,
} from 'react';
import {
  View, Text, TextInput, TextInputProps,
  StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import BrandSwitch from './BrandSwitch';
import FormDropdown from './FormDropdown';
import { INDIAN_STATES, stateFromGstin } from '../../constants/indianStates';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PartyFormData {
  // Contact
  phone: string;
  email: string;
  website: string;
  // Mailing address
  addressLine1: string;
  addressLine2: string;
  // Location (required before GST unlocks)
  country: string;
  state: string;
  pincode: string;
  // GST
  pan: string;
  gstRegType: string;
  gstin: string;
  // VAT (legacy, toggle)
  vatEnabled: boolean;
  vatDealerType: string;
  vatTin: string;
  cstNo: string;
  formCApplicable: boolean;
  // Bank (toggle)
  bankEnabled: boolean;
  bankBeneficiaryName: string;
  bankName: string;
  bankAccountNo: string;
  bankIfsc: string;
  bankBranch: string;
}

export interface PartyFormRef {
  getData: () => PartyFormData;
  reset: () => void;
}

export const defaultPartyFormData: PartyFormData = {
  phone: '', email: '', website: '',
  addressLine1: '', addressLine2: '',
  country: 'India', state: '', pincode: '',
  pan: '', gstRegType: 'Regular', gstin: '',
  vatEnabled: false, vatDealerType: '', vatTin: '', cstNo: '', formCApplicable: false,
  bankEnabled: false, bankBeneficiaryName: '', bankName: '', bankAccountNo: '', bankIfsc: '', bankBranch: '',
};

// ─── PartyInput — stable component defined OUTSIDE PartyForm ────────────────
// CRITICAL: must not be defined inside PartyForm's render body.
// If defined inside, React creates a new component type on every keystroke
// which forces TextInput to unmount → keyboard closes.
interface PartyInputProps extends TextInputProps {
  label?: string;
  required?: boolean;
  IC: ElementType<TextInputProps>; // InputComponent
}
const PartyInput = memo(function PartyInput({ label, required: req, IC, ...props }: PartyInputProps) {
  return (
    <>
      {label ? (
        <Text style={f.label}>
          {label}{req ? <Text style={f.star}> *</Text> : null}
        </Text>
      ) : null}
      <IC
        placeholderTextColor={COLORS.textTertiary}
        style={[f.input, Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any })]}
        {...props}
      />
    </>
  );
});

// ─── Options ─────────────────────────────────────────────────────────────────
const GST_TYPES = [
  { label: 'Regular',                value: 'Regular' },
  { label: 'Composition',            value: 'Composition' },
  { label: 'Unregistered / Consumer', value: 'Unregistered/Consumer' },
  { label: 'SEZ',                    value: 'SEZ' },
];

const VAT_DEALER_TYPES = [
  { label: 'Regular',       value: 'Regular' },
  { label: 'Composition',   value: 'Composition' },
  { label: 'Unregistered',  value: 'Unregistered' },
];

const COUNTRY_OPTIONS = [{ label: 'India', value: 'India' }];

// ─── Component ────────────────────────────────────────────────────────────────
const PartyForm = forwardRef<PartyFormRef, {
  InputComponent?: ElementType<TextInputProps>;
  initialData?: Partial<PartyFormData>;
}>(function PartyForm({ InputComponent = TextInput, initialData }, ref) {

  const d = { ...defaultPartyFormData, ...initialData };

  // Contact
  const [phone,   setPhone]   = useState(d.phone);
  const [email,   setEmail]   = useState(d.email);
  const [website, setWebsite] = useState(d.website);

  // Mailing address
  const [addressLine1, setAddressLine1] = useState(d.addressLine1);
  const [addressLine2, setAddressLine2] = useState(d.addressLine2);

  // Location
  const [country, setCountry] = useState(d.country);
  const [state,   setState]   = useState(d.state);
  const [pincode, setPincode] = useState(d.pincode);

  // GST
  const [pan,        setPan]        = useState(d.pan);
  const [gstRegType, setGstRegType] = useState(d.gstRegType);
  const [gstin,      setGstin]      = useState(d.gstin);

  // VAT
  const [vatEnabled,      setVatEnabled]      = useState(d.vatEnabled);
  const [vatDealerType,   setVatDealerType]   = useState(d.vatDealerType);
  const [vatTin,          setVatTin]          = useState(d.vatTin);
  const [cstNo,           setCstNo]           = useState(d.cstNo);
  const [formCApplicable, setFormCApplicable] = useState(d.formCApplicable);

  // Bank
  const [bankEnabled,         setBankEnabled]         = useState(d.bankEnabled);
  const [bankBeneficiaryName, setBankBeneficiaryName] = useState(d.bankBeneficiaryName);
  const [bankName,            setBankName]            = useState(d.bankName);
  const [bankAccountNo,       setBankAccountNo]       = useState(d.bankAccountNo);
  const [bankIfsc,            setBankIfsc]            = useState(d.bankIfsc);
  const [bankBranch,          setBankBranch]          = useState(d.bankBranch);

  // Auto-detect state from GSTIN when user types it
  useEffect(() => {
    if (gstin.length === 15) {
      const detected = stateFromGstin(gstin);
      if (detected && !state) setState(detected);
    }
  }, [gstin]);

  // GST section unlocks only when country + state + pincode are filled
  const gstUnlocked = country.trim().length > 0 && state.trim().length > 0 && pincode.trim().length >= 4;
  // GSTIN field hidden for Unregistered/Consumer
  const showGstinField = gstRegType !== 'Unregistered/Consumer';

  // ── Ref API ──
  useImperativeHandle(ref, () => ({
    getData: () => ({
      phone, email, website,
      addressLine1, addressLine2,
      country, state, pincode,
      pan, gstRegType, gstin,
      vatEnabled, vatDealerType, vatTin, cstNo, formCApplicable,
      bankEnabled, bankBeneficiaryName, bankName, bankAccountNo, bankIfsc, bankBranch,
    }),
    reset: () => {
      setPhone(''); setEmail(''); setWebsite('');
      setAddressLine1(''); setAddressLine2('');
      setCountry('India'); setState(''); setPincode('');
      setPan(''); setGstRegType('Regular'); setGstin('');
      setVatEnabled(false); setVatDealerType(''); setVatTin(''); setCstNo(''); setFormCApplicable(false);
      setBankEnabled(false); setBankBeneficiaryName(''); setBankName(''); setBankAccountNo(''); setBankIfsc(''); setBankBranch('');
    },
  }));

  // Stable shorthand — passes stable InputComponent reference to the
  // memoized PartyInput component defined outside this render function.
  const IC = InputComponent;

  return (
    <View>
      {/* ══ CONTACT ══════════════════════════════════════════════════════════ */}
      <Text style={f.sectionTitle}>Contact</Text>

      <PartyInput IC={IC} label="Mobile Number" placeholder="Enter mobile number"
        value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      <PartyInput IC={IC} label="Email" placeholder="Enter email address"
        value={email} onChangeText={setEmail}
        keyboardType="email-address" autoCapitalize="none" />

      <PartyInput IC={IC} label="Website" placeholder="Website (optional)"
        value={website} onChangeText={setWebsite}
        autoCapitalize="none" keyboardType="url" />

      {/* ══ MAILING ADDRESS ══════════════════════════════════════════════════ */}
      <View style={f.divider} />
      <Text style={f.sectionTitle}>Mailing Address</Text>

      <PartyInput IC={IC} label="Address Line 1" placeholder="Street, Building, Shop No."
        value={addressLine1} onChangeText={setAddressLine1} />

      <PartyInput IC={IC} label="Address Line 2" placeholder="Area, Landmark (optional)"
        value={addressLine2} onChangeText={setAddressLine2} />

      <FormDropdown
        label="Country"
        value={country}
        options={COUNTRY_OPTIONS}
        onSelect={o => { setCountry(o.value); setState(''); setPincode(''); }}
        placeholder="Select country"
      />

      <FormDropdown
        label="State"
        required
        value={state}
        options={INDIAN_STATES.map(s => ({ label: s, value: s }))}
        onSelect={o => setState(o.value)}
        placeholder="Select state"
      />

      <PartyInput IC={IC} label="Pincode" required placeholder="6-digit pincode"
        value={pincode} onChangeText={setPincode}
        keyboardType="numeric" maxLength={6} />

      {/* ══ GST DETAILS ══════════════════════════════════════════════════════ */}
      <View style={f.divider} />
      <View style={f.sectionHeaderRow}>
        <Text style={f.sectionTitle}>GST Details</Text>
        {!gstUnlocked && <Text style={f.lockHint}>Fill State &amp; Pincode first</Text>}
      </View>

      {gstUnlocked ? (
        <>
          <PartyInput IC={IC} label="PAN / IT No." placeholder="ABCDE1234F"
            value={pan} onChangeText={v => setPan(v.toUpperCase())}
            autoCapitalize="characters" maxLength={10} />

          <FormDropdown
            label="GST Registration Type"
            required
            value={gstRegType}
            options={GST_TYPES}
            onSelect={o => {
              setGstRegType(o.value);
              if (o.value === 'Unregistered/Consumer') setGstin('');
            }}
            placeholder="Select GST type"
          />

          {showGstinField && (
            <PartyInput IC={IC} label="GSTIN / UIN" placeholder="24ABCDE1234F1Z5"
              value={gstin} onChangeText={v => setGstin(v.toUpperCase())}
              autoCapitalize="characters" maxLength={15} />
          )}

          {/* ── VAT Details (legacy toggle) ── */}
          <View style={f.divider} />
          <View style={f.toggleRow}>
            <Text style={f.toggleLabel}>VAT Details</Text>
            <BrandSwitch value={vatEnabled} onValueChange={setVatEnabled} />
          </View>

          {vatEnabled && (
            <View style={f.expandSection}>
              <FormDropdown
                label="Type of Dealer"
                value={vatDealerType}
                options={VAT_DEALER_TYPES}
                onSelect={o => setVatDealerType(o.value)}
                placeholder="Select dealer type"
              />

              <PartyInput IC={IC} label="VAT TIN No." placeholder="Enter VAT TIN number"
                value={vatTin} onChangeText={setVatTin} />

              <PartyInput IC={IC} label="CST No." placeholder="Enter CST number"
                value={cstNo} onChangeText={setCstNo} />

              <View style={[f.toggleRow, { marginTop: 12 }]}>
                <Text style={f.toggleLabel}>Sales / Purchase against Form C</Text>
                <BrandSwitch value={formCApplicable} onValueChange={setFormCApplicable} />
              </View>
            </View>
          )}
        </>
      ) : (
        <View style={f.lockedBox}>
          <Ionicons name="lock-closed-outline" size={18} color={COLORS.textTertiary} />
          <Text style={f.lockedText}>
            Enter country, state and pincode above to unlock GST details
          </Text>
        </View>
      )}

      {/* ══ BANK DETAILS ═════════════════════════════════════════════════════ */}
      <View style={f.divider} />
      <View style={f.toggleRow}>
        <Text style={f.toggleLabel}>Bank Details</Text>
        <BrandSwitch value={bankEnabled} onValueChange={setBankEnabled} />
      </View>

      {bankEnabled && (
        <View style={f.expandSection}>
          <PartyInput IC={IC} label="Beneficiary Name" placeholder="Enter beneficiary name"
            value={bankBeneficiaryName} onChangeText={setBankBeneficiaryName} />
          <PartyInput IC={IC} label="Bank Name" placeholder="Enter bank name"
            value={bankName} onChangeText={setBankName} />
          <PartyInput IC={IC} label="Account Number" placeholder="Enter account number"
            value={bankAccountNo} onChangeText={setBankAccountNo} keyboardType="numeric" />
          <PartyInput IC={IC} label="IFSC Code" placeholder="Enter IFSC code"
            value={bankIfsc} onChangeText={v => setBankIfsc(v.toUpperCase())}
            autoCapitalize="characters" />
          <PartyInput IC={IC} label="Bank Branch" placeholder="Enter branch name"
            value={bankBranch} onChangeText={setBankBranch} />
        </View>
      )}
    </View>
  );
});

export default PartyForm;

// ─── Styles ───────────────────────────────────────────────────────────────────
const f = StyleSheet.create({
  sectionTitle: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 4,
    marginBottom: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  lockHint: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textTertiary,
  },
  label: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 18,
  },
  star: { color: COLORS.negative },
  input: {
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: TYPOGRAPHY.base,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.cardBg,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderDefault,
    marginVertical: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleLabel: {
    fontSize: TYPOGRAPHY.base,
    color: COLORS.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  expandSection: {
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: 8,
  },
  lockedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md,
    padding: 14,
    marginTop: 8,
  },
  lockedText: {
    flex: 1,
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.textTertiary,
    lineHeight: 18,
  },
});
