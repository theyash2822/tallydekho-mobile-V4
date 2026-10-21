/** Phone countries TallyDekho accepts — the same list as the backend's utils/phone.js and web Login.jsx. */
export type PhoneCountry = {
  name: string;
  flag: string;
  code: string;
  placeholder: string;
  minDigits: number;
  maxDigits: number;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { name: 'India',                flag: '🇮🇳', code: '+91',  placeholder: '98765 43210',   minDigits: 10, maxDigits: 10 },
  { name: 'United Arab Emirates', flag: '🇦🇪', code: '+971', placeholder: '50 123 4567',   minDigits: 9,  maxDigits: 9  },
  { name: 'Saudi Arabia',         flag: '🇸🇦', code: '+966', placeholder: '50 123 4567',   minDigits: 9,  maxDigits: 9  },
  { name: 'Kenya',                flag: '🇰🇪', code: '+254', placeholder: '712 345 678',   minDigits: 9,  maxDigits: 9  },
  { name: 'Nigeria',              flag: '🇳🇬', code: '+234', placeholder: '803 123 4567',  minDigits: 10, maxDigits: 10 },
  { name: 'Tanzania',             flag: '🇹🇿', code: '+255', placeholder: '712 345 678',   minDigits: 9,  maxDigits: 9  },
  { name: 'Uganda',               flag: '🇺🇬', code: '+256', placeholder: '712 345 678',   minDigits: 9,  maxDigits: 9  },
  { name: 'Ethiopia',             flag: '🇪🇹', code: '+251', placeholder: '91 234 5678',   minDigits: 9,  maxDigits: 9  },
  { name: 'Zimbabwe',             flag: '🇿🇼', code: '+263', placeholder: '71 234 5678',   minDigits: 9,  maxDigits: 9  },
  { name: 'South Africa',         flag: '🇿🇦', code: '+27',  placeholder: '71 234 5678',   minDigits: 9,  maxDigits: 9  },
  { name: 'Bahrain',              flag: '🇧🇭', code: '+973', placeholder: '3200 1234',     minDigits: 8,  maxDigits: 8  },
  { name: 'Kuwait',               flag: '🇰🇼', code: '+965', placeholder: '5000 1234',     minDigits: 8,  maxDigits: 8  },
  { name: 'Oman',                 flag: '🇴🇲', code: '+968', placeholder: '9123 4567',     minDigits: 8,  maxDigits: 8  },
  { name: 'Qatar',                flag: '🇶🇦', code: '+974', placeholder: '3312 3456',     minDigits: 8,  maxDigits: 8  },
  { name: 'Bangladesh',           flag: '🇧🇩', code: '+880', placeholder: '1812 345678',   minDigits: 10, maxDigits: 10 },
  { name: 'Nepal',                flag: '🇳🇵', code: '+977', placeholder: '984 1234567',   minDigits: 10, maxDigits: 10 },
  { name: 'Sri Lanka',            flag: '🇱🇰', code: '+94',  placeholder: '77 123 4567',   minDigits: 9,  maxDigits: 9  },
  { name: 'Myanmar',              flag: '🇲🇲', code: '+95',  placeholder: '92 123 4567',   minDigits: 9,  maxDigits: 9  },
  { name: 'Zambia',               flag: '🇿🇲', code: '+260', placeholder: '95 123 4567',   minDigits: 9,  maxDigits: 9  },
  { name: 'Malaysia',             flag: '🇲🇾', code: '+60',  placeholder: '12 345 6789',   minDigits: 9,  maxDigits: 10 },
];

const INDIA = PHONE_COUNTRIES[0];

/**
 * The country of an account's stored number: India keeps its 10 national digits, every
 * other country stores its full international digits (backend utils/phone.js).
 */
export function phoneCountryOf(phone: string | null | undefined): PhoneCountry {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length > 10) {
    const match = PHONE_COUNTRIES.find((c) => {
      if (c === INDIA) return false;
      const code = c.code.slice(1);
      const rest = digits.length - code.length;
      return digits.startsWith(code) && rest >= c.minDigits && rest <= c.maxDigits;
    });
    if (match) return match;
  }
  return INDIA;
}

/** The part of a stored account number typed after its country code. */
export function nationalNumberOf(phone: string | null | undefined): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  const country = phoneCountryOf(phone);
  if (country === INDIA) return digits.length > 10 ? digits.slice(-10) : digits;
  return digits.slice(country.code.length - 1);
}
