const Match = require("../models/Match");
const Tournament = require("../models/Tournament");
const mongoose = require("mongoose");
const { propagateTeamNameToTournament } = require("../utils/teamRename");

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
    fallOfWickets: (inningsData.fallOfWickets || []).map(f => ({
      batsman: f.batsman || f.batsman_name || 'Unknown',
      score: f.score || 0,
      wicket: f.wicket || 0,
      over: f.over || '0.0'
    })),
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
      tournament,
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
      tournament: tournament || null,
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

    // Increment tournament match count if linked
    if (tournament) {
      await Tournament.findByIdAndUpdate(tournament, { $inc: { matchCount: 1 } });
    }

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

// Get all matches - lightweight list for completed, full data for in-progress
exports.getMyMatches = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "User not authenticated." });
    }

    // Split into two parallel queries: lightweight completed + full in-progress
    const [completedMatches, inProgressMatches] = await Promise.all([
      // Completed/abandoned: only summary fields needed for list display
      Match.find({ user: req.user.id, status: { $in: ["completed", "abandoned"] } })
        .select('teamA teamB status result createdAt updatedAt totalOvers ballsPerOver playersPerTeam innings1.runs innings1.wickets innings1.overs innings1.battingTeam innings2.runs innings2.wickets innings2.overs innings2.battingTeam tournament')
        .sort({ updatedAt: -1 })
        .lean(),
      // In-progress/scheduled/innings_break: full data for resuming
      Match.find({ user: req.user.id, status: { $in: ["scheduled", "in_progress", "innings_break"] } })
        .select('teamA teamB status result createdAt updatedAt totalOvers ballsPerOver playersPerTeam toss innings1 innings2 currentState innings target tournament')
        .sort({ updatedAt: -1 })
        .lean(),
    ]);

    // Merge: in-progress first, then completed
    const matches = [...inProgressMatches, ...completedMatches];

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

    // Owner can always view. Other signed-in users can view if the match
    // belongs to a public tournament — supports the live feed viewers.
    if (match.user.toString() !== req.user.id) {
      let allowed = false;
      if (match.tournament) {
        const Tournament = require('../models/Tournament');
        const t = await Tournament.findById(match.tournament).select('visibility').lean();
        // Treat anything not explicitly "private" as public (schema default is
        // "public"; legacy tournaments have no visibility field stored).
        if (t && t.visibility !== 'private') allowed = true;
      }
      if (!allowed) {
        return res.status(401).json({ success: false, error: "Not authorized to view this match" });
      }
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

    // First check authorization (also fetch teamA, teamB, tournament for propagation)
    const existingMatch = await Match.findById(id).select('user teamA teamB tournament').lean();
    if (!existingMatch) {
      return res.status(404).json({ success: false, error: "Match not found" });
    }
    if (existingMatch.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    const { innings1, innings2, currentState, innings, target, totalOvers, ballsPerOver, playersPerTeam, teamA, teamB } = req.body;

    // Build update object
    const updateData = {
      status: "in_progress",
      updatedAt: new Date()
    };

    // Persist team names if provided
    if (teamA) {
      updateData.teamA = { name: teamA.name, shortName: teamA.shortName || teamA.name.substring(0, 3).toUpperCase() };
    }
    if (teamB) {
      updateData.teamB = { name: teamB.name, shortName: teamB.shortName || teamB.name.substring(0, 3).toUpperCase() };
    }

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
        fallOfWickets: (innings1.fallOfWickets || []).map(f => ({
          batsman: f.batsman || f.batsman_name || 'Unknown',
          score: f.score || 0,
          wicket: f.wicket || 0,
          over: f.over || '0.0'
        })),
        overHistory: innings1.overHistory || [],
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
        fallOfWickets: (innings2.fallOfWickets || []).map(f => ({
          batsman: f.batsman || f.batsman_name || 'Unknown',
          score: f.score || 0,
          wicket: f.wicket || 0,
          over: f.over || '0.0'
        })),
        overHistory: innings2.overHistory || [],
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

    // Propagate team name changes to tournament if applicable
    if (existingMatch.tournament) {
      if (teamA && existingMatch.teamA?.name && teamA.name !== existingMatch.teamA.name) {
        propagateTeamNameToTournament(existingMatch.tournament, existingMatch.teamA.name, teamA.name).catch(e =>
          console.error('Tournament propagation error (teamA):', e.message)
        );
      }
      if (teamB && existingMatch.teamB?.name && teamB.name !== existingMatch.teamB.name) {
        propagateTeamNameToTournament(existingMatch.tournament, existingMatch.teamB.name, teamB.name).catch(e =>
          console.error('Tournament propagation error (teamB):', e.message)
        );
      }
    }

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

    // Decrement tournament match count if linked
    if (match.tournament) {
      await Tournament.findByIdAndUpdate(match.tournament, { $inc: { matchCount: -1 } });
    }

    await Match.findByIdAndDelete(id);
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
    if (!match) {
      return res.status(404).json({ success: false, error: "Match not found" });
    }
    if (match.user.toString() !== req.user.id) {
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
    match.innings1.fallOfWickets = (innings1Data.fallOfWickets || match.innings1.fallOfWickets || []).map(f => ({
      batsman: f.batsman || f.batsman_name || 'Unknown',
      score: f.score || 0,
      wicket: f.wicket || 0,
      over: f.over || '0.0'
    }));
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
    const { innings1, innings2, result, matchSummary, teamA, teamB } = req.body;

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
        fallOfWickets: (inningsData.fallOfWickets || []).map(f => ({
          batsman: f.batsman || f.batsman_name || 'Unknown',
          score: f.score || 0,
          wicket: f.wicket || 0,
          over: f.over || '0.0'
        })),
        overHistory: inningsData.overHistory || [],
        target: inningsData.target || null
      };
    };

    // Capture old team names for tournament propagation
    const oldTeamAName = match.teamA?.name;
    const oldTeamBName = match.teamB?.name;

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

    // Persist team names if provided
    if (teamA) {
      match.teamA = { name: teamA.name, shortName: teamA.shortName || teamA.name.substring(0, 3).toUpperCase() };
    }
    if (teamB) {
      match.teamB = { name: teamB.name, shortName: teamB.shortName || teamB.name.substring(0, 3).toUpperCase() };
    }

    await match.save();

    // Propagate team name changes to tournament if applicable
    if (match.tournament) {
      if (teamA && oldTeamAName && teamA.name !== oldTeamAName) {
        propagateTeamNameToTournament(match.tournament, oldTeamAName, teamA.name).catch(e =>
          console.error('Tournament propagation error (teamA):', e.message)
        );
      }
      if (teamB && oldTeamBName && teamB.name !== oldTeamBName) {
        propagateTeamNameToTournament(match.tournament, oldTeamBName, teamB.name).catch(e =>
          console.error('Tournament propagation error (teamB):', e.message)
        );
      }
    }

    // Knockout: advance winner into the next bracket match.
    if (match.nextMatchId && match.matchSummary?.winner) {
      propagateKnockoutWinner(match.nextMatchId, match.nextMatchSlot, match.matchSummary.winner)
        .catch(e => console.error('Knockout propagation error:', e.message));
    }

    // League group stage: if this match was a group match and its group is now
    // fully complete, rank the group and populate the knockout TBD slots.
    if (match.tournament && match.stage === 'group') {
      tryAdvanceLeagueGroup(match.tournament, match.group)
        .catch(e => console.error('League group-advance error:', e.message));
    }

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

// Helper: place the winner of a knockout match into the appropriate slot of
// the next-round match. Only updates if the next match is still scheduled and
// the corresponding slot is still TBD — never overwrites manual edits.
const propagateKnockoutWinner = async (nextMatchId, slot, winnerName) => {
  if (!nextMatchId || !slot || !winnerName) return;
  const next = await Match.findById(nextMatchId);
  if (!next || next.status !== 'scheduled') return;

  const teamObj = { name: winnerName, shortName: winnerName.substring(0, 3).toUpperCase() };
  const sideKey = slot === 'A' ? 'teamA' : 'teamB';
  if (next[sideKey]?.name && next[sideKey].name !== 'TBD') return; // already filled

  next[sideKey] = teamObj;

  // Keep innings1 placeholders in sync so the match is playable straight away.
  if (next.innings1) {
    if (slot === 'A') {
      next.innings1.battingTeam = winnerName;
      next.innings1.batting = Array.from({ length: next.playersPerTeam || 11 }, (_, i) => ({
        name: `${winnerName} Player ${i + 1}`,
        runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, outType: 'Not Out',
      }));
    } else {
      next.innings1.bowlingTeam = winnerName;
      next.innings1.bowling = Array.from({ length: next.playersPerTeam || 11 }, (_, i) => ({
        name: `${winnerName} Player ${i + 1}`,
        runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, outType: 'Not Out',
      }));
    }
  }

  await next.save();
};

// --- League group-stage helpers ---------------------------------------------

// Convert "12.3" → 12.5 (3 balls = 0.5 of an over).
const oversToDecimal = (overs) => {
  if (!overs && overs !== 0) return 0;
  const [whole, balls] = overs.toString().split('.');
  return (parseInt(whole, 10) || 0) + (parseInt(balls, 10) || 0) / 6;
};

// Build a points-table row per team for a group from all its completed matches.
// Cricket league points (CPL/IPL convention): win=2, tie/no-result=1, loss=0.
// Tie-break: NRR descending, then head-to-head (if exactly two teams tied).
const computeGroupStandings = (matches, teamNames) => {
  const row = (team) => ({
    team, played: 0, won: 0, lost: 0, tied: 0, points: 0,
    runsFor: 0, oversFor: 0, runsAgainst: 0, oversAgainst: 0,
    h2h: {}, // opponent → 'won'|'lost'|'tied'
  });
  const table = Object.fromEntries(teamNames.map((t) => [t, row(t)]));

  matches.forEach((m) => {
    if (m.status !== 'completed') return;
    const a = m.teamA?.name; const b = m.teamB?.name;
    if (!a || !b || !table[a] || !table[b]) return;
    const i1 = m.innings1 || {}; const i2 = m.innings2 || {};

    // Identify which innings each team batted in.
    const aFirst = i1.battingTeam === a;
    const aBat = aFirst ? i1 : i2;
    const bBat = aFirst ? i2 : i1;
    const aRuns = aBat.runs || 0;
    const aOv = oversToDecimal(aBat.overs);
    const bRuns = bBat.runs || 0;
    const bOv = oversToDecimal(bBat.overs);

    table[a].played++; table[b].played++;
    table[a].runsFor += aRuns; table[a].runsAgainst += bRuns;
    table[a].oversFor += aOv;   table[a].oversAgainst += bOv;
    table[b].runsFor += bRuns; table[b].runsAgainst += aRuns;
    table[b].oversFor += bOv;   table[b].oversAgainst += aOv;

    const winner = m.matchSummary?.winner || (() => {
      const idx = m.result?.indexOf(' won by ') ?? -1;
      return idx > 0 ? m.result.slice(0, idx) : '';
    })();
    if (winner === a) {
      table[a].won++; table[b].lost++;
      table[a].points += 2;
      table[a].h2h[b] = 'won'; table[b].h2h[a] = 'lost';
    } else if (winner === b) {
      table[b].won++; table[a].lost++;
      table[b].points += 2;
      table[b].h2h[a] = 'won'; table[a].h2h[b] = 'lost';
    } else {
      // Tied or no-result.
      table[a].tied++; table[b].tied++;
      table[a].points += 1; table[b].points += 1;
      table[a].h2h[b] = 'tied'; table[b].h2h[a] = 'tied';
    }
  });

  // NRR = (totalRuns/totalOvers) − (totalRunsAgainst/totalOversAgainst).
  Object.values(table).forEach((r) => {
    const rrFor = r.oversFor > 0 ? r.runsFor / r.oversFor : 0;
    const rrAgainst = r.oversAgainst > 0 ? r.runsAgainst / r.oversAgainst : 0;
    r.nrr = +(rrFor - rrAgainst).toFixed(3);
  });

  // Sort: points DESC → NRR DESC → head-to-head (only when two-way tie).
  return Object.values(table).sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.nrr !== x.nrr) return y.nrr - x.nrr;
    if (x.h2h[y.team] === 'won') return -1;
    if (y.h2h[x.team] === 'won') return 1;
    return 0;
  });
};

// Place winner into a TBD slot of a knockout match. Mirrors propagateKnockoutWinner
// but operates on stage='knockout' league matches looked up by source label.
const fillKnockoutSlot = async (knockoutMatch, slotKey /* 'A' | 'B' */, teamName) => {
  if (!teamName) return;
  const sideKey = slotKey === 'A' ? 'teamA' : 'teamB';
  if (knockoutMatch[sideKey]?.name && knockoutMatch[sideKey].name !== 'TBD') return;
  knockoutMatch[sideKey] = { name: teamName, shortName: teamName.substring(0, 3).toUpperCase() };
  if (knockoutMatch.innings1) {
    if (slotKey === 'A') {
      knockoutMatch.innings1.battingTeam = teamName;
      knockoutMatch.innings1.batting = Array.from({ length: knockoutMatch.playersPerTeam || 11 }, (_, i) => ({
        name: `${teamName} Player ${i + 1}`,
        runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, outType: 'Not Out',
      }));
    } else {
      knockoutMatch.innings1.bowlingTeam = teamName;
      knockoutMatch.innings1.bowling = Array.from({ length: knockoutMatch.playersPerTeam || 11 }, (_, i) => ({
        name: `${teamName} Player ${i + 1}`,
        runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, outType: 'Not Out',
      }));
    }
  }
};

// When a league group's matches are all complete, rank the group and fill the
// matching knockout TBD slots (sources are labelled "A1", "B2", … in liveState).
const tryAdvanceLeagueGroup = async (tournamentId, groupLetter) => {
  if (!tournamentId || !groupLetter) return;
  const Tournament = require('../models/Tournament');
  const tournament = await Tournament.findById(tournamentId).lean();
  if (!tournament || tournament.format !== 'league') return;
  if (!tournament.teamsAdvancePerGroup) return; // league-only, no knockout

  const groupIdx = groupLetter.charCodeAt(0) - 65;
  const groupTeams = (tournament.groups || [])[groupIdx];
  if (!groupTeams || groupTeams.length < 2) return;

  const groupMatches = await Match.find({
    tournament: tournamentId, stage: 'group', group: groupLetter,
  }).lean();
  if (groupMatches.length === 0) return;
  const allDone = groupMatches.every((m) => m.status === 'completed' || m.status === 'abandoned');
  if (!allDone) return;

  const standings = computeGroupStandings(groupMatches, groupTeams);
  // Map "A1", "A2" → team name for this group.
  const placement = {};
  standings.forEach((r, i) => { placement[`${groupLetter}${i + 1}`] = r.team; });

  // Fill every knockout match whose source label references this group.
  const knockouts = await Match.find({
    tournament: tournamentId, stage: 'knockout', status: 'scheduled',
  });
  for (const ko of knockouts) {
    const src = ko.liveState || {};
    let dirty = false;
    if (src.sourceA && placement[src.sourceA] && (!ko.teamA?.name || ko.teamA.name === 'TBD')) {
      await fillKnockoutSlot(ko, 'A', placement[src.sourceA]); dirty = true;
    }
    if (src.sourceB && placement[src.sourceB] && (!ko.teamB?.name || ko.teamB.name === 'TBD')) {
      await fillKnockoutSlot(ko, 'B', placement[src.sourceB]); dirty = true;
    }
    if (dirty) await ko.save();
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
