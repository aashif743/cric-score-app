const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User');

// Helper to generate a JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Send OTP to a phone number via Textit.biz
// @route   POST /api/users/send-otp
const sendOtp = async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10-minute expiry

  try {
    await User.findOneAndUpdate(
      { phoneNumber },
      { otp, otpExpires },
      { new: true, upsert: true } // Create user doc if it doesn't exist
    );

    // --- Send the SMS using Textit.biz API ---
    const message = `Your Scorecard App verification code is: ${otp}`;
    const textitUrl = `https://textit.biz/sendmsg/index.php`;
    
    const response = await axios.get(textitUrl, {
      params: {
        id: process.env.TEXTIT_BIZ_USERID,
        pw: process.env.TEXTIT_BIZ_PASSWORD,
        to: phoneNumber,
        text: message,
        sender: process.env.TEXTIT_BIZ_SENDER_ID
      }
    });

    // Textit.biz API returns a string like "OK:12345" on success
    if (response.data && response.data.startsWith('OK')) {
      console.log(`OTP sent to ${phoneNumber} via Textit.biz. Response: ${response.data}`);
      res.status(200).json({ success: true, message: 'OTP sent successfully.' });
    } else {
      console.error('Textit.biz Error:', response.data);
      throw new Error(response.data || 'Failed to send OTP via Textit.biz');
    }

  } catch (error) {
    console.error('Error sending OTP:', error.message);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
};

// The verifyOtp and setUserName functions are the same as the Twilio version.
// They interact with our database, not the SMS provider.

// @desc    Verify OTP and log in or prepare for registration
// @route   POST /api/users/verify-otp
const verifyOtp = async (req, res) => {
  const { phoneNumber, otp } = req.body;
  if (!phoneNumber || !otp) {
    return res.status(400).json({ message: 'Phone number and OTP are required' });
  }

  const user = await User.findOne({ 
    phoneNumber,
    otp,
    otpExpires: { $gt: Date.now() } 
  });

  if (!user) {
    return res.status(400).json({ message: 'Invalid OTP or OTP has expired.' });
  }

  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  if (user.name) {
    res.status(200).json({
      _id: user.id,
      name: user.name,
      phoneNumber: user.phoneNumber,
      token: generateToken(user._id),
      isNewUser: false
    });
  } else {
    res.status(200).json({
      message: "OTP verified. Please provide a name.",
      isNewUser: true,
      phoneNumber: user.phoneNumber 
    });
  }
};

// @desc    Set user's name to complete registration
// @route   POST /api/users/complete-registration
const setUserName = async (req, res) => {
    const { phoneNumber, name } = req.body;
    if (!phoneNumber || !name) {
        return res.status(400).json({ message: 'Phone number and name are required' });
    }
    const user = await User.findOne({ phoneNumber });
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }
    if (user.name) {
        return res.status(400).json({ message: 'User already registered.' });
    }
    user.name = name;
    await user.save();
    res.status(201).json({
      _id: user.id,
      name: user.name,
      phoneNumber: user.phoneNumber,
      token: generateToken(user._id),
    });
};

module.exports = { sendOtp, verifyOtp, setUserName };
