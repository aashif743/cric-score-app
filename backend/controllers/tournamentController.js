const Tournament = require("../models/Tournament");
const Match = require("../models/Match");
const mongoose = require("mongoose");

// Create tournament
exports.createTournament = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "User not authenticated." });
    }

    const { name, numberOfTeams, teamNames, playersPerTeam, totalOvers, ballsPerOver, venue, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Tournament name is required." });
    }
    if (!numberOfTeams || numberOfTeams < 2) {
      return res.status(400).json({ success: false, error: "At least 2 teams are required." });
    }

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
    });

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

    const matches = await Match.find({ tournament: id })
      .select('teamA teamB status result createdAt updatedAt totalOvers ballsPerOver playersPerTeam innings1 innings2')
      .sort({ updatedAt: -1 });

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

    // Top 5 run scorers
    const topRunScorers = await Match.aggregate([
      { $match: { tournament: tournamentObjectId, status: "completed" } },
      {
        $project: {
          batsmen: {
            $concatArrays: [
              { $ifNull: ["$innings1.batting", []] },
              { $ifNull: ["$innings2.batting", []] }
            ]
          }
        }
      },
      { $unwind: "$batsmen" },
      {
        $group: {
          _id: "$batsmen.name",
          totalRuns: { $sum: "$batsmen.runs" },
          totalBalls: { $sum: "$batsmen.balls" },
          totalFours: { $sum: "$batsmen.fours" },
          totalSixes: { $sum: "$batsmen.sixes" },
          innings: { $sum: 1 }
        }
      },
      { $sort: { totalRuns: -1 } },
      { $limit: 5 }
    ]);

    // Top 5 wicket takers
    const topWicketTakers = await Match.aggregate([
      { $match: { tournament: tournamentObjectId, status: "completed" } },
      {
        $project: {
          bowlers: {
            $concatArrays: [
              { $ifNull: ["$innings1.bowling", []] },
              { $ifNull: ["$innings2.bowling", []] }
            ]
          }
        }
      },
      { $unwind: "$bowlers" },
      {
        $group: {
          _id: "$bowlers.name",
          totalWickets: { $sum: "$bowlers.wickets" },
          totalRuns: { $sum: "$bowlers.runs" },
          innings: { $sum: 1 }
        }
      },
      { $sort: { totalWickets: -1 } },
      { $limit: 5 }
    ]);

    // Match counts
    const totalMatches = await Match.countDocuments({ tournament: tournamentObjectId });
    const completedMatches = await Match.countDocuments({ tournament: tournamentObjectId, status: "completed" });

    // Most runs in a match
    const mostRunsInMatch = await Match.aggregate([
      { $match: { tournament: tournamentObjectId, status: "completed" } },
      {
        $project: {
          batsmen: {
            $concatArrays: [
              { $ifNull: ["$innings1.batting", []] },
              { $ifNull: ["$innings2.batting", []] }
            ]
          },
          matchTitle: { $concat: ["$teamA.name", " vs ", "$teamB.name"] }
        }
      },
      { $unwind: "$batsmen" },
      { $sort: { "batsmen.runs": -1 } },
      { $limit: 1 },
      {
        $project: {
          name: "$batsmen.name",
          runs: "$batsmen.runs",
          balls: "$batsmen.balls",
          matchTitle: 1
        }
      }
    ]);

    // Best bowling in a match
    const bestBowling = await Match.aggregate([
      { $match: { tournament: tournamentObjectId, status: "completed" } },
      {
        $project: {
          bowlers: {
            $concatArrays: [
              { $ifNull: ["$innings1.bowling", []] },
              { $ifNull: ["$innings2.bowling", []] }
            ]
          },
          matchTitle: { $concat: ["$teamA.name", " vs ", "$teamB.name"] }
        }
      },
      { $unwind: "$bowlers" },
      { $sort: { "bowlers.wickets": -1, "bowlers.runs": 1 } },
      { $limit: 1 },
      {
        $project: {
          name: "$bowlers.name",
          wickets: "$bowlers.wickets",
          runs: "$bowlers.runs",
          overs: "$bowlers.overs",
          matchTitle: 1
        }
      }
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
