import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserSettings, updateUserSettings } from '../services/api';
import i18n, { LANGUAGE_CODE_MAP } from '../i18n';
import {
  formatAmount as _formatAmount,
  formatAmountCompact as _formatAmountCompact,
  formatDate as _formatDate,
  getCurrencySymbol,
  DEFAULT_FORMAT_SETTINGS,
} from '../utils/format';

export interface UserSettings {
  language: string;        // 'English' | 'Hindi' | 'Gujarati' | 'Marathi' | 'Tamil' | ...
  currency: string;        // 'INR' | 'USD' | 'EUR' | etc.
  number_format: string;   // 'Indian' | 'International'
  date_format: string;     // 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
  theme: string;           // 'light' | 'dark' | 'auto'
  kpi_autoscroll: boolean;
  decimal_places: number;
  country?: string;        // 'India' | 'UAE' | 'United States' | ...
  timezone?: string;       // 'UTC+05:30 · Asia/Kolkata' | ...
  week_start?: string;     // 'Monday' | 'Sunday' | ...
  voucher_terms?: string;
  qr_type?: string;
  qr_value?: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  language: 'English',
  currency: 'INR',
  number_format: 'Indian',
  date_format: 'DD/MM/YYYY',
  theme: 'light',
  kpi_autoscroll: true,
  decimal_places: 2,
  country: 'India',
  timezone: 'UTC+05:30 · Asia/Kolkata',
  week_start: 'Monday',
};

interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  /** Full amount: ₹1,25,000.00 / $125,000.00 */
  formatAmount: (n: number) => string;
  /** Compact amount for KPI cards, charts: ₹1.2L / $125K / $1.2M */
  formatAmountCompact: (n: number) => string;
  /** Currency symbol only: ₹ / $ / € */
  currencySymbol: string;
  /** Format ISO date strings per user's date_format setting */
  formatDate: (iso: string) => string;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: async () => {},
  formatAmount: (n) => _formatAmount(n, DEFAULT_FORMAT_SETTINGS),
  formatAmountCompact: (n) => _formatAmountCompact(n, DEFAULT_FORMAT_SETTINGS),
  currencySymbol: '₹',
  formatDate: (d) => d,
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  // Load from AsyncStorage on mount, then sync from API
  useEffect(() => {
    AsyncStorage.getItem('userSettings').then(s => {
      if (s) {
        try {
          const merged = { ...DEFAULT_SETTINGS, ...JSON.parse(s) };
          setSettings(merged);
          // Apply cached language immediately (before API returns)
          const code = LANGUAGE_CODE_MAP[merged.language] || 'en';
          i18n.changeLanguage(code);
        } catch {}
      }
    });
    getUserSettings().then((res: any) => {
      if (res?.data) {
        const merged = { ...DEFAULT_SETTINGS, ...res.data };
        setSettings(merged);
        // Apply stored language to i18next
        const code = LANGUAGE_CODE_MAP[merged.language] || 'en';
        i18n.changeLanguage(code);
        AsyncStorage.setItem('userSettings', JSON.stringify(merged));
      }
    }).catch(() => {});
  }, []);

  const updateSettings = async (partial: Partial<UserSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    // Sync language change to i18next immediately
    if (partial.language) {
      const code = LANGUAGE_CODE_MAP[partial.language] || 'en';
      i18n.changeLanguage(code);
    }
    await AsyncStorage.setItem('userSettings', JSON.stringify(updated));
    try { await updateUserSettings(partial); } catch {}
  };

  const fmtSettings = {
    currency:       settings.currency,
    number_format:  settings.number_format,
    decimal_places: settings.decimal_places,
    date_format:    settings.date_format,
  };

  const formatAmount        = (n: number) => _formatAmount(n, fmtSettings);
  const formatAmountCompact = (n: number) => _formatAmountCompact(n, fmtSettings);
  const currencySymbol      = getCurrencySymbol(settings.currency);
  const formatDate          = (iso: string) => _formatDate(iso, fmtSettings);

  return (
    <SettingsContext.Provider value={{
      settings,
      updateSettings,
      formatAmount,
      formatAmountCompact,
      currencySymbol,
      formatDate,
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
