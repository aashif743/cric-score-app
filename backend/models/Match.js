const mongoose = require("mongoose");

const BatsmanSchema = new mongoose.Schema({
  id: {
    type: Number,
  },
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
  isRetired: {
    type: Boolean,
    default: false
  },
  outType: {
    type: String,
    enum: ["Bowled", "Caught", "LBW", "Run Out", "Stumped", "Retired", "Hit Wicket", "Retired Out", "Not Out", "Did Not Bat", ""],
    default: "Not Out"
  },
  strikeRate: {
    type: Number,
    default: 0,
  }
}, { _id: false });

const BowlerSchema = new mongoose.Schema({
  id: {
    type: Number,
  },
  name: {
    type: String,
    required: [true, "Bowler name is required"],
    trim: true
  },
  overs: String,
  runs: Number,
  wickets: Number,
  maidens: Number,
  economyRate: Number,
  spells: [{
    balls: { type: Number, default: 0, min: 0 },
    runs: { type: Number, default: 0, min: 0 },
    wickets: { type: Number, default: 0, min: 0 },
    maidens: { type: Number, default: 0, min: 0 },
    overs: String
  }],
  currentSpell: {
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
  batsman: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0
  },
  wicket: {
    type: Number,
    required: true,
    min: 1
  },
  over: {
    type: String,
    required: true
  }
}, { _id: false });

const InningsSchema = new mongoose.Schema({
  battingTeam: {
    type: String,
    required: true
  },
  bowlingTeam: {
    type: String,
    required: true
  },
  runs: {
    type: Number,
    default: 0,
    min: 0
  },
  wickets: {
    type: Number,
    default: 0,
    min: 0
  },
  overs: {
    type: String,
    default: "0.0",
    validate: {
      validator: function(v) {
        return /^\d+\.\d+$/.test(v);
      },
      message: props => `${props.value} is not a valid over format (e.g., "12.3")`
    }
  },
  runRate: {
    type: Number,
    default: 0,
  },
  batting: {
    type: [BatsmanSchema],
    required: true,
    validate: {
      validator: function(v) {
        return v.length > 0;
      },
      message: "At least one batsman is required"
    }
  },
  bowling: {
    type: [BowlerSchema],
    required: true,
    validate: {
      validator: function(v) {
        return v.length > 0;
      },
      message: "At least one bowler is required"
    }
  },
  extras: {
    type: ExtrasSchema,
    required: true,
    default: () => ({})
  },
  fallOfWickets: {
    type: [FallOfWicketSchema],
    default: []
  },
  declared: {
    type: Boolean,
    default: false
  },
  target: {
    type: Number,
    default: null
  }
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
  }
}, { _id: false });

const MatchSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  teamA: {
    type: TeamSchema,
    required: true
  },
  teamB: {
    type: TeamSchema,
    required: true
  },
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
    enum: ["T20", "ODI", "Test", "Other"],
    required: true
  },
  toss: {
    winner: String,
    decision: String
  },
  totalOvers: {
    type: Number,
    default: 20
  },
  playersPerTeam: {
    type: Number,
    default: 11
  },
  ballsPerOver: {
    type: Number,
    default: 6,
    min: 1,
    max: 10
  },
  result: {
    type: String,
    default: "Result TBD"
  },
  matchSummary: {
    playerOfMatch: String,
    winner: String,
    margin: String,
    netRunRates: mongoose.Schema.Types.Mixed
  },
  liveState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  currentState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  innings: {
    type: Number,
    default: 1
  },
  target: {
    type: Number,
    default: null
  },
  innings1: {
    type: InningsSchema,
    required: true
  },
  innings2: {
    type: InningsSchema,
    default: null
  },
  status: {
    type: String,
    enum: ["scheduled", "in_progress", "completed", "abandoned", "innings_break"],
    default: "scheduled"
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
MatchSchema.virtual("matchTitle").get(function() {
  return `${this.teamA.name} vs ${this.teamB.name}`;
});

MatchSchema.virtual("isLimitedOvers").get(function() {
  return ["T20", "ODI"].includes(this.matchType);
});

// Pre-save hook to ensure data consistency
MatchSchema.pre('save', function(next) {
  // Ensure outType is never empty
  if (this.innings1?.batting) {
    this.innings1.batting.forEach(batsman => {
      if (!batsman.outType) batsman.outType = 'Not Out';
    });
  }
  
  if (this.innings2?.batting) {
    this.innings2.batting.forEach(batsman => {
      if (!batsman.outType) batsman.outType = 'Not Out';
    });
  }
  
  next();
});

module.exports = mongoose.model("Match", MatchSchema);