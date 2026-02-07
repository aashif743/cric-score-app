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

// Get live overlay data for a match (optimized for OBS/streaming overlays)
exports.getOverlayData = async (req, res) => {
  try {
    const { matchId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ success: false, error: "Invalid match ID" });
    }

    const match = await Match.findById(matchId)
      .select('teamA teamB status result totalOvers ballsPerOver playersPerTeam innings innings1 innings2 target currentState')
      .lean();

    if (!match) {
      return res.status(404).json({ success: false, error: "Match not found" });
    }

    // Extract current batsmen (on strike and non-strike)
    const currentInnings = match.innings === 1 ? match.innings1 : match.innings2;
    const batting = currentInnings?.batting || [];

    // Find active batsmen (not out and have faced balls or are at crease)
    const activeBatsmen = batting
      .filter(b => !b.isOut && (b.balls > 0 || b.runs > 0))
      .slice(-2); // Last two active batsmen

    // Find current bowler (last bowler in bowling array with overs)
    const bowling = currentInnings?.bowling || [];
    const currentBowler = bowling
      .filter(b => b.overs && b.overs !== "0.0")
      .slice(-1)[0];

    // Calculate required run rate for second innings
    let requiredRunRate = null;
    if (match.innings === 2 && match.target) {
      const runsNeeded = match.target - (currentInnings?.runs || 0);
      const oversLeft = match.totalOvers - parseFloat(currentInnings?.overs || 0);
      if (oversLeft > 0 && runsNeeded > 0) {
        requiredRunRate = (runsNeeded / oversLeft).toFixed(2);
      }
    }

    // Build overlay data
    const overlayData = {
      matchId: match._id,
      status: match.status,
      result: match.result,
      teamA: {
        name: match.teamA?.name || "Team A",
        shortName: (match.teamA?.name || "TMA").substring(0, 3).toUpperCase(),
      },
      teamB: {
        name: match.teamB?.name || "Team B",
        shortName: (match.teamB?.name || "TMB").substring(0, 3).toUpperCase(),
      },
      totalOvers: match.totalOvers,
      currentInnings: match.innings || 1,
      innings1: match.innings1 ? {
        battingTeam: match.innings1.battingTeam,
        runs: match.innings1.runs || 0,
        wickets: match.innings1.wickets || 0,
        overs: match.innings1.overs || "0.0",
        runRate: match.innings1.runRate || 0,
      } : null,
      innings2: match.innings2 ? {
        battingTeam: match.innings2.battingTeam,
        runs: match.innings2.runs || 0,
        wickets: match.innings2.wickets || 0,
        overs: match.innings2.overs || "0.0",
        runRate: match.innings2.runRate || 0,
      } : null,
      target: match.target,
      requiredRunRate,
      currentBatsmen: activeBatsmen.map(b => ({
        name: b.name,
        runs: b.runs || 0,
        balls: b.balls || 0,
        fours: b.fours || 0,
        sixes: b.sixes || 0,
        strikeRate: b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0",
        onStrike: b.onStrike || false,
      })),
      currentBowler: currentBowler ? {
        name: currentBowler.name,
        overs: currentBowler.overs,
        runs: currentBowler.runs || 0,
        wickets: currentBowler.wickets || 0,
        economy: currentBowler.economyRate || 0,
      } : null,
      lastBall: match.currentState?.lastBallResult || null,
      partnership: match.currentState?.partnership || null,
    };

    res.json({ success: true, data: overlayData });
  } catch (error) {
    console.error("Get overlay data error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch overlay data." });
  }
};
