import axios from 'axios';
import { Platform, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Broadcast name used to force a global logout when a token is rejected (401).
export const UNAUTHORIZED_EVENT = 'auth:unauthorized';

// Auth endpoints where a 401 means "wrong OTP", NOT "expired session" —
// we must not wipe the session for these.
const AUTH_PATHS = ['/users/send-otp', '/users/verify-otp', '/users/login'];

// API Base URL configuration
const PRODUCTION_API_URL = 'https://cric-score-app.onrender.com';

// Your local IP address - update this if your IP changes (for physical device testing)
const LOCAL_IP = '192.168.1.45';

const getBaseUrl = () => {
  if (__DEV__) {
    // iOS simulator can use localhost directly
    // Android emulator needs 10.0.2.2
    // Physical devices need your local IP
    if (Platform.OS === 'ios') {
      return 'http://localhost:5002';
    } else if (Platform.OS === 'android') {
      return 'http://10.0.2.2:5002';
    }
    return `http://${LOCAL_IP}:5002`;
  }
  // Production build - use your deployed server URL
  return PRODUCTION_API_URL;
};

export const API_BASE_URL = getBaseUrl();
export const SOCKET_URL = getBaseUrl();

// Create axios instance with longer timeout for cold starts
const API = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 seconds for cold start
});

// Retry configuration for cold starts
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

// Helper function to delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Request interceptor to add retry config
API.interceptors.request.use((config) => {
  config.retryCount = config.retryCount || 0;
  return config;
});

// Response interceptor with retry logic for cold starts
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Check if we should retry (timeout or network error, not 4xx/5xx)
    const isRetryable =
      (error.code === 'ECONNABORTED' || // timeout
       error.code === 'ERR_NETWORK' ||  // network error
       !error.response) &&              // no response (server down/cold start)
      config.retryCount < MAX_RETRIES;

    if (isRetryable) {
      config.retryCount += 1;
      console.log(`Retrying request (${config.retryCount}/${MAX_RETRIES}): ${config.url}`);

      // Wait before retrying (exponential backoff)
      await delay(RETRY_DELAY * config.retryCount);

      return API(config);
    }

    // Expired / invalid token: clear the stored session and force the app back
    // to login so the user re-authenticates and gets a fresh token. Without
    // this, an expired token makes every screen show "Failed to fetch".
    const url = config?.url || '';
    const isAuthCall = AUTH_PATHS.some((p) => url.includes(p));
    if (error.response?.status === 401 && !isAuthCall) {
      try {
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('currentMatch');
      } catch (e) {
        // ignore storage errors — the event below still logs the user out
      }
      DeviceEventEmitter.emit(UNAUTHORIZED_EVENT);
      return Promise.reject({ error: 'Your session has expired. Please log in again.' });
    }

    const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
    return Promise.reject({ error: errorMessage });
  }
);

export default API;
