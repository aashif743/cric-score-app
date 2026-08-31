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

module.exports = mongoose.model("AuctionPlayer", auctionPlayerSchema);
