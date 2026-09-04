const mongoose = require("mongoose");

// A bidding team in an auction. `spent` is the sum of its sold prices;
// remaining purse is derived (purse - spent). An owner account can be linked by
// email so the owner sees their team live and (Phase 2) bids from their phone.
const auctionTeamSchema = mongoose.Schema(
  {
    auction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    shortName: { type: String, trim: true },
    logoUrl: { type: String, default: "" },

    ownerName: { type: String, trim: true, default: "" },
    // Email the admin assigns; the owner is linked once they log in with it.
    ownerEmail: { type: String, trim: true, lowercase: true, default: "" },
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Invitation lifecycle for the assigned owner:
    //   none      → no owner email set
    //   pending   → invited, awaiting the owner's accept/reject
    //   accepted  → owner joined; the auction shows on their dashboard
    //   rejected  → owner declined; hidden from them (admin still sees it)
    inviteStatus: {
      type: String,
      enum: ["none", "pending", "accepted", "rejected"],
      default: "none",
    },

    purse: { type: Number, required: true, default: 10000000 },
    spent: { type: Number, default: 0 },

    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Convenience virtuals (included when toJSON/toObject use virtuals).
auctionTeamSchema.virtual("remaining").get(function () {
  return Math.max(0, (this.purse || 0) - (this.spent || 0));
});

auctionTeamSchema.set("toJSON", { virtuals: true });
auctionTeamSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("AuctionTeam", auctionTeamSchema);
