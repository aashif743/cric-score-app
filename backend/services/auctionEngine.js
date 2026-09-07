// Server-authoritative auction engine. The control panel, big screen and owner
// devices NEVER compute bids or purse themselves — they ask the server, which
// is the single source of truth. This prevents two near-simultaneous bids from
// corrupting the highest-bid/purse state.
//
// Money is stored as plain integers (e.g. rupees). No floats.

const Auction = require("../models/Auction");
const AuctionTeam = require("../models/AuctionTeam");
const AuctionPlayer = require("../models/AuctionPlayer");
const Bid = require("../models/Bid");

// --- Small helpers ---------------------------------------------------------

// The raise to apply next, based on the configured increment tiers.
function nextIncrement(currentBid, tiers) {
  const list = Array.isArray(tiers) && tiers.length ? tiers : [{ upTo: null, step: 500000 }];
  for (const tier of list) {
    if (tier.upTo == null || currentBid < tier.upTo) return tier.step;
  }
  return list[list.length - 1].step;
}

// The most a team may bid right now: its remaining purse, minus enough to still
// fill its remaining minimum squad slots (so it can't strand itself).
async function maxBidForTeam(auction, team) {
  const remaining = Math.max(0, (team.purse || 0) - (team.spent || 0));
  if (!auction.settings?.enforceMaxBid) return remaining;

  const minSquad = auction.settings?.minSquadSize || 0;
  if (minSquad <= 0) return remaining;

  const squadCount = await AuctionPlayer.countDocuments({
    auction: auction._id,
    soldTo: team._id,
    status: "sold",
  });
  const slotsNeeded = Math.max(0, minSquad - squadCount);
  if (slotsNeeded <= 1) return remaining;

  // Reserve the cheapest possible spend for the other slots this team must fill.
  const cheapest = await AuctionPlayer.findOne({ auction: auction._id, status: "pending" })
    .sort({ basePrice: 1 })
    .select("basePrice")
    .lean();
  const floor = cheapest?.basePrice || 0;
  return Math.max(0, remaining - (slotsNeeded - 1) * floor);
}

// Assemble the full live state clients render on connect / after every action.
async function getState(auctionId) {
  const auction = await Auction.findById(auctionId).lean();
  if (!auction) return null;
  const [teams, players, bids] = await Promise.all([
    AuctionTeam.find({ auction: auctionId }).sort({ order: 1, createdAt: 1 }).lean(),
    AuctionPlayer.find({ auction: auctionId }).sort({ order: 1, createdAt: 1 }).lean(),
    auction.currentPlayer
      ? Bid.find({ player: auction.currentPlayer }).sort({ seq: -1 }).limit(10).lean()
      : Promise.resolve([]),
  ]);
  // Attach live remaining purse (virtuals aren't present on lean docs).
  teams.forEach((t) => { t.remaining = Math.max(0, (t.purse || 0) - (t.spent || 0)); });
  return { auction, teams, players, recentBids: bids };
}

// --- Live operations (each returns fresh state to broadcast) ---------------

// Put a player on the block. Resets the lot to the player's base price.
async function openLot(auctionId, playerId) {
  const auction = await Auction.findById(auctionId);
  if (!auction) throw new Error("Auction not found");
  const player = await AuctionPlayer.findOne({ _id: playerId, auction: auctionId });
  if (!player) throw new Error("Player not found");
  if (player.status === "sold") throw new Error("Player already sold");

  // Clear any previous lot player still marked "current".
  await AuctionPlayer.updateMany(
    { auction: auctionId, status: "current" },
    { $set: { status: "pending" } }
  );
  // Fresh lot: wipe old bids for this player.
  await Bid.deleteMany({ player: player._id });

  player.status = "current";
  await player.save();

  auction.status = "live";
  auction.currentPlayer = player._id;
  auction.currentBid = player.basePrice || 0;
  auction.currentBidTeam = null;
  auction.bidCount = 0;
  await auction.save();

  return getState(auctionId);
}

// Admin marks that `teamId` bid on the current player. First bid takes the base
// price; later bids raise by the increment tier. Rejects over-purse / max-bid.
async function markBid(auctionId, teamId) {
  const auction = await Auction.findById(auctionId);
  if (!auction) throw new Error("Auction not found");
  if (!auction.currentPlayer) throw new Error("No player on the block");

  const team = await AuctionTeam.findOne({ _id: teamId, auction: auctionId });
  if (!team) throw new Error("Team not found");

  // A team already holding the highest bid can't outbid itself.
  if (auction.currentBidTeam && String(auction.currentBidTeam) === String(team._id)) {
    throw new Error("This team already holds the top bid");
  }

  const amount = auction.bidCount === 0
    ? auction.currentBid // first bid = base price
    : auction.currentBid + nextIncrement(auction.currentBid, auction.settings?.incrementTiers);

  const cap = await maxBidForTeam(auction, team);
  if (amount > cap) {
    const remaining = Math.max(0, (team.purse || 0) - (team.spent || 0));
    throw new Error(
      amount > remaining
        ? `${team.name} doesn't have enough purse for this bid`
        : `${team.name} must keep purse to fill its minimum squad`
    );
  }

  const seq = auction.bidCount + 1;
  await Bid.create({
    auction: auction._id,
    player: auction.currentPlayer,
    team: team._id,
    teamName: team.name,
    amount,
    seq,
  });

  auction.currentBid = amount;
  auction.currentBidTeam = team._id;
  auction.bidCount = seq;
  await auction.save();

  return getState(auctionId);
}

// Revert the last bid on the current lot (mis-click safety).
async function undoBid(auctionId) {
  const auction = await Auction.findById(auctionId);
  if (!auction) throw new Error("Auction not found");
  if (!auction.currentPlayer) throw new Error("No player on the block");
  if (auction.bidCount <= 0) throw new Error("Nothing to undo");

  // Remove the latest bid, then restore the previous highest (or base).
  const last = await Bid.findOne({ player: auction.currentPlayer }).sort({ seq: -1 });
  if (last) await Bid.deleteOne({ _id: last._id });

  const prev = await Bid.findOne({ player: auction.currentPlayer }).sort({ seq: -1 });
  const player = await AuctionPlayer.findById(auction.currentPlayer).select("basePrice").lean();

  if (prev) {
    auction.currentBid = prev.amount;
    auction.currentBidTeam = prev.team;
    auction.bidCount = prev.seq;
  } else {
    auction.currentBid = player?.basePrice || 0;
    auction.currentBidTeam = null;
    auction.bidCount = 0;
  }
  await auction.save();

  return getState(auctionId);
}

// Hammer down: sell the current player to the top bidder. Deducts purse.
async function sellCurrent(auctionId) {
  const auction = await Auction.findById(auctionId);
  if (!auction) throw new Error("Auction not found");
  if (!auction.currentPlayer) throw new Error("No player on the block");
  if (!auction.currentBidTeam) throw new Error("No bids yet — can't sell");

  const [player, team] = await Promise.all([
    AuctionPlayer.findById(auction.currentPlayer),
    AuctionTeam.findById(auction.currentBidTeam),
  ]);
  if (!player || !team) throw new Error("Lot data missing");

  const price = auction.currentBid;
  player.status = "sold";
  player.soldTo = team._id;
  player.soldPrice = price;
  await player.save();

  team.spent = (team.spent || 0) + price;
  await team.save();

  auction.currentPlayer = null;
  auction.currentBid = 0;
  auction.currentBidTeam = null;
  auction.bidCount = 0;
  await auction.save();

  const state = await getState(auctionId);
  return { state, sold: { playerId: String(player._id), teamId: String(team._id), price } };
}

// No takers (or below reserve): mark unsold and clear the block.
async function markUnsold(auctionId) {
  const auction = await Auction.findById(auctionId);
  if (!auction) throw new Error("Auction not found");
  if (!auction.currentPlayer) throw new Error("No player on the block");

  const player = await AuctionPlayer.findById(auction.currentPlayer);
  if (player) {
    player.status = "unsold";
    player.soldTo = null;
    player.soldPrice = null;
    await player.save();
  }
  await Bid.deleteMany({ player: auction.currentPlayer });

  auction.currentPlayer = null;
  auction.currentBid = 0;
  auction.currentBidTeam = null;
  auction.bidCount = 0;
  await auction.save();

  const state = await getState(auctionId);
  return { state, unsold: { playerId: player ? String(player._id) : null } };
}

// Manually nudge the current bid up/down by one increment (auctioneer
// correction). Keeps the same top team and syncs the latest ledger entry so
// Undo stays correct. Requires an existing team bid to adjust.
async function adjustBid(auctionId, direction) {
  const auction = await Auction.findById(auctionId);
  if (!auction) throw new Error("Auction not found");
  if (!auction.currentPlayer) throw new Error("No player on the block");
  if (!auction.currentBidTeam || auction.bidCount <= 0) {
    throw new Error("Record a team bid first, then adjust it");
  }

  const player = await AuctionPlayer.findById(auction.currentPlayer).select("basePrice").lean();
  const base = player?.basePrice || 0;
  const tiers = auction.settings?.incrementTiers;

  let amount;
  if (direction === "down") {
    const stepDown = nextIncrement(Math.max(base, auction.currentBid - 1), tiers);
    amount = Math.max(base, auction.currentBid - stepDown);
  } else {
    amount = auction.currentBid + nextIncrement(auction.currentBid, tiers);
  }
  if (amount === auction.currentBid) return getState(auctionId);

  // Keep the newest ledger entry in sync with the manual amount.
  const last = await Bid.findOne({ player: auction.currentPlayer }).sort({ seq: -1 });
  if (last) { last.amount = amount; await last.save(); }

  auction.currentBid = amount;
  await auction.save();
  return getState(auctionId);
}

// Reorder the pending queue. direction: "up" | "down" | "top".
async function movePlayer(auctionId, playerId, direction) {
  const pending = await AuctionPlayer.find({ auction: auctionId, status: "pending" }).sort({ order: 1, createdAt: 1 });
  const idx = pending.findIndex((p) => String(p._id) === String(playerId));
  if (idx === -1) throw new Error("Player is not in the queue");

  if (direction === "top") {
    const minOrder = pending.length ? (pending[0].order ?? 0) : 0;
    pending[idx].order = minOrder - 1;
    await pending[idx].save();
    return getState(auctionId);
  }

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= pending.length) return getState(auctionId); // already at the end
  const a = pending[idx], b = pending[swapIdx];
  const ao = a.order ?? idx, bo = b.order ?? swapIdx;
  a.order = bo; b.order = ao;
  await Promise.all([a.save(), b.save()]);
  return getState(auctionId);
}

module.exports = {
  nextIncrement,
  maxBidForTeam,
  getState,
  openLot,
  markBid,
  undoBid,
  sellCurrent,
  markUnsold,
  adjustBid,
  movePlayer,
};
