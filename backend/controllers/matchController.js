const Match = require("../models/Match");
const mongoose = require("mongoose");

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
      firstBatting, // Will be used to determine innings1.battingTeam
      overs, // Assuming this is total overs for the match
      ballsPerOver,
      playersPerTeam,
    } = req.body;

    if (!teamA?.name || !teamB?.name) {
      return res.status(400).json({
        success: false,
        error: "Both team names are required",
      });
    }

    // Determine initial batting and bowling teams
    const tossWinner = toss?.winner || teamA.name;
    const tossDecision = toss?.decision || "bat";
    let innings1BattingTeamName = firstBatting || teamA.name; // Default if not provided
    let innings1BowlingTeamName =
      innings1BattingTeamName === teamA.name ? teamB.name : teamA.name;

    if (tossWinner) {
      if (tossDecision === "bat") {
        innings1BattingTeamName = tossWinner;
      } else {
        // If toss winner chose to bowl
        innings1BattingTeamName = tossWinner === teamA.name ? teamB.name : teamA.name;
      }
      innings1BowlingTeamName =
        innings1BattingTeamName === teamA.name ? teamB.name : teamA.name;
    }


    const matchDataForSchema = {

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
      matchType: matchType || "T20", // Make sure this is one of MatchSchema enums
      toss: {
        winner: tossWinner,
        decision: tossDecision,
      },
      totalOvers: overs || 20, // Assuming MatchSchema has 'totalOvers'
      ballsPerOver: ballsPerOver || 6, // MatchSchema has this
      playersPerTeam: playersPerTeam || 11, // Assuming MatchSchema has 'playersPerTeam'
      status: "scheduled",
      matchSummary: { // Default empty summary
        playerOfMatch: "",
        winner: "",
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
        batting: [], // Will be populated during the match
        bowling: [], // Will be populated during the match
        declared: false,
      },
      // innings2 will be initialized when innings1 ends
    };

    const newMatch = new Match(matchDataForSchema);
    const savedMatch = await newMatch.save();

    res.status(201).json({ success: true, data: savedMatch });
  } catch (error) {
    console.error("Create match error:", error.message, error.stack);
    res.status(500).json({
      success: false,
      error: "Internal server error during match creation.",
      message: error.message,
    });
  }
};

// Get all matches - (No changes, seems fine)
exports.getMyMatches = async (req, res) => { 
  try {
    // Note: The `protect` middleware gives us the logged-in user on req.user
    if (!req.user) {
        return res.status(401).json({ success: false, error: "User not authenticated." });
    }

    // Find all matches where the 'user' field matches the logged-in user's ID
    const matches = await Match.find({ user: req.user.id }).sort({ createdAt: -1 });

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

    const match = await Match.findById(id);

    if (!match) {
      return res.status(404).json({ success: false, error: "Match not found" });
    }

    if (match.user.toString() !== req.user.id) {
        return res.status(401).json({ success: false, error: "Not authorized to view this match" });
    }

    res.json({ success: true, data: match });
  } catch (error) {
    console.error("Get match error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch match" });
  }
};

// Update match - Placeholder for robust live updates
// For your immediate problem, endMatch is more critical.
// A full live update here would need to carefully merge player stats into innings.batting/bowling arrays.
exports.updateMatch = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid match ID" });
    }

    const match = await Match.findById(id);
    if (!match) {
      return res.status(404).json({ success: false, error: "Match not found" });
    }

    if (match.user.toString() !== req.user.id) {
        return res.status(401).json({ success: false, error: "Not authorized to update this match" });
    }

    const { _id, createdAt, updatedAt, ...updateDataFromFrontend } = req.body;

    const activeInningsKey = (match.innings1 && match.status === "in_progress" && (!match.innings2 || match.innings2.overs === "0.0")) ? "innings1" : "innings2";

    if (match.status !== "in_progress" && match.status !== "scheduled") { // 'scheduled' if first ball update
        return res.status(400).json({ success: false, error: "Match is not in progress or scheduled to start." });
    }

    if (activeInningsKey) {
        if (updateDataFromFrontend.runs !== undefined) {
            match[activeInningsKey].runs = updateDataFromFrontend.runs;
        }
        if (updateDataFromFrontend.wickets !== undefined) {
            match[activeInningsKey].wickets = updateDataFromFrontend.wickets;
        }
        if (updateDataFromFrontend.overs !== undefined) { // 'overs' is the string like "10.2"
            match[activeInningsKey].overs = updateDataFromFrontend.overs;
        }
         if (updateDataFromFrontend.runRate !== undefined) {
            match[activeInningsKey].runRate = parseFloat(updateDataFromFrontend.runRate) || 0;
        }
        if (updateDataFromFrontend.extras) { // Assuming extras is an object
            match[activeInningsKey].extras = { ...match[activeInningsKey].extras, ...updateDataFromFrontend.extras };
        }
        if (updateDataFromFrontend.fallOfWickets) { // Assuming FOW is an array
            match[activeInningsKey].fallOfWickets = updateDataFromFrontend.fallOfWickets;
        }
        if (updateDataFromFrontend.batting) { // Sent from frontend
            match[activeInningsKey].batting = updateDataFromFrontend.batting;
        }
        if (updateDataFromFrontend.bowling) { // Sent from frontend
             match[activeInningsKey].bowling = updateDataFromFrontend.bowling;
        }
    }

    if (updateDataFromFrontend.status) {
        match.status = updateDataFromFrontend.status;
    }
     if (updateDataFromFrontend.target && activeInningsKey === 'innings2') { // Target is for 2nd innings
        match.innings2.target = updateDataFromFrontend.target;
    }

    const updatedMatch = await match.save();

    res.json({ success: true, data: updatedMatch, message: "Match updated successfully" });
  } catch (error) {
    console.error("Update match error:", error.message, error.stack);
    res.status(500).json({ success: false, error: "Failed to update match", message: error.message });
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


// End match - This processes the comprehensive matchData from ScoreCard.jsx
exports.endMatch = async (req, res) => {
  try {
    const { id } = req.params;
    // ScoreCard.jsx sends the entire match data payload under the key 'matchData'
    const fullMatchDataFromFrontend = req.body.matchData; 

    if (!fullMatchDataFromFrontend) {
      return res.status(400).json({ success: false, error: "Match data not provided in request body." });
    }

    const match = await Match.findById(req.params.id);
    if (match && match.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, error: "Not authorized" });
    }

    // Destructure data from the frontend payload
    const {
      innings1: feInnings1,
      innings2: feInnings2,
      matchSummary: feMatchSummary,
      result: feResult,
    } = fullMatchDataFromFrontend;

    // --- Populate Innings 1 ---
    if (feInnings1) {
      match.innings1 = {
        battingTeam: feInnings1.teamName || match.teamA.name, // Fallback, but should be in feInnings1
        bowlingTeam: feInnings2?.teamName || (feInnings1.teamName === match.teamA.name ? match.teamB.name : match.teamA.name),
        runs: feInnings1.runs || 0,
        wickets: feInnings1.wickets || 0,
        overs: feInnings1.overs || "0.0",
        runRate: parseFloat(feInnings1.runRate) || 0,
        extras: feInnings1.extras || { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
        fallOfWickets: feInnings1.fallOfWickets || [],
        batting: (feInnings1.batting || []).map(b => ({
          name: b.name,
          runs: b.runs || 0,
          balls: b.balls || 0,
          fours: b.fours || 0, // Frontend must send this
          sixes: b.sixes || 0, // Frontend must send this
          isOut: b.isOut || false,
          outType: b.outType || null,
          strikeRate: parseFloat(b.strikeRate) || 0,
        })),
        bowling: (feInnings1.bowling || []).map(b => ({ // Storing aggregated stats
          name: b.name,
          overs: b.overs, // String like "4.0"
          runs: b.runs || 0,
          wickets: b.wickets || 0,
          maidens: b.maidens || 0, // Frontend must send this
        })),
        declared: feInnings1.declared || false,
      };
    } else if (match.status !== "abandoned"){ // Should not happen for a completed match sent from frontend
        console.warn(`Match ${id}: feInnings1 data was missing in endMatch payload.`);
        // Ensure innings1 exists if it should
        match.innings1 = match.innings1 || { battingTeam: match.teamA.name, bowlingTeam: match.teamB.name, runs: 0, wickets: 0, overs: "0.0", batting: [], bowling:[], extras: {total: 0, wides:0, noBalls:0, byes:0, legByes:0}, fallOfWickets:[] };
    }


    // --- Populate Innings 2 ---
    if (feInnings2) {
      match.innings2 = {
        battingTeam: feInnings2.teamName || match.teamB.name, // Fallback
        bowlingTeam: feInnings1?.teamName || (feInnings2.teamName === match.teamB.name ? match.teamA.name : match.teamB.name),
        runs: feInnings2.runs || 0,
        wickets: feInnings2.wickets || 0,
        overs: feInnings2.overs || "0.0",
        runRate: parseFloat(feInnings2.runRate) || 0,
        extras: feInnings2.extras || { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
        fallOfWickets: feInnings2.fallOfWickets || [],
        batting: (feInnings2.batting || []).map(b => ({
          name: b.name,
          runs: b.runs || 0,
          balls: b.balls || 0,
          fours: b.fours || 0,
          sixes: b.sixes || 0,
          isOut: b.isOut || false,
          outType: b.outType || null,
          strikeRate: parseFloat(b.strikeRate) || 0,
        })),
        bowling: (feInnings2.bowling || []).map(b => ({ // Storing aggregated stats
          name: b.name,
          overs: b.overs,
          runs: b.runs || 0,
          wickets: b.wickets || 0,
          maidens: b.maidens || 0,
        })),
        declared: feInnings2.declared || false,
        target: match.innings1 ? ((match.innings1.runs || 0) + 1) : (feInnings1 ? (feInnings1.runs || 0) + 1 : 0),
      };
    } else if (match.status !== "abandoned" && feInnings1) { // If match not abandoned and there was a first innings, innings2 should exist.
        console.warn(`Match ${id}: feInnings2 data was missing in endMatch payload. Initializing.`);
        match.innings2 = match.innings2 || { battingTeam: feInnings1?.bowlingTeam || match.teamB.name, bowlingTeam: feInnings1?.teamName || match.teamA.name, runs: 0, wickets: 0, overs: "0.0", batting: [], bowling:[], extras: {total: 0, wides:0, noBalls:0, byes:0, legByes:0}, fallOfWickets:[] };
    }

    // --- Populate Match Summary & Result ---
    if (feMatchSummary) {
      match.matchSummary = {
        playerOfMatch: feMatchSummary.playerOfMatch || "TBD",
        winner: feMatchSummary.winner || "TBD",
        // If your MatchSchema is updated to include 'margin':
        // margin: feMatchSummary.margin || "" 
      };
    }
    match.result = feResult || "Result TBD";
    match.status = "completed"; // Mark as completed

    const savedMatch = await match.save();
    res.json({ success: true, message: "Match ended and result updated successfully.", data: savedMatch });

  } catch (error) {
    console.error("End match error:", error.message, error.stack);
    res.status(500).json({ success: false, error: "Internal server error while ending match.", message: error.message });
  }
};