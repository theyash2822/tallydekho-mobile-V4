/**
 * Website demo build (EXPO_PUBLIC_DEMO_MODE=1, web only): the app opens signed in on recorded sample data and
 * nothing can be created, changed or deleted. Normal builds never set the flag.
 *
 * The platform guard (SEC-050) makes the flag inert in a native build even if the env var leaks into an EAS
 * profile: demo mode disables sign-out and the socket, which against the real backend would be a hazard.
 */
import { Platform } from 'react-native';

export const DEMO_MODE = Platform.OS === 'web' && process.env.EXPO_PUBLIC_DEMO_MODE === '1';
