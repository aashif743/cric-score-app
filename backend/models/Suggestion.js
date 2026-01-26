const mongoose = require('mongoose');

const suggestionSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['player', 'team'],
      required: [true, 'Type is required'],
    },
    usageCount: {
      type: Number,
      default: 1,
    },
    normalizedName: {
      type: String,
      lowercase: true,
      trim: true,
    },
    isSeeded: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index for efficient searching
// This index supports: type filter + normalizedName prefix search + usageCount sort
suggestionSchema.index({ type: 1, normalizedName: 1, usageCount: -1 });
suggestionSchema.index({ normalizedName: 1, type: 1 });

// Pre-save middleware to set normalizedName
suggestionSchema.pre('save', function (next) {
  if (this.name) {
    this.normalizedName = this.name.toLowerCase();
  }
  next();
});

module.exports = mongoose.model('Suggestion', suggestionSchema);
