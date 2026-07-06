/**
 * Countries supported by TallyDekho.
 * Names match Tally Prime canonical spellings — DO NOT change without verifying
 * against Tally's country master list (each Tally installation ships one).
 *
 * Kept in sync with `app/settings/language.tsx` COUNTRY_TZ keys. If a new
 * country is added here, add its timezone(s) and currency there too.
 *
 * Default: India (Tally's built-in default; every install has this master).
 */

export const COUNTRIES: string[] = [
  'Australia',
  'Bahrain',
  'Bangladesh',
  'Canada',
  'China',
  'France',
  'Germany',
  'India',
  'Japan',
  'Kenya',
  'Kuwait',
  'Malaysia',
  'Nepal',
  'New Zealand',
  'Nigeria',
  'Oman',
  'Qatar',
  'Saudi Arabia',
  'Singapore',
  'South Africa',
  'Sri Lanka',
  'Tanzania',
  'UAE',
  'United Kingdom',
  'United States',
];

export const DEFAULT_COUNTRY = 'India';
