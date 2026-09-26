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

// Retained players + managers who play fill squad slots and (optionally) lock up
// purse. Computed inline so it works on lean docs (no virtuals) too.
function retainedCostOf(team) {
  const players = (team.retainedPlayers || []).reduce((s, p) => s + (p.price || 0), 0);
  const mgrs = (team.managers || []).reduce((s, m) => s + (m.price || 0), 0);
  return players + mgrs;
}
function retainedCountOf(team) {
  const players = (team.retainedPlayers || []).length;
  const playingMgrs = (team.managers || []).filter((m) => m.plays).length;
  return players + playingMgrs;
}

// The most a team may bid right now: its remaining purse, minus enough to still
// fill its remaining minimum squad slots (so it can't strand itself).
async function maxBidForTeam(auction, team) {
  const remaining = Math.max(0, (team.purse || 0) - (team.spent || 0) - retainedCostOf(team));
  if (!auction.settings?.enforceMaxBid) return remaining;

  const minSquad = auction.settings?.minSquadSize || 0;
  if (minSquad <= 0) return remaining;

  const boughtCount = await AuctionPlayer.countDocuments({
    auction: auction._id,
    soldTo: team._id,
    status: "sold",
  });
  // Retained players already fill slots, so they count toward the minimum too.
  const squadCount = boughtCount + retainedCountOf(team);
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
  // Attach live remaining purse + retained figures (virtuals aren't present on
  // lean docs). Remaining subtracts both auction spend and retained cost.
  // Also attach `maxBid` — the most a team may bid right now under the
  // minimum-squad protection — mirroring maxBidForTeam() but computed from the
  // already-loaded players (no extra DB queries).
  const enforce = auction.settings?.enforceMaxBid;
  const minSquad = auction.settings?.minSquadSize || 0;
  const maxSquad = auction.settings?.maxSquadSize || 0;
  const pendingBasePrices = players.filter((p) => p.status === "pending").map((p) => p.basePrice || 0);
  const floor = pendingBasePrices.length ? Math.min(...pendingBasePrices) : 0;
  teams.forEach((t) => {
    t.retainedCost = retainedCostOf(t);
    t.retainedCount = retainedCountOf(t);
    t.remaining = Math.max(0, (t.purse || 0) - (t.spent || 0) - t.retainedCost);
    const bought = players.filter((p) => p.status === "sold" && String(p.soldTo) === String(t._id)).length;
    // Total squad (bought + retained/playing) and whether it's at the max.
    t.squadCount = bought + t.retainedCount;
    t.full = maxSquad > 0 && t.squadCount >= maxSquad;
    if (!enforce || minSquad <= 0) {
      t.maxBid = t.remaining;
    } else {
      const slotsNeeded = Math.max(0, minSquad - t.squadCount);
      t.maxBid = slotsNeeded <= 1 ? t.remaining : Math.max(0, t.remaining - (slotsNeeded - 1) * floor);
    }
  });
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
async function markBid(auctionOrId, teamId) {
  // Accept an already-loaded auction doc (the controller has one from the
  // ownership check) to skip a redundant fetch on this hot path.
  const auction = auctionOrId && auctionOrId._id ? auctionOrId : await Auction.findById(auctionOrId);
  if (!auction) throw new Error("Auction not found");
  if (!auction.currentPlayer) throw new Error("No player on the block");

  const team = await AuctionTeam.findOne({ _id: teamId, auction: auction._id });
  if (!team) throw new Error("Team not found");

  // A team already holding the highest bid can't outbid itself.
  if (auction.currentBidTeam && String(auction.currentBidTeam) === String(team._id)) {
    throw new Error("This team already holds the top bid");
  }

  // A full squad can't bid — once a team has its maximum players (bought +
  // retained/playing-manager) it's locked out.
  const maxSquad = auction.settings?.maxSquadSize || 0;
  if (maxSquad > 0) {
    const boughtCount = await AuctionPlayer.countDocuments({ auction: auction._id, soldTo: team._id, status: "sold" });
    if (boughtCount + retainedCountOf(team) >= maxSquad) {
      throw new Error(`${team.name} already has the maximum ${maxSquad} players`);
    }
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

  return getState(auction._id);
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

// Undo the most recently COMPLETED lot (sold or unsold), once the block is
// clear. Brings that player back onto the block — refunding the buyer's purse if
// it was sold — so a mistaken sale/unsold can be corrected after the fact.
async function undoLastResult(auctionId) {
  const auction = await Auction.findById(auctionId);
  if (!auction) throw new Error("Auction not found");
  if (auction.currentPlayer) throw new Error("A player is already on the block — undo or sell that first");

  const last = await AuctionPlayer.findOne({ auction: auctionId, status: { $in: ["sold", "unsold"] } })
    .sort({ updatedAt: -1 });
  if (!last) throw new Error("Nothing to undo");

  const wasSold = last.status === "sold";
  // Refund the buyer.
  if (wasSold && last.soldTo && last.soldPrice) {
    await AuctionTeam.updateOne({ _id: last.soldTo }, { $inc: { spent: -last.soldPrice } });
  }

  if (wasSold) {
    // Sale keeps its bid ledger — restore the winning-bid state so the lot
    // resumes exactly where it hammered.
    const top = await Bid.findOne({ player: last._id }).sort({ seq: -1 });
    auction.currentBid = last.soldPrice != null ? last.soldPrice : (top ? top.amount : (last.basePrice || 0));
    auction.currentBidTeam = last.soldTo || (top ? top.team : null);
    auction.bidCount = top ? top.seq : 0;
  } else {
    // Unsold cleared its bids — reopen at base price with no bids.
    auction.currentBid = last.basePrice || 0;
    auction.currentBidTeam = null;
    auction.bidCount = 0;
  }

  last.status = "current";
  last.soldTo = null;
  last.soldPrice = null;
  await last.save();

  auction.status = "live";
  auction.currentPlayer = last._id;
  await auction.save();

  // Flag it as a restore so viewers snap straight back to the lot (with the
  // last bid) instead of replaying the "new player" ID-reveal intro.
  return { state: await getState(auctionId), restored: { playerId: String(last._id) } };
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

// Finish the auction: mark it completed and clear the block. The big screen /
// OBS switch to the results summary automatically (they read auction.status).
async function finishAuction(auctionOrId) {
  const auction = auctionOrId && auctionOrId._id ? auctionOrId : await Auction.findById(auctionOrId);
  if (!auction) throw new Error("Auction not found");
  if (auction.currentPlayer) {
    await AuctionPlayer.updateMany({ auction: auction._id, status: "current" }, { $set: { status: "pending" } });
  }
  auction.status = "completed";
  auction.currentPlayer = null;
  auction.currentBid = 0;
  auction.currentBidTeam = null;
  auction.bidCount = 0;
  auction.showPurses = false;
  await auction.save();
  return getState(auction._id);
}

// Toggle whether the big screen shows the teams' purses (admin control).
async function setBigScreen(auctionOrId, patch) {
  const auction = auctionOrId && auctionOrId._id ? auctionOrId : await Auction.findById(auctionOrId);
  if (!auction) throw new Error("Auction not found");
  if (patch && typeof patch.showPurses === "boolean") auction.showPurses = patch.showPurses;
  await auction.save();
  return getState(auction._id);
}

// Re-order the WHOLE pending queue at once. mode:
//   "shuffle"   → random (Fisher–Yates)
//   "priceDesc" → highest base price first
//   "priceAsc"  → lowest base price first
//   "name"      → A→Z
// Only pending players are touched; the current lot and sold/unsold are untouched.
async function reorderPending(auctionId, mode) {
  const pending = await AuctionPlayer.find({ auction: auctionId, status: "pending" }).sort({ order: 1, createdAt: 1 });
  const ordered = [...pending];
  if (mode === "priceDesc") ordered.sort((a, b) => (b.basePrice || 0) - (a.basePrice || 0));
  else if (mode === "priceAsc") ordered.sort((a, b) => (a.basePrice || 0) - (b.basePrice || 0));
  else if (mode === "name") ordered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  else {
    for (let i = ordered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    }
  }
  const ops = ordered.map((p, idx) => ({ updateOne: { filter: { _id: p._id }, update: { $set: { order: idx } } } }));
  if (ops.length) await AuctionPlayer.bulkWrite(ops);
  // Flag the reorder so viewers (big screen) can play a transparency animation —
  // owners see the shuffle happened live.
  return { state: await getState(auctionId), reordered: { mode: mode || "shuffle", count: ordered.length } };
}

module.exports = {
  nextIncrement,
  maxBidForTeam,
  getState,
  openLot,
  markBid,
  undoBid,
  undoLastResult,
  sellCurrent,
  markUnsold,
  adjustBid,
  movePlayer,
  reorderPending,
  setBigScreen,
  finishAuction,
};
