// Lightweight, fire-and-forget usage analytics for the mobile app.
//
// Signed-in users are already counted as "active" server-side (the auth
// middleware stamps User.lastActive on every authenticated request). These
// events add app-open counts, platform breakdown, and an anonymous visitorId so
// unique devices can be measured alongside the web viewers. Analytics must never
// break the app — every path is guarded and failures are swallowed.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/config';

const VISITOR_KEY = 'cz_visitor_id';
let cachedVisitorId = null;
const sentOnce = new Set();

async function getVisitorId() {
  if (cachedVisitorId) return cachedVisitorId;
  try {
    let id = await AsyncStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      await AsyncStorage.setItem(VISITOR_KEY, id);
    }
    cachedVisitorId = id;
    return id;
  } catch (_) {
    return '';
  }
}

// type: 'app_open' | 'live_view' | ...
// meta: { path?, tournamentId?, once? } — pass once:true to send at most once per app session.
export async function trackEvent(type, meta = {}) {
  try {
    const key = `${type}|${meta.path || ''}`;
    if (meta.once) {
      if (sentOnce.has(key)) return;
      sentOnce.add(key);
    }
    const visitorId = await getVisitorId();
    // Reuse the shared axios instance — its interceptor attaches the auth token
    // when signed in, so the event is attributed to the user automatically.
    API.post('/analytics/event', {
      type,
      visitorId,
      path: meta.path || '',
      tournamentId: meta.tournamentId || null,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    }).catch(() => {});
  } catch (_) {
    /* never throw from analytics */
  }
}

export default { trackEvent };
