const mongoose = require("mongoose");
const User = require("../models/User");
const Tournament = require("../models/Tournament");
const Match = require("../models/Match");
const Auction = require("../models/Auction");
const AuditLog = require("../models/AuditLog");

// ───────────────────────── helpers ─────────────────────────

const DAY = 24 * 60 * 60 * 1000;

// Record a consequential admin action (fire-and-forget; never blocks the reply).
const audit = (req, action, targetType, targetId, details = {}) => {
  AuditLog.create({
    admin: req.user._id,
    adminEmail: req.user.email || req.user.phoneNumber || "",
    action,
    targetType,
    targetId: String(targetId || ""),
    details,
  }).catch((e) => console.error("Audit log error:", e.message));
};

// Daily buckets (YYYY-MM-DD) of a collection's createdAt over the last N days.
const dailySeries = async (Model, days = 30, extraMatch = {}) => {
  const since = new Date(Date.now() - days * DAY);
  const rows = await Model.aggregate([
    { $match: { createdAt: { $gte: since }, ...extraMatch } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ date: r._id, count: r.count }));
};

// ───────────────────────── identity ─────────────────────────

// GET /api/admin/me — confirms admin access (the web guard calls this).
exports.me = async (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.user._id,
      name: req.user.name || "",
      email: req.user.email || "",
      role: req.user.role,
    },
  });
};

// ───────────────────────── overview ─────────────────────────

// GET /api/admin/overview — Tier-A stats from existing data (no instrumentation).
exports.overview = async (req, res) => {
  try {
    const now = Date.now();
    const d7 = new Date(now - 7 * DAY);
    const d30 = new Date(now - 30 * DAY);

    const [
      usersTotal, usersNew7, usersNew30, usersDisabled,
      tTotal, tListedPending, tApproved, tPrivate,
      mTotal, mCompleted, mInProgress, mScheduled,
      aTotal,
      byFormat, topCreatorsRaw,
      signups,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: d7 } }),
      User.countDocuments({ createdAt: { $gte: d30 } }),
      User.countDocuments({ status: "disabled" }),
      Tournament.countDocuments({}),
      Tournament.countDocuments({ listed: true, approved: { $ne: true } }),
      Tournament.countDocuments({ approved: true }),
      Tournament.countDocuments({ visibility: "private" }),
      Match.countDocuments({}),
      Match.countDocuments({ status: "completed" }),
      Match.countDocuments({ status: { $in: ["in_progress", "innings_break"] } }),
      Match.countDocuments({ status: "scheduled" }),
      Auction.countDocuments({}).catch(() => 0),
      Tournament.aggregate([{ $group: { _id: "$format", count: { $sum: 1 } } }]),
      Tournament.aggregate([
        { $group: { _id: "$user", tournaments: { $sum: 1 } } },
        { $sort: { tournaments: -1 } },
        { $limit: 6 },
      ]),
      dailySeries(User, 30),
    ]);

    // Resolve top creators' names/emails.
    const creatorIds = topCreatorsRaw.map((r) => r._id).filter(Boolean);
    const creators = await User.find({ _id: { $in: creatorIds } }).select("name email phoneNumber").lean();
    const cById = {};
    creators.forEach((c) => { cById[String(c._id)] = c; });
    const topCreators = topCreatorsRaw.map((r) => {
      const c = cById[String(r._id)] || {};
      return {
        id: r._id,
        name: c.name || "Unknown",
        email: c.email || c.phoneNumber || "",
        tournaments: r.tournaments,
      };
    });

    const formatCounts = {};
    byFormat.forEach((f) => { formatCounts[f._id || "unknown"] = f.count; });

    res.json({
      success: true,
      data: {
        users: { total: usersTotal, new7: usersNew7, new30: usersNew30, disabled: usersDisabled },
        tournaments: {
          total: tTotal,
          approved: tApproved,
          pendingApprovals: tListedPending,
          private: tPrivate,
          byFormat: formatCounts,
        },
        matches: {
          total: mTotal,
          completed: mCompleted,
          inProgress: mInProgress,
          scheduled: mScheduled,
          completionRate: mTotal > 0 ? Math.round((mCompleted / mTotal) * 100) : 0,
        },
        auctions: { total: aTotal },
        topCreators,
        signups, // [{ date, count }] last 30 days
      },
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    res.status(500).json({ success: false, error: "Failed to load overview." });
  }
};

// ───────────────────────── tournament approvals ─────────────────────────

// Shape a tournament for admin lists (+ owner name/email).
const shapeTournament = (t, owner) => ({
  _id: t._id,
  name: t.name,
  format: t.format,
  status: t.status,
  visibility: t.visibility,
  listed: !!t.listed,
  approved: !!t.approved,
  numberOfTeams: t.numberOfTeams,
  venue: t.venue || "",
  logoUrl: t.logoUrl || "",
  matchCount: t.matchCount || 0,
  shareId: t.shareId || null,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
  owner: owner ? { id: owner._id, name: owner.name || "Unknown", email: owner.email || owner.phoneNumber || "" } : null,
});

const attachOwners = async (tournaments) => {
  const ids = [...new Set(tournaments.map((t) => String(t.user)).filter(Boolean))];
  const owners = await User.find({ _id: { $in: ids } }).select("name email phoneNumber").lean();
  const byId = {};
  owners.forEach((o) => { byId[String(o._id)] = o; });
  return tournaments.map((t) => shapeTournament(t, byId[String(t.user)]));
};

// GET /api/admin/tournaments?filter=pending|approved|all&search=&page=
exports.listTournaments = async (req, res) => {
  try {
    const { filter = "pending", search = "" } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 20));

    const q = {};
    if (filter === "pending") { q.listed = true; q.approved = { $ne: true }; }
    else if (filter === "approved") { q.approved = true; }
    if (search.trim()) q.name = { $regex: search.trim(), $options: "i" };

    const [rows, total] = await Promise.all([
      Tournament.find(q).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Tournament.countDocuments(q),
    ]);
    const data = await attachOwners(rows);
    res.json({ success: true, data, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Admin list tournaments error:", error);
    res.status(500).json({ success: false, error: "Failed to load tournaments." });
  }
};

// POST /api/admin/tournaments/:id/approve  { approved: true|false }
exports.setTournamentApproval = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }
    const approved = req.body.approved === true;
    const t = await Tournament.findById(id);
    if (!t) return res.status(404).json({ success: false, error: "Tournament not found" });
    t.approved = approved;
    if (approved) t.listed = true; // approving implies it's featured
    await t.save();
    audit(req, approved ? "tournament.approve" : "tournament.unfeature", "tournament", id, { name: t.name });
    res.json({ success: true, data: { _id: t._id, approved: t.approved } });
  } catch (error) {
    console.error("Admin approve tournament error:", error);
    res.status(500).json({ success: false, error: "Failed to update approval." });
  }
};

// POST /api/admin/tournaments/:id/reject — deny the feature request.
exports.rejectTournament = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }
    const t = await Tournament.findById(id);
    if (!t) return res.status(404).json({ success: false, error: "Tournament not found" });
    t.approved = false;
    t.listed = false;
    await t.save();
    audit(req, "tournament.reject", "tournament", id, { name: t.name });
    res.json({ success: true });
  } catch (error) {
    console.error("Admin reject tournament error:", error);
    res.status(500).json({ success: false, error: "Failed to reject." });
  }
};

// ───────────────────────── user management ─────────────────────────

// GET /api/admin/users?search=&page=
exports.listUsers = async (req, res) => {
  try {
    const { search = "" } = req.query;
    const all = req.query.all === "true";
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    // Normal view paginates; "View all" returns everyone (capped high for safety).
    const limit = all ? 5000 : Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 20));
    const skip = all ? 0 : (page - 1) * limit;

    const q = {};
    if (search.trim()) {
      const re = { $regex: search.trim(), $options: "i" };
      q.$or = [{ name: re }, { email: re }, { phoneNumber: re }];
    }
    const [rows, total] = await Promise.all([
      User.find(q).select("name email phoneNumber role status createdAt").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(q),
    ]);

    // Tournament counts per listed user.
    const ids = rows.map((u) => u._id);
    const tCounts = await Tournament.aggregate([
      { $match: { user: { $in: ids } } },
      { $group: { _id: "$user", n: { $sum: 1 } } },
    ]);
    const tById = {};
    tCounts.forEach((c) => { tById[String(c._id)] = c.n; });

    const data = rows.map((u) => ({
      _id: u._id,
      name: u.name || "",
      email: u.email || "",
      phoneNumber: u.phoneNumber || "",
      role: u.role || "user",
      status: u.status || "active",
      tournaments: tById[String(u._id)] || 0,
      createdAt: u.createdAt,
    }));
    res.json({ success: true, data, page, limit, total, all, pages: all ? 1 : Math.ceil(total / limit) });
  } catch (error) {
    console.error("Admin list users error:", error);
    res.status(500).json({ success: false, error: "Failed to load users." });
  }
};

// GET /api/admin/users/:id — detail + their tournaments/matches.
exports.getUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid user ID" });
    }
    const u = await User.findById(id).select("name email phoneNumber role status createdAt").lean();
    if (!u) return res.status(404).json({ success: false, error: "User not found" });

    const [tournaments, matchCount] = await Promise.all([
      Tournament.find({ user: id }).select("name format status approved createdAt matchCount").sort({ createdAt: -1 }).limit(50).lean(),
      Match.countDocuments({ user: id }),
    ]);
    res.json({ success: true, data: { ...u, tournaments, matchCount } });
  } catch (error) {
    console.error("Admin get user error:", error);
    res.status(500).json({ success: false, error: "Failed to load user." });
  }
};

// POST /api/admin/users/:id/status  { status: 'active'|'disabled' }
exports.setUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const status = req.body.status === "disabled" ? "disabled" : "active";
    if (String(id) === String(req.user._id) && status === "disabled") {
      return res.status(400).json({ success: false, error: "You can't disable your own account." });
    }
    const u = await User.findByIdAndUpdate(id, { status }, { new: true }).select("name email status");
    if (!u) return res.status(404).json({ success: false, error: "User not found" });
    audit(req, status === "disabled" ? "user.disable" : "user.enable", "user", id, { email: u.email });
    res.json({ success: true, data: { _id: u._id, status: u.status } });
  } catch (error) {
    console.error("Admin set user status error:", error);
    res.status(500).json({ success: false, error: "Failed to update user." });
  }
};

// POST /api/admin/users/:id/role  { role: 'user'|'admin' }
exports.setUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.body.role === "admin" ? "admin" : "user";
    if (String(id) === String(req.user._id) && role === "user") {
      return res.status(400).json({ success: false, error: "You can't remove your own admin role." });
    }
    const u = await User.findByIdAndUpdate(id, { role }, { new: true }).select("name email role");
    if (!u) return res.status(404).json({ success: false, error: "User not found" });
    audit(req, role === "admin" ? "user.makeAdmin" : "user.revokeAdmin", "user", id, { email: u.email });
    res.json({ success: true, data: { _id: u._id, role: u.role } });
  } catch (error) {
    console.error("Admin set user role error:", error);
    res.status(500).json({ success: false, error: "Failed to update role." });
  }
};

// ───────────────────────── content cleanup ─────────────────────────

// GET /api/admin/content/issues — summarise junk/orphaned data (no deletes).
exports.contentIssues = async (req, res) => {
  try {
    const [orphanMatchesNoUser, orphanMatchesNoTournament, emptyTournaments] = await Promise.all([
      Match.countDocuments({ user: null }),
      Match.countDocuments({ tournament: null }),
      // Tournaments whose matchCount says >0 but have no actual matches is
      // expensive to compute exactly; surface tournaments with 0 matchCount as a
      // cheap "likely empty" proxy, plus abandoned ones.
      Tournament.countDocuments({ $or: [{ matchCount: { $lte: 0 } }, { matchCount: { $exists: false } }] }),
    ]);
    res.json({
      success: true,
      data: {
        orphanMatchesNoUser,
        orphanMatchesNoTournament,
        emptyTournaments,
      },
    });
  } catch (error) {
    console.error("Admin content issues error:", error);
    res.status(500).json({ success: false, error: "Failed to scan content." });
  }
};

// DELETE /api/admin/tournaments/:id — remove a tournament AND its matches.
exports.deleteTournament = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }
    const t = await Tournament.findById(id).select("name user").lean();
    if (!t) return res.status(404).json({ success: false, error: "Tournament not found" });
    const matchDel = await Match.deleteMany({ tournament: id });
    await Tournament.findByIdAndDelete(id);
    audit(req, "tournament.delete", "tournament", id, { name: t.name, matchesDeleted: matchDel.deletedCount });
    res.json({ success: true, data: { matchesDeleted: matchDel.deletedCount } });
  } catch (error) {
    console.error("Admin delete tournament error:", error);
    res.status(500).json({ success: false, error: "Failed to delete tournament." });
  }
};

// DELETE /api/admin/content/orphan-matches?type=noUser|noTournament — bulk clean.
exports.deleteOrphanMatches = async (req, res) => {
  try {
    const type = req.query.type;
    let filter = null;
    if (type === "noUser") filter = { user: null };
    else if (type === "noTournament") filter = { tournament: null };
    if (!filter) return res.status(400).json({ success: false, error: "Specify a valid type." });
    const result = await Match.deleteMany(filter);
    audit(req, "content.deleteOrphanMatches", "match", "", { type, deleted: result.deletedCount });
    res.json({ success: true, data: { deleted: result.deletedCount } });
  } catch (error) {
    console.error("Admin delete orphan matches error:", error);
    res.status(500).json({ success: false, error: "Failed to delete matches." });
  }
};

// GET /api/admin/audit?page= — recent admin actions.
exports.auditLog = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 30;
    const [rows, total] = await Promise.all([
      AuditLog.find({}).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments({}),
    ]);
    res.json({ success: true, data: rows, page, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Admin audit log error:", error);
    res.status(500).json({ success: false, error: "Failed to load audit log." });
  }
};
