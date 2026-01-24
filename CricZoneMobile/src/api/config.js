import axios from 'axios';

// API Base URL - Use 10.0.2.2 for Android emulator, local IP for physical devices
const PRODUCTION_API_URL = 'https://cric-score-app.onrender.com';

// Your local IP address - update this if your IP changes
const LOCAL_IP = '192.168.1.45';

const getBaseUrl = () => {
  if (__DEV__) {
    // Use local IP for physical devices, localhost for iOS simulator, 10.0.2.2 for Android emulator
    // For physical device testing, always use LOCAL_IP
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
