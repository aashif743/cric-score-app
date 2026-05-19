const Tournament = require("../models/Tournament");
const Match = require("../models/Match");
const mongoose = require("mongoose");
const { nanoid } = require("nanoid");
const { generateKnockoutBracket } = require("../utils/knockoutBracket");
const { propagateTeamNameToTournament } = require("../utils/teamRename");

const TBD = 'TBD';
const teamObj = (name) => ({ name, shortName: (name || TBD).substring(0, 3).toUpperCase() });
const defaultPlayers = (teamName, count) =>
  Array.from({ length: count || 11 }, (_, i) => ({
    name: `${teamName} Player ${i + 1}`,
    runs: 0, balls: 0, fours: 0, sixes: 0,
    isOut: false, outType: 'Not Out',
  }));
const buildInnings = (battingTeam, bowlingTeam, playersPerTeam) => ({
  battingTeam, bowlingTeam,
  runs: 0, wickets: 0, overs: '0.0', runRate: 0,
  extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
  fallOfWickets: [],
  batting: defaultPlayers(battingTeam, playersPerTeam),
  bowling: defaultPlayers(bowlingTeam, playersPerTeam),
  declared: false,
});

// Create tournament
exports.createTournament = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "User not authenticated." });
    }

    const { name, numberOfTeams, teamNames, playersPerTeam, totalOvers, ballsPerOver, venue, description, format } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Tournament name is required." });
    }
    if (!numberOfTeams || numberOfTeams < 2) {
      return res.status(400).json({ success: false, error: "At least 2 teams are required." });
    }

    const validFormats = ["quick", "knockout", "league", "league_knockout"];
    const tournamentFormat = validFormats.includes(format) ? format : "quick";

    const tournament = await Tournament.create({
      user: req.user.id,
      name: name.trim(),
      numberOfTeams,
      teamNames: teamNames || [],
      playersPerTeam: playersPerTeam || 11,
      totalOvers: totalOvers || 20,
      ballsPerOver: ballsPerOver || 6,
      venue: venue || "",
      description: description || "",
      format: tournamentFormat,
    });

    // For knockout, pre-generate the full bracket so the schedule is ready immediately.
    if (tournamentFormat === "knockout") {
      const filledTeams = Array.from({ length: numberOfTeams }, (_, i) =>
        (teamNames?.[i]?.trim()) || `Team ${String.fromCharCode(65 + i)}`
      );
      const { matches: defs } = generateKnockoutBracket(filledTeams);

      // Create from final backwards so each child knows its parent's _id.
      const sorted = [...defs].sort((a, b) => b.round - a.round);
      const idMap = {};
      for (const def of sorted) {
        const aName = def.teamA || TBD;
        const bName = def.teamB || TBD;
        const created = await Match.create({
          user: req.user.id,
          tournament: tournament._id,
          teamA: teamObj(aName),
          teamB: teamObj(bName),
          venue: tournament.venue || "Unknown Venue",
          matchType: "T20",
          totalOvers: tournament.totalOvers,
          ballsPerOver: tournament.ballsPerOver,
          playersPerTeam: tournament.playersPerTeam,
          status: "scheduled",
          round: def.round,
          bracketSlot: def.bracketSlot,
          nextMatchId: def.parentRound ? idMap[`${def.parentRound}_${def.parentSlot}`] : null,
          nextMatchSlot: def.parentRound ? def.parentSide : null,
          innings1: buildInnings(aName, bName, tournament.playersPerTeam),
        });
        idMap[`${def.round}_${def.bracketSlot}`] = created._id;
      }
      await Tournament.findByIdAndUpdate(tournament._id, { $inc: { matchCount: defs.length } });
    }

    res.status(201).json({ success: true, data: tournament });
  } catch (error) {
    console.error("Create tournament error:", error);
    res.status(500).json({ success: false, error: "Failed to create tournament." });
  }
};

// Get all tournaments for user
exports.getMyTournaments = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "User not authenticated." });
    }

    const tournaments = await Tournament.find({ user: req.user.id })
      .sort({ updatedAt: -1 });

    res.json({ success: true, data: tournaments });
  } catch (error) {
    console.error("Get tournaments error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch tournaments." });
  }
};

// Get tournament by ID with matches
exports.getTournamentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }

    const tournament = await Tournament.findById(id).lean();

    if (!tournament) {
      return res.status(404).json({ success: false, error: "Tournament not found" });
    }

    if (tournament.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    // Fetch lightweight match list for display, and full data only for in-progress matches.
    // Always include the knockout bracket fields (round/bracketSlot/nextMatch*) so the
    // KnockoutScheduleScreen can group matches by round.
    const BRACKET_FIELDS = 'round bracketSlot nextMatchId nextMatchSlot matchSummary';
    const [completedMatches, inProgressMatches] = await Promise.all([
      Match.find({ tournament: id, status: { $in: ["completed", "abandoned"] } })
        .select(`teamA teamB status result createdAt updatedAt totalOvers ballsPerOver playersPerTeam innings1.runs innings1.wickets innings1.overs innings1.battingTeam innings2.runs innings2.wickets innings2.overs innings2.battingTeam ${BRACKET_FIELDS}`)
        .sort({ updatedAt: -1 })
        .lean(),
      Match.find({ tournament: id, status: { $in: ["scheduled", "in_progress", "innings_break"] } })
        .select(`teamA teamB status result createdAt updatedAt totalOvers ballsPerOver playersPerTeam innings1 innings2 currentState innings target toss ${BRACKET_FIELDS}`)
        .sort({ updatedAt: -1 })
        .lean(),
    ]);
    // Knockout schedules need to be ordered by round then slot, not by updatedAt.
    // Use createdAt as a stable tie-breaker for non-bracket matches.
    const matches = [...inProgressMatches, ...completedMatches];

    res.json({ success: true, data: { ...tournament, matches } });
  } catch (error) {
    console.error("Get tournament error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch tournament." });
  }
};

// Update tournament
exports.updateTournament = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }

    const tournament = await Tournament.findById(id);

    if (!tournament) {
      return res.status(404).json({ success: false, error: "Tournament not found" });
    }

    if (tournament.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    const { name, numberOfTeams, teamNames, playersPerTeam, totalOvers, ballsPerOver, venue, description, status } = req.body;

    if (name !== undefined) tournament.name = name.trim();
    if (numberOfTeams !== undefined) tournament.numberOfTeams = numberOfTeams;
    if (teamNames !== undefined) tournament.teamNames = teamNames;
    if (playersPerTeam !== undefined) tournament.playersPerTeam = playersPerTeam;
    if (totalOvers !== undefined) tournament.totalOvers = totalOvers;
    if (ballsPerOver !== undefined) tournament.ballsPerOver = ballsPerOver;
    if (venue !== undefined) tournament.venue = venue;
    if (description !== undefined) tournament.description = description;
    if (status !== undefined) tournament.status = status;

    const updated = await tournament.save();

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update tournament error:", error);
    res.status(500).json({ success: false, error: "Failed to update tournament." });
  }
};

// Delete tournament and linked matches
exports.deleteTournament = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }

    const tournament = await Tournament.findById(id);

    if (!tournament) {
      return res.status(404).json({ success: false, error: "Tournament not found" });
    }

    if (tournament.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    // Delete all linked matches
    await Match.deleteMany({ tournament: id });

    await Tournament.findByIdAndDelete(id);

    res.json({ success: true, message: "Tournament and linked matches deleted successfully." });
  } catch (error) {
    console.error("Delete tournament error:", error);
    res.status(500).json({ success: false, error: "Failed to delete tournament." });
  }
};

// Get tournament stats
exports.getTournamentStats = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }

    const tournament = await Tournament.findById(id).lean();

    if (!tournament) {
      return res.status(404).json({ success: false, error: "Tournament not found" });
    }

    if (tournament.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    const tournamentObjectId = new mongoose.Types.ObjectId(id);

    // Run all queries in parallel
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
    console.error("Get tournament stats error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch tournament stats." });
  }
};

// Rename a team across the whole tournament (teamNames + every linked match).
// POST /api/tournaments/:id/rename-team   body: { oldName, newName }
exports.renameTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { oldName, newName } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }
    if (!oldName || !newName || !oldName.trim() || !newName.trim()) {
      return res.status(400).json({ success: false, error: "oldName and newName are required" });
    }
    if (oldName === newName) {
      return res.json({ success: true, data: { tournamentUpdated: false, matchesUpdated: 0 } });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ success: false, error: "Tournament not found" });
    }
    if (tournament.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    // Block renaming to a name another team in this tournament already uses.
    const conflictingTeam = tournament.teamNames.some(
      (n) => n && n !== oldName && n.trim().toLowerCase() === newName.trim().toLowerCase()
    );
    if (conflictingTeam) {
      return res.status(409).json({ success: false, error: `Another team is already called "${newName}".` });
    }

    const result = await propagateTeamNameToTournament(id, oldName.trim(), newName.trim());
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Rename team error:", error);
    res.status(500).json({ success: false, error: "Failed to rename team." });
  }
};

// Generate share link for tournament
exports.generateShareId = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }

    const tournament = await Tournament.findById(id);

    if (!tournament) {
      return res.status(404).json({ success: false, error: "Tournament not found" });
    }

    if (tournament.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    // If already has a shareId, return it
    if (!tournament.shareId) {
      tournament.shareId = nanoid(12);
      await tournament.save();
    }

    res.json({
      success: true,
      data: {
        shareId: tournament.shareId,
        shareUrl: `https://cric-zone.com/tournament/${tournament.shareId}`
      }
    });
  } catch (error) {
    console.error("Generate share ID error:", error);
    res.status(500).json({ success: false, error: "Failed to generate share link." });
  }
};
