/**
 * PartyForm — shared party / ledger master form.
 *
 * Used in:
 *  - app/ledger/create.tsx          (standalone page, uses regular TextInput)
 *  - app/sales/create-invoice.tsx   (Add Customer BottomSheet, uses BottomSheetTextInput)
 *
 * Country / division pickers load Tally-exact spellings from /api/geo/*.
 * Division field label follows country (State / Emirate / Province / Division).
 * GST Details only for India — fades away for other countries.
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
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import BrandSwitch from './BrandSwitch';
import FormDropdown from './FormDropdown';
import { stateFromGstin } from '../../constants/indianStates';
import { DEFAULT_COUNTRY } from '../../constants/countries';
import { getGeoCountries, getGeoStates } from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PartyFormData {
  phone: string;
  email: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  country: string;
  state: string;
  pincode: string;
  pan: string;
  gstRegType: string;
  gstin: string;
  vatEnabled: boolean;
  vatDealerType: string;
  vatTin: string;
  cstNo: string;
  formCApplicable: boolean;
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

interface PartyInputProps extends TextInputProps {
  label?: string;
  required?: boolean;
  IC: ElementType<TextInputProps>;
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

const GST_TYPES = [
  { labelKey: 'screens.componentsFormsPartyForm.regular',                value: 'Regular' },
  { labelKey: 'screens.componentsFormsPartyForm.composition',            value: 'Composition' },
  { labelKey: 'screens.componentsFormsPartyForm.unregisteredConsumer', value: 'Unregistered/Consumer' },
  { labelKey: 'screens.componentsFormsPartyForm.sez',                    value: 'SEZ' },
];

const VAT_DEALER_TYPES = [
  { labelKey: 'screens.componentsFormsPartyForm.regular',       value: 'Regular' },
  { labelKey: 'screens.componentsFormsPartyForm.composition',   value: 'Composition' },
  { labelKey: 'screens.componentsFormsPartyForm.unregistered',  value: 'Unregistered' },
];

const PartyForm = forwardRef<PartyFormRef, {
  InputComponent?: ElementType<TextInputProps>;
  initialData?: Partial<PartyFormData>;
}>(function PartyForm({ InputComponent = TextInput, initialData }, ref) {
  const { t } = useTranslation();

  const d = { ...defaultPartyFormData, ...initialData };

  const [phone,   setPhone]   = useState(d.phone);
  const [email,   setEmail]   = useState(d.email);
  const [website, setWebsite] = useState(d.website);

  const [addressLine1, setAddressLine1] = useState(d.addressLine1);
  const [addressLine2, setAddressLine2] = useState(d.addressLine2);

  const [country, setCountry] = useState(d.country || DEFAULT_COUNTRY);
  const [state,   setState]   = useState(d.state);
  const [pincode, setPincode] = useState(d.pincode);

  const [pan,        setPan]        = useState(d.pan);
  const [gstRegType, setGstRegType] = useState(d.gstRegType);
  const [gstin,      setGstin]      = useState(d.gstin);

  const [vatEnabled,      setVatEnabled]      = useState(d.vatEnabled);
  const [vatDealerType,   setVatDealerType]   = useState(d.vatDealerType);
  const [vatTin,          setVatTin]          = useState(d.vatTin);
  const [cstNo,           setCstNo]           = useState(d.cstNo);
  const [formCApplicable, setFormCApplicable] = useState(d.formCApplicable);

  const [bankEnabled,         setBankEnabled]         = useState(d.bankEnabled);
  const [bankBeneficiaryName, setBankBeneficiaryName] = useState(d.bankBeneficiaryName);
  const [bankName,            setBankName]            = useState(d.bankName);
  const [bankAccountNo,       setBankAccountNo]       = useState(d.bankAccountNo);
  const [bankIfsc,            setBankIfsc]            = useState(d.bankIfsc);
  const [bankBranch,          setBankBranch]          = useState(d.bankBranch);

  const [countryOptions, setCountryOptions] = useState<{ label: string; value: string }[]>(
    [{ label: DEFAULT_COUNTRY, value: DEFAULT_COUNTRY }]
  );
  const [divisionLabel, setDivisionLabel] = useState('State');
  const [stateOptions, setStateOptions] = useState<{ label: string; value: string }[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);

  const isIndia = country.trim().toLowerCase() === 'india';

  useEffect(() => {
    getGeoCountries()
      .then((res: any) => {
        const rows = res?.data || [];
        if (!Array.isArray(rows) || rows.length === 0) return;
        setCountryOptions(rows.map((r: any) => ({ label: r.name, value: r.name })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!country) {
      setStateOptions([]);
      setDivisionLabel('State');
      return;
    }
    let cancelled = false;
    setGeoLoading(true);
    getGeoStates(country)
      .then((res: any) => {
        if (cancelled) return;
        setDivisionLabel(res?.meta?.division_label || 'State');
        const rows = res?.data || [];
        setStateOptions(
          (Array.isArray(rows) ? rows : []).map((r: any) => ({
            label: r.name || r.state_name,
            value: r.name || r.state_name,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) {
          setStateOptions([]);
          setDivisionLabel('State');
        }
      })
      .finally(() => { if (!cancelled) setGeoLoading(false); });
    return () => { cancelled = true; };
  }, [country]);

  useEffect(() => {
    if (!isIndia) return;
    if (gstin.length === 15) {
      const detected = stateFromGstin(gstin);
      if (detected && !state) setState(detected);
    }
  }, [gstin, isIndia]);

  const gstUnlocked = isIndia && state.trim().length > 0 && pincode.trim().length >= 4;
  const showGstinField = gstRegType !== 'Unregistered/Consumer';

  const onSelectCountry = (o: { value: string }) => {
    const next = o.value;
    setCountry(next);
    setState('');
    setPincode('');
    if (next.trim().toLowerCase() !== 'india') {
      setPan('');
      setGstRegType('Regular');
      setGstin('');
      setVatEnabled(false);
      setVatDealerType('');
      setVatTin('');
      setCstNo('');
      setFormCApplicable(false);
    }
  };

  useImperativeHandle(ref, () => ({
    getData: () => ({
      phone, email, website,
      addressLine1, addressLine2,
      country, state, pincode,
      pan: isIndia ? pan : '',
      gstRegType: isIndia ? gstRegType : 'Unregistered/Consumer',
      gstin: isIndia ? gstin : '',
      vatEnabled: isIndia ? vatEnabled : false,
      vatDealerType: isIndia ? vatDealerType : '',
      vatTin: isIndia ? vatTin : '',
      cstNo: isIndia ? cstNo : '',
      formCApplicable: isIndia ? formCApplicable : false,
      bankEnabled, bankBeneficiaryName, bankName, bankAccountNo, bankIfsc, bankBranch,
    }),
    reset: () => {
      setPhone(''); setEmail(''); setWebsite('');
      setAddressLine1(''); setAddressLine2('');
      setCountry(DEFAULT_COUNTRY); setState(''); setPincode('');
      setPan(''); setGstRegType('Regular'); setGstin('');
      setVatEnabled(false); setVatDealerType(''); setVatTin(''); setCstNo(''); setFormCApplicable(false);
      setBankEnabled(false); setBankBeneficiaryName(''); setBankName(''); setBankAccountNo(''); setBankIfsc(''); setBankBranch('');
    },
  }));

  const IC = InputComponent;

  return (
    <View>
      <Text style={f.sectionTitle}>{t('screens.componentsFormsPartyForm.contact')}</Text>

      <PartyInput IC={IC} label={t('screens.componentsFormsPartyForm.mobileNumber')} placeholder={t('screens.componentsFormsPartyForm.mobilePlaceholder')}
        value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      <PartyInput IC={IC} label={t('profile.email')} placeholder={t('screens.componentsFormsPartyForm.emailPlaceholder')}
        value={email} onChangeText={setEmail}
        keyboardType="email-address" autoCapitalize="none" />

      <PartyInput IC={IC} label={t('company.website')} placeholder={t('screens.componentsFormsPartyForm.websitePlaceholder')}
        value={website} onChangeText={setWebsite}
        autoCapitalize="none" keyboardType="url" />

      <View style={f.divider} />
      <Text style={f.sectionTitle}>{t('screens.componentsFormsPartyForm.mailingAddress')}</Text>

      <PartyInput IC={IC} label={t('screens.componentsFormsPartyForm.addressLine1')} placeholder={t('screens.componentsFormsPartyForm.addressLine1Placeholder')}
        value={addressLine1} onChangeText={setAddressLine1} />

      <PartyInput IC={IC} label={t('screens.componentsFormsPartyForm.addressLine2')} placeholder={t('screens.componentsFormsPartyForm.addressLine2Placeholder')}
        value={addressLine2} onChangeText={setAddressLine2} />

      <FormDropdown
        label={t('languageRegion.country')}
        value={country}
        options={countryOptions}
        onSelect={onSelectCountry}
        placeholder={t('screens.componentsFormsPartyForm.selectCountry')}
      />

      <FormDropdown
        label={divisionLabel}
        required={stateOptions.length > 0}
        value={state}
        options={stateOptions}
        onSelect={o => setState(o.value)}
        placeholder={
          geoLoading
            ? t('screens.componentsFormsPartyForm.loadingDivision', { division: divisionLabel.toLowerCase() })
            : stateOptions.length === 0
              ? t('screens.componentsFormsPartyForm.noDivisionList', { division: divisionLabel.toLowerCase() })
              : t('screens.componentsFormsPartyForm.selectDivision', { division: divisionLabel.toLowerCase() })
        }
      />

      <PartyInput
        IC={IC}
        label={t('screens.componentsFormsPartyForm.pincode')}
        required={isIndia}
        placeholder={isIndia ? t('screens.componentsFormsPartyForm.pincodePlaceholder') : t('screens.componentsFormsPartyForm.postalPlaceholder')}
        value={pincode}
        onChangeText={setPincode}
        keyboardType="numeric"
        maxLength={isIndia ? 6 : 12}
      />

      {isIndia && (
        <>
          <View style={f.divider} />
          <View style={f.sectionHeaderRow}>
            <Text style={f.sectionTitle}>{t('screens.componentsFormsPartyForm.gstDetails')}</Text>
            {!gstUnlocked && <Text style={f.lockHint}>{t('screens.componentsFormsPartyForm.fillFirst', { division: divisionLabel })}</Text>}
          </View>

          {gstUnlocked ? (
            <>
              <PartyInput IC={IC} label={t('screens.componentsFormsPartyForm.pan')} placeholder="ABCDE1234F"
                value={pan} onChangeText={v => setPan(v.toUpperCase())}
                autoCapitalize="characters" maxLength={10} />

              <FormDropdown
                label={t('screens.componentsFormsPartyForm.gstRegType')}
                required
                value={gstRegType}
                options={GST_TYPES.map(o => ({ label: t(o.labelKey), value: o.value }))}
                onSelect={o => {
                  setGstRegType(o.value);
                  if (o.value === 'Unregistered/Consumer') setGstin('');
                }}
                placeholder={t('screens.componentsFormsPartyForm.selectGstType')}
              />

              {showGstinField && (
                <PartyInput IC={IC} label={t('screens.componentsFormsPartyForm.gstin')} placeholder="24ABCDE1234F1Z5"
                  value={gstin} onChangeText={v => setGstin(v.toUpperCase())}
                  autoCapitalize="characters" maxLength={15} />
              )}

              <View style={f.divider} />
              <View style={f.toggleRow}>
                <Text style={f.toggleLabel}>{t('screens.componentsFormsPartyForm.vatDetails')}</Text>
                <BrandSwitch value={vatEnabled} onValueChange={setVatEnabled} />
              </View>

              {vatEnabled && (
                <View style={f.expandSection}>
                  <FormDropdown
                    label={t('screens.componentsFormsPartyForm.dealerType')}
                    value={vatDealerType}
                    options={VAT_DEALER_TYPES.map(o => ({ label: t(o.labelKey), value: o.value }))}
                    onSelect={o => setVatDealerType(o.value)}
                    placeholder={t('screens.componentsFormsPartyForm.selectDealerType')}
                  />

                  <PartyInput IC={IC} label={t('screens.componentsFormsPartyForm.vatTin')} placeholder={t('screens.componentsFormsPartyForm.vatTinPlaceholder')}
                    value={vatTin} onChangeText={setVatTin} />

                  <PartyInput IC={IC} label={t('screens.componentsFormsPartyForm.cstNo')} placeholder={t('screens.componentsFormsPartyForm.cstNoPlaceholder')}
                    value={cstNo} onChangeText={setCstNo} />

                  <View style={[f.toggleRow, { marginTop: 12 }]}>
                    <Text style={f.toggleLabel}>{t('screens.componentsFormsPartyForm.formC')}</Text>
                    <BrandSwitch value={formCApplicable} onValueChange={setFormCApplicable} />
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={f.lockedBox}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textTertiary} />
              <Text style={f.lockedText}>
                {t('screens.componentsFormsPartyForm.unlockHint', { division: divisionLabel.toLowerCase() })}
              </Text>
            </View>
          )}
        </>
      )}

      {/* Bank Details section removed 2026-07-06 — not required on customer
          ledgers; if Tally has bank details we still READ them on sync into
          our DB, we just don't WRITE from mobile. Interface + state fields
          kept so callers/refs don't break; bankEnabled stays false so payload
          bankDetails is always undefined. */}
    </View>
  );
});

export default PartyForm;

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
