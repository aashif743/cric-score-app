import { Platform } from 'react-native';
import API from '../api/config';
import { APP_VERSION, storeUrlForPlatform } from '../constants/appInfo';

// Compare two dotted versions ("1.0.5" vs "1.0.6"). Returns 1 if a>b, -1 if
// a<b, 0 if equal. Missing segments count as 0 and non-numerics are ignored.
export const compareVersions = (a, b) => {
  const pa = String(a || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
};

// Ask the backend for the latest version for this platform. Returns null when
// the app is already up to date OR on any error (a version check must NEVER
// block or crash the app). Otherwise returns the info the prompt needs.
export const checkForUpdate = async () => {
  try {
    const res = await API.get('/app/version');
    const data = res?.data?.data || res?.data;
    if (!data) return null;

    const platform = Platform.OS === 'ios' ? data.ios : data.android;
    if (!platform || !platform.latestVersion) return null;

    const updateAvailable = compareVersions(APP_VERSION, platform.latestVersion) < 0;
    if (!updateAvailable) return null;

    // Below the minimum supported version → the update is mandatory.
    const forceUpdate = platform.minVersion
      ? compareVersions(APP_VERSION, platform.minVersion) < 0
      : false;

    return {
      currentVersion: APP_VERSION,
      latestVersion: platform.latestVersion,
      storeUrl: platform.storeUrl || storeUrlForPlatform(),
      releaseNotes: data.releaseNotes || '',
      forceUpdate,
    };
  } catch (e) {
    return null;
  }
};
