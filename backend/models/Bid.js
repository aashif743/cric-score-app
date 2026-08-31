const mongoose = require("mongoose");

// Every raise on a lot, in order. Powers the bid history/ticker and — crucially
// — "Undo": undoing pops the latest bid and restores the previous highest.
const bidSchema = mongoose.Schema(
  {
    auction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
      required: true,
      index: true,
    },
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AuctionPlayer",
      required: true,
      index: true,
    },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "AuctionTeam", required: true },
    teamName: { type: String, default: "" }, // denormalised for quick display
    amount: { type: Number, required: true },
    // Bid sequence within the current lot (1, 2, 3 …) so undo is unambiguous.
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

bidSchema.index({ player: 1, seq: -1 });

module.exports = mongoose.model("Bid", bidSchema);
