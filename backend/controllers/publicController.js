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

    const match = await Match.findById(matchId).lean();

    if (!match) {
      return res.status(404).json({ success: false, error: "Match not found" });
    }

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

    // Calculate current run rate
    const currentOvers = parseOvers(currentInnings?.overs);
    const currentRuns = currentInnings?.runs || 0;
    const currentRunRate = currentOvers > 0 ? (currentRuns / currentOvers).toFixed(2) : "0.00";

    // Calculate required info for second innings
    let requiredRuns = null;
    let requiredRunRate = null;
    let ballsRemaining = null;
    if (match.innings === 2 && match.target) {
      requiredRuns = match.target - currentRuns;
      const totalBalls = match.totalOvers * (match.ballsPerOver || 6);
      const currentBalls = Math.floor(currentOvers) * (match.ballsPerOver || 6) +
                          Math.round((currentOvers % 1) * 6);
      ballsRemaining = totalBalls - currentBalls;
      const oversRemaining = ballsRemaining / (match.ballsPerOver || 6);
      if (oversRemaining > 0 && requiredRuns > 0) {
        requiredRunRate = (requiredRuns / oversRemaining).toFixed(2);
      }
    }

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

      // Score
      runs: currentRuns,
      wickets: currentInnings?.wickets || 0,
      overs: currentInnings?.overs || "0.0",
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

      // Current batsmen (striker first)
      striker: activeBatsmen.find(b => b.onStrike) || activeBatsmen[0] ? {
        name: (activeBatsmen.find(b => b.onStrike) || activeBatsmen[0])?.name || "Batsman",
        runs: (activeBatsmen.find(b => b.onStrike) || activeBatsmen[0])?.runs || 0,
        balls: (activeBatsmen.find(b => b.onStrike) || activeBatsmen[0])?.balls || 0,
        fours: (activeBatsmen.find(b => b.onStrike) || activeBatsmen[0])?.fours || 0,
        sixes: (activeBatsmen.find(b => b.onStrike) || activeBatsmen[0])?.sixes || 0,
        strikeRate: (() => {
          const b = activeBatsmen.find(b => b.onStrike) || activeBatsmen[0];
          return b && b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0";
        })(),
      } : null,

      nonStriker: activeBatsmen.find(b => !b.onStrike) || activeBatsmen[1] ? {
        name: (activeBatsmen.find(b => !b.onStrike) || activeBatsmen[1])?.name || "Batsman",
        runs: (activeBatsmen.find(b => !b.onStrike) || activeBatsmen[1])?.runs || 0,
        balls: (activeBatsmen.find(b => !b.onStrike) || activeBatsmen[1])?.balls || 0,
        fours: (activeBatsmen.find(b => !b.onStrike) || activeBatsmen[1])?.fours || 0,
        sixes: (activeBatsmen.find(b => !b.onStrike) || activeBatsmen[1])?.sixes || 0,
        strikeRate: (() => {
          const b = activeBatsmen.find(b => !b.onStrike) || activeBatsmen[1];
          return b && b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0";
        })(),
      } : null,

      // Current bowler with spell
      bowler: currentBowler ? {
        name: currentBowler.name,
        overs: currentBowler.overs || "0.0",
        maidens: currentBowler.maidens || 0,
        runs: currentBowler.runs || 0,
        wickets: currentBowler.wickets || 0,
        economy: (() => {
          const o = parseOvers(currentBowler.overs);
          return o > 0 ? (currentBowler.runs / o).toFixed(2) : "0.00";
        })(),
      } : null,

      // This over
      thisOver: thisOver.slice(-6), // Last 6 balls

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

    res.json({ success: true, data: overlayData });
  } catch (error) {
    console.error("Get overlay data error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch overlay data." });
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
