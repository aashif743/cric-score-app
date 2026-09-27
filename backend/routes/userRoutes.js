const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { sendOtp, verifyOtp, setUserName, deleteAccount, getProfile, refreshToken, registerEmail, loginEmail } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Throttle OTP sending (paid SMS + abuse) and verify/login (brute-force). Keyed
// by IP; generous enough for real users retrying, tight enough to stop scripts.
const otpSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 15,
  standardHeaders: true, legacyHeaders: false,
  message: { message: "Too many OTP requests. Please try again later." },
});
const authAttemptLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});

// Public routes
router.post('/send-otp', otpSendLimiter, sendOtp);
router.post('/verify-otp', authAttemptLimiter, verifyOtp);
router.post('/complete-registration', setUserName);
router.post('/register-email', authAttemptLimiter, registerEmail);
router.post('/login-email', authAttemptLimiter, loginEmail);

// Protected routes (require authentication)
router.get('/profile', protect, getProfile);
router.post('/refresh-token', protect, refreshToken);
router.delete('/delete-account', protect, deleteAccount);

module.exports = router;
