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

    // Return a saved scoring snapshot only if liveState actually holds one.
    // IMPORTANT: bracket (knockout/playoff) matches stash their source labels in
    // liveState ({ sourceA, sourceB }) — that is NOT scoring state and has no
    // teams. Returning it for a freshly-started bracket match handed the
    // scorecard an object with no teamA/teamB, so it showed "Team A"/"Team B".
    // Actual scoring progress is persisted in currentState + innings1/innings2 on
    // the match document, so falling through to the full match is always correct.
    const ls = match.liveState;
    const isScoringSnapshot = !!ls && (
      ls.currentState !== undefined || ls.innings1 !== undefined ||
      ls.teamA !== undefined || ls.striker !== undefined || ls.runs !== undefined
    );
    if (match.status === "in_progress" && isScoringSnapshot) {
        console.log(`Resuming match ${id} from saved liveState.`);
        res.json({ success: true, data: ls });
    } else {
        console.log(`Loading match ${id} document.`);
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

    // Propagate genuine team-NAME edits to the tournament. But if the two names
    // were simply swapped (batting/bowling first flipped), that's NOT a rename —
    // propagating it would merge two teams and drop one from the group. Detect a
    // pure swap and skip; propagateTeamNameToTournament also guards against
    // renaming onto an existing name as a final safety net.
    if (existingMatch.tournament) {
      const oldA = existingMatch.teamA?.name;
      const oldB = existingMatch.teamB?.name;
      const isSwap = teamA && teamB && oldA && oldB &&
        teamA.name === oldB && teamB.name === oldA;
      if (!isSwap) {
        if (teamA && oldA && teamA.name !== oldA) {
          propagateTeamNameToTournament(existingMatch.tournament, oldA, teamA.name).catch(e =>
            console.error('Tournament propagation error (teamA):', e.message)
          );
        }
        if (teamB && oldB && teamB.name !== oldB) {
          propagateTeamNameToTournament(existingMatch.tournament, oldB, teamB.name).catch(e =>
            console.error('Tournament propagation error (teamB):', e.message)
          );
        }
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
    const { innings1, innings2, result, matchSummary, teamA, teamB, superOver } = req.body;

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
    if (superOver) match.superOver = superOver;

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

    // Qualifier playoffs: the LOSER also advances (Qualifier 1 loser → Qualifier 2).
    if (match.loserNextMatchId && match.matchSummary?.winner) {
      const w = match.matchSummary.winner;
      const loserName = match.teamA?.name === w ? match.teamB?.name : match.teamA?.name;
      if (loserName && loserName !== 'TBD') {
        propagateKnockoutWinner(match.loserNextMatchId, match.loserNextMatchSlot, loserName)
          .catch(e => console.error('Qualifier loser propagation error:', e.message));
      }
    }

    // League group stage: if this match was a group match and its group is now
    // fully complete, rank the group and populate the knockout TBD slots.
    if (match.tournament && match.stage === 'group') {
      tryAdvanceLeagueGroup(match.tournament, match.group)
        .catch(e => console.error('League group-advance error:', e.message));
      // Merit-seeded qualifier playoffs are filled once ALL groups finish
      // (needs a cross-group ranking of the qualifiers).
      tryAdvanceQualifierSeeds(match.tournament)
        .catch(e => console.error('Qualifier seed-advance error:', e.message));
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
  // Never touch a match that has already started/finished — filling a slot
  // rebuilds the innings roster, which would wipe a played match's scores.
  if (knockoutMatch.status !== 'scheduled') return;
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

// Merit-seeded qualifier playoff fill. Runs when EVERY group is complete: ranks
// all qualifiers across groups into seeds S1..SM and fills the bracket's seed
// slots. Ranking: finishing position first (all group winners above all
// runners-up, etc.), then points, NRR and wins — so byes/easier draws go by
// record, never by group letter. Only for league tournaments in 'qualifier'
// format (their bracket sources are "S1".."SM").
const tryAdvanceQualifierSeeds = async (tournamentId) => {
  if (!tournamentId) return;
  const Tournament = require('../models/Tournament');
  const tournament = await Tournament.findById(tournamentId).lean();
  if (!tournament || tournament.format !== 'league') return;
  if (tournament.playoffFormat !== 'qualifier' || !tournament.teamsAdvancePerGroup) return;

  const groups = tournament.groups || [];
  if (!groups.length) return;

  const groupMatches = await Match.find({ tournament: tournamentId, stage: 'group' }).lean();
  if (!groupMatches.length) return;
  // Need every group's fixtures finished before a cross-group ranking is valid.
  const allDone = groupMatches.every((m) => m.status === 'completed' || m.status === 'abandoned');
  if (!allDone) return;

  // Collect the qualifiers (top N of each group) with their group-stage record.
  const quals = [];
  groups.forEach((teams, gi) => {
    if (!teams || teams.length < 2) return;
    const gl = String.fromCharCode(65 + gi);
    const gms = groupMatches.filter((m) => m.group === gl);
    const standings = computeGroupStandings(gms, teams);
    standings.slice(0, tournament.teamsAdvancePerGroup).forEach((r, pos) => {
      quals.push({ team: r.team, position: pos + 1, points: r.points || 0, nrr: r.nrr || 0, won: r.won || 0 });
    });
  });
  if (!quals.length) return;

  // Seed by tier (position) first, then merit within the tier.
  quals.sort((a, b) =>
    (a.position - b.position) ||
    (b.points - a.points) ||
    (b.nrr - a.nrr) ||
    (b.won - a.won));
  const seedTeam = {};
  quals.forEach((q, i) => { seedTeam[`S${i + 1}`] = q.team; });

  // Fill any scheduled knockout slot whose source is a seed label.
  const knockouts = await Match.find({
    tournament: tournamentId, stage: 'knockout', status: 'scheduled',
  });
  for (const ko of knockouts) {
    const src = ko.liveState || {};
    let dirty = false;
    if (src.sourceA && seedTeam[src.sourceA] && (!ko.teamA?.name || ko.teamA.name === 'TBD')) {
      await fillKnockoutSlot(ko, 'A', seedTeam[src.sourceA]); dirty = true;
    }
    if (src.sourceB && seedTeam[src.sourceB] && (!ko.teamB?.name || ko.teamB.name === 'TBD')) {
      await fillKnockoutSlot(ko, 'B', seedTeam[src.sourceB]); dirty = true;
    }
    if (dirty) await ko.save();
  }
};

// PATCH /matches/:id/rename-player
// body: { teamName, oldName, newName }
// Rename a player across a match's stored scorecard (batting, bowling, fall of
// wickets, over history) so tournament stats/rosters — which aggregate by name —
// stay correct. Owner-only (the match scorer, or the tournament owner). Enforces
// unique names within the team.
exports.renamePlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const teamName = (req.body?.teamName || '').trim();
    const oldName = (req.body?.oldName || '').trim();
    const newName = (req.body?.newName || '').trim();
    const playerType = req.body?.playerType === 'bowler' ? 'bowler' : 'batsman';
    // merge=true means "this row is actually an existing bowler" → combine the
    // two bowler rows instead of rejecting the duplicate name. Only valid for
    // bowlers (a batsman can't bat twice, so their names stay unique).
    const merge = req.body?.merge === true && playerType === 'bowler';
    if (!teamName || !oldName || !newName) {
      return res.status(400).json({ success: false, error: "teamName, oldName and newName are required" });
    }

    const match = await Match.findById(id);
    if (!match) return res.status(404).json({ success: false, error: "Match not found" });

    // Owner check: the match scorer, or the tournament owner.
    let isOwner = String(match.user) === req.user.id;
    if (!isOwner && match.tournament) {
      const Tournament = require('../models/Tournament');
      const t = await Tournament.findById(match.tournament).select('user').lean();
      if (t && String(t.user) === req.user.id) isOwner = true;
    }
    if (!isOwner) return res.status(403).json({ success: false, error: "Only the scorer can rename players." });

    const eq = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
    const innings = [match.innings1, match.innings2].filter(Boolean);

    // Uniqueness within the SAME role: two batsmen (or two bowlers) can't share a
    // name (their stats would merge). A batsman & bowler sharing a name is fine —
    // that's one all-rounder — so we only check the role being renamed.
    const clash = innings.some((inn) => {
      const roleArr = playerType === 'bowler'
        ? (inn.bowlingTeam === teamName ? (inn.bowling || []) : [])
        : (inn.battingTeam === teamName ? (inn.batting || []) : []);
      return roleArr.some((p) => eq(p?.name, newName) && !eq(p?.name, oldName));
    });

    // A name clash is normally rejected. For a bowler MERGE, it's expected: the
    // scorer is saying "these two rows are the same person" → combine their
    // figures, reattribute the over history, and drop the now-duplicate row.
    if (clash && merge) {
      const bpo = match.ballsPerOver || 6;
      const oversToBalls = (o) => {
        const [ov, b] = String(o ?? '0.0').split('.').map(Number);
        return (ov || 0) * bpo + (b || 0);
      };
      const ballsToOvers = (n) => `${Math.floor(n / bpo)}.${n % bpo}`;

      // A bowler can't bowl consecutive overs — so a merge that would give the
      // same bowler two back-to-back overs is a real-world impossibility. Reject
      // it (this also caps a bowler at ~half the innings' overs).
      const overNumsFor = (name) => {
        const nums = [];
        innings.forEach((inn) => {
          if (inn.bowlingTeam !== teamName) return;
          (inn.overHistory || []).forEach((o) => {
            if (eq(o.bowlerName, name) && o.overNumber != null) nums.push(o.overNumber);
          });
        });
        return nums;
      };
      const mergedNums = [...overNumsFor(oldName), ...overNumsFor(newName)].sort((a, b) => a - b);
      for (let i = 1; i < mergedNums.length; i++) {
        if (mergedNums[i] - mergedNums[i - 1] === 1) {
          return res.status(409).json({
            success: false,
            error: `A bowler can't bowl consecutive overs — this would make ${newName} bowl over ${mergedNums[i - 1]} and over ${mergedNums[i]} back-to-back.`,
          });
        }
      }

      let merged = false;
      innings.forEach((inn) => {
        if (inn.bowlingTeam !== teamName) return;
        const arr = inn.bowling || [];
        const target = arr.find((b) => eq(b.name, newName) && !eq(b.name, oldName));
        const source = arr.find((b) => eq(b.name, oldName));
        if (!target || !source) return;
        target.overs = ballsToOvers(oversToBalls(target.overs) + oversToBalls(source.overs));
        target.runs = (target.runs || 0) + (source.runs || 0);
        target.wickets = (target.wickets || 0) + (source.wickets || 0);
        target.maidens = (target.maidens || 0) + (source.maidens || 0);
        (inn.overHistory || []).forEach((o) => { if (eq(o.bowlerName, oldName)) o.bowlerName = newName; });
        inn.bowling = arr.filter((b) => b !== source);
        merged = true;
      });
      if (!merged) {
        return res.status(404).json({ success: false, error: "Couldn't find both bowlers to merge." });
      }
      match.markModified('innings1');
      match.markModified('innings2');
      await match.save();
      return res.json({ success: true, merged: true, data: { teamName, oldName, newName } });
    }

    if (clash) {
      return res.status(409).json({ success: false, error: "That name is already used by another player in this team." });
    }

    // Apply the rename everywhere the name appears for this team.
    let changed = false;
    innings.forEach((inn) => {
      if (inn.battingTeam === teamName) {
        (inn.batting || []).forEach((b) => { if (eq(b.name, oldName)) { b.name = newName; changed = true; } });
        (inn.fallOfWickets || []).forEach((f) => { if (eq(f.batsman, oldName)) { f.batsman = newName; changed = true; } });
      }
      if (inn.bowlingTeam === teamName) {
        (inn.bowling || []).forEach((b) => { if (eq(b.name, oldName)) { b.name = newName; changed = true; } });
        (inn.overHistory || []).forEach((o) => { if (eq(o.bowlerName, oldName)) { o.bowlerName = newName; changed = true; } });
      }
    });
    if (!changed) {
      return res.status(404).json({ success: false, error: "That player wasn't found in this team's scorecard." });
    }

    match.markModified('innings1');
    match.markModified('innings2');
    await match.save();
    return res.json({ success: true, data: { teamName, oldName, newName } });
  } catch (error) {
    console.error("Rename player error:", error);
    res.status(500).json({ success: false, error: "Failed to rename the player." });
  }
};

// Rename a TEAM across this match's scorecard (owner only). Updates teamA/teamB,
// every innings' batting/bowling team, the result string and the winner. Does
// not touch the tournament — this is a match-level fix for a mis-typed team name.
exports.renameMatchTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const oldName = (req.body?.oldName || '').trim();
    const newName = (req.body?.newName || '').trim();
    if (!oldName || !newName) {
      return res.status(400).json({ success: false, error: "oldName and newName are required" });
    }

    const match = await Match.findById(id);
    if (!match) return res.status(404).json({ success: false, error: "Match not found" });

    // Owner check: the match scorer, or the tournament owner.
    let isOwner = String(match.user) === req.user.id;
    if (!isOwner && match.tournament) {
      const Tournament = require('../models/Tournament');
      const t = await Tournament.findById(match.tournament).select('user').lean();
      if (t && String(t.user) === req.user.id) isOwner = true;
    }
    if (!isOwner) return res.status(403).json({ success: false, error: "Only the scorer can rename teams." });

    const eq = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

    // The other team can't share the new name.
    const otherName = eq(match.teamA?.name, oldName) ? match.teamB?.name
      : eq(match.teamB?.name, oldName) ? match.teamA?.name : null;
    if (otherName && eq(otherName, newName)) {
      return res.status(409).json({ success: false, error: "Both teams can't have the same name." });
    }

    // Tournament match → propagate the rename across the WHOLE tournament: the
    // team list, the groups (points table), and every match (teams, innings,
    // result, winner). This keeps the same team consistent in the schedule,
    // standings and all scorecards — not just this one match.
    if (match.tournament) {
      const r = await propagateTeamNameToTournament(match.tournament, oldName, newName);
      if (r && r.skipped === 'name-already-exists') {
        return res.status(409).json({ success: false, error: "Another team in this tournament already uses that name." });
      }
      return res.json({ success: true, data: { oldName, newName }, tournamentWide: true });
    }

    const shortOf = (n) => (n || '').substring(0, 3).toUpperCase();
    let changed = false;
    ['teamA', 'teamB'].forEach((k) => {
      if (match[k] && eq(match[k].name, oldName)) {
        match[k].name = newName;
        match[k].shortName = shortOf(newName);
        changed = true;
      }
    });
    [match.innings1, match.innings2].filter(Boolean).forEach((inn) => {
      if (eq(inn.battingTeam, oldName)) { inn.battingTeam = newName; changed = true; }
      if (eq(inn.bowlingTeam, oldName)) { inn.bowlingTeam = newName; changed = true; }
    });
    if (match.result && match.result.includes(oldName)) {
      match.result = match.result.split(oldName).join(newName);
      changed = true;
    }
    if (match.matchSummary && eq(match.matchSummary.winner, oldName)) {
      match.matchSummary.winner = newName;
      changed = true;
    }
    if (!changed) {
      return res.status(404).json({ success: false, error: "That team wasn't found in this match." });
    }

    match.markModified('teamA');
    match.markModified('teamB');
    match.markModified('innings1');
    match.markModified('innings2');
    match.markModified('matchSummary');
    await match.save();
    return res.json({ success: true, data: { oldName, newName } });
  } catch (error) {
    console.error("Rename team error:", error);
    res.status(500).json({ success: false, error: "Failed to rename the team." });
  }
};

// Restore a prior scorecard snapshot (owner only) — powers the Undo button on
// the full scorecard, reverting the last rename/merge/team-rename. The client
// sends the exact fields it captured before the edit; we overwrite just those.
exports.restoreScorecard = async (req, res) => {
  try {
    const { id } = req.params;
    const match = await Match.findById(id);
    if (!match) return res.status(404).json({ success: false, error: "Match not found" });

    let isOwner = String(match.user) === req.user.id;
    if (!isOwner && match.tournament) {
      const Tournament = require('../models/Tournament');
      const t = await Tournament.findById(match.tournament).select('user').lean();
      if (t && String(t.user) === req.user.id) isOwner = true;
    }
    if (!isOwner) return res.status(403).json({ success: false, error: "Only the scorer can undo changes." });

    const b = req.body || {};
    if (b.innings1 !== undefined) { match.innings1 = b.innings1; match.markModified('innings1'); }
    if (b.innings2 !== undefined) { match.innings2 = b.innings2; match.markModified('innings2'); }
    if (b.teamA !== undefined) { match.teamA = b.teamA; match.markModified('teamA'); }
    if (b.teamB !== undefined) { match.teamB = b.teamB; match.markModified('teamB'); }
    if (b.result !== undefined) match.result = b.result;
    if (b.matchSummary !== undefined) { match.matchSummary = b.matchSummary; match.markModified('matchSummary'); }
    await match.save();
    return res.json({ success: true });
  } catch (error) {
    console.error("Restore scorecard error:", error);
    res.status(500).json({ success: false, error: "Failed to undo the change." });
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
  renamePlayer: exports.renamePlayer,
  renameMatchTeam: exports.renameMatchTeam,
  restoreScorecard: exports.restoreScorecard,
  deleteAllMatches: exports.deleteAllMatches,
  // Exposed so the tournament controller can re-fill knockout slots after the
  // playoff format is changed mid-tournament.
  tryAdvanceLeagueGroup,
  tryAdvanceQualifierSeeds,
};
