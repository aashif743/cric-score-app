const mongoose = require("mongoose");

// A player up for auction. `order` controls the presentation sequence. `stats`
// is intentionally flexible (Mixed) so any sport can attach whatever profile
// fields matter (e.g. { matches, runs, wickets, strikeRate }).
const auctionPlayerSchema = mongoose.Schema(
  {
    auction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    // Per-auction player ID/token the auctioneer draws & announces (like a
    // physical lottery number). Auto-assigned (next free integer) but editable.
    // Kept unique within an auction by the controller.
    code: { type: String, trim: true, default: "" },
    photoUrl: { type: String, default: "" },
    role: { type: String, trim: true, default: "" }, // Batsman / Bowler / All-rounder / WK ...
    category: { type: String, trim: true, default: "" }, // grade / set (A, Marquee, ...)
    basePrice: { type: Number, required: true, default: 0 },
    stats: { type: mongoose.Schema.Types.Mixed, default: {} },
    isOverseas: { type: Boolean, default: false },

    order: { type: Number, default: 0, index: true },

    status: {
      type: String,
      enum: ["pending", "current", "sold", "unsold"],
      default: "pending",
      index: true,
    },
    soldTo: { type: mongoose.Schema.Types.ObjectId, ref: "AuctionTeam", default: null },
    soldPrice: { type: Number, default: null },
  },
  { timestamps: true }
);

// Fast lookup + uniqueness scoping by (auction, code).
auctionPlayerSchema.index({ auction: 1, code: 1 });
// Hot-path compound indexes: sold/pending counts (markBid, maxBid, public feed)
// and the order-sorted getState fetch run on every auction action.
auctionPlayerSchema.index({ auction: 1, status: 1 });
auctionPlayerSchema.index({ auction: 1, order: 1, createdAt: 1 });

module.exports = mongoose.model("AuctionPlayer", auctionPlayerSchema);
