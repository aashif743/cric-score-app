const mongoose = require("mongoose");

const BatsmanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Batsman name is required"],
    trim: true
  },
  runs: {
    type: Number,
    default: 0,
    min: 0
  },
  balls: {
    type: Number,
    default: 0,
    min: 0
  },
  fours: {
    type: Number,
    default: 0,
    min: 0
  },
  sixes: {
    type: Number,
    default: 0,
    min: 0
  },
  isOut: {
    type: Boolean,
    default: false
  },
  outType: {
    type: String,
    // Consider adding 'Retired Hurt' if different from 'Retired'
    enum: ["Bowled", "Caught", "LBW", "Run Out", "Stumped", "Retired", "Hit Wicket", "Retired Out", "Other"],
    default: null
  },
  strikeRate: { // This will likely be calculated on the frontend for display
    type: Number,
    default: 0,
  }
}, { _id: false });

// Flexible BowlerSchema: Can store detailed spells OR aggregated summary stats
const BowlerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Bowler name is required"],
    trim: true
  },
  // Fields for aggregated summary stats (typically used when innings/match ends)
  overs: String,  // e.g., "10.2" (for display)
  // 'runs', 'wickets', 'maidens' fields are duplicated here for summary
  // if you choose to store only summary for completed innings.
  // If storing detailed spells, these can be derived.
  // For simplicity with current controller, adding them here for summary.
  runs: Number,      // Total runs conceded by this bowler in the innings
  wickets: Number,   // Total wickets taken by this bowler in the innings
  maidens: Number,   // Total maiden overs by this bowler in the innings
  economyRate: Number, // Can be calculated or stored

  // Fields for detailed spell-by-spell tracking (optional, for live scoring depth)
  spells: [{
    balls: { type: Number, default: 0, min: 0 },
    runs: { type: Number, default: 0, min: 0 },
    wickets: { type: Number, default: 0, min: 0 },
    maidens: { type: Number, default: 0, min: 0 },
    overs: String // Overs for this specific spell, e.g., "2.0"
  }],
  currentSpell: { // Optional: for tracking current ongoing spell during live scoring
    balls: { type: Number, default: 0, min: 0 },
    runs: { type: Number, default: 0, min: 0 },
    wickets: { type: Number, default: 0, min: 0 },
    maidens: { type: Number, default: 0, min: 0 }
  }
}, { _id: false });


const ExtrasSchema = new mongoose.Schema({
  total: {
    type: Number,
    default: 0,
    min: 0
  },
  wides: {
    type: Number,
    default: 0,
    min: 0
  },
  noBalls: {
    type: Number,
    default: 0,
    min: 0
  },
  byes: {
    type: Number,
    default: 0,
    min: 0
  },
  legByes: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

const FallOfWicketSchema = new mongoose.Schema({
  batsman: { // Name of the batsman who got out
    type: String,
    required: true
  },
  score: { // Team score at the fall of this wicket
    type: Number,
    required: true,
    min: 0
  },
  wicket: { // Wicket number, e.g., 1 for the first wicket, 2 for the second
    type: Number,
    required: true,
    min: 1
  },
  over: { // Over number when the wicket fell, e.g., "10.3"
    type: String,
    required: true
  },
  // bowler: String // Optional: Name of the bowler who took the wicket (if applicable)
}, { _id: false });

const InningsSchema = new mongoose.Schema({
  battingTeam: { // Name of the team batting
    type: String,
    required: true
  },
  bowlingTeam: { // Name of the team bowling
    type: String,
    required: true
  },
  runs: { // Total runs scored in this innings
    type: Number,
    default: 0,
    min: 0
  },
  wickets: { // Total wickets fallen in this innings
    type: Number,
    default: 0,
    min: 0
    // max: playersPerTeam - 1 (cannot directly reference parent schema field here)
  },
  overs: { // Overs bowled in this innings, e.g., "20.0" or "15.3"
    type: String,
    default: "0.0"
  },
  runRate: {
    type: Number,
    default: 0,
  },
  batting: [BatsmanSchema], // Array of batsman performances
  bowling: [BowlerSchema],  // Array of bowler performances
  extras: ExtrasSchema,
  fallOfWickets: [FallOfWicketSchema],
  declared: {
    type: Boolean,
    default: false
  },
  target: { // Only applicable for the chasing innings (usually innings2)
    type: Number,
    default: null
  },
  oversHistory: [mongoose.Schema.Types.Mixed], // Optional: For storing over-by-over ball details
  ballByBallData: [mongoose.Schema.Types.Mixed] // Optional: For storing detailed ball-by-ball commentary/events
}, { _id: false });

const TeamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  shortName: {
    type: String,
    trim: true
  },
  // Optional team details
  // captain: String,
  // wicketKeeper: String,
  // players: [String] // List of player names for the team
}, { _id: false });

const MatchSchema = new mongoose.Schema({
  user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User', // This tells Mongoose the 'user' field refers to the 'User' model
    },
  teamA: TeamSchema,
  teamB: TeamSchema,
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  venue: {
    type: String,
    default: "Unknown Venue"
  },
  matchType: {
    type: String,
    enum: ["T20", "ODI", "Test", "Other"], // Add more types if needed
    required: true
  },
  series: { // Optional: Name of the tournament or series
    type: String,
    trim: true
  },
  toss: {
    winner: String, // Name of the team that won the toss
    decision: String // "bat" or "bowl"
  },
  umpires: [String], // Optional: Array of umpire names
  matchReferee: String, // Optional: Name of the match referee

  totalOvers: { // Total overs intended for each innings (e.g., 20 for T20)
    type: Number,
    default: 20
  },
  playersPerTeam: {
    type: Number,
    default: 11
  },
  ballsPerOver: { // Standard balls per over, usually 6
    type: Number,
    default: 6,
    min: 1,
    max: 10 // Practical limit
  },

  result: { // Overall match result string, e.g., "Team A won by 20 runs"
    type: String,
    default: "Result TBD"
  },
  matchSummary: {
    playerOfMatch: String,
    winner: String, // Name of the winning team or "Match Tied" / "No Result"
    margin: String // e.g., "by 20 runs", "by 5 wickets"
  },

  innings1: InningsSchema,
  innings2: InningsSchema, // innings2 might be null or empty if match ends after 1st innings

  status: {
    type: String,
    enum: ["scheduled", "in_progress", "completed", "abandoned", "innings_break"],
    default: "scheduled"
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt timestamps
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for a user-friendly match title
MatchSchema.virtual("matchTitle").get(function() {
  if (this.teamA && this.teamB) {
    return `${this.teamA.name} vs ${this.teamB.name}`;
  }
  return "Match";
});

// Virtual to check if the match is a limited overs match
MatchSchema.virtual("isLimitedOvers").get(function() {
  return ["T20", "ODI"].includes(this.matchType);
});


module.exports = mongoose.model("Match", MatchSchema);