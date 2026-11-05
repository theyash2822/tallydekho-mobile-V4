/**
 * Website demo build (EXPO_PUBLIC_DEMO_MODE=1, web only): the app opens signed in on recorded sample data and
 * nothing can be created, changed or deleted. Normal builds never set the flag.
 */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === '1';
