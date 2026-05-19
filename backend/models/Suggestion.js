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

// Compound index for efficient prefix search + popularity sort.
suggestionSchema.index({ type: 1, normalizedName: 1, usageCount: -1 });
// Uniqueness guard — one record per (normalizedName, type). Prevents duplicate
// entries from racing inserts that previously caused the same name to appear
// multiple times in the suggestion dropdown.
suggestionSchema.index({ normalizedName: 1, type: 1 }, { unique: true });

// Pre-save middleware to set normalizedName
suggestionSchema.pre('save', function (next) {
  if (this.name) {
    this.normalizedName = this.name.toLowerCase();
  }
  next();
});

module.exports = mongoose.model('Suggestion', suggestionSchema);
