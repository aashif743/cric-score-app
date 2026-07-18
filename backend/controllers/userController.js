const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');

// Helper to generate a JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '365d' });
};

// Apple App Store review bypass. When a reviewer signs in we can't actually
// send them an SMS, so we reserve one phone number whose OTP is hard-coded.
// Configure both of these on Render — without either, the bypass is OFF.
//   REVIEW_TEST_PHONE   (e.g. "+94770000000")
//   REVIEW_TEST_OTP     (e.g. "1234")
// Trim to defend against accidental trailing whitespace in the env value.
const REVIEW_TEST_PHONE = (process.env.REVIEW_TEST_PHONE || '').trim();
const REVIEW_TEST_OTP = (process.env.REVIEW_TEST_OTP || '').trim();

// Log once at boot so it's obvious in Render logs whether the bypass is
// armed and what value it expects (without revealing the OTP itself).
console.log(
  `[review-bypass] phone="${REVIEW_TEST_PHONE}" ` +
  `otp_set=${REVIEW_TEST_OTP ? 'yes' : 'NO'} ` +
  `otp_length=${REVIEW_TEST_OTP.length}`
);

// @desc    Send OTP to a phone number via Textit.biz
// @route   POST /api/users/send-otp
const sendOtp = async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  // Review-account bypass: skip the SMS entirely and set the OTP to the
  // pre-shared value so Apple's reviewer can sign in.
  const incomingPhone = (phoneNumber || '').trim();

  // Diagnostic: see exactly what the server received versus what it expects.
  console.log(
    `[send-otp] req phone bytes=${Buffer.from(incomingPhone).toString('hex')} ` +
    `(len=${incomingPhone.length}) | env phone bytes=` +
    `${Buffer.from(REVIEW_TEST_PHONE).toString('hex')} ` +
    `(len=${REVIEW_TEST_PHONE.length}) | match=${incomingPhone === REVIEW_TEST_PHONE}`
  );

  if (REVIEW_TEST_PHONE && REVIEW_TEST_OTP && incomingPhone === REVIEW_TEST_PHONE) {
    const otpExpires = new Date(Date.now() + 60 * 60 * 1000); // 1-hour window
    try {
      await User.findOneAndUpdate(
        { phoneNumber: incomingPhone },
        {
          $set: { otp: REVIEW_TEST_OTP, otpExpires },
          $setOnInsert: { name: 'App Reviewer' },
        },
        { new: true, upsert: true }
      );
      console.log(`[review-bypass] applied for ${incomingPhone}`);
      return res.status(200).json({ success: true, message: 'OTP sent successfully.' });
    } catch (e) {
      console.error('[review-bypass] error:', e.message);
      return res.status(500).json({ message: 'Failed to send OTP' });
    }
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

// @desc    Delete user account and all associated data
// @route   DELETE /api/users/delete-account
// @access  Private (requires auth token)
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete all user's matches
    await Match.deleteMany({ user: userId });

    // Delete all user's tournaments and their associated matches
    const tournaments = await Tournament.find({ user: userId });
    for (const tournament of tournaments) {
      await Match.deleteMany({ tournament: tournament._id });
    }
    await Tournament.deleteMany({ user: userId });

    // Delete the user account
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'Your account and all associated data have been permanently deleted.'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account. Please try again or contact support.'
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-otp -otpExpires');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
};

// @desc    Issue a fresh long-lived token for an already-authenticated user.
// @route   POST /api/users/refresh-token   (protected)
// The app calls this on launch so an active user's token never reaches expiry
// — they stay logged in as long as they keep opening the app.
const refreshToken = async (req, res) => {
  try {
    const id = req.user?._id || req.user?.id;
    if (!id) return res.status(401).json({ success: false, error: 'Not authorized' });
    return res.json({ success: true, token: generateToken(id) });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Could not refresh token' });
  }
};

module.exports = { sendOtp, verifyOtp, setUserName, deleteAccount, getProfile, refreshToken };
