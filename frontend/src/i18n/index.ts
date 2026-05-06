import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import hi from './locales/hi.json';
import gu from './locales/gu.json';
import mr from './locales/mr.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import kn from './locales/kn.json';
import pa from './locales/pa.json';
import bn from './locales/bn.json';
import ml from './locales/ml.json';
import or from './locales/or.json';

// Map SettingsContext language values to i18n language codes
export const LANGUAGE_CODE_MAP: Record<string, string> = {
  'English':   'en',
  'Hindi':     'hi',
  'Gujarati':  'gu',
  'Marathi':   'mr',
  'Tamil':     'ta',
  'Telugu':    'te',
  'Kannada':   'kn',
  'Punjabi':   'pa',
  'Bengali':   'bn',
  'Malayalam': 'ml',
  'Odia':      'or',
};

const resources = { en, hi, gu, mr, ta, te, kn, pa, bn, ml, or };

i18n
  .use(initReactI18next)
  .init({
    resources: Object.fromEntries(
      Object.entries(resources).map(([code, translations]) => [
        code,
        { translation: translations },
      ])
    ),
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

export default i18n;
