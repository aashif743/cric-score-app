const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp, setUserName, deleteAccount, getProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/complete-registration', setUserName);

// Protected routes (require authentication)
router.get('/profile', protect, getProfile);
router.delete('/delete-account', protect, deleteAccount);

module.exports = router;
