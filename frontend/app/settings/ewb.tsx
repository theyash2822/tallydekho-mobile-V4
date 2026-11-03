import React from 'react';
import { useTranslation } from 'react-i18next';
import IntegrationSettingsScreen from '../../src/components/compliance/IntegrationSettingsScreen';

/** Settings → E-way bill: per-company PeriOne credentials and activation. */
export default function EWBIntegrationScreen() {
  const { t } = useTranslation();
  return (
    <IntegrationSettingsScreen
      domain="eway"
      ns="screens.settingsEwb"
      title={t('settings.ewayBill')}
      portalUrl="https://ewaybillgst.gov.in"
      portalLabel={t('screens.settingsEwb.openPortal')}
      howTo={t('screens.settingsEwb.howTo', { defaultValue: 'On the E-Way Bill portal go to Registration → For GSP, select PeriOne and create the API user, then enter it here.' })}
    />
  );
}
