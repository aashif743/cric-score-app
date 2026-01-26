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

// Create axios instance
const API = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Response interceptor for error handling
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
    return Promise.reject({ error: errorMessage });
  }
);

export default API;
