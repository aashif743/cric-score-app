const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp, setUserName } = require('../controllers/userController');

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/complete-registration', setUserName);

module.exports = router; 
