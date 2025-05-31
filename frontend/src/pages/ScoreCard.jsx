import React, { useState, useEffect, useRef } from 'react';
import { FiSettings, FiArrowLeft, FiRefreshCw } from 'react-icons/fi';
import { motion, AnimatePresence } from "framer-motion";
import './ScorecardPage.css';
import { useNavigate } from 'react-router-dom';
import io from "socket.io-client";
import API from '../api';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';


const socket = io("http://localhost:5000"); 

const ScorecardPage = ({ matchSettings, onMatchEnd, onShowFullScorecard }) => {
  
  const navigate = useNavigate();
  // Set default values based on matchSettings
  const [settings, setSettings] = useState({
    noBallRuns: 1,
    wideBallRuns: 1,
    ballsPerOver: 6,
    ...matchSettings
  });

  const matchCreatedRef = useRef(false);

  // Match state
  const [match, setMatch] = useState({
    _id: null,
    runs: 0,
    wickets: 0,
    balls: 0,
    extras: 0,
    wides: 0,
    noBalls: 0,
    byes: 0,
    legByes: 0,
    innings: 1,
    target: 0,
    isChasing: false,
    isComplete: false,
    fallOfWickets: [],
    battingTeam: matchSettings?.teamA || '',
    bowlingTeam: matchSettings?.teamB || '',

    // First innings summary (for second innings usage)
    firstInningsBattingTeam: null,
    firstInningsScore: 0,
    firstInningsBalls: 0,
    firstInningsExtras: 0,
    firstInningsWides: 0,
    firstInningsNoBalls: 0,
    firstInningsByes: 0,
    firstInningsLegByes: 0,
    firstInningsFOW: [],
  });

  

  const initialTeams = {
    teamA: {
      name: matchSettings.teamA,
      batsmen: Array.from({ length: matchSettings.playersPerTeam }, (_, i) => ({
        id: i + 1,
        name: `${matchSettings.teamA} Batsman ${i + 1}`,
        runs: 0,
        balls: 0,
        isOut: false,
        outType: '',
        isAvailable: true
      })),
      bowlers: matchSettings.teamABowlers || Array.from({ length: matchSettings.playersPerTeam }, (_, i) => ({
        id: i + 1,
        name: `${matchSettings.teamA} Bowler ${i + 1}`,
        spells: [], // Stores completed spells
        currentSpell: { // Initialize with empty spell instead of null
            runs: 0,
            wickets: 0,
            balls: 0,
            maidens: 0
          },
        previousSpells: []
      }))
    },
    teamB: {
      name: matchSettings.teamB,
      batsmen: Array.from({ length: matchSettings.playersPerTeam }, (_, i) => ({
        id: i + 1,
        name: `${matchSettings.teamB} Batsman ${i + 1}`,
        runs: 0,
        balls: 0,
        isOut: false,
        outType: '',
        isAvailable: true
      })),
      bowlers: matchSettings.teamBBowlers || Array.from({ length: matchSettings.playersPerTeam }, (_, i) => ({
        id: i + 1,
        name: `${matchSettings.teamB} Bowler ${i + 1}`,
        spells: [], // Stores completed spells
        currentSpell: { // Initialize with empty spell instead of null
            runs: 0,
            wickets: 0,
            balls: 0,
            maidens: 0
          },
        previousSpells: []
      }))
    }
  };

  const [currentPlayers, setCurrentPlayers] = useState({
    striker: null,
    nonStriker: null,
    bowler: null
  });
  
  // Initialize states
  const [teams, setTeams] = useState(initialTeams);
  const [players, setPlayers] = useState({
    striker: initialTeams.teamA.batsmen[0],
    nonStriker: initialTeams.teamA.batsmen[1],
    bowler: initialTeams.teamB.bowlers[0],
    nextBatsman: 3,
    nextBowler: 2,
    lastBowler: null
  });

  // UI state
  const [selectedAction, setSelectedAction] = useState(null);
  const [showModal, setShowModal] = useState(null);
  const [modalData, setModalData] = useState({});
  const [overHistory, setOverHistory] = useState([]);
  const [history, setHistory] = useState([]);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [matchId, setMatchId] = useState(null); // Generates a unique ID at match start
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  

  // Calculate derived values
  const runs = match?.runs ?? 0;
  const wickets = match?.wickets ?? 0;
  const balls = match?.balls ?? 0;

  const overs = `${Math.floor(balls / settings.ballsPerOver)}.${balls % settings.ballsPerOver}`;
  const crr = balls > 0 ? (runs / (balls / settings.ballsPerOver)).toFixed(2) : "0.00";
  const remainingBalls = (settings.overs * settings.ballsPerOver) - match.balls;
  const remainingRuns = match.target - match.runs;
  const requiredRunRate = remainingBalls > 0 ? (remainingRuns / (remainingBalls / settings.ballsPerOver)).toFixed(2) : '0.00';


  useEffect(() => {
  const createMatch = async () => {
    try {
      setIsLoading(true);

      const response = await axios.post("http://localhost:5000/api/matches", {
        // Team information
        teamA: {
          name: teams.teamA.name,
          shortName: teams.teamA.name.substring(0, 3).toUpperCase()
        },
        teamB: {
          name: teams.teamB.name,
          shortName: teams.teamB.name.substring(0, 3).toUpperCase()
        },

        // Match settings
        overs: settings.overs,
        ballsPerOver: settings.ballsPerOver,
        playersPerTeam: settings.playersPerTeam || 11,

        // Match state
        runs: 0,
        wickets: 0,
        balls: 0,
        innings: 1,

        // Default values
        venue: "Unknown Venue",
        matchType: "T20",
        status: "in_progress",
        toss: {
          winner: teams.teamA.name,
          decision: "bat"
        },
        matchSummary: {
          playerOfMatch: "",
          winner: ""
        },

        // Scoring data
        extras: {
          total: 0,
          wides: 0,
          noBalls: 0,
          byes: 0,
          legByes: 0
        },
        fallOfWickets: [],
        oversHistory: [],
        ballByBallData: []
      });

      const matchIdFromResponse = response.data?.data?._id || response.data?.data?.id;
      if (!matchIdFromResponse) throw new Error("No match ID in response");

      // Save match ID for future use (avoid duplicate creation)
      localStorage.setItem("currentMatchId", matchIdFromResponse);

      // Set state
      setMatch({
        ...response.data.data,
        runs: 0,
        wickets: 0,
        balls: 0,
        extras: response.data.data.extras || {
          wides: 0,
          noBalls: 0,
          byes: 0,
          legByes: 0
        }
      });
      setMatchId(matchIdFromResponse);
      console.log("✅ Match created with ID:", matchIdFromResponse);
    } catch (error) {
      console.error("❌ Failed to create match:", error);

      const newId = uuidv4();
      const fallbackMatch = {
        _id: newId,
        runs: 0,
        wickets: 0,
        balls: 0,
        extras: {
          wides: 0,
          noBalls: 0,
          byes: 0,
          legByes: 0
        },
        teamA: teams?.teamA,
        teamB: teams?.teamB,
        overs: settings?.overs,
        ballsPerOver: settings?.ballsPerOver,
        innings: 1,
        status: "in_progress"
      };

      setMatch(fallbackMatch);
      setMatchId(newId);
      localStorage.setItem("currentMatchId", newId);
      console.log("⚠️ Fallback match created with ID:", newId);
    } finally {
      setIsLoading(false);
    }
  };

  const savedMatchId = localStorage.getItem("currentMatchId");

  if (
    !matchCreatedRef.current &&
    !matchId &&
    !match?._id &&
    teams?.teamA?.name &&
    teams?.teamB?.name &&
    settings?.overs &&
    settings?.ballsPerOver
  ) {
    matchCreatedRef.current = true;

    if (savedMatchId) {
      // Reuse existing match
      setMatchId(savedMatchId);
      console.log("♻️ Reusing existing match ID from localStorage:", savedMatchId);
    } else {
      createMatch();
    }
  }
}, []);
 // ✅ Run only once on component mount


// In ScoreCard.jsx

// Ensure axios is imported:
// import axios from 'axios';

// Helper function to format batsmen for the update payload
// (similar to the one in endMatch, ensure it reflects current player stats)
const formatBatsmenForUpdate = (batsmenList = []) =>
  batsmenList.map(b => ({
    name: b.name,
    runs: b.runs || 0,
    balls: b.balls || 0,
    fours: b.fours || 0,   // Ensure this data exists in your 'teams' state objects
    sixes: b.sixes || 0,   // Ensure this data exists in your 'teams' state objects
    isOut: b.isOut || false,
    outType: b.outType || null, // Ensure outType is correctly set
    strikeRate: b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00",
    // id: b.id // Include player ID if your backend uses it to match/update players
  }));

// Helper function to format bowlers for the update payload
const formatBowlersForUpdate = (bowlersList = [], ballsPerOverSettings) => {
  return bowlersList.map(b => {
    // Consolidate all spells for current, up-to-the-ball stats
    const allSpells = [...(b.previousSpells || [])];
    if (b.currentSpell) { // Always include currentSpell, even if balls are 0 for a new bowler
      allSpells.push(b.currentSpell);
    }

    let totalBalls = 0;
    let totalRunsConceded = 0;
    let totalWicketsTaken = 0;
    let totalMaidens = 0;

    allSpells.forEach(spell => {
      totalBalls += spell.balls || 0;
      totalRunsConceded += spell.runs || 0;
      totalWicketsTaken += spell.wickets || 0;
      totalMaidens += spell.maidens || 0; // Ensure this is tracked and updated
    });

    return {
      name: b.name,
      overs: `${Math.floor(totalBalls / ballsPerOverSettings)}.${totalBalls % ballsPerOverSettings}`,
      runs: totalRunsConceded,
      wickets: totalWicketsTaken,
      maidens: totalMaidens,
      economyRate: totalBalls > 0
        ? ((totalRunsConceded / totalBalls) * ballsPerOverSettings).toFixed(2)
        : "0.00",
      // id: b.id, // Include player ID
      // Optionally, send detailed spells if backend is to store them live:
      // spells: b.previousSpells,
      // currentSpell: b.currentSpell,
    };
  });
};


const sendMatchUpdate = async () => {
  try {
    // Prioritize backend match ID from matchSettings
    const backendMatchId = matchSettings?._id || match?._id || matchId;

    if (!backendMatchId) {
      console.error("❌ Cannot update match - Backend Match ID is missing.");
      // Potentially queue update or notify user, but don't throw an error that breaks UI flow.
      return; // Or throw new Error("No Backend Match ID available for update");
    }

    // Determine active teams
    const currentInningsNumber = match.innings; // Should be 1 or 2
    let currentBattingTeamKey;
    let currentBowlingTeamKey;

    if (currentInningsNumber === 1) {
      // This depends on how you've set initial match.battingTeam and match.bowlingTeam
      // or derive from matchSettings.firstBatting
      const firstBattingName = matchSettings?.firstBatting || teams.teamA.name; // Default to teamA if not set
      currentBattingTeamKey = teams.teamA.name === firstBattingName ? 'teamA' : 'teamB';
      currentBowlingTeamKey = currentBattingTeamKey === 'teamA' ? 'teamB' : 'teamA';
    } else { // Innings 2
      // The team that batted first is now bowling, and vice-versa
      const firstInningsBattingName = match.firstInningsSummary?.teamName || (matchSettings?.firstBatting || teams.teamA.name);
      currentBattingTeamKey = teams.teamA.name === firstInningsBattingName ? 'teamB' : 'teamA'; // Opposite of 1st innings batter
      currentBowlingTeamKey = firstInningsBattingName === teams.teamA.name ? 'teamA' : 'teamB'; // The one that batted first
    }
    
    // Ensure keys are valid
    if (!teams[currentBattingTeamKey] || !teams[currentBowlingTeamKey]) {
        console.error("❌ Critical error: Could not determine current batting/bowling team keys for update.");
        return;
    }


    const inningsSpecificUpdate = {
      runs: match.runs || 0,
      wickets: match.wickets || 0,
      overs: match.balls // Calculate overs string based on match.balls and settings.ballsPerOver
        ? `${Math.floor(match.balls / settings.ballsPerOver)}.${match.balls % settings.ballsPerOver}`
        : "0.0",
      runRate: match.balls > 0 && settings.ballsPerOver > 0
        ? (match.runs / (match.balls / settings.ballsPerOver)).toFixed(2)
        : "0.00",
      extras: match.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
      fallOfWickets: match.fallOfWickets || [],
      batting: formatBatsmenForUpdate(teams[currentBattingTeamKey].batsmen),
      bowling: formatBowlersForUpdate(teams[currentBowlingTeamKey].bowlers, settings.ballsPerOver),
      oversHistory: overHistory || [], // Current over's ball-by-ball
      // ballByBallData: /* your detailed ballByBallData array if you track it */ [],
      target: currentInningsNumber === 2 ? match.target : null, // Target only for 2nd innings
    };

    const updatePayload = {
      status: match.isComplete ? "completed" : "in_progress",
      currentInningsNumber: currentInningsNumber,
      inningsUpdate: inningsSpecificUpdate,
      // You can also send top-level team names if they can change, though unlikely mid-match
      // teamA: { name: teams.teamA.name, shortName: teams.teamA.name.substring(0,3).toUpperCase()},
      // teamB: { name: teams.teamB.name, shortName: teams.teamB.name.substring(0,3).toUpperCase()},
    };

    // Add timestamp for the update (optional, backend 'updatedAt' is usually sufficient)
    // updatePayload.lastClientUpdate = new Date().toISOString();

    console.log(`🚀 Sending Match Update to backend for match ID: ${backendMatchId}`);
    // console.log("📦 Update Payload:", JSON.stringify(updatePayload, null, 2)); // For detailed logging

    const response = await axios.put(
      `http://localhost:5000/api/matches/${backendMatchId}`,
      updatePayload, // Send the structured payload
      {
        timeout: 7000, // Increased timeout slightly
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log("✅ Match updated successfully on server:", response.data.message);
    // Emit to socket if this client is also a source of truth for other passive viewers
    // socket.emit('update-score', { matchId: backendMatchId, data: updatePayload }); // Or a subset of it

    return response.data;

  } catch (error) {
    console.error("❌ Error sending match update to server:", {
      message: error.message,
      response: error.response?.data,
      // config: error.config // Can be verbose
    });
    // Implement more robust error handling:
    // - Retry logic (e.g., with exponential backoff)
    // - Queue updates locally if offline and sync when back online
    // - Notify user of sync issues if persistent
    // For now, re-throw if you want calling code to potentially handle it or display a generic error.
    // throw error; 
    return null; // Or handle error silently to not break UI flow
  }
};



  // 2. Socket integration
  useEffect(() => {
  const onConnect = () => {
    console.log("✅ Connected to socket server");
    if (match?._id) {
      socket.emit("join-match", match._id);
    }
  };

  const onDisconnect = () => {
    console.log("❌ Disconnected from socket server");
  };

  const onScoreUpdated = (updatedMatch) => {
    console.log("Received match update:", updatedMatch);
    setMatch(prev => ({
      ...prev,
      ...updatedMatch
    }));
  };

  socket.on("connect", onConnect);
  socket.on("disconnect", onDisconnect);
  socket.on("score-updated", onScoreUpdated);

  return () => {
    socket.off("connect", onConnect);
    socket.off("disconnect", onDisconnect);
    socket.off("score-updated", onScoreUpdated);
    socket.disconnect();
  };
}, [match?._id]);





  // Save current state for undo
  const saveState = () => {
    setHistory(prev => [...prev, {
      match: {...match},
      players: {...players},
      teams: JSON.parse(JSON.stringify(teams)), // Deep clone
      overHistory: [...overHistory]
    }].slice(-10));
  };

  // Undo functionality
  const handleUndo = () => {
    if (history.length === 0) return;
    
    const previousState = history[history.length - 1];
    setMatch(previousState.match);
    setPlayers(previousState.players);
    setTeams(previousState.teams);
    setOverHistory(previousState.overHistory);
    setHistory(history.slice(0, -1));
    setSelectedAction(null);
  };
  
  const replaceBatsman = (outBatsmanId, isRetirement = false) => {
    const currentBattingTeam = match.innings === 1 ? 'teamA' : 'teamB';
    
    // Find all available batsmen (not out and not at crease)
    const availableBatsmen = teams[currentBattingTeam].batsmen.filter(
      batsman => !batsman.isOut && 
                batsman.id !== players.striker.id && 
                batsman.id !== players.nonStriker.id
    );
  
    // First preference to non-retired batsmen
    let nextBatsman = availableBatsmen.find(b => b.outType !== 'Retired');
  
    // If no non-retired batsmen left, allow retired to return
    if (!nextBatsman && isRetirement) {
      nextBatsman = availableBatsmen[0];
    }
  
    return nextBatsman || null;
  };

  // Handle action selection
  const handleActionClick = (action) => {
    setSelectedAction(action);
    
    if (['WD', 'NB', 'BYE', 'OUT', '5,7..', 'Retire'].includes(action)) {
      setShowModal(action);
      setModalData({});
    } else if (['0', '1', '2', '3', '4', '6'].includes(action)) {
      handleRuns(parseInt(action));
    }
  };

  // Handle runs scoring
  const handleRuns = (runs) => {
    saveState();

    const currentBowlingTeam = match.innings === 1 ? 'teamB' : 'teamA';
    const currentBowlerId = players.bowler.id;

    /// Update match state
    setMatch(prev => ({
      ...prev,
      runs: prev.runs + runs,
      balls: prev.balls + 1,
      _id: prev._id || matchId, // Use MongoDB's _id field
    }));


    // Update bowler stats
    updateBowlerStats(runs);

    // Update batsmen
    setPlayers(prev => {
      const newStriker = { 
        ...prev.striker, 
        runs: prev.striker.runs + runs,
        balls: prev.striker.balls + 1
      };
      
      // Rotate strike for odd runs
      if ([1, 3].includes(runs)) {
        return {
          ...prev,
          striker: prev.nonStriker,
          nonStriker: newStriker
        };
      } else {
        return {
          ...prev,
          striker: newStriker
        };
      }
    });

    // Update over history
    setOverHistory(prev => {
      const updated = [...prev, runs.toString()];
      return updated.length > settings.ballsPerOver ? updated.slice(1) : updated;
    });

    setSelectedAction(null);
    sendMatchUpdate();
  };

  // When over completes, save spell
  const onOverComplete = () => {
    const currentBowlingTeam = match.innings === 1 ? 'teamB' : 'teamA';
    const currentBowlerId = players.bowler.id;
    
    // Save current spell before resetting
    setTeams(prevTeams => {
      const updatedTeams = {
        ...prevTeams,
        [currentBowlingTeam]: {
          ...prevTeams[currentBowlingTeam],
          bowlers: prevTeams[currentBowlingTeam].bowlers.map(bowler => {
            if (bowler.id !== currentBowlerId) return bowler;
            
            return {
              ...bowler,
              previousSpells: [
                ...(bowler.previousSpells || []),
                {
                  ...bowler.currentSpell,
                  overs: `${Math.floor(bowler.currentSpell.balls / 6)}.${bowler.currentSpell.balls % 6}`
                }
              ],
              currentSpell: {
                runs: 0,
                wickets: 0,
                balls: 0,
                maidens: 0
              }
            };
          })
        }
      };
      return updatedTeams;
    });
  
    // Rotate bowlers automatically
    const currentBowlers = teams[currentBowlingTeam].bowlers;
    const currentIndex = currentBowlers.findIndex(b => b.id === currentBowlerId);
    const nextBowlerIndex = (currentIndex + 1) % currentBowlers.length;
    const nextBowler = currentBowlers[nextBowlerIndex];
    
    setPlayers(prev => ({
      ...prev,
      bowler: nextBowler,
      lastBowler: currentBowlerId
    }));
  
    // Reset over history
    setOverHistory([]);
  };

  const getNextBatsman = (battingTeamKey, nonStrikerId, teamsData) => {
    return teamsData[battingTeamKey].batsmen.find(b =>
      !b.isOut && b.id !== nonStrikerId
    );
  };
  

  // Handle wicket
  // In ScoreCard.jsx

const handleWicket = (outType) => {
  saveState();

  const currentBowlingTeamKey = match.innings === 1 ? 'teamB' : 'teamA';
  const currentBattingTeamKey = match.innings === 1 ? 'teamA' : 'teamB';
  // const currentBowlerId = players.bowler.id; // Not directly used for FOW object, but for bowler stats

  // Update bowler stats for wicket-taking dismissals (if not already handled elsewhere for each ball)
  // This logic might be part of your updateBowlerStats or a more general ball processing function.
  // For simplicity, if a wicket is directly attributed to bowler (Bowled, Caught by non-fielder, LBW, Stumped, Hit Wicket):
  if (['Bowled', 'Caught', 'LBW', 'Stumped', 'Hit Wicket'].includes(outType)) {
    updateBowlerStats(0, true, true); // 0 runs, 1 wicket, 1 ball counted
  } else {
    // For Run Out or other non-bowler wickets, ball is still counted if it was a legal delivery
    // This depends on if the run out happened off a no-ball/wide or a legal delivery.
    // Assuming it's a legal delivery for now.
    updateBowlerStats(0, false, true); // 0 runs, 0 wickets to bowler, 1 ball counted
  }


  // Update match state: increment wickets and balls
  setMatch(prev => {
    const updatedBalls = prev.balls + 1; // Wicket always consumes a ball unless it's between overs or very specific run-out scenarios
    const totalOversString = `${Math.floor(updatedBalls / settings.ballsPerOver)}.${updatedBalls % settings.ballsPerOver}`;
    const newTotalTeamWickets = prev.wickets + 1;

    return {
      ...prev,
      wickets: newTotalTeamWickets, // This is the team's total wickets fallen
      balls: updatedBalls,
      _id: prev._id || matchId,
      fallOfWickets: [
        ...(prev.fallOfWickets || []),
        {
          batsman: players.striker?.name || "Unknown Batsman",
          score: prev.runs, // Current team score
          over: totalOversString,
          wicket: newTotalTeamWickets, // THIS IS THE FIX: Add the wicket number (1st, 2nd, etc.)
          // outType: outType, // Optional: store how the batsman got out in FOW entry too
          // bowler: ['Bowled', 'Caught', 'LBW', 'Stumped', 'Hit Wicket'].includes(outType) ? players.bowler.name : undefined // Optional
        }
      ]
    };
  });

  // Mark striker as out
  setTeams(prevTeams => ({
    ...prevTeams,
    [currentBattingTeamKey]: {
      ...prevTeams[currentBattingTeamKey],
      batsmen: prevTeams[currentBattingTeamKey].batsmen.map(batsman =>
        batsman.id === players.striker.id
          ? { ...batsman, isOut: true, outType: outType, balls: batsman.balls + 1 } // Also increment ball for the batsman
          : batsman
      )
    }
  }));

  // Replace batsman if not all out
  if (match.wickets < settings.playersPerTeam - 1) {
    const allBatsmenInTeam = teams[currentBattingTeamKey].batsmen;
    // Find next available batsman (not out, not retired, and not the non-striker)
    let nextBatsman = allBatsmenInTeam.find(
      b => !b.isOut && b.id !== players.nonStriker.id && b.id !== players.striker.id && b.outType !== 'Retired'
    );
    // If no non-retired available, check if any retired can come back (more complex logic usually)
    // For now, just take the first available one if no non-retired.
    if (!nextBatsman) {
        nextBatsman = allBatsmenInTeam.find(
            b => !b.isOut && b.id !== players.nonStriker.id && b.id !== players.striker.id
        );
    }


    if (nextBatsman) {
      setPlayers(prev => ({
        ...prev,
        striker: nextBatsman,
        // Non-striker remains, strike doesn't change unless specified by out-type (e.g. caught crossing)
        // For simplicity, not handling strike rotation on wicket here, can be added.
      }));
    } else {
      // All out or no more batsmen available
      console.log("All out or no more batsmen available for " + currentBattingTeamKey);
      // endInnings(); // This would be called by the useEffect that checks for all out
    }
  } else {
    // All out (10th wicket or max players reached)
     console.log("All out for " + currentBattingTeamKey);
    // endInnings(); // This would be called by the useEffect
  }

  setOverHistory(prev => {
    const updatedOverHistory = [...prev, `W ${outType.substring(0,3)}`]; // e.g., W Cau, W Bow
    // No slice here, let useEffect handle over completion for overHistory reset
    return updatedOverHistory;
  });

  setShowModal(null);
  setSelectedAction(null);
  sendMatchUpdate(); // Send update to backend
};

  
  
  
  useEffect(() => {
    if (
      match.balls > 0 &&
      match.balls % settings.ballsPerOver === 0
    ) {
      onOverComplete();
  
      // Rotate strike
      setPlayers(prev => ({
        ...prev,
        striker: prev.nonStriker,
        nonStriker: prev.striker
      }));
    }
  }, [match.balls, settings.ballsPerOver]);
  

  // Handle extras
  const handleExtras = (type, runs = 0) => {
    saveState();
    
    const extraRuns = type === 'WD' || type === 'NB' ? runs + settings.wideBallRuns : runs;
    const countBall = type !== 'WD' && type !== 'NB';
    
    setMatch(prev => {
      const extrasKey = type === 'WD'
        ? 'wides'
        : type === 'NB'
        ? 'noBalls'
        : type === 'BYE'
        ? 'byes'
        : 'legByes';

      return {
        ...prev,
        _id: prev._id || matchId,  // Use MongoDB _id
        runs: prev.runs + extraRuns,
        balls: countBall ? prev.balls + 1 : prev.balls,
        extras: {
          ...prev.extras,
          [extrasKey]: (prev.extras?.[extrasKey] || 0) + extraRuns
        }
      };
    });


    setPlayers(prev => ({
      ...prev,
      bowler: {
        ...prev.bowler,
        runs: prev.bowler.runs + extraRuns,
        balls: countBall ? prev.bowler.balls + 1 : prev.bowler.balls
      }
    }));

    setOverHistory(prev => {
      const updated = [...prev, type + (runs > 0 ? `+${runs}` : '')];
      return updated.length > settings.ballsPerOver ? updated.slice(1) : updated;
    });

    setShowModal(null);
    setSelectedAction(null);
    sendMatchUpdate();
  };

  // Handle retire
  const handleRetire = (type, batter) => {
    saveState();
    const currentBattingTeam = match.innings === 1 ? 'teamA' : 'teamB';
    const retiringBatsmanId = batter === 'Striker' ? players.striker.id : players.nonStriker.id;
    const currentBallInOver = (match.balls % settings.ballsPerOver) + 1;
  
    // Update teams state to mark as retired
    setTeams(prevTeams => ({
      ...prevTeams,
      [currentBattingTeam]: {
        ...prevTeams[currentBattingTeam],
        batsmen: prevTeams[currentBattingTeam].batsmen.map(batsman => 
          batsman.id === retiringBatsmanId ? { 
            ...batsman, 
            isOut: type === 'Retired Out', // Only true for Retired Out
            outType: type
          } : batsman
        )
      }
    }));
  
    // For Retired Out, treat similar to wicket
    if (type === 'Retired Out') {
      handleWicket('Retired Out');
      return;
    }
  
    // For normal retirement, replace the batsman
    const availableBatsmen = teams[currentBattingTeam].batsmen.filter(
      batsman => !batsman.isOut && 
                batsman.id !== players.striker.id && 
                batsman.id !== players.nonStriker.id
    );
  
    // First try to find non-retired batsmen
    let nextBatsman = availableBatsmen.find(b => b.outType !== 'Retired');
  
    // If all non-retired are out, then allow retired batsmen to return
    if (!nextBatsman) {
      nextBatsman = availableBatsmen[0];
    }
  
    if (nextBatsman) {
      setPlayers(prev => {
        if (batter === 'Striker') {
          return {
            ...prev,
            striker: nextBatsman,
            nextBatsman: Math.max(...teams[currentBattingTeam].batsmen.map(b => b.id)) + 1
          };
        } else {
          return {
            ...prev,
            nonStriker: nextBatsman,
            nextBatsman: Math.max(...teams[currentBattingTeam].batsmen.map(b => b.id)) + 1
          };
        }
      });
    }
  
    setShowModal(null);
    setSelectedAction(null);
    sendMatchUpdate();
  };

  const getAvailableBatsmen = () => {
    const currentBattingTeam = match.innings === 1 ? 'teamA' : 'teamB';
    return teams[currentBattingTeam].batsmen.filter(
      batsman => !batsman.isOut && 
                batsman.id !== players.striker.id && 
                batsman.id !== players.nonStriker.id
    );
  };

    // 2. Update bowler stats in real-time (after every ball)
    const updateBowlerStats = (runs = 0, isWicket = false, countBall = true) => {
      const currentBowlingTeam = match.innings === 1 ? 'teamB' : 'teamA';
      const bowlerId = players.bowler.id;
    
      setTeams(prevTeams => ({
        ...prevTeams,
        [currentBowlingTeam]: {
          ...prevTeams[currentBowlingTeam],
          bowlers: prevTeams[currentBowlingTeam].bowlers.map(bowler =>
            bowler.id === bowlerId
              ? {
                  ...bowler,
                  currentSpell: {
                    ...bowler.currentSpell,
                    runs: bowler.currentSpell.runs + runs,
                    wickets: isWicket ? bowler.currentSpell.wickets + 1 : bowler.currentSpell.wickets,
                    balls: countBall ? bowler.currentSpell.balls + 1 : bowler.currentSpell.balls
                  }
                }
              : bowler
          )
        }
      }));
    };
    

  // Handle bowler change
  const handleBowlerChange = (newBowlerId) => {
    const currentBowlingTeam = match.innings === 1 ? 'teamB' : 'teamA';
    
    setTeams(prevTeams => {
      const currentBowlerId = players.bowler.id;
      
      return {
        ...prevTeams,
        [currentBowlingTeam]: {
          ...prevTeams[currentBowlingTeam],
          bowlers: prevTeams[currentBowlingTeam].bowlers.map(bowler => {
            // Complete current bowler's spell
            if (bowler.id === currentBowlerId) {
              return {
                ...bowler,
                spells: [...bowler.spells, bowler.currentSpell],
                currentSpell: { runs: 0, wickets: 0, balls: 0, maidens: 0 }
              };
            }
            // Initialize new bowler's spell
            if (bowler.id === newBowlerId) {
              return {
                ...bowler,
                currentSpell: { runs: 0, wickets: 0, balls: 0, maidens: 0 }
              };
            }
            return bowler;
          })
        }
      };
    });
  
    // Update current bowler reference
    const newBowler = teams[currentBowlingTeam].bowlers.find(b => b.id === newBowlerId);
    setPlayers(prev => ({
      ...prev,
      bowler: newBowler
    }));
    sendMatchUpdate();
  };

  const endInnings = () => {
    if (match.innings === 1) {
      startSecondInnings();
    } else {
      endMatch();
    }
  };
  
  // Handle OK button
  const handleOK = () => {
    if (!selectedAction && !showModal) return;

    if (showModal) {
      switch (showModal) {
        case 'WD':
        case 'NB':
          if (modalData.value !== undefined) {
            handleExtras(showModal, modalData.value);
          }
          break;
        case 'OUT':
          if (modalData.value) {
            handleWicket(modalData.value);
          }
          break;
        case 'Retire':
          if (modalData.type && modalData.batter) {
            handleRetire(modalData.type, modalData.batter);
          }
          break;
        case '5,7..':
          if (modalData.value !== undefined) {
            handleRuns(modalData.value);
          }
          break;
        case 'BYE':
          if (modalData.value !== undefined) {
            handleExtras(showModal, modalData.value);
          }
          break;
        default:
          break;
      }
    } else if (selectedAction) {
      if (['0', '1', '2', '3', '4', '6'].includes(selectedAction)) {
        handleRuns(parseInt(selectedAction));
      }
    }
    
    setShowModal(null);
    setSelectedAction(null);
    setModalData({});
  };

  // Check if over is complete
  useEffect(() => {
    const isOverCompleted =
      match.balls > 0 &&
      match.balls % settings.ballsPerOver === 0 &&
      !showModal;
  
    if (isOverCompleted) {
      // Clear over history and rotate strike
      setOverHistory([]);
      setPlayers(prev => ({
        ...prev,
        striker: prev.nonStriker,
        nonStriker: prev.striker
      }));
    }
  }, [match.balls, settings.ballsPerOver, showModal]);
  

  // Check if innings should end
  useEffect(() => {
    const isInningsOver =
      match.wickets >= settings.playersPerTeam - 1 ||
      match.balls >= settings.overs * settings.ballsPerOver;
  
    // If chasing and target is reached
    if (match.isChasing && match.runs >= match.target) {
      endMatch();
      navigate('/full-scorecard');
      return;
    }
  
    if (isInningsOver) {
      if (match.innings === 1) {
        startSecondInnings();
      } else {
        endMatch();
        navigate('/full-scorecard');
      }
    }
  }, [match.runs, match.wickets, match.balls, match.innings, match.isChasing, match.target, settings.playersPerTeam, settings.overs, settings.ballsPerOver]);
  
  

const startSecondInnings = () => {
  console.log("🔄 Starting second innings setup...");

  // Determine teams for the first innings (who just finished batting)
  // This relies on match.battingTeam and match.bowlingTeam being correctly set for innings 1.
  // Or, if match.battingTeam isn't reliable here, use matchSettings.firstBatting.
  const firstInningsActualBattingTeamName = match.battingTeam || (matchSettings?.firstBatting || teams.teamA.name);
  const firstInningsActualBowlingTeamName = match.bowlingTeam || (firstInningsActualBattingTeamName === teams.teamA.name ? teams.teamB.name : teams.teamA.name);

  const firstInningsBattingTeamKey = teams.teamA.name === firstInningsActualBattingTeamName ? 'teamA' : 'teamB';
  const firstInningsBowlingTeamKey = teams.teamB.name === firstInningsActualBowlingTeamName ? 'teamB' : 'teamA';

  // Ensure keys are valid before proceeding
  if (!teams[firstInningsBattingTeamKey] || !teams[firstInningsBowlingTeamKey]) {
    console.error("❌ Critical error in startSecondInnings: Cannot determine team keys for first innings summary.");
    // Potentially show an error to the user or prevent proceeding
    return;
  }
  
  // Use the formatBatsmen and formatBowlers helpers defined for endMatch
  // Ensure these helpers are accessible here.
  const formatBatsmenForSummary = (batsmenList) =>
    batsmenList.map(b => ({
      name: b.name,
      runs: b.runs || 0,
      balls: b.balls || 0,
      fours: b.fours || 0,
      sixes: b.sixes || 0,
      isOut: b.isOut || false,
      outType: b.outType || '',
      strikeRate: b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00",
    }));

  const formatBowlersForSummary = (bowlersList) => {
    return bowlersList.map(b => {
      const allSpells = [...(b.previousSpells || [])];
      if (b.currentSpell && b.currentSpell.balls > 0) {
        allSpells.push(b.currentSpell);
      }
      let totalBalls = 0, totalRunsConceded = 0, totalWicketsTaken = 0, totalMaidens = 0;
      allSpells.forEach(spell => {
        totalBalls += spell.balls || 0;
        totalRunsConceded += spell.runs || 0;
        totalWicketsTaken += spell.wickets || 0;
        totalMaidens += spell.maidens || 0;
      });
      return {
        name: b.name,
        overs: `${Math.floor(totalBalls / settings.ballsPerOver)}.${totalBalls % settings.ballsPerOver}`,
        runs: totalRunsConceded,
        wickets: totalWicketsTaken,
        maidens: totalMaidens,
        economyRate: totalBalls > 0 ? ((totalRunsConceded / totalBalls) * settings.ballsPerOver).toFixed(2) : "0.00",
      };
    });
  };


  const innings1CompleteSummary = {
    teamName: teams[firstInningsBattingTeamKey].name,
    batting: formatBatsmenForSummary(teams[firstInningsBattingTeamKey].batsmen),
    bowling: formatBowlersForSummary(teams[firstInningsBowlingTeamKey].bowlers),
    runs: match.runs, // Runs scored in the first innings
    wickets: match.wickets, // Wickets fallen in the first innings
    overs: `${Math.floor(match.balls / settings.ballsPerOver)}.${match.balls % settings.ballsPerOver}`,
    extras: { ...(match.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 }) },
    fallOfWickets: [...(match.fallOfWickets || [])],
    runRate: match.balls > 0 ? (match.runs / (match.balls / settings.ballsPerOver)).toFixed(2) : "0.00",
    // declared: false, // Add if you track declarations
  };

  console.log("✅ First Innings Summary Prepared:", innings1CompleteSummary);

  // Determine new batting and bowling teams for the second innings
  const secondInningsBattingTeamName = firstInningsActualBowlingTeamName;
  const secondInningsBowlingTeamName = firstInningsActualBattingTeamName;

  // Reset batting stats for the team batting second (their previous stats were as bowlers or from another match)
  const secondInningsBattingTeamKey = teams.teamA.name === secondInningsBattingTeamName ? 'teamA' : 'teamB';
  setTeams(prevTeams => {
    const updatedTeams = { ...prevTeams };
    updatedTeams[secondInningsBattingTeamKey] = {
      ...updatedTeams[secondInningsBattingTeamKey],
      batsmen: updatedTeams[secondInningsBattingTeamKey].batsmen.map(b => ({
        ...b,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        isOut: false,
        outType: '',
        strikeRate: '0.00'
      }))
    };
    return updatedTeams;
  });

  // Reset bowler stats for the team bowling second (their previous stats were as batsmen)
   const secondInningsBowlingTeamKey = teams.teamA.name === secondInningsBowlingTeamName ? 'teamA' : 'teamB';
    setTeams(prevTeams => {
        const updatedTeams = { ...prevTeams };
        updatedTeams[secondInningsBowlingTeamKey] = {
            ...updatedTeams[secondInningsBowlingTeamKey],
            bowlers: updatedTeams[secondInningsBowlingTeamKey].bowlers.map(b => ({
                ...b,
                previousSpells: [],
                currentSpell: { runs: 0, wickets: 0, balls: 0, maidens: 0 }
            }))
        };
        return updatedTeams;
    });


  setMatch(prev => ({
    ...prev,
    _id: prev._id || matchId,
    innings: 2,
    isChasing: true,
    target: prev.runs + 1, // Target is 1st innings score + 1
    firstInningsSummary: innings1CompleteSummary, // Store the detailed summary

    // Reset for 2nd innings
    runs: 0,
    wickets: 0,
    balls: 0,
    // overs: "0.0", // This will be calculated from balls
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
    fallOfWickets: [], // CRITICAL: Reset FOW for the new innings
    battingTeam: secondInningsBattingTeamName, // Set current batting team
    bowlingTeam: secondInningsBowlingTeamName, // Set current bowling team
    // currentBowler: null, // This will be set when a bowler is chosen or automatically
  }));

  // Reset players for the new innings
  const newStriker = teams[secondInningsBattingTeamKey].batsmen[0];
  const newNonStriker = teams[secondInningsBattingTeamKey].batsmen[1];
  const newBowler = teams[secondInningsBowlingTeamKey].bowlers[0];

  setPlayers({
    striker: newStriker || { name: "Batsman 1", runs: 0, balls: 0 }, // Fallbacks
    nonStriker: newNonStriker || { name: "Batsman 2", runs: 0, balls: 0 },
    bowler: newBowler || { name: "Bowler 1", currentSpell: {runs:0, wickets:0, balls:0, maidens:0}, previousSpells:[] },
    nextBatsmanId: (newNonStriker?.id || 1) + 1, // Or a more robust way to get next ID
    // nextBowlerId, lastBowler etc. need to be managed
  });

  setOverHistory([]);
  setSelectedAction(null); // Clear any pending action

  console.log(`✅ Second innings ready. Batting: ${secondInningsBattingTeamName}, Bowling: ${secondInningsBowlingTeamName}. Target: ${match.runs + 1}`);
  sendMatchUpdate(); // Send an update that second innings has started
};




const endMatch = async () => {
  try {
    const finalResultString = getMatchResult();

    const completedMatchForUI = {
      ...match,
      isComplete: true,
      result: finalResultString,
      status: "completed",
    };
    setMatch(completedMatchForUI);

    const currentDate = new Date().toISOString();

    // Helpers (ensure these are defined in ScoreCard.jsx scope and work correctly)
    const formatBatsmen = (batsmenList = []) =>
      batsmenList.map(b => ({
        name: b.name,
        runs: b.runs || 0,
        balls: b.balls || 0,
        fours: b.fours || 0,
        sixes: b.sixes || 0,
        isOut: b.isOut || false,
        outType: b.outType || '',
        strikeRate: b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00",
      }));

    const formatBowlers = (bowlersList = []) => {
      return bowlersList.map(b => {
        const allSpells = [...(b.previousSpells || [])];
        if (b.currentSpell && (b.currentSpell.balls > 0 || (b.previousSpells && b.previousSpells.length > 0 && b.currentSpell.balls === 0))) { // Include current spell if it has deliveries or if previous spells exist (even if current spell is 0 balls for a new bowler at end)
          allSpells.push(b.currentSpell);
        }
        let totalBalls = 0, totalRunsConceded = 0, totalWicketsTaken = 0, totalMaidens = 0;
        allSpells.forEach(spell => {
          totalBalls += spell.balls || 0;
          totalRunsConceded += spell.runs || 0;
          totalWicketsTaken += spell.wickets || 0;
          totalMaidens += spell.maidens || 0;
        });
        return {
          name: b.name,
          overs: `${Math.floor(totalBalls / settings.ballsPerOver)}.${totalBalls % settings.ballsPerOver}`,
          runs: totalRunsConceded,
          wickets: totalWicketsTaken,
          maidens: totalMaidens,
          economyRate: totalBalls > 0 ? ((totalRunsConceded / totalBalls) * settings.ballsPerOver).toFixed(2) : "0.00",
        };
      });
    };

    // --- Innings 1 Data ---
    // Use the summary stored when the second innings started.
    const innings1Data = match.firstInningsSummary || {
      teamName: matchSettings?.firstBatting || teams.teamA.name, // Fallback
      batting: [], bowling: [], runs: 0, wickets: 0, overs: "0.0",
      extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      fallOfWickets: [], runRate: "0.00",
    };
    // If innings1Data is still default, it means startSecondInnings might not have run or populated it.
    // This could happen if the match ends in the 1st innings.
     if (!match.firstInningsSummary && match.innings === 1 && match.isComplete) {
        // Match ended in 1st innings, construct innings1Data from current state
        const firstInningsBattingTeamKey = teams.teamA.name === match.battingTeam ? 'teamA' : 'teamB';
        const firstInningsBowlingTeamKey = teams.teamA.name === match.bowlingTeam ? 'teamA' : 'teamB';
        
        innings1Data.teamName = teams[firstInningsBattingTeamKey].name;
        innings1Data.batting = formatBatsmen(teams[firstInningsBattingTeamKey].batsmen);
        innings1Data.bowling = formatBowlers(teams[firstInningsBowlingTeamKey].bowlers);
        innings1Data.runs = match.runs;
        innings1Data.wickets = match.wickets;
        innings1Data.overs = `${Math.floor(match.balls / settings.ballsPerOver)}.${match.balls % settings.ballsPerOver}`;
        innings1Data.extras = { ...match.extras };
        innings1Data.fallOfWickets = [...match.fallOfWickets];
        innings1Data.runRate = match.balls > 0 ? (match.runs / (match.balls / settings.ballsPerOver)).toFixed(2) : "0.00";
        console.log("Match ended in 1st innings, constructed innings1Data:", innings1Data);
    }


    // --- Innings 2 Data ---
    let innings2Data = {
        teamName: "N/A", batting: [], bowling: [], runs: 0, wickets: 0, overs: "0.0",
        extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
        fallOfWickets: [], runRate: "0.00", target: 0
    };

    if (match.innings === 2 || (match.innings === 1 && match.isComplete && match.firstInningsSummary) ) { // If 2nd innings played or was set up
      const secondInningsActualBattingTeamName = match.battingTeam; // Current batting team at end of match (should be 2nd innings team)
      const secondInningsActualBowlingTeamName = match.bowlingTeam; // Current bowling team

      const secondInningsBattingTeamKey = teams.teamA.name === secondInningsActualBattingTeamName ? 'teamA' : 'teamB';
      const secondInningsBowlingTeamKey = teams.teamA.name === secondInningsActualBowlingTeamName ? 'teamA' : 'teamB';
      
      // Ensure keys are valid
      if (teams[secondInningsBattingTeamKey] && teams[secondInningsBowlingTeamKey]) {
          innings2Data = {
            teamName: teams[secondInningsBattingTeamKey].name,
            batting: formatBatsmen(teams[secondInningsBattingTeamKey].batsmen),
            bowling: formatBowlers(teams[secondInningsBowlingTeamKey].bowlers),
            runs: match.runs, // Final runs of 2nd innings
            wickets: match.wickets, // Final wickets of 2nd innings
            overs: `${Math.floor(match.balls / settings.ballsPerOver)}.${match.balls % settings.ballsPerOver}`,
            extras: { ...match.extras },
            fallOfWickets: [...match.fallOfWickets], // FOW from 2nd innings
            runRate: match.balls > 0 ? (match.runs / (match.balls / settings.ballsPerOver)).toFixed(2) : "0.00",
            target: match.target,
          };
      } else {
          console.warn("Could not determine team keys for innings 2 data in endMatch. Using defaults.");
          if (innings1Data.teamName === teams.teamA.name) innings2Data.teamName = teams.teamB.name;
          else innings2Data.teamName = teams.teamA.name;
      }
    }


    // --- Construct final matchData for backend and FullScorecardPage ---
    const finalMatchDataPayload = {
      date: matchSettings?.date || currentDate,
      venue: matchSettings?.venue || "Unknown Venue",
      matchType: matchSettings?.matchType || "T20",
      series: matchSettings?.series || "",
      totalOvers: settings.overs,
      ballsPerOver: settings.ballsPerOver,
      playersPerTeam: settings.playersPerTeam,
      teamA: {
        name: teams.teamA.name,
        shortName: teams.teamA.name.substring(0, 3).toUpperCase(),
      },
      teamB: {
        name: teams.teamB.name,
        shortName: teams.teamB.name.substring(0, 3).toUpperCase(),
      },
      toss: {
        winner: matchSettings?.toss?.winner || innings1Data.teamName, // Team that batted first if toss not specific
        decision: matchSettings?.toss?.decision || "bat",
      },
      umpires: matchSettings?.umpires || [],
      matchReferee: matchSettings?.matchReferee || "",
      innings1: innings1Data,
      innings2: (match.innings === 2 || (match.innings === 1 && match.isComplete && match.firstInningsSummary)) ? innings2Data : undefined, // Only include innings2 if it happened
      result: finalResultString,
      status: "completed",
      matchSummary: {
        winner: determineWinner(),
        margin: calculateMargin(),
        playerOfMatch: determinePlayerOfMatch(innings1Data, innings2Data),
      },
      // Include the backend match ID if available from initial setup
      _id: matchSettings?._id || match?._id || matchId,
    };
    
    console.log("📦 Final Match Data Payload for FullScorecard & Backend:", JSON.stringify(finalMatchDataPayload, null, 2));


    // --- API Call ---
    try {
      const backendMatchId = finalMatchDataPayload._id;
      if (!backendMatchId) {
          console.error("⚠️ Critical: Backend Match ID is missing in final payload. Cannot end match on server.");
          localStorage.setItem('unsavedMatchBackup', JSON.stringify(finalMatchDataPayload));
          throw new Error("Backend Match ID missing for endMatch API call");
      }
      await axios.post(
        `http://localhost:5000/api/matches/${backendMatchId}/end-match`,
        { matchData: finalMatchDataPayload }
      );
      console.log("✅ Match ended successfully on server.");
      localStorage.removeItem("currentMatchId");
    } catch (error) {
      console.error("⚠️ Backend update failed for end-match. Match saved locally.", error.response?.data || error.message);
      localStorage.setItem('unsavedMatchBackup', JSON.stringify(finalMatchDataPayload));
    }

    if (onMatchEnd) {
      onMatchEnd(finalMatchDataPayload);
    }

    navigate('/full-scorecard', {
      state: {
        matchData: finalMatchDataPayload,
      }
    });

  } catch (error) {
    console.error("❌ Error in endMatch function:", error);
    navigate('/full-scorecard', {
      state: {
        error: "Couldn't finalize scorecard due to an error.",
        basicInfo: { teamA: teams.teamA.name, teamB: teams.teamB.name, result: getMatchResult() }
      }
    });
  }
};



// Helper function moved outside component
const determinePlayerOfMatch = (innings1, innings2) => {
  const allPlayers = [...innings1.batting, ...innings2.batting];
  const topScorer = allPlayers.reduce((prev, curr) => 
    (curr.runs > (prev?.runs || 0) ? curr : prev), null);
  
  const allBowlers = [...innings1.bowling, ...innings2.bowling];
  const topWicketTaker = allBowlers.reduce((prev, curr) => 
    (curr.wickets > (prev?.wickets || 0) ? curr : prev), null);

  if (topWicketTaker?.wickets >= 3) return topWicketTaker.name;
  if (topScorer?.runs >= 30) return topScorer.name;
  return topScorer?.name || topWicketTaker?.name || "N/A";
};

  
  
  
  

// Example helper functions
const getMatchResult = () => {
  if (!match || !teams?.teamA?.name || !teams?.teamB?.name) {
    return 'Result unavailable';
  }

  const teamA = teams.teamA.name;
  const teamB = teams.teamB.name;

  if (!match.isChasing) {
    return 'Match not completed';
  }

  const target = match.target || 0;
  const runs = match.runs || 0;
  const wickets = match.wickets || 0;

  if (runs >= target) {
    const wicketsRemaining = 10 - wickets;
    return `${teamB} won by ${wicketsRemaining} wicket${wicketsRemaining !== 1 ? 's' : ''}`;
  } else if (runs < target - 1) {
    const margin = target - runs - 1;
    return `${teamA} won by ${margin} run${margin !== 1 ? 's' : ''}`;
  } else if (runs === target - 1) {
    return 'Match tied';
  }

  return 'Result not determined';
};


const determineWinner = () => {
  if (!match || !teams?.teamA?.name || !teams?.teamB?.name) {
    return '';
  }

  const teamA = teams.teamA.name;
  const teamB = teams.teamB.name;

  if (!match.isChasing) return '';

  const target = match.target || 0;
  const runs = match.runs || 0;

  if (runs >= target) {
    return teamB;
  } else if (runs < target - 1) {
    return teamA;
  } else {
    return 'Tie';
  }
};


const calculateMargin = () => {
  if (!match || typeof match.runs !== 'number' || typeof match.target !== 'number') {
    return 'Margin unavailable';
  }

  const runs = match.runs;
  const target = match.target;
  const wickets = match.wickets ?? 0;

  if (!match.isChasing) {
    return '';
  }

  if (runs >= target) {
    const wicketsRemaining = 10 - wickets;
    return `${wicketsRemaining} wicket${wicketsRemaining !== 1 ? 's' : ''}`;
  } else if (runs < target - 1) {
    const runMargin = target - runs - 1;
    return `${runMargin} run${runMargin !== 1 ? 's' : ''}`;
  } else {
    return 'Tied';
  }
};


  // Settings functions
  const handleChangeOvers = (newOvers) => {
    if (match.innings === 1 && match.balls === 0) {
      setSettings(prev => ({ ...prev, overs: newOvers }));
    }
  };

  const handleChangeExtraRuns = (type, value) => {
    if (match.innings === 1) {
      setSettings(prev => ({
        ...prev,
        wideBallRuns: type === 'WD' ? value : prev.wideBallRuns,
        noBallRuns: type === 'NB' ? value : prev.noBallRuns
      }));
    }
  };

  const handleChangeBallsPerOver = (value) => {
    if (match.innings === 1 && match.balls === 0) {
      setSettings(prev => ({ ...prev, ballsPerOver: value }));
    }
  };

  // Editing Players
  const startEditingPlayer = (playerType, playerId, team) => {
    const teamData = teams[team]; // Access the team data directly
    const playerList = playerType === 'batsman' ? teamData.batsmen : teamData.bowlers;
    const player = playerList.find(p => p.id === playerId);
    
    if (player) {
      setEditingPlayer({ 
        type: playerType, 
        id: playerId, 
        team,
        isCurrentPlayer: isCurrentPlayer(playerType, playerId, team) // Add this check
      });
      setNewPlayerName(player.name);
      setShowModal('EDIT_PLAYER');
    }
  };

    // Helper function to check if player is currently active
    const isCurrentPlayer = (playerType, playerId, team) => {
        const currentBattingTeam = match.innings === 1 ? 'teamA' : 'teamB';
        const currentBowlingTeam = match.innings === 1 ? 'teamB' : 'teamA';
        
        if (playerType === 'batsman') {
        return team === currentBattingTeam && 
                (players.striker.id === playerId || players.nonStriker.id === playerId);
        } else {
        return team === currentBowlingTeam && players.bowler.id === playerId;
        }
    };

    const updatePlayerInTeam = (teamKey, playerType, updatedPlayer) => {
      const playerArray = playerType === 'batsman' ? 'batsmen' : 'bowlers';

      setTeams(prev => {
        const updatedPlayers = prev[teamKey][playerArray].map(player =>
          player.id === updatedPlayer.id ? { ...player, ...updatedPlayer } : player
        );

        return {
          ...prev,
          [teamKey]: {
            ...prev[teamKey],
            [playerArray]: updatedPlayers
          }
        };
      });
    };

  
    const savePlayerName = () => {
      if (editingPlayer && newPlayerName.trim()) {
        const { team, id, type } = editingPlayer;
        const playerArray = type === 'batsman' ? 'batsmen' : 'bowlers';

        // Update the team's player list (name only)
        setTeams(prev => {
          const updatedTeams = { ...prev };
          updatedTeams[team][playerArray] = updatedTeams[team][playerArray].map(player =>
            player.id === id ? { ...player, name: newPlayerName } : player
          );
          return updatedTeams;
        });

        // Update current players and also sync back their performance to teams
        setPlayers(prev => {
          const updatedPlayers = { ...prev };

          if (type === 'batsman') {
            if (prev.striker?.id === id) {
              updatedPlayers.striker = { ...prev.striker, name: newPlayerName };
              updatePlayerInTeam(team, 'batsman', updatedPlayers.striker);
            }
            if (prev.nonStriker?.id === id) {
              updatedPlayers.nonStriker = { ...prev.nonStriker, name: newPlayerName };
              updatePlayerInTeam(team, 'batsman', updatedPlayers.nonStriker);
            }
          }

          if (type === 'bowler' && prev.bowler?.id === id) {
            updatedPlayers.bowler = { ...prev.bowler, name: newPlayerName };
            updatePlayerInTeam(team, 'bowler', updatedPlayers.bowler);
          }

          return updatedPlayers;
        });

        // Reset editing state
        setEditingPlayer(null);
        setNewPlayerName('');
        setShowModal(null);
      }
    };

    

      // Bowler Info Component
        const BowlerInfo = ({ bowler }) => {
            if (!bowler) return null;
            
            const currentSpell = bowler.currentSpell || { runs: 0, wickets: 0, balls: 0, maidens: 0 };
            const previousSpells = bowler.previousSpells || [];
            
            const totalBalls = previousSpells.reduce((sum, spell) => sum + spell.balls, 0) + currentSpell.balls;
            const totalOvers = `${Math.floor(totalBalls / settings.ballsPerOver)}.${totalBalls % settings.ballsPerOver}`;
            const totalRuns = previousSpells.reduce((sum, spell) => sum + spell.runs, 0) + currentSpell.runs;
            const totalWickets = previousSpells.reduce((sum, spell) => sum + spell.wickets, 0) + currentSpell.wickets;
            const economyRate = totalBalls > 0 ? (totalRuns / (totalBalls / 6)).toFixed(2) : '0.00';


            return (
              <div className="bowler-info">
                <p>{bowler.name}</p>
                <p>Overs: {overs}</p>
                <p>Runs: {totalRuns}</p>
                <p>Wickets: {totalWickets}</p>
                <p>Economy: {economyRate}</p>
              </div>
            );
        };

        const startBowlerSpell = (bowlerId) => {
            setTeams(prevTeams => {
              const currentBowlingTeam = match.innings === 1 ? 'teamB' : 'teamA';
              return {
                ...prevTeams,
                [currentBowlingTeam]: {
                  ...prevTeams[currentBowlingTeam],
                  bowlers: prevTeams[currentBowlingTeam].bowlers.map(bowler => {
                    if (bowler.id !== bowlerId) return bowler;
                    
                    return {
                      ...bowler,
                      currentSpell: {
                        runs: 0,
                        wickets: 0,
                        balls: 0,
                        maidens: 0
                      }
                    };
                  })
                }
              };
            });
          };

          const completeOver = () => {
            setTeams(prevTeams => {
              const currentBowlingTeam = match.innings === 1 ? 'teamB' : 'teamA';
              const bowlerId = players.bowler.id;
              
              return {
                ...prevTeams,
                [currentBowlingTeam]: {
                  ...prevTeams[currentBowlingTeam],
                  bowlers: prevTeams[currentBowlingTeam].bowlers.map(bowler => {
                    if (bowler.id !== bowlerId) return bowler;
                    
                    // Ensure we don't have fractional balls
                    const completedBalls = Math.floor(bowler.currentSpell.balls);
                    
                    return {
                      ...bowler,
                      previousSpells: [...(bowler.previousSpells || []), {
                        ...bowler.currentSpell,
                        balls: completedBalls
                      }],
                      currentSpell: { 
                        runs: 0, 
                        wickets: 0, 
                        balls: 0, 
                        maidens: 0 
                      }
                    };
                  })
                }
              };
            });
          };

          const BowlerDisplay = ({ bowler }) => {
            if (!bowler) return null;
            
            const totalStats = bowler.previousSpells.reduce((acc, spell) => ({
              runs: acc.runs + (spell.runs || 0),
              wickets: acc.wickets + (spell.wickets || 0),
              balls: acc.balls + (spell.balls || 0),
              maidens: acc.maidens + (spell.maidens || 0)
            }), bowler.currentSpell || { runs: 0, wickets: 0, balls: 0, maidens: 0 });

            const overs = `${Math.floor(totalStats.balls / settings.ballsPerOver)}.${totalStats.balls % settings.ballsPerOver}`;
            const economy = totalStats.balls > 0 
              ? ((totalStats.runs / totalStats.balls) * settings.ballsPerOver).toFixed(2)
              : "0.00";

            return (
              <div className="bowler-display">
                <div className="bowler-stats">
                  {totalStats.runs}/{totalStats.wickets} ({overs}) • ER: {economy}
                </div>
              </div>
            );
          };

    const [editingTeam, setEditingTeam] = useState(null); // null / 'teamA' / 'teamB'
    const [tempNames, setTempNames] = useState([]);

 






        /* ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ */




  
  // Render modal content

  const renderModal = () => {
    if (!showModal) return null;

    if (showModal === 'EDIT_PLAYER') {
        return (
          <div className="modal open">
            <div className="modal-overlay" onClick={() => {
              setShowModal(null);
              setEditingPlayer(null);
            }}></div>
            <div className="modal-content" role="dialog" aria-modal="true">
              <h3>Edit {editingPlayer?.type === 'batsman' ? 'Batsman' : 'Bowler'} Name</h3>
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder={`Enter ${editingPlayer?.type} name`}
                autoFocus
              />
              <div className="modal-actions">
                <button onClick={() => {
                  setShowModal(null);
                  setEditingPlayer(null);
                }} className="cancel-btn">
                  Cancel
                </button>
                <button onClick={savePlayerName} className="ok-btn">
                  Save
                </button>
              </div>
            </div>
          </div>
        );
      }

      if (showModal === 'CHANGE_BOWLER') {
        const currentBowlingTeam = match.innings === 1 ? 'teamB' : 'teamA';
        const availableBowlers = teams[currentBowlingTeam].bowlers
          .filter(bowler => bowler.id !== players.lastBowler)
          .map(bowler => ({
            ...bowler,
            overs: `${Math.floor(bowler.balls / settings.ballsPerOver)}.${bowler.balls % settings.ballsPerOver}`
          }));
      
        return (
          <div className="modal open">
            <div className="modal-overlay" onClick={() => setShowModal(null)}></div>
            <div className="modal-content" role="dialog" aria-modal="true">
              <h3>Select Next Bowler</h3>
              <div className="bowler-options">
                {availableBowlers.map(bowler => (
                  <div
                    key={bowler.id}
                    className={`bowler-option ${players.bowler.id === bowler.id ? 'current-bowler' : ''}`}
                    onClick={() => {
                      handleBowlerChange(bowler.id);
                      setShowModal(null);
                    }}
                  >
                    <div className="bowler-info">
                      <span className="bowler-name">{bowler.name}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="modal-actions">
                <button 
                  onClick={() => setShowModal(null)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      }

    const handleSelect = (value) => setModalData(prev => ({ ...prev, value }));
    const handleSelectRetire = (type, batter) => setModalData({ type, batter });

    const renderNumberOptions = () => (
      <div className="number-grid">
        {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
          <button 
            key={num} 
            onClick={() => handleSelect(num)}
            className={modalData.value === num ? 'selected' : ''}
          >
            {num}
          </button>
        ))}
      </div>
    );

    const renderOutOptions = () => (
      <div className="out-options">
        {['Bowled', 'Caught', 'Run Out', 'Hit Wicket', 'Other'].map(type => (
          <button 
            key={type} 
            onClick={() => handleSelect(type)}
            className={modalData.value === type ? 'selected' : ''}
          >
            {type}
          </button>
        ))}
      </div>
    );

    const renderRetireOptions = () => (
      <div className="retire-options">
        <div className="retire-types">
          <h4>Retire Type</h4>
          {['Retired', 'Retired Out'].map(type => (
            <button 
              key={type} 
              onClick={() => setModalData(prev => ({ ...prev, type }))}
              className={modalData.type === type ? 'selected' : ''}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="batter-selection">
          <h4>Select Batter</h4>
          {['Striker', 'Non-Striker'].map(batter => (
            <button 
              key={batter} 
              onClick={() => setModalData(prev => ({ ...prev, batter }))}
              className={modalData.batter === batter ? 'selected' : ''}
            >
              {batter}
            </button>
          ))}
        </div>
      </div>
    );

 // temporary names for editing

const handleStartEditNames = () => {
  setEditingTeam("choose");
  sendMatchUpdate();
};

const handleChooseTeam = (teamKey) => {
  setEditingTeam(teamKey);
  const currentPlayers = teams[teamKey].batsmen;
  setTempNames(currentPlayers.map(p => ({ id: p.id, name: p.name })));
  sendMatchUpdate();
};

const handleTempNameChange = (id, newName) => {
  setTempNames(prev =>
    prev.map(p => p.id === id ? { ...p, name: newName } : p)
  );
  sendMatchUpdate();
};

const handleSaveNames = () => {
  setTeams(prev => ({
    ...prev,
    [editingTeam]: {
      ...prev[editingTeam],
      batsmen: prev[editingTeam].batsmen.map(p => {
        const updated = tempNames.find(t => t.id === p.id);
        return updated ? { ...p, name: updated.name } : p;
      }),
    }
  }));
  setEditingTeam(null);
  setTempNames([]);
  sendMatchUpdate();
};

const handleCancelEdit = () => {
  setEditingTeam(null);
  setTempNames([]);
};

const renderSettingsOptions = () => {
  // === Restriction: Only before match starts (1st innings, 0 balls bowled)
  if (match.innings !== 1 || match.balls > 0) {
    return <p>Settings can only be changed before the match starts</p>;
  }

  // === Step 3: Edit Player Names
  if (editingTeam && editingTeam !== "choose") {
    return (
      <div className="edit-players-screen">
        <h3>Edit Player Names - {editingTeam === 'teamA' ? 'Team A' : 'Team B'}</h3>
        {tempNames.map((player, index) => (
          <div key={player.id} className="setting-item">
            <label>Player {index + 1}:</label>
            <input
              type="text"
              value={player.name}
              onChange={(e) => handleTempNameChange(player.id, e.target.value)}
            />
          </div>
        ))}
        <div style={{ marginTop: '1rem' }}>
          <button onClick={handleSaveNames}>Save</button>
          <button onClick={handleCancelEdit} style={{ marginLeft: '1rem' }}>Cancel</button>
        </div>
      </div>
    );
  }

  // === Step 2: Choose Team to Edit
  if (editingTeam === "choose") {
    return (
      <div className="choose-team-screen">
        <h3>Choose a team to edit player names:</h3>
        <button onClick={() => handleChooseTeam("teamA")}>Team A</button>
        <button onClick={() => handleChooseTeam("teamB")} style={{ marginLeft: '1rem' }}>Team B</button>
        <div style={{ marginTop: '1rem' }}>
          <button onClick={handleCancelEdit}>Cancel</button>
        </div>
      </div>
    );
  }

  // === Step 1: Show all Settings options
  return (
    <div className="settings-options">
      <div className="setting-item">
        <label>Overs per innings:</label>
        <input
          type="number"
          min="1"
          max="50"
          value={settings.overs}
          onChange={(e) => handleChangeOvers(parseInt(e.target.value) || 1)}
        />
      </div>

      <div className="setting-item">
        <label>Wide ball runs:</label>
        <input
          type="number"
          min="1"
          max="5"
          value={settings.wideBallRuns}
          onChange={(e) => handleChangeExtraRuns('WD', parseInt(e.target.value) || 1)}
        />
      </div>

      <div className="setting-item">
        <label>No ball runs:</label>
        <input
          type="number"
          min="1"
          max="5"
          value={settings.noBallRuns}
          onChange={(e) => handleChangeExtraRuns('NB', parseInt(e.target.value) || 1)}
        />
      </div>

      <div className="setting-item">
        <label>Balls per over:</label>
        <input
          type="number"
          min="1"
          max="10"
          value={settings.ballsPerOver}
          onChange={(e) => handleChangeBallsPerOver(parseInt(e.target.value) || 6)}
        />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <button onClick={handleStartEditNames}>Edit Player Names</button>
      </div>
    </div>
  );
};


    return (
      <div className={`modal ${showModal ? 'open' : ''}`}>
        <div className="modal-overlay" onClick={() => {
          setShowModal(null);
          setSelectedAction(null);
        }}></div>
        <div className="modal-content" role="dialog" aria-modal="true">
          <h3>
            {showModal === 'WD' && 'Select Wide Runs'}
            {showModal === 'NB' && 'Select No Ball Runs'}
            {showModal === 'OUT' && 'Select Dismissal Type'}
            {showModal === 'Retire' && 'Retire Batsman'}
            {showModal === '5,7..' && 'Select Runs'}
            {showModal === 'BYE' && 'Select Bye Runs'}
            {showModal === 'SETTINGS' && 'Match Settings'}
          </h3>
          
          {['WD', 'NB', '5,7..', 'BYE'].includes(showModal) && renderNumberOptions()}
          {showModal === 'OUT' && renderOutOptions()}
          {showModal === 'Retire' && renderRetireOptions()}
          {showModal === 'SETTINGS' && renderSettingsOptions()}
          
          <div className="modal-actions">
            <button onClick={() => {
              setShowModal(null);
              setSelectedAction(null);
            }} className="cancel-btn">Cancel</button>
            {showModal !== 'SETTINGS' && (
              <button onClick={handleOK} className="ok-btn">OK</button>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ */

  return (
    <div className="live-score-container">
      {/* Header with Back Button and View Toggles */}
      <div className="header-actions">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <FiArrowLeft size={20} />
        </button>
        <div className="view-buttons">
          <button className="view-btn active">Live Scorecard</button>
          <button className="view-btn" onClick={() => navigate("/full-scorecard")}>
            Full Scorecard
          </button>
        </div>
        <button 
          className="settings-btn"
          onClick={() => setShowSettingsPanel(!showSettingsPanel)}
        >
          <FiSettings size={20} />
        </button>
      </div>



      {/* Settings Panel (Conditional) */}
      {showSettingsPanel && (
        <div className="settings-panel">
          <h3>Match Settings</h3>
          <ul>
            <li>Change Overs Settings</li>
            <li>WD/NB Runs Settings</li>
            <li>Edit Balls Settings</li>
            <li>Edit Player Names</li>
          </ul>
        </div>
      )}

      {/* Scorecard Section */}
      <div className="scorecard-section">
        {/* Innings and Team */}
        <div className="innings-team">
          <h2 className="innings">{match.innings === 1 ? "1ST INNINGS" : "2ND INNINGS"}</h2>
          <h3 className="team-name">TEAM A</h3>
        </div>

        {/* Current Run Rate (CRR) */}
        <p className="crr">
          CRR {match.balls > 0 
            ? (match.runs / (match.balls / settings.ballsPerOver)).toFixed(2) 
            : "0.00"}
        </p>

        {/* Score and Overs */}
        <div className="score-overs">
          <h1 className="score">{match.runs || 0}/{match.wickets || 0}</h1>
          <p className="overs">
            ({Math.floor(match.balls / settings.ballsPerOver)}.
            {match.balls % settings.ballsPerOver}/{settings.totalOvers})
          </p>
        </div>

        {match.isChasing && !match.isComplete && (
          <div className="target-info">
            <div className="target-row">
              <span className="target-label">Target:</span>
              <span className="target-value">{match.target}</span>
            </div>
            <div className="target-row highlight">
              <span>Need {Math.max(0, remainingRuns)} runs from {remainingBalls} balls</span>
            </div>
            <div className="target-row">
              <span className="target-label">Req. RR:</span>
              <span className="target-value">{requiredRunRate}</span>
            </div>
          </div>
        )}


            <div className="batsmen-info">
              {/* Striker (Left Side - Highlighted) */}
              <div className="batsman striker">
                <div className="striker-header">
                  <p 
                    className="batsman-name"
                    onClick={() => {
                      const currentBattingTeam = match.innings === 1 ? 'teamA' : 'teamB';
                      startEditingPlayer('batsman', players.striker.id, currentBattingTeam);
                    }}
                  >
                    {players.striker.name}
                  </p>
                  <span className="live-dot"></span> {/* Animated dot */}
                </div>
                <div className="batsman-stats">
                  <span className="batsman-runs">{players.striker.runs}</span>
                  <span className="batsman-balls">({players.striker.balls})</span>
                </div>
                {players.striker.isOut && (
                  <span className="out-status">{players.striker.outType}</span>
                )}
              </div>

              {/* Non-Striker (Right Side) */}
              <div className="batsman">
                <p 
                  className="batsman-name"
                  onClick={() => {
                    const currentBattingTeam = match.innings === 1 ? 'teamA' : 'teamB';
                    startEditingPlayer('batsman', players.nonStriker.id, currentBattingTeam);
                  }}
                >
                  {players.nonStriker.name}
                </p>
                <div className="batsman-stats">
                  <span className="batsman-runs">{players.nonStriker.runs}</span>
                  <span className="batsman-balls">({players.nonStriker.balls})</span>
                </div>
                {players.nonStriker.isOut && (
                  <span className="out-status">{players.nonStriker.outType}</span>
                )}
              </div>
            </div>




            <div className="bowler-info">
              {/* Bowler Name, Spell, and Change Button (Same Line) */}
              <div className="bowler-header">
                <p 
                  className="bowler-name"
                  onClick={() => {
                    const currentBowlingTeam = match.innings === 1 ? 'teamB' : 'teamA';
                    startEditingPlayer('bowler', players.bowler.id, currentBowlingTeam);
                  }}
                >
                  {players.bowler.name}
                </p>
                <div className="bowler-spell">
                  {players.bowler.wickets || 0}/{players.bowler.runs || 0} ({players.bowler.oversBowled || 0}.{players.bowler.ballsBowled % 6 || 0})
                </div>
                <button 
                  className="change-bowler-btn"
                  onClick={() => setShowModal('CHANGE_BOWLER')}
                >
                  <FiRefreshCw size={16} /> Change
                </button>
              </div>

              {overHistory.length > 0 && (
                <div className="over-history-section">
                  <p className="section-title">This Over</p>
                  <div className="balls-container">
                    {overHistory.map((ball, index) => (
                      <span
                        key={index}
                        className={`ball-mark ${
                          ball === '6' || ball === '4' ? 'boundary' :
                          ball === 'W' ? 'wicket' :
                          ball.includes('WD') || ball.includes('B') ? 'extra' :
                          'regular-run'
                        }`}
                      >
                        {ball}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>




      {!match.isComplete && (
        <div className="lower-section">
          {/* First Row - End Innings (Long Button) */}
          <div className="button-row">
            <button 
              className="end-innings-btn" 
              onClick={() => {
                saveState();
                endInnings();
              }}
            >
              End Innings
            </button>
          </div>

          {/* Second Row - Retire + Change Striker */}
          <div className="button-row">
            <button 
              className="action-btn retire-btn"
              onClick={() => handleActionClick('Retire')}
            >
              Retire
            </button>
            <button 
              className="action-btn change-strike-btn"
              onClick={() => {
                saveState();
                setPlayers(prev => ({
                  ...prev,
                  striker: prev.nonStriker,
                  nonStriker: prev.striker
                }));
                setSelectedAction(null);
              }}
            >
              Change Striker
            </button>
          </div>

          {/* Third Row - WD, NB, BYE, UNDO */}
          <div className="button-row">
            {['WD', 'NB', 'BYE', 'UNDO'].map((btn) => (
              <button
                key={btn}
                onClick={() => btn === 'UNDO' ? handleUndo() : handleActionClick(btn)}
                className={`action-btn ${
                  btn === 'WD' || btn === 'NB' ? 'yellow-btn' :
                  btn === 'BYE' ? 'purple-btn' :
                  'undo-btn'
                }`}
                disabled={btn === 'UNDO' && history.length === 0}
              >
                {btn}
              </button>
            ))}
          </div>

          {/* Fourth Row - 0, 1, 2, 5,7.. */}
          <div className="button-row">
            {['0', '1', '2', '5,7..'].map((btn) => (
              <button
                key={btn}
                onClick={() => handleActionClick(btn)}
                className={`action-btn ${
                  btn === '5,7..' ? 'purple-btn' : 'white-btn'
                }`}
              >
                {btn}
              </button>
            ))}
          </div>

          {/* Fifth Row - 3, 4, 6, OUT */}
          <div className="button-row">
            {['3', '4', '6', 'OUT'].map((btn) => (
              <button
                key={btn}
                onClick={() => handleActionClick(btn)}
                className={`action-btn ${
                  btn === 'OUT' ? 'red-btn' : 'white-btn'
                }`}
              >
                {btn}
              </button>
            ))}
          </div>
        </div>
      )}

      {renderModal()}
    </div>
    </div>
  );
};

export default ScorecardPage;