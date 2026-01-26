const Match = require("../models/Match");
const mongoose = require("mongoose");

// Helper function to process innings data
const processInnings = (inningsData) => {
  if (!inningsData) return null;
  
  return {
    battingTeam: inningsData.battingTeam,
    bowlingTeam: inningsData.bowlingTeam,
    runs: inningsData.runs || 0,
    wickets: inningsData.wickets || 0,
    overs: inningsData.overs || "0.0",
    runRate: parseFloat(inningsData.runRate) || 0,
    batting: (inningsData.batting || []).map(b => ({
      name: b.name,
      runs: b.runs || 0,
      balls: b.balls || 0,
      fours: b.fours || 0,
      sixes: b.sixes || 0,
      isOut: b.isOut || false,
      outType: b.outType || 'Not Out',
      strikeRate: parseFloat(b.strikeRate) || 0
    })),
    bowling: (inningsData.bowling || []).map(b => ({
      name: b.name,
      overs: b.overs || "0.0",
      runs: b.runs || 0,
      wickets: b.wickets || 0,
      maidens: b.maidens || 0,
      economyRate: parseFloat(b.economyRate) || 0
    })),
    extras: inningsData.extras || {
      total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0
    },
    fallOfWickets: inningsData.fallOfWickets || [],
    target: inningsData.target || null
  };
};


// Create a new match
exports.createMatch = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "User not authenticated." });
    }

    const {
      teamA,
      teamB,
      venue,
      matchType,
      toss,
      firstBatting,
      overs,
      totalOvers, // Frontend sends this
      ballsPerOver,
      playersPerTeam,
    } = req.body;

    // Use totalOvers if overs not provided (frontend compatibility)
    const matchOvers = overs || totalOvers;

    if (!teamA?.name || !teamB?.name) {
      return res.status(400).json({
        success: false,
        error: "Both team names are required",
      });
    }

    // Determine initial batting and bowling teams
    const tossWinner = toss?.winner || teamA.name;
    const tossDecision = toss?.decision || "bat";
    let innings1BattingTeamName = firstBatting || teamA.name;
    let innings1BowlingTeamName = innings1BattingTeamName === teamA.name ? teamB.name : teamA.name;

    if (tossWinner) {
      if (tossDecision === "bat") {
        innings1BattingTeamName = tossWinner;
      } else {
        innings1BattingTeamName = tossWinner === teamA.name ? teamB.name : teamA.name;
      }
      innings1BowlingTeamName = innings1BattingTeamName === teamA.name ? teamB.name : teamA.name;
    }

    // Create default players
    const createDefaultPlayers = (teamName, count) => {
      return Array.from({ length: count || 11 }, (_, i) => ({
        name: `${teamName} Player ${i + 1}`,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        isOut: false,
        outType: "Not Out"
      }));
    };

    const matchData = {
      user: req.user.id,
      teamA: {
        name: teamA.name,
        shortName: teamA.shortName || teamA.name.substring(0, 3).toUpperCase(),
      },
      teamB: {
        name: teamB.name,
        shortName: teamB.shortName || teamB.name.substring(0, 3).toUpperCase(),
      },
      venue: venue || "Unknown Venue",
      matchType: matchType || "T20",
      toss: {
        winner: tossWinner,
        decision: tossDecision,
      },
      totalOvers: matchOvers || 20,
      ballsPerOver: ballsPerOver || 6,
      playersPerTeam: playersPerTeam || 11,
      status: "scheduled",
      matchSummary: {
        playerOfMatch: "",
        winner: "",
        margin: ""
      },
      innings1: {
        battingTeam: innings1BattingTeamName,
        bowlingTeam: innings1BowlingTeamName,
        runs: 0,
        wickets: 0,
        overs: "0.0",
        runRate: 0,
        extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
        fallOfWickets: [],
        batting: createDefaultPlayers(innings1BattingTeamName, playersPerTeam),
        bowling: createDefaultPlayers(innings1BowlingTeamName, playersPerTeam),
        declared: false,
      }
    };

    const newMatch = new Match(matchData);
    const savedMatch = await newMatch.save();

    res.status(201).json({ success: true, data: savedMatch });
  } catch (error) {
    console.error("Create match error:", {
      message: error.message,
      stack: error.stack,
      validationErrors: error.errors
    });
    
    res.status(500).json({
      success: false,
      error: "Internal server error during match creation.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all matches - Returns full data for in_progress matches to allow resuming
exports.getMyMatches = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "User not authenticated." });
    }

    // Find all matches for the user - include full data for resuming in_progress matches
    const matches = await Match.find({ user: req.user.id })
      .select('teamA teamB status result createdAt updatedAt totalOvers ballsPerOver playersPerTeam toss innings1 innings2 currentState liveState innings target')
      .sort({ updatedAt: -1 }); // Sort by most recently updated

    res.json({
      success: true,
      data: matches,
    });
  } catch (error) {
    console.error("Get my matches error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch user's matches" });
  }
};


// Get match by ID - (No changes, seems fine)
exports.getMatchById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid match ID" });
    }

    const match = await Match.findById(id).lean();

    if (!match) {
      return res.status(404).json({ success: false, error: "Match not found" });
    }

    if (match.user.toString() !== req.user.id) {
        return res.status(401).json({ success: false, error: "Not authorized to view this match" });
    }

    // **KEY LOGIC**: If the match is in progress and has a saved liveState, return that.
    // Otherwise, return the main match document for viewing a completed scorecard.
    if (match.status === "in_progress" && match.liveState) {
        console.log(`Resuming match ${id} from saved liveState.`);
        res.json({ success: true, data: match.liveState });
    } else {
        console.log(`Loading completed match ${id} data.`);
        res.json({ success: true, data: match });
    }

  } catch (error) {
    console.error("Get match error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch match" });
  }
};

// Update match - Saves match progress for resuming later
exports.updateMatch = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('=== UPDATE MATCH REQUEST ===');
    console.log('Match ID:', id);

    // Basic validation
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid match ID" });
    }

    // First check authorization
    const existingMatch = await Match.findById(id).select('user').lean();
    if (!existingMatch) {
      return res.status(404).json({ success: false, error: "Match not found" });
    }
    if (existingMatch.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    const { innings1, innings2, currentState, innings, target, totalOvers, ballsPerOver, playersPerTeam } = req.body;

    // Build update object
    const updateData = {
      status: "in_progress",
      updatedAt: new Date()
    };

    // Preserve match settings if provided
    if (totalOvers !== undefined) {
      updateData.totalOvers = totalOvers;
    }
    if (ballsPerOver !== undefined) {
      updateData.ballsPerOver = ballsPerOver;
    }
    if (playersPerTeam !== undefined) {
      updateData.playersPerTeam = playersPerTeam;
    }

    // Add innings1 if provided
    if (innings1) {
      updateData.innings1 = {
        battingTeam: innings1.battingTeam,
        bowlingTeam: innings1.bowlingTeam,
        runs: innings1.runs ?? 0,
        wickets: innings1.wickets ?? 0,
        overs: innings1.overs || "0.0",
        batting: innings1.batting || [],
        bowling: innings1.bowling || [],
        extras: innings1.extras || { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
        fallOfWickets: innings1.fallOfWickets || [],
      };
    }

    // Add innings2 if provided
    if (innings2) {
      updateData.innings2 = {
        battingTeam: innings2.battingTeam,
        bowlingTeam: innings2.bowlingTeam,
        runs: innings2.runs ?? 0,
        wickets: innings2.wickets ?? 0,
        overs: innings2.overs || "0.0",
        batting: innings2.batting || [],
        bowling: innings2.bowling || [],
        extras: innings2.extras || { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
        fallOfWickets: innings2.fallOfWickets || [],
        target: target || innings2.target,
      };
    }

    // Add currentState if provided
    if (currentState) {
      updateData.currentState = currentState;
    }

    // Add innings number and target
    if (innings !== undefined) {
      updateData.innings = innings;
    }
    if (target !== undefined) {
      updateData.target = target;
    }

    console.log('Updating with data keys:', Object.keys(updateData));

    // Use findByIdAndUpdate with runValidators disabled for flexibility
    const updatedMatch = await Match.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: false }
    );

    console.log('=== MATCH SAVED SUCCESSFULLY ===');
    console.log('Has currentState:', !!updatedMatch.currentState);

    res.status(200).json({
      success: true,
      message: "Match progress saved successfully"
    });

  } catch (error) {
    console.error("Update match error:", error.message);
    console.error("Full error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Server error during match update"
    });
  }
};


// Delete match (No changes, seems fine)
exports.deleteMatch = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid match ID" });
    }
    
    const match = await Match.findById(id);
    if (!match) {
      return res.status(404).json({ success: false, error: "Match not found" });
    }
    
    // Security Check
    if (match.user.toString() !== req.user.id) {
        return res.status(401).json({ success: false, error: "Not authorized to delete this match" });
    }

    const deletedMatch = await Match.findByIdAndDelete(id);
    res.json({ success: true, message: "Match deleted successfully" });
  } catch (error) {
    console.error("Delete match error:", error);
    res.status(500).json({ success: false, error: "Failed to delete match" });
  }
};

// End first innings (called by frontend when 1st innings finishes)
// This should ensure innings1 is fully populated and initialize innings2.
exports.endInnings = async (req, res) => {
  try {
    const { id } = req.params;
    const { innings1Data } = req.body; // Frontend should send complete innings1 data

    if (!innings1Data) {
        return res.status(400).json({ success: false, error: "Innings 1 data not provided." });
    }

    const match = await Match.findById(req.params.id);
    if (match && match.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, error: "Not authorized" });
    }

    if (!match.innings1) { // Should have been initialized in createMatch
        return res.status(400).json({ success: false, error: "Match innings1 not initialized." });
    }

    // Populate match.innings1 with complete data from innings1Data
    match.innings1.runs = innings1Data.runs || match.innings1.runs;
    match.innings1.wickets = innings1Data.wickets || match.innings1.wickets;
    match.innings1.overs = innings1Data.overs || match.innings1.overs;
    match.innings1.runRate = parseFloat(innings1Data.runRate) || match.innings1.runRate;
    match.innings1.extras = innings1Data.extras || match.innings1.extras;
    match.innings1.fallOfWickets = innings1Data.fallOfWickets || match.innings1.fallOfWickets;
    match.innings1.batting = (innings1Data.batting || []).map(b => ({ // Map to ensure schema adherence
        name: b.name,
        runs: b.runs || 0,
        balls: b.balls || 0,
        fours: b.fours || 0,
        sixes: b.sixes || 0,
        isOut: b.isOut || false,
        outType: b.outType || null,
        strikeRate: parseFloat(b.strikeRate) || 0,
    }));
    match.innings1.bowling = (innings1Data.bowling || []).map(b => ({ // Store aggregated from frontend
        name: b.name,
        overs: b.overs, // String like "4.0"
        runs: b.runs || 0,
        wickets: b.wickets || 0,
        maidens: b.maidens || 0,
    }));
    match.innings1.declared = innings1Data.declared || false;


    // Initialize innings2
    match.innings2 = {
      battingTeam: match.innings1.bowlingTeam, // Team that bowled in 1st innings
      bowlingTeam: match.innings1.battingTeam, // Team that batted in 1st innings
      runs: 0,
      wickets: 0,
      overs: "0.0",
      runRate: 0,
      extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      fallOfWickets: [],
      batting: [],
      bowling: [],
      declared: false,
      target: (match.innings1.runs || 0) + 1, // Target for innings2
    };

    match.status = "in_progress"; // Or "break" / "innings_break"

    await match.save();

    res.json({ success: true, message: "First innings ended. Second innings started.", data: match });
  } catch (error) {
    console.error("End innings error:", error.message, error.stack);
    res.status(500).json({ success: false, error: "Server error ending first innings.", message: error.message });
  }
};


// End match
exports.endMatch = async (req, res) => {
  try {
    console.log('End match request received:', {
      params: req.params,
      body: req.body,
      user: req.user
    });

    const { id } = req.params;
    const { innings1, innings2, result, matchSummary } = req.body;

    // Validate required data
    if (!innings1 || !result) {
      console.error('Validation failed - missing innings1 or result');
      return res.status(400).json({ 
        success: false, 
        error: "Innings1 data and result are required.",
        received: { innings1: !!innings1, result: !!result }
      });
    }

    const match = await Match.findById(id);
    if (!match) {
      console.error(`Match not found with id: ${id}`);
      return res.status(404).json({ success: false, error: "Match not found" });
    }
    if (match.user.toString() !== req.user.id) {
      console.error(`User ${req.user.id} not authorized for match ${id}`);
      return res.status(401).json({ success: false, error: "Not authorized" });
    }

    // Process innings data with proper defaults
    const processInnings = (inningsData) => {
      if (!inningsData) return null;
      
      return {
        battingTeam: inningsData.battingTeam,
        bowlingTeam: inningsData.bowlingTeam,
        runs: inningsData.runs || 0,
        wickets: inningsData.wickets || 0,
        overs: inningsData.overs || "0.0",
        runRate: parseFloat(inningsData.runRate) || 0,
        batting: (inningsData.batting || []).map(b => ({
          name: b.name,
          runs: b.runs || 0,
          balls: b.balls || 0,
          fours: b.fours || 0,
          sixes: b.sixes || 0,
          isOut: b.isOut || false,
          outType: b.outType || 'Not Out', // Ensure valid outType
          strikeRate: parseFloat(b.strikeRate) || 0
        })),
        bowling: (inningsData.bowling || []).map(b => ({
          name: b.name,
          overs: b.overs || "0.0",
          runs: b.runs || 0,
          wickets: b.wickets || 0,
          maidens: b.maidens || 0,
          economyRate: parseFloat(b.economyRate) || 0
        })),
        extras: inningsData.extras || {
          total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0
        },
        fallOfWickets: inningsData.fallOfWickets || [],
        target: inningsData.target || null
      };
    };

    // Update match document
    match.innings1 = processInnings(innings1);
    match.innings2 = processInnings(innings2);
    match.result = result;
    match.status = "completed";
    match.matchSummary = {
      playerOfMatch: matchSummary?.playerOfMatch || "",
      winner: matchSummary?.winner || "",
      margin: matchSummary?.margin || "",
      netRunRates: matchSummary?.netRunRates || {}
    };
    match.liveState = null;

    await match.save();

    res.json({
      success: true,
      message: "Match ended successfully",
      data: match
    });

  } catch (error) {
    console.error("End match error:", {
      message: error.message,
      stack: error.stack,
      validationErrors: error.errors,
      receivedData: req.body
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to end match",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Add this new exported function
exports.deleteAllMatches = async (req, res) => {
  try {
    await Match.deleteMany({ user: req.user.id });
    res.json({ success: true, message: "All matches deleted successfully." });
  } catch (error) {
    console.error("Delete all matches error:", error);
    res.status(500).json({ success: false, error: "Failed to delete all matches." });
  }
};

module.exports = {
  createMatch: exports.createMatch,
  getMyMatches: exports.getMyMatches,
  getMatchById: exports.getMatchById,
  updateMatch: exports.updateMatch,
  deleteMatch: exports.deleteMatch,
  endInnings: exports.endInnings,
  endMatch: exports.endMatch,
  deleteAllMatches: exports.deleteAllMatches,
};
