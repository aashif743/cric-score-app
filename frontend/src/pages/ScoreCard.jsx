import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { FiSettings, FiArrowLeft, FiRefreshCw } from 'react-icons/fi';
import { motion, AnimatePresence } from "framer-motion";
import './ScorecardPage.css';
import { useNavigate } from 'react-router-dom';
import io from "socket.io-client";
import API from '../api';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { AuthContext } from '../context/AuthContext.jsx';

const socket = io("http://localhost:5000"); 



const createInitialState = (matchSettings) => {
    // 1. Normalize all incoming data to ensure consistency
    const teamAName = matchSettings?.teamA?.name || matchSettings?.teamA || 'Team A';
    const teamBName = matchSettings?.teamB?.name || matchSettings?.teamB || 'Team B';
    // This is the crucial fix for the overs issue
    const totalOvers = matchSettings?.totalOvers || matchSettings?.overs || 6;
    const playersPerTeam = matchSettings?.playersPerTeam || 11;
    const ballsPerOver = matchSettings?.ballsPerOver || 6;

    // 2. Define a consistent way to create a team's player list
    const createTeam = (name, pPerTeam) => ({
        name,
        batsmen: Array.from({ length: pPerTeam }, (_, i) => ({ id: uuidv4(), name: `Batsman ${i + 1}`, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, outType: '', status: 'Did Not Bat' })),
        bowlers: Array.from({ length: pPerTeam }, (_, i) => ({ id: uuidv4(), name: `Bowler ${i + 1}`, currentSpell: { runs: 0, wickets: 0, balls: 0, maidens: 0 }, previousSpells: [] }))
    });

    // 3. Create the initial team structures using the normalized data
    const initialTeamsState = {
        teamA: createTeam(teamAName, playersPerTeam),
        teamB: createTeam(teamBName, playersPerTeam)
    };

    // 4. Return all initial state objects in one go. Everything is now guaranteed to be correct.
    return {
        settings: {
            noBallRuns: 1,
            wideBallRuns: 1,
            ...matchSettings,
            overs: totalOvers, // Use the normalized value
            playersPerTeam,
            ballsPerOver
        },
        match: {
            _id: matchSettings?._id || null,
            runs: 0, wickets: 0, balls: 0, innings: 1, target: 0, isChasing: false, isComplete: false, result: '', fallOfWickets: [],
            extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
            battingTeam: teamAName, // Always a string
            bowlingTeam: teamBName, // Always a string
            firstInningsSummary: null
        },
        teams: initialTeamsState,
        players: {
            striker: initialTeamsState.teamA.batsmen[0],
            nonStriker: initialTeamsState.teamA.batsmen[1],
            bowler: initialTeamsState.teamB.bowlers[0],
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

  const lastCompletedOver = useRef(0);
  const lastCompletedOverBallCount = useRef(0);
  

  // Calculate derived values
  const runs = match?.runs ?? 0;
  const wickets = match?.wickets ?? 0;
  const balls = match?.balls ?? 0;

  const overs = `${Math.floor(match.balls / settings.ballsPerOver)}.${match.balls % settings.ballsPerOver}`;
  const crr = balls > 0 ? (runs / (balls / settings.ballsPerOver)).toFixed(2) : "0.00";
  const remainingBalls = (settings.overs * settings.ballsPerOver) - match.balls;
  const remainingRuns = match.target - match.runs;
  const requiredRunRate = remainingBalls > 0 ? (remainingRuns / (remainingBalls / settings.ballsPerOver)).toFixed(2) : '0.00';

  useEffect(() => {
        const currentMatchId = matchSettings?._id;
        if (!currentMatchId) {
            setIsLoading(false);
            return;
        }

        const savedMatchRaw = localStorage.getItem(`matchState_${currentMatchId}`);
        if (savedMatchRaw) {
            try {
                const parsedData = JSON.parse(savedMatchRaw);
                console.log("✅ Restoring match from localStorage.");
                setSettings(parsedData.settings);
                setMatch(parsedData.match);
                setTeams(parsedData.teams);
                setPlayers(parsedData.players);
                setHistory(parsedData.history || []);
                setOverHistory(parsedData.overHistory || []);
                setAllOversHistory(parsedData.allOversHistory || []);
            } catch (e) {
                console.error("Failed to parse saved match state", e);
                localStorage.removeItem(`matchState_${currentMatchId}`);
            }
        }
        
        setIsLoading(false); // Done loading

        // Socket setup
        socket.connect();
        socket.emit("join-match", currentMatchId);
        // ... your socket listeners

        return () => {
            socket.emit("leave-match", currentMatchId);
            socket.disconnect();
        };

    }, [matchSettings]); // This effect runs only once when the component mounts with new settings.


    // EFFECT 2: Save state to localStorage (runs on changes)
    useEffect(() => {
        if (isLoading || !match?._id) return;
        
        const matchStateToSave = { settings, match, teams, players, overHistory, allOversHistory, history };
        localStorage.setItem(`matchState_${match?._id}`, JSON.stringify(matchStateToSave));

    }, [settings, match, teams, players, overHistory, allOversHistory, history, isLoading]);


    useEffect(() => {
        if (match.isComplete || isLoading) return;

        const ballsPerOver = settings.ballsPerOver;
        const currentBallCount = match.balls;
        const isOverComplete = currentBallCount > 0 && currentBallCount % ballsPerOver === 0;

        // Check if a new over has just been completed
        if (isOverComplete && currentBallCount !== lastCompletedOverBallCount.current) {
            // Update the ref to prevent this from running again for the same ball count
            lastCompletedOverBallCount.current = currentBallCount;
            
            console.log(`✅ Over ${currentBallCount / ballsPerOver} complete. Changing bowler.`);
            
            // 1. Save the current state for the undo stack
            saveState();
            
            // 2. Archive the completed over's history
            const overNumber = currentBallCount / ballsPerOver;
            const completedOverData = {
                overNumber,
                bowlerName: players.bowler.name,
                balls: [...overHistory],
                innings: match.innings
            };
            setAllOversHistory(prev => [completedOverData, ...prev]);

            // 3. Update the `teams` state to archive the old bowler's spell
            const bowlerId = players.bowler.id;
            const currentBowlingTeamKey = teams.teamA.name === match.bowlingTeam ? 'teamA' : 'teamB';
            
            setTeams(prevTeams => {
                const updatedTeams = JSON.parse(JSON.stringify(prevTeams));
                const bowlerToUpdate = updatedTeams[currentBowlingTeamKey]?.bowlers.find(b => b.id === bowlerId);
                if (bowlerToUpdate) {
                    bowlerToUpdate.previousSpells.push({ ...bowlerToUpdate.currentSpell });
                    bowlerToUpdate.currentSpell = { runs: 0, wickets: 0, balls: 0, maidens: 0 };
                }
                return updatedTeams;
            });

            // 4. Update the `players` state to set the new bowler and swap batsmen
            setPlayers(prevPlayers => {
                const allBowlers = teams[currentBowlingTeamKey].bowlers;
                const currentBowlerIndex = allBowlers.findIndex(b => b.id === prevPlayers.bowler.id);
                
                let nextBowler = prevPlayers.bowler;
                if (currentBowlerIndex !== -1 && allBowlers.length > 1) {
                    const nextBowlerIndex = (currentBowlerIndex + 1) % allBowlers.length;
                    nextBowler = allBowlers[nextBowlerIndex];
                }

                return {
                    striker: prevPlayers.nonStriker,
                    nonStriker: prevPlayers.striker,
                    bowler: nextBowler,
                    lastBowler: prevPlayers.bowler.id
                };
            });

            // 5. Reset the over history display for the new over
            setOverHistory([]);
        }
    }, [match.balls, match.isComplete, isLoading]);


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
        // This is the fix: Create an authorization header with the user's token.
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            timeout: 7000
        };

        const currentBattingTeamKey = teams.teamA.name === match.battingTeam ? 'teamA' : 'teamB';
        const currentBowlingTeamKey = currentBattingTeamKey === 'teamA' ? 'teamB' : 'teamA';

        if (!teams[currentBattingTeamKey] || !teams[currentBowlingTeamKey]) {
            console.error("❌ Critical error: Could not determine current teams for update.");
            return;
        }

        // The functions formatBatsmenForUpdate and formatBowlersForUpdate must be defined in your component
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

        // Send the request with the payload AND the authorization config
        const response = await axios.put(
            `/api/matches/${backendMatchId}`, // Use relative path for proxy
            updatePayload,
            config // Pass the config here
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


const saveState = useCallback(() => {
  setHistory(prev => [...prev, {
    match: JSON.parse(JSON.stringify(match)),
    players: JSON.parse(JSON.stringify(players)),
    teams: JSON.parse(JSON.stringify(teams)),
    overHistory: [...overHistory],
    allOversHistory: [...allOversHistory],  // Ensure we save a copy of the overs history
    lastCompletedOver: lastCompletedOver.current,  // Save the ref value
    lastCompletedOverBallCount: lastCompletedOverBallCount.current  // Save the ref value
  }].slice(-10));  // Keep only last 10 states
}, [match, players, teams, overHistory, allOversHistory]);

  
  // Undo functionality
  const handleUndo = () => {
  if (history.length === 0) return;

  const previousState = history[history.length - 1];
  
  // Restore all state from history
  setMatch(previousState.match);
  setPlayers(previousState.players);
  setTeams(previousState.teams);
  setOverHistory(previousState.overHistory);
  setAllOversHistory(previousState.allOversHistory);
  
  // Restore the ref values for over tracking
  lastCompletedOver.current = previousState.lastCompletedOver;
  lastCompletedOverBallCount.current = previousState.lastCompletedOverBallCount;

  // Remove the state we just restored from history
  setHistory(history.slice(0, -1));
  
  // Reset any selected action
  setSelectedAction(null);
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
    saveState();
    const strikerId = players.striker.id;
    const currentBattingTeamKey = teams.teamA.name === match.battingTeam ? 'teamA' : 'teamB';
    const currentBowlingTeamKey = currentBattingTeamKey === 'teamA' ? 'teamB' : 'teamA';

    // 1. Update overall match score
    setMatch(prev => ({
      ...prev,
      runs: prev.runs + runsScored,
      balls: prev.balls + 1,
    }));

    // 2. Update stats in the main `teams` state for both bowler and batsman
    setTeams(prevTeams => {
      const updatedTeams = JSON.parse(JSON.stringify(prevTeams)); // Deep clone for safe mutation

      // Update bowler's spell
      const bowlerToUpdate = updatedTeams[currentBowlingTeamKey]?.bowlers.find(b => b.id === players.bowler.id);
      if (bowlerToUpdate) {
        bowlerToUpdate.currentSpell.runs += runsScored;
        bowlerToUpdate.currentSpell.balls += 1;
      }

      // Update striker's score
      const batsmanToUpdate = updatedTeams[currentBattingTeamKey]?.batsmen.find(b => b.id === strikerId);
      if (batsmanToUpdate) {
        batsmanToUpdate.runs += runsScored;
        batsmanToUpdate.balls += 1;
        if (runsScored === 4) batsmanToUpdate.fours += 1;
        if (runsScored === 6) batsmanToUpdate.sixes += 1;
        batsmanToUpdate.status = 'Not Out';
      }
      return updatedTeams;
    });

    // 3. Update the local `players` state for immediate UI feedback and strike rotation
    setPlayers(prev => {
      const updatedStriker = {
        ...prev.striker,
        runs: (prev.striker.runs || 0) + runsScored,
        balls: (prev.striker.balls || 0) + 1,
        fours: runsScored === 4 ? (prev.striker.fours || 0) + 1 : (prev.striker.fours || 0),
        sixes: runsScored === 6 ? (prev.striker.sixes || 0) + 1 : (prev.striker.sixes || 0),
      };

      // Rotate strike on odd runs
      const strikeRotated = runsScored % 2 !== 0;
      return {
        ...prev,
        striker: strikeRotated ? prev.nonStriker : updatedStriker,
        nonStriker: strikeRotated ? updatedStriker : prev.nonStriker,
      };
    });

    setOverHistory(prev => [...prev, runsScored.toString()]);
    setSelectedAction(null);
    setShowModal(null);
    // sendMatchUpdate(); // Consider batching updates or calling after a short delay
  }; 


    // Handle extras
  const handleExtras = (type, runsFromExtras = 0) => {
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
  
  setAllOversHistory(prev => [completedOverData, ...prev]);

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



// In ScoreCard.jsx, replace the entire function

const handleWicket = useCallback((dismissalInfo) => {
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
    // ... (rest of your startSecondInnings logic, ensure it uses up-to-date state or props)
    // For example, if it uses 'match.runs' for target, 'match' should be a dependency.

    const firstInningsActualBattingTeamName = match.battingTeam || (matchSettings?.firstBatting || teams.teamA.name);
    const firstInningsActualBowlingTeamName = match.bowlingTeam || (firstInningsActualBattingTeamName === teams.teamA.name ? teams.teamB.name : teams.teamA.name);

    const firstInningsBattingTeamKey = teams.teamA.name === firstInningsActualBattingTeamName ? 'teamA' : 'teamB';
    const firstInningsBowlingTeamKey = firstInningsBattingTeamKey === 'teamA' ? 'teamB' : 'teamA';

    if (!teams[firstInningsBattingTeamKey] || !teams[firstInningsBowlingTeamKey]) {
      console.error("❌ Critical error in startSecondInnings: Cannot determine team keys for first innings summary.");
      return;
    }
    const formatBowlersForSummaryInContext = (bowlersList = [], ballsPerOverSettings) => {
        return bowlersList.map(b => {
          const allSpells = [...(b.previousSpells || [])];
          if (b.currentSpell && (b.currentSpell.balls > 0 || b.currentSpell.runs > 0 || b.currentSpell.wickets > 0)) { // only include if active
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

    const innings1OverHistory = allOversHistory.filter(o => o.innings === 1);

    const innings1CompleteSummary = {
      teamName: teams[firstInningsBattingTeamKey].name,
      batting: formatBatsmenData(
          teams[firstInningsBattingTeamKey].batsmen,
          players.striker,
          players.nonStriker
      ),
      bowling: formatBowlersForSummaryInContext(teams[firstInningsBowlingTeamKey].bowlers, settings.ballsPerOver),
      runs: match.runs,
      wickets: match.wickets,
      overs: `${Math.floor(match.balls / settings.ballsPerOver)}.${match.balls % settings.ballsPerOver}`,
      extras: { ...(match.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 }) },
      fallOfWickets: [...(match.fallOfWickets || [])],
      runRate: match.balls > 0 ? (match.runs / (match.balls / settings.ballsPerOver)).toFixed(2) : "0.00",
      overHistory: innings1OverHistory
    };
    console.log("✅ First Innings Summary Prepared:", innings1CompleteSummary);

    const secondInningsBattingTeamName = firstInningsActualBowlingTeamName;
    const secondInningsBowlingTeamName = firstInningsActualBattingTeamName;
    const secondInningsBattingTeamKey = teams.teamA.name === secondInningsBattingTeamName ? 'teamA' : 'teamB';
    const secondInningsBowlingTeamKey = teams.teamA.name === secondInningsBowlingTeamName ? 'teamA' : 'teamB';

    setTeams(prevTeams => { // Reset player stats for 2nd innings
        const newTeams = JSON.parse(JSON.stringify(prevTeams)); // Deep clone
        if (newTeams[secondInningsBattingTeamKey]) {
            newTeams[secondInningsBattingTeamKey].batsmen = newTeams[secondInningsBattingTeamKey].batsmen.map(b => ({
                ...b, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, outType: '', strikeRate: '0.00', status: 'Did Not Bat', atCrease: false
            }));
        }
        if (newTeams[secondInningsBowlingTeamKey]) {
            newTeams[secondInningsBowlingTeamKey].bowlers = newTeams[secondInningsBowlingTeamKey].bowlers.map(b => ({
                ...b, previousSpells: [], currentSpell: { runs: 0, wickets: 0, balls: 0, maidens: 0 }
            }));
        }
        return newTeams;
    });


    setMatch(prev => ({
      ...prev,
      _id: prev._id || matchId,
      innings: 2,
      isChasing: true,
      target: prev.runs + 1,
      firstInningsSummary: innings1CompleteSummary,
      runs: 0, wickets: 0, balls: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
      fallOfWickets: [],
      battingTeam: secondInningsBattingTeamName,
      bowlingTeam: secondInningsBowlingTeamName,
      isComplete: false, // Ensure match is not marked complete yet
    }));

    const newStrikerFromList = teams[secondInningsBattingTeamKey]?.batsmen[0];
    const newNonStrikerFromList = teams[secondInningsBattingTeamKey]?.batsmen[1];
    const newBowlerFromList = teams[secondInningsBowlingTeamKey]?.bowlers[0];

    setPlayers({
      striker: newStrikerFromList ? { ...newStrikerFromList, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, outType: '', status: 'Not Out' } : { id: uuidv4(), name: `${secondInningsBattingTeamName} Batsman 1`, runs: 0, balls: 0, isOut: false, outType: '', status: 'Not Out' },
      nonStriker: newNonStrikerFromList ? { ...newNonStrikerFromList, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, outType: '', status: 'Not Out' } : { id: uuidv4(), name: `${secondInningsBattingTeamName} Batsman 2`, runs: 0, balls: 0, isOut: false, outType: '', status: 'Not Out' },
      bowler: newBowlerFromList ? { ...newBowlerFromList, currentSpell: {runs:0, wickets:0, balls:0, maidens:0}, previousSpells:[] } : { id: uuidv4(), name: `${secondInningsBowlingTeamName} Bowler 1`, currentSpell: {runs:0, wickets:0, balls:0, maidens:0}, previousSpells:[] },
      nextBatsmanId: (newNonStrikerFromList?.id || 1) + 1, // This logic might need review based on how IDs are assigned
      lastBowler: null
    });

    setOverHistory([]);
    setSelectedAction(null);
    console.log(`✅ Second innings ready. Batting: ${secondInningsBattingTeamName}, Bowling: ${secondInningsBowlingTeamName}. Target: ${match.runs + 1}`);
    sendMatchUpdate();

  }, [match, teams, players, settings, matchSettings, matchId, sendMatchUpdate]);


  
const endMatch = useCallback(async () => {
    if (match.isComplete) {
        console.warn("endMatch called but match is already complete.");
        return;
    }

    const finalMatchId = matchSettings?._id || match?._id;
    if (!finalMatchId) {
        console.error("CRITICAL ERROR: Could not determine Match ID in endMatch.");
        alert("A critical error occurred: Match ID is missing. Cannot end match.");
        return;
    }

    // 1. Finalize Match State
    const finalMatchState = { ...match, isComplete: true, status: "completed" };

    const calculateFinalResult = (finalState) => {
        if (!finalState.isChasing) return "Match Abandoned or Incomplete";
        if (finalState.runs >= finalState.target) {
            const wicketsRemaining = (settings.playersPerTeam - 1) - finalState.wickets;
            return `${finalState.battingTeam} won by ${wicketsRemaining} wicket${wicketsRemaining !== 1 ? 's' : ''}`;
        }
        if (finalState.target > finalState.runs) {
            const runMargin = finalState.target - finalState.runs - 1;
            if (runMargin < 0) return `${finalState.battingTeam} won by ${Math.abs(runMargin)} wicket(s)`;
            if (runMargin === 0) return 'Match tied';
            return `${finalState.firstInningsSummary?.teamName || 'The opposition'} won by ${runMargin} run${runMargin !== 1 ? 's' : ''}`;
        }
        return 'Result not determined';
    };

    finalMatchState.result = calculateFinalResult(finalMatchState);
    setMatch(finalMatchState);

    // 2. Format Final Data
    const formatFinalBatsmen = (batsmenList = []) => batsmenList.map(b => ({
        id: b.id,
        name: b.name,
        status: b.isOut ? (b.outType || 'Out') : (b.balls > 0 || b.runs > 0 ? 'Not Out' : 'Did Not Bat'),
        runs: b.runs || 0, 
        balls: b.balls || 0, 
        fours: b.fours || 0, 
        sixes: b.sixes || 0,
        strikeRate: b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00",
    }));

    const formatFinalBowlers = (bowlersList = []) => bowlersList.map(b => {
        const allSpells = [...(b.previousSpells || []), ...(b.currentSpell ? [b.currentSpell] : [])];
        const totals = allSpells.reduce((acc, spell) => ({
            balls: acc.balls + (spell.balls || 0), 
            runs: acc.runs + (spell.runs || 0),
            wickets: acc.wickets + (spell.wickets || 0), 
            maidens: acc.maidens + (spell.maidens || 0)
        }), { balls: 0, runs: 0, wickets: 0, maidens: 0 });
        
        return {
            id: b.id,
            name: b.name,
            overs: `${Math.floor(totals.balls / settings.ballsPerOver)}.${totals.balls % settings.ballsPerOver}`,
            runs: totals.runs, 
            wickets: totals.wickets, 
            maidens: totals.maidens,
            economyRate: totals.balls > 0 ? ((totals.runs / totals.balls) * settings.ballsPerOver).toFixed(2) : "0.00"
        };
    });

    // 3. Prepare Innings Data
    const innings1OverHistory = allOversHistory.filter(o => o.innings === 1);
    const innings2OverHistory = allOversHistory.filter(o => o.innings === 2);
    const finalExtras = { ...(finalMatchState.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 }) };

    // Helper function to format batsmen data consistently
    const getFormattedBatsmen = (teamKey) => {
        return formatBatsmenData(
            teams[teamKey].batsmen,
            players.striker,
            players.nonStriker
        );
    };

    let innings1Data;
    if (finalMatchState.firstInningsSummary) {
        innings1Data = { 
            ...finalMatchState.firstInningsSummary, 
            overHistory: innings1OverHistory 
        };
    } else {
        const battingTeamKey = matchSettings.firstBatting === teams.teamA.name ? 'teamA' : 'teamB';
        const bowlingTeamKey = battingTeamKey === 'teamA' ? 'teamB' : 'teamA';
        
        innings1Data = {
            teamName: teams[battingTeamKey].name,
            batting: getFormattedBatsmen(battingTeamKey),
            bowling: formatFinalBowlers(teams[bowlingTeamKey].bowlers),
            runs: finalMatchState.runs,
            wickets: finalMatchState.wickets,
            extras: finalExtras,
            overs: `${Math.floor(finalMatchState.balls / settings.ballsPerOver)}.${finalMatchState.balls % settings.ballsPerOver}`,
            overHistory: innings1OverHistory
        };
    }

    let innings2Data = null;
    if (finalMatchState.innings === 2) {
        const battingTeamKey = teams.teamA.name === finalMatchState.battingTeam ? 'teamA' : 'teamB';
        const bowlingTeamKey = battingTeamKey === 'teamA' ? 'teamB' : 'teamA';
        
        innings2Data = {
            teamName: teams[battingTeamKey].name,
            batting: getFormattedBatsmen(battingTeamKey),
            bowling: formatFinalBowlers(teams[bowlingTeamKey].bowlers),
            runs: finalMatchState.runs,
            wickets: finalMatchState.wickets,
            extras: finalExtras,
            overs: `${Math.floor(finalMatchState.balls / settings.ballsPerOver)}.${finalMatchState.balls % settings.ballsPerOver}`,
            target: finalMatchState.target,
            overHistory: innings2OverHistory
        };
    }

    // 4. Create Final Payloads
  const finalMatchDataPayload = {
  _id: finalMatchId,
  teamA: { 
    name: teams.teamA.name, 
    shortName: teams.teamA.name.substring(0, 3).toUpperCase() 
  },
  teamB: { 
    name: teams.teamB.name, 
    shortName: teams.teamB.name.substring(0, 3).toUpperCase() 
  },
  date: new Date().toISOString(),
  venue: settings.venue, 
  toss: settings.toss, 
  matchType: settings.matchType,
  totalOvers: settings.overs, 
  status: "completed", 
  result: finalMatchState.result,
  innings1: {
    teamName: innings1Data.teamName,
    batting: innings1Data.batting,
    bowling: innings1Data.bowling,
    runs: innings1Data.runs,
    wickets: innings1Data.wickets,
    overs: innings1Data.overs,
    extras: innings1Data.extras,
    fallOfWickets: innings1Data.fallOfWickets,
    target: innings1Data.target,
    overHistory: innings1Data.overHistory
  },
  innings2: innings2Data ? {
    teamName: innings2Data.teamName,
    batting: innings2Data.batting,
    bowling: innings2Data.bowling,
    runs: innings2Data.runs,
    wickets: innings2Data.wickets,
    overs: innings2Data.overs,
    extras: innings2Data.extras,
    fallOfWickets: innings2Data.fallOfWickets,
    target: innings2Data.target,
    overHistory: innings2Data.overHistory
  } : null,
  matchSummary: {
    playerOfMatch: determinePlayerOfMatch(innings1Data, innings2Data),
    netRunRates: calculateNetRunRates(innings1Data, innings2Data, settings)
  }
};

    const finalApiPayload = {
        status: "completed", 
        result: finalMatchState.result,
        innings1: innings1Data, 
        innings2: innings2Data,
    };

    // 5. Persist Data
    try {
        console.log("Caching full match data to localStorage...");
        localStorage.setItem(`finalMatchData_${finalMatchId}`, JSON.stringify(finalMatchDataPayload));

        if (!finalMatchId.startsWith('guest_') && user && user.token) {
            console.log("Saving final match data to server...");
            const config = { 
                headers: { 
                    'Authorization': `Bearer ${user.token}`,
                    'Content-Type': 'application/json'
                } 
            };
            
            await axios.put(
                `/api/matches/${finalMatchId}`, 
                finalApiPayload, 
                config
            );
            console.log("✅ Core match data saved to server successfully.");
        }

        if (onMatchEnd) {
            onMatchEnd(finalMatchDataPayload);
        }

    } catch (error) {
        console.error("❌ Failed to save final match data:", {
            message: error.message,
            response: error.response?.data
        });
        alert("Error: Could not save the final match results. Please check your connection.");
    }
}, [
    match, 
    teams, 
    players, 
    settings, 
    matchSettings, 
    onMatchEnd, 
    user, 
    allOversHistory, 
    axios,
]);


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
// In ScoreCard.jsx, replace the existing handleBowlerChange function

const handleBowlerChange = (newBowlerId) => {
  const currentBowlingTeam = match.innings === 1 ? 'teamB' : 'teamA';
  
  // First archive the current bowler's spell
  setTeams(prevTeams => {
    const updatedTeams = { ...prevTeams };
    const currentBowlerId = players.bowler.id;
    
    updatedTeams[currentBowlingTeam] = {
      ...updatedTeams[currentBowlingTeam],
      bowlers: updatedTeams[currentBowlingTeam].bowlers.map(bowler => {
        if (bowler.id === currentBowlerId) {
          return {
            ...bowler,
            previousSpells: [...bowler.previousSpells, bowler.currentSpell],
            currentSpell: { runs: 0, wickets: 0, balls: 0, maidens: 0 }
          };
        }
        return bowler;
      })
    };
    return updatedTeams;
  });

  // Then set the new bowler
  const newBowler = teams[currentBowlingTeam].bowlers.find(b => b.id === newBowlerId);
  setPlayers(prev => ({
    ...prev,
    bowler: newBowler,
    lastBowler: prev.bowler.id
  }));
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
                className={modalData.batsmanOut === 'striker' ? 'selected' : ''}
            >
                {players.striker.name} (Striker)
            </button>
            <button
                onClick={() => setModalData(prev => ({ ...prev, batsmanOut: 'nonStriker' }))}
                className={modalData.batsmanOut === 'nonStriker' ? 'selected' : ''}
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



const renderNoBallOptions = () => (
    <div className="no-ball-options">
      {/* Section 1: Select runs scored off the bat */}
      <h4>Runs Scored Off Bat</h4>
      <p className="modal-subtitle">(In addition to the No Ball penalty)</p>
      <div className="number-grid">
        {[0, 1, 2, 3, 4, 6].map(num => (
          <button
            key={num}
            onClick={() => setModalData(prev => ({ ...prev, value: num }))}
            className={modalData.value === num ? 'selected' : ''}
          >
            {/* This line is changed to format the button text */}
            {num === 0 ? 'NB' : `NB+${num}`}
          </button>
        ))}
      </div>

      {/* Section 2: Directly select the batsman who was run out */}
      <div className="direct-wicket-section">
        <h4 className="wicket-title">Run Out (Optional)</h4>
        <p className="modal-subtitle">If a batsman was run out, select them below.</p>
        <div className="batter-selection">
          <button
            // FIX: If clicked again, it deselects the batsman.
            onClick={() => setModalData(prev => ({ ...prev, batsmanOut: prev.batsmanOut === 'striker' ? null : 'striker' }))}
            className={modalData.batsmanOut === 'striker' ? 'selected' : ''}
          >
            {players.striker.name} (Striker)
          </button>
          <button
            // FIX: If clicked again, it deselects the batsman.
            onClick={() => setModalData(prev => ({ ...prev, batsmanOut: prev.batsmanOut === 'nonStriker' ? null : 'nonStriker' }))}
            className={modalData.batsmanOut === 'nonStriker' ? 'selected' : ''}
          >
            {players.nonStriker.name} (Non-Striker)
          </button>
        </div>
      </div>
    </div>
);

const renderWideBallOptions = () => (
    <div className="wide-ball-options">
      <h4>Runs Scored (Byes)</h4>
      <p className="modal-subtitle">(In addition to the Wide penalty)</p>
      <div className="number-grid">
        {[0, 1, 2, 3, 4].map(num => (
          <button
            key={num}
            onClick={() => setModalData(prev => ({ ...prev, value: num }))}
            className={modalData.value === num ? 'selected' : ''}
          >
            {/* Change is here: Use a conditional to format the button text */}
            {num === 0 ? 'WD' : `WD+${num}`}
          </button>
        ))}
      </div>

      <div className="direct-wicket-section">
        <h4 className="wicket-title">Run Out (Optional)</h4>
        <p className="modal-subtitle">If a batsman was run out, select them below.</p>
        <div className="batter-selection">
          <button
            onClick={() => setModalData(prev => ({ ...prev, batsmanOut: prev.batsmanOut === 'striker' ? null : 'striker' }))}
            className={modalData.batsmanOut === 'striker' ? 'selected' : ''}
          >
            {players.striker.name} (Striker)
          </button>
          <button
            onClick={() => setModalData(prev => ({ ...prev, batsmanOut: prev.batsmanOut === 'nonStriker' ? null : 'nonStriker' }))}
            className={modalData.batsmanOut === 'nonStriker' ? 'selected' : ''}
          >
            {players.nonStriker.name} (Non-Striker)
          </button>
        </div>
      </div>
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
                <span className="batsman-runs">{players.striker.runs}</span>
                <span className="batsman-balls">({players.striker.balls})</span>
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