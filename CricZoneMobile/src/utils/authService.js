import API from '../api/config';

const authService = {
  // Send OTP to phone number
  sendOTP: async (phoneNumber) => {
    try {
      const response = await API.post('/users/send-otp', { phoneNumber });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Verify OTP
  verifyOTP: async (phoneNumber, otp) => {
    try {
      const response = await API.post('/users/verify-otp', { phoneNumber, otp });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Complete registration with name
  completeRegistration: async (phoneNumber, name) => {
    try {
      const response = await API.post('/users/complete-registration', { phoneNumber, name });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default authService;
