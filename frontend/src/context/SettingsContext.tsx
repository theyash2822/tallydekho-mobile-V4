import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserSettings, updateUserSettings } from '../services/api';

export interface UserSettings {
  language: string;        // 'English' | 'Hindi' | 'Gujarati' | 'Marathi' | 'Tamil' | ...
  currency: string;        // 'INR' | 'USD' | 'EUR' | etc.
  number_format: string;   // 'Indian' | 'International'
  date_format: string;     // 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
  theme: string;           // 'light' | 'dark' | 'auto'
  kpi_autoscroll: boolean;
  decimal_places: number;
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
};

interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  formatAmount: (n: number) => string;
  formatDate: (iso: string) => string;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: async () => {},
  formatAmount: (n) => '₹' + n.toLocaleString('en-IN'),
  formatDate: (d) => d,
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  // Load from AsyncStorage on mount, then sync from API
  useEffect(() => {
    AsyncStorage.getItem('userSettings').then(s => {
      if (s) {
        try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s) }); } catch {}
      }
    });
    getUserSettings().then((res: any) => {
      if (res?.data) {
        const merged = { ...DEFAULT_SETTINGS, ...res.data };
        setSettings(merged);
        AsyncStorage.setItem('userSettings', JSON.stringify(merged));
      }
    }).catch(() => {});
  }, []);

  const updateSettings = async (partial: Partial<UserSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    await AsyncStorage.setItem('userSettings', JSON.stringify(updated));
    try { await updateUserSettings(partial); } catch {}
  };

  // Currency symbol lookup
  const getCurrencySymbol = (currency: string): string => {
    const symbols: Record<string, string> = {
      INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', AUD: 'A$',
      BDT: '৳', BHD: 'BD', CAD: 'C$', CNY: '¥', JPY: '¥', KES: 'KSh',
      KWD: 'KD', LKR: 'Rs', MYR: 'RM', NGN: '₦', NPR: 'रू', NZD: 'NZ$',
      OMR: '﷼', QAR: 'QR', SAR: 'SR', SGD: 'S$', TZS: 'TSh', ZAR: 'R',
    };
    return symbols[currency] || currency;
  };

  // Number formatting
  const formatAmount = (n: number): string => {
    const symbol = getCurrencySymbol(settings.currency);
    const abs = Math.abs(n);
    const locale = settings.number_format === 'Indian' ? 'en-IN' : 'en-US';
    const formatted = abs.toLocaleString(locale, {
      minimumFractionDigits: settings.decimal_places,
      maximumFractionDigits: settings.decimal_places,
    });
    return (n < 0 ? '-' : '') + symbol + formatted;
  };

  // Date formatting
  const formatDate = (iso: string): string => {
    if (!iso || !iso.includes('-')) return iso || '';
    const parts = iso.split('T')[0].split('-');
    if (parts.length < 3) return iso;
    const [y, m, d] = parts;
    switch (settings.date_format) {
      case 'MM/DD/YYYY': return `${m}/${d}/${y}`;
      case 'YYYY-MM-DD': return `${y}-${m}-${d}`;
      default: return `${d}/${m}/${y}`; // DD/MM/YYYY
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, formatAmount, formatDate }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
