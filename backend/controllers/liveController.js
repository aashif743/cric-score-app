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

    // Public-feed visibility windows:
    //  • LIVE — an in-progress match shows while it's being scored. If the
    //    scorer goes quiet for 6 hours it's treated as stale and drops off; the
    //    instant they resume (any ball refreshes updatedAt) it reappears. So the
    //    filter is non-destructive — it only hides idle cards.
    //  • COMPLETED — kept based on the TOURNAMENT's state:
    //      – every match in the tournament finished  → keep 2 days, then drop.
    //      – tournament still has unfinished matches  → keep 1 day only.
    const now = Date.now();
    const LIVE_RECENCY_MS = 6 * 60 * 60 * 1000;       // 6h of scorer silence → stale
    const FULL_DONE_MS = 2 * 24 * 60 * 60 * 1000;     // whole tournament done → 2 days
    const PARTIAL_DONE_MS = 1 * 24 * 60 * 60 * 1000;  // tournament still running → 1 day
    const liveSince = new Date(now - LIVE_RECENCY_MS);
    const widestFinishedSince = new Date(now - FULL_DONE_MS);

    // Per-tournament completion: is EVERY match in the tournament finished? A
    // light status-only scan avoids pulling full match docs. A tournament with
    // any scheduled/in-progress match counts as "still running" (partial).
    const statusRows = await Match.find({ tournament: { $in: tournamentIds } })
      .select("tournament status")
      .lean();
    const totalByTournament = new Map();
    const doneByTournament = new Map();
    for (const row of statusRows) {
      const key = String(row.tournament);
      totalByTournament.set(key, (totalByTournament.get(key) || 0) + 1);
      if (row.status === "completed" || row.status === "abandoned") {
        doneByTournament.set(key, (doneByTournament.get(key) || 0) + 1);
      }
    }
    const isTournamentAllDone = (key) => {
      const total = totalByTournament.get(key) || 0;
      return total > 0 && (doneByTournament.get(key) || 0) === total;
    };

    // Candidates: live matches with recent activity, plus completed matches
    // within the WIDEST (2-day) window. Partial-tournament completed matches are
    // narrowed to 1 day after this query.
    const matches = await Match.find({
      tournament: { $in: tournamentIds },
      $or: [
        { status: { $in: ["in_progress", "innings_break"] }, updatedAt: { $gte: liveSince } },
        { status: "completed", updatedAt: { $gte: widestFinishedSince } },
      ],
    })
      .select([
        "tournament", "teamA", "teamB", "status", "totalOvers", "ballsPerOver", "playersPerTeam",
        "innings", "target", "updatedAt", "result", "matchSummary.winner",
        // Stage/group/label so the card can show e.g. "Group A · 3rd Match".
        "stage", "group", "matchLabel",
        // Just the score-shaped fields from each innings; skip rosters.
        "innings1.runs", "innings1.wickets", "innings1.overs", "innings1.battingTeam", "innings1.bowlingTeam",
        "innings2.runs", "innings2.wickets", "innings2.overs", "innings2.battingTeam", "innings2.bowlingTeam",
      ].join(" "))
      .sort({ updatedAt: -1 })
      .lean();

    // Narrow COMPLETED matches per tournament (live ones already passed the 6h
    // recency filter): fully-finished tournaments keep them 2 days (already
    // bounded by the query above); still-running tournaments keep them 1 day.
    const partialCutoff = now - PARTIAL_DONE_MS;
    const visible = matches.filter((m) => {
      if (m.status !== "completed") return true;
      if (isTournamentAllDone(String(m.tournament))) return true;
      return new Date(m.updatedAt).getTime() >= partialCutoff;
    });

    // Match number within its tournament — the position in creation order
    // (ObjectIds are monotonic, so _id order ≈ fixture/schedule order). Shown
    // on the card as "1st match", "2nd match", etc.
    const matchNumbers = await Promise.all(
      visible.map((m) =>
        Match.countDocuments({ tournament: m.tournament, _id: { $lt: m._id } }).then((n) => n + 1),
      ),
    );

    const data = visible.map((m, i) => {
      const t = tournamentById.get(String(m.tournament));
      return {
        _id: m._id,
        tournament: m.tournament,
        tournamentName: t?.name || "",
        tournamentFormat: t?.format || "quick",
        matchNumber: matchNumbers[i],
        stage: m.stage,
        group: m.group || null,
        matchLabel: m.matchLabel || null,
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
        result: m.result || "",
        winner: m.matchSummary?.winner || "",
      };
    });

    // Live matches first, then recently finished ones (each newest-first).
    const isLive = (s) => s === "in_progress" || s === "innings_break";
    data.sort((a, b) => {
      const rank = (isLive(a.status) ? 0 : 1) - (isLive(b.status) ? 0 : 1);
      if (rank !== 0) return rank;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error("Get live matches error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch live matches." });
  }
};
