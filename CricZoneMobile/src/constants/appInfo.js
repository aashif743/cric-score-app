import { Platform } from 'react-native';

// The version currently shipping in THIS build. Bump it together with
// app.json's "version" on every release — the update prompt compares this to the
// latest version reported by the backend (GET /api/app/version) to decide
// whether to nudge the user to update.
export const APP_VERSION = '1.0.5';

// Fallback store links (used only if the backend doesn't return one).
export const STORE_URLS = {
  ios: 'https://apps.apple.com/app/id6758245259',
  android: 'https://play.google.com/store/apps/details?id=com.criczone.mobile',
};

export const storeUrlForPlatform = () =>
  Platform.OS === 'ios' ? STORE_URLS.ios : STORE_URLS.android;
