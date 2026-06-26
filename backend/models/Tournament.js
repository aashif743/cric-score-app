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
  format: {
    type: String,
    enum: ["quick", "knockout", "league"],
    default: "quick"
  },
  // Who can see this tournament in the live feed + public viewer screens.
  // 'public' shows up for every signed-in user; 'private' is owner-only.
  // Default 'public' so new tournaments populate the live strip by default;
  // creators can opt out at creation or by editing.
  visibility: {
    type: String,
    enum: ["public", "private"],
    default: "public"
  },
  // League-format only. `numberOfGroups` divides teams into pools.
  // `teamsAdvancePerGroup` controls how many top teams from each group advance
  // into the knockout stage (0 = league only, no knockout).
  // `matchesPerPair` is round-robin multiplier (1 = single, 2 = home/away).
  numberOfGroups: {
    type: Number,
    default: 1,
    min: 1
  },
  teamsAdvancePerGroup: {
    type: Number,
    default: 0,
    min: 0
  },
  matchesPerPair: {
    type: Number,
    default: 1,
    min: 1
  },
  // Playoff (knockout-stage) format for league tournaments:
  //   'knockout'  → standard single-elimination of the qualifiers (default)
  //   'qualifier' → IPL-style playoffs (Qualifier 1, Eliminator, Qualifier 2,
  //                 Final) — requires exactly 4 qualifiers (top 4).
  playoffFormat: {
    type: String,
    enum: ['knockout', 'qualifier'],
    default: 'knockout'
  },
  // Persisted snapshot of the snake-distributed groups. groups[0] = Group A, etc.
  groups: {
    type: [[String]],
    default: []
  },
  matchCount: {
    type: Number,
    default: 0
  },
  shareId: {
    type: String
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
// Live-feed lookups query by visibility, so index it for cheap scans.
TournamentSchema.index({ visibility: 1, updatedAt: -1 });

// Unique only when shareId is a string. partialFilterExpression is reliable
// across nulls/missing values; plain `sparse + default: null` collides because
// every doc literally stores null. Do NOT add `default: null` to shareId.
TournamentSchema.index(
  { shareId: 1 },
  { unique: true, partialFilterExpression: { shareId: { $type: "string" } } }
);

module.exports = mongoose.model("Tournament", TournamentSchema);
