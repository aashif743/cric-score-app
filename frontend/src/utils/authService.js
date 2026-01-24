import axios from "axios";

// Use environment variable for API URL, fallback to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const API_URL = `${API_BASE_URL}/api/users/`;

/**
 * Requests an OTP from our backend.
 * @param {string} phoneNumber - The user's full phone number.
 */
const sendOtp = async (phoneNumber) => {
  const response = await axios.post(API_URL + "send-otp", { phoneNumber });
  return response.data;
};

/**
 * Verifies the OTP with our backend.
 * @param {string} phoneNumber - The user's phone number.
 * @param {string} otp - The 6-digit code.
 * @returns {object} Response data, including user info and JWT if successful.
 */
const verifyOtp = async (phoneNumber, otp) => {
  const response = await axios.post(API_URL + "verify-otp", {
    phoneNumber,
    otp,
  });
  // If the response contains a token, it means login was successful
  if (response.data.token) {
    localStorage.setItem("user", JSON.stringify(response.data));
  }
  return response.data;
};

/**
 * Completes registration by sending the name to our backend.
 * @param {string} phoneNumber - The user's phone number.
 * @param {string} name - The user's chosen name.
 * @returns {object} The full user object with JWT.
 */
const completeRegistration = async (phoneNumber, name) => {
  const response = await axios.post(API_URL + "complete-registration", {
    phoneNumber,
    name,
  });
  // If the response contains a token, registration was successful
  if (response.data.token) {
    localStorage.setItem("user", JSON.stringify(response.data));
  }
  return response.data;
};

const authService = {
  sendOtp,
  verifyOtp,
  completeRegistration,
};

export default authService;
