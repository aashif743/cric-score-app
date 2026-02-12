import axios from 'axios';
import { Platform } from 'react-native';

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

    const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
    return Promise.reject({ error: errorMessage });
  }
);

export default API;
