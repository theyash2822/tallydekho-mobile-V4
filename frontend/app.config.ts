import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic layer over app.json. Everything static (name, slug, scheme, bundle ids,
 * plugins) stays in app.json; this file only adjusts what depends on the build
 * environment:
 *
 * - iOS `NSAllowsLocalNetworking` is needed in development/staging so the app can
 *   reach the LAN backend over plain http; a production build must not ship it.
 *   `EXPO_PUBLIC_APP_ENV` comes from the EAS build profile (eas.json).
 * - The website demo build (`EXPO_PUBLIC_DEMO_MODE=1`) is a one-page web app served
 *   from auditer.com/demo, so it needs single-page output and that base path.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const isProduction = process.env.EXPO_PUBLIC_APP_ENV === 'production';

  const ios = config.ios ?? {};
  const infoPlist = { ...(ios.infoPlist ?? {}) };
  const ats: Record<string, unknown> = { ...(infoPlist.NSAppTransportSecurity ?? {}) };
  if (isProduction) delete ats.NSAllowsLocalNetworking;
  else ats.NSAllowsLocalNetworking = true;

  const isDemo = process.env.EXPO_PUBLIC_DEMO_MODE === '1';

  return {
    ...config,
    name: config.name ?? 'Auditer',
    slug: config.slug ?? 'auditor',
    ios: {
      ...ios,
      infoPlist: { ...infoPlist, NSAppTransportSecurity: ats },
    },
    ...(isDemo
      ? {
          web: { ...(config.web ?? {}), output: 'single' as const },
          experiments: { ...(config.experiments ?? {}), baseUrl: '/demo' },
        }
      : {}),
  };
};
