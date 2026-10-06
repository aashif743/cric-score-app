const mongoose = require('mongoose');

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Please add a phone number'],
      unique: true,
    },
    email: {  // Add this field explicitly
      type: String,
      unique: false,  // Explicitly set to not unique
      sparse: true    // Allows multiple null values
    },
    // Set only for email/password accounts (bcrypt hash). Phone-OTP users have none.
    password: {
      type: String,
    },
    otp: {
        type: String,
    },
    otpExpires: {
        type: Date,
    },
    // Access control for the admin panel. Only 'admin' may reach /api/admin/*.
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    // Account state. A 'disabled' account is blocked from the app by the admin.
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
