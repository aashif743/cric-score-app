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
    otp: {
        type: String,
    },
    otpExpires: {
        type: Date,
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
