const Tournament = require("../models/Tournament");
const Match = require("../models/Match");

// GET /api/live/matches
// Returns every match currently in progress (status in_progress / innings_break)
// whose tournament is public. Used to populate the home-feed live strip and
// any "live matches" lists across the app.
//
// Auth-required: any signed-in user can view public live content. Owner of a
// private tournament still sees their own matches via the existing routes.
//
// The payload is intentionally lean — enough for a card preview (team names,
// runs, wickets, overs, current innings) without dumping full innings rosters.
exports.getLiveMatches = async (req, res) => {
  try {
    // Find ids of public tournaments first. Two-stage rather than $lookup
    // because both collections are independently indexed.
    // Treat anything not explicitly "private" as public: tournaments created
    // before the `visibility` field existed have no value stored (reads back as
    // undefined/null), and the schema default is "public" — so { $ne: "private" }
    // includes those legacy tournaments instead of silently dropping them.
    const publicTournaments = await Tournament.find({ visibility: { $ne: "private" } })
      .select("_id name format")
      .lean();
    if (publicTournaments.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const tournamentById = new Map(publicTournaments.map((t) => [String(t._id), t]));
    const tournamentIds = publicTournaments.map((t) => t._id);

    // "Live now" means recently active. Matches left at in_progress for hours
    // are abandoned, not live — without this guard the strip fills with stale
    // matches that were never formally ended. A real match won't sit idle this
    // long; a paused one resumes well within the window.
    const LIVE_RECENCY_MS = 12 * 60 * 60 * 1000; // 12 hours
    const liveSince = new Date(Date.now() - LIVE_RECENCY_MS);

    const matches = await Match.find({
      tournament: { $in: tournamentIds },
      status: { $in: ["in_progress", "innings_break"] },
      updatedAt: { $gte: liveSince },
    })
      .select([
        "tournament", "teamA", "teamB", "status", "totalOvers", "ballsPerOver", "playersPerTeam",
        "innings", "target", "updatedAt",
        // Just the score-shaped fields from each innings; skip rosters.
        "innings1.runs", "innings1.wickets", "innings1.overs", "innings1.battingTeam", "innings1.bowlingTeam",
        "innings2.runs", "innings2.wickets", "innings2.overs", "innings2.battingTeam", "innings2.bowlingTeam",
      ].join(" "))
      .sort({ updatedAt: -1 })
      .lean();

    const data = matches.map((m) => {
      const t = tournamentById.get(String(m.tournament));
      return {
        _id: m._id,
        tournament: m.tournament,
        tournamentName: t?.name || "",
        tournamentFormat: t?.format || "quick",
        teamA: m.teamA,
        teamB: m.teamB,
        status: m.status,
        innings: m.innings,
        target: m.target,
        totalOvers: m.totalOvers,
        ballsPerOver: m.ballsPerOver,
        innings1: m.innings1,
        innings2: m.innings2,
        updatedAt: m.updatedAt,
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error("Get live matches error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch live matches." });
  }
};
