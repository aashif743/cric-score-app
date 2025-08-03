import React, { useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import { FiSettings, FiArrowLeft, FiRefreshCw } from 'react-icons/fi';
import { motion, AnimatePresence } from "framer-motion";
import './ScorecardPage.css';
import { useNavigate } from 'react-router-dom';
import io from "socket.io-client";
import API from '../api';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { AuthContext } from '../context/AuthContext.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL;


const createInitialState = (matchSettings) => {
    // 1. Normalize all incoming data to ensure consistency
    const teamAName = matchSettings?.teamA?.name || matchSettings?.teamA || 'Team A';
    const teamBName = matchSettings?.teamB?.name || matchSettings?.teamB || 'Team B';
    const totalOvers = matchSettings?.totalOvers || matchSettings?.overs || 6;
    const playersPerTeam = matchSettings?.playersPerTeam || 11;
    const ballsPerOver = matchSettings?.ballsPerOver || 6;

    // 2. LAZY INITIALIZATION: Create lean player lists with only essential data.
    // Other properties like runs, balls, spells, etc., will be added dynamically when needed.
    // This dramatically reduces the initial state size.
    const createTeam = (name, pPerTeam) => ({
    name,
    batsmen: Array.from({ length: pPerTeam }, (_, i) => ({ 
        id: uuidv4(), 
        name: `Player ${i + 1}`,
        // ✅ FIX: Initialize all required stats for batsmen
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        isOut: false,
        status: 'Did Not Bat'
    })),
    bowlers: Array.from({ length: pPerTeam }, (_, i) => ({ 
        id: uuidv4(), 
        name: `Player ${i + 1}`,
        // ✅ FIX: Initialize all required stats for bowlers
        currentSpell: { runs: 0, wickets: 0, balls: 0, maidens: 0 },
        previousSpells: []
    }))
});

    const initialTeams = {
        teamA: createTeam(teamAName, playersPerTeam),
        teamB: createTeam(teamBName, playersPerTeam)
    };
    
    // Ensure the very first active players have their full stats objects to prevent crashes.
    const initialStriker = initialTeams.teamA.batsmen[0] || { id: uuidv4(), name: 'Player 1'};
    const initialNonStriker = initialTeams.teamA.batsmen[1] || { id: uuidv4(), name: 'Player 2'};
    const initialBowler = initialTeams.teamB.bowlers[0] || { id: uuidv4(), name: 'Player 1'};

    // 3. Return all initial state objects.
    return {
        settings: {
            noBallRuns: 1,
            wideBallRuns: 1,
            ...matchSettings,
            overs: totalOvers,
            playersPerTeam,
            ballsPerOver
        },
        match: {
            _id: matchSettings?._id || null,
            runs: 0, wickets: 0, balls: 0, innings: 1, target: 0, isChasing: false, isComplete: false, result: '', fallOfWickets: [],
            extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
            battingTeam: teamAName,
            bowlingTeam: teamBName,
            firstInningsSummary: null
        },
        teams: initialTeams,
        players: {
            striker: { ...initialStriker, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, status: 'Not Out' },
            nonStriker: { ...initialNonStriker, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, status: 'Not Out' },
            bowler: { ...initialBowler, currentSpell: { runs: 0, wickets: 0, balls: 0, maidens: 0 }, previousSpells: [] },
            lastBowler: null
        }
    };
};



const determinePlayerOfMatch = (innings1, innings2) => {
    if (!innings1) return "N/A";
    const allPlayersBatting = [...(innings1?.batting || []), ...(innings2?.batting || [])];
    const topScorer = allPlayersBatting.reduce((prev, curr) =>
        ((curr.runs || 0) > (prev?.runs || -1) ? curr : prev), { runs: -1 });

    const allBowlers = [...(innings1?.bowling || []), ...(innings2?.bowling || [])];
    const topWicketTaker = allBowlers.reduce((prev, curr) =>
        ((curr.wickets || 0) > (prev?.wickets || -1) ? curr : prev), { wickets: -1 });

    // Example logic: A 3-wicket haul often wins POM. A score of 30+ is also strong.
    if (topWicketTaker && topWicketTaker.wickets >= 3) return topWicketTaker.name;
    if (topScorer && topScorer.runs >= 30) return topScorer.name;
    // Fallback logic
    if (topWicketTaker && topWicketTaker.wickets > (topScorer?.runs || 0) / 15) { // Simple heuristic
        return topWicketTaker.name;
    }
    return topScorer?.name || topWicketTaker?.name || "N/A";
};

const formatBatsmenData = (
    batsmenListFromTeamsState = [],
    currentStrikerFromPlayersState,
    currentNonStrikerFromPlayersState
) => {
    return batsmenListFromTeamsState.map(batsmanInTeam => {
        let processedBatsman = { ...batsmanInTeam };

        if (currentStrikerFromPlayersState && batsmanInTeam.id === currentStrikerFromPlayersState.id) {
            processedBatsman = {
                ...batsmanInTeam,
                runs: currentStrikerFromPlayersState.runs || 0,
                balls: currentStrikerFromPlayersState.balls || 0,
                fours: currentStrikerFromPlayersState.fours || 0,
                sixes: currentStrikerFromPlayersState.sixes || 0,
                isOut: !!currentStrikerFromPlayersState.isOut,
                outType: currentStrikerFromPlayersState.outType || '',
            };
        }
        else if (currentNonStrikerFromPlayersState && batsmanInTeam.id === currentNonStrikerFromPlayersState.id) {
            processedBatsman = {
                ...batsmanInTeam,
                runs: currentNonStrikerFromPlayersState.runs || 0,
                balls: currentNonStrikerFromPlayersState.balls || 0,
                fours: currentNonStrikerFromPlayersState.fours || 0,
                sixes: currentNonStrikerFromPlayersState.sixes || 0,
                isOut: !!currentNonStrikerFromPlayersState.isOut,
                outType: currentNonStrikerFromPlayersState.outType || '',
            };
        } else {
            processedBatsman.isOut = !!processedBatsman.isOut;
            processedBatsman.runs = processedBatsman.runs || 0;
            processedBatsman.balls = processedBatsman.balls || 0;
            processedBatsman.fours = processedBatsman.fours || 0;
            processedBatsman.sixes = processedBatsman.sixes || 0;
            processedBatsman.outType = processedBatsman.outType || '';
        }

        const actualRuns = processedBatsman.runs;
        const actualBalls = processedBatsman.balls;
        const isEffectivelyOut = processedBatsman.isOut || 
                                 (processedBatsman.outType && 
                                  processedBatsman.outType.toLowerCase() !== 'not out' && 
                                  processedBatsman.outType.toLowerCase() !== '');


        let atCreaseStatus = false;
        if (!isEffectivelyOut) {
            if (currentStrikerFromPlayersState && batsmanInTeam.id === currentStrikerFromPlayersState.id) {
                atCreaseStatus = true;
            } else if (currentNonStrikerFromPlayersState && batsmanInTeam.id === currentNonStrikerFromPlayersState.id) {
                atCreaseStatus = true;
            }
        }

        return {
            id: processedBatsman.id, name: processedBatsman.name, runs: actualRuns,
            balls: actualBalls, fours: processedBatsman.fours, sixes: processedBatsman.sixes,
            isOut: isEffectivelyOut, outType: processedBatsman.outType,
            strikeRate: actualBalls > 0 ? ((actualRuns / actualBalls) * 100).toFixed(2) : "0.00",
            status: isEffectivelyOut
                ? (processedBatsman.outType || 'Out')
                : atCreaseStatus
                    ? 'Not Out'
                    : (actualBalls > 0 || actualRuns > 0 ? 'Not Out' : 'Did Not Bat'),
            atCrease: atCreaseStatus
        };
    });
};

const formatBatsmenForSummary = (batsmenList = []) =>
  batsmenList.map(b => ({
    id: b.id, name: b.name, runs: b.runs || 0, balls: b.balls || 0,
    fours: b.fours || 0, sixes: b.sixes || 0, isOut: b.isOut || false,
    outType: b.outType || '',
    strikeRate: b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00",
    status: b.isOut ? b.outType : (b.balls > 0 ? 'Not Out' : 'Did Not Bat')
  }));

const formatBowlersForSummary = (bowlersList = [], ballsPerOverSettings) => {
  return bowlersList.map(b => {
    const allSpells = [...(b.previousSpells || []), ...(b.currentSpell ? [b.currentSpell] : [])];
    const totals = allSpells.reduce((acc, spell) => ({
        balls: acc.balls + (spell.balls || 0), runs: acc.runs + (spell.runs || 0),
        wickets: acc.wickets + (spell.wickets || 0), maidens: acc.maidens + (spell.maidens || 0)
    }), { balls: 0, runs: 0, wickets: 0, maidens: 0 });
    return {
        name: b.name,
        overs: `${Math.floor(totals.balls / ballsPerOverSettings)}.${totals.balls % ballsPerOverSettings}`,
        runs: totals.runs, wickets: totals.wickets, maidens: totals.maidens,
        economyRate: totals.balls > 0 ? ((totals.runs / totals.balls) * ballsPerOverSettings).toFixed(2) : "0.00"
    };
  });
};

const formatBatsmenForUpdate = (batsmenList = []) =>
  batsmenList.map(b => ({
    id: b.id, name: b.name, runs: b.runs || 0, balls: b.balls || 0,
    fours: b.fours || 0, sixes: b.sixes || 0, isOut: b.isOut || false,
    outType: b.outType || '',
    strikeRate: b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00",
    status: b.isOut ? b.outType : (b.balls > 0 ? 'Not Out' : 'Did Not Bat')
  }));

const formatBowlersForUpdate = (bowlersList = [], ballsPerOverSettings) => {
  return bowlersList.map(b => {
    const allSpells = [...(b.previousSpells || []), ...(b.currentSpell ? [b.currentSpell] : [])];
    const totals = allSpells.reduce((acc, spell) => ({
        balls: acc.balls + (spell.balls || 0), runs: acc.runs + (spell.runs || 0),
        wickets: acc.wickets + (spell.wickets || 0), maidens: acc.maidens + (spell.maidens || 0)
    }), { balls: 0, runs: 0, wickets: 0, maidens: 0 });
    return {
        name: b.name,
        overs: `${Math.floor(totals.balls / ballsPerOverSettings)}.${totals.balls % ballsPerOverSettings}`,
        runs: totals.runs, wickets: totals.wickets, maidens: totals.maidens,
        economyRate: totals.balls > 0 ? ((totals.runs / totals.balls) * ballsPerOverSettings).toFixed(2) : "0.00"
    };
  });
};

const calculateNetRunRates = (innings1, innings2, settings) => {
  if (!innings1?.teamName || !innings2?.teamName) return {};
  const { ballsPerOver, playersPerTeam, overs: maxOvers } = settings;
  const team1Name = innings1.teamName; const team2Name = innings2.teamName;
  const parseOvers = (oversStr) => {
    if (!oversStr) return 0;
    const [overInt, balls] = String(oversStr).split('.').map(Number);
    return (overInt || 0) + ((balls || 0) / ballsPerOver);
  };
  const team1AllOut = innings1.wickets === playersPerTeam - 1;
  const team2AllOut = innings2.wickets === playersPerTeam - 1;
  const team1Runs = innings1.runs || 0; const team2Runs = innings2.runs || 0;
  const team1OversFaced = team1AllOut ? maxOvers : parseOvers(innings1.overs);
  const team2OversFaced = team2AllOut ? maxOvers : parseOvers(innings2.overs);
  const team1RunRate = team1OversFaced > 0 ? (team1Runs / team1OversFaced) : 0;
  const team2RunRate = team2OversFaced > 0 ? (team2Runs / team2OversFaced) : 0;
  return {
    [team1Name]: (team1RunRate - team2RunRate).toFixed(3),
    [team2Name]: (team2RunRate - team1RunRate).toFixed(3),
  };
};

const ScorecardPage = ({ matchSettings, onMatchEnd, onExitMatch, onShowFullScorecard }) => {
  
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [initialState] = useState(() => createInitialState(matchSettings));
  
  const [settings, setSettings] = useState(initialState.settings);
  const [match, setMatch] = useState(initialState.match);
  const [teams, setTeams] = useState(initialState.teams);
  const [players, setPlayers] = useState(initialState.players);


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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [allOversHistory, setAllOversHistory] = useState([]);
  const [showPrevOversModal, setShowPrevOversModal] = useState(false);

  const stateRef = useRef(); // Create the ref
  stateRef.current = { match, teams, players, settings, allOversHistory, overHistory };
  const debounceTimeout = useRef(null);
  const lastCompletedOverBallCount = useRef(0);
  const lastSavedState = useRef(null);
  

  // Calculate derived values
  const { runs, balls } = match; // Destructure runs and balls from the match state

  const overs = `${Math.floor(balls / settings.ballsPerOver)}.${balls % settings.ballsPerOver}`;
  const crr = balls > 0 ? (runs / (balls / settings.ballsPerOver)).toFixed(2) : "0.00";
  const remainingBalls = (settings.overs * settings.ballsPerOver) - balls;
  const remainingRuns = match.target - runs;
  const requiredRunRate = remainingBalls > 0 ? (remainingRuns / (remainingBalls / settings.ballsPerOver)).toFixed(2) : '0.00';


  const saveState = useCallback(() => {
    setHistory(prev => [...prev.slice(-9), {
      match: JSON.parse(JSON.stringify(match)),
      players: JSON.parse(JSON.stringify(players)),
      overHistory: [...overHistory],
      lastCompletedOverBallCount: lastCompletedOverBallCount.current,
    }]);
  }, [match, players, overHistory]);







// In ScoreCard.jsx, add this new helper function

// This function reconstructs the full team stats by replaying the match history.
const rehydrateTeamsFromHistory = (settings, allOversHistory) => {
  // Start with a fresh, clean team structure
  const freshState = createInitialState(settings);
  const rehydratedTeams = JSON.parse(JSON.stringify(freshState.teams));

  if (!allOversHistory || allOversHistory.length === 0) {
    return rehydratedTeams; // Return fresh teams if there's no history to replay
  }

  // A helper to find a player in the teams object and initialize their stats if needed
  const getPlayer = (teamName, playerName, playerType) => {
    const teamKey = rehydratedTeams.teamA.name === teamName ? 'teamA' : 'teamB';
    const playerList = playerType === 'batsman' ? rehydratedTeams[teamKey].batsmen : rehydratedTeams[teamKey].bowlers;
    const player = playerList.find(p => p.name === playerName);
    
    if (player) {
      // Initialize stats objects if they don't exist
      if (playerType === 'batsman') {
        if (player.runs === undefined) {
          player.runs = 0; player.balls = 0; player.fours = 0; player.sixes = 0; player.isOut = false; player.status = 'Did Not Bat';
        }
      } else { // Bowler
        if (!player.currentSpell) {
          player.currentSpell = { runs: 0, wickets: 0, balls: 0, maidens: 0 };
          player.previousSpells = [];
        }
      }
    }
    return player;
  };

  // Replay history in chronological order
  const historyToReplay = [...allOversHistory].reverse();

  historyToReplay.forEach(over => {
    // This is a simplified rehydration logic.
    // It processes the totals from each over summary.
    const bowler = getPlayer(over.bowlingTeamName, over.bowlerName, 'bowler');
    if (bowler) {
      bowler.currentSpell.runs += over.runs || 0;
      bowler.currentSpell.wickets += over.wickets || 0;
      bowler.currentSpell.balls += over.balls.length || 0; // Approximate balls from length
      if (over.maiden) {
        bowler.currentSpell.maidens += 1;
      }
      // Archive the spell at the end of each replayed over
      bowler.previousSpells.push(bowler.currentSpell);
      bowler.currentSpell = { runs: 0, wickets: 0, balls: 0, maidens: 0 };
    }
    // Note: Rebuilding batsman stats ball-by-ball is very complex.
    // This simplified model focuses on getting bowler stats right, which are often heavier.
  });

  return rehydratedTeams;
};


const stateHasChanged = useCallback(() => {
  // Combine all relevant state into a single object
  const currentState = {
    settings,
    match,
    teams,
    players,
    overHistory,
    allOversHistory
  };

  // Convert the current state to a string for comparison
  const currentStateString = JSON.stringify(currentState);

  // If the new string is different from the last saved one, the state has changed.
  if (currentStateString !== lastSavedState.current) {
    lastSavedState.current = currentStateString; // Update the ref with the new state
    return true; // Return true to indicate a change
  }

  return false; // Return false if nothing has changed
}, [settings, match, teams, players, overHistory, allOversHistory]);


const sendMatchUpdate = useCallback(async () => {
    const backendMatchId = matchSettings?._id || match?._id;

    // Don't try to save guest matches to the server
    if (!backendMatchId || backendMatchId.startsWith('guest_')) {
        return;
    }

    // If the user is logged in, they must have a token to save data.
    if (!user || !user.token) {
        console.error("❌ Cannot update match - User is not logged in or token is missing.");
        return;
    }

    try {
        // Ensure the Authorization header is properly formatted
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
            }
        };

        const currentBattingTeamKey = teams.teamA.name === match.battingTeam ? 'teamA' : 'teamB';
        const currentBowlingTeamKey = currentBattingTeamKey === 'teamA' ? 'teamB' : 'teamA';

        if (!teams[currentBattingTeamKey] || !teams[currentBowlingTeamKey]) {
            console.error("❌ Critical error: Could not determine current teams for update.");
            return;
        }

        const updatePayload = {
            status: match.isComplete ? "completed" : "in_progress",
            currentInningsNumber: match.innings,
            inningsUpdate: {
                teamName: teams[currentBattingTeamKey].name,
                runs: match.runs || 0,
                wickets: match.wickets || 0,
                overs: match.balls ? `${Math.floor(match.balls / settings.ballsPerOver)}.${match.balls % settings.ballsPerOver}` : "0.0",
                runRate: match.balls > 0 ? (match.runs / (match.balls / settings.ballsPerOver)).toFixed(2) : "0.00",
                extras: match.extras || { total: 0 },
                fallOfWickets: match.fallOfWickets || [],
                batting: formatBatsmenForUpdate(teams[currentBattingTeamKey].batsmen),
                bowling: formatBowlersForUpdate(teams[currentBowlingTeamKey].bowlers, settings.ballsPerOver),
                target: match.innings === 2 ? match.target : null,
            },
        };

        const response = await axios.put(
          `${API_BASE}/api/matches/${backendMatchId}`,
          updatePayload,
          config
        );

        console.log("✅ Match updated successfully on server:", response.data.message);
        return response.data;

    } catch (error) {
        console.error("❌ Error sending match update to server:", {
            message: error.message,
            response: error.response?.data,
        });
        return null;
    }
}, [match, teams, settings, matchSettings, user]);



  
  // Undo functionality
const handleUndo = () => {
  if (history.length === 0) return;

  const previousState = history[history.length - 1];

  // Restore the primary, fast-moving states directly from history
  setMatch(previousState.match);
  setPlayers(previousState.players);
  setOverHistory(previousState.overHistory);
  
  // Synchronize the main 'teams' state to match the reverted player stats
  setTeams(currentTeams => {
      const updatedTeams = JSON.parse(JSON.stringify(currentTeams)); // Deep copy for safe mutation
      
      // Get team details from the previous state for accuracy
      const battingTeamName = previousState.match.battingTeam;
      const bowlingTeamName = previousState.match.bowlingTeam;
      const battingKey = updatedTeams.teamA.name === battingTeamName ? 'teamA' : 'teamB';
      const bowlingKey = updatedTeams.teamA.name === bowlingTeamName ? 'teamA' : 'teamB';

      // --- Helper to revert a batsman's stats in the main list ---
      const revertBatsman = (batsmanToRevert) => {
          if (!batsmanToRevert) return;
          const batsmanInList = updatedTeams[battingKey]?.batsmen.find(b => b.id === batsmanToRevert.id);
          if (batsmanInList) {
              // **FIX**: Revert all relevant batting stats, including out status
              batsmanInList.runs = batsmanToRevert.runs || 0;
              batsmanInList.balls = batsmanToRevert.balls || 0;
              batsmanInList.fours = batsmanToRevert.fours || 0;
              batsmanInList.sixes = batsmanToRevert.sixes || 0;
              batsmanInList.isOut = batsmanToRevert.isOut || false;
              batsmanInList.outType = batsmanToRevert.outType || '';
              batsmanInList.status = batsmanToRevert.status || 'Did Not Bat';
          }
      };
      
      // Revert stats for both the striker and non-striker from the previous state
      revertBatsman(previousState.players.striker);
      revertBatsman(previousState.players.nonStriker);
      
      // --- Revert the bowler's current spell ---
      const bowlerToRevert = previousState.players.bowler;
      const bowlerInList = updatedTeams[bowlingKey]?.bowlers.find(b => b.id === bowlerToRevert.id);
      if (bowlerInList) {
          // **FIX**: Ensure the entire current spell is reverted
          bowlerInList.currentSpell = bowlerToRevert.currentSpell || { runs: 0, wickets: 0, balls: 0, maidens: 0 };
      }
      
      return updatedTeams;
  });

  // Restore the ref values for over tracking
  lastCompletedOverBallCount.current = previousState.lastCompletedOverBallCount;

  // Remove the state we just restored from the history array
  setHistory(prev => prev.slice(0, -1));
  
  // Reset any selected action in the UI
  setShowModal(null);
};


// 2. Update bowler stats in real-time (after every ball)
const updateBowlerStats = (runs = 0, isWicket = false, countBall = true) => {
  const currentBowlingTeamKey = match.innings === 1 ? 'teamB' : 'teamA';
  const bowlerId = players.bowler.id;

  setTeams(prevTeams => {
    const updatedTeams = { ...prevTeams };
    updatedTeams[currentBowlingTeamKey] = {
      ...updatedTeams[currentBowlingTeamKey],
      bowlers: updatedTeams[currentBowlingTeamKey].bowlers.map(bowler => {
        if (bowler.id === bowlerId) {
          const updatedSpell = { 
            ...bowler.currentSpell,
            runs: bowler.currentSpell.runs + runs,
            wickets: isWicket ? bowler.currentSpell.wickets + 1 : bowler.currentSpell.wickets
          };
          
          // Only count the ball if it's a legal delivery
          if (countBall) {
            updatedSpell.balls = bowler.currentSpell.balls + 1;
            
            // Check for maiden over (no runs conceded in completed over)
            if (updatedSpell.balls % settings.ballsPerOver === 0 && 
                updatedSpell.runs === 0) {
              updatedSpell.maidens = bowler.currentSpell.maidens + 1;
            }
          }

          return {
            ...bowler,
            currentSpell: updatedSpell
          };
        }
        return bowler;
      })
    };
    return updatedTeams;
  });

  // Also update the bowler in the players state if it's the current bowler
  setPlayers(prev => {
    if (prev.bowler.id === bowlerId) {
      return {
        ...prev,
        bowler: {
          ...prev.bowler,
          currentSpell: {
            ...prev.bowler.currentSpell,
            runs: prev.bowler.currentSpell.runs + runs,
            wickets: isWicket ? prev.bowler.currentSpell.wickets + 1 : prev.bowler.currentSpell.wickets,
            balls: countBall ? prev.bowler.currentSpell.balls + 1 : prev.bowler.currentSpell.balls
          }
        }
      };
    }
    return prev;
  });
};


  // Handle runs scoring
const handleRuns = (runsScored) => {
  if (isLoading) {
    console.warn("Cannot score - match is still loading");
    return;
  }

    saveState();
    const strikerId = players.striker.id;
    const currentBattingTeamKey = teams.teamA.name === match.battingTeam ? 'teamA' : 'teamB';
    const currentBowlingTeamKey = currentBattingTeamKey === 'teamA' ? 'teamB' : 'teamA';

    setMatch(prev => ({
      ...prev,
      runs: prev.runs + runsScored,
      balls: prev.balls + 1,
    }));

    setTeams(prevTeams => {
      const updatedTeams = JSON.parse(JSON.stringify(prevTeams));
      
      // Update bowler's spell
      const bowlerToUpdate = updatedTeams[currentBowlingTeamKey]?.bowlers.find(b => b.id === players.bowler.id);
      if (bowlerToUpdate) {
        // **FIX**: Initialize the spell if it doesn't exist
        if (!bowlerToUpdate.currentSpell) {
            bowlerToUpdate.currentSpell = { runs: 0, wickets: 0, balls: 0, maidens: 0 };
        }
        bowlerToUpdate.currentSpell.runs += runsScored;
        bowlerToUpdate.currentSpell.balls += 1;
      }

      // Update striker's score
      const batsmanToUpdate = updatedTeams[currentBattingTeamKey]?.batsmen.find(b => b.id === strikerId);
      if (batsmanToUpdate) {
        // **FIX**: Initialize stats with || 0 before adding to them
        batsmanToUpdate.runs = (batsmanToUpdate.runs || 0) + runsScored;
        batsmanToUpdate.balls = (batsmanToUpdate.balls || 0) + 1;
        if (runsScored === 4) batsmanToUpdate.fours = (batsmanToUpdate.fours || 0) + 1;
        if (runsScored === 6) batsmanToUpdate.sixes = (batsmanToUpdate.sixes || 0) + 1;
        batsmanToUpdate.status = 'Not Out';
      }
      return updatedTeams;
    });

    setPlayers(prev => {
      const updatedStriker = {
        ...prev.striker,
        runs: (prev.striker.runs || 0) + runsScored,
        balls: (prev.striker.balls || 0) + 1,
        fours: runsScored === 4 ? (prev.striker.fours || 0) + 1 : (prev.striker.fours || 0),
        sixes: runsScored === 6 ? (prev.striker.sixes || 0) + 1 : (prev.striker.sixes || 0),
      };
      
      const strikeRotated = runsScored % 2 !== 0;
      return {
        ...prev,
        striker: strikeRotated ? prev.nonStriker : updatedStriker,
        nonStriker: strikeRotated ? updatedStriker : prev.nonStriker,
      };
    });

    setOverHistory(prev => [...prev, runsScored.toString()]);
    setShowModal(null);
};


    // Handle extras
  const handleExtras = (type, runsFromExtras = 0) => {
    if (isLoading) {
    console.warn("Cannot score - match is still loading");
    return;
  }

    saveState();
    const strikerId = players.striker.id;
    const currentBattingTeamKey = teams.teamA.name === match.battingTeam ? 'teamA' : 'teamB';
    const currentBowlingTeamKey = currentBattingTeamKey === 'teamA' ? 'teamB' : 'teamA';

    let teamRuns = 0;
    let bowlerRuns = 0;
    let isLegalDelivery = true;
    let ballIsFacedByBatsman = false;

    // Determine how runs and balls are counted for each extra type
    switch (type) {
      case 'WD':
        teamRuns = settings.wideBallRuns + runsFromExtras; // All runs on a wide are extras
        bowlerRuns = teamRuns; // Wides count against the bowler
        isLegalDelivery = false; // Does not count as a ball in the over
        ballIsFacedByBatsman = false;
        break;
      case 'NB':
        teamRuns = settings.noBallRuns + runsFromExtras;
        bowlerRuns = teamRuns; // No Balls (penalty + runs off bat) count against the bowler
        isLegalDelivery = false; // Does not count as a ball in the over
        ballIsFacedByBatsman = true; // The delivery is still faced by the batsman
        break;
      case 'BYE':
      case 'LB':
        teamRuns = runsFromExtras;
        bowlerRuns = 0;      // Byes and Leg Byes do not count against the bowler
        isLegalDelivery = true; // Counts as a legal ball
        ballIsFacedByBatsman = true;
        break;
      default:
        break;
    }

    // 1. Update overall match state (total score, total balls, extras breakdown)
    setMatch(prev => {
        const newExtras = {...prev.extras};
        if (type === 'WD') newExtras.wides = (newExtras.wides || 0) + teamRuns;
        if (type === 'NB') newExtras.noBalls = (newExtras.noBalls || 0) + teamRuns; // Only penalty is a "no ball" extra
        if (type === 'BYE') newExtras.byes = (newExtras.byes || 0) + teamRuns;
        if (type === 'LB') newExtras.legByes = (newExtras.legByes || 0) + teamRuns;
        newExtras.total = (newExtras.total || 0) + teamRuns;

        return {
            ...prev,
            runs: prev.runs + teamRuns,
            balls: isLegalDelivery ? prev.balls + 1 : prev.balls,
            extras: newExtras,
        };
    });

    // 2. Update bowler's spell in the main `teams` state
    updateBowlerStats(bowlerRuns, false, isLegalDelivery);

    // 3. Update batsman's stats (if applicable) in the main `teams` state
    setTeams(prevTeams => {
        const updatedTeams = JSON.parse(JSON.stringify(prevTeams));
        const batsmanToUpdate = updatedTeams[currentBattingTeamKey]?.batsmen.find(b => b.id === strikerId);

        if (batsmanToUpdate) {
            // A ball is "faced" for NB, BYE, and LB, so increment the batsman's ball count.
            if (ballIsFacedByBatsman) {
              batsmanToUpdate.balls += 1;
            }
            // Runs from a No Ball are NOT added to the batsman's score.
        }
        return updatedTeams;
    });

    // 4. Update the local `players` state (for UI) and handle strike rotation
    setPlayers(prev => {
      const updatedStriker = { ...prev.striker };
      if(ballIsFacedByBatsman) {
          updatedStriker.balls = (updatedStriker.balls || 0) + 1;
      }

      // Strike rotates based on the runs physically taken by the batsmen
      const runsPhysicallyRun = (type === 'WD' || type === 'BYE' || type === 'LB' || type === 'NB') ? runsFromExtras : 0;
      const strikeRotated = runsPhysicallyRun % 2 !== 0;

      return {
        ...prev,
        striker: strikeRotated ? prev.nonStriker : updatedStriker,
        nonStriker: strikeRotated ? updatedStriker : prev.nonStriker
      };
    });
    
    // 5. Update UI and send data
    setOverHistory(prev => [...prev, `${runsFromExtras > 0 ? runsFromExtras : ''}${type}`]);
    setShowModal(null);
    setSelectedAction(null);
    // sendMatchUpdate(); // Consider calling this after state updates have settled
  };


const onOverComplete = useCallback(() => {
  // Save state before making any changes
  saveState();
  
  const overNumber = Math.floor(match.balls / settings.ballsPerOver);
  const bowlerId = players.bowler.id;
  const currentBowlingTeamKey = teams.teamA.name === match.bowlingTeam ? 'teamA' : 'teamB';
  const bowlerInState = teams[currentBowlingTeamKey]?.bowlers.find(b => b.id === bowlerId);
  
  if (!bowlerInState) return;
  
  const completedSpell = { ...bowlerInState.currentSpell };
  
  // Add to previous overs history
  const completedOverData = {
    overNumber: overNumber,
    bowlerName: players.bowler.name,
    balls: [...overHistory],
    runs: completedSpell.runs,
    wickets: completedSpell.wickets,
    maiden: completedSpell.runs === 0 && completedSpell.balls === settings.ballsPerOver
  };
  
  setAllOversHistory(prev => {
    const newHistory = [completedOverData, ...prev].slice(0, 20);
    localStorage.setItem(`oversHistory_${matchId}`, JSON.stringify(newHistory));
    return newHistory;
  });

  // Archive bowler's spell and reset it
  setTeams(prevTeams => {
    const updatedTeams = JSON.parse(JSON.stringify(prevTeams));
    const bowlerToUpdate = updatedTeams[currentBowlingTeamKey]?.bowlers.find(b => b.id === bowlerId);
    if (bowlerToUpdate) {
      bowlerToUpdate.previousSpells.push(completedSpell);
      bowlerToUpdate.currentSpell = { runs: 0, wickets: 0, balls: 0, maidens: 0 };
    }
    return updatedTeams;
  });

  // Find next bowler (excluding the last bowler if needed)
  const allBowlers = teams[currentBowlingTeamKey].bowlers;
  const currentBowlerIndex = allBowlers.findIndex(b => b.id === bowlerId);
  
  let nextBowler = players.bowler;
  if (currentBowlerIndex !== -1 && allBowlers.length > 0) {
    const nextBowlerIndex = (currentBowlerIndex + 1) % allBowlers.length;
    nextBowler = allBowlers[nextBowlerIndex];
  }

  // Update players state with new bowler and rotated strike
  setPlayers(prev => ({
    ...prev,
    striker: prev.nonStriker,
    nonStriker: prev.striker,
    bowler: nextBowler,
    lastBowler: bowlerId
  }));

  // Reset for next over
  setOverHistory([]);
}, [match, players, teams, settings, overHistory, saveState, setAllOversHistory]);



const handleWicket = useCallback((dismissalInfo) => {
  if (isLoading) {
    console.warn("Cannot score - match is still loading");
    return;
  }

    saveState();

    // --- 1. Get Dismissal Details, now including 'isWide' flag ---
    const { type: outType, runsCompleted = 0, batsmanOut, isNoBall = false, isWide = false } = dismissalInfo;
    const isRunOut = outType === 'Run Out';
    
    const currentBattingTeamKey = teams.teamA.name === match.battingTeam ? 'teamA' : 'teamB';

    // --- 2. Correctly Identify BOTH Batsmen Involved ---
    let dismissedBatsman;
    let partnerBatsman;
    if (isRunOut || outType === 'Retired Out') {
        if (batsmanOut === 'nonStriker') {
            dismissedBatsman = { ...players.nonStriker };
            partnerBatsman = { ...players.striker };
        } else {
            dismissedBatsman = { ...players.striker };
            partnerBatsman = { ...players.nonStriker };
        }
    } else {
        dismissedBatsman = { ...players.striker };
        partnerBatsman = { ...players.nonStriker };
    }

    // --- 3. Update Bowler Stats with No Ball & Wide awareness ---
    const isBowlerWicket = !isRunOut && outType !== 'Retired Out';
    const runsForBowler = isNoBall ? (runsCompleted + settings.noBallRuns) : isWide ? (runsCompleted + settings.wideBallRuns) : runsCompleted;
    const countBallForBowler = !isNoBall && !isWide; // Don't count ball for NB or WD
    updateBowlerStats(runsForBowler, isBowlerWicket, countBallForBowler);

    // --- 4. Update Match Score, Balls, and Extras ---
    setMatch(prev => {
        const penaltyRuns = isNoBall ? settings.noBallRuns : (isWide ? settings.wideBallRuns : 0);
        const newRuns = prev.runs + runsCompleted + penaltyRuns;
        const newWickets = prev.wickets + 1;
        const newBalls = (isNoBall || isWide) ? prev.balls : prev.balls + 1; // No ball counted for illegal deliveries
        
        const newExtras = {...(prev.extras || { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 })};
        if (isNoBall) {
            const totalNoBallRuns = settings.noBallRuns + runsCompleted;
            newExtras.noBalls = (newExtras.noBalls || 0) + totalNoBallRuns;
            newExtras.total = (newExtras.total || 0) + totalNoBallRuns;
        }
        if (isWide) {
            const totalWideRuns = settings.wideBallRuns + runsCompleted;
            newExtras.wides = (newExtras.wides || 0) + totalWideRuns;
            newExtras.total = (newExtras.total || 0) + totalWideRuns;
        }

        return {
            ...prev,
            runs: newRuns,
            wickets: newWickets,
            balls: newBalls,
            extras: newExtras,
            fallOfWickets: [
                ...(prev.fallOfWickets || []),
                {
                    batsman: dismissedBatsman.name,
                    score: newRuns,
                    wicket: newWickets,
                    over: `${Math.floor(newBalls / settings.ballsPerOver)}.${newBalls % settings.ballsPerOver}`
                }
            ]
        };
    });
    
    // --- 5. Update Batsman Stats ---
    setTeams(prevTeams => {
        const updatedBatsmen = prevTeams[currentBattingTeamKey].batsmen.map(b => {
            if (b.id === dismissedBatsman.id) {
                return { 
                    ...b, 
                    runs: b.runs + (isWide ? 0 : runsCompleted), // Batsman doesn't get runs on a wide
                    balls: b.balls + ((isNoBall || isWide) ? 0 : 1), // Ball doesn't count if illegal
                    isOut: true, 
                    outType: outType, 
                    status: `${outType} ${isNoBall ? '(NB)' : (isWide ? '(WD)' : '')}`
                };
            }
            return b;
        });
        return { 
            ...prevTeams, 
            [currentBattingTeamKey]: { 
                ...prevTeams[currentBattingTeamKey], 
                batsmen: updatedBatsmen 
            } 
        };
    });

    // --- 6. Bring in New Batsman ---
    if (match.wickets < settings.playersPerTeam - 1) {
        const availableBatsmen = teams[currentBattingTeamKey].batsmen.filter(
            b => !b.isOut && 
                 b.id !== partnerBatsman.id && 
                 b.id !== dismissedBatsman.id
        );
        const nextBatsman = availableBatsmen[0];
        if (nextBatsman) {
            const batsmenCrossed = runsCompleted % 2 !== 0;
            const newStriker = batsmenCrossed ? partnerBatsman : nextBatsman;
            const newNonStriker = batsmenCrossed ? nextBatsman : partnerBatsman;
            setPlayers(prev => ({ ...prev, striker: newStriker, nonStriker: newNonStriker }));
        }
    }

    // --- 7. Update UI ---
    const historyMark = isNoBall ? `${runsCompleted > 0 ? runsCompleted : ''}NB+W` : (isWide ? `${runsCompleted > 0 ? runsCompleted : ''}WD+W` : 'W');
    setOverHistory(prev => [...prev, historyMark]);
    setShowModal(null);
    setSelectedAction(null);
    sendMatchUpdate();

}, [saveState, match, players, teams, settings, updateBowlerStats, sendMatchUpdate]);



const startSecondInnings = useCallback(() => {
  console.log("🔄 Starting second innings setup...");

  // Step 1: Validate match state
  if (!match || typeof match.runs !== "number" || typeof match.wickets !== "number") {
    console.error("❌ Cannot start second innings: Incomplete match state.");
    return;
  }

  if (!teams?.teamA?.batsmen || !teams?.teamB?.batsmen) {
    console.error("❌ Cannot start second innings: Teams are not set up correctly.");
    return;
  }

  // Step 2: Resolve team names from settings or match state
  const firstInningsActualBattingTeamName = match.battingTeam || (matchSettings?.firstBatting || teams.teamA.name);
  const firstInningsActualBowlingTeamName = match.bowlingTeam || (
    firstInningsActualBattingTeamName === teams.teamA.name ? teams.teamB.name : teams.teamA.name
  );

  const firstInningsBattingTeamKey = teams.teamA.name === firstInningsActualBattingTeamName ? 'teamA' : 'teamB';
  const firstInningsBowlingTeamKey = firstInningsBattingTeamKey === 'teamA' ? 'teamB' : 'teamA';

  if (!teams[firstInningsBattingTeamKey] || !teams[firstInningsBowlingTeamKey]) {
    console.error("❌ Critical error in startSecondInnings: Cannot determine team keys for first innings summary.");
    return;
  }

  // Step 3: Build complete over history for innings 1
  let completeHistoryForInnings1 = allOversHistory.filter(o => o.innings === 1);
  if (overHistory.length > 0) {
    completeHistoryForInnings1.unshift({
      overNumber: Math.floor(match.balls / settings.ballsPerOver) + 1,
      bowlerName: players.bowler.name,
      balls: [...overHistory],
      innings: 1
    });
  }

  const formatBowlersForSummaryInContext = (bowlersList = [], ballsPerOverSettings) => {
    return bowlersList.map(b => {
      const allSpells = [...(b.previousSpells || [])];
      if (b.currentSpell && (b.currentSpell.balls > 0 || b.currentSpell.runs > 0 || b.currentSpell.wickets > 0)) {
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
        overs: `${Math.floor(totalBalls / ballsPerOverSettings)}.${totalBalls % ballsPerOverSettings}`,
        runs: totalRunsConceded,
        wickets: totalWicketsTaken,
        maidens: totalMaidens,
        economyRate: totalBalls > 0 ? ((totalRunsConceded / totalBalls) * ballsPerOverSettings).toFixed(2) : "0.00",
      };
    });
  };

  // Step 4: Prepare innings 1 summary
  const innings1CompleteSummary = {
    teamName: teams[firstInningsBattingTeamKey].name,
    battingTeam: teams[firstInningsBattingTeamKey].name,
    bowlingTeam: teams[firstInningsBowlingTeamKey].name,
    batting: formatBatsmenForSummary(
      teams[firstInningsBattingTeamKey].batsmen,
      players.striker,
      players.nonStriker
    ),
    bowling: formatBowlersForSummaryInContext(
      teams[firstInningsBowlingTeamKey].bowlers,
      settings.ballsPerOver
    ),
    runs: match.runs,
    wickets: match.wickets,
    overs: `${Math.floor(match.balls / settings.ballsPerOver)}.${match.balls % settings.ballsPerOver}`,
    extras: { ...(match.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 }) },
    fallOfWickets: [...(match.fallOfWickets || [])],
    runRate: match.balls > 0 ? (match.runs / (match.balls / settings.ballsPerOver)).toFixed(2) : "0.00",
    overHistory: completeHistoryForInnings1
  };

  console.log("✅ First Innings Summary Prepared:", innings1CompleteSummary);

  // Step 5: Setup second innings
  const secondInningsBattingTeamName = firstInningsActualBowlingTeamName;
  const secondInningsBowlingTeamName = firstInningsActualBattingTeamName;
  const secondInningsBattingTeamKey = teams.teamA.name === secondInningsBattingTeamName ? 'teamA' : 'teamB';
  const secondInningsBowlingTeamKey = teams.teamA.name === secondInningsBowlingTeamName ? 'teamA' : 'teamB';

  setTeams(prevTeams => {
    const newTeams = JSON.parse(JSON.stringify(prevTeams));
    if (newTeams[secondInningsBattingTeamKey]) {
      newTeams[secondInningsBattingTeamKey].batsmen = newTeams[secondInningsBattingTeamKey].batsmen.map(b => ({
        ...b,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        isOut: false,
        outType: '',
        strikeRate: '0.00',
        status: 'Did Not Bat',
        atCrease: false,
      }));
    }

    if (newTeams[secondInningsBowlingTeamKey]) {
      newTeams[secondInningsBowlingTeamKey].bowlers = newTeams[secondInningsBowlingTeamKey].bowlers.map(b => ({
        ...b,
        previousSpells: [],
        currentSpell: {
          runs: 0,
          wickets: 0,
          balls: 0,
          maidens: 0
        }
      }));
    }

    return newTeams;
  });

  // Step 6: Set match state for second innings
  setMatch(prev => ({
    ...prev,
    _id: prev._id || matchId,
    innings: 2,
    isChasing: true,
    target: prev.runs + 1,
    firstInningsSummary: innings1CompleteSummary,
    runs: 0,
    wickets: 0,
    balls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
    fallOfWickets: [],
    battingTeam: secondInningsBattingTeamName,
    bowlingTeam: secondInningsBowlingTeamName,
    isComplete: false,
  }));

  // Step 7: Reset player state
  const newStriker = teams[secondInningsBattingTeamKey]?.batsmen[0];
  const newNonStriker = teams[secondInningsBattingTeamKey]?.batsmen[1];
  const newBowler = teams[secondInningsBowlingTeamKey]?.bowlers[0];

  setPlayers({
    striker: newStriker ? { ...newStriker, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, outType: '', status: 'Not Out' } : {
      id: uuidv4(),
      name: `${secondInningsBattingTeamName} Batsman 1`,
      runs: 0,
      balls: 0,
      isOut: false,
      outType: '',
      status: 'Not Out'
    },
    nonStriker: newNonStriker ? { ...newNonStriker, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, outType: '', status: 'Not Out' } : {
      id: uuidv4(),
      name: `${secondInningsBattingTeamName} Batsman 2`,
      runs: 0,
      balls: 0,
      isOut: false,
      outType: '',
      status: 'Not Out'
    },
    bowler: newBowler ? {
      ...newBowler,
      currentSpell: { runs: 0, wickets: 0, balls: 0, maidens: 0 },
      previousSpells: []
    } : {
      id: uuidv4(),
      name: `${secondInningsBowlingTeamName} Bowler 1`,
      currentSpell: { runs: 0, wickets: 0, balls: 0, maidens: 0 },
      previousSpells: []
    },
    nextBatsmanId: (newNonStriker?.id || 1) + 1,
    lastBowler: null
  });

  // Step 8: Cleanup UI state
  setOverHistory([]);
  setSelectedAction(null);

  console.log(`✅ Second innings ready. Batting: ${secondInningsBattingTeamName}, Bowling: ${secondInningsBowlingTeamName}. Target: ${match.runs + 1}`);
  sendMatchUpdate();

}, [match, teams, players, settings, matchSettings, matchId, sendMatchUpdate]);



  
const endMatch = useCallback(async () => {
  console.log("[MATCH END] Starting match end process");
  const { match: currentMatch, teams: currentTeams, settings: currentSettings } = stateRef.current;

  if (currentMatch.isComplete) {
    console.warn("endMatch called but match is already complete.");
    return;
  }
  
  const finalMatchId = matchSettings?._id || currentMatch?._id;
  if (!finalMatchId) {
    alert("A critical error occurred: Match ID is missing. Cannot end match.");
    return;
  }

  // --- 1. Finalize Match State with Correct Result Logic ---
  const calculateFinalResult = (finalState, settings) => {
    if (finalState.innings < 2 || !finalState.target) return "Match Incomplete";
    const { runs, wickets, battingTeam, bowlingTeam, target } = finalState;

    // **FIX**: Corrected win/loss/tie logic
    if (runs >= target) {
      const wicketsRemaining = settings.playersPerTeam - 1 - wickets;
      return `${battingTeam} won by ${wicketsRemaining} wicket${wicketsRemaining !== 1 ? 's' : ''}`;
    } else if (runs === target - 1) {
      return "Match Tied";
    } else {
      const runMargin = target - 1 - runs;
      return `${bowlingTeam} won by ${runMargin} run${runMargin !== 1 ? 's' : ''}`;
    }
  };
  const finalMatchState = { 
    ...currentMatch, 
    isComplete: true, 
    status: "completed",
    result: calculateFinalResult(currentMatch, currentSettings)
  };

  // --- 2. Safely Prepare Innings Data ---
  const innings1Data = currentMatch.firstInningsSummary;
  let innings2Data = null;

  if (!innings1Data) {
    alert("Critical Error: First innings summary is missing. Cannot end match.");
    return;
  }

  if (currentMatch.innings === 2) {
    const battingKey = currentTeams.teamA.name === currentMatch.battingTeam ? 'teamA' : 'teamB';
    const bowlingKey = battingKey === 'teamA' ? 'teamB' : 'teamA';
    innings2Data = {
      battingTeam: currentMatch.battingTeam,
      bowlingTeam: currentMatch.bowlingTeam,
      runs: currentMatch.runs,
      wickets: currentMatch.wickets,
      overs: `${Math.floor(currentMatch.balls / currentSettings.ballsPerOver)}.${currentMatch.balls % currentSettings.ballsPerOver}`,
      batting: formatBatsmenForSummary(currentTeams[battingKey].batsmen),
      bowling: formatBowlersForSummary(currentTeams[bowlingKey].bowlers, currentSettings.ballsPerOver),
      extras: currentMatch.extras,
      fallOfWickets: currentMatch.fallOfWickets || [],
      target: currentMatch.target,
    };
  }

  // --- 3. Create Payloads with Correct Schema Structure ---
  const finalMatchDataPayload = { // For frontend navigation
    _id: finalMatchId,
    teamA: { name: currentTeams.teamA.name },
    teamB: { name: currentTeams.teamB.name },
    date: new Date().toISOString(),
    result: finalMatchState.result,
    innings1: innings1Data,
    innings2: innings2Data,
    matchSummary: {
      playerOfMatch: determinePlayerOfMatch(innings1Data, innings2Data),
      netRunRates: calculateNetRunRates(innings1Data, innings2Data, currentSettings)
    }
  };
  
  // **FIX**: This payload now perfectly matches your backend schema
  const finalApiPayload = {
    status: "completed",
    result: finalMatchState.result,
    innings1: innings1Data,
    innings2: innings2Data,
    matchSummary: finalMatchDataPayload.matchSummary
  };

  // --- 4. Save to Server and Navigate ---
  try {
    if (!finalMatchId.startsWith('guest_') && user?.token) {
      const config = { headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' } };
      await axios.put(`${API_BASE}/api/matches/${finalMatchId}/end`, finalApiPayload, config);
      console.log("✅ Final match data saved to server successfully.");
    }
    
    // **FIX**: Navigation now only happens AFTER a successful save.
    if (typeof onMatchEnd === 'function') {
      onMatchEnd(finalMatchDataPayload); 
    }

  } catch (error) {
    console.error("❌ Failed to save final match data to server:", {
        message: error.message,
        response: error.response?.data
    });
    alert("An error occurred while saving the final match results.");
  }
}, [matchSettings, onMatchEnd, user]); // **FIX**: Added matchSettings to dependency array

const socket = useMemo(() => io(import.meta.env.VITE_BACKEND_URL || "https://cric-score-app.onrender.com"), []);

// EFFECT 1: Load match state from server on mount
  useEffect(() => {
    const loadMatch = async () => {
        const currentMatchId = matchSettings?._id;
        if (!currentMatchId || currentMatchId.startsWith('guest_')) {
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            const config = { headers: { 'Authorization': `Bearer ${user.token}` } };
            const response = await axios.get(`${API_BASE}/api/matches/${currentMatchId}`, config);

            if (response.data.success) {
                const data = response.data.data;
                console.log("✅ State successfully loaded from server.", data);

                // **THE FIX IS HERE**:
                // Check if the server returned a 'liveState' object for resuming.
                if (data.settings && data.match && data.teams && data.players) {
                    // This is a liveState object for an in-progress match. Load it directly.
                    setSettings(data.settings);
                    setMatch(data.match);
                    setTeams(data.teams);
                    setPlayers(data.players);
                    setOverHistory(data.overHistory || []);
                    setAllOversHistory(data.allOversHistory || []);
                } else {
                // ✅ FIX: This is a fresh match document from the DB.
                // Initialize the entire component's state from this data.
                const initialStateFromDb = createInitialState(data);
                setSettings(initialStateFromDb.settings);
                setMatch(initialStateFromDb.match);
                setTeams(initialStateFromDb.teams);
                setPlayers(initialStateFromDb.players);
            }
            }
        } catch (error) {
            console.error("❌ Failed to load match from server", error);
        } finally {
            setIsLoading(false);
        }
    };

    const isResumption = !matchSettings?.teamA?.name;

    // Only call loadMatch() if it's a resumption scenario.
    if (user?.token && isResumption) {
        loadMatch();
    } else {
        // If it's a new match, just stop the loading spinner immediately.
        setIsLoading(false);
    }

    // Socket setup (this can remain as is)
    const currentMatchId = matchSettings?._id;
    if (currentMatchId) {
        socket.connect();
        socket.emit("join-match", currentMatchId);
    }
    return () => {
        if (currentMatchId) {
            socket.emit("leave-match", currentMatchId);
            socket.disconnect();
        }
    };
}, [matchSettings, user]);



  // EFFECT 2: Debounced save to server on state change
useEffect(() => {
  if (isLoading || match.isComplete || !match?._id || match._id.startsWith('guest_')) {
    return;
  }

  // Clear previous timer
  if (debounceTimeout.current) {
    clearTimeout(debounceTimeout.current);
  }

  // Only save if there are actual changes
  if (stateHasChanged()) { // Implement this function to check for meaningful changes
    debounceTimeout.current = setTimeout(() => {
      const saveUpdate = async () => {
        try {
          const config = { headers: { 'Authorization': `Bearer ${user.token}` } };
          await axios.put(`${API_BASE}/api/matches/${match._id}`, {
            settings, match, teams, players, overHistory, allOversHistory
          }, config);
        } catch (error) {
          console.error("Save error:", error);
        }
      };
      saveUpdate();
    }, 1000); // Reduced from 2000ms to 1000ms
  }

  return () => clearTimeout(debounceTimeout.current);
}, [settings, match, teams, players, overHistory, allOversHistory, isLoading, user, stateHasChanged]);


// EFFECT 3: Handle Over Completion
  useEffect(() => {
    if (match.isComplete || isLoading) return;

    const ballsPerOver = settings.ballsPerOver;
    const currentBallCount = match.balls;
    const isOverComplete = currentBallCount > 0 && currentBallCount % ballsPerOver === 0;

    if (isOverComplete && currentBallCount !== lastCompletedOverBallCount.current) {
        lastCompletedOverBallCount.current = currentBallCount;
        saveState();
        
        const overNumber = currentBallCount / ballsPerOver;
        const completedOverData = { overNumber, bowlerName: players.bowler.name, balls: [...overHistory], innings: match.innings };
        setAllOversHistory(prev => [completedOverData, ...prev]);

        const bowlerId = players.bowler.id;
        const currentBowlingTeamKey = teams.teamA.name === match.bowlingTeam ? 'teamA' : 'teamB';
        
        setTeams(prevTeams => {
            const updatedTeams = JSON.parse(JSON.stringify(prevTeams));
            const bowlerToUpdate = updatedTeams[currentBowlingTeamKey]?.bowlers.find(b => b.id === bowlerId);
            if (bowlerToUpdate) {
                bowlerToUpdate.previousSpells = [...(bowlerToUpdate.previousSpells || []), { ...bowlerToUpdate.currentSpell }];
                bowlerToUpdate.currentSpell = { runs: 0, wickets: 0, balls: 0, maidens: 0 };
            }
            return updatedTeams;
        });
        
        setPlayers(prevPlayers => {
            const allBowlers = teams[currentBowlingTeamKey].bowlers;
            const currentBowlerIndex = allBowlers.findIndex(b => b.id === prevPlayers.bowler.id);
            let nextBowlerFromList = allBowlers[(currentBowlerIndex + 1) % allBowlers.length];

            // **THE FIX IS HERE**: Ensure the next bowler object is complete
            const completeNextBowler = {
                ...(nextBowlerFromList || prevPlayers.bowler),
                currentSpell: { runs: 0, wickets: 0, balls: 0, maidens: 0 },
                previousSpells: nextBowlerFromList?.previousSpells || []
            };

            return {
                striker: prevPlayers.nonStriker, nonStriker: prevPlayers.striker,
                bowler: completeNextBowler, lastBowler: prevPlayers.bowler.id
            };
        });
        setOverHistory([]);
    }
  }, [match.balls, match.isComplete, isLoading, settings.ballsPerOver, teams, players, saveState]); // Note: saveState is a dependency


  // EFFECT 4: End Match
  useEffect(() => {
        if (isLoading || !match || !settings || match.isComplete) return;

        const allOut = match.wickets >= (settings.playersPerTeam - 1);
        // The core fix: `settings.overs` is now reliable
        const oversDone = match.balls >= settings.overs * settings.ballsPerOver;
        const targetReached = match.isChasing && match.runs >= match.target;

        if (targetReached) {
            endMatch();
        } else if (allOut || oversDone) {
            if (match.innings === 1) {
                startSecondInnings();
            } else {
                endMatch();
            }
        }
    }, [match, settings, endMatch, startSecondInnings, isLoading]);


// EFFECT 5
useEffect(() => {
  return () => {
    // Clean up old matches when component unmounts
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('matchState_')) {
        try {
          const matchData = JSON.parse(localStorage.getItem(key));
          
          // Check if matchData has the expected structure and has a match object
          if (matchData?.match) {
            // Use match date if available, otherwise use current time (will be kept)
            const matchDate = matchData.match.date 
              ? new Date(matchData.match.date).getTime() 
              : now;
            
            if (now - matchDate > oneDay) {
              localStorage.removeItem(key);
            }
          }
        } catch (e) {
          console.error("Error cleaning up match data:", e);
          localStorage.removeItem(key); // Remove corrupted data
        }
      }
    });
  };
}, []);



const calculateNetRunRates = (innings1, innings2, settings) => {
  // Return empty object if innings data is incomplete
  if (!innings1?.teamName || !innings2?.teamName) {
    return {};
  }

  const { ballsPerOver, playersPerTeam, overs: maxOvers } = settings;
  const team1Name = innings1.teamName;
  const team2Name = innings2.teamName;

  // Helper to convert overs string (e.g., "19.4") to a decimal value
  const parseOvers = (oversStr) => {
    if (!oversStr) return 0;
    const [overInt, balls] = String(oversStr).split('.').map(Number);
    return (overInt || 0) + ((balls || 0) / ballsPerOver);
  };

  // Determine if each team was all out
  const team1AllOut = innings1.wickets === playersPerTeam - 1;
  const team2AllOut = innings2.wickets === playersPerTeam - 1;

  // Get runs scored by each team
  const team1Runs = innings1.runs || 0;
  const team2Runs = innings2.runs || 0;

  // ✅ **FIX**: Use full quota of overs if a team was all out, otherwise use overs faced.
  const team1OversFaced = team1AllOut ? maxOvers : parseOvers(innings1.overs);
  const team2OversFaced = team2AllOut ? maxOvers : parseOvers(innings2.overs);

  // Calculate run rates for each team
  const team1RunRate = team1OversFaced > 0 ? (team1Runs / team1OversFaced) : 0;
  const team2RunRate = team2OversFaced > 0 ? (team2Runs / team2OversFaced) : 0;

  // NRR is (Run Rate For) - (Run Rate Against)
  const team1NRR = team1RunRate - team2RunRate;
  const team2NRR = team2RunRate - team1RunRate;

  return {
    [team1Name]: team1NRR.toFixed(3), 
    [team2Name]: team2NRR.toFixed(3),
  };
};


  const getMatchResult = useCallback(() => {
        if (!match.isComplete) return match.result || 'Match in progress';
        if (!match.isChasing && match.innings === 1) return `Match Abandoned or Incomplete`;

        const winner = determineWinner();
        if (winner === 'Tie') return 'Match tied';
        if (winner) {
            const margin = calculateMargin();
            return `${winner} won by ${margin}`;
        }
        return match.result || 'Result not determined';
    }, [match, teams, settings]);

    const determineWinner = useCallback(() => {
        if (!match.isComplete || !match.isChasing) return '';
        if (match.runs >= match.target) return match.battingTeam;
        if (match.target > match.runs) return match.firstInningsSummary?.teamName || '';
        return 'Tie';
    }, [match]);

    const calculateMargin = useCallback(() => {
        if (!match.isComplete || !match.isChasing) return '';
        if (match.runs >= match.target) {
            const wicketsRemaining = (settings.playersPerTeam - 1) - match.wickets;
            return `${wicketsRemaining} wicket${wicketsRemaining !== 1 ? 's' : ''}`;
        }
        if (match.target > match.runs) {
            const runMargin = match.target - match.runs - 1;
            if (runMargin === 0 && match.target - 1 === match.runs) return 'Tied';
            return `${runMargin} run${runMargin !== 1 ? 's' : ''}`;
        }
        return 'N/A';
    }, [match, settings.playersPerTeam]);



  
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

  const formatBatsmenForSummary = (batsmenList = []) =>
  batsmenList.map(b => ({
    id: b.id,
    name: b.name,
    runs: b.runs || 0,
    balls: b.balls || 0,
    fours: b.fours || 0,
    sixes: b.sixes || 0,
    isOut: b.isOut || false,
    outType: b.outType || '',
    strikeRate: b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00",
    status: b.isOut ? b.outType : (b.balls > 0 ? 'Not Out' : 'Did Not Bat')
  }));

const formatBowlersForSummary = (bowlersList = [], ballsPerOverSettings) => {
  return bowlersList.map(b => {
    const allSpells = [...(b.previousSpells || [])];
    if (b.currentSpell) {
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
      totalMaidens += spell.maidens || 0;
    });

    return {
      name: b.name,
      overs: `${Math.floor(totalBalls / ballsPerOverSettings)}.${totalBalls % ballsPerOverSettings}`,
      runs: totalRunsConceded,
      wickets: totalWicketsTaken,
      maidens: totalMaidens,
      economyRate: totalBalls > 0
        ? ((totalRunsConceded / totalBalls) * ballsPerOverSettings).toFixed(2)
        : "0.00"
    };
  });
};



// Helper function to format batsmen for the update payload
// (similar to the one in endMatch, ensure it reflects current player stats)
const formatBatsmenForUpdate = (batsmenList = []) =>
  batsmenList.map(b => ({
    id: b.id, // Ensure ID is included
    name: b.name,
    runs: b.runs || 0,
    balls: b.balls || 0,
    fours: b.fours || 0,
    sixes: b.sixes || 0,
    isOut: b.isOut || false,
    outType: b.outType || '',
    strikeRate: b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00",
    status: b.isOut ? b.outType : (b.balls > 0 ? 'Not Out' : 'Did Not Bat')
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




  const getNextBatsman = (battingTeamKey, nonStrikerId, teamsData) => {
    return teamsData[battingTeamKey].batsmen.find(b =>
      !b.isOut && b.id !== nonStrikerId
    );
  };

  const handleBackButtonConfirm = () => {
    setShowConfirmModal(true);
  };

  // This function runs when the user clicks the "End Match" button in the modal
  const handleConfirmExit = () => {
    if (onExitMatch) { // Assuming onExitMatch is a prop
      onExitMatch();
    }
    navigate('/match-setup');
    setShowConfirmModal(false); // Close modal after navigating
  };

  // This function runs when the user clicks "Cancel" or the overlay
  const handleCancelExit = () => {
    setShowConfirmModal(false);
  };




  // Handle retire
const handleRetire = (type, batter) => {
    saveState();
    const currentBattingTeamKey = match.innings === 1 ? 'teamA' : 'teamB';
    const outBatsmanId = batter === 'Striker' ? players.striker.id : players.nonStriker.id;
    const outBatsmanKey = batter === 'Striker' ? 'striker' : 'nonStriker';

    // For "Retired Out", treat it as a formal wicket.
    if (type === 'Retired Out') {
        // Call the main handleWicket function with the correct info.
        // This centralizes the wicket logic.
        handleWicket({
            type: 'Retired Out',
            runsCompleted: 0, // No runs are scored on a retirement.
            batsmanOut: outBatsmanKey, // Explicitly pass 'striker' or 'nonStriker'.
        });

    } else { // For normal "Retired" status
        // Update teams state to mark as retired
        setTeams(prevTeams => ({
            ...prevTeams,
            [currentBattingTeamKey]: {
                ...prevTeams[currentBattingTeamKey],
                batsmen: prevTeams[currentBattingTeamKey].batsmen.map(batsman =>
                    batsman.id === outBatsmanId ? {
                        ...batsman,
                        isOut: false, // Not technically "out"
                        outType: type // 'Retired'
                    } : batsman
                )
            }
        }));

        // Replace the retiring batsman with the next available one
        const nextBatsman = replaceBatsman(outBatsmanId);

        if (nextBatsman) {
            setPlayers(prev => ({
                ...prev,
                [outBatsmanKey]: nextBatsman, // Replace the correct player slot
            }));
        }
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



  // Handle bowler change
  const handleBowlerChange = (newBowlerId) => {
    const currentBowlingTeamKey = teams.teamA.name === match.bowlingTeam ? 'teamA' : 'teamB';
    const bowlerToChangeFromId = players.bowler.id;

    // First, archive the current bowler's spell in the teams list
    setTeams(prevTeams => {
        const newTeams = JSON.parse(JSON.stringify(prevTeams));
        const bowlerToUpdate = newTeams[currentBowlingTeamKey]?.bowlers.find(b => b.id === bowlerToChangeFromId);
        if (bowlerToUpdate && bowlerToUpdate.currentSpell?.balls > 0) {
            bowlerToUpdate.previousSpells.push({ ...bowlerToUpdate.currentSpell });
        }
        return newTeams;
    });

    // Find the lean new bowler object from the teams list
    const newBowlerFromList = teams[currentBowlingTeamKey].bowlers.find(b => b.id === newBowlerId);
    if (!newBowlerFromList) return;

    // **THE FIX**: Create a complete bowler object with a fresh spell before setting it as active.
    const completeNewBowler = {
        ...newBowlerFromList,
        currentSpell: { runs: 0, wickets: 0, balls: 0, maidens: 0 },
        previousSpells: newBowlerFromList.previousSpells || []
    };

    // Set the new, complete bowler object as the active player
    setPlayers(prev => ({
        ...prev,
        bowler: completeNewBowler,
        lastBowler: prev.bowler.id
    }));
    
    setShowModal(null);
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
    if (match.isComplete || !showModal) return;

    const dismissalInfo = modalData;

    if (showModal === 'OUT') {
        if (!dismissalInfo.dismissalType) {
            alert("Please select a dismissal type.");
            return;
        }
        
        if (dismissalInfo.dismissalType === 'Run Out') {
            if (dismissalInfo.runsCompleted === undefined || !dismissalInfo.batsmanOut) {
                alert("For a Run Out, please select both the runs completed and which batsman was out.");
                return;
            }
            handleWicket({
                type: 'Run Out',
                runsCompleted: dismissalInfo.runsCompleted,
                batsmanOut: dismissalInfo.batsmanOut
            });
        } else {
            handleWicket({ type: dismissalInfo.dismissalType });
        }
  } else {
    switch (showModal) {
      case 'WD':
        if (modalData.batsmanOut) {
          // It's a run-out on a wide ball.
          handleWicket({
            type: 'Run Out',
            runsCompleted: modalData.value || 0, // Runs from byes
            batsmanOut: modalData.batsmanOut,
            isWide: true // The new flag for wides
          });
        } else {
          // It's a standard wide with or without extra runs (byes).
          handleExtras('WD', modalData.value || 0);
        }
        break;

      case 'NB':
        if (modalData.batsmanOut) {
          // It's a run-out on a no-ball.
          handleWicket({
            type: 'Run Out',
            runsCompleted: modalData.value || 0, // Runs scored off bat
            batsmanOut: modalData.batsmanOut,
            isNoBall: true // The flag for no-balls
          });
        } else {
          // It's just a standard no-ball with or without runs.
          handleExtras('NB', modalData.value || 0);
        }
        break;

      case 'BYE':
      case 'LB':
        if (modalData.value !== undefined) {
          handleExtras(showModal, modalData.value);
        }
        break;
      case '5,7..':
        if (modalData.value !== undefined) {
          handleRuns(modalData.value);
        }
        break;
      case 'Retire':
        if (modalData.type && modalData.batter) {
          handleRetire(modalData.type, modalData.batter);
        }
        break;
      default:
        break;
    }
  }

  setShowModal(null);
  setSelectedAction(null);
  setModalData({});
};


  

  
  const formatBatsmenData = (
    batsmenListFromTeamsState = [],
    currentStrikerFromPlayersState, // This is the actual players.striker object
    currentNonStrikerFromPlayersState // This is the actual players.nonStriker object
) => {
    return batsmenListFromTeamsState.map(batsmanInTeam => {
        let processedBatsman = { ...batsmanInTeam }; // Start with data from the main team list

        // If this batsman is the current/final striker, use their live stats from players state
        if (currentStrikerFromPlayersState && batsmanInTeam.id === currentStrikerFromPlayersState.id) {
            processedBatsman = {
                ...batsmanInTeam,
                runs: currentStrikerFromPlayersState.runs || 0,
                balls: currentStrikerFromPlayersState.balls || 0,
                fours: currentStrikerFromPlayersState.fours || 0,
                sixes: currentStrikerFromPlayersState.sixes || 0,
                isOut: !!currentStrikerFromPlayersState.isOut, // Ensure boolean
                outType: currentStrikerFromPlayersState.outType || '',
            };
        }
        // Else if this batsman is the current/final non-striker, use their live stats
        else if (currentNonStrikerFromPlayersState && batsmanInTeam.id === currentNonStrikerFromPlayersState.id) {
            processedBatsman = {
                ...batsmanInTeam,
                runs: currentNonStrikerFromPlayersState.runs || 0,
                balls: currentNonStrikerFromPlayersState.balls || 0,
                fours: currentNonStrikerFromPlayersState.fours || 0,
                sixes: currentNonStrikerFromPlayersState.sixes || 0,
                isOut: !!currentNonStrikerFromPlayersState.isOut, // Ensure boolean
                outType: currentNonStrikerFromPlayersState.outType || '',
            };
        } else {
            // For other batsmen (already out or DNB), ensure their isOut is boolean
            // and other stats are from their record in batsmenListFromTeamsState
            processedBatsman.isOut = !!processedBatsman.isOut;
            processedBatsman.runs = processedBatsman.runs || 0;
            processedBatsman.balls = processedBatsman.balls || 0;
            processedBatsman.fours = processedBatsman.fours || 0;
            processedBatsman.sixes = processedBatsman.sixes || 0;
            processedBatsman.outType = processedBatsman.outType || '';
        }

        const actualRuns = processedBatsman.runs;
        const actualBalls = processedBatsman.balls;
        // Determine if the batsman is effectively out (isOut is true, or outType indicates an out status)
        const isEffectivelyOut = processedBatsman.isOut || 
                                 (processedBatsman.outType && 
                                  processedBatsman.outType.toLowerCase() !== 'not out' && 
                                  processedBatsman.outType.toLowerCase() !== '');


        let atCreaseStatus = false;
        if (!isEffectivelyOut) { // Only not-out players can be at crease
            if (currentStrikerFromPlayersState && batsmanInTeam.id === currentStrikerFromPlayersState.id) {
                atCreaseStatus = true;
            } else if (currentNonStrikerFromPlayersState && batsmanInTeam.id === currentNonStrikerFromPlayersState.id) {
                atCreaseStatus = true;
            }
        }

        return {
            id: processedBatsman.id,
            name: processedBatsman.name,
            runs: actualRuns,
            balls: actualBalls,
            fours: processedBatsman.fours,
            sixes: processedBatsman.sixes,
            isOut: isEffectivelyOut, // Ensure this is boolean
            outType: processedBatsman.outType,
            strikeRate: actualBalls > 0 ? ((actualRuns / actualBalls) * 100).toFixed(2) : "0.00",
            status: isEffectivelyOut
                ? (processedBatsman.outType || 'Out')
                : atCreaseStatus
                    ? 'Not Out'
                    : (actualBalls > 0 || actualRuns > 0 ? 'Not Out' : 'Did Not Bat'),
            atCrease: atCreaseStatus
        };
    });
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

    

  
const savePlayerName = () => {
    if (!editingPlayer || !newPlayerName.trim()) {
        setEditingPlayer(null);
        return;
    }

    const { team, id, type } = editingPlayer;
    const trimmedName = newPlayerName.trim();
    const playerArrayKey = type === 'batsman' ? 'batsmen' : 'bowlers';

    // ✅ FIX: Get the UP-TO-DATE player data directly from the `teams` state.
    // This is the single source of truth and has the correct, current spell info.
    const authoritativePlayer = teams[team][playerArrayKey].find(p => p.id === id);

    // If for some reason the player isn't found, abort safely.
    if (!authoritativePlayer) {
        console.error("Could not find player to update.");
        setEditingPlayer(null);
        return;
    }

    // Create the updated player object with the new name, preserving all other properties.
    const updatedPlayer = {
        ...authoritativePlayer,
        name: trimmedName,
    };

    // --- Now, perform state updates using this consistent, authoritative object ---

    // 1. Update the master list in the `teams` state.
    setTeams(prevTeams => {
        const newTeams = JSON.parse(JSON.stringify(prevTeams)); // Deep copy for safety
        const listToUpdate = newTeams[team][playerArrayKey];
        const index = listToUpdate.findIndex(p => p.id === id);
        if (index !== -1) {
            listToUpdate[index] = updatedPlayer; // Replace the old object with the new, correct one
        }
        return newTeams;
    });

    // 2. If the edited player was active, update the `players` state.
    setPlayers(prevPlayers => {
        const newActivePlayers = { ...prevPlayers };
        let wasActive = false;

        if (type === 'bowler' && prevPlayers.bowler?.id === id) {
            newActivePlayers.bowler = updatedPlayer;
            wasActive = true;
        }
        if (type === 'batsman') {
            if (prevPlayers.striker?.id === id) {
                newActivePlayers.striker = updatedPlayer;
                wasActive = true;
            }
            if (prevPlayers.nonStriker?.id === id) {
                newActivePlayers.nonStriker = updatedPlayer;
                wasActive = true;
            }
        }

        return wasActive ? newActivePlayers : prevPlayers;
    });

    // 3. Reset the UI.
    setEditingPlayer(null);
    setNewPlayerName('');
    setShowModal(null);
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

          const BowlerDisplay = ({ bowler, ballsPerOver }) => {
            if (!bowler) return null;

            // Calculate totals from all spells (previous + current)
            const allSpells = [...(bowler.previousSpells || []), ...(bowler.currentSpell ? [bowler.currentSpell] : [])];
            
            const totalStats = allSpells.reduce((acc, spell) => ({
              runs: acc.runs + (spell.runs || 0),
              wickets: acc.wickets + (spell.wickets || 0),
              balls: acc.balls + (spell.balls || 0),
              maidens: acc.maidens + (spell.maidens || 0)
            }), { runs: 0, wickets: 0, balls: 0, maidens: 0 });

            const overs = `${Math.floor(totalStats.balls / ballsPerOver)}.${totalStats.balls % ballsPerOver}`;
            const economy = totalStats.balls > 0 
              ? ((totalStats.runs / totalStats.balls) * ballsPerOver).toFixed(2)
              : "0.00";

            return (
              <div className="bowler-display">
                <div className="bowler-header">
                  <p 
                    className="bowler-name cursor-pointer hover:underline flex items-center gap-3"
                    onClick={() => {
                      const currentBowlingTeam = match.innings === 1 ? 'teamB' : 'teamA';
                      // Ensure players.bowler and players.bowler.id exist before calling startEditingPlayer
                      if (players.bowler && players.bowler.id) {
                          startEditingPlayer('bowler', players.bowler.id, currentBowlingTeam);
                      }
                    }}
                  >
                    {/* Ensure players.bowler exists before trying to access its name */}
                    {players.bowler ? players.bowler.name : 'N/A'} <span className="text-xs">✏️</span>
                  </p>
                  <div className="bowler-stats">
                    <span>{totalStats.runs}/{totalStats.wickets}</span>
                    <span>({overs})</span>
                  </div>
                  <button 
                    className="change-bowler-btn"
                    onClick={() => setShowModal('CHANGE_BOWLER')}
                  >
                    <FiRefreshCw size={16} /> Change
                  </button>
                </div>
                {bowler.currentSpell?.balls > 0 && (
                  <div className="current-over-balls">
                    {Array.from({ length: bowler.currentSpell.balls }).map((_, i) => (
                      <span key={i} className="ball-dot"></span>
                    ))}
                  </div>
                )}
              </div>
            );
          };

    const [editingTeam, setEditingTeam] = useState(null); // null / 'teamA' / 'teamB'
    const [tempNames, setTempNames] = useState([]);

 


const currentBowler = players.bowler; // Get the current bowler object
  let aggBowlerRuns = 0;
  let aggBowlerWickets = 0;
  let aggBowlerBalls = 0;
  let aggBowlerMaidens = 0; // For displaying total maiden overs bowled by this bowler

  if (currentBowler) {
    // Add stats from the current spell (the over currently being bowled)
    if (currentBowler.currentSpell) {
      aggBowlerRuns += currentBowler.currentSpell.runs || 0;
      aggBowlerWickets += currentBowler.currentSpell.wickets || 0;
      aggBowlerBalls += currentBowler.currentSpell.balls || 0;
      // Note: currentSpell.maidens is usually 0 while the over is in progress.
    }

    // Add stats from all previously completed spells (overs)
    if (currentBowler.previousSpells) {
      currentBowler.previousSpells.forEach(spell => {
        aggBowlerRuns += spell.runs || 0;
        aggBowlerWickets += spell.wickets || 0;
        aggBowlerBalls += spell.balls || 0;
        aggBowlerMaidens += spell.maidens || 0; // Sum up maiden overs from previous spells
      });
    }
  }

    
    
    




 






        /* ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ */




  
  // Render modal content

  const renderModal = () => {
  

  const handleClose = () => {
    setShowModal(null);
    setSelectedAction(null);
    setModalData({});
    setShowPrevOversModal(false);
  };

  
  if (showPrevOversModal) {
    return (
      <div className="modal open">
        <div className="modal-overlay" onClick={handleClose}></div>
        <div className="modal-content previous-overs-modal" role="dialog" aria-modal="true">
          <h3>Previous Overs History</h3>
          <div className="previous-overs-list">
            {allOversHistory.length === 0 ? (
              <p>No completed overs yet.</p>
            ) : (
              allOversHistory.map((over) => (
                <div key={over.overNumber} className="over-summary-item">
                  <div className="over-summary-header">
                    <strong>Over {over.overNumber}</strong>
                    <span>(Bowler: {over.bowlerName})</span>
                    <span className="over-summary-runs">
                      {over.runs} Run{over.runs !== 1 && 's'}, {over.wickets} Wicket{over.wickets !== 1 && 's'}
                    </span>
                  </div>
                  <div className="balls-container-modal">
                    {over.balls.map((ball, index) => (
                      <span 
                        key={index} 
                        className={`ball-mark ${
                          ball.toString().startsWith('W') ? 'wicket' : 
                          (ball === '4' || ball === '6' ? 'boundary' : '')
                        }`}
                      >
                        {ball}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="modal-actions">
            <button onClick={handleClose} className="ok-btn">Close</button>
          </div>
        </div>
      </div>
    );
  }

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

    const renderNumberOptions = () => {
      let numbersToShow = [0, 1, 2, 3, 4, 5, 6, 7]; // Default list including 0

      // If the modal is for 'BYE' or '5,7..', remove 0 from the list
      if (showModal === 'BYE' || showModal === '5,7..') {
        numbersToShow = [1, 2, 3, 4, 5, 6, 7];
      }

      return (
        <div className="number-grid">
          {numbersToShow.map(num => (
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
    };

        





const renderRunOutDetails = () => (
    <div className="run-out-details">
        <h4 style={{ marginTop: '1rem' }}>Runs Completed Before Wicket?</h4>
        <div className="number-grid">
            {[0, 1, 2, 3, 4, 5].map(num => (
                <button
                    key={num}
                    onClick={() => setModalData(prev => ({ ...prev, runsCompleted: num }))}
                    className={modalData.runsCompleted === num ? 'selected' : ''}
                >
                    {num}
                </button>
            ))}
        </div>

        <h4 style={{ marginTop: '1rem' }}>Which Batsman Was Out?</h4>
        <div className="batter-selection">
            <button
                onClick={() => setModalData(prev => ({ ...prev, batsmanOut: 'striker' }))}
                className={`option-button ${modalData.batsmanOut === 'striker' ? 'selected' : ''}`}
            >
                {players.striker.name} (Striker)
            </button>
            <button
                onClick={() => setModalData(prev => ({ ...prev, batsmanOut: 'nonStriker' }))}
                className={`option-button ${modalData.batsmanOut === 'nonStriker' ? 'selected' : ''}`}
            >
                {players.nonStriker.name} (Non-Striker)
            </button>
        </div>
    </div>
);

    const renderOutOptions = () => (
        <div className="out-options">
            {['Bowled', 'Caught', 'Run Out', 'LBW', 'Stumped', 'Hit Wicket'].map(type => (
                <button
                    key={type}
                    onClick={() => setModalData(prev => ({ ...prev, dismissalType: type }))}
                    className={modalData.dismissalType === type ? 'selected' : ''}
                >
                    {type}
                </button>
            ))}
        </div>
    );



// In ScoreCard.jsx, replace your existing renderNoBallOptions function

const renderNoBallOptions = () => (
    <div className="no-ball-options">
      {/* Section 1: Select runs scored off the bat (always visible) */}
      <h4>Runs Scored Off Bat</h4>
      <p className="modal-subtitle">(In addition to the No Ball penalty)</p>
      <div className="number-grid">
        {[0, 1, 2, 3, 4, 6].map(num => (
          <button
            key={num}
            onClick={() => setModalData(prev => ({ ...prev, value: num }))}
            className={modalData.value === num ? 'selected' : ''}
          >
            {num === 0 ? 'NB' : `NB+${num}`}
          </button>
        ))}
      </div>

      {/* NEW: Updated section to toggle the Run Out flow */}
      <div className="direct-wicket-section">
        <h4 className="wicket-title">Wicket Event (Optional)</h4>
        <div className="button-group">
            <button
                // This button now toggles the visibility of the run-out details
                onClick={() => setModalData(prev => ({ 
                    ...prev, 
                    isRunOutFlow: !prev.isRunOutFlow, 
                    batsmanOut: null // Clear batsman selection when toggling
                }))}
                className={`option-button ${modalData.isRunOutFlow ? 'selected' : ''}`}
            >
                Run Out
            </button>
        </div>
      </div>

      {/* This section now only appears if 'isRunOutFlow' is true */}
      <AnimatePresence>
        {modalData.isRunOutFlow && (
            <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: '1rem' }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="run-out-details-wrapper"
            >
                <h4>Which Batsman Was Out?</h4>
                <div className="batter-selection">
                  <button
                    onClick={() => setModalData(prev => ({ ...prev, batsmanOut: 'striker' }))}
                    className={`option-button ${modalData.batsmanOut === 'striker' ? 'selected' : ''}`}
                  >
                    {players.striker.name} (Striker)
                  </button>
                  <button
                    onClick={() => setModalData(prev => ({ ...prev, batsmanOut: 'nonStriker' }))}
                    className={`option-button ${modalData.batsmanOut === 'nonStriker' ? 'selected' : ''}`}
                  >
                    {players.nonStriker.name} (Non-Striker)
                  </button>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
);

// In ScoreCard.jsx, replace the existing renderWideBallOptions function

const renderWideBallOptions = () => (
    <div className="wide-ball-options">
      {/* Section 1: Select runs from byes (always visible) */}
      <h4>Runs Scored (Byes)</h4>
      <p className="modal-subtitle">(In addition to the Wide penalty)</p>
      <div className="number-grid">
        {[0, 1, 2, 3, 4].map(num => (
          <button
            key={num}
            onClick={() => setModalData(prev => ({ ...prev, value: num }))}
            className={modalData.value === num ? 'selected' : ''}
          >
            {num === 0 ? 'WD' : `WD+${num}`}
          </button>
        ))}
      </div>

      {/* NEW: Updated section to toggle the Run Out flow */}
      <div className="direct-wicket-section">
        <h4 className="wicket-title">Wicket Event (Optional)</h4>
        <div className="button-group">
            <button
                // This button now toggles the visibility of the run-out details
                onClick={() => setModalData(prev => ({ 
                    ...prev, 
                    isRunOutFlow: !prev.isRunOutFlow, 
                    batsmanOut: null // Clear batsman selection when toggling
                }))}
                className={`option-button ${modalData.isRunOutFlow ? 'selected' : ''}`}
            >
                Run Out
            </button>
        </div>
      </div>

      {/* This section now only appears if 'isRunOutFlow' is true */}
      <AnimatePresence>
        {modalData.isRunOutFlow && (
            <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: '1rem' }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="run-out-details-wrapper"
            >
                <h4>Which Batsman Was Out?</h4>
                <div className="batter-selection">
                  <button
                    onClick={() => setModalData(prev => ({ ...prev, batsmanOut: 'striker' }))}
                    className={`option-button ${modalData.batsmanOut === 'striker' ? 'selected' : ''}`}
                  >
                    {players.striker.name} (Striker)
                  </button>
                  <button
                    onClick={() => setModalData(prev => ({ ...prev, batsmanOut: 'nonStriker' }))}
                    className={`option-button ${modalData.batsmanOut === 'nonStriker' ? 'selected' : ''}`}
                  >
                    {players.nonStriker.name} (Non-Striker)
                  </button>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
);

const renderRetireOptions = () => (
  <div className="retire-options">
    {/* --- Retire Type Section --- */}
    <div className="retire-types">
      <h4>Retire Type</h4>
      <div className="button-group">
        {['Retired', 'Retired Out'].map(type => (
          <button
            key={type}
            onClick={() => setModalData(prev => ({ ...prev, type }))}
            className={`option-button ${modalData.type === type ? 'selected' : ''}`}
            aria-pressed={modalData.type === type}
          >
            {type}
          </button>
        ))}
      </div>
    </div>

    {/* --- Batter Selection Section --- */}
    <div className="batter-selection">
      <h4>Select Batter</h4>
      <div className="button-group">
        {[
          { label: 'Striker', name: players.striker?.name || 'Striker' },
          { label: 'Non-Striker', name: players.nonStriker?.name || 'Non-Striker' },
        ].map(({ label, name }) => (
          <button
            key={label}
            onClick={() => setModalData(prev => ({ ...prev, batter: label }))}
            className={`option-button ${modalData.batter === label ? 'selected' : ''}`}
            aria-pressed={modalData.batter === label}
          >
            {name} ({label})
          </button>
        ))}
      </div>
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
    <div className="modal open">
      <div className="modal-overlay" onClick={handleClose}></div>

      <div className="modal-content" role="dialog" aria-modal="true">
        {/* Dynamic heading for clarity */}
        <h3 className="modal-title">
          {showModal === 'OUT' && (!modalData.dismissalType ? 'Select Dismissal Type' : modalData.dismissalType === 'Run Out' ? 'Run Out Details' : 'Confirm Dismissal')}
          {showModal === '5,7..' && 'Enter Custom Runs'}
          {showModal === 'WD' && 'Wide Ball Options'}
          {showModal === 'NB' && 'No Ball Options'}
          {showModal === 'BYE' && 'Bye Options'}
          {showModal === 'Retire' && 'Retire Batsman'}
          {showModal === 'EDIT_PLAYER' && 'Edit Player Name'}
          {showModal === 'SETTINGS' && 'Match Settings'}
        </h3>

        {/* Modal-specific content rendering */}
        {showModal === 'OUT' && (
          !modalData.dismissalType
            ? renderOutOptions()
            : modalData.dismissalType === 'Run Out'
              ? renderRunOutDetails()
              : null
        )}

        {showModal === '5,7..' && renderNumberOptions()}
        {showModal === 'WD' && renderWideBallOptions()}
        {showModal === 'NB' && renderNoBallOptions()}
        {showModal === 'BYE' && renderNumberOptions()}
        {showModal === 'Retire' && renderRetireOptions()}
        {showModal === 'EDIT_PLAYER' && renderEditPlayerForm()}
        {showModal === 'SETTINGS' && renderSettingsOptions()}

        {/* Modal action buttons */}
        <div className="modal-actions">
          <button onClick={handleClose} className="cancel-btn">Cancel</button>
          {/* Only show OK button for actionable modals */}
          {showModal !== 'SETTINGS' && showModal !== 'EDIT_PLAYER' && (
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
        <button className="back-btn" onClick={handleBackButtonConfirm}>
          <FiArrowLeft size={20} />
        </button>

        {/* <div className="view-buttons">
          <button className="view-btn active">Live Scorecard</button>
          <button
            className="view-btn"
            onClick={() => {
              const currentMatchId = matchSettings?._id || match?._id || matchId;
              if (currentMatchId) {
                navigate(`/full-scorecard/${currentMatchId}`);
              } else {
                console.error('No Match ID available to view full scorecard.');
                alert('Match ID is not available. Cannot show full scorecard.');
              }
            }}
          >
            Full Scorecard
          </button>
        </div> */}

        {/*<button
          className="settings-btn"
          onClick={() => setShowSettingsPanel(!showSettingsPanel)}
        >
          <FiSettings size={20} />
        </button>*/}
      </div>

      {/* Settings Panel */}
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

      {showConfirmModal && (
        <div className="confirm-modal-overlay" onClick={handleCancelExit}>
          <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-icon">
              {/* Warning Triangle SVG Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.772 4.5-3.298 4.5H5.344c-2.526 0-4.45-2.5-3.298-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="confirm-modal-title">Are you sure?</h2>
            <p className="confirm-modal-message">
              Are You Sure You want to Exit?
            </p>
            <div className="confirm-modal-actions">
              <button className="btn-modal btn-modal-secondary" onClick={handleCancelExit}>
                Cancel
              </button>
              <button className="btn-modal btn-modal-danger" onClick={handleConfirmExit}>
                End Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scorecard Section */}
      <div className="main-content-section">
        <div className="scorecard-section">
          {/* Innings and Team */}
          <div className="innings-team">
            <h3 className="team-name">
              <span className="batting-team">{match.battingTeam || 'Team A'}</span>
              {' '}VS{' '}
              <span className="bowling-team">{match.bowlingTeam || 'Team B'}</span>
            </h3>
            <h2 className="innings">{match.innings === 1 ? '1ST INNINGS' : '2ND INNINGS'}</h2>
          </div>

          {/* Score and Overs */}
          <div className="score-overs">
            <h1 className="score">{match.runs || 0}/{match.wickets || 0}</h1>
            <p className="overs">
              ({Math.floor(match.balls / settings.ballsPerOver)}.
              {match.balls % settings.ballsPerOver}/{settings.overs})
            </p>
          </div>

          {/* Current Run Rate */}
          <p className="crr">
            CRR {match.balls > 0
              ? (match.runs / (match.balls / settings.ballsPerOver)).toFixed(2)
              : '0.00'}
          </p>

          {/* Chasing Info */}
          {match.isChasing && !match.isComplete && (
            <div className="target-info">
              <div className="target-row highlight">
                <span>
                  Need {Math.max(0, remainingRuns)} runs from {remainingBalls} balls
                </span>
              </div>
              <div className="target-combined-row">
                <div className="target-row">
                  <span className="target-label">Target:</span>
                  <span className="target-value">{match.target}</span>
                </div>
                <div className="target-row">
                  <span className="target-label">Req. RR:</span>
                  <span className="target-value">{requiredRunRate}</span>
                </div>
              </div>
            </div>
          )}

          {/* Batsmen Info */}
          <div className="batsmen-info">
            <div className="batsman striker">
              <div className="striker-header">
                <p
                  className="batsman-name cursor-pointer hover:underline flex items-center gap-3"
                  onClick={() => {
                    const currentBattingTeam = match.innings === 1 ? 'teamA' : 'teamB';
                    startEditingPlayer('batsman', players.striker.id, currentBattingTeam);
                  }}
                  title="Click to edit batsman name"
                >
                  {players.striker.name} <span className="text-xs">✏️</span>
                </p>
                <span className="live-dot"></span>
              </div>
              <div className="batsman-stats">
                <span className="batsman-runs">{players?.striker?.runs || 0}</span>
                <span className="batsman-balls">({players?.striker?.balls || 0})</span>
              </div>
              {players.striker.isOut && (
                <span className="out-status">{players.striker.outType}</span>
              )}
            </div>

            <div className="batsman">
              <div className="non-striker-header">
                <p
                  className="batsman-name cursor-pointer hover:underline flex items-center gap-3"
                  onClick={() => {
                    const currentBattingTeam = match.innings === 1 ? 'teamA' : 'teamB';
                    startEditingPlayer('batsman', players.nonStriker.id, currentBattingTeam);
                  }}
                  title="Click to edit batsman name"
                >
                  {players.nonStriker.name} <span className="text-xs">✏️</span>
                </p>
              </div>
              <div className="batsman-stats">
                <span className="batsman-runs">{players.nonStriker.runs}</span>
                <span className="batsman-balls">({players.nonStriker.balls})</span>
              </div>
              {players.nonStriker.isOut && (
                <span className="out-status">{players.nonStriker.outType}</span>
              )}
            </div>
          </div>



          {/* Bowler Info and Over History */}
          <div className="bowler-info">
            <BowlerDisplay
              bowler={
                teams[match.innings === 1 ? 'teamB' : 'teamA'].bowlers.find(
                  (b) => b.id === players.bowler.id
                )
              }
              ballsPerOver={settings.ballsPerOver}
            />


            <div className="over-history-section">
  {/* Title centered at top */}
  <p className="section-title" style={{
    textAlign: 'center',
    marginBottom: '10px',
    fontWeight: '600',
    fontSize: '14px',
    color: '#333'
  }}>This Over</p>

  {/* Balls container */}
  <div className="balls-container" style={{
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    marginBottom: '10px',
    minHeight: '30px'
  }}>
    {overHistory.length > 0 ? (
      overHistory.map((ball, index) => (
        <span
          key={index}
          className={`ball-mark ${
            ball === '6' || ball === '4'
              ? 'boundary'
              : ball === 'W'
              ? 'wicket'
              : ball.includes('WD') || ball.includes('B')
              ? 'extra'
              : 'regular-run'
          }`}
          
        >
          {ball}
        </span>
      ))
    ) : (
      <span className="ball-mark empty" style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: '#f0f0f0',
        fontSize: '12px',
        color: '#999'
      }}>–</span>
    )}
  </div>

  {/* View History button centered at bottom */}
  <div style={{ textAlign: 'center' }}>
    <button 
      className="view-history-btn" 
      onClick={() => setShowPrevOversModal(true)}
      style={{
        backgroundColor: '#f0f0f0',
        color: '#333',
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '4px 12px',
        fontSize: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        marginTop: '5px'
      }}
    >
      View Over History
    </button>
  </div>
</div>


          </div>
        </div>



        {/* Bottom Input Section */}
        {!match.isComplete && (
          <div className="lower-section">
            {/* First Row */}
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

            {/* Second Row */}
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
                  setPlayers((prev) => ({
                    ...prev,
                    striker: prev.nonStriker,
                    nonStriker: prev.striker,
                  }));
                  handleActionClick(null);
                }}
              >
                Change Striker
              </button>
            </div>

            {/* Third Row */}
            <div className="button-row">
              {['WD', 'NB', 'BYE', 'UNDO'].map((btn) => (
                <button
                  key={btn}
                  onClick={() => (btn === 'UNDO' ? handleUndo() : handleActionClick(btn))}
                  className={`action-btn ${
                    btn === 'WD' || btn === 'NB'
                      ? 'yellow-btn'
                      : btn === 'BYE'
                      ? 'purple-btn'
                      : 'undo-btn'
                  }`}
                  disabled={btn === 'UNDO' && history.length === 0}
                >
                  {btn}
                </button>
              ))}
            </div>

            {/* Fourth Row */}
            <div className="button-row">
              {['0', '1', '2', '5,7..'].map((btn) => (
                <button
                  key={btn}
                  onClick={() => handleActionClick(btn)}
                  className="action-btn white-btn"
                >
                  {btn}
                </button>
              ))}
            </div>

            {/* Fifth Row */}
            <div className="button-row">
              {['3', '4', '6', 'OUT'].map((btn) => (
                <button
                  key={btn}
                  onClick={() => handleActionClick(btn)}
                  className={`action-btn ${btn === 'OUT' ? 'red-btn' : 'white-btn'}`}
                >
                  {btn}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Render Modals */}
        {renderModal()}
      </div>
    </div>
  );
};

export default ScorecardPage;