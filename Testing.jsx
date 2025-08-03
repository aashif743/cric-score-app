// ScoreCard.jsx (PART 1 - Imports & Constants)
import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { FiSettings, FiArrowLeft, FiRefreshCw } from 'react-icons/fi';
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import io from "socket.io-client";
import axios from 'axios';

import './ScorecardPage.css';
import API from '../api';
import { AuthContext } from '../context/AuthContext.jsx';

const socket = io("https://cric-score-app.onrender.com");
const API_BASE = import.meta.env.VITE_API_BASE_URL;


// ScoreCard.jsx (PART 2 - Utility Functions)
const formatOvers = (balls, ballsPerOver) =>
  `${Math.floor(balls / ballsPerOver)}.${balls % ballsPerOver}`;

const calculateRunRate = (runs, balls, ballsPerOver) =>
  balls > 0 ? (runs / (balls / ballsPerOver)).toFixed(2) : "0.00";

const formatBatsmen = (list = []) => list.map(b => ({
  ...b,
  strikeRate: b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00",
  status: b.isOut ? b.outType || 'Out' : (b.balls > 0 || b.runs > 0 ? 'Not Out' : 'Did Not Bat')
}));

const formatBowlers = (bowlersList = [], ballsPerOver) => bowlersList.map(b => {
  const spells = [...(b.previousSpells || []), b.currentSpell || {}];
  const totals = spells.reduce((acc, spell) => ({
    balls: acc.balls + (spell.balls || 0),
    runs: acc.runs + (spell.runs || 0),
    wickets: acc.wickets + (spell.wickets || 0),
    maidens: acc.maidens + (spell.maidens || 0),
  }), { balls: 0, runs: 0, wickets: 0, maidens: 0 });

  return {
    ...b,
    overs: formatOvers(totals.balls, ballsPerOver),
    economyRate: totals.balls > 0 ? ((totals.runs / totals.balls) * ballsPerOver).toFixed(2) : "0.00",
    ...totals,
  };
});

const calculateNetRunRates = (innings1, innings2, settings) => {
  if (!innings1?.teamName || !innings2?.teamName) return {};
  const parseOvers = oversStr => {
    const [o, b] = String(oversStr).split('.').map(Number);
    return o + (b / settings.ballsPerOver);
  };
  const runRate = (runs, overs) => overs > 0 ? (runs / overs).toFixed(3) : "0.00";
  const team1Overs = innings1.wickets === settings.playersPerTeam - 1 ? settings.overs : parseOvers(innings1.overs);
  const team2Overs = innings2.wickets === settings.playersPerTeam - 1 ? settings.overs : parseOvers(innings2.overs);

  return {
    [innings1.teamName]: (runRate(innings1.runs, team1Overs) - runRate(innings2.runs, team2Overs)).toString(),
    [innings2.teamName]: (runRate(innings2.runs, team2Overs) - runRate(innings1.runs, team1Overs)).toString(),
  };
};

const determinePlayerOfMatch = (innings1, innings2) => {
  const allBatters = [...(innings1?.batting || []), ...(innings2?.batting || [])];
  const allBowlers = [...(innings1?.bowling || []), ...(innings2?.bowling || [])];
  const topScorer = allBatters.reduce((a, b) => (b.runs > (a?.runs || -1) ? b : a), null);
  const topWicketTaker = allBowlers.reduce((a, b) => (b.wickets > (a?.wickets || -1) ? b : a), null);

  if (topWicketTaker?.wickets >= 3) return topWicketTaker.name;
  if (topScorer?.runs >= 30) return topScorer.name;
  return topScorer?.name || topWicketTaker?.name || "N/A";
};


// ScoreCard.jsx (PART 3 - Initial State + useState Setup)

const createInitialState = (matchSettings) => {
  const teamAName = matchSettings?.teamA?.name || matchSettings?.teamA || 'Team A';
  const teamBName = matchSettings?.teamB?.name || matchSettings?.teamB || 'Team B';
  const totalOvers = matchSettings?.totalOvers || matchSettings?.overs || 6;
  const playersPerTeam = matchSettings?.playersPerTeam || 11;
  const ballsPerOver = matchSettings?.ballsPerOver || 6;

  const createTeam = (name, count) => ({
    name,
    batsmen: Array.from({ length: count }, (_, i) => ({ id: uuidv4(), name: `Player ${i + 1}` })),
    bowlers: Array.from({ length: count }, (_, i) => ({ id: uuidv4(), name: `Player ${i + 1}` }))
  });

  const teamA = createTeam(teamAName, playersPerTeam);
  const teamB = createTeam(teamBName, playersPerTeam);

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
      runs: 0,
      wickets: 0,
      balls: 0,
      innings: 1,
      target: 0,
      isChasing: false,
      isComplete: false,
      result: '',
      fallOfWickets: [],
      extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      battingTeam: teamAName,
      bowlingTeam: teamBName,
      firstInningsSummary: null,
    },
    teams: { teamA, teamB },
    players: {
      striker: { ...teamA.batsmen[0], runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, status: 'Not Out' },
      nonStriker: { ...teamA.batsmen[1], runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, status: 'Not Out' },
      bowler: { ...teamB.bowlers[0], currentSpell: { runs: 0, wickets: 0, balls: 0, maidens: 0 }, previousSpells: [] },
      lastBowler: null
    }
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

  const [selectedAction, setSelectedAction] = useState(null);
  const [showModal, setShowModal] = useState(null);
  const [modalData, setModalData] = useState({});
  const [overHistory, setOverHistory] = useState([]);
  const [history, setHistory] = useState([]);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [matchId, setMatchId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPrevOversModal, setShowPrevOversModal] = useState(false);
  const [allOversHistory, setAllOversHistory] = useState(() => {
    const saved = localStorage.getItem(`oversHistory_${matchId}`);
    return saved ? JSON.parse(saved).slice(0, 20) : [];
  });

  const stateRef = useRef();
  const lastCompletedOver = useRef(0);
  const lastCompletedOverBallCount = useRef(0);

  stateRef.current = { match, teams, players, settings, allOversHistory, overHistory };

  // Derived values
  const runs = match.runs || 0;
  const wickets = match.wickets || 0;
  const balls = match.balls || 0;
  const overs = formatOvers(balls, settings.ballsPerOver);
  const crr = calculateRunRate(runs, balls, settings.ballsPerOver);
  const remainingBalls = (settings.overs * settings.ballsPerOver) - balls;
  const remainingRuns = match.target - runs;
  const requiredRunRate = remainingBalls > 0 ? (remainingRuns / (remainingBalls / settings.ballsPerOver)).toFixed(2) : '0.00';


  // ScoreCard.jsx (PART 4 - Core Match Logic)

const saveState = useCallback(() => {
  setHistory(prev => [
    ...prev.slice(-9),
    {
      match: JSON.parse(JSON.stringify(match)),
      players: JSON.parse(JSON.stringify(players)),
      overHistory: [...overHistory],
      lastCompletedOver: lastCompletedOver.current,
      lastCompletedOverBallCount: lastCompletedOverBallCount.current,
    },
  ]);
}, [match, players, overHistory]);

const handleUndo = () => {
  if (history.length === 0) return;

  const prevState = history[history.length - 1];

  setMatch(prevState.match);
  setPlayers(prevState.players);
  setOverHistory(prevState.overHistory);
  lastCompletedOver.current = prevState.lastCompletedOver;
  lastCompletedOverBallCount.current = prevState.lastCompletedOverBallCount;

  setTeams(currentTeams => {
    const updated = JSON.parse(JSON.stringify(currentTeams));
    const battingKey = updated.teamA.name === prevState.match.battingTeam ? 'teamA' : 'teamB';
    const bowlingKey = battingKey === 'teamA' ? 'teamB' : 'teamA';

    const striker = updated[battingKey].batsmen.find(b => b.id === prevState.players.striker.id);
    const nonStriker = updated[battingKey].batsmen.find(b => b.id === prevState.players.nonStriker.id);
    const bowler = updated[bowlingKey].bowlers.find(b => b.id === prevState.players.bowler.id);

    if (striker) Object.assign(striker, prevState.players.striker);
    if (nonStriker) Object.assign(nonStriker, prevState.players.nonStriker);
    if (bowler) bowler.currentSpell = prevState.players.bowler.currentSpell;

    return updated;
  });

  setSelectedAction(null);
};

const updateBowlerStats = (runs = 0, isWicket = false, countBall = true) => {
  const currentBowlingTeamKey = match.innings === 1 ? 'teamB' : 'teamA';
  const bowlerId = players.bowler.id;

  setTeams(prevTeams => {
    const updated = { ...prevTeams };
    updated[currentBowlingTeamKey].bowlers = updated[currentBowlingTeamKey].bowlers.map(bowler => {
      if (bowler.id !== bowlerId) return bowler;
      const updatedSpell = {
        ...bowler.currentSpell,
        runs: bowler.currentSpell.runs + runs,
        wickets: isWicket ? bowler.currentSpell.wickets + 1 : bowler.currentSpell.wickets,
        balls: countBall ? bowler.currentSpell.balls + 1 : bowler.currentSpell.balls,
      };
      if (countBall && updatedSpell.balls % settings.ballsPerOver === 0 && updatedSpell.runs === 0) {
        updatedSpell.maidens = (bowler.currentSpell.maidens || 0) + 1;
      }
      return { ...bowler, currentSpell: updatedSpell };
    });
    return updated;
  });

  // UI update
  setPlayers(prev => {
    if (prev.bowler.id !== bowlerId) return prev;
    return {
      ...prev,
      bowler: {
        ...prev.bowler,
        currentSpell: {
          ...prev.bowler.currentSpell,
          runs: prev.bowler.currentSpell.runs + runs,
          wickets: isWicket ? prev.bowler.currentSpell.wickets + 1 : prev.bowler.currentSpell.wickets,
          balls: countBall ? prev.bowler.currentSpell.balls + 1 : prev.bowler.currentSpell.balls,
        },
      },
    };
  });
};

const handleRuns = (runsScored) => {
  saveState();

  const strikerId = players.striker.id;
  const battingKey = teams.teamA.name === match.battingTeam ? 'teamA' : 'teamB';
  const bowlingKey = battingKey === 'teamA' ? 'teamB' : 'teamA';

  setMatch(prev => ({
    ...prev,
    runs: prev.runs + runsScored,
    balls: prev.balls + 1,
  }));

  setTeams(prevTeams => {
    const updated = JSON.parse(JSON.stringify(prevTeams));

    const bowler = updated[bowlingKey].bowlers.find(b => b.id === players.bowler.id);
    if (bowler) {
      bowler.currentSpell.runs += runsScored;
      bowler.currentSpell.balls += 1;
    }

    const batsman = updated[battingKey].batsmen.find(b => b.id === strikerId);
    if (batsman) {
      batsman.runs += runsScored;
      batsman.balls += 1;
      if (runsScored === 4) batsman.fours += 1;
      if (runsScored === 6) batsman.sixes += 1;
      batsman.status = 'Not Out';
    }

    return updated;
  });

  setPlayers(prev => {
    const updatedStriker = {
      ...prev.striker,
      runs: (prev.striker.runs || 0) + runsScored,
      balls: (prev.striker.balls || 0) + 1,
      fours: runsScored === 4 ? (prev.striker.fours || 0) + 1 : (prev.striker.fours || 0),
      sixes: runsScored === 6 ? (prev.striker.sixes || 0) + 1 : (prev.striker.sixes || 0),
    };
    const rotate = runsScored % 2 !== 0;
    return {
      ...prev,
      striker: rotate ? prev.nonStriker : updatedStriker,
      nonStriker: rotate ? updatedStriker : prev.nonStriker,
    };
  });

  setOverHistory(prev => [...prev, runsScored.toString()]);
  setSelectedAction(null);
  setShowModal(null);
};


// ScoreCard.jsx (PART 4B - Extras, Wickets, Over Completion, Innings Transition)

const handleExtras = (type, runsFromExtras = 0) => {
  saveState();
  const strikerId = players.striker.id;
  const battingKey = teams.teamA.name === match.battingTeam ? 'teamA' : 'teamB';
  const bowlingKey = battingKey === 'teamA' ? 'teamB' : 'teamA';

  let teamRuns = 0;
  let bowlerRuns = 0;
  let isLegal = true;
  let ballFaced = false;

  switch (type) {
    case 'WD':
      teamRuns = settings.wideBallRuns + runsFromExtras;
      bowlerRuns = teamRuns;
      isLegal = false;
      break;
    case 'NB':
      teamRuns = settings.noBallRuns + runsFromExtras;
      bowlerRuns = teamRuns;
      isLegal = false;
      ballFaced = true;
      break;
    case 'BYE':
    case 'LB':
      teamRuns = runsFromExtras;
      isLegal = true;
      ballFaced = true;
      break;
  }

  setMatch(prev => {
    const extras = { ...prev.extras };
    if (type === 'WD') extras.wides += teamRuns;
    if (type === 'NB') extras.noBalls += teamRuns;
    if (type === 'BYE') extras.byes += teamRuns;
    if (type === 'LB') extras.legByes += teamRuns;
    extras.total += teamRuns;

    return {
      ...prev,
      runs: prev.runs + teamRuns,
      balls: isLegal ? prev.balls + 1 : prev.balls,
      extras,
    };
  });

  updateBowlerStats(bowlerRuns, false, isLegal);

  setTeams(prevTeams => {
    const updated = JSON.parse(JSON.stringify(prevTeams));
    const batsman = updated[battingKey].batsmen.find(b => b.id === strikerId);
    if (batsman && ballFaced) batsman.balls += 1;
    return updated;
  });

  setPlayers(prev => {
    const updatedStriker = { ...prev.striker };
    if (ballFaced) updatedStriker.balls += 1;
    const rotate = runsFromExtras % 2 !== 0;
    return {
      ...prev,
      striker: rotate ? prev.nonStriker : updatedStriker,
      nonStriker: rotate ? updatedStriker : prev.nonStriker,
    };
  });

  setOverHistory(prev => [...prev, `${runsFromExtras > 0 ? runsFromExtras : ''}${type}`]);
  setShowModal(null);
  setSelectedAction(null);
};

const handleWicket = useCallback((dismissalInfo) => {
  saveState();
  const {
    type: outType,
    runsCompleted = 0,
    batsmanOut,
    isNoBall = false,
    isWide = false,
  } = dismissalInfo;

  const battingKey = teams.teamA.name === match.battingTeam ? 'teamA' : 'teamB';

  let dismissed = batsmanOut === 'nonStriker' ? players.nonStriker : players.striker;
  let partner = batsmanOut === 'nonStriker' ? players.striker : players.nonStriker;

  const isRunOut = outType === 'Run Out';
  const isBowlerWicket = !isRunOut && outType !== 'Retired Out';
  const countBall = !isNoBall && !isWide;
  const penaltyRuns = isNoBall ? settings.noBallRuns : isWide ? settings.wideBallRuns : 0;

  updateBowlerStats(penaltyRuns + runsCompleted, isBowlerWicket, countBall);

  setMatch(prev => {
    const extras = { ...prev.extras };
    if (isNoBall) extras.noBalls += penaltyRuns + runsCompleted;
    if (isWide) extras.wides += penaltyRuns + runsCompleted;
    extras.total += penaltyRuns + runsCompleted;

    const newBalls = countBall ? prev.balls + 1 : prev.balls;
    const newRuns = prev.runs + runsCompleted + penaltyRuns;

    return {
      ...prev,
      runs: newRuns,
      balls: newBalls,
      wickets: prev.wickets + 1,
      extras,
      fallOfWickets: [
        ...prev.fallOfWickets,
        {
          batsman: dismissed.name,
          score: newRuns,
          wicket: prev.wickets + 1,
          over: formatOvers(newBalls, settings.ballsPerOver),
        },
      ],
    };
  });

  setTeams(prev => {
    const updated = JSON.parse(JSON.stringify(prev));
    const team = updated[battingKey];
    const batsmen = team.batsmen.map(b => {
      if (b.id === dismissed.id) {
        return {
          ...b,
          runs: b.runs + (isWide ? 0 : runsCompleted),
          balls: b.balls + (countBall ? 1 : 0),
          isOut: true,
          outType,
          status: `${outType}${isNoBall ? ' (NB)' : isWide ? ' (WD)' : ''}`,
        };
      }
      return b;
    });
    team.batsmen = batsmen;
    return updated;
  });

  // Send next batsman
  const batsmenList = teams[battingKey].batsmen.filter(
    b => !b.isOut && b.id !== dismissed.id && b.id !== partner.id
  );
  const next = batsmenList[0];

  if (match.wickets < settings.playersPerTeam - 1 && next) {
    const crossed = runsCompleted % 2 !== 0;
    setPlayers({
      striker: crossed ? partner : next,
      nonStriker: crossed ? next : partner,
      bowler: players.bowler,
      lastBowler: players.lastBowler,
    });
  }

  setOverHistory(prev => [...prev, isNoBall ? `${runsCompleted}NB+W` : isWide ? `${runsCompleted}WD+W` : 'W']);
  setSelectedAction(null);
  setShowModal(null);
}, [match, teams, players, settings]);

const onOverComplete = useCallback(() => {
  saveState();
  const overNumber = Math.floor(match.balls / settings.ballsPerOver);
  const bowlingKey = teams.teamA.name === match.bowlingTeam ? 'teamA' : 'teamB';
  const bowlerId = players.bowler.id;

  const completedOver = {
    overNumber,
    bowlerName: players.bowler.name,
    balls: [...overHistory],
    runs: players.bowler.currentSpell.runs,
    wickets: players.bowler.currentSpell.wickets,
    maiden: players.bowler.currentSpell.runs === 0 && players.bowler.currentSpell.balls === settings.ballsPerOver,
    innings: match.innings
  };

  setAllOversHistory(prev => [completedOver, ...prev].slice(0, 20));
  localStorage.setItem(`oversHistory_${matchId}`, JSON.stringify([completedOver, ...allOversHistory]));

  // Archive bowler's spell
  setTeams(prev => {
    const updated = JSON.parse(JSON.stringify(prev));
    const bowler = updated[bowlingKey].bowlers.find(b => b.id === bowlerId);
    if (bowler) {
      bowler.previousSpells.push(bowler.currentSpell);
      bowler.currentSpell = { runs: 0, wickets: 0, balls: 0, maidens: 0 };
    }
    return updated;
  });

  // Set next bowler and swap batsmen
  const bowlers = teams[bowlingKey].bowlers;
  const currentIndex = bowlers.findIndex(b => b.id === bowlerId);
  const next = bowlers[(currentIndex + 1) % bowlers.length] || players.bowler;

  setPlayers(prev => ({
    striker: prev.nonStriker,
    nonStriker: prev.striker,
    bowler: {
      ...next,
      currentSpell: { runs: 0, wickets: 0, balls: 0, maidens: 0 },
      previousSpells: next.previousSpells || [],
    },
    lastBowler: bowlerId,
  }));

  setOverHistory([]);
}, [players, match, settings, teams, overHistory, matchId]);


// ScoreCard.jsx (PART 5 - useEffects & Live Match Syncing)

const debounceTimeout = useRef(null);

// Load existing match from backend or local state
useEffect(() => {
  const currentMatchId = matchSettings?._id;

  const loadMatch = async () => {
    if (!currentMatchId || currentMatchId.startsWith('guest_')) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const response = await axios.get(`${API_BASE}/api/matches/${currentMatchId}`, config);

      if (response.data.success) {
        const data = response.data.data;
        setSettings(data.settings);
        setMatch(data.match);
        setTeams(data.teams);
        setPlayers(data.players);
        setOverHistory(data.overHistory || []);
        setAllOversHistory(data.allOversHistory || []);
        setHistory([]);
        console.log("✅ Match data loaded");
      }
    } catch (error) {
      console.error("❌ Failed to load match:", error);
    } finally {
      setIsLoading(false);
    }
  };

  loadMatch();

  // Socket connection setup
  socket.connect();
  socket.emit("join-match", currentMatchId);

  return () => {
    socket.emit("leave-match", currentMatchId);
    socket.disconnect();
  };
}, [matchSettings, user]);

// Live state saving to backend (debounced)
useEffect(() => {
  if (isLoading || match.isComplete || !match?._id || match._id.startsWith('guest_')) return;

  if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

  debounceTimeout.current = setTimeout(() => {
    const stateToSave = {
      settings, match, teams, players, overHistory, allOversHistory,
    };

    const saveUpdate = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        await axios.put(`${API_BASE}/api/matches/${match._id}`, stateToSave, config);
        console.log("✅ Live state saved to server");
      } catch (error) {
        console.error("❌ Error saving match state:", error);
      }
    };

    saveUpdate();
  }, 2000);

  return () => clearTimeout(debounceTimeout.current);
}, [settings, match, teams, players, overHistory, allOversHistory, isLoading, user]);

// Detect over completion (balls modulo ballsPerOver === 0)
useEffect(() => {
  if (match.isComplete || isLoading) return;

  const isOverComplete = match.balls > 0 && match.balls % settings.ballsPerOver === 0;
  if (isOverComplete && match.balls !== lastCompletedOverBallCount.current) {
    lastCompletedOverBallCount.current = match.balls;
    onOverComplete();
  }
}, [match.balls, match.isComplete, isLoading, settings.ballsPerOver]);

// Cleanup old matches from localStorage (on unmount)
useEffect(() => {
  return () => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('matchState_')) {
        try {
          const matchData = JSON.parse(localStorage.getItem(key));
          const matchDate = matchData?.match?.date ? new Date(matchData.match.date).getTime() : now;
          if (now - matchDate > oneDay) localStorage.removeItem(key);
        } catch (e) {
          localStorage.removeItem(key); // Remove corrupted data
        }
      }
    });
  };
}, []);


// ScoreCard.jsx (PART 6 - Match Completion & Summary)

const startSecondInnings = () => {
  saveState();

  const firstInningsData = {
    teamName: match.battingTeam,
    runs: match.runs,
    wickets: match.wickets,
    overs: formatOvers(match.balls, settings.ballsPerOver),
    batting: formatBatsmen(teams[teams.teamA.name === match.battingTeam ? 'teamA' : 'teamB'].batsmen),
    bowling: formatBowlers(teams[teams.teamA.name === match.bowlingTeam ? 'teamA' : 'teamB'].bowlers, settings.ballsPerOver),
    fallOfWickets: match.fallOfWickets,
    extras: match.extras,
  };

  const target = match.runs + 1;
  const newBattingTeam = match.bowlingTeam;
  const newBowlingTeam = match.battingTeam;
  const battingTeamKey = teams.teamA.name === newBattingTeam ? 'teamA' : 'teamB';
  const bowlingTeamKey = battingTeamKey === 'teamA' ? 'teamB' : 'teamA';

  const newStriker = teams[battingTeamKey].batsmen[0];
  const newNonStriker = teams[battingTeamKey].batsmen[1];
  const newBowler = teams[bowlingTeamKey].bowlers[0];

  setMatch(prev => ({
    ...prev,
    runs: 0,
    wickets: 0,
    balls: 0,
    innings: 2,
    target,
    isChasing: true,
    fallOfWickets: [],
    extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    battingTeam: newBattingTeam,
    bowlingTeam: newBowlingTeam,
    firstInningsSummary: firstInningsData,
  }));

  setPlayers({
    striker: { ...newStriker, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false },
    nonStriker: { ...newNonStriker, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false },
    bowler: {
      ...newBowler,
      currentSpell: { runs: 0, wickets: 0, balls: 0, maidens: 0 },
      previousSpells: [],
    },
    lastBowler: null,
  });

  setOverHistory([]);
  setAllOversHistory([]);
};

const endMatch = () => {
  const battingTeamKey = teams.teamA.name === match.battingTeam ? 'teamA' : 'teamB';
  const bowlingTeamKey = battingTeamKey === 'teamA' ? 'teamB' : 'teamA';

  const firstInnings = match.innings === 2 ? match.firstInningsSummary : {
    teamName: match.battingTeam,
    runs: match.runs,
    wickets: match.wickets,
    overs: formatOvers(match.balls, settings.ballsPerOver),
    batting: formatBatsmen(teams[battingTeamKey].batsmen),
    bowling: formatBowlers(teams[bowlingTeamKey].bowlers, settings.ballsPerOver),
    fallOfWickets: match.fallOfWickets,
    extras: match.extras,
  };

  const secondInnings = match.innings === 2 ? {
    teamName: match.battingTeam,
    runs: match.runs,
    wickets: match.wickets,
    overs: formatOvers(match.balls, settings.ballsPerOver),
    batting: formatBatsmen(teams[battingTeamKey].batsmen),
    bowling: formatBowlers(teams[bowlingTeamKey].bowlers, settings.ballsPerOver),
    fallOfWickets: match.fallOfWickets,
    extras: match.extras,
  } : null;

  let result = '';
  if (match.innings === 2) {
    if (match.runs > match.target - 1) {
      result = `${match.battingTeam} won by ${10 - match.wickets} wicket${10 - match.wickets > 1 ? 's' : ''}`;
    } else if (match.runs < match.target - 1) {
      const runDiff = match.target - match.runs - 1;
      result = `${match.bowlingTeam} won by ${runDiff} run${runDiff > 1 ? 's' : ''}`;
    } else {
      result = 'Match Tied';
    }
  } else {
    result = 'Match Ended (1st innings only)';
  }

  const netRR = calculateNetRunRates(firstInnings, secondInnings || {}, settings);
  const playerOfMatch = determinePlayerOfMatch(firstInnings, secondInnings || {});

  const finalMatch = {
    _id: match._id,
    settings,
    isComplete: true,
    result,
    firstInnings,
    secondInnings,
    netRunRates: netRR,
    playerOfMatch,
    oversHistory: allOversHistory,
    teams,
    match: {
      ...match,
      isComplete: true,
      result,
    },
  };

  setMatch(prev => ({ ...prev, isComplete: true, result }));
  localStorage.removeItem(`oversHistory_${matchId}`);

  if (typeof onMatchEnd === 'function') {
    onMatchEnd(finalMatch);
  } else {
    navigate('/full-scorecard', { state: finalMatch });
  }
};

// ScoreCard.jsx (PART 7 - JSX UI Return)

return (
  <div className="scorecard-page">

    {/* Top Navigation Bar */}
    <div className="top-bar">
      <button onClick={onExitMatch}><FiArrowLeft /> Exit</button>
      <h2>{match.battingTeam} vs {match.bowlingTeam}</h2>
      <button onClick={() => setShowSettingsPanel(!showSettingsPanel)}><FiSettings /></button>
    </div>

    {/* Match Summary Panel */}
    <div className="match-summary">
      <div className="score">
        <h3>{match.battingTeam}</h3>
        <p>{runs}/{wickets} ({overs} ov)</p>
        <p>CRR: {crr}</p>
        {match.innings === 2 && (
          <>
            <p>Target: {match.target}</p>
            <p>Req RR: {requiredRunRate}</p>
          </>
        )}
      </div>

      {/* Batsmen Info */}
      <div className="batsmen-info">
        <div className="batsman striker">
          <strong>* {players.striker.name}</strong>
          <p>{players.striker.runs} ({players.striker.balls})</p>
        </div>
        <div className="batsman non-striker">
          <span>{players.nonStriker.name}</span>
          <p>{players.nonStriker.runs} ({players.nonStriker.balls})</p>
        </div>
      </div>

      {/* Bowler Info */}
      <div className="bowler-info">
        <p>Bowler: {players.bowler.name}</p>
        <p>{players.bowler.currentSpell.runs}-{players.bowler.currentSpell.wickets} ({formatOvers(players.bowler.currentSpell.balls, settings.ballsPerOver)})</p>
      </div>
    </div>

    {/* Over History */}
    <div className="over-history">
      {overHistory.map((ball, index) => (
        <span key={index} className="ball">{ball}</span>
      ))}
    </div>

    {/* Input Action Buttons */}
    <div className="input-section">
      {/* Top Controls */}
      <div className="control-buttons">
        <button onClick={endMatch}>End Innings</button>
        <button onClick={() => setSelectedAction('Retire')}>Retire</button>
        <button onClick={() => setSelectedAction('ChangeStriker')}>Change Striker</button>
        <button onClick={() => setShowPrevOversModal(true)}>View Over History</button>
      </div>

      {/* Scoring Buttons */}
      <div className="score-buttons">
        {[0, 1, 2, 3, 4, 5, 6].map(run => (
          <button key={run} onClick={() => handleRuns(run)}>{run}</button>
        ))}
        <button onClick={() => setSelectedAction('ManualRuns')}>7+</button>
        <button onClick={() => setSelectedAction('OUT')}>OUT</button>
        <button onClick={() => setSelectedAction('WD')}>WD</button>
        <button onClick={() => setSelectedAction('NB')}>NB</button>
        <button onClick={() => setSelectedAction('BYE')}>BYE</button>
        <button onClick={handleUndo}>UNDO</button>
      </div>

      {/* OK Button for confirmation */}
      <div className="confirm-button">
        <button onClick={() => setShowModal(selectedAction)} disabled={!selectedAction}>OK</button>
      </div>
    </div>

    {/* Settings Panel */}
    {showSettingsPanel && (
      <div className="settings-panel">
        <p>Overs: {settings.overs}</p>
        <p>Players per team: {settings.playersPerTeam}</p>
        {/* Add more editable settings if needed */}
      </div>
    )}

    {/* Modals for specific actions */}
    <AnimatePresence>
      {showModal === 'WD' && <WideModal onConfirm={handleExtras} onClose={() => setShowModal(null)} />}
      {showModal === 'NB' && <NoBallModal onConfirm={handleExtras} onClose={() => setShowModal(null)} />}
      {showModal === 'BYE' && <ByeModal onConfirm={handleExtras} onClose={() => setShowModal(null)} />}
      {showModal === 'OUT' && <OutModal onConfirm={handleWicket} onClose={() => setShowModal(null)} />}
      {showModal === 'ManualRuns' && <ManualRunModal onConfirm={handleRuns} onClose={() => setShowModal(null)} />}
      {showPrevOversModal && <OverHistoryModal data={allOversHistory} onClose={() => setShowPrevOversModal(false)} />}
    </AnimatePresence>

  </div>
);
};
