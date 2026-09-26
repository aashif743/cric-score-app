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

// Supported currencies/units (kept in sync with the frontend). Default: LKR.
const CURRENCIES = {
  LKR: { code: "LKR", symbol: "Rs", format: "plain" },
  INR: { code: "INR", symbol: "₹", format: "inr" },
  USD: { code: "USD", symbol: "$", format: "plain" },
  POINTS: { code: "POINTS", symbol: "", format: "points" },
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
    const {
      name, sport, logoUrl, coverUrl, venue, date, time, visibility,
      currencyCode, currencyFormat, currencySymbol, settings,
    } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Auction name is required" });
    }
    const cur = CURRENCIES[currencyCode] || CURRENCIES.LKR; // default: Sri Lankan Rupees
    const auction = await Auction.create({
      user: req.user.id,
      name: name.trim(),
      sport: sport || "cricket",
      logoUrl: logoUrl || "",
      coverUrl: coverUrl || "",
      venue: venue || "",
      date: date || "",
      time: time || "",
      visibility: visibility === "private" ? "private" : "public",
      currencyCode: cur.code,
      currencyFormat: currencyFormat || cur.format,
      currencySymbol: currencySymbol != null ? currencySymbol : cur.symbol,
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

// Tournament-ready snapshot of an auction, resolved by its public share code
// (no auth — the code is the permission). Returns team names, logos, squad size,
// and each team's playing squad (retained + managers who play + bought players)
// so the app can pre-fill a tournament without re-entering teams/players.
exports.getAuctionForImport = async (req, res) => {
  try {
    const auction = await Auction.findOne({ shareId: req.params.shareId })
      .select("_id name settings.playersPerTeam").lean();
    if (!auction) return res.status(404).json({ success: false, error: "No auction found for that code." });

    const [teams, soldPlayers] = await Promise.all([
      AuctionTeam.find({ auction: auction._id }).sort({ order: 1, createdAt: 1 }).lean(),
      AuctionPlayer.find({ auction: auction._id, status: "sold" }).select("name role soldTo").lean(),
    ]);

    const boughtByTeam = {};
    soldPlayers.forEach((p) => {
      const k = String(p.soldTo);
      (boughtByTeam[k] = boughtByTeam[k] || []).push({ name: p.name, role: p.role || "" });
    });

    const teamNames = [];
    const teamLogos = {};
    const teamSquads = {};
    teams.forEach((t) => {
      teamNames.push(t.name);
      if (t.logoUrl) teamLogos[t.name] = t.logoUrl;
      // Playing squad: retained players + managers who play + bought players.
      // Non-playing (staff) managers are left out of the line-up.
      const squad = [
        ...(t.retainedPlayers || []).map((p) => ({ name: p.name, role: p.role || "" })),
        ...(t.managers || []).filter((m) => m.plays).map((m) => ({ name: m.name, role: "" })),
        ...(boughtByTeam[String(t._id)] || []),
      ].filter((p) => p.name && p.name.trim());
      teamSquads[t.name] = squad;
    });

    res.json({
      success: true,
      data: {
        auctionId: String(auction._id),
        auctionName: auction.name,
        numberOfTeams: teamNames.length,
        playersPerTeam: auction.settings?.playersPerTeam || 11,
        teamNames, teamLogos, teamSquads,
      },
    });
  } catch (error) {
    console.error("Auction import error:", error);
    res.status(500).json({ success: false, error: "Could not load that auction." });
  }
};

// Public feed of currently-active auctions for the app dashboard (no auth).
// Lightweight summaries only — the detail screen fetches the full snapshot.
exports.listPublicLiveAuctions = async (req, res) => {
  try {
    const auctions = await Auction.find({ visibility: "public", status: { $in: ["live", "paused"] } })
      .select("name logoUrl coverUrl venue status shareId currentBid currentPlayer currentBidTeam bidCount currencyCode currencyFormat currencySymbol updatedAt")
      .sort({ updatedAt: -1 })
      .limit(30)
      .lean();

    const data = await Promise.all(auctions.map(async (a) => {
      const [teamsCount, playersTotal, playersSold, currentPlayer, topTeam] = await Promise.all([
        AuctionTeam.countDocuments({ auction: a._id }),
        AuctionPlayer.countDocuments({ auction: a._id }),
        AuctionPlayer.countDocuments({ auction: a._id, status: "sold" }),
        a.currentPlayer ? AuctionPlayer.findById(a.currentPlayer).select("name photoUrl basePrice role").lean() : null,
        a.currentBidTeam ? AuctionTeam.findById(a.currentBidTeam).select("name logoUrl").lean() : null,
      ]);
      return {
        _id: String(a._id),
        name: a.name,
        logoUrl: a.logoUrl || "",
        coverUrl: a.coverUrl || "",
        venue: a.venue || "",
        status: a.status,
        shareId: a.shareId,
        currencyCode: a.currencyCode, currencyFormat: a.currencyFormat, currencySymbol: a.currencySymbol,
        currentBid: a.currentBid || 0,
        bidCount: a.bidCount || 0,
        currentPlayer: currentPlayer ? { name: currentPlayer.name, photoUrl: currentPlayer.photoUrl || "", basePrice: currentPlayer.basePrice || 0, role: currentPlayer.role || "" } : null,
        topTeam: topTeam ? { name: topTeam.name, logoUrl: topTeam.logoUrl || "" } : null,
        teamsCount, playersTotal, playersSold,
        updatedAt: a.updatedAt,
      };
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error("List public live auctions error:", error);
    res.status(500).json({ success: false, error: "Failed to load live auctions" });
  }
};

exports.updateAuction = async (req, res) => {
  try {
    const auction = await loadOwned(req, res);
    if (!auction) return;
    const {
      name, sport, logoUrl, coverUrl, venue, date, time, visibility,
      currencyCode, currencyFormat, currencySymbol, settings, status,
    } = req.body;
    if (name !== undefined) auction.name = name.trim();
    if (sport !== undefined) auction.sport = sport;
    if (logoUrl !== undefined) auction.logoUrl = logoUrl;
    if (coverUrl !== undefined) auction.coverUrl = coverUrl;
    if (venue !== undefined) auction.venue = venue;
    if (date !== undefined) auction.date = date;
    if (time !== undefined) auction.time = time;
    if (visibility !== undefined && ["public", "private"].includes(visibility)) auction.visibility = visibility;
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

// Normalize incoming retained players / manager from a request body.
const cleanRetainedPlayers = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .map((p) => ({
      name: String(p?.name || "").trim(),
      role: String(p?.role || "").trim(),
      price: Math.max(0, Math.round(Number(p?.price) || 0)),
      photoUrl: String(p?.photoUrl || "").trim(),
    }))
    .filter((p) => p.name);
const cleanManagers = (arr) => {
  const list = (Array.isArray(arr) ? arr : [])
    .map((m) => ({
      name: String(m?.name || "").trim(),
      plays: !!m?.plays,
      price: Math.max(0, Math.round(Number(m?.price) || 0)),
      photoUrl: String(m?.photoUrl || "").trim(),
      email: String(m?.email || "").trim().toLowerCase(),
      isOwner: !!m?.isOwner,
    }))
    .filter((m) => m.name);
  // Exactly one owner — keep the first flagged, clear the rest.
  let ownerTaken = false;
  list.forEach((m) => { if (m.isOwner && !ownerTaken) ownerTaken = true; else m.isOwner = false; });
  return list;
};

// Captain must be one of the pre-included members (a retained player or manager)
// by name; anything else resolves to "no captain".
const resolveCaptain = (captainName, retainedPlayers, managers) => {
  const nm = String(captainName || "").trim();
  if (!nm) return "";
  const names = [...retainedPlayers.map((p) => p.name), ...managers.map((m) => m.name)];
  return names.includes(nm) ? nm : "";
};

// The owner is a manager flagged isOwner (with a login email). Mirror that into
// the team's owner login fields, re-linking + re-inviting when the email
// changes. Only call this when the managers list is actually being set, so a
// logo-only update never wipes an existing owner.
async function syncOwnerFromManagers(team) {
  const owner = (team.managers || []).find((m) => m.isOwner && m.email);
  const email = owner ? owner.email.toLowerCase() : "";
  team.ownerName = owner ? owner.name : "";
  if (email !== (team.ownerEmail || "")) {
    team.ownerUser = email ? await findUserByEmail(email) : null;
    team.inviteStatus = email ? "pending" : "none";
  }
  team.ownerEmail = email;
}
// Retention cost/count for validation (mirrors the model virtuals).
const retentionOf = (retainedPlayers, managers) => {
  const cost = retainedPlayers.reduce((s, p) => s + p.price, 0) + managers.reduce((s, m) => s + m.price, 0);
  const count = retainedPlayers.length + managers.filter((m) => m.plays).length;
  return { cost, count };
};
// Validate retention fits within the team's purse and squad target. Returns an
// error string or null.
const retentionError = (auction, purse, retainedPlayers, managers) => {
  const { cost, count } = retentionOf(retainedPlayers, managers);
  if (cost > purse) return "Retained players / managers cost more than the team's purse.";
  // Only cap by squad size when retained members are counted WITHIN that number
  // (when they're "extra on top", they can exceed players-per-team freely).
  const includes = auction.settings?.squadIncludesRetained !== false;
  const squad = auction.settings?.playersPerTeam || 0;
  if (includes && squad > 0 && count > squad) return `A team can't have more retained/playing members (${count}) than its squad size (${squad}).`;
  return null;
};

exports.addTeam = async (req, res) => {
  try {
    const auction = await loadOwned(req, res);
    if (!auction) return;
    const { name, shortName, logoUrl, purse } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Team name is required" });
    }
    const count = await AuctionTeam.countDocuments({ auction: auction._id });
    const teamPurse = purse != null ? purse : auction.settings?.defaultPurse || 0;
    const retainedPlayers = cleanRetainedPlayers(req.body.retainedPlayers);
    const managers = cleanManagers(req.body.managers);
    const rErr = retentionError(auction, teamPurse, retainedPlayers, managers);
    if (rErr) return res.status(400).json({ success: false, error: rErr });
    const team = new AuctionTeam({
      auction: auction._id,
      name: name.trim(),
      shortName: (shortName || name).trim().substring(0, 4).toUpperCase(),
      logoUrl: logoUrl || "",
      purse: teamPurse,
      retainedPlayers,
      managers,
      captainName: resolveCaptain(req.body.captainName, retainedPlayers, managers),
      order: count,
    });
    // Owner login comes from the owner manager (isOwner + email).
    await syncOwnerFromManagers(team);
    await team.save();
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
    const fields = ["name", "shortName", "logoUrl", "purse", "order"];
    fields.forEach((f) => { if (req.body[f] !== undefined) team[f] = req.body[f]; });
    if (req.body.retainedPlayers !== undefined) team.retainedPlayers = cleanRetainedPlayers(req.body.retainedPlayers);
    if (req.body.managers !== undefined) {
      team.managers = cleanManagers(req.body.managers);
      // Owner login is derived from the owner manager — only when managers are
      // submitted, so a logo-only update never clears an existing owner.
      await syncOwnerFromManagers(team);
    }
    if (req.body.captainName !== undefined) {
      team.captainName = resolveCaptain(req.body.captainName, team.retainedPlayers || [], team.managers || []);
    }
    // Re-validate retention against the (possibly updated) purse & squad target.
    const rErr = retentionError(auction, team.purse, team.retainedPlayers || [], team.managers || []);
    if (rErr) return res.status(400).json({ success: false, error: rErr });
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

// ---- Player IDs (auction "tokens") ----------------------------------------
// A per-auction identifier the auctioneer draws/announces. Auto-assigned as the
// next free integer, but the organiser may set any string (e.g. "A12"), kept
// unique within the auction.
const numericCode = (c) => { const n = parseInt(String(c ?? "").trim(), 10); return Number.isNaN(n) ? null : n; };

// Snapshot of codes already in use + the next integer to try, so a batch can
// allocate many codes without re-querying per row.
async function codeContext(auctionId) {
  const players = await AuctionPlayer.find({ auction: auctionId }).select("code").lean();
  const used = new Set();
  let max = 0;
  players.forEach((p) => {
    const c = String(p.code || "").trim();
    if (c) used.add(c);
    const n = numericCode(c);
    if (n != null && n > max) max = n;
  });
  return { used, next: max + 1 };
}
// Claim a code: use `preferred` if given and free, else the next free integer.
function takeCode(ctx, preferred) {
  const want = String(preferred ?? "").trim();
  if (want && !ctx.used.has(want)) {
    ctx.used.add(want);
    const n = numericCode(want);
    if (n != null && n >= ctx.next) ctx.next = n + 1;
    return want;
  }
  while (ctx.used.has(String(ctx.next))) ctx.next++;
  const code = String(ctx.next);
  ctx.used.add(code);
  ctx.next++;
  return code;
}

exports.addPlayer = async (req, res) => {
  try {
    const auction = await loadOwned(req, res);
    if (!auction) return;
    const { name, code, photoUrl, role, category, basePrice, stats, isOverseas, order } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Player name is required" });
    }
    // Reject an explicit ID that clashes with an existing player.
    const wantCode = String(code ?? "").trim();
    if (wantCode) {
      const clash = await AuctionPlayer.findOne({ auction: auction._id, code: wantCode }).select("_id").lean();
      if (clash) return res.status(400).json({ success: false, error: `Player ID "${wantCode}" is already used.` });
    }
    const ctx = await codeContext(auction._id);
    const count = await AuctionPlayer.countDocuments({ auction: auction._id });
    const player = await AuctionPlayer.create({
      auction: auction._id,
      name: name.trim(),
      code: takeCode(ctx, wantCode),
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
    const ctx = await codeContext(auction._id);
    const docs = rows
      .filter((p) => p && p.name && p.name.trim())
      .map((p) => ({
        auction: auction._id,
        name: p.name.trim(),
        // Use the sheet's ID if free, otherwise auto-assign — never fail the
        // whole import on a duplicate/blank ID.
        code: takeCode(ctx, p.code),
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
    // Player ID: must be non-empty and unique within the auction.
    if (req.body.code !== undefined) {
      const want = String(req.body.code).trim();
      if (!want) return res.status(400).json({ success: false, error: "Player ID cannot be empty." });
      const clash = await AuctionPlayer.findOne({ auction: auction._id, code: want, _id: { $ne: player._id } }).select("_id").lean();
      if (clash) return res.status(400).json({ success: false, error: `Player ID "${want}" is already used by another player.` });
      player.code = want;
    }
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
      const extra = result.sold ? { justSold: result.sold }
        : result.unsold ? { justUnsold: result.unsold }
        : result.reordered ? { justReordered: result.reordered }
        : {};
      broadcast(req, auction._id, state, extra);
      res.json({ success: true, data: state });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message || "Action failed" });
    }
  };
}

exports.openLot = liveAction((req, a) => engine.openLot(a._id, req.body.playerId));
exports.markBid = liveAction((req, a) => engine.markBid(a, req.body.teamId));
exports.adjustBid = liveAction((req, a) => engine.adjustBid(a._id, req.body.direction));
exports.movePlayer = liveAction((req, a) => engine.movePlayer(a._id, req.body.playerId, req.body.direction));
exports.reorderPending = liveAction((req, a) => engine.reorderPending(a._id, req.body.mode));
exports.setBigScreen = liveAction((req, a) => engine.setBigScreen(a, { showPurses: req.body.showPurses }));
exports.finishAuction = liveAction((req, a) => engine.finishAuction(a));
exports.undoBid = liveAction((req, a) => engine.undoBid(a._id));
exports.sellCurrent = liveAction((req, a) => engine.sellCurrent(a._id));
exports.markUnsold = liveAction((req, a) => engine.markUnsold(a._id));

// Put every unsold player back into the pool (a common end-of-round move).
// Re-auctioned players join the BACK of the current pending queue (fresh order
// values) so they don't jump ahead of players still waiting — from there they
// can be shuffled / reordered like any other pending player.
exports.reauctionUnsold = liveAction(async (req, a) => {
  const lastPending = await AuctionPlayer.findOne({ auction: a._id, status: "pending" })
    .sort({ order: -1 }).select("order").lean();
  let nextOrder = (lastPending?.order ?? -1) + 1;
  const unsold = await AuctionPlayer.find({ auction: a._id, status: "unsold" }).sort({ order: 1, createdAt: 1 });
  const ops = unsold.map((p) => ({
    updateOne: { filter: { _id: p._id }, update: { $set: { status: "pending", soldTo: null, soldPrice: null, order: nextOrder++ } } },
  }));
  if (ops.length) await AuctionPlayer.bulkWrite(ops);
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
