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

// Per-NUMBER throttles layered on top of the per-IP limiter (bots rotate IPs).
// Keyed by the NORMALISED number so switching format (94.. / 0.. / 7..) can't
// dodge the limit. The App Store review phone is exempt so a reviewer never
// gets locked out.
const normalisedPhoneKey = (req) => {
  let d = ((req.body && req.body.phoneNumber) || '').replace(/\D/g, '');
  if (d.startsWith('0094')) d = d.slice(4);
  else if (d.startsWith('94')) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  return d || 'unknown';
};
const skipReviewPhone = (req) => {
  const reviewDigits = (process.env.REVIEW_TEST_PHONE || '').replace(/\D/g, '');
  return !!reviewDigits && normalisedPhoneKey(req) === reviewDigits.replace(/^(0094|94|0)/, '');
};
const otpNumberCooldown = rateLimit({
  windowMs: 60 * 1000, max: 1, // at most 1 code / minute / number — kills rapid repeats
  keyGenerator: normalisedPhoneKey, skip: skipReviewPhone, validate: false,
  standardHeaders: true, legacyHeaders: false,
  message: { message: "Please wait a minute before requesting another code." },
});
const otpNumberHourly = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5, // at most 5 codes / hour / number
  keyGenerator: normalisedPhoneKey, skip: skipReviewPhone, validate: false,
  standardHeaders: true, legacyHeaders: false,
  message: { message: "Too many codes requested for this number. Please try again later." },
});

// Public routes
router.post('/send-otp', otpSendLimiter, otpNumberCooldown, otpNumberHourly, sendOtp);
router.post('/verify-otp', authAttemptLimiter, verifyOtp);
router.post('/complete-registration', setUserName);
router.post('/register-email', authAttemptLimiter, registerEmail);
router.post('/login-email', authAttemptLimiter, loginEmail);

// Protected routes (require authentication)
router.get('/profile', protect, getProfile);
router.post('/refresh-token', protect, refreshToken);
router.delete('/delete-account', protect, deleteAccount);

module.exports = router;
