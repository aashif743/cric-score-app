const mongoose = require("mongoose");

// A player auction run by a management/admin. Teams (with a purse) bid on
// players; the admin drives the live auction (marks bids, sold/unsold). The
// live lot state (current player + highest bid) is kept here so the big screen,
// owner devices, and control panel all read one source of truth and survive
// reconnects. All money amounts are stored as plain integers in the smallest
// unit the organiser thinks in (e.g. rupees); the UI formats to Lakh/Crore.
const auctionSchema = mongoose.Schema(
  {
    // The management account that owns/controls this auction.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    sport: { type: String, default: "cricket", trim: true },

    // Branding used across the big screen, owner view and share cards.
    logoUrl: { type: String, default: "" },   // square profile / crest
    coverUrl: { type: String, default: "" },   // wide banner / background

    // Event details.
    venue: { type: String, default: "", trim: true },
    date: { type: String, default: "" }, // "YYYY-MM-DD" (kept as a string to avoid TZ shifts)
    time: { type: String, default: "" }, // "HH:MM"
    visibility: { type: String, enum: ["public", "private"], default: "public" },

    // Currency / unit. Default is Sri Lankan Rupees (LKR); INR, USD and a plain
    // POINTS unit are selectable. `currencyFormat` drives rendering:
    // "inr" → Lakh/Crore, "plain" → grouped numbers, "points" → "1,500 pts".
    currencyCode: { type: String, enum: ["LKR", "INR", "USD", "POINTS"], default: "LKR" },
    currencyFormat: { type: String, enum: ["inr", "plain", "points"], default: "plain" },
    currencySymbol: { type: String, default: "Rs" },

    status: {
      type: String,
      enum: ["draft", "live", "paused", "completed"],
      default: "draft",
      index: true,
    },

    settings: {
      // Default purse applied to a team unless it overrides its own.
      defaultPurse: { type: Number, default: 10000000 }, // ₹1 Cr
      // Starting/minimum bid used as the default base price for new players.
      minBid: { type: Number, default: 0 },
      // Number of players entered per team. Retention is available on every
      // auction; this flag says how that number relates to retained members:
      //   true  → it's the FULL squad — retained players / playing managers
      //           count toward it, so those teams buy fewer at auction.
      //   false → it's how many to BUY at auction; retained/managers are extra.
      playersPerTeam: { type: Number, default: 11 },
      squadIncludesRetained: { type: Boolean, default: true },
      // Bid increment tiers: while currentBid < upTo, raise by step. The last
      // tier should have upTo:null (applies above everything else).
      incrementTiers: {
        type: [
          {
            _id: false,
            upTo: { type: Number, default: null },
            step: { type: Number, required: true },
          },
        ],
        default: [
          { upTo: 10000000, step: 500000 }, // below ₹1 Cr → +₹5 L
          { upTo: null, step: 1000000 }, //     above ₹1 Cr → +₹10 L
        ],
      },
      minSquadSize: { type: Number, default: 11 },
      maxSquadSize: { type: Number, default: 15 },
      // Stop a team bidding so high it can't still fill its minimum squad.
      enforceMaxBid: { type: Boolean, default: true },
      // 'manual' → the auctioneer marks each bid (real-event). 'online' → team
      // owners place their own bids from their devices; the admin still sells.
      biddingMode: { type: String, enum: ["manual", "online"], default: "manual" },
    },

    // ---- Live lot state (single source of truth during the auction) --------
    currentPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "AuctionPlayer", default: null },
    currentBid: { type: Number, default: 0 },
    currentBidTeam: { type: mongoose.Schema.Types.ObjectId, ref: "AuctionTeam", default: null },
    bidCount: { type: Number, default: 0 },
    // Big-screen focuses on the current player by default; the admin can flip this
    // on to reveal the teams' purses on the big screen on demand.
    showPurses: { type: Boolean, default: false },

    // Public read-only token for the big-screen / spectator link.
    shareId: { type: String, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Auction", auctionSchema);
