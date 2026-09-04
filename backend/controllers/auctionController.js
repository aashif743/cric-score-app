const crypto = require("crypto");
const mongoose = require("mongoose");
const Auction = require("../models/Auction");
const AuctionTeam = require("../models/AuctionTeam");
const AuctionPlayer = require("../models/AuctionPlayer");
const Bid = require("../models/Bid");
const User = require("../models/User");
const engine = require("../services/auctionEngine");

// Find an existing user account for an email so a team can be linked to its
// owner immediately (before they ever log in). Returns the user id or null.
async function findUserByEmail(email) {
  const clean = (email || "").trim().toLowerCase();
  if (!clean) return null;
  const u = await User.findOne({ email: clean }).select("_id").lean();
  return u ? u._id : null;
}

const room = (id) => `auction:${id}`;

// Supported currencies (kept in sync with the frontend). Default: LKR.
const CURRENCIES = {
  LKR: { code: "LKR", symbol: "Rs", format: "plain" },
  INR: { code: "INR", symbol: "₹", format: "inr" },
  USD: { code: "USD", symbol: "$", format: "plain" },
};

// Push fresh state to everyone watching this auction (control panel, big screen,
// owner devices). `io` is stashed on the app in server.js.
function broadcast(req, auctionId, state, extra = {}) {
  const io = req.app.get("io");
  if (io && state) io.to(room(auctionId)).emit("auction:update", { ...state, ...extra });
}

// Load the auction and confirm the caller owns it (the management account).
async function loadOwned(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ success: false, error: "Invalid auction ID" });
    return null;
  }
  const auction = await Auction.findById(id);
  if (!auction) {
    res.status(404).json({ success: false, error: "Auction not found" });
    return null;
  }
  if (String(auction.user) !== req.user.id) {
    res.status(403).json({ success: false, error: "Not authorized" });
    return null;
  }
  return auction;
}

// ---------------------------------------------------------------- Auctions ---

exports.createAuction = async (req, res) => {
  try {
    const { name, sport, currencyCode, currencyFormat, currencySymbol, settings } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Auction name is required" });
    }
    const cur = CURRENCIES[currencyCode] || CURRENCIES.LKR; // default: Sri Lankan Rupees
    const auction = await Auction.create({
      user: req.user.id,
      name: name.trim(),
      sport: sport || "cricket",
      currencyCode: cur.code,
      currencyFormat: currencyFormat || cur.format,
      currencySymbol: currencySymbol || cur.symbol,
      settings: settings || undefined,
      shareId: crypto.randomBytes(5).toString("hex"),
    });
    res.status(201).json({ success: true, data: auction });
  } catch (error) {
    console.error("Create auction error:", error);
    res.status(500).json({ success: false, error: "Failed to create auction" });
  }
};

exports.getMyAuctions = async (req, res) => {
  try {
    const email = (req.user.email || "").toLowerCase();

    // 1) Auctions this user manages (admin).
    const adminAuctions = await Auction.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();
    const adminIds = new Set(adminAuctions.map((a) => String(a._id)));

    // 2) Teams where this user is the assigned owner (by linked account or email).
    const myTeams = await AuctionTeam.find({
      $or: [{ ownerUser: req.user.id }, ...(email ? [{ ownerEmail: email }] : [])],
    }).select("auction name inviteStatus").lean();

    // Accepted (incl. legacy teams with no inviteStatus) become dashboard cards;
    // "pending" become invitations; "rejected" are hidden.
    const accepted = myTeams.filter((t) => !["pending", "rejected"].includes(t.inviteStatus) && !adminIds.has(String(t.auction)));
    const pendingTeams = myTeams.filter((t) => t.inviteStatus === "pending" && !adminIds.has(String(t.auction)));

    const teamByAuction = {};
    accepted.forEach((t) => { teamByAuction[String(t.auction)] = t.name; });
    const ownerAuctionIds = [...new Set(accepted.map((t) => String(t.auction)))];
    const ownerAuctions = ownerAuctionIds.length
      ? await Auction.find({ _id: { $in: ownerAuctionIds } }).sort({ createdAt: -1 }).lean()
      : [];

    // Pending invitations (with the auction name to show on the dashboard).
    const inviteAuctionIds = [...new Set(pendingTeams.map((t) => String(t.auction)))];
    const inviteAuctions = inviteAuctionIds.length
      ? await Auction.find({ _id: { $in: inviteAuctionIds } }).select("name").lean()
      : [];
    const auctionNameById = {};
    inviteAuctions.forEach((a) => { auctionNameById[String(a._id)] = a.name; });
    const invites = pendingTeams.map((t) => ({
      auctionId: String(t.auction),
      auctionName: auctionNameById[String(t.auction)] || "Auction",
      teamId: String(t._id),
      teamName: t.name,
    }));

    const decorate = (a, role) => async () => {
      const [teams, players, sold] = await Promise.all([
        AuctionTeam.countDocuments({ auction: a._id }),
        AuctionPlayer.countDocuments({ auction: a._id }),
        AuctionPlayer.countDocuments({ auction: a._id, status: "sold" }),
      ]);
      return { ...a, teamCount: teams, playerCount: players, soldCount: sold, role, myTeamName: teamByAuction[String(a._id)] || null };
    };

    const withCounts = await Promise.all([
      ...adminAuctions.map((a) => decorate(a, "admin")()),
      ...ownerAuctions.map((a) => decorate(a, "owner")()),
    ]);
    res.json({ success: true, data: withCounts, invites });
  } catch (error) {
    console.error("Get auctions error:", error);
    res.status(500).json({ success: false, error: "Failed to load auctions" });
  }
};

// Full state for the control panel / owner view. Also links an owner account to
// its team the first time that owner opens the auction, and returns myTeamId.
exports.getAuction = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid auction ID" });
    }
    const auction = await Auction.findById(id);
    if (!auction) return res.status(404).json({ success: false, error: "Auction not found" });

    const isAdmin = String(auction.user) === req.user.id;

    // Link owner-by-email on first visit.
    const email = (req.user.email || "").toLowerCase();
    let myTeamId = null;
    if (email) {
      const myTeam = await AuctionTeam.findOne({
        auction: id,
        inviteStatus: { $ne: "rejected" }, // a declined owner loses access
        $or: [{ ownerUser: req.user.id }, { ownerEmail: email }],
      });
      if (myTeam) {
        if (!myTeam.ownerUser) { myTeam.ownerUser = req.user.id; await myTeam.save(); }
        myTeamId = String(myTeam._id);
      }
    }

    if (!isAdmin && !myTeamId) {
      // Not the admin and not an owner — only allow read via the public route.
      return res.status(403).json({ success: false, error: "Not authorized to view this auction" });
    }

    const state = await engine.getState(id);
    res.json({ success: true, data: { ...state, isAdmin, myTeamId } });
  } catch (error) {
    console.error("Get auction error:", error);
    res.status(500).json({ success: false, error: "Failed to load auction" });
  }
};

// Public read-only snapshot for the big screen / spectator link (no auth).
exports.getPublicAuction = async (req, res) => {
  try {
    const auction = await Auction.findOne({ shareId: req.params.shareId }).select("_id").lean();
    if (!auction) return res.status(404).json({ success: false, error: "Auction not found" });
    const state = await engine.getState(auction._id);
    res.json({ success: true, data: { ...state, auctionId: String(auction._id) } });
  } catch (error) {
    console.error("Get public auction error:", error);
    res.status(500).json({ success: false, error: "Failed to load auction" });
  }
};

exports.updateAuction = async (req, res) => {
  try {
    const auction = await loadOwned(req, res);
    if (!auction) return;
    const { name, sport, currencyCode, currencyFormat, currencySymbol, settings, status } = req.body;
    if (name !== undefined) auction.name = name.trim();
    if (sport !== undefined) auction.sport = sport;
    // Setting a known currency code updates symbol + format together.
    if (currencyCode !== undefined && CURRENCIES[currencyCode]) {
      const cur = CURRENCIES[currencyCode];
      auction.currencyCode = cur.code;
      auction.currencyFormat = cur.format;
      auction.currencySymbol = cur.symbol;
    }
    if (currencyFormat !== undefined) auction.currencyFormat = currencyFormat;
    if (currencySymbol !== undefined) auction.currencySymbol = currencySymbol;
    if (settings !== undefined) auction.settings = { ...auction.settings.toObject(), ...settings };
    if (status !== undefined && ["draft", "live", "paused", "completed"].includes(status)) {
      auction.status = status;
    }
    await auction.save();
    const state = await engine.getState(auction._id);
    broadcast(req, auction._id, state);
    res.json({ success: true, data: auction });
  } catch (error) {
    console.error("Update auction error:", error);
    res.status(500).json({ success: false, error: "Failed to update auction" });
  }
};

exports.deleteAuction = async (req, res) => {
  try {
    const auction = await loadOwned(req, res);
    if (!auction) return;
    await Promise.all([
      AuctionTeam.deleteMany({ auction: auction._id }),
      AuctionPlayer.deleteMany({ auction: auction._id }),
      Bid.deleteMany({ auction: auction._id }),
    ]);
    await auction.deleteOne();
    res.json({ success: true });
  } catch (error) {
    console.error("Delete auction error:", error);
    res.status(500).json({ success: false, error: "Failed to delete auction" });
  }
};

// -------------------------------------------------------------------- Teams ---

exports.addTeam = async (req, res) => {
  try {
    const auction = await loadOwned(req, res);
    if (!auction) return;
    const { name, shortName, logoUrl, ownerName, ownerEmail, purse } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Team name is required" });
    }
    const count = await AuctionTeam.countDocuments({ auction: auction._id });
    const cleanEmail = (ownerEmail || "").toLowerCase();
    const team = await AuctionTeam.create({
      auction: auction._id,
      name: name.trim(),
      shortName: (shortName || name).trim().substring(0, 4).toUpperCase(),
      logoUrl: logoUrl || "",
      ownerName: ownerName || "",
      ownerEmail: cleanEmail,
      // Link an existing account immediately so the invite reaches them, but the
      // owner must still accept before the auction shows on their dashboard.
      ownerUser: cleanEmail ? await findUserByEmail(cleanEmail) : null,
      inviteStatus: cleanEmail ? "pending" : "none",
      purse: purse != null ? purse : auction.settings?.defaultPurse || 0,
      order: count,
    });
    const state = await engine.getState(auction._id);
    broadcast(req, auction._id, state);
    res.status(201).json({ success: true, data: team });
  } catch (error) {
    console.error("Add team error:", error);
    res.status(500).json({ success: false, error: "Failed to add team" });
  }
};

exports.updateTeam = async (req, res) => {
  try {
    const auction = await loadOwned(req, res);
    if (!auction) return;
    const team = await AuctionTeam.findOne({ _id: req.params.teamId, auction: auction._id });
    if (!team) return res.status(404).json({ success: false, error: "Team not found" });
    const fields = ["name", "shortName", "logoUrl", "ownerName", "purse", "order"];
    fields.forEach((f) => { if (req.body[f] !== undefined) team[f] = req.body[f]; });
    if (req.body.ownerEmail !== undefined) {
      const cleanEmail = (req.body.ownerEmail || "").toLowerCase();
      // Re-link + re-invite whenever the email actually changes.
      if (cleanEmail !== team.ownerEmail) {
        team.ownerUser = cleanEmail ? await findUserByEmail(cleanEmail) : null;
        team.inviteStatus = cleanEmail ? "pending" : "none";
      }
      team.ownerEmail = cleanEmail;
    }
    await team.save();
    const state = await engine.getState(auction._id);
    broadcast(req, auction._id, state);
    res.json({ success: true, data: team });
  } catch (error) {
    console.error("Update team error:", error);
    res.status(500).json({ success: false, error: "Failed to update team" });
  }
};

exports.deleteTeam = async (req, res) => {
  try {
    const auction = await loadOwned(req, res);
    if (!auction) return;
    // Return any players this team had bought back to the pool.
    await AuctionPlayer.updateMany(
      { auction: auction._id, soldTo: req.params.teamId },
      { $set: { status: "pending", soldTo: null, soldPrice: null } }
    );
    await AuctionTeam.deleteOne({ _id: req.params.teamId, auction: auction._id });
    const state = await engine.getState(auction._id);
    broadcast(req, auction._id, state);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete team error:", error);
    res.status(500).json({ success: false, error: "Failed to delete team" });
  }
};

// ------------------------------------------------------------------ Players ---

exports.addPlayer = async (req, res) => {
  try {
    const auction = await loadOwned(req, res);
    if (!auction) return;
    const { name, photoUrl, role, category, basePrice, stats, isOverseas, order } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Player name is required" });
    }
    const count = await AuctionPlayer.countDocuments({ auction: auction._id });
    const player = await AuctionPlayer.create({
      auction: auction._id,
      name: name.trim(),
      photoUrl: photoUrl || "",
      role: role || "",
      category: category || "",
      basePrice: basePrice != null ? basePrice : 0,
      stats: stats || {},
      isOverseas: !!isOverseas,
      order: order != null ? order : count,
    });
    const state = await engine.getState(auction._id);
    broadcast(req, auction._id, state);
    res.status(201).json({ success: true, data: player });
  } catch (error) {
    console.error("Add player error:", error);
    res.status(500).json({ success: false, error: "Failed to add player" });
  }
};

// Bulk import (e.g. from CSV). Body: { players: [ {name, basePrice, ...}, ... ] }
exports.addPlayersBulk = async (req, res) => {
  try {
    const auction = await loadOwned(req, res);
    if (!auction) return;
    const rows = Array.isArray(req.body.players) ? req.body.players : [];
    if (!rows.length) return res.status(400).json({ success: false, error: "No players provided" });
    let count = await AuctionPlayer.countDocuments({ auction: auction._id });
    const docs = rows
      .filter((p) => p && p.name && p.name.trim())
      .map((p) => ({
        auction: auction._id,
        name: p.name.trim(),
        photoUrl: p.photoUrl || "",
        role: p.role || "",
        category: p.category || "",
        basePrice: p.basePrice != null ? Number(p.basePrice) || 0 : 0,
        stats: p.stats || {},
        isOverseas: !!p.isOverseas,
        order: p.order != null ? p.order : count++,
      }));
    const created = await AuctionPlayer.insertMany(docs);
    const state = await engine.getState(auction._id);
    broadcast(req, auction._id, state);
    res.status(201).json({ success: true, data: { inserted: created.length } });
  } catch (error) {
    console.error("Bulk add players error:", error);
    res.status(500).json({ success: false, error: "Failed to import players" });
  }
};

exports.updatePlayer = async (req, res) => {
  try {
    const auction = await loadOwned(req, res);
    if (!auction) return;
    const player = await AuctionPlayer.findOne({ _id: req.params.playerId, auction: auction._id });
    if (!player) return res.status(404).json({ success: false, error: "Player not found" });
    const fields = ["name", "photoUrl", "role", "category", "basePrice", "stats", "isOverseas", "order"];
    fields.forEach((f) => { if (req.body[f] !== undefined) player[f] = req.body[f]; });
    await player.save();
    const state = await engine.getState(auction._id);
    broadcast(req, auction._id, state);
    res.json({ success: true, data: player });
  } catch (error) {
    console.error("Update player error:", error);
    res.status(500).json({ success: false, error: "Failed to update player" });
  }
};

exports.deletePlayer = async (req, res) => {
  try {
    const auction = await loadOwned(req, res);
    if (!auction) return;
    const player = await AuctionPlayer.findOne({ _id: req.params.playerId, auction: auction._id });
    if (!player) return res.status(404).json({ success: false, error: "Player not found" });
    // If they were sold, refund the team's spend.
    if (player.status === "sold" && player.soldTo && player.soldPrice) {
      await AuctionTeam.updateOne({ _id: player.soldTo }, { $inc: { spent: -player.soldPrice } });
    }
    await player.deleteOne();
    const state = await engine.getState(auction._id);
    broadcast(req, auction._id, state);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete player error:", error);
    res.status(500).json({ success: false, error: "Failed to delete player" });
  }
};

// -------------------------------------------------------------- Live actions ---
// Admin-only. Run the engine, then broadcast the new state to the room.

function liveAction(engineFn) {
  return async (req, res) => {
    try {
      const auction = await loadOwned(req, res);
      if (!auction) return;
      const result = await engineFn(req, auction);
      const state = result.state || result;
      broadcast(req, auction._id, state, result.sold ? { justSold: result.sold } : result.unsold ? { justUnsold: result.unsold } : {});
      res.json({ success: true, data: state });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message || "Action failed" });
    }
  };
}

exports.openLot = liveAction((req, a) => engine.openLot(a._id, req.body.playerId));
exports.markBid = liveAction((req, a) => engine.markBid(a._id, req.body.teamId));
exports.undoBid = liveAction((req, a) => engine.undoBid(a._id));
exports.sellCurrent = liveAction((req, a) => engine.sellCurrent(a._id));
exports.markUnsold = liveAction((req, a) => engine.markUnsold(a._id));

// Put every unsold player back into the pool (a common end-of-round move).
exports.reauctionUnsold = liveAction(async (req, a) => {
  await AuctionPlayer.updateMany(
    { auction: a._id, status: "unsold" },
    { $set: { status: "pending", soldTo: null, soldPrice: null } }
  );
  return engine.getState(a._id);
});

// A team OWNER places a bid for their own team — only in "online" bidding mode,
// and only if the caller actually owns a team in this auction. Reuses the same
// server-authoritative engine (purse / increment / max-bid all validated).
exports.ownerBid = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid auction ID" });
    }
    const auction = await Auction.findById(id).lean();
    if (!auction) return res.status(404).json({ success: false, error: "Auction not found" });
    if (auction.settings?.biddingMode !== "online") {
      return res.status(403).json({ success: false, error: "Online bidding is turned off for this auction" });
    }
    const email = (req.user.email || "").toLowerCase();
    const team = await AuctionTeam.findOne({
      auction: id,
      inviteStatus: { $ne: "rejected" },
      $or: [{ ownerUser: req.user.id }, { ownerEmail: email }],
    });
    if (!team) return res.status(403).json({ success: false, error: "You are not a team owner in this auction" });

    const state = await engine.markBid(id, team._id);
    broadcast(req, id, state);
    res.json({ success: true, data: state });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || "Bid failed" });
  }
};

// A team owner accepts or rejects their invitation. Body: { accept: boolean }.
exports.respondInvite = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid auction ID" });
    }
    const email = (req.user.email || "").toLowerCase();
    const team = await AuctionTeam.findOne({
      auction: id,
      inviteStatus: "pending",
      $or: [{ ownerUser: req.user.id }, ...(email ? [{ ownerEmail: email }] : [])],
    });
    if (!team) return res.status(404).json({ success: false, error: "No pending invitation found" });

    if (req.body.accept) {
      team.inviteStatus = "accepted";
      team.ownerUser = req.user.id;
    } else {
      team.inviteStatus = "rejected";
    }
    await team.save();

    const state = await engine.getState(id);
    broadcast(req, id, state);
    res.json({ success: true, data: { status: team.inviteStatus } });
  } catch (error) {
    console.error("Respond invite error:", error);
    res.status(400).json({ success: false, error: error.message || "Could not respond to the invitation" });
  }
};
