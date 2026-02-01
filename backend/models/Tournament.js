const mongoose = require("mongoose");

const TournamentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  name: {
    type: String,
    required: [true, "Tournament name is required"],
    trim: true
  },
  numberOfTeams: {
    type: Number,
    required: [true, "Number of teams is required"],
    min: 2,
    max: 20
  },
  teamNames: {
    type: [String],
    default: []
  },
  playersPerTeam: {
    type: Number,
    default: 11,
    min: 2,
    max: 11
  },
  totalOvers: {
    type: Number,
    default: 20,
    min: 1,
    max: 50
  },
  ballsPerOver: {
    type: Number,
    default: 6,
    min: 2,
    max: 6
  },
  venue: {
    type: String,
    default: ""
  },
  description: {
    type: String,
    default: ""
  },
  status: {
    type: String,
    enum: ["upcoming", "in_progress", "completed"],
    default: "upcoming"
  },
  matchCount: {
    type: Number,
    default: 0
  },
  shareId: {
    type: String,
    unique: true,
    sparse: true,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

TournamentSchema.virtual("matches", {
  ref: "Match",
  localField: "_id",
  foreignField: "tournament"
});

// Indexes for query performance
TournamentSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.model("Tournament", TournamentSchema);
