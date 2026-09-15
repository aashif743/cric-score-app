const Tournament = require("../models/Tournament");
const Match = require("../models/Match");
const mongoose = require("mongoose");

// Get public tournament by shareId
exports.getPublicTournament = async (req, res) => {
  try {
    const { shareId } = req.params;

    const tournament = await Tournament.findOne({ shareId }).lean();

    if (!tournament) {
      return res.status(404).json({ success: false, error: "Tournament not found" });
    }

    // Fetch lightweight match list
    const [completedMatches, inProgressMatches] = await Promise.all([
      Match.find({ tournament: tournament._id, status: { $in: ["completed", "abandoned"] } })
        .select('teamA teamB status result createdAt updatedAt totalOvers ballsPerOver playersPerTeam innings1.runs innings1.wickets innings1.overs innings1.battingTeam innings2.runs innings2.wickets innings2.overs innings2.battingTeam')
        .sort({ updatedAt: -1 })
        .lean(),
      Match.find({ tournament: tournament._id, status: { $in: ["scheduled", "in_progress", "innings_break"] } })
        .select('teamA teamB status result createdAt updatedAt totalOvers ballsPerOver playersPerTeam innings1.runs innings1.wickets innings1.overs innings1.battingTeam innings2.runs innings2.wickets innings2.overs innings2.battingTeam')
        .sort({ updatedAt: -1 })
        .lean(),
    ]);
    const matches = [...inProgressMatches, ...completedMatches];

    // Remove sensitive fields
    const { user, shareId: _, ...publicTournament } = tournament;

    res.json({ success: true, data: { ...publicTournament, matches } });
  } catch (error) {
    console.error("Get public tournament error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch tournament." });
  }
};

// Get public tournament stats by shareId
exports.getPublicTournamentStats = async (req, res) => {
  try {
    const { shareId } = req.params;

    const tournament = await Tournament.findOne({ shareId }).lean();

    if (!tournament) {
      return res.status(404).json({ success: false, error: "Tournament not found" });
    }

    const tournamentObjectId = tournament._id;

    const [topRunScorers, topWicketTakers, totalMatches, completedMatches, mostRunsInMatch, bestBowling] = await Promise.all([
      // Top 5 run scorers
      Match.aggregate([
        { $match: { tournament: tournamentObjectId, status: "completed" } },
        {
          $project: {
            batsmen: {
              $concatArrays: [
                {
                  $map: {
                    input: { $ifNull: ["$innings1.batting", []] },
                    as: "b",
                    in: { $mergeObjects: ["$$b", { team: "$innings1.battingTeam" }] }
                  }
                },
                {
                  $map: {
                    input: { $ifNull: ["$innings2.batting", []] },
                    as: "b",
                    in: { $mergeObjects: ["$$b", { team: "$innings2.battingTeam" }] }
                  }
                }
              ]
            }
          }
        },
        { $unwind: "$batsmen" },
        { $match: { "batsmen.name": { $not: /^Batsman \d+$/i } } },
        {
          $group: {
            _id: { name: "$batsmen.name", team: "$batsmen.team" },
            totalRuns: { $sum: "$batsmen.runs" },
            totalBalls: { $sum: "$batsmen.balls" },
            totalFours: { $sum: "$batsmen.fours" },
            totalSixes: { $sum: "$batsmen.sixes" },
            innings: { $sum: 1 }
          }
        },
        { $sort: { totalRuns: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            name: "$_id.name",
            team: "$_id.team",
            totalRuns: 1,
            totalBalls: 1,
            totalFours: 1,
            totalSixes: 1,
            innings: 1
          }
        }
      ]),

      // Top 5 wicket takers
      Match.aggregate([
        { $match: { tournament: tournamentObjectId, status: "completed" } },
        {
          $project: {
            bowlers: {
              $concatArrays: [
                {
                  $map: {
                    input: { $ifNull: ["$innings1.bowling", []] },
                    as: "b",
                    in: { $mergeObjects: ["$$b", { team: "$innings1.bowlingTeam" }] }
                  }
                },
                {
                  $map: {
                    input: { $ifNull: ["$innings2.bowling", []] },
                    as: "b",
                    in: { $mergeObjects: ["$$b", { team: "$innings2.bowlingTeam" }] }
                  }
                }
              ]
            }
          }
        },
        { $unwind: "$bowlers" },
        { $match: { "bowlers.name": { $not: /^Bowler \d+$/i } } },
        {
          $group: {
            _id: { name: "$bowlers.name", team: "$bowlers.team" },
            totalWickets: { $sum: "$bowlers.wickets" },
            totalRuns: { $sum: "$bowlers.runs" },
            innings: { $sum: 1 }
          }
        },
        { $sort: { totalWickets: -1, totalRuns: 1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            name: "$_id.name",
            team: "$_id.team",
            totalWickets: 1,
            totalRuns: 1,
            innings: 1
          }
        }
      ]),

      // Match counts
      Match.countDocuments({ tournament: tournamentObjectId }),
      Match.countDocuments({ tournament: tournamentObjectId, status: "completed" }),

      // Most runs in a match
      Match.aggregate([
        { $match: { tournament: tournamentObjectId, status: "completed" } },
        {
          $project: {
            batsmen: {
              $concatArrays: [
                {
                  $map: {
                    input: { $ifNull: ["$innings1.batting", []] },
                    as: "b",
                    in: { $mergeObjects: ["$$b", { team: "$innings1.battingTeam" }] }
                  }
                },
                {
                  $map: {
                    input: { $ifNull: ["$innings2.batting", []] },
                    as: "b",
                    in: { $mergeObjects: ["$$b", { team: "$innings2.battingTeam" }] }
                  }
                }
              ]
            },
            matchTitle: { $concat: ["$teamA.name", " vs ", "$teamB.name"] }
          }
        },
        { $unwind: "$batsmen" },
        { $match: { "batsmen.name": { $not: /^Batsman \d+$/i } } },
        { $sort: { "batsmen.runs": -1 } },
        { $limit: 1 },
        {
          $project: {
            name: "$batsmen.name",
            team: "$batsmen.team",
            runs: "$batsmen.runs",
            balls: "$batsmen.balls",
            matchTitle: 1
          }
        }
      ]),

      // Best bowling in a match
      Match.aggregate([
        { $match: { tournament: tournamentObjectId, status: "completed" } },
        {
          $project: {
            bowlers: {
              $concatArrays: [
                {
                  $map: {
                    input: { $ifNull: ["$innings1.bowling", []] },
                    as: "b",
                    in: { $mergeObjects: ["$$b", { team: "$innings1.bowlingTeam" }] }
                  }
                },
                {
                  $map: {
                    input: { $ifNull: ["$innings2.bowling", []] },
                    as: "b",
                    in: { $mergeObjects: ["$$b", { team: "$innings2.bowlingTeam" }] }
                  }
                }
              ]
            },
            matchTitle: { $concat: ["$teamA.name", " vs ", "$teamB.name"] }
          }
        },
        { $unwind: "$bowlers" },
        { $match: { "bowlers.name": { $not: /^Bowler \d+$/i } } },
        { $sort: { "bowlers.wickets": -1, "bowlers.runs": 1 } },
        { $limit: 1 },
        {
          $project: {
            name: "$bowlers.name",
            team: "$bowlers.team",
            wickets: "$bowlers.wickets",
            runs: "$bowlers.runs",
            overs: "$bowlers.overs",
            matchTitle: 1
          }
        }
      ]),
    ]);

    res.json({
      success: true,
      data: {
        topRunScorers,
        topWicketTakers,
        totalMatches,
        completedMatches,
        mostRunsInMatch: mostRunsInMatch[0] || null,
        bestBowling: bestBowling[0] || null,
      }
    });
  } catch (error) {
    console.error("Get public tournament stats error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch tournament stats." });
  }
};

// Get public tournament matches by shareId
exports.getPublicTournamentMatches = async (req, res) => {
  try {
    const { shareId } = req.params;

    const tournament = await Tournament.findOne({ shareId }).lean();

    if (!tournament) {
      return res.status(404).json({ success: false, error: "Tournament not found" });
    }

    const matches = await Match.find({ tournament: tournament._id })
      .select('teamA teamB status result createdAt updatedAt totalOvers ballsPerOver playersPerTeam innings1.runs innings1.wickets innings1.overs innings1.battingTeam innings2.runs innings2.wickets innings2.overs innings2.battingTeam')
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ success: true, data: matches });
  } catch (error) {
    console.error("Get public tournament matches error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch matches." });
  }
};

// Get public match scorecard — verify match belongs to a shared tournament
exports.getPublicMatch = async (req, res) => {
  try {
    const { matchId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ success: false, error: "Invalid match ID" });
    }

    const match = await Match.findById(matchId).lean();

    if (!match) {
      return res.status(404).json({ success: false, error: "Match not found" });
    }

    // Verify match belongs to a shared tournament
    if (match.tournament) {
      const tournament = await Tournament.findById(match.tournament).lean();
      if (!tournament || !tournament.shareId) {
        return res.status(403).json({ success: false, error: "This match is not publicly shared" });
      }
    } else {
      return res.status(403).json({ success: false, error: "This match is not publicly shared" });
    }

    // Remove user field
    const { user, ...publicMatch } = match;

    res.json({ success: true, data: publicMatch });
  } catch (error) {
    console.error("Get public match error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch match." });
  }
};

// Build the full overlay / TV payload from a (lean) match document. Shared by
// the per-match overlay endpoint and the tournament TV endpoint.
function buildOverlayData(match) {
    // Extract current innings data
    const currentInnings = match.innings === 1 ? match.innings1 : match.innings2;
    const batting = currentInnings?.batting || [];
    const bowling = currentInnings?.bowling || [];

    // Find active batsmen (not out)
    const activeBatsmen = batting
      .filter(b => !b.isOut && !b.isRetired)
      .slice(-2);

    // Find current bowler (last active bowler)
    const currentBowler = bowling.slice(-1)[0];

    // Calculate overs as decimal for calculations
    const parseOvers = (overs) => {
      if (!overs) return 0;
      const parts = overs.toString().split('.');
      return parseInt(parts[0] || 0) + (parseInt(parts[1] || 0) / 6);
    };

    // Prefer the live currentState the scorer persists EVERY ball — it's the
    // freshest and unambiguous source. The saved innings arrays don't carry the
    // on-strike flag or the in-progress over, so batsmen / bowler / this-over
    // would otherwise look stale or wrong on the TV board.
    const cs = match.currentState || {};
    const effRuns = (cs.runs != null) ? cs.runs : (currentInnings?.runs || 0);
    const effWickets = (cs.wickets != null) ? cs.wickets : (currentInnings?.wickets || 0);
    const effOvers = cs.overs || currentInnings?.overs || "0.0";

    // Calculate current run rate from the live figures.
    const currentOvers = parseOvers(effOvers);
    const currentRuns = effRuns;
    const currentRunRate = currentOvers > 0 ? (currentRuns / currentOvers).toFixed(2) : "0.00";

    // Calculate required info for second innings
    let requiredRuns = null;
    let requiredRunRate = null;
    let ballsRemaining = null;
    if (match.innings === 2 && match.target) {
      requiredRuns = match.target - currentRuns;
      const bpo = match.ballsPerOver || 6;
      const totalBalls = match.totalOvers * bpo;
      const currentBalls = (cs.balls != null)
        ? cs.balls
        : Math.floor(currentOvers) * bpo + Math.round((currentOvers % 1) * 6);
      ballsRemaining = totalBalls - currentBalls;
      const oversRemaining = ballsRemaining / bpo;
      if (oversRemaining > 0 && requiredRuns > 0) {
        requiredRunRate = (requiredRuns / oversRemaining).toFixed(2);
      }
    }

    // Live batsmen / bowler / this-over from currentState (fallback to innings).
    const mkBat = (b) => b ? {
      name: b.name || "Batsman",
      runs: b.runs || 0,
      balls: b.balls || 0,
      fours: b.fours || 0,
      sixes: b.sixes || 0,
      strikeRate: (b.balls > 0) ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0",
    } : null;
    const strikerObj = cs.striker ? mkBat(cs.striker)
      : mkBat(activeBatsmen.find(b => b.onStrike) || activeBatsmen[0]);
    const nonStrikerObj = cs.nonStriker ? mkBat(cs.nonStriker)
      : mkBat(activeBatsmen.find(b => !b.onStrike) || activeBatsmen[1]);
    const bowlerSrc = cs.currentBowler || currentBowler;
    const bowlerObj = bowlerSrc ? {
      name: bowlerSrc.name || "Bowler",
      overs: bowlerSrc.overs || "0.0",
      maidens: bowlerSrc.maidens || 0,
      runs: bowlerSrc.runs || 0,
      wickets: bowlerSrc.wickets || 0,
      economy: (() => { const o = parseOvers(bowlerSrc.overs); return o > 0 ? (bowlerSrc.runs / o).toFixed(2) : "0.00"; })(),
    } : null;
    const liveThisOver = (Array.isArray(cs.currentOverBalls) && cs.currentOverBalls.length)
      ? cs.currentOverBalls
      : (currentInnings?.thisOver || []);

    // Get extras
    const extras = currentInnings?.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 };

    // Get fall of wickets
    const fallOfWickets = currentInnings?.fallOfWickets || [];

    // Get this over balls
    const thisOver = currentInnings?.thisOver || [];

    // Build comprehensive overlay data
    const overlayData = {
      matchId: match._id,
      status: match.status,
      result: match.result,

      // Team info
      teamA: {
        name: match.teamA?.name || "Team A",
        shortName: (match.teamA?.name || "TMA").substring(0, 3).toUpperCase(),
      },
      teamB: {
        name: match.teamB?.name || "Team B",
        shortName: (match.teamB?.name || "TMB").substring(0, 3).toUpperCase(),
      },

      // Match settings
      totalOvers: match.totalOvers,
      ballsPerOver: match.ballsPerOver || 6,
      playersPerTeam: match.playersPerTeam || 11,

      // Current state
      currentInnings: match.innings || 1,
      battingTeam: currentInnings?.battingTeam || match.teamA?.name,
      bowlingTeam: match.innings === 1 ? match.teamB?.name : match.teamA?.name,

      // Score (live from currentState)
      runs: effRuns,
      wickets: effWickets,
      overs: effOvers,
      runRate: currentRunRate,

      // First innings summary (for 2nd innings display)
      firstInnings: match.innings1 ? {
        battingTeam: match.innings1.battingTeam,
        runs: match.innings1.runs || 0,
        wickets: match.innings1.wickets || 0,
        overs: match.innings1.overs || "0.0",
      } : null,

      // Second innings chase info
      target: match.target,
      requiredRuns,
      requiredRunRate,
      ballsRemaining,

      // Current batsmen (striker first) — live from currentState
      striker: strikerObj,
      nonStriker: nonStrikerObj,

      // Current bowler with spell — live from currentState
      bowler: bowlerObj,

      // This over (in-progress) — includes extras, so keep the last several
      thisOver: liveThisOver.slice(-8),

      // Extras
      extras: {
        total: extras.total || 0,
        wides: extras.wides || 0,
        noBalls: extras.noBalls || 0,
        byes: extras.byes || 0,
        legByes: extras.legByes || 0,
      },

      // Partnership
      partnership: match.currentState?.partnership || { runs: 0, balls: 0 },

      // Recent fall of wickets (last 3)
      recentWickets: fallOfWickets.slice(-3).map(fow => ({
        batsman: fow.batsman_name,
        score: fow.score,
        wicket: fow.wicket,
        over: fow.over,
      })),

      // Last ball result
      lastBall: match.currentState?.lastBallResult || null,

      // Toss info
      toss: match.toss,

      // Timestamp
      updatedAt: match.updatedAt,
    };

    return overlayData;
}

// Build a Cricbuzz-style end-of-match summary from a completed match.
function buildSummaryData(match) {
  const parseOvers = (o) => { if (!o) return 0; const p = String(o).split("."); return (parseInt(p[0] || 0)) + ((parseInt(p[1] || 0)) / 6); };
  const inningsSummary = (inn) => {
    if (!inn) return null;
    const batting = (inn.batting || []).filter(b => (b.balls || 0) > 0 || (b.runs || 0) > 0 || b.isOut);
    const topBatters = [...batting].sort((a, b) => (b.runs || 0) - (a.runs || 0)).slice(0, 3).map(b => ({
      name: b.name, runs: b.runs || 0, balls: b.balls || 0, notOut: !b.isOut,
    }));
    const bowling = (inn.bowling || []).filter(b => parseOvers(b.overs) > 0);
    const topBowlers = [...bowling].sort((a, b) => (b.wickets || 0) - (a.wickets || 0) || (a.runs || 0) - (b.runs || 0)).slice(0, 3).map(b => ({
      name: b.name, wickets: b.wickets || 0, runs: b.runs || 0, overs: b.overs || "0.0",
    }));
    return {
      battingTeam: inn.battingTeam,
      bowlingTeam: inn.bowlingTeam,
      runs: inn.runs || 0, wickets: inn.wickets || 0, overs: inn.overs || "0.0",
      topBatters, topBowlers,
    };
  };

  // Player of the match: explicit if set, else the best combined performer.
  let potm = match.matchSummary?.playerOfMatch || "";
  let potmLine = "";
  if (!potm) {
    const agg = {};
    [match.innings1, match.innings2].filter(Boolean).forEach(inn => {
      (inn.batting || []).forEach(b => { if (!b.name) return; agg[b.name] = agg[b.name] || { runs: 0, balls: 0, wkts: 0, rc: 0 }; agg[b.name].runs += b.runs || 0; agg[b.name].balls += b.balls || 0; });
      (inn.bowling || []).forEach(b => { if (!b.name) return; agg[b.name] = agg[b.name] || { runs: 0, balls: 0, wkts: 0, rc: 0 }; agg[b.name].wkts += b.wickets || 0; agg[b.name].rc += b.runs || 0; });
    });
    let best = null;
    Object.entries(agg).forEach(([name, s]) => { const score = s.runs + s.wkts * 25; if (!best || score > best.score) best = { name, score, ...s }; });
    if (best && best.score > 0) {
      potm = best.name;
      const parts = [];
      if (best.wkts > 0) parts.push(`${best.wkts}/${best.rc}`);
      if (best.runs > 0) parts.push(`${best.runs} (${best.balls})`);
      potmLine = parts.join(" & ");
    }
  }

  return {
    teamA: { name: match.teamA?.name || "Team A", shortName: (match.teamA?.name || "TMA").substring(0, 3).toUpperCase() },
    teamB: { name: match.teamB?.name || "Team B", shortName: (match.teamB?.name || "TMB").substring(0, 3).toUpperCase() },
    innings1: inningsSummary(match.innings1),
    innings2: inningsSummary(match.innings2),
    result: match.result || "",
    playerOfMatch: potm,
    playerOfMatchLine: potmLine,
    toss: match.toss?.winner ? `${match.toss.winner} won the toss and chose to ${match.toss.decision || "bat"}` : "",
    venue: match.venue || "",
  };
}

// GET /api/public/overlay/:matchId
exports.getOverlayData = async (req, res) => {
  try {
    const { matchId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ success: false, error: "Invalid match ID" });
    }
    const match = await Match.findById(matchId).lean();
    if (!match) {
      return res.status(404).json({ success: false, error: "Match not found" });
    }
    res.json({ success: true, data: buildOverlayData(match) });
  } catch (error) {
    console.error("Get overlay data error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch overlay data." });
  }
};

// GET /api/public/tournament-tv/:tournamentId
// One link for the whole tournament: returns the live match's board when a
// match is in progress, otherwise the last completed match's summary, otherwise
// an idle state. The TV auto-switches as the admin starts each new match.
exports.getTournamentTV = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }
    const Tournament = require("../models/Tournament");
    const tournament = await Tournament.findById(tournamentId).select("name").lean();
    if (!tournament) return res.status(404).json({ success: false, error: "Tournament not found" });
    // No visibility gate — same trust model as the per-match overlay: the link is
    // unlisted (needs the tournament id), so the owner can broadcast their own
    // tournament to a TV whether it's public or private.
    const tournamentName = tournament.name || "Tournament";

    // A live match takes priority (most recently active).
    const liveMatch = await Match.findOne({
      tournament: tournamentId,
      status: { $in: ["in_progress", "innings_break"] },
    }).sort({ updatedAt: -1 }).lean();
    if (liveMatch) {
      return res.json({ success: true, data: { tournamentName, mode: "live", matchId: String(liveMatch._id), overlay: buildOverlayData(liveMatch) } });
    }

    // Otherwise show the most recently completed match's summary until the next
    // match starts.
    const lastCompleted = await Match.findOne({
      tournament: tournamentId,
      status: "completed",
    }).sort({ updatedAt: -1 }).lean();
    if (lastCompleted) {
      return res.json({ success: true, data: { tournamentName, mode: "summary", matchId: String(lastCompleted._id), summary: buildSummaryData(lastCompleted) } });
    }

    return res.json({ success: true, data: { tournamentName, mode: "idle" } });
  } catch (error) {
    console.error("Get tournament TV error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch tournament TV data." });
  }
};

// Get live TV scoreboard data (comprehensive for TV display)
exports.getTVScoreboard = async (req, res) => {
  try {
    const { matchId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ success: false, error: "Invalid match ID" });
    }

    const match = await Match.findById(matchId).lean();

    if (!match) {
      return res.status(404).json({ success: false, error: "Match not found" });
    }

    // Return full match data for TV display
    res.json({ success: true, data: match });
  } catch (error) {
    console.error("Get TV scoreboard error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch TV scoreboard data." });
  }
};
