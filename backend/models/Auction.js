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
    // How the UI renders money. "inr" → Lakh/Crore, "plain" → grouped numbers.
    currencyFormat: { type: String, enum: ["inr", "plain"], default: "inr" },
    currencySymbol: { type: String, default: "₹" },

    status: {
      type: String,
      enum: ["draft", "live", "paused", "completed"],
      default: "draft",
      index: true,
    },

    settings: {
      // Default purse applied to a team unless it overrides its own.
      defaultPurse: { type: Number, default: 10000000 }, // ₹1 Cr
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
      minSquadSize: { type: Number, default: 0 },
      maxSquadSize: { type: Number, default: 25 },
      // Stop a team bidding so high it can't still fill its minimum squad.
      enforceMaxBid: { type: Boolean, default: true },
    },

    // ---- Live lot state (single source of truth during the auction) --------
    currentPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "AuctionPlayer", default: null },
    currentBid: { type: Number, default: 0 },
    currentBidTeam: { type: mongoose.Schema.Types.ObjectId, ref: "AuctionTeam", default: null },
    bidCount: { type: Number, default: 0 },

    // Public read-only token for the big-screen / spectator link.
    shareId: { type: String, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Auction", auctionSchema);
