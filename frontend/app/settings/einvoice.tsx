import React from 'react';
import { useTranslation } from 'react-i18next';
import IntegrationSettingsScreen from '../../src/components/compliance/IntegrationSettingsScreen';

/** Settings → E-invoice: per-company PeriOne credentials and activation. */
export default function EInvoiceScreen() {
  const { t } = useTranslation();
  return (
    <IntegrationSettingsScreen
      domain="einvoice"
      ns="screens.settingsEinvoice"
      title={t('settings.eInvoice')}
      portalUrl="https://einvoice1.gst.gov.in"
      portalLabel={t('screens.settingsEinvoice.openIrpPortal')}
      howTo={t('screens.settingsEinvoice.howTo', { defaultValue: 'On the e-Invoice portal go to API Registration → User Credentials → Create API User, choose "Through GSP", select PeriOne, then enter that API user here.' })}
    />
  );
}
