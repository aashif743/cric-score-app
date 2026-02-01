import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Animated,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../context/AuthContext';
import matchService from '../utils/matchService';
import suggestionService from '../utils/suggestionService';
import AutocompleteInput from '../components/AutocompleteInput';
import { colors, spacing, borderRadius, fontSizes, fontWeights, shadows } from '../utils/theme';
import io from 'socket.io-client';
import { SOCKET_URL } from '../api/config';

const { width, height } = Dimensions.get('window');

// Calculate button section height (fixed)
const buttonSectionHeight = Platform.OS === 'ios' ? 220 : 200;
const headerHeight = 50;

// Available height for scrollable content
const availableContentHeight = height - buttonSectionHeight - headerHeight;

// Scale factor based on screen height - moderate scaling
// Baseline: 750px (standard phone). Scale up for larger, down for smaller
const scaleFactor = Math.min(Math.max(height / 750, 0.9), 1.15);

// Responsive sizing based on screen height
const isSmallScreen = height < 700;
const isMediumScreen = height >= 700 && height < 850;
const isLargeScreen = height >= 850;

// Dynamic spacing that scales with screen
const dynamicSpacing = (base) => Math.round(base * scaleFactor);

const responsiveSpacing = {
  xs: dynamicSpacing(4),
  sm: dynamicSpacing(6),
  md: dynamicSpacing(10),
  lg: dynamicSpacing(16),
  xl: dynamicSpacing(24),
};

// Dynamic font sizes that scale with screen
const responsiveFontSize = {
  xs: Math.round(10 * scaleFactor),
  sm: Math.round(12 * scaleFactor),
  md: Math.round(14 * scaleFactor),
  lg: Math.round(16 * scaleFactor),
  xl: Math.round(18 * scaleFactor),
  xxl: Math.round(22 * scaleFactor),
  score: Math.round(36 * scaleFactor),
};

// Dynamic element sizes
const responsiveSize = {
  batsmanCard: Math.round(70 * scaleFactor),
  ballSize: Math.round(26 * scaleFactor),
  avatarSize: Math.round(36 * scaleFactor),
};

const ScoreCardScreen = ({ navigation, route }) => {
  const { user } = useContext(AuthContext);
  const { matchData, matchSettings } = route.params || {};

  // Match state
  const [match, setMatch] = useState({
    runs: 0,
    wickets: 0,
    balls: 0,
    innings: 1,
    target: 0,
    isChasing: false,
  });

  // Settings - use matchSettings first, then fallback to matchData, then defaults
  const [settings, setSettings] = useState({
    overs: matchSettings?.totalOvers || matchData?.totalOvers || 6,
    ballsPerOver: matchSettings?.ballsPerOver || matchData?.ballsPerOver || 6,
    playersPerTeam: matchSettings?.playersPerTeam || matchData?.playersPerTeam || 6,
    noBallRuns: 1,
    wideRuns: 1,
  });

  // Debug: Log settings on mount
  console.log('ScoreCard Settings:', {
    fromMatchSettings: matchSettings,
    fromMatchData: { totalOvers: matchData?.totalOvers, ballsPerOver: matchData?.ballsPerOver, playersPerTeam: matchData?.playersPerTeam },
    finalSettings: { overs: matchSettings?.totalOvers || matchData?.totalOvers || 6 }
  });

  // Generate default player names
  const generateBatsmanNames = (count) => {
    return Array.from({ length: count }, (_, i) => `Batsman ${i + 1}`);
  };

  const generateBowlerNames = (count) => {
    return Array.from({ length: count }, (_, i) => `Bowler ${i + 1}`);
  };

  // Teams - Team A bats first by default, Team B bowls first
  const [teams, setTeams] = useState({
    teamA: {
      name: matchData?.teamA?.name || 'Team A',
      playerNames: generateBatsmanNames(matchSettings?.playersPerTeam || 6),
      batsmen: [],
      bowlers: [],
      runs: 0,
      wickets: 0,
      overs: '0.0',
    },
    teamB: {
      name: matchData?.teamB?.name || 'Team B',
      playerNames: generateBowlerNames(matchSettings?.playersPerTeam || 6),
      batsmen: [],
      bowlers: [],
      runs: 0,
      wickets: 0,
      overs: '0.0',
    },
  });

  // Current players - combined into single state to avoid stale closure issues
  const [currentBatsmen, setCurrentBatsmen] = useState({
    striker: { id: 1, name: 'Batsman 1', runs: 0, balls: 0, fours: 0, sixes: 0 },
    nonStriker: { id: 2, name: 'Batsman 2', runs: 0, balls: 0, fours: 0, sixes: 0 },
  });
  const striker = currentBatsmen.striker;
  const nonStriker = currentBatsmen.nonStriker;
  const [currentBowler, setCurrentBowler] = useState({ id: 1, name: 'Bowler 1', overs: '0.0', runs: 0, wickets: 0, maidens: 0 });

  // Over tracking
  const [currentOverBalls, setCurrentOverBalls] = useState([]);
  const [overHistory, setOverHistory] = useState([]);
  const [currentOverRuns, setCurrentOverRuns] = useState(0);
  const [currentOverWickets, setCurrentOverWickets] = useState(0);

  // Extras
  const [extras, setExtras] = useState({ wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 });

  // Fall of wickets
  const [fallOfWickets, setFallOfWickets] = useState([]);

  // All batsmen and bowlers
  const [allBatsmen, setAllBatsmen] = useState([]);
  const [allBowlers, setAllBowlers] = useState([]);

  // Track previous bowler (to prevent consecutive overs)
  const [previousBowlerId, setPreviousBowlerId] = useState(null);

  // Store first innings data for full scorecard
  const [firstInningsData, setFirstInningsData] = useState(null);

  // Track which innings to display in scorecard view (1 or 2)
  const [scorecardInningsView, setScorecardInningsView] = useState(1);

  // Modals
  const [showRunsModal, setShowRunsModal] = useState(false);
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [showExtrasModal, setShowExtrasModal] = useState(false);
  const [showChangeBowlerModal, setShowChangeBowlerModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showEndInningsModal, setShowEndInningsModal] = useState(false);
  const [endInningsPromptDismissed, setEndInningsPromptDismissed] = useState(false); // Track if user dismissed end innings prompt
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showMatchEndModal, setShowMatchEndModal] = useState(false); // For 2nd innings end confirmation
  const [pendingMatchEnd, setPendingMatchEnd] = useState(null); // Store match end data temporarily
  const [showWideModal, setShowWideModal] = useState(false);
  const [showNoBallModal, setShowNoBallModal] = useState(false);
  const [showByeModal, setShowByeModal] = useState(false);
  const [showMoreRunsModal, setShowMoreRunsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Selected values in modals
  const [selectedRuns, setSelectedRuns] = useState(0);
  const [selectedWicketType, setSelectedWicketType] = useState('');
  const [selectedExtraType, setSelectedExtraType] = useState('');
  const [runOutBatsman, setRunOutBatsman] = useState(null);
  const [newBatsmanName, setNewBatsmanName] = useState('');

  // Wide/No Ball modal state
  const [wideNoBallRuns, setWideNoBallRuns] = useState(null);
  const [wideNoBallRunOut, setWideNoBallRunOut] = useState(false);
  const [wideNoBallRunOutBatsman, setWideNoBallRunOutBatsman] = useState(null);

  // Bye modal state
  const [byeRuns, setByeRuns] = useState(null);
  const [byeRunOut, setByeRunOut] = useState(false);
  const [byeRunOutBatsman, setByeRunOutBatsman] = useState(null);

  // More runs modal state
  const [moreRuns, setMoreRuns] = useState(null);

  // Retire modal state
  const [showRetireModal, setShowRetireModal] = useState(false);
  const [retireType, setRetireType] = useState(null); // 'retired' or 'retiredOut'
  const [retireBatsman, setRetireBatsman] = useState(null); // 'striker' or 'nonStriker'

  // Striker swap animation
  const swapIconOpacity = useRef(new Animated.Value(0)).current;
  const swapIconScale = useRef(new Animated.Value(0.5)).current;
  const [isSwapping, setIsSwapping] = useState(false);

  // Undo history - stores snapshots of state before each action
  const [undoHistory, setUndoHistory] = useState([]);
  const MAX_UNDO_HISTORY = 50; // Limit history to prevent memory issues

  // Socket.io
  const [socket, setSocket] = useState(null);

  // View mode toggle - 'live' for live scoring, 'scorecard' for full scorecard view
  const [viewMode, setViewMode] = useState('live');
  const toggleAnim = useRef(new Animated.Value(0)).current;
  const liveScaleAnim = useRef(new Animated.Value(1)).current;
  const scorecardScaleAnim = useRef(new Animated.Value(0.95)).current;
  const liveDotPulse = useRef(new Animated.Value(1)).current;

  // Toggle button width for sliding animation
  const TOGGLE_BUTTON_WIDTH = 72;

  // Animated slide position
  const slidePosition = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, TOGGLE_BUTTON_WIDTH + 2],
  });

  // Animated text colors
  const liveTextColor = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', '#64748b'],
  });

  const scorecardTextColor = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#64748b', '#FFFFFF'],
  });

  // Handle toggle with animations
  const handleToggle = (mode) => {
    if (mode === viewMode) return;

    setViewMode(mode);

    // Spring animation for sliding indicator
    Animated.spring(toggleAnim, {
      toValue: mode === 'live' ? 0 : 1,
      friction: 8,
      tension: 50,
      useNativeDriver: false,
    }).start();

    // Scale animations for button press effect
    if (mode === 'live') {
      Animated.parallel([
        Animated.spring(liveScaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.spring(scorecardScaleAnim, {
          toValue: 0.95,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(liveScaleAnim, {
          toValue: 0.95,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.spring(scorecardScaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  // Pulse animation for live dot
  useEffect(() => {
    if (viewMode === 'live') {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(liveDotPulse, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(liveDotPulse, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, [viewMode, liveDotPulse]);

  // Get batting team key (teamA or teamB)
  const getBattingTeamKey = () => {
    if (match.innings === 1) {
      return matchData?.toss?.decision === 'bat'
        ? (matchData?.toss?.winner === matchData?.teamA?.name ? 'teamA' : 'teamB')
        : (matchData?.toss?.winner === matchData?.teamA?.name ? 'teamB' : 'teamA');
    }
    return matchData?.toss?.decision === 'bat'
      ? (matchData?.toss?.winner === matchData?.teamA?.name ? 'teamB' : 'teamA')
      : (matchData?.toss?.winner === matchData?.teamA?.name ? 'teamA' : 'teamB');
  };

  // Get bowling team key (teamA or teamB)
  const getBowlingTeamKey = () => {
    if (match.innings === 1) {
      return matchData?.toss?.decision === 'bat'
        ? (matchData?.toss?.winner === matchData?.teamA?.name ? 'teamB' : 'teamA')
        : (matchData?.toss?.winner === matchData?.teamA?.name ? 'teamA' : 'teamB');
    }
    return matchData?.toss?.decision === 'bat'
      ? (matchData?.toss?.winner === matchData?.teamA?.name ? 'teamA' : 'teamB')
      : (matchData?.toss?.winner === matchData?.teamA?.name ? 'teamB' : 'teamA');
  };

  // Initialize batsmen and bowlers (or restore saved state)
  useEffect(() => {
    const initializePlayers = () => {
      // Check if there's saved state to restore
      const savedState = matchData?.currentState;
      const currentInningsNum = matchData?.innings || 1;
      const savedInnings = currentInningsNum === 2 ? matchData?.innings2 : matchData?.innings1;

      // Debug logging
      console.log('Match restore check:', {
        hasCurrentState: !!savedState,
        hasSavedInnings: !!savedInnings,
        status: matchData?.status,
        innings: currentInningsNum,
        hasBatting: savedInnings?.batting?.length > 0,
        hasBowling: savedInnings?.bowling?.length > 0,
      });

      // Restore if we have currentState and innings data with actual player data
      if (savedState && savedInnings && savedInnings.batting?.length > 0) {
        // Restore saved match state
        setMatch({
          runs: savedState.runs || 0,
          wickets: savedState.wickets || 0,
          balls: savedState.balls || 0,
          innings: matchData.innings || 1,
          target: matchData.target || 0,
          isChasing: matchData.innings === 2,
        });

        // Restore batsmen
        if (savedInnings.batting && savedInnings.batting.length > 0) {
          setAllBatsmen(savedInnings.batting);
          if (savedState.striker && savedState.nonStriker) {
            setCurrentBatsmen({
              striker: savedState.striker,
              nonStriker: savedState.nonStriker,
            });
          } else {
            // Find current batsmen from saved batting array
            const activeBatsmen = savedInnings.batting.filter(b => !b.isOut && !b.isRetired);
            if (activeBatsmen.length >= 2) {
              setCurrentBatsmen({
                striker: activeBatsmen[0],
                nonStriker: activeBatsmen[1],
              });
            }
          }
        }

        // Restore bowlers
        if (savedInnings.bowling && savedInnings.bowling.length > 0) {
          setAllBowlers(savedInnings.bowling);
          if (savedState.currentBowler) {
            setCurrentBowler(savedState.currentBowler);
          } else {
            setCurrentBowler(savedInnings.bowling[0]);
          }
        }

        // Restore extras
        if (savedInnings.extras) {
          setExtras(savedInnings.extras);
        }

        // Restore fall of wickets
        if (savedInnings.fallOfWickets) {
          setFallOfWickets(savedInnings.fallOfWickets);
        }

        // Restore current over balls
        if (savedState.currentOverBalls) {
          setCurrentOverBalls(savedState.currentOverBalls);
        }

        // Restore over history
        if (savedInnings.overHistory && savedInnings.overHistory.length > 0) {
          setOverHistory(savedInnings.overHistory);
        }

        // Restore first innings data if in second innings
        if (matchData.innings === 2 && matchData.innings1) {
          setFirstInningsData(matchData.innings1);
          setScorecardInningsView(2); // Show current innings by default
        }

        return; // Skip fresh initialization
      }

      // Fresh initialization (no saved state)
      const battingTeamKey = matchData?.toss?.decision === 'bat'
        ? (matchData?.toss?.winner === matchData?.teamA?.name ? 'teamA' : 'teamB')
        : (matchData?.toss?.winner === matchData?.teamA?.name ? 'teamB' : 'teamA');
      const bowlingTeamKey = battingTeamKey === 'teamA' ? 'teamB' : 'teamA';

      // Get player names from teams state (or generate defaults)
      const battingPlayerNames = teams[battingTeamKey]?.playerNames ||
        generateBatsmanNames(settings.playersPerTeam);
      const bowlingPlayerNames = teams[bowlingTeamKey]?.playerNames ||
        generateBowlerNames(settings.playersPerTeam);

      // Initialize batsmen array - order 1 to last
      const batsmenArray = [];
      for (let i = 0; i < settings.playersPerTeam; i++) {
        batsmenArray.push({
          id: i + 1,
          name: battingPlayerNames[i] || `Batsman ${i + 1}`,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          isOut: false,
          isRetired: false,
          outType: '',
          strikeRate: 0,
        });
      }
      setAllBatsmen(batsmenArray);
      setCurrentBatsmen({
        striker: batsmenArray[0],
        nonStriker: batsmenArray[1],
      });

      // Initialize bowlers array - Bowler 1 first
      const bowlersArray = [];
      for (let i = 0; i < settings.playersPerTeam; i++) {
        bowlersArray.push({
          id: i + 1,
          name: bowlingPlayerNames[i] || `Bowler ${i + 1}`,
          overs: '0.0',
          runs: 0,
          wickets: 0,
          maidens: 0,
          economyRate: '0.00',
        });
      }
      setAllBowlers(bowlersArray);
      setCurrentBowler(bowlersArray[0]);
    };

    initializePlayers();
  }, [matchData, settings.playersPerTeam]);

  // Get current batting and bowling team names
  const getBattingTeam = () => {
    if (match.innings === 1) {
      return matchData?.toss?.decision === 'bat'
        ? (matchData?.toss?.winner === matchData?.teamA?.name ? teams.teamA.name : teams.teamB.name)
        : (matchData?.toss?.winner === matchData?.teamA?.name ? teams.teamB.name : teams.teamA.name);
    }
    return matchData?.toss?.decision === 'bat'
      ? (matchData?.toss?.winner === matchData?.teamA?.name ? teams.teamB.name : teams.teamA.name)
      : (matchData?.toss?.winner === matchData?.teamA?.name ? teams.teamA.name : teams.teamB.name);
  };

  const getBowlingTeam = () => {
    if (match.innings === 1) {
      return matchData?.toss?.decision === 'bat'
        ? (matchData?.toss?.winner === matchData?.teamA?.name ? teams.teamB.name : teams.teamA.name)
        : (matchData?.toss?.winner === matchData?.teamA?.name ? teams.teamA.name : teams.teamB.name);
    }
    return matchData?.toss?.decision === 'bat'
      ? (matchData?.toss?.winner === matchData?.teamA?.name ? teams.teamA.name : teams.teamB.name)
      : (matchData?.toss?.winner === matchData?.teamA?.name ? teams.teamB.name : teams.teamA.name);
  };

  // Calculate current over
  const getCurrentOver = () => {
    const completedOvers = Math.floor(match.balls / settings.ballsPerOver);
    const ballsInCurrentOver = match.balls % settings.ballsPerOver;
    return `${completedOvers}.${ballsInCurrentOver}`;
  };

  // Calculate run rate
  const getRunRate = () => {
    const overs = match.balls / settings.ballsPerOver;
    return overs > 0 ? (match.runs / overs).toFixed(2) : '0.00';
  };

  // Calculate required run rate
  const getRequiredRunRate = () => {
    if (!match.isChasing) return null;
    const runsNeeded = match.target - match.runs;
    const ballsLeft = (settings.overs * settings.ballsPerOver) - match.balls;
    const oversLeft = ballsLeft / settings.ballsPerOver;
    return oversLeft > 0 ? (runsNeeded / oversLeft).toFixed(2) : '0.00';
  };

  // Handle run scoring
  const handleRuns = (runs, isExtra = false, extraType = '') => {
    try {
    // Save state before action for undo
    saveToHistory(`${isExtra ? extraType.toUpperCase() + ' ' : ''}${runs} run${runs !== 1 ? 's' : ''}`);

    let ballCounted = !isExtra || (extraType !== 'wide' && extraType !== 'noball');
    let totalRuns = runs;
    let ballDisplay = runs.toString();

    if (isExtra) {
      if (extraType === 'wide') {
        totalRuns = runs + 1;
        ballDisplay = runs > 0 ? `WD+${runs}` : 'WD';
        setExtras(prev => ({ ...prev, wides: prev.wides + totalRuns, total: prev.total + totalRuns }));
        ballCounted = false;
      } else if (extraType === 'noball') {
        totalRuns = runs + settings.noBallRuns;
        ballDisplay = runs > 0 ? `NB+${runs}` : 'NB';
        setExtras(prev => ({ ...prev, noBalls: prev.noBalls + settings.noBallRuns, total: prev.total + settings.noBallRuns }));
        if (runs > 0) {
          const shouldRotate = runs % 2 === 1;
          updateBatsmanRuns(runs, false, shouldRotate);
        }
        ballCounted = false;
      } else if (extraType === 'bye') {
        ballDisplay = runs > 0 ? `BYE${runs}` : 'BYE';
        setExtras(prev => ({ ...prev, byes: prev.byes + runs, total: prev.total + runs }));
      } else if (extraType === 'legbye') {
        ballDisplay = runs > 0 ? `LB${runs}` : 'LB';
        setExtras(prev => ({ ...prev, legByes: prev.legByes + runs, total: prev.total + runs }));
      }
    } else {
      // For regular runs, pass shouldRotate for odd runs
      const shouldRotate = runs % 2 === 1;
      updateBatsmanRuns(runs, true, shouldRotate);
      if (runs === 4) ballDisplay = '4';
      if (runs === 6) ballDisplay = '6';
    }

    // Update match state
    setMatch(prev => ({
      ...prev,
      runs: prev.runs + totalRuns,
      balls: ballCounted ? prev.balls + 1 : prev.balls,
    }));

    // Update current over
    setCurrentOverBalls(prev => [...prev, ballDisplay]);
    setCurrentOverRuns(prev => prev + totalRuns);

    // Update bowler stats
    if (ballCounted) {
      updateBowlerStats(totalRuns, false);
    } else if (isExtra && (extraType === 'wide' || extraType === 'noball')) {
      // Wide/NoBall - add runs but no ball counted
      setCurrentBowler(prev => ({ ...prev, runs: prev.runs + totalRuns }));
      setAllBowlers(prev => prev.map(b =>
        b.id === currentBowler.id ? { ...b, runs: b.runs + totalRuns } : b
      ));
    }

    // Check for end of over
    if (ballCounted && (match.balls + 1) % settings.ballsPerOver === 0) {
      handleEndOfOver({ display: ballDisplay, runs: totalRuns, isWicket: false });
    }

    // Compute pending bowler update for accurate snapshot
    let pendingBowlerUpdate = null;
    if (ballCounted) {
      const [overs, balls] = currentBowler.overs.split('.').map(Number);
      const newBalls = balls + 1;
      const newOvers = newBalls === settings.ballsPerOver ? overs + 1 : overs;
      const finalBalls = newBalls === settings.ballsPerOver ? 0 : newBalls;
      pendingBowlerUpdate = {
        ...currentBowler,
        overs: `${newOvers}.${finalBalls}`,
        runs: currentBowler.runs + totalRuns,
      };
    } else if (isExtra && (extraType === 'wide' || extraType === 'noball')) {
      pendingBowlerUpdate = {
        ...currentBowler,
        runs: currentBowler.runs + totalRuns,
      };
    }

    // Check for match end conditions with pending updates
    checkMatchEndConditions(
      match.runs + totalRuns,
      match.wickets,
      ballCounted ? match.balls + 1 : match.balls,
      pendingBowlerUpdate
    );

    setShowRunsModal(false);
    setShowExtrasModal(false);
    } catch (error) {
      console.error('Error in handleRuns:', error);
    }
  };

  // Update batsman runs - uses functional update to avoid stale closures
  const updateBatsmanRuns = (runs, countBall, shouldRotate = false) => {
    // Use functional update to get latest state values
    setCurrentBatsmen(prev => {
      const updatedStriker = {
        ...prev.striker,
        runs: prev.striker.runs + runs,
        balls: countBall ? prev.striker.balls + 1 : prev.striker.balls,
        fours: runs === 4 ? prev.striker.fours + 1 : prev.striker.fours,
        sixes: runs === 6 ? prev.striker.sixes + 1 : prev.striker.sixes,
      };

      // If rotating (odd runs), swap the batsmen
      if (shouldRotate) {
        return {
          striker: prev.nonStriker,
          nonStriker: updatedStriker,
        };
      } else {
        return {
          ...prev,
          striker: updatedStriker,
        };
      }
    });

    // Update allBatsmen array - use striker.id from current render
    const currentStrikerId = striker.id;
    setAllBatsmen(prev => prev.map(b =>
      b.id === currentStrikerId
        ? {
            ...b,
            runs: b.runs + runs,
            balls: countBall ? b.balls + 1 : b.balls,
            fours: runs === 4 ? b.fours + 1 : b.fours,
            sixes: runs === 6 ? b.sixes + 1 : b.sixes,
          }
        : b
    ));
  };

  // Update bowler stats
  const updateBowlerStats = (runs, isWicket) => {
    const currentBowlerId = currentBowler.id;

    setCurrentBowler(prev => {
      const [overs, balls] = prev.overs.split('.').map(Number);
      const newBalls = balls + 1;
      const newOvers = newBalls === settings.ballsPerOver ? overs + 1 : overs;
      const finalBalls = newBalls === settings.ballsPerOver ? 0 : newBalls;

      const updatedBowler = {
        ...prev,
        overs: `${newOvers}.${finalBalls}`,
        runs: prev.runs + runs,
        wickets: isWicket ? prev.wickets + 1 : prev.wickets,
      };

      return updatedBowler;
    });

    // Also update allBowlers to keep stats in sync
    setAllBowlers(prev => prev.map(b => {
      if (b.id === currentBowlerId) {
        const [overs, balls] = b.overs.split('.').map(Number);
        const newBalls = balls + 1;
        const newOvers = newBalls === settings.ballsPerOver ? overs + 1 : overs;
        const finalBalls = newBalls === settings.ballsPerOver ? 0 : newBalls;

        return {
          ...b,
          overs: `${newOvers}.${finalBalls}`,
          runs: b.runs + runs,
          wickets: isWicket ? b.wickets + 1 : b.wickets,
        };
      }
      return b;
    }));
  };

  // Rotate strike - uses functional update to avoid stale closures
  const rotateStrike = (withAnimation = false) => {
    if (withAnimation && !isSwapping) {
      // Animated swap
      setIsSwapping(true);

      // Reset animations
      swapIconOpacity.setValue(0);
      swapIconScale.setValue(0.5);

      // Perform swap IMMEDIATELY (parallel with animation)
      setCurrentBatsmen(prev => ({
        striker: prev.nonStriker,
        nonStriker: prev.striker,
      }));

      // Show swap icon animation (visual feedback only)
      Animated.sequence([
        // Show swap icon with bounce
        Animated.parallel([
          Animated.timing(swapIconOpacity, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.spring(swapIconScale, {
            toValue: 1.2,
            friction: 6,
            tension: 120,
            useNativeDriver: true,
          }),
        ]),
        // Brief pause to show icon
        Animated.delay(300),
        // Hide swap icon
        Animated.parallel([
          Animated.timing(swapIconOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(swapIconScale, {
            toValue: 0.5,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setIsSwapping(false);
      });
    } else if (!withAnimation) {
      // Instant swap (for end of over, etc.)
      setCurrentBatsmen(prev => ({
        striker: prev.nonStriker,
        nonStriker: prev.striker,
      }));
    }
  };

  // Animated rotate strike (for button press)
  const handleChangeStriker = () => {
    // Save state before action for undo
    saveToHistory('Change Striker');
    rotateStrike(true);
  };

  // Handle end of over
  // lastBall: { display, runs, isWicket } - the ball that completed the over (not yet in state)
  const handleEndOfOver = (lastBall = null) => {
    try {
      // Include the last ball that triggered end-of-over (state updates are async)
      const allBalls = lastBall ? [...currentOverBalls, lastBall.display] : [...currentOverBalls];
      const allRuns = lastBall ? currentOverRuns + lastBall.runs : currentOverRuns;
      const allWickets = lastBall ? currentOverWickets + (lastBall.isWicket ? 1 : 0) : currentOverWickets;

      // Save over history
      const overData = {
        overNumber: Math.floor((match.balls + 1) / settings.ballsPerOver),
        bowlerName: currentBowler.name,
        balls: allBalls,
        runs: allRuns,
        wickets: allWickets,
      };
      setOverHistory(prev => [...prev, overData]);

      // Check for maiden
      const isMaiden = allRuns === 0 && allBalls.every(b => !b.includes('WD') && !b.includes('NB'));
      const currentBowlerId = currentBowler.id;

      if (isMaiden) {
        // Update maiden count using functional update to get latest state
        setCurrentBowler(prev => ({ ...prev, maidens: prev.maidens + 1 }));
        setAllBowlers(prev => prev.map(b =>
          b.id === currentBowlerId ? { ...b, maidens: b.maidens + 1 } : b
        ));
      }

      // Set previous bowler (cannot bowl next over)
      setPreviousBowlerId(currentBowlerId);

      // Reset over tracking
      setCurrentOverBalls([]);
      setCurrentOverRuns(0);
      setCurrentOverWickets(0);

      // Rotate strike at end of over
      rotateStrike();

      // Auto-select next bowler (user can manually change via bowler change button)
      const newBalls = match.balls + 1;
      const maxBalls = settings.overs * settings.ballsPerOver;
      const isOversComplete = newBalls >= maxBalls;
      const isAllOut = match.wickets >= settings.playersPerTeam - 1;

      if (!isOversComplete && !isAllOut) {
        // Find next eligible bowler (not the one who just bowled)
        const nextBowler = allBowlers.find(b => b.id !== currentBowlerId);
        if (nextBowler) {
          const bowlerWithStats = allBowlers.find(b => b.id === nextBowler.id) || nextBowler;
          setCurrentBowler({ ...bowlerWithStats });
        }
      }
    } catch (error) {
      console.error('Error in handleEndOfOver:', error);
    }
  };

  // Handle wicket
  const handleWicket = (wicketType) => {
    try {
    // Save state before action for undo
    saveToHistory(`Wicket - ${wicketType}`);

    const outBatsman = runOutBatsman === 'nonStriker' ? nonStriker : striker;

    // Update match state
    setMatch(prev => ({
      ...prev,
      runs: prev.runs + selectedRuns,
      wickets: prev.wickets + 1,
      balls: prev.balls + 1,
    }));

    // Update current over
    setCurrentOverBalls(prev => [...prev, 'W']);
    setCurrentOverWickets(prev => prev + 1);

    // Update bowler stats
    if (wicketType !== 'Run Out') {
      updateBowlerStats(selectedRuns, true);
    } else {
      updateBowlerStats(selectedRuns, false);
    }

    // Mark batsman as out
    setAllBatsmen(prev => prev.map(b =>
      b.id === outBatsman.id
        ? { ...b, isOut: true, outType: wicketType, balls: b.balls + (runOutBatsman !== 'nonStriker' ? 1 : 0) }
        : b
    ));

    // Record fall of wicket
    setFallOfWickets(prev => [...prev, {
      batsman_name: outBatsman.name,
      score: match.runs + selectedRuns,
      wicket: match.wickets + 1,
      over: getCurrentOver(),
    }]);

    // Get next batsman - first try non-retired batsmen
    let nextBatsman = allBatsmen.find(b => !b.isOut && !b.isRetired && b.id !== striker.id && b.id !== nonStriker.id);

    // If no non-retired batsmen available, bring back a retired batsman
    if (!nextBatsman) {
      nextBatsman = allBatsmen.find(b => b.isRetired && !b.isOut && b.id !== striker.id && b.id !== nonStriker.id);
      if (nextBatsman) {
        // Mark the returning batsman as no longer retired
        setAllBatsmen(prev => prev.map(b =>
          b.id === nextBatsman.id ? { ...b, isRetired: false } : b
        ));
      }
    }

    if (nextBatsman) {
      if (runOutBatsman === 'nonStriker') {
        setCurrentBatsmen(prev => ({ ...prev, nonStriker: nextBatsman }));
      } else {
        setCurrentBatsmen(prev => ({ ...prev, striker: nextBatsman }));
      }
    }

    // Note: All-out check is handled by checkMatchEndConditions below
    // which passes the correct snapshot with pending wicket count

    // Check for end of over (wicket counts as a ball)
    if ((match.balls + 1) % settings.ballsPerOver === 0) {
      handleEndOfOver({ display: 'W', runs: selectedRuns, isWicket: true });
    }

    // Compute pending bowler update
    const isWicket = wicketType !== 'Run Out';
    const [overs, balls] = currentBowler.overs.split('.').map(Number);
    const newBalls = balls + 1;
    const newOvers = newBalls === settings.ballsPerOver ? overs + 1 : overs;
    const finalBalls = newBalls === settings.ballsPerOver ? 0 : newBalls;
    const pendingBowlerUpdate = {
      ...currentBowler,
      overs: `${newOvers}.${finalBalls}`,
      runs: currentBowler.runs + selectedRuns,
      wickets: isWicket ? currentBowler.wickets + 1 : currentBowler.wickets,
    };

    // Compute pending batsman update
    const pendingBatsmanUpdate = {
      ...outBatsman,
      isOut: true,
      outType: wicketType,
      balls: outBatsman.balls + (runOutBatsman !== 'nonStriker' ? 1 : 0),
    };

    // Check match end conditions with pending updates
    checkMatchEndConditions(
      match.runs + selectedRuns,
      match.wickets + 1,
      match.balls + 1,
      pendingBowlerUpdate,
      pendingBatsmanUpdate
    );

    setShowWicketModal(false);
    setSelectedWicketType('');
    setSelectedRuns(0);
    setRunOutBatsman(null);
    } catch (error) {
      console.error('Error in handleWicket:', error);
    }
  };

  // Handle Wide Ball submission
  const handleWideSubmit = () => {
    if (wideNoBallRuns === null) {
      Alert.alert('Selection Required', 'Please select a wide option');
      return;
    }

    if (wideNoBallRunOut && !wideNoBallRunOutBatsman) {
      Alert.alert('Selection Required', 'Please select which batsman is out');
      return;
    }

    // Save state before action for undo
    saveToHistory(`Wide${wideNoBallRuns > 0 ? ` +${wideNoBallRuns}` : ''}${wideNoBallRunOut ? ' + Run Out' : ''}`);

    const extraRuns = wideNoBallRuns; // Additional runs (0, 1, 2, 3, 4)
    const totalRuns = settings.wideRuns + extraRuns; // wide runs from settings + extra runs
    // Build ball display: WD, WD+1, WD+W, WD+1+W
    let ballDisplay = settings.wideRuns > 1 ? `WD${settings.wideRuns}` : 'WD';
    if (extraRuns > 0) ballDisplay += `+${extraRuns}`;
    if (wideNoBallRunOut) ballDisplay += '+W';

    // Update extras
    setExtras(prev => ({ ...prev, wides: prev.wides + totalRuns, total: prev.total + totalRuns }));

    // Update match state (ball not counted)
    setMatch(prev => ({
      ...prev,
      runs: prev.runs + totalRuns,
    }));

    // Update current over display
    setCurrentOverBalls(prev => [...prev, ballDisplay]);
    setCurrentOverRuns(prev => prev + totalRuns);

    // Update bowler runs
    setCurrentBowler(prev => ({ ...prev, runs: prev.runs + totalRuns }));
    setAllBowlers(prev => prev.map(b =>
      b.id === currentBowler.id ? { ...b, runs: b.runs + totalRuns } : b
    ));

    // Handle run out if selected
    if (wideNoBallRunOut && wideNoBallRunOutBatsman) {
      handleWideNoBallRunOut(wideNoBallRunOutBatsman);
    }

    // Reset and close modal
    resetWideNoBallModal();
    setShowWideModal(false);

    // Compute pending bowler update (wide doesn't count as a ball)
    const pendingBowlerUpdate = {
      ...currentBowler,
      runs: currentBowler.runs + totalRuns,
    };

    // Check match end conditions with pending updates
    checkMatchEndConditions(
      match.runs + totalRuns,
      match.wickets + (wideNoBallRunOut ? 1 : 0),
      match.balls,
      pendingBowlerUpdate
    );
  };

  // Handle No Ball submission
  const handleNoBallSubmit = () => {
    if (wideNoBallRuns === null) {
      Alert.alert('Selection Required', 'Please select a no ball option');
      return;
    }

    if (wideNoBallRunOut && !wideNoBallRunOutBatsman) {
      Alert.alert('Selection Required', 'Please select which batsman is out');
      return;
    }

    // Save state before action for undo
    saveToHistory(`No Ball${wideNoBallRuns > 0 ? ` +${wideNoBallRuns}` : ''}${wideNoBallRunOut ? ' + Run Out' : ''}`);

    const extraRuns = wideNoBallRuns; // Additional runs (0, 1, 2, 3, 4, 5, 6)
    const totalRuns = settings.noBallRuns + extraRuns; // noBallRuns from settings + extra runs
    // Build ball display: NB, NB+1, NB+W, NB+1+W
    let ballDisplay = settings.noBallRuns > 1 ? `NB${settings.noBallRuns}` : 'NB';
    if (extraRuns > 0) ballDisplay += `+${extraRuns}`;
    if (wideNoBallRunOut) ballDisplay += '+W';

    // Update extras (only the no ball run, not batsman runs)
    setExtras(prev => ({ ...prev, noBalls: prev.noBalls + settings.noBallRuns, total: prev.total + settings.noBallRuns }));

    // If batsman scored runs, update batsman stats with atomic rotation handling
    if (extraRuns > 0) {
      const shouldRotate = extraRuns % 2 === 1;
      const currentStrikerId = striker.id;

      // Use functional update to avoid stale closures
      setCurrentBatsmen(prev => {
        const updatedStriker = {
          ...prev.striker,
          runs: prev.striker.runs + extraRuns,
          fours: extraRuns === 4 ? prev.striker.fours + 1 : prev.striker.fours,
          sixes: extraRuns === 6 ? prev.striker.sixes + 1 : prev.striker.sixes,
        };

        if (shouldRotate) {
          return {
            striker: prev.nonStriker,
            nonStriker: updatedStriker,
          };
        } else {
          return {
            ...prev,
            striker: updatedStriker,
          };
        }
      });

      setAllBatsmen(prev => prev.map(b =>
        b.id === currentStrikerId
          ? {
              ...b,
              runs: b.runs + extraRuns,
              fours: extraRuns === 4 ? b.fours + 1 : b.fours,
              sixes: extraRuns === 6 ? b.sixes + 1 : b.sixes,
            }
          : b
      ));
    }

    // Update match state (ball not counted)
    setMatch(prev => ({
      ...prev,
      runs: prev.runs + totalRuns,
    }));

    // Update current over display
    setCurrentOverBalls(prev => [...prev, ballDisplay]);
    setCurrentOverRuns(prev => prev + totalRuns);

    // Update bowler runs
    setCurrentBowler(prev => ({ ...prev, runs: prev.runs + totalRuns }));
    setAllBowlers(prev => prev.map(b =>
      b.id === currentBowler.id ? { ...b, runs: b.runs + totalRuns } : b
    ));

    // Handle run out if selected
    if (wideNoBallRunOut && wideNoBallRunOutBatsman) {
      handleWideNoBallRunOut(wideNoBallRunOutBatsman);
    }

    // Reset and close modal
    resetWideNoBallModal();
    setShowNoBallModal(false);

    // Compute pending bowler update (no ball doesn't count as a ball)
    const pendingBowlerUpdate = {
      ...currentBowler,
      runs: currentBowler.runs + totalRuns,
    };

    // Check match end conditions with pending updates
    checkMatchEndConditions(
      match.runs + totalRuns,
      match.wickets + (wideNoBallRunOut ? 1 : 0),
      match.balls,
      pendingBowlerUpdate
    );
  };

  // Handle run out during wide/no ball
  const handleWideNoBallRunOut = (batsmanType) => {
    const outBatsman = batsmanType === 'nonStriker' ? nonStriker : striker;

    // Update match wickets
    setMatch(prev => ({
      ...prev,
      wickets: prev.wickets + 1,
    }));

    // Update current over wickets
    setCurrentOverWickets(prev => prev + 1);

    // Mark batsman as out
    setAllBatsmen(prev => prev.map(b =>
      b.id === outBatsman.id
        ? { ...b, isOut: true, outType: 'Run Out' }
        : b
    ));

    // Record fall of wicket
    setFallOfWickets(prev => [...prev, {
      batsman_name: outBatsman.name,
      score: match.runs,
      wicket: match.wickets + 1,
      over: getCurrentOver(),
    }]);

    // Get next batsman - first try non-retired batsmen
    let nextBatsman = allBatsmen.find(b => !b.isOut && !b.isRetired && b.id !== striker.id && b.id !== nonStriker.id);

    // If no non-retired batsmen available, bring back a retired batsman
    if (!nextBatsman) {
      nextBatsman = allBatsmen.find(b => b.isRetired && !b.isOut && b.id !== striker.id && b.id !== nonStriker.id);
      if (nextBatsman) {
        // Mark the returning batsman as no longer retired
        setAllBatsmen(prev => prev.map(b =>
          b.id === nextBatsman.id ? { ...b, isRetired: false } : b
        ));
      }
    }

    if (nextBatsman) {
      if (batsmanType === 'nonStriker') {
        setCurrentBatsmen(prev => ({ ...prev, nonStriker: nextBatsman }));
      } else {
        setCurrentBatsmen(prev => ({ ...prev, striker: nextBatsman }));
      }
    }

    // Check for innings end (all out - including checking retired batsmen)
    const retiredAvailable = allBatsmen.filter(b =>
      b.isRetired && !b.isOut && b.id !== striker.id && b.id !== nonStriker.id
    ).length;

    if (match.wickets + 1 >= settings.playersPerTeam - 1 && retiredAvailable === 0) {
      handleEndInnings();
    }
  };

  // Reset wide/no ball modal state
  const resetWideNoBallModal = () => {
    setWideNoBallRuns(null);
    setWideNoBallRunOut(false);
    setWideNoBallRunOutBatsman(null);
  };

  // Handle Bye (Leg Bye) submission
  const handleByeSubmit = () => {
    if (byeRuns === null) {
      Alert.alert('Selection Required', 'Please select leg bye runs');
      return;
    }

    if (byeRunOut && !byeRunOutBatsman) {
      Alert.alert('Selection Required', 'Please select which batsman is out');
      return;
    }

    // Save state before action for undo
    saveToHistory(`Leg Bye ${byeRuns}${byeRunOut ? ' + Run Out' : ''}`);

    const runs = byeRuns;
    // Build ball display: LB1, LB2, LB1+W, etc.
    let ballDisplay = `LB${runs}`;
    if (byeRunOut) ballDisplay += '+W';

    // Update extras (leg byes) - runs go to team but not batsman/bowler
    setExtras(prev => ({ ...prev, legByes: prev.legByes + runs, total: prev.total + runs }));

    // Update match state (ball IS counted)
    setMatch(prev => ({
      ...prev,
      runs: prev.runs + runs,
      balls: prev.balls + 1,
    }));

    // Update current over display
    setCurrentOverBalls(prev => [...prev, ballDisplay]);
    setCurrentOverRuns(prev => prev + runs);

    // Update bowler overs (ball counted, but runs NOT added to bowler)
    setCurrentBowler(prev => {
      const [overs, balls] = prev.overs.split('.').map(Number);
      const newBalls = balls + 1;
      const newOvers = newBalls === settings.ballsPerOver ? overs + 1 : overs;
      const finalBalls = newBalls === settings.ballsPerOver ? 0 : newBalls;
      return {
        ...prev,
        overs: `${newOvers}.${finalBalls}`,
        // runs NOT added for leg bye
      };
    });

    // Rotate strike for odd runs
    if (runs % 2 === 1) {
      rotateStrike();
    }

    // Handle run out if selected
    if (byeRunOut && byeRunOutBatsman) {
      handleByeRunOut(byeRunOutBatsman);
    }

    // Check for end of over
    if ((match.balls + 1) % settings.ballsPerOver === 0) {
      handleEndOfOver({ display: ballDisplay, runs: runs, isWicket: false });
    }

    // Reset and close modal
    resetByeModal();
    setShowByeModal(false);

    // Compute pending bowler update (bye/leg bye counts as a ball but no runs to bowler)
    const [overs, ballsInOver] = currentBowler.overs.split('.').map(Number);
    const newBalls = ballsInOver + 1;
    const newOvers = newBalls === settings.ballsPerOver ? overs + 1 : overs;
    const finalBalls = newBalls === settings.ballsPerOver ? 0 : newBalls;
    const pendingBowlerUpdate = {
      ...currentBowler,
      overs: `${newOvers}.${finalBalls}`,
    };

    // Check match end conditions with pending updates
    checkMatchEndConditions(
      match.runs + runs,
      match.wickets + (byeRunOut ? 1 : 0),
      match.balls + 1,
      pendingBowlerUpdate
    );
  };

  // Handle run out during bye
  const handleByeRunOut = (batsmanType) => {
    const outBatsman = batsmanType === 'nonStriker' ? nonStriker : striker;

    // Update match wickets
    setMatch(prev => ({
      ...prev,
      wickets: prev.wickets + 1,
    }));

    // Update current over (add W to display)
    setCurrentOverBalls(prev => {
      const updated = [...prev];
      updated[updated.length - 1] = updated[updated.length - 1] + '+W';
      return updated;
    });
    setCurrentOverWickets(prev => prev + 1);

    // Mark batsman as out
    setAllBatsmen(prev => prev.map(b =>
      b.id === outBatsman.id
        ? { ...b, isOut: true, outType: 'Run Out' }
        : b
    ));

    // Record fall of wicket
    setFallOfWickets(prev => [...prev, {
      batsman_name: outBatsman.name,
      score: match.runs + byeRuns,
      wicket: match.wickets + 1,
      over: getCurrentOver(),
    }]);

    // Get next batsman - first try non-retired batsmen
    let nextBatsman = allBatsmen.find(b => !b.isOut && !b.isRetired && b.id !== striker.id && b.id !== nonStriker.id);

    // If no non-retired batsmen available, bring back a retired batsman
    if (!nextBatsman) {
      nextBatsman = allBatsmen.find(b => b.isRetired && !b.isOut && b.id !== striker.id && b.id !== nonStriker.id);
      if (nextBatsman) {
        // Mark the returning batsman as no longer retired
        setAllBatsmen(prev => prev.map(b =>
          b.id === nextBatsman.id ? { ...b, isRetired: false } : b
        ));
      }
    }

    if (nextBatsman) {
      if (batsmanType === 'nonStriker') {
        setCurrentBatsmen(prev => ({ ...prev, nonStriker: nextBatsman }));
      } else {
        setCurrentBatsmen(prev => ({ ...prev, striker: nextBatsman }));
      }
    }

    // Check for innings end (all out - including checking retired batsmen)
    const retiredAvailable = allBatsmen.filter(b =>
      b.isRetired && !b.isOut && b.id !== striker.id && b.id !== nonStriker.id
    ).length;

    if (match.wickets + 1 >= settings.playersPerTeam - 1 && retiredAvailable === 0) {
      handleEndInnings();
    }
  };

  // Reset bye modal state
  const resetByeModal = () => {
    setByeRuns(null);
    setByeRunOut(false);
    setByeRunOutBatsman(null);
  };

  // Handle More Runs (5, 7, etc.) submission
  const handleMoreRunsSubmit = () => {
    if (moreRuns === null) {
      Alert.alert('Selection Required', 'Please select runs');
      return;
    }

    // Save state before action for undo
    saveToHistory(`${moreRuns} runs`);

    const runs = moreRuns;
    const shouldRotate = runs % 2 === 1;
    const currentStrikerId = striker.id;

    // Use functional update to avoid stale closures
    setCurrentBatsmen(prev => {
      const updatedStriker = {
        ...prev.striker,
        runs: prev.striker.runs + runs,
        balls: prev.striker.balls + 1,
      };

      if (shouldRotate) {
        return {
          striker: prev.nonStriker,
          nonStriker: updatedStriker,
        };
      } else {
        return {
          ...prev,
          striker: updatedStriker,
        };
      }
    });

    setAllBatsmen(prev => prev.map(b =>
      b.id === currentStrikerId
        ? {
            ...b,
            runs: b.runs + runs,
            balls: b.balls + 1,
          }
        : b
    ));

    // Update match state (ball IS counted)
    setMatch(prev => ({
      ...prev,
      runs: prev.runs + runs,
      balls: prev.balls + 1,
    }));

    // Update current over display
    setCurrentOverBalls(prev => [...prev, runs.toString()]);
    setCurrentOverRuns(prev => prev + runs);

    // Update bowler stats (runs and ball counted)
    updateBowlerStats(runs, false);

    // Check for end of over
    if ((match.balls + 1) % settings.ballsPerOver === 0) {
      handleEndOfOver({ display: runs.toString(), runs: runs, isWicket: false });
    }

    // Reset and close modal
    setMoreRuns(null);
    setShowMoreRunsModal(false);

    // Compute pending bowler update for accurate snapshot
    const [overs, balls] = currentBowler.overs.split('.').map(Number);
    const newBalls = balls + 1;
    const newOvers = newBalls === settings.ballsPerOver ? overs + 1 : overs;
    const finalBalls = newBalls === settings.ballsPerOver ? 0 : newBalls;
    const pendingBowlerUpdate = {
      ...currentBowler,
      overs: `${newOvers}.${finalBalls}`,
      runs: currentBowler.runs + runs,
    };

    // Check match end conditions with pending bowler update
    checkMatchEndConditions(match.runs + runs, match.wickets, match.balls + 1, pendingBowlerUpdate);
  };

  // Handle Retire submission
  const handleRetireSubmit = () => {
    if (!retireType) {
      Alert.alert('Selection Required', 'Please select retire type');
      return;
    }

    if (!retireBatsman) {
      Alert.alert('Selection Required', 'Please select which batsman is retiring');
      return;
    }

    // Save state before action for undo
    const retiringBatsmanForHistory = retireBatsman === 'striker' ? striker : nonStriker;
    saveToHistory(`${retireType === 'retiredOut' ? 'Retired Out' : 'Retired'} - ${retiringBatsmanForHistory.name}`);

    const retiringBatsman = retireBatsman === 'striker' ? striker : nonStriker;
    const isRetiredOut = retireType === 'retiredOut';

    // Find next available batsman
    // For retired out: only non-out, non-retired batsmen
    // For retired: only non-out, non-retired batsmen (retired batsmen can come back later when all out)
    const nextBatsman = allBatsmen.find(b =>
      !b.isOut && !b.isRetired && b.id !== striker.id && b.id !== nonStriker.id
    );

    if (!nextBatsman) {
      // Check if there are retired batsmen who can come back (only for non-retired out case)
      const retiredBatsman = allBatsmen.find(b =>
        b.isRetired && !b.isOut && b.id !== striker.id && b.id !== nonStriker.id
      );

      if (retiredBatsman) {
        // Bring back a retired batsman
        if (retireBatsman === 'striker') {
          setCurrentBatsmen(prev => ({ ...prev, striker: retiredBatsman }));
        } else {
          setCurrentBatsmen(prev => ({ ...prev, nonStriker: retiredBatsman }));
        }

        // Mark the retiring batsman
        setAllBatsmen(prev => prev.map(b => {
          if (b.id === retiringBatsman.id) {
            if (isRetiredOut) {
              return { ...b, isOut: true, outType: 'Retired Out' };
            } else {
              return { ...b, isRetired: true, outType: 'Retired' };
            }
          }
          // Mark the returning batsman as no longer retired
          if (b.id === retiredBatsman.id) {
            return { ...b, isRetired: false };
          }
          return b;
        }));
      } else {
        Alert.alert('Cannot Retire', 'No batsmen available to replace');
        resetRetireModal();
        return;
      }
    } else {
      // Normal case: bring in next batsman
      if (retireBatsman === 'striker') {
        setCurrentBatsmen(prev => ({ ...prev, striker: nextBatsman }));
      } else {
        setCurrentBatsmen(prev => ({ ...prev, nonStriker: nextBatsman }));
      }

      // Mark the retiring batsman
      setAllBatsmen(prev => prev.map(b => {
        if (b.id === retiringBatsman.id) {
          if (isRetiredOut) {
            return { ...b, isOut: true, outType: 'Retired Out' };
          } else {
            return { ...b, isRetired: true, outType: 'Retired' };
          }
        }
        return b;
      }));
    }

    // Update wickets if retired out
    if (isRetiredOut) {
      setMatch(prev => ({
        ...prev,
        wickets: prev.wickets + 1,
      }));

      // Record fall of wicket
      setFallOfWickets(prev => [...prev, {
        batsman_name: retiringBatsman.name,
        score: match.runs,
        wicket: match.wickets + 1,
        over: getCurrentOver(),
      }]);

      // Check for innings end (all out)
      if (match.wickets + 1 >= settings.playersPerTeam - 1) {
        handleEndInnings();
      }
    }

    // Reset and close modal
    resetRetireModal();
    setShowRetireModal(false);
  };

  // Reset retire modal state
  const resetRetireModal = () => {
    setRetireType(null);
    setRetireBatsman(null);
  };

  // Check match end conditions
  const checkMatchEndConditions = (runs, wickets, balls, pendingBowlerUpdate = null, pendingBatsmanUpdate = null) => {
    try {
    const maxBalls = settings.overs * settings.ballsPerOver;

    // Debug logging
    console.log('checkMatchEndConditions:', {
      runs, wickets, balls, maxBalls,
      settingsOvers: settings.overs,
      ballsPerOver: settings.ballsPerOver,
      playersPerTeam: settings.playersPerTeam,
      oversCompleted: Math.floor(balls / settings.ballsPerOver),
      ballsInOver: balls % settings.ballsPerOver,
      wicketsLimit: settings.playersPerTeam - 1,
      ballsCondition: balls >= maxBalls,
      wicketsCondition: wickets >= settings.playersPerTeam - 1,
      matchDataTotalOvers: matchData?.totalOvers,
      matchSettingsTotalOvers: matchSettings?.totalOvers,
    });

    // Build current data snapshot with pending updates
    const buildMatchSnapshot = () => {
      // Calculate overs from balls
      const completedOvers = Math.floor(balls / settings.ballsPerOver);
      const ballsInCurrentOver = balls % settings.ballsPerOver;
      const oversString = `${completedOvers}.${ballsInCurrentOver}`;

      // Apply pending bowler update to allBowlers
      let updatedBowlers = allBowlers.map(b => ({ ...b }));
      if (pendingBowlerUpdate) {
        updatedBowlers = updatedBowlers.map(b =>
          b.id === pendingBowlerUpdate.id ? { ...pendingBowlerUpdate } : b
        );
      }

      // Apply pending batsman update to allBatsmen
      let updatedBatsmen = allBatsmen.map(b => ({ ...b }));
      if (pendingBatsmanUpdate) {
        updatedBatsmen = updatedBatsmen.map(b =>
          b.id === pendingBatsmanUpdate.id ? { ...pendingBatsmanUpdate } : b
        );
      }

      return {
        runs,
        wickets,
        balls,
        overs: oversString,
        batting: updatedBatsmen,
        bowling: updatedBowlers,
        extras: { ...extras },
        fallOfWickets: fallOfWickets.map(f => ({ ...f })),
        overHistory: overHistory.map(o => ({ ...o, balls: [...o.balls] })),
      };
    };

    // First innings
    if (match.innings === 1) {
      if (balls >= maxBalls || wickets >= settings.playersPerTeam - 1) {
        handleEndInnings(buildMatchSnapshot());
      }
    } else {
      // Second innings - chasing
      // Target is runs needed to win (first innings score + 1)
      // Team wins when they reach or exceed the target
      if (runs >= match.target) {
        // Team chasing wins
        handleMatchEnd(`${getBattingTeam()} won by ${settings.playersPerTeam - 1 - wickets} wickets`, buildMatchSnapshot());
      } else if (balls >= maxBalls || wickets >= settings.playersPerTeam - 1) {
        // Innings over but target not reached
        if (runs === match.target - 1) {
          // Scores are level - it's a tie
          handleMatchEnd('Match Tied', buildMatchSnapshot());
        } else {
          // Team batting first wins
          handleMatchEnd(`${getBowlingTeam()} won by ${match.target - 1 - runs} runs`, buildMatchSnapshot());
        }
      }
    }
    } catch (error) {
      console.error('Error in checkMatchEndConditions:', error);
    }
  };

  // Handle end of innings
  const handleEndInnings = (matchSnapshot = null) => {
    if (match.innings === 1) {
      // Calculate if innings is truly over (overs complete)
      // Use matchSnapshot.balls if available (correct count), fallback to match.balls
      const maxBalls = settings.overs * settings.ballsPerOver;
      const currentBalls = matchSnapshot?.balls ?? match.balls;
      const currentWickets = matchSnapshot?.wickets ?? match.wickets;
      const isOversComplete = currentBalls >= maxBalls;
      const isAllOut = currentWickets >= settings.playersPerTeam - 1;

      // If overs are complete or all out, always show (ignore dismissed flag)
      // If just a mid-innings trigger, respect the dismissed flag
      if (isOversComplete || isAllOut) {
        // Innings is genuinely over - must end
        if (!showEndInningsModal) {
          setEndInningsPromptDismissed(false); // Reset flag
          setShowEndInningsModal(true);
        }
      } else if (!endInningsPromptDismissed && !showEndInningsModal) {
        // Mid-innings trigger (shouldn't happen, but handle gracefully)
        setShowEndInningsModal(true);
      }
    } else {
      // For second innings, use the snapshot data
      const runs = matchSnapshot ? matchSnapshot.runs : match.runs;
      const wickets = matchSnapshot ? matchSnapshot.wickets : match.wickets;
      const result = runs > match.target
        ? `${getBattingTeam()} won by ${settings.playersPerTeam - 1 - wickets} wickets`
        : runs === match.target
          ? 'Match Tied'
          : `${getBowlingTeam()} won by ${match.target - runs} runs`;
      handleMatchEnd(result, matchSnapshot);
    }
  };

  // Confirm end of first innings
  const confirmEndInnings = () => {
    setShowEndInningsModal(false);
    setShowSummaryModal(true);
  };

  // Start second innings
  const startSecondInnings = () => {
    const target = match.runs + 1;

    // Save first innings data to state for later use
    const innings1Data = {
      battingTeam: getBattingTeam(),
      bowlingTeam: getBowlingTeam(),
      runs: match.runs,
      wickets: match.wickets,
      overs: getCurrentOver(),
      batting: allBatsmen.map(b => ({ ...b })),
      bowling: allBowlers.map(b => ({ ...b })),
      extras: { ...extras },
      fallOfWickets: fallOfWickets.map(f => ({ ...f })),
      overHistory: overHistory.map(o => ({ ...o })),
    };
    setFirstInningsData(innings1Data);

    // Set scorecard view to show current innings by default
    setScorecardInningsView(2);

    // Reset for second innings
    setMatch({
      runs: 0,
      wickets: 0,
      balls: 0,
      innings: 2,
      target,
      isChasing: true,
    });

    // Reset players
    const newBatsmen = [];
    for (let i = 1; i <= settings.playersPerTeam; i++) {
      newBatsmen.push({
        id: i,
        name: `Batsman ${i}`,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        isOut: false,
        isRetired: false,
        outType: '',
      });
    }
    setAllBatsmen(newBatsmen);
    setCurrentBatsmen({
      striker: newBatsmen[0],
      nonStriker: newBatsmen[1],
    });

    const newBowlers = [];
    for (let i = 1; i <= settings.playersPerTeam; i++) {
      newBowlers.push({
        id: i,
        name: `Bowler ${i}`,
        overs: '0.0',
        runs: 0,
        wickets: 0,
        maidens: 0,
      });
    }
    setAllBowlers(newBowlers);
    setCurrentBowler(newBowlers[0]);

    // Reset extras and over tracking
    setExtras({ wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 });
    setCurrentOverBalls([]);
    setOverHistory([]);
    setCurrentOverRuns(0);
    setCurrentOverWickets(0);
    setFallOfWickets([]);

    setShowSummaryModal(false);
  };

  // Handle match end - show confirmation modal instead of navigating immediately
  const handleMatchEnd = (result, matchSnapshot = null) => {
    // Build complete innings data using snapshot if provided (for accurate data)
    let innings1, innings2;

    if (match.innings === 1) {
      // Match ended in first innings (all out or overs completed)
      // Use snapshot data if available for accuracy
      innings1 = {
        battingTeam: getBattingTeam(),
        bowlingTeam: getBowlingTeam(),
        runs: matchSnapshot ? matchSnapshot.runs : match.runs,
        wickets: matchSnapshot ? matchSnapshot.wickets : match.wickets,
        overs: matchSnapshot ? matchSnapshot.overs : getCurrentOver(),
        batting: matchSnapshot ? matchSnapshot.batting : allBatsmen.map(b => ({ ...b })),
        bowling: matchSnapshot ? matchSnapshot.bowling : allBowlers.map(b => ({ ...b })),
        extras: matchSnapshot ? matchSnapshot.extras : { ...extras },
        fallOfWickets: matchSnapshot ? matchSnapshot.fallOfWickets : fallOfWickets.map(f => ({ ...f })),
        overHistory: matchSnapshot ? matchSnapshot.overHistory : overHistory.map(o => ({ ...o, balls: [...o.balls] })),
      };
      innings2 = null;
    } else {
      // Match ended in second innings
      // Use stored first innings data
      innings1 = firstInningsData || {
        battingTeam: getBowlingTeam(),
        bowlingTeam: getBattingTeam(),
        runs: match.target - 1,
        wickets: settings.playersPerTeam - 1,
        overs: `${settings.overs}.0`,
        batting: [],
        bowling: [],
        extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
        fallOfWickets: [],
      };

      // Use snapshot data for second innings if available
      innings2 = {
        battingTeam: getBattingTeam(),
        bowlingTeam: getBowlingTeam(),
        runs: matchSnapshot ? matchSnapshot.runs : match.runs,
        wickets: matchSnapshot ? matchSnapshot.wickets : match.wickets,
        overs: matchSnapshot ? matchSnapshot.overs : getCurrentOver(),
        batting: matchSnapshot ? matchSnapshot.batting : allBatsmen.map(b => ({ ...b })),
        bowling: matchSnapshot ? matchSnapshot.bowling : allBowlers.map(b => ({ ...b })),
        extras: matchSnapshot ? matchSnapshot.extras : { ...extras },
        fallOfWickets: matchSnapshot ? matchSnapshot.fallOfWickets : fallOfWickets.map(f => ({ ...f })),
        overHistory: matchSnapshot ? matchSnapshot.overHistory : overHistory.map(o => ({ ...o, balls: [...o.balls] })),
      };
    }

    const matchEndData = {
      result,
      status: 'completed',
      innings1,
      innings2,
      totalOvers: settings.overs,
      date: new Date().toISOString(),
    };

    // Store the data and show confirmation modal
    setPendingMatchEnd(matchEndData);
    setShowMatchEndModal(true);
  };

  // Confirm and finalize match end
  const confirmMatchEnd = async () => {
    if (!pendingMatchEnd) return;

    console.log('=== CONFIRMING MATCH END ===');
    console.log('User token exists:', !!user?.token);
    console.log('Match ID:', matchData?._id);
    console.log('Is guest match:', matchData?._id?.startsWith('guest_'));

    // Try to save to server
    let saveSuccess = false;
    try {
      if (user?.token && matchData?._id && !matchData._id.startsWith('guest_')) {
        console.log('Attempting to save completed match...');
        console.log('Match end data:', JSON.stringify({
          result: pendingMatchEnd.result,
          status: pendingMatchEnd.status,
          hasInnings1: !!pendingMatchEnd.innings1,
          hasInnings2: !!pendingMatchEnd.innings2,
          innings1Runs: pendingMatchEnd.innings1?.runs,
          innings2Runs: pendingMatchEnd.innings2?.runs,
        }));

        const result = await matchService.endMatch(matchData._id, pendingMatchEnd, user.token);
        console.log('Match saved successfully:', result);
        saveSuccess = true;
      } else {
        console.log('Skipping server save - conditions not met');
        if (!user?.token) console.log('  - No user token');
        if (!matchData?._id) console.log('  - No match ID');
        if (matchData?._id?.startsWith('guest_')) console.log('  - Guest match');
      }
    } catch (error) {
      console.error('Failed to save match to server:', error);
      console.error('Error details:', JSON.stringify(error));
      // Show alert but don't block navigation
      Alert.alert(
        'Save Warning',
        'Match completed but could not be saved to server. You can still view the scorecard.',
        [{ text: 'OK' }]
      );
    }

    setShowMatchEndModal(false);
    navigation.replace('FullScorecard', { matchData: { ...matchData, ...pendingMatchEnd } });
  };

  // Save current match progress (for leaving mid-match)
  const saveMatchProgress = async () => {
    console.log('=== SAVING MATCH PROGRESS ===');
    console.log('User token exists:', !!user?.token);
    console.log('Match ID:', matchData?._id);

    // Build current innings data
    const currentInningsData = {
      battingTeam: getBattingTeam(),
      bowlingTeam: getBowlingTeam(),
      runs: match.runs,
      wickets: match.wickets,
      overs: getCurrentOver(),
      batting: allBatsmen.map(b => ({ ...b })),
      bowling: allBowlers.map(b => ({ ...b })),
      extras: { ...extras },
      fallOfWickets: fallOfWickets.map(f => ({ ...f })),
      overHistory: overHistory.map(o => ({ ...o, balls: [...o.balls] })),
    };

    let innings1, innings2;
    if (match.innings === 1) {
      innings1 = currentInningsData;
      innings2 = null;
    } else {
      innings1 = firstInningsData || currentInningsData;
      innings2 = currentInningsData;
    }

    const matchProgressData = {
      status: 'in_progress',
      innings: match.innings,
      target: match.target,
      innings1,
      innings2,
      // Include all settings to preserve them
      totalOvers: settings.overs,
      ballsPerOver: settings.ballsPerOver,
      playersPerTeam: settings.playersPerTeam,
      currentState: {
        runs: match.runs,
        wickets: match.wickets,
        balls: match.balls,
        overs: getCurrentOver(),
        striker: { ...currentBatsmen.striker },
        nonStriker: { ...currentBatsmen.nonStriker },
        currentBowler: { ...currentBowler },
        currentOverBalls: [...currentOverBalls],
      },
      date: new Date().toISOString(),
    };

    console.log('Match progress data:', JSON.stringify({
      innings: matchProgressData.innings,
      runs: matchProgressData.currentState.runs,
      balls: matchProgressData.currentState.balls,
      batsmenCount: matchProgressData.innings1?.batting?.length,
    }));

    // Try to save to server
    try {
      if (user?.token && matchData?._id && !matchData._id.startsWith('guest_')) {
        console.log('Calling updateMatch API...');
        const result = await matchService.updateMatch(matchData._id, matchProgressData, user.token);
        console.log('Save result:', result);
        return true;
      } else {
        console.log('Save skipped - no token or guest match');
        return true;
      }
    } catch (error) {
      console.warn('Could not save match progress:', JSON.stringify(error));
      if (error.validationErrors) {
        console.warn('Validation errors:', error.validationErrors);
      }
    }
    return false;
  };

  // Handle leaving match - confirm, save, and leave
  const handleLeaveMatch = () => {
    Alert.alert(
      'Leave Match',
      'Are you sure you want to leave? Your progress will be saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          onPress: async () => {
            const saved = await saveMatchProgress();
            console.log('Match save result:', saved);
            navigation.goBack();
          }
        },
      ]
    );
  };

  // Save current state to history before any action
  const saveToHistory = (actionDescription = '') => {
    const snapshot = {
      timestamp: Date.now(),
      action: actionDescription,
      // Match state
      match: { ...match },
      // Current batsmen
      currentBatsmen: {
        striker: { ...currentBatsmen.striker },
        nonStriker: { ...currentBatsmen.nonStriker },
      },
      // Current bowler
      currentBowler: { ...currentBowler },
      // Previous bowler tracking
      previousBowlerId,
      // Over tracking
      currentOverBalls: [...currentOverBalls],
      currentOverRuns,
      currentOverWickets,
      overHistory: overHistory.map(over => ({ ...over, balls: [...over.balls] })),
      // All players
      allBatsmen: allBatsmen.map(b => ({ ...b })),
      allBowlers: allBowlers.map(b => ({ ...b })),
      // Extras
      extras: { ...extras },
      // Fall of wickets
      fallOfWickets: fallOfWickets.map(fow => ({ ...fow })),
      // Teams
      teams: {
        teamA: { ...teams.teamA },
        teamB: { ...teams.teamB },
      },
    };

    setUndoHistory(prev => {
      const newHistory = [...prev, snapshot];
      // Keep only the last MAX_UNDO_HISTORY entries
      if (newHistory.length > MAX_UNDO_HISTORY) {
        return newHistory.slice(-MAX_UNDO_HISTORY);
      }
      return newHistory;
    });
  };

  // Undo last action
  const handleUndo = () => {
    if (undoHistory.length === 0) {
      Alert.alert('Cannot Undo', 'No actions to undo');
      return;
    }

    // Get the last snapshot
    const lastSnapshot = undoHistory[undoHistory.length - 1];

    // Restore all states from snapshot
    setMatch(lastSnapshot.match);
    setCurrentBatsmen(lastSnapshot.currentBatsmen);
    setCurrentBowler(lastSnapshot.currentBowler);
    setPreviousBowlerId(lastSnapshot.previousBowlerId);
    setCurrentOverBalls(lastSnapshot.currentOverBalls);
    setCurrentOverRuns(lastSnapshot.currentOverRuns);
    setCurrentOverWickets(lastSnapshot.currentOverWickets);
    setOverHistory(lastSnapshot.overHistory);
    setAllBatsmen(lastSnapshot.allBatsmen);
    setAllBowlers(lastSnapshot.allBowlers);
    setExtras(lastSnapshot.extras);
    setFallOfWickets(lastSnapshot.fallOfWickets);
    setTeams(lastSnapshot.teams);

    // Remove the used snapshot from history
    setUndoHistory(prev => prev.slice(0, -1));
  };

  // Change bowler
  const handleChangeBowler = (bowler) => {
    if (currentOverBalls.length > 0 && currentOverBalls.length < settings.ballsPerOver) {
      Alert.alert('Cannot Change', 'Complete the current over first');
      return;
    }

    // Prevent same bowler from bowling consecutive overs
    if (bowler.id === previousBowlerId) {
      Alert.alert('Cannot Select', 'This bowler bowled the previous over. Select a different bowler.');
      return;
    }

    // Save state before action for undo
    saveToHistory(`Change Bowler to ${bowler.name}`);

    // Get the bowler's current stats from allBowlers (spell continues)
    const bowlerWithStats = allBowlers.find(b => b.id === bowler.id) || bowler;
    setCurrentBowler({ ...bowlerWithStats });

    setShowChangeBowlerModal(false);
  };

  // Update player name
  const handleUpdatePlayerName = (playerId, newName, isStriker, isBowler = false) => {
    if (isBowler) {
      setCurrentBowler(prev => prev.id === playerId ? { ...prev, name: newName } : prev);
      setAllBowlers(prev => prev.map(b => b.id === playerId ? { ...b, name: newName } : b));
    } else {
      if (isStriker) {
        setCurrentBatsmen(prev => ({ ...prev, striker: { ...prev.striker, name: newName } }));
      } else {
        setCurrentBatsmen(prev => ({ ...prev, nonStriker: { ...prev.nonStriker, name: newName } }));
      }
      setAllBatsmen(prev => prev.map(b => b.id === playerId ? { ...b, name: newName } : b));
    }
  };

  // Update team name
  const handleUpdateTeamName = (team, newName) => {
    if (team === 'batting') {
      // Determine which team is batting
      const isBattingTeamA = match.innings === 1
        ? (matchData?.toss?.decision === 'bat'
          ? matchData?.toss?.winner === matchData?.teamA?.name
          : matchData?.toss?.winner !== matchData?.teamA?.name)
        : (matchData?.toss?.decision === 'bat'
          ? matchData?.toss?.winner !== matchData?.teamA?.name
          : matchData?.toss?.winner === matchData?.teamA?.name);

      if (isBattingTeamA) {
        setTeams(prev => ({ ...prev, teamA: { ...prev.teamA, name: newName } }));
      } else {
        setTeams(prev => ({ ...prev, teamB: { ...prev.teamB, name: newName } }));
      }
    } else {
      // Bowling team
      const isBowlingTeamA = match.innings === 1
        ? (matchData?.toss?.decision === 'bat'
          ? matchData?.toss?.winner !== matchData?.teamA?.name
          : matchData?.toss?.winner === matchData?.teamA?.name)
        : (matchData?.toss?.decision === 'bat'
          ? matchData?.toss?.winner === matchData?.teamA?.name
          : matchData?.toss?.winner !== matchData?.teamA?.name);

      if (isBowlingTeamA) {
        setTeams(prev => ({ ...prev, teamA: { ...prev.teamA, name: newName } }));
      } else {
        setTeams(prev => ({ ...prev, teamB: { ...prev.teamB, name: newName } }));
      }
    }
  };

  // Update batsman name in scorecard
  const handleUpdateBatsmanName = (batsmanId, newName) => {
    setAllBatsmen(prev => prev.map(b => b.id === batsmanId ? { ...b, name: newName } : b));
    // Also update striker/nonStriker if it's the current batsman
    if (striker.id === batsmanId) {
      setCurrentBatsmen(prev => ({ ...prev, striker: { ...prev.striker, name: newName } }));
    }
    if (nonStriker.id === batsmanId) {
      setCurrentBatsmen(prev => ({ ...prev, nonStriker: { ...prev.nonStriker, name: newName } }));
    }
  };

  // Update bowler name in scorecard
  const handleUpdateBowlerName = (bowlerId, newName) => {
    setAllBowlers(prev => prev.map(b => b.id === bowlerId ? { ...b, name: newName } : b));
    if (currentBowler.id === bowlerId) {
      setCurrentBowler(prev => ({ ...prev, name: newName }));
    }
  };

  // Get ball color
  const getBallColor = (ball) => {
    if (ball === 'W') return colors.ballWicket;
    if (ball === '4' || ball === '6') return colors.ballBoundary;
    if (ball.includes('WD') || ball.includes('NB')) return colors.ballExtra;
    if (ball.includes('BYE') || ball.includes('LB')) return colors.ballBye;
    return colors.ballRun;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{flex: 1}}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleLeaveMatch}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        {/* Animated Toggle Switch */}
        <View style={styles.viewToggleContainer}>
          {/* Sliding Indicator */}
          <Animated.View
            style={[
              styles.viewToggleSlider,
              {
                transform: [{ translateX: slidePosition }],
              },
            ]}
          />

          {/* Live Button */}
          <TouchableOpacity
            style={styles.viewToggleButton}
            onPress={() => handleToggle('live')}
            activeOpacity={0.9}
          >
            <Animated.View style={{ transform: [{ scale: liveScaleAnim }] }}>
              <Animated.Text
                style={[
                  styles.viewToggleText,
                  { color: liveTextColor },
                ]}
              >
                Live
              </Animated.Text>
            </Animated.View>
            {viewMode === 'live' && (
              <Animated.View
                style={[
                  styles.liveDot,
                  { transform: [{ scale: liveDotPulse }] },
                ]}
              />
            )}
          </TouchableOpacity>

          {/* Scorecard Button */}
          <TouchableOpacity
            style={styles.viewToggleButton}
            onPress={() => handleToggle('scorecard')}
            activeOpacity={0.9}
          >
            <Animated.View style={{ transform: [{ scale: scorecardScaleAnim }] }}>
              <Animated.Text
                style={[
                  styles.viewToggleText,
                  { color: scorecardTextColor },
                ]}
              >
                Scorecard
              </Animated.Text>
            </Animated.View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettingsModal(true)}
        >
          <View style={styles.settingsIcon}>
            <View style={styles.settingsGear}>
              <View style={styles.gearCenter} />
              <View style={[styles.gearTooth, { transform: [{ rotate: '0deg' }] }]} />
              <View style={[styles.gearTooth, { transform: [{ rotate: '45deg' }] }]} />
              <View style={[styles.gearTooth, { transform: [{ rotate: '90deg' }] }]} />
              <View style={[styles.gearTooth, { transform: [{ rotate: '135deg' }] }]} />
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {viewMode === 'scorecard' ? (
        /* Full Scorecard View */
        <ScrollView
          style={{flex: 1}}
          contentContainerStyle={styles.scorecardScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={() => Keyboard.dismiss()}
          nestedScrollEnabled={true}
        >
          {/* Match Header */}
          <View style={styles.scorecardHeader}>
            <View style={styles.scorecardTeamsRow}>
              <View style={styles.scorecardTeamContainer}>
                <View style={[styles.scorecardTeamBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.scorecardTeamBadgeText}>{getBattingTeam().charAt(0)}</Text>
                </View>
                <TextInput
                  style={styles.scorecardTeamNameInput}
                  value={getBattingTeam()}
                  onChangeText={(text) => handleUpdateTeamName('batting', text)}
                  selectTextOnFocus={true}
                  returnKeyType="done"
                />
              </View>
              <View style={styles.scorecardVsBadge}>
                <Text style={styles.scorecardVsText}>VS</Text>
              </View>
              <View style={styles.scorecardTeamContainer}>
                <View style={[styles.scorecardTeamBadge, { backgroundColor: colors.secondary || '#5dade2' }]}>
                  <Text style={styles.scorecardTeamBadgeText}>{getBowlingTeam().charAt(0)}</Text>
                </View>
                <TextInput
                  style={styles.scorecardTeamNameInput}
                  value={getBowlingTeam()}
                  onChangeText={(text) => handleUpdateTeamName('bowling', text)}
                  selectTextOnFocus={true}
                  returnKeyType="done"
                />
              </View>
            </View>
            <View style={styles.scorecardScoreRow}>
              <Text style={styles.scorecardMainScore}>{match.runs}/{match.wickets}</Text>
              <Text style={styles.scorecardOvers}>({getCurrentOver()}/{settings.overs} ov)</Text>
            </View>
            <Text style={styles.scorecardRunRate}>
              Run Rate: {getRunRate()}
              {match.isChasing && ` | Required: ${getRequiredRunRate()}`}
            </Text>
            {match.isChasing && (
              <View style={styles.scorecardTargetBanner}>
                <Text style={styles.scorecardTargetText}>
                  Need {match.target - match.runs} runs from {(settings.overs * settings.ballsPerOver) - match.balls} balls
                </Text>
              </View>
            )}
          </View>

          {/* Innings Toggle Tabs (only in 2nd innings) */}
          {match.innings === 2 && firstInningsData && (
            <View style={styles.inningsToggleContainer}>
              <TouchableOpacity
                style={[
                  styles.inningsToggleTab,
                  scorecardInningsView === 1 && styles.inningsToggleTabActive
                ]}
                onPress={() => setScorecardInningsView(1)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.inningsToggleText,
                  scorecardInningsView === 1 && styles.inningsToggleTextActive
                ]}>
                  1st Innings
                </Text>
                <Text style={[
                  styles.inningsToggleScore,
                  scorecardInningsView === 1 && styles.inningsToggleScoreActive
                ]}>
                  {firstInningsData.runs}/{firstInningsData.wickets}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.inningsToggleTab,
                  scorecardInningsView === 2 && styles.inningsToggleTabActive
                ]}
                onPress={() => setScorecardInningsView(2)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.inningsToggleText,
                  scorecardInningsView === 2 && styles.inningsToggleTextActive
                ]}>
                  2nd Innings
                </Text>
                <Text style={[
                  styles.inningsToggleScore,
                  scorecardInningsView === 2 && styles.inningsToggleScoreActive
                ]}>
                  {match.runs}/{match.wickets}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Render First Innings Data (when in 2nd innings and viewing 1st innings) */}
          {match.innings === 2 && firstInningsData && scorecardInningsView === 1 ? (
            <>
              {/* First Innings - Batting */}
              <View style={styles.scorecardSection}>
                <View style={styles.scorecardSectionHeader}>
                  <Text style={styles.scorecardSectionTitle}>Batting - {firstInningsData.battingTeam}</Text>
                  <Text style={styles.scorecardSectionScore}>
                    {firstInningsData.runs}/{firstInningsData.wickets} ({firstInningsData.overs})
                  </Text>
                </View>
                <View style={styles.scorecardTable}>
                  <View style={styles.scorecardTableHeader}>
                    <Text style={[styles.scorecardTableHeaderText, styles.scorecardNameCol]}>Batsman</Text>
                    <Text style={styles.scorecardTableHeaderText}>R</Text>
                    <Text style={styles.scorecardTableHeaderText}>B</Text>
                    <Text style={styles.scorecardTableHeaderText}>4s</Text>
                    <Text style={styles.scorecardTableHeaderText}>6s</Text>
                    <Text style={styles.scorecardTableHeaderText}>SR</Text>
                  </View>
                  {firstInningsData.batting?.filter(b => b.balls > 0 || b.runs > 0 || b.isOut).map((batsman, index) => (
                    <View key={batsman.id} style={[styles.scorecardTableRow, index % 2 === 0 && styles.scorecardTableRowAlt]}>
                      <View style={styles.scorecardNameCol}>
                        <Text style={styles.scorecardPlayerNameText}>{batsman.name}</Text>
                        <Text style={[
                          styles.scorecardPlayerStatus,
                          batsman.isOut && styles.scorecardPlayerStatusOut
                        ]}>
                          {batsman.isOut ? batsman.outType || 'Out' :
                           batsman.isRetired ? 'Retired' : 'Not Out'}
                        </Text>
                      </View>
                      <Text style={[styles.scorecardStatText, styles.scorecardRunsText]}>{batsman.runs}</Text>
                      <Text style={styles.scorecardStatText}>{batsman.balls}</Text>
                      <Text style={styles.scorecardStatText}>{batsman.fours}</Text>
                      <Text style={styles.scorecardStatText}>{batsman.sixes}</Text>
                      <Text style={styles.scorecardStatText}>
                        {batsman.balls > 0 ? ((batsman.runs / batsman.balls) * 100).toFixed(1) : '0.0'}
                      </Text>
                    </View>
                  ))}
                </View>
                {/* Extras */}
                {firstInningsData.extras && (
                  <View style={styles.scorecardExtras}>
                    <Text style={styles.scorecardExtrasLabel}>Extras: {firstInningsData.extras.total}</Text>
                    <Text style={styles.scorecardExtrasDetail}>
                      (WD: {firstInningsData.extras.wides}, NB: {firstInningsData.extras.noBalls}, B: {firstInningsData.extras.byes}, LB: {firstInningsData.extras.legByes})
                    </Text>
                  </View>
                )}
              </View>

              {/* First Innings - Bowling */}
              <View style={styles.scorecardSection}>
                <View style={styles.scorecardSectionHeader}>
                  <Text style={styles.scorecardSectionTitle}>Bowling - {firstInningsData.bowlingTeam}</Text>
                </View>
                <View style={styles.scorecardTable}>
                  <View style={[styles.scorecardTableHeader, styles.scorecardBowlingHeader]}>
                    <Text style={[styles.scorecardTableHeaderText, styles.scorecardNameCol]}>Bowler</Text>
                    <Text style={styles.scorecardTableHeaderText}>O</Text>
                    <Text style={styles.scorecardTableHeaderText}>M</Text>
                    <Text style={styles.scorecardTableHeaderText}>R</Text>
                    <Text style={styles.scorecardTableHeaderText}>W</Text>
                    <Text style={styles.scorecardTableHeaderText}>ER</Text>
                  </View>
                  {firstInningsData.bowling?.filter(b => {
                    const [overs, balls] = b.overs.split('.').map(Number);
                    return overs > 0 || balls > 0;
                  }).map((bowler, index) => {
                    const [overs, balls] = bowler.overs.split('.').map(Number);
                    const totalBalls = overs * 6 + balls;
                    const economyRate = totalBalls > 0 ? ((bowler.runs / totalBalls) * 6).toFixed(2) : '0.00';
                    return (
                      <View key={bowler.id} style={[styles.scorecardTableRow, index % 2 === 0 && styles.scorecardTableRowAlt]}>
                        <View style={styles.scorecardNameCol}>
                          <Text style={styles.scorecardPlayerNameText}>{bowler.name}</Text>
                        </View>
                        <Text style={styles.scorecardStatText}>{bowler.overs}</Text>
                        <Text style={styles.scorecardStatText}>{bowler.maidens}</Text>
                        <Text style={styles.scorecardStatText}>{bowler.runs}</Text>
                        <Text style={[styles.scorecardStatText, styles.scorecardWicketsText]}>{bowler.wickets}</Text>
                        <Text style={styles.scorecardStatText}>{economyRate}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* First Innings - Fall of Wickets */}
              {firstInningsData.fallOfWickets?.length > 0 && (
                <View style={styles.scorecardSection}>
                  <View style={styles.scorecardSectionHeader}>
                    <Text style={styles.scorecardSectionTitle}>Fall of Wickets</Text>
                  </View>
                  <View style={styles.scorecardFowContainer}>
                    {firstInningsData.fallOfWickets.map((fow, index) => (
                      <View key={index} style={styles.scorecardFowItem}>
                        <View style={styles.scorecardFowBadge}>
                          <Text style={styles.scorecardFowWicket}>{fow.wicket}</Text>
                        </View>
                        <View style={styles.scorecardFowDetails}>
                          <Text style={styles.scorecardFowScore}>{fow.score}</Text>
                          <Text style={styles.scorecardFowInfo}>{fow.batsman_name} ({fow.over} ov)</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* First Innings - Over History */}
              {firstInningsData.overHistory?.length > 0 && (
                <View style={styles.scorecardSection}>
                  <View style={styles.scorecardSectionHeader}>
                    <Text style={styles.scorecardSectionTitle}>Over by Over</Text>
                  </View>
                  <View style={styles.scorecardOverHistory}>
                    {firstInningsData.overHistory.slice(-6).map((over, index) => (
                      <View key={index} style={styles.scorecardOverItem}>
                        <Text style={styles.scorecardOverNumber}>Over {firstInningsData.overHistory.length - 5 + index}</Text>
                        <View style={styles.scorecardOverBalls}>
                          {over.balls?.map((ball, ballIndex) => (
                            <Text key={ballIndex} style={styles.scorecardOverBall}>{ball}</Text>
                          ))}
                        </View>
                        <Text style={styles.scorecardOverRuns}>{over.runs} runs</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          ) : (
            <>
              {/* Current Innings - Batting */}
              <View style={styles.scorecardSection}>
                <View style={styles.scorecardSectionHeader}>
                  <Text style={styles.scorecardSectionTitle}>Batting - {getBattingTeam()}</Text>
                </View>
                <View style={styles.scorecardTable}>
                  <View style={styles.scorecardTableHeader}>
                    <Text style={[styles.scorecardTableHeaderText, styles.scorecardNameCol]}>Batsman</Text>
                    <Text style={styles.scorecardTableHeaderText}>R</Text>
                    <Text style={styles.scorecardTableHeaderText}>B</Text>
                    <Text style={styles.scorecardTableHeaderText}>4s</Text>
                    <Text style={styles.scorecardTableHeaderText}>6s</Text>
                    <Text style={styles.scorecardTableHeaderText}>SR</Text>
                  </View>
                  {allBatsmen.filter(b => b.balls > 0 || b.runs > 0 || b.isOut).map((batsman, index) => (
                    <View key={batsman.id} style={[styles.scorecardTableRow, index % 2 === 0 && styles.scorecardTableRowAlt]}>
                      <View style={styles.scorecardNameCol}>
                        <TextInput
                          style={styles.scorecardPlayerNameInput}
                          value={batsman.name}
                          onChangeText={(text) => handleUpdateBatsmanName(batsman.id, text)}
                          selectTextOnFocus={true}
                          returnKeyType="done"
                        />
                        <Text style={[
                          styles.scorecardPlayerStatus,
                          batsman.isOut && styles.scorecardPlayerStatusOut
                        ]}>
                          {batsman.isOut ? batsman.outType || 'Out' :
                           batsman.id === striker.id ? 'Batting *' :
                           batsman.id === nonStriker.id ? 'Batting' :
                           batsman.isRetired ? 'Retired' : 'Not Out'}
                        </Text>
                      </View>
                      <Text style={[styles.scorecardStatText, styles.scorecardRunsText]}>{batsman.runs}</Text>
                      <Text style={styles.scorecardStatText}>{batsman.balls}</Text>
                      <Text style={styles.scorecardStatText}>{batsman.fours}</Text>
                      <Text style={styles.scorecardStatText}>{batsman.sixes}</Text>
                      <Text style={styles.scorecardStatText}>
                        {batsman.balls > 0 ? ((batsman.runs / batsman.balls) * 100).toFixed(1) : '0.0'}
                      </Text>
                    </View>
                  ))}
                  {/* Yet to bat */}
                  {allBatsmen.filter(b => !b.balls && !b.runs && !b.isOut && b.id !== striker.id && b.id !== nonStriker.id && !b.isRetired).length > 0 && (
                    <View style={styles.scorecardYetToBat}>
                      <Text style={styles.scorecardYetToBatLabel}>Yet to bat: </Text>
                      <Text style={styles.scorecardYetToBatNames}>
                        {allBatsmen
                          .filter(b => !b.balls && !b.runs && !b.isOut && b.id !== striker.id && b.id !== nonStriker.id && !b.isRetired)
                          .map(b => b.name)
                          .join(', ')}
                      </Text>
                    </View>
                  )}
                </View>
                {/* Extras */}
                <View style={styles.scorecardExtras}>
                  <Text style={styles.scorecardExtrasLabel}>Extras: {extras.total}</Text>
                  <Text style={styles.scorecardExtrasDetail}>
                    (WD: {extras.wides}, NB: {extras.noBalls}, B: {extras.byes}, LB: {extras.legByes})
                  </Text>
                </View>
              </View>

              {/* Current Innings - Bowling */}
              <View style={styles.scorecardSection}>
                <View style={styles.scorecardSectionHeader}>
                  <Text style={styles.scorecardSectionTitle}>Bowling - {getBowlingTeam()}</Text>
                </View>
                <View style={styles.scorecardTable}>
                  <View style={[styles.scorecardTableHeader, styles.scorecardBowlingHeader]}>
                    <Text style={[styles.scorecardTableHeaderText, styles.scorecardNameCol]}>Bowler</Text>
                    <Text style={styles.scorecardTableHeaderText}>O</Text>
                    <Text style={styles.scorecardTableHeaderText}>M</Text>
                    <Text style={styles.scorecardTableHeaderText}>R</Text>
                    <Text style={styles.scorecardTableHeaderText}>W</Text>
                    <Text style={styles.scorecardTableHeaderText}>ER</Text>
                  </View>
                  {allBowlers.filter(b => {
                    const [overs, balls] = b.overs.split('.').map(Number);
                    return overs > 0 || balls > 0;
                  }).map((bowler, index) => {
                    const [overs, balls] = bowler.overs.split('.').map(Number);
                    const totalBalls = overs * 6 + balls;
                    const economyRate = totalBalls > 0 ? ((bowler.runs / totalBalls) * 6).toFixed(2) : '0.00';
                    return (
                      <View key={bowler.id} style={[styles.scorecardTableRow, index % 2 === 0 && styles.scorecardTableRowAlt]}>
                        <View style={styles.scorecardNameCol}>
                          <TextInput
                            style={styles.scorecardPlayerNameInput}
                            value={bowler.name}
                            onChangeText={(text) => handleUpdateBowlerName(bowler.id, text)}
                            selectTextOnFocus={true}
                            returnKeyType="done"
                          />
                          {bowler.id === currentBowler.id && (
                            <Text style={styles.scorecardCurrentBowler}>Bowling</Text>
                          )}
                        </View>
                        <Text style={styles.scorecardStatText}>{bowler.overs}</Text>
                        <Text style={styles.scorecardStatText}>{bowler.maidens}</Text>
                        <Text style={styles.scorecardStatText}>{bowler.runs}</Text>
                        <Text style={[styles.scorecardStatText, styles.scorecardWicketsText]}>{bowler.wickets}</Text>
                        <Text style={styles.scorecardStatText}>{economyRate}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Fall of Wickets */}
              {fallOfWickets.length > 0 && (
                <View style={styles.scorecardSection}>
                  <View style={styles.scorecardSectionHeader}>
                    <Text style={styles.scorecardSectionTitle}>Fall of Wickets</Text>
                  </View>
                  <View style={styles.scorecardFowContainer}>
                    {fallOfWickets.map((fow, index) => (
                      <View key={index} style={styles.scorecardFowItem}>
                        <View style={styles.scorecardFowBadge}>
                          <Text style={styles.scorecardFowWicket}>{fow.wicket}</Text>
                        </View>
                        <View style={styles.scorecardFowDetails}>
                          <Text style={styles.scorecardFowScore}>{fow.score}</Text>
                          <Text style={styles.scorecardFowInfo}>{fow.batsman_name} ({fow.over} ov)</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Over History */}
              {overHistory.length > 0 && (
                <View style={styles.scorecardSection}>
                  <View style={styles.scorecardSectionHeader}>
                    <Text style={styles.scorecardSectionTitle}>Over by Over</Text>
                  </View>
                  <View style={styles.scorecardOverHistory}>
                    {overHistory.slice(-6).map((over, index) => (
                      <View key={index} style={styles.scorecardOverItem}>
                        <Text style={styles.scorecardOverNumber}>Over {overHistory.length - 5 + index}</Text>
                        <View style={styles.scorecardOverBalls}>
                          {over.balls.map((ball, ballIndex) => (
                            <Text key={ballIndex} style={styles.scorecardOverBall}>{ball}</Text>
                          ))}
                        </View>
                        <Text style={styles.scorecardOverRuns}>{over.runs} runs</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}

          {/* Back to Live Button */}
          <TouchableOpacity
            style={styles.backToLiveButton}
            onPress={() => setViewMode('live')}
            activeOpacity={0.8}
          >
            <Text style={styles.backToLiveText}>Back to Live Scoring</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
      /* Live Score View */
      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={() => Keyboard.dismiss()}
        nestedScrollEnabled={true}
      >
        {/* Top Section - Score & Batsmen */}
        <View style={styles.topSection}>
        {/* Innings Badge */}
        <View style={styles.inningsBadge}>
          <Text style={styles.inningsBadgeText}>
            {match.innings === 1 ? '1ST INNINGS' : '2ND INNINGS'}
          </Text>
        </View>

        {/* Teams Display */}
        <View style={styles.teamsContainer}>
          <TextInput
            style={styles.battingTeamInput}
            value={getBattingTeam()}
            onChangeText={(text) => handleUpdateTeamName('batting', text)}
            selectTextOnFocus={true}
            returnKeyType="done"
          />
          <Text style={styles.vsText}>vs</Text>
          <TextInput
            style={styles.bowlingTeamInput}
            value={getBowlingTeam()}
            onChangeText={(text) => handleUpdateTeamName('bowling', text)}
            selectTextOnFocus={true}
            returnKeyType="done"
          />
        </View>

        {/* Score Display */}
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>
            {match.runs}/{match.wickets}
          </Text>
          <Text style={styles.oversText}>({getCurrentOver()}/{settings.overs} ov)</Text>
        </View>

        {/* Run Rate */}
        <Text style={styles.runRateText}>
          CRR: {getRunRate()}
          {match.isChasing && ` | RRR: ${getRequiredRunRate()}`}
        </Text>

        {/* Target Info */}
        {match.isChasing && (
          <View style={styles.targetInfo}>
            <Text style={styles.targetText}>
              Need {match.target - match.runs} runs from {(settings.overs * settings.ballsPerOver) - match.balls} balls
            </Text>
          </View>
        )}

        {/* Batsmen Info */}
        <View style={styles.batsmenContainer}>
          {/* Swap Icon Overlay */}
          <Animated.View
            style={[
              styles.swapIconContainer,
              {
                opacity: swapIconOpacity,
                transform: [{ scale: swapIconScale }],
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.swapIconCircle}>
              <View style={styles.swapArrowsContainer}>
                <View style={styles.swapArrowLeft}>
                  <View style={styles.swapArrowLine} />
                  <View style={styles.swapArrowHead} />
                </View>
                <View style={styles.swapArrowRight}>
                  <View style={styles.swapArrowHeadRight} />
                  <View style={styles.swapArrowLine} />
                </View>
              </View>
            </View>
          </Animated.View>

          <View style={[styles.batsmanCard, styles.strikerCard]}>
            <View style={styles.strikerLabel}>
              <View style={styles.strikerLabelInner}>
                <Text style={styles.strikerLabelText}>STRIKER</Text>
              </View>
            </View>
            <AutocompleteInput
              value={striker.name}
              onChangeText={(text) => handleUpdatePlayerName(striker.id, text, true)}
              type="player"
              placeholder="Striker"
              inputStyle={styles.playerName}
              style={styles.playerNameWrapper}
              selectTextOnFocus
            />
            <View style={styles.batsmanStats}>
              <Text style={styles.runsText}>{striker.runs}</Text>
              <Text style={styles.ballsText}>({striker.balls})</Text>
            </View>
          </View>

          <View style={styles.batsmanCard}>
            <AutocompleteInput
              value={nonStriker.name}
              onChangeText={(text) => handleUpdatePlayerName(nonStriker.id, text, false)}
              type="player"
              placeholder="Non-Striker"
              inputStyle={styles.playerName}
              style={styles.playerNameWrapper}
              selectTextOnFocus
            />
            <View style={styles.batsmanStats}>
              <Text style={styles.runsText}>{nonStriker.runs}</Text>
              <Text style={styles.ballsText}>({nonStriker.balls})</Text>
            </View>
          </View>
        </View>
        </View>

        {/* Bowler & This Over Section */}
        <View style={styles.bowlerOverCard}>
          {/* Bowler Row */}
          <View style={styles.bowlerRow}>
            <View style={styles.bowlerNameContainer}>
              <AutocompleteInput
                value={currentBowler.name}
                onChangeText={(text) => handleUpdatePlayerName(currentBowler.id, text, false, true)}
                type="player"
                placeholder="Bowler"
                inputStyle={styles.bowlerName}
                style={styles.bowlerNameWrapper}
                selectTextOnFocus
              />
            </View>
            <View style={styles.bowlerSpellContainer}>
              <Text style={styles.bowlerSpellLabel}>Spell</Text>
              <Text style={styles.bowlerSpell}>
                {currentBowler.runs}/{currentBowler.wickets} ({currentBowler.overs})
              </Text>
            </View>
            <View style={styles.bowlerChangeContainer}>
              <TouchableOpacity
                style={styles.changeBowlerButton}
                onPress={() => setShowChangeBowlerModal(true)}
              >
                <Text style={styles.changeBowlerButtonText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.bowlerDivider} />

          {/* This Over Section */}
          <View style={styles.thisOverSection}>
            <Text style={styles.thisOverTitle}>This Over</Text>
            <View style={styles.ballsRow}>
              {currentOverBalls.map((ball, index) => {
                // Check if ball has extra runs or complex display (WD+1, NB+2, LB2, BYE2, WD+W, etc.)
                const isExtendedBall = ball.includes('+') || (ball.length > 2 && !['W', '4', '6'].includes(ball));

                if (isExtendedBall) {
                  // Plain text for extended values - no shape
                  return (
                    <Text key={index} style={styles.ballTextPlain}>{ball}</Text>
                  );
                }

                return (
                  <View
                    key={index}
                    style={[styles.ball, { backgroundColor: getBallColor(ball) }]}
                  >
                    <Text style={styles.ballText}>{ball}</Text>
                  </View>
                );
              })}
              {Array(Math.max(0, settings.ballsPerOver - currentOverBalls.length))
                .fill(null)
                .map((_, index) => (
                  <View key={`empty-${index}`} style={[styles.ball, styles.emptyBall]}>
                    <Text style={styles.emptyBallText}>•</Text>
                  </View>
                ))}
            </View>
          </View>

          {/* View Over History Button */}
          <TouchableOpacity
            style={styles.viewHistoryButton}
            onPress={() => setShowHistoryModal(true)}
          >
            <Text style={styles.viewHistoryButtonText}>View Over History</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      )}

      {/* Scoring Buttons - Fixed at bottom (only show in live mode) */}
      {viewMode === 'live' && (
      <View style={styles.scoringContainer}>
        {/* Line 1: End Innings (full width) */}
        <TouchableOpacity
          style={styles.endInningsButton}
          onPress={() => setShowEndInningsModal(true)}
        >
          <Text style={styles.endInningsText}>End Innings</Text>
        </TouchableOpacity>

        {/* Line 2: Retire, Change Striker */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowRetireModal(true)}
          >
            <Text style={styles.actionButtonText}>Retire</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleChangeStriker}
            disabled={isSwapping}
          >
            <Text style={styles.actionButtonText}>Change Striker</Text>
          </TouchableOpacity>
        </View>

        {/* Line 3: WD, NB, BYE, UNDO (same size) */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.gridButton, styles.wideButton]}
            onPress={() => setShowWideModal(true)}
          >
            <Text style={[styles.gridButtonText, styles.wideButtonText]}>WD</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.gridButton, styles.noballButton]}
            onPress={() => setShowNoBallModal(true)}
          >
            <Text style={[styles.gridButtonText, styles.noballButtonText]}>NB</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.gridButton, styles.byeButton]}
            onPress={() => setShowByeModal(true)}
          >
            <Text style={[styles.gridButtonText, styles.byeButtonText]}>BYE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.gridButton, styles.undoButton]}
            onPress={handleUndo}
          >
            <Text style={[styles.gridButtonText, styles.undoButtonText]}>UNDO</Text>
          </TouchableOpacity>
        </View>

        {/* Line 3: 0, 1, 2, (5,7..) (same size) */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.gridButton}
            onPress={() => handleRuns(0)}
          >
            <Text style={styles.gridButtonText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gridButton}
            onPress={() => handleRuns(1)}
          >
            <Text style={styles.gridButtonText}>1</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gridButton}
            onPress={() => handleRuns(2)}
          >
            <Text style={styles.gridButtonText}>2</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gridButton}
            onPress={() => setShowMoreRunsModal(true)}
          >
            <Text style={styles.gridButtonText}>5,7..</Text>
          </TouchableOpacity>
        </View>

        {/* Line 4: 3, 4, 6, OUT (same size) */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.gridButton}
            onPress={() => handleRuns(3)}
          >
            <Text style={styles.gridButtonText}>3</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gridButton}
            onPress={() => handleRuns(4)}
          >
            <Text style={styles.gridButtonText}>4</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gridButton}
            onPress={() => handleRuns(6)}
          >
            <Text style={styles.gridButtonText}>6</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.gridButton, styles.outButton]}
            onPress={() => setShowWicketModal(true)}
          >
            <Text style={[styles.gridButtonText, styles.outButtonText]}>OUT</Text>
          </TouchableOpacity>
        </View>
      </View>
      )}

      {/* Runs Modal */}
      <Modal visible={showRunsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Runs</Text>
            <View style={styles.modalGrid}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((run) => (
                <TouchableOpacity
                  key={run}
                  style={styles.modalOption}
                  onPress={() => handleRuns(run)}
                >
                  <Text style={styles.modalOptionText}>{run}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowRunsModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Wicket Modal */}
      <Modal visible={showWicketModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.extraBallModal}>
            {/* Header */}
            <View style={styles.outModalHeader}>
              <View style={styles.outModalIconContainer}>
                <Text style={styles.outModalIcon}>OUT</Text>
              </View>
              <Text style={styles.extraBallTitle}>Wicket</Text>
              <Text style={styles.extraBallSubtitle}>Select dismissal type</Text>
            </View>

            {/* Content */}
            <View style={styles.outModalContent}>
              {/* Wicket Types */}
              <View style={styles.extraBallSection}>
                <Text style={styles.extraBallSectionTitle}>Dismissal Type</Text>
                <View style={styles.wicketTypesGrid}>
                  {[
                    { type: 'Bowled', icon: '🎯' },
                    { type: 'Caught', icon: '🧤' },
                    { type: 'LBW', icon: '🦵' },
                    { type: 'Stumped', icon: '🏏' },
                    { type: 'Hit Wicket', icon: '💥' },
                    { type: 'Run Out', icon: '🏃' },
                  ].map((wicket) => (
                    <TouchableOpacity
                      key={wicket.type}
                      style={[
                        styles.wicketTypeOption,
                        selectedWicketType === wicket.type && styles.wicketTypeOptionSelected,
                      ]}
                      onPress={() => {
                        setSelectedWicketType(wicket.type);
                        if (wicket.type !== 'Run Out') {
                          setRunOutBatsman(null);
                          setSelectedRuns(0);
                        }
                      }}
                    >
                      <Text style={styles.wicketTypeIcon}>{wicket.icon}</Text>
                      <Text style={[
                        styles.wicketTypeText,
                        selectedWicketType === wicket.type && styles.wicketTypeTextSelected,
                      ]}>
                        {wicket.type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Run Out Details */}
              {selectedWicketType === 'Run Out' && (
                <View style={styles.runOutExpandedSection}>
                  {/* Batsman Selection */}
                  <View style={styles.extraBallSection}>
                    <Text style={styles.extraBallSectionTitle}>Who Got Out?</Text>
                    <View style={styles.batsmanCardsCompact}>
                      <TouchableOpacity
                        style={[
                          styles.batsmanCardCompact,
                          runOutBatsman === 'striker' && styles.batsmanCardCompactSelected,
                        ]}
                        onPress={() => setRunOutBatsman('striker')}
                      >
                        <View style={[
                          styles.batsmanBadgeSmall,
                          runOutBatsman === 'striker' && styles.batsmanBadgeSmallSelected,
                        ]}>
                          <Text style={[
                            styles.batsmanBadgeSmallText,
                            runOutBatsman === 'striker' && styles.batsmanBadgeSmallTextSelected,
                          ]}>S</Text>
                        </View>
                        <View style={styles.batsmanCardCompactInfo}>
                          <Text style={[
                            styles.batsmanCardCompactName,
                            runOutBatsman === 'striker' && styles.batsmanCardCompactNameSelected,
                          ]}>
                            {striker.name}
                          </Text>
                          <Text style={styles.batsmanCardCompactRole}>Striker</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.batsmanCardCompact,
                          runOutBatsman === 'nonStriker' && styles.batsmanCardCompactSelected,
                        ]}
                        onPress={() => setRunOutBatsman('nonStriker')}
                      >
                        <View style={[
                          styles.batsmanBadgeSmall,
                          runOutBatsman === 'nonStriker' && styles.batsmanBadgeSmallSelected,
                        ]}>
                          <Text style={[
                            styles.batsmanBadgeSmallText,
                            runOutBatsman === 'nonStriker' && styles.batsmanBadgeSmallTextSelected,
                          ]}>NS</Text>
                        </View>
                        <View style={styles.batsmanCardCompactInfo}>
                          <Text style={[
                            styles.batsmanCardCompactName,
                            runOutBatsman === 'nonStriker' && styles.batsmanCardCompactNameSelected,
                          ]}>
                            {nonStriker.name}
                          </Text>
                          <Text style={styles.batsmanCardCompactRole}>Non-Striker</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Runs Scored */}
                  <View style={styles.extraBallSection}>
                    <Text style={styles.extraBallSectionTitle}>Runs Scored</Text>
                    <View style={styles.runsGridCompact}>
                      {[0, 1, 2, 3, 4, 5].map((run) => (
                        <TouchableOpacity
                          key={run}
                          style={[
                            styles.runOptionCompact,
                            selectedRuns === run && styles.runOptionCompactSelected,
                          ]}
                          onPress={() => setSelectedRuns(run)}
                        >
                          <Text style={[
                            styles.runOptionCompactText,
                            selectedRuns === run && styles.runOptionCompactTextSelected,
                          ]}>
                            {run}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.extraBallActions}>
              <TouchableOpacity
                style={styles.extraBallCancelButton}
                onPress={() => {
                  setShowWicketModal(false);
                  setSelectedWicketType('');
                  setRunOutBatsman(null);
                  setSelectedRuns(0);
                }}
              >
                <Text style={styles.extraBallCancelText}>Cancel</Text>
              </TouchableOpacity>
              {selectedWicketType === 'Run Out' ? (
                <TouchableOpacity
                  style={[
                    styles.extraBallConfirmButton,
                    styles.outConfirmButton,
                    !runOutBatsman && styles.extraBallConfirmDisabled,
                  ]}
                  onPress={() => runOutBatsman && handleWicket('Run Out')}
                  disabled={!runOutBatsman}
                >
                  <Text style={styles.extraBallConfirmText}>Confirm Out</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.extraBallConfirmButton,
                    styles.outConfirmButton,
                    !selectedWicketType && styles.extraBallConfirmDisabled,
                  ]}
                  onPress={() => selectedWicketType && handleWicket(selectedWicketType)}
                  disabled={!selectedWicketType}
                >
                  <Text style={styles.extraBallConfirmText}>Confirm Out</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Extras Modal */}
      <Modal visible={showExtrasModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Extra Type</Text>
            <View style={styles.extrasGrid}>
              {[
                { type: 'wide', label: 'Wide', emoji: '🔄' },
                { type: 'noball', label: 'No Ball', emoji: '⚠️' },
                { type: 'bye', label: 'Bye', emoji: '🏃' },
                { type: 'legbye', label: 'Leg Bye', emoji: '🦵' },
              ].map((extra) => (
                <TouchableOpacity
                  key={extra.type}
                  style={[
                    styles.extraOption,
                    selectedExtraType === extra.type && styles.extraOptionSelected,
                  ]}
                  onPress={() => setSelectedExtraType(extra.type)}
                >
                  <Text style={styles.extraEmoji}>{extra.emoji}</Text>
                  <Text style={[
                    styles.extraOptionText,
                    selectedExtraType === extra.type && styles.extraOptionTextSelected,
                  ]}>
                    {extra.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedExtraType && (
              <View style={styles.extraRunsSection}>
                <Text style={styles.subTitle}>Additional Runs</Text>
                <View style={styles.extraRunsRow}>
                  {[0, 1, 2, 3, 4].map((run) => (
                    <TouchableOpacity
                      key={run}
                      style={[
                        styles.extraRunButton,
                        selectedRuns === run && styles.extraRunButtonSelected,
                      ]}
                      onPress={() => setSelectedRuns(run)}
                    >
                      <Text style={styles.extraRunButtonText}>{run}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => {
                    handleRuns(selectedRuns, true, selectedExtraType);
                    setSelectedExtraType('');
                    setSelectedRuns(0);
                  }}
                >
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => {
                setShowExtrasModal(false);
                setSelectedExtraType('');
                setSelectedRuns(0);
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change Bowler Modal */}
      <Modal visible={showChangeBowlerModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Bowler</Text>
            {previousBowlerId && (
              <Text style={styles.bowlerModalHint}>
                Previous over's bowler cannot bowl consecutive overs
              </Text>
            )}
            <ScrollView style={styles.bowlerList} nestedScrollEnabled={true}>
              {allBowlers.map((bowler) => {
                const isPreviousBowler = bowler.id === previousBowlerId;
                const isCurrentBowler = currentBowler.id === bowler.id;
                return (
                  <TouchableOpacity
                    key={bowler.id}
                    style={[
                      styles.bowlerOption,
                      isCurrentBowler && styles.bowlerOptionCurrent,
                      isPreviousBowler && styles.bowlerOptionDisabled,
                    ]}
                    onPress={() => handleChangeBowler(bowler)}
                    disabled={isPreviousBowler}
                  >
                    <View style={styles.bowlerOptionRow}>
                      <Text style={[
                        styles.bowlerOptionName,
                        isPreviousBowler && styles.bowlerOptionNameDisabled,
                      ]}>
                        {bowler.name}
                      </Text>
                      {isPreviousBowler && (
                        <Text style={styles.previousBowlerLabel}>Last Over</Text>
                      )}
                    </View>
                    <Text style={[
                      styles.bowlerOptionStats,
                      isPreviousBowler && styles.bowlerOptionStatsDisabled,
                    ]}>
                      {bowler.runs}/{bowler.wickets} ({bowler.overs})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowChangeBowlerModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Over History Modal */}
      <Modal visible={showHistoryModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Over History</Text>
            <ScrollView style={styles.historyList} nestedScrollEnabled={true}>
              {overHistory.length === 0 ? (
                <Text style={styles.noHistoryText}>No completed overs yet</Text>
              ) : (
                overHistory.slice().reverse().map((over, index) => (
                  <View key={index} style={styles.historyItem}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyOverNumber}>Over {over.overNumber}</Text>
                      <Text style={styles.historyBowler}>{over.bowlerName}</Text>
                      <Text style={styles.historyStats}>
                        {over.runs}R, {over.wickets}W
                      </Text>
                    </View>
                    <View style={styles.historyBalls}>
                      {over.balls.map((ball, ballIndex) => (
                        <View
                          key={ballIndex}
                          style={[styles.historyBall, { backgroundColor: getBallColor(ball) }]}
                        >
                          <Text style={styles.historyBallText}>{ball}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowHistoryModal(false)}
            >
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* End Innings Modal */}
      <Modal visible={showEndInningsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {match.balls >= settings.overs * settings.ballsPerOver
                ? 'Innings Complete!'
                : match.wickets >= settings.playersPerTeam - 1
                  ? 'All Out!'
                  : 'End Innings?'}
            </Text>
            <Text style={styles.modalMessage}>
              {getBattingTeam()} scored {match.runs}/{match.wickets} in {getCurrentOver()} overs
            </Text>

            {/* Undo Last Ball button */}
            {undoHistory.length > 0 && (
              <TouchableOpacity
                style={{
                  backgroundColor: '#f59e0b',
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderRadius: 8,
                  marginBottom: 12,
                  alignItems: 'center',
                }}
                onPress={() => {
                  setShowEndInningsModal(false);
                  handleUndo();
                }}
              >
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Undo Last Ball</Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalActions}>
              {/* Only show Continue Playing if innings is NOT genuinely over */}
              {match.balls < settings.overs * settings.ballsPerOver &&
               match.wickets < settings.playersPerTeam - 1 && (
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowEndInningsModal(false);
                    setEndInningsPromptDismissed(true);
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Continue Playing</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={confirmEndInnings}
              >
                <Text style={styles.modalConfirmButtonText}>
                  {match.innings === 1 ? 'Start 2nd Innings' : 'End Match'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Match End Confirmation Modal (2nd Innings) */}
      <Modal visible={showMatchEndModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🏆 Match Complete!</Text>
            <Text style={styles.modalMessage}>
              {pendingMatchEnd?.result || 'Match has ended'}
            </Text>
            <Text style={[styles.modalMessage, { marginTop: 8, fontSize: 14 }]}>
              {getBattingTeam()}: {match.runs}/{match.wickets} ({getCurrentOver()} ov)
            </Text>

            {/* Undo Last Ball button */}
            {undoHistory.length > 0 && (
              <TouchableOpacity
                style={{
                  backgroundColor: '#f59e0b',
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderRadius: 8,
                  marginTop: 16,
                  marginBottom: 12,
                  alignItems: 'center',
                }}
                onPress={() => {
                  setShowMatchEndModal(false);
                  setPendingMatchEnd(null);
                  handleUndo();
                }}
              >
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Undo Last Ball</Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={confirmMatchEnd}
              >
                <Text style={styles.modalConfirmButtonText}>View Scorecard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Summary Modal (End of 1st Innings) */}
      <Modal visible={showSummaryModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.summaryModal}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryEmoji}>🎯</Text>
              <Text style={styles.summaryTitle}>1st Innings Complete</Text>
            </View>
            <View style={styles.summaryResult}>
              <Text style={styles.summaryTeam}>{getBattingTeam()}</Text>
              <Text style={styles.summaryScore}>{match.runs}/{match.wickets}</Text>
              <Text style={styles.summaryOvers}>({getCurrentOver()} overs)</Text>
            </View>
            <View style={styles.summaryStats}>
              <View style={styles.summaryStatRow}>
                <Text style={styles.summaryStatLabel}>Target</Text>
                <Text style={styles.summaryStatValue}>{match.runs + 1} runs</Text>
              </View>
              <View style={styles.summaryStatRow}>
                <Text style={styles.summaryStatLabel}>Extras</Text>
                <Text style={styles.summaryStatValue}>{extras.total}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={startSecondInnings}
            >
              <Text style={styles.continueButtonText}>Start 2nd Innings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Wide Ball Modal */}
      <Modal visible={showWideModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.extraBallModal}>
            {/* Header */}
            <View style={styles.extraBallHeader}>
              <View style={styles.extraBallIconContainer}>
                <Text style={styles.extraBallIcon}>WD</Text>
              </View>
              <Text style={styles.extraBallTitle}>Wide Ball</Text>
              <Text style={styles.extraBallSubtitle}>Select runs and options</Text>
            </View>

            {/* Content */}
            <View style={styles.extraBallContent}>
              {/* Wide Options */}
              <View style={styles.extraBallSection}>
                <Text style={styles.extraBallSectionTitle}>Runs</Text>
                <View style={styles.extraBallGrid}>
                  {[0, 1, 2, 3, 4].map((runs) => (
                    <TouchableOpacity
                      key={runs}
                      style={[
                        styles.extraBallOption,
                        wideNoBallRuns === runs && styles.extraBallOptionSelected,
                      ]}
                      onPress={() => setWideNoBallRuns(runs)}
                    >
                      <Text style={[
                        styles.extraBallOptionText,
                        wideNoBallRuns === runs && styles.extraBallOptionTextSelected,
                      ]}>
                        {runs === 0 ? 'WD' : `+${runs}`}
                      </Text>
                      <Text style={[
                        styles.extraBallOptionSubtext,
                        wideNoBallRuns === runs && styles.extraBallOptionSubtextSelected,
                      ]}>
                        {runs === 0 ? '1 run' : `${runs + 1} runs`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Run Out Section */}
              <View style={styles.extraBallSection}>
                <Text style={styles.extraBallSectionTitle}>Run Out (Optional)</Text>
                <TouchableOpacity
                  style={[
                    styles.runOutToggleButton,
                    wideNoBallRunOut && styles.runOutToggleButtonSelected,
                  ]}
                  onPress={() => {
                    setWideNoBallRunOut(!wideNoBallRunOut);
                    if (wideNoBallRunOut) {
                      setWideNoBallRunOutBatsman(null);
                    }
                  }}
                >
                  <View style={styles.runOutToggleLeft}>
                    <Text style={styles.runOutToggleIcon}>{wideNoBallRunOut ? '✓' : '○'}</Text>
                    <Text style={[
                      styles.runOutToggleLabel,
                      wideNoBallRunOut && styles.runOutToggleLabelSelected,
                    ]}>
                      Batsman Run Out
                    </Text>
                  </View>
                  <Text style={styles.runOutToggleHint}>
                    {wideNoBallRunOut ? 'Selected' : 'Tap to select'}
                  </Text>
                </TouchableOpacity>

                {/* Batsman Selection */}
                {wideNoBallRunOut && (
                  <View style={styles.batsmanSelectionContainer}>
                    <Text style={styles.batsmanSelectionTitle}>Who got out?</Text>
                    <View style={styles.batsmanCards}>
                      <TouchableOpacity
                        style={[
                          styles.batsmanCard,
                          wideNoBallRunOutBatsman === 'striker' && styles.batsmanCardSelected,
                        ]}
                        onPress={() => setWideNoBallRunOutBatsman('striker')}
                      >
                        <View style={[
                          styles.batsmanCardBadge,
                          wideNoBallRunOutBatsman === 'striker' && styles.batsmanCardBadgeSelected,
                        ]}>
                          <Text style={[
                            styles.batsmanCardBadgeText,
                            wideNoBallRunOutBatsman === 'striker' && styles.batsmanCardBadgeTextSelected,
                          ]}>S</Text>
                        </View>
                        <Text style={[
                          styles.batsmanCardName,
                          wideNoBallRunOutBatsman === 'striker' && styles.batsmanCardNameSelected,
                        ]}>
                          {striker.name}
                        </Text>
                        <Text style={styles.batsmanCardRole}>Striker</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.batsmanCard,
                          wideNoBallRunOutBatsman === 'nonStriker' && styles.batsmanCardSelected,
                        ]}
                        onPress={() => setWideNoBallRunOutBatsman('nonStriker')}
                      >
                        <View style={[
                          styles.batsmanCardBadge,
                          wideNoBallRunOutBatsman === 'nonStriker' && styles.batsmanCardBadgeSelected,
                        ]}>
                          <Text style={[
                            styles.batsmanCardBadgeText,
                            wideNoBallRunOutBatsman === 'nonStriker' && styles.batsmanCardBadgeTextSelected,
                          ]}>NS</Text>
                        </View>
                        <Text style={[
                          styles.batsmanCardName,
                          wideNoBallRunOutBatsman === 'nonStriker' && styles.batsmanCardNameSelected,
                        ]}>
                          {nonStriker.name}
                        </Text>
                        <Text style={styles.batsmanCardRole}>Non-Striker</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.extraBallActions}>
              <TouchableOpacity
                style={styles.extraBallCancelButton}
                onPress={() => {
                  resetWideNoBallModal();
                  setShowWideModal(false);
                }}
              >
                <Text style={styles.extraBallCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.extraBallConfirmButton,
                  wideNoBallRuns === null && styles.extraBallConfirmDisabled,
                ]}
                onPress={handleWideSubmit}
                disabled={wideNoBallRuns === null}
              >
                <Text style={styles.extraBallConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* No Ball Modal */}
      <Modal visible={showNoBallModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.extraBallModal}>
            {/* Header */}
            <View style={[styles.extraBallHeader, styles.noBallHeader]}>
              <View style={[styles.extraBallIconContainer, styles.noBallIconContainer]}>
                <Text style={styles.extraBallIcon}>NB</Text>
              </View>
              <Text style={styles.extraBallTitle}>No Ball</Text>
              <Text style={styles.extraBallSubtitle}>Select runs and options</Text>
            </View>

            {/* Content */}
            <View style={styles.extraBallContent}>
              {/* No Ball Options */}
              <View style={styles.extraBallSection}>
                <Text style={styles.extraBallSectionTitle}>Runs</Text>
                <View style={styles.extraBallGrid}>
                  {[0, 1, 2, 3, 4, 5, 6].map((runs) => (
                    <TouchableOpacity
                      key={runs}
                      style={[
                        styles.extraBallOption,
                        wideNoBallRuns === runs && styles.extraBallOptionSelected,
                      ]}
                      onPress={() => setWideNoBallRuns(runs)}
                    >
                      <Text style={[
                        styles.extraBallOptionText,
                        wideNoBallRuns === runs && styles.extraBallOptionTextSelected,
                      ]}>
                        {runs === 0 ? 'NB' : `+${runs}`}
                      </Text>
                      <Text style={[
                        styles.extraBallOptionSubtext,
                        wideNoBallRuns === runs && styles.extraBallOptionSubtextSelected,
                      ]}>
                        {runs === 0 ? '1 run' : `${runs + 1} runs`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Run Out Section */}
              <View style={styles.extraBallSection}>
                <Text style={styles.extraBallSectionTitle}>Run Out (Optional)</Text>
                <TouchableOpacity
                  style={[
                    styles.runOutToggleButton,
                    wideNoBallRunOut && styles.runOutToggleButtonSelected,
                  ]}
                  onPress={() => {
                    setWideNoBallRunOut(!wideNoBallRunOut);
                    if (wideNoBallRunOut) {
                      setWideNoBallRunOutBatsman(null);
                    }
                  }}
                >
                  <View style={styles.runOutToggleLeft}>
                    <Text style={styles.runOutToggleIcon}>{wideNoBallRunOut ? '✓' : '○'}</Text>
                    <Text style={[
                      styles.runOutToggleLabel,
                      wideNoBallRunOut && styles.runOutToggleLabelSelected,
                    ]}>
                      Batsman Run Out
                    </Text>
                  </View>
                  <Text style={styles.runOutToggleHint}>
                    {wideNoBallRunOut ? 'Selected' : 'Tap to select'}
                  </Text>
                </TouchableOpacity>

                {/* Batsman Selection */}
                {wideNoBallRunOut && (
                  <View style={styles.batsmanSelectionContainer}>
                    <Text style={styles.batsmanSelectionTitle}>Who got out?</Text>
                    <View style={styles.batsmanCards}>
                      <TouchableOpacity
                        style={[
                          styles.batsmanCard,
                          wideNoBallRunOutBatsman === 'striker' && styles.batsmanCardSelected,
                        ]}
                        onPress={() => setWideNoBallRunOutBatsman('striker')}
                      >
                        <View style={[
                          styles.batsmanCardBadge,
                          wideNoBallRunOutBatsman === 'striker' && styles.batsmanCardBadgeSelected,
                        ]}>
                          <Text style={[
                            styles.batsmanCardBadgeText,
                            wideNoBallRunOutBatsman === 'striker' && styles.batsmanCardBadgeTextSelected,
                          ]}>S</Text>
                        </View>
                        <Text style={[
                          styles.batsmanCardName,
                          wideNoBallRunOutBatsman === 'striker' && styles.batsmanCardNameSelected,
                        ]}>
                          {striker.name}
                        </Text>
                        <Text style={styles.batsmanCardRole}>Striker</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.batsmanCard,
                          wideNoBallRunOutBatsman === 'nonStriker' && styles.batsmanCardSelected,
                        ]}
                        onPress={() => setWideNoBallRunOutBatsman('nonStriker')}
                      >
                        <View style={[
                          styles.batsmanCardBadge,
                          wideNoBallRunOutBatsman === 'nonStriker' && styles.batsmanCardBadgeSelected,
                        ]}>
                          <Text style={[
                            styles.batsmanCardBadgeText,
                            wideNoBallRunOutBatsman === 'nonStriker' && styles.batsmanCardBadgeTextSelected,
                          ]}>NS</Text>
                        </View>
                        <Text style={[
                          styles.batsmanCardName,
                          wideNoBallRunOutBatsman === 'nonStriker' && styles.batsmanCardNameSelected,
                        ]}>
                          {nonStriker.name}
                        </Text>
                        <Text style={styles.batsmanCardRole}>Non-Striker</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.extraBallActions}>
              <TouchableOpacity
                style={styles.extraBallCancelButton}
                onPress={() => {
                  resetWideNoBallModal();
                  setShowNoBallModal(false);
                }}
              >
                <Text style={styles.extraBallCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.extraBallConfirmButton,
                  wideNoBallRuns === null && styles.extraBallConfirmDisabled,
                ]}
                onPress={handleNoBallSubmit}
                disabled={wideNoBallRuns === null}
              >
                <Text style={styles.extraBallConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bye (Leg Bye) Modal */}
      <Modal visible={showByeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.extraBallModal}>
            {/* Header */}
            <View style={styles.byeModalHeader}>
              <View style={styles.byeModalIconContainer}>
                <Text style={styles.extraBallIcon}>LB</Text>
              </View>
              <Text style={styles.extraBallTitle}>Leg Bye</Text>
              <Text style={styles.extraBallSubtitle}>Runs for team only (not batsman)</Text>
            </View>

            {/* Content */}
            <View style={styles.extraBallContent}>
              {/* Bye Options */}
              <View style={styles.extraBallSection}>
                <Text style={styles.extraBallSectionTitle}>Leg Bye Runs</Text>
                <View style={styles.extraBallGrid}>
                  {[1, 2, 3, 4].map((runs) => (
                    <TouchableOpacity
                      key={runs}
                      style={[
                        styles.extraBallOption,
                        byeRuns === runs && styles.extraBallOptionSelected,
                      ]}
                      onPress={() => setByeRuns(runs)}
                    >
                      <Text style={[
                        styles.extraBallOptionText,
                        byeRuns === runs && styles.extraBallOptionTextSelected,
                      ]}>
                        {runs}
                      </Text>
                      <Text style={[
                        styles.extraBallOptionSubtext,
                        byeRuns === runs && styles.extraBallOptionSubtextSelected,
                      ]}>
                        {runs === 1 ? 'run' : 'runs'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Run Out Section */}
              <View style={styles.extraBallSection}>
                <Text style={styles.extraBallSectionTitle}>Run Out (Optional)</Text>
                <TouchableOpacity
                  style={[
                    styles.runOutToggleButton,
                    byeRunOut && styles.runOutToggleButtonSelected,
                  ]}
                  onPress={() => {
                    setByeRunOut(!byeRunOut);
                    if (byeRunOut) {
                      setByeRunOutBatsman(null);
                    }
                  }}
                >
                  <View style={styles.runOutToggleLeft}>
                    <Text style={styles.runOutToggleIcon}>{byeRunOut ? '✓' : '○'}</Text>
                    <Text style={[
                      styles.runOutToggleLabel,
                      byeRunOut && styles.runOutToggleLabelSelected,
                    ]}>
                      Batsman Run Out
                    </Text>
                  </View>
                  <Text style={styles.runOutToggleHint}>
                    {byeRunOut ? 'Selected' : 'Tap to select'}
                  </Text>
                </TouchableOpacity>

                {/* Batsman Selection */}
                {byeRunOut && (
                  <View style={styles.batsmanSelectionContainer}>
                    <Text style={styles.batsmanSelectionTitle}>Who got out?</Text>
                    <View style={styles.batsmanCards}>
                      <TouchableOpacity
                        style={[
                          styles.batsmanCard,
                          byeRunOutBatsman === 'striker' && styles.batsmanCardSelected,
                        ]}
                        onPress={() => setByeRunOutBatsman('striker')}
                      >
                        <View style={[
                          styles.batsmanCardBadge,
                          byeRunOutBatsman === 'striker' && styles.batsmanCardBadgeSelected,
                        ]}>
                          <Text style={[
                            styles.batsmanCardBadgeText,
                            byeRunOutBatsman === 'striker' && styles.batsmanCardBadgeTextSelected,
                          ]}>S</Text>
                        </View>
                        <Text style={[
                          styles.batsmanCardName,
                          byeRunOutBatsman === 'striker' && styles.batsmanCardNameSelected,
                        ]}>
                          {striker.name}
                        </Text>
                        <Text style={styles.batsmanCardRole}>Striker</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.batsmanCard,
                          byeRunOutBatsman === 'nonStriker' && styles.batsmanCardSelected,
                        ]}
                        onPress={() => setByeRunOutBatsman('nonStriker')}
                      >
                        <View style={[
                          styles.batsmanCardBadge,
                          byeRunOutBatsman === 'nonStriker' && styles.batsmanCardBadgeSelected,
                        ]}>
                          <Text style={[
                            styles.batsmanCardBadgeText,
                            byeRunOutBatsman === 'nonStriker' && styles.batsmanCardBadgeTextSelected,
                          ]}>NS</Text>
                        </View>
                        <Text style={[
                          styles.batsmanCardName,
                          byeRunOutBatsman === 'nonStriker' && styles.batsmanCardNameSelected,
                        ]}>
                          {nonStriker.name}
                        </Text>
                        <Text style={styles.batsmanCardRole}>Non-Striker</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.extraBallActions}>
              <TouchableOpacity
                style={styles.extraBallCancelButton}
                onPress={() => {
                  resetByeModal();
                  setShowByeModal(false);
                }}
              >
                <Text style={styles.extraBallCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.extraBallConfirmButton,
                  styles.byeConfirmButton,
                  byeRuns === null && styles.extraBallConfirmDisabled,
                ]}
                onPress={handleByeSubmit}
                disabled={byeRuns === null}
              >
                <Text style={styles.extraBallConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* More Runs (5, 7, etc.) Modal */}
      <Modal visible={showMoreRunsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.extraBallModal}>
            {/* Header */}
            <View style={styles.moreRunsModalHeader}>
              <View style={styles.moreRunsModalIconContainer}>
                <Text style={styles.moreRunsIcon}>+</Text>
              </View>
              <Text style={styles.extraBallTitle}>More Runs</Text>
              <Text style={styles.extraBallSubtitle}>Overthrows & additional runs</Text>
            </View>

            {/* Content */}
            <View style={styles.extraBallContent}>
              {/* Runs Options */}
              <View style={styles.extraBallSection}>
                <Text style={styles.extraBallSectionTitle}>Select Runs</Text>
                <View style={styles.extraBallGrid}>
                  {[5, 7, 8, 9, 10].map((runs) => (
                    <TouchableOpacity
                      key={runs}
                      style={[
                        styles.extraBallOption,
                        moreRuns === runs && styles.extraBallOptionSelected,
                      ]}
                      onPress={() => setMoreRuns(runs)}
                    >
                      <Text style={[
                        styles.extraBallOptionText,
                        moreRuns === runs && styles.extraBallOptionTextSelected,
                      ]}>
                        {runs}
                      </Text>
                      <Text style={[
                        styles.extraBallOptionSubtext,
                        moreRuns === runs && styles.extraBallOptionSubtextSelected,
                      ]}>
                        runs
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Info */}
              <View style={styles.moreRunsInfo}>
                <Text style={styles.moreRunsInfoText}>
                  These runs will be added to:
                </Text>
                <View style={styles.moreRunsInfoList}>
                  <Text style={styles.moreRunsInfoItem}>• Team total</Text>
                  <Text style={styles.moreRunsInfoItem}>• Batsman's score</Text>
                  <Text style={styles.moreRunsInfoItem}>• Bowler's spell</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.extraBallActions}>
              <TouchableOpacity
                style={styles.extraBallCancelButton}
                onPress={() => {
                  setMoreRuns(null);
                  setShowMoreRunsModal(false);
                }}
              >
                <Text style={styles.extraBallCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.extraBallConfirmButton,
                  moreRuns === null && styles.extraBallConfirmDisabled,
                ]}
                onPress={handleMoreRunsSubmit}
                disabled={moreRuns === null}
              >
                <Text style={styles.extraBallConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Retire Modal */}
      <Modal visible={showRetireModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.extraBallModal}>
            {/* Header */}
            <View style={styles.retireModalHeader}>
              <View style={styles.retireModalIconContainer}>
                {/* Retire Icon - Person walking out */}
                <View style={styles.retireIconShape}>
                  <View style={styles.retireIconHead} />
                  <View style={styles.retireIconBody} />
                  <View style={styles.retireIconArrow}>
                    <View style={styles.retireIconArrowLine} />
                    <View style={styles.retireIconArrowHead} />
                  </View>
                </View>
              </View>
              <Text style={styles.extraBallTitle}>Retire Batsman</Text>
              <Text style={styles.extraBallSubtitle}>Select retire type and batsman</Text>
            </View>

            {/* Content */}
            <View style={styles.extraBallContent}>
              {/* Retire Type Selection */}
              <View style={styles.extraBallSection}>
                <Text style={styles.extraBallSectionTitle}>Retire Type</Text>
                <View style={styles.retireTypeGrid}>
                  <TouchableOpacity
                    style={[
                      styles.retireTypeOption,
                      retireType === 'retired' && styles.retireTypeOptionSelected,
                    ]}
                    onPress={() => setRetireType('retired')}
                  >
                    <View style={[
                      styles.retireTypeIconContainer,
                      retireType === 'retired' && styles.retireTypeIconContainerSelected,
                    ]}>
                      {/* Refresh/Return Icon */}
                      <View style={[
                        styles.refreshIcon,
                        retireType === 'retired' && styles.refreshIconSelected,
                      ]}>
                        <View style={[
                          styles.refreshIconCircle,
                          retireType === 'retired' && styles.refreshIconCircleSelected,
                        ]} />
                        <View style={[
                          styles.refreshIconArrow,
                          retireType === 'retired' && styles.refreshIconArrowSelected,
                        ]} />
                      </View>
                    </View>
                    <Text style={[
                      styles.retireTypeText,
                      retireType === 'retired' && styles.retireTypeTextSelected,
                    ]}>
                      Retired
                    </Text>
                    <Text style={[
                      styles.retireTypeSubtext,
                      retireType === 'retired' && styles.retireTypeSubtextSelected,
                    ]}>
                      Can bat again
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.retireTypeOption,
                      retireType === 'retiredOut' && styles.retireTypeOptionSelectedOut,
                    ]}
                    onPress={() => setRetireType('retiredOut')}
                  >
                    <View style={[
                      styles.retireTypeIconContainer,
                      retireType === 'retiredOut' && styles.retireTypeIconContainerSelectedOut,
                    ]}>
                      {/* X Icon for Out */}
                      <View style={styles.xIconContainer}>
                        <View style={[
                          styles.xIconLine1,
                          retireType === 'retiredOut' && styles.xIconLineSelected,
                        ]} />
                        <View style={[
                          styles.xIconLine2,
                          retireType === 'retiredOut' && styles.xIconLineSelected,
                        ]} />
                      </View>
                    </View>
                    <Text style={[
                      styles.retireTypeText,
                      retireType === 'retiredOut' && styles.retireTypeTextSelectedOut,
                    ]}>
                      Retired Out
                    </Text>
                    <Text style={[
                      styles.retireTypeSubtext,
                      retireType === 'retiredOut' && styles.retireTypeSubtextSelectedOut,
                    ]}>
                      Counts as wicket
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Batsman Selection */}
              <View style={styles.extraBallSection}>
                <Text style={styles.extraBallSectionTitle}>Select Batsman</Text>
                <View style={styles.retireBatsmanGrid}>
                  <TouchableOpacity
                    style={[
                      styles.retireBatsmanCard,
                      retireBatsman === 'striker' && styles.retireBatsmanCardSelected,
                    ]}
                    onPress={() => setRetireBatsman('striker')}
                  >
                    {/* Batsman Icon */}
                    <View style={[
                      styles.retireBatsmanIconWrapper,
                      retireBatsman === 'striker' && styles.retireBatsmanIconWrapperSelected,
                    ]}>
                      <View style={styles.batsmanIconContainer}>
                        <View style={[
                          styles.batsmanIconHead,
                          retireBatsman === 'striker' && styles.batsmanIconSelected,
                        ]} />
                        <View style={[
                          styles.batsmanIconBody,
                          retireBatsman === 'striker' && styles.batsmanIconSelected,
                        ]} />
                        <View style={[
                          styles.batsmanIconBat,
                          retireBatsman === 'striker' && styles.batsmanIconBatSelected,
                        ]} />
                      </View>
                      {/* Striker indicator star */}
                      <View style={[
                        styles.strikerBadge,
                        retireBatsman === 'striker' && styles.strikerBadgeSelected,
                      ]}>
                        <Text style={[
                          styles.strikerBadgeText,
                          retireBatsman === 'striker' && styles.strikerBadgeTextSelected,
                        ]}>★</Text>
                      </View>
                    </View>
                    <View style={styles.retireBatsmanDetails}>
                      <Text style={[
                        styles.retireBatsmanName,
                        retireBatsman === 'striker' && styles.retireBatsmanNameSelected,
                      ]}>{striker.name}</Text>
                      <View style={styles.retireBatsmanStatsRow}>
                        <Text style={[
                          styles.retireBatsmanRuns,
                          retireBatsman === 'striker' && styles.retireBatsmanRunsSelected,
                        ]}>{striker.runs}</Text>
                        <Text style={[
                          styles.retireBatsmanBalls,
                          retireBatsman === 'striker' && styles.retireBatsmanBallsSelected,
                        ]}>({striker.balls})</Text>
                      </View>
                      <View style={[
                        styles.retireStrikerLabel,
                        retireBatsman === 'striker' && styles.retireStrikerLabelSelected,
                      ]}>
                        <Text style={[
                          styles.retireStrikerLabelText,
                          retireBatsman === 'striker' && styles.retireStrikerLabelTextSelected,
                        ]}>STRIKER</Text>
                      </View>
                    </View>
                    {/* Selection checkmark */}
                    {retireBatsman === 'striker' && (
                      <View style={styles.selectionCheck}>
                        <Text style={styles.selectionCheckText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.retireBatsmanCard,
                      retireBatsman === 'nonStriker' && styles.retireBatsmanCardSelected,
                    ]}
                    onPress={() => setRetireBatsman('nonStriker')}
                  >
                    {/* Batsman Icon */}
                    <View style={[
                      styles.retireBatsmanIconWrapper,
                      retireBatsman === 'nonStriker' && styles.retireBatsmanIconWrapperSelected,
                    ]}>
                      <View style={styles.batsmanIconContainer}>
                        <View style={[
                          styles.batsmanIconHead,
                          retireBatsman === 'nonStriker' && styles.batsmanIconSelected,
                        ]} />
                        <View style={[
                          styles.batsmanIconBody,
                          retireBatsman === 'nonStriker' && styles.batsmanIconSelected,
                        ]} />
                        <View style={[
                          styles.batsmanIconBat,
                          retireBatsman === 'nonStriker' && styles.batsmanIconBatSelected,
                        ]} />
                      </View>
                    </View>
                    <View style={styles.retireBatsmanDetails}>
                      <Text style={[
                        styles.retireBatsmanName,
                        retireBatsman === 'nonStriker' && styles.retireBatsmanNameSelected,
                      ]}>{nonStriker.name}</Text>
                      <View style={styles.retireBatsmanStatsRow}>
                        <Text style={[
                          styles.retireBatsmanRuns,
                          retireBatsman === 'nonStriker' && styles.retireBatsmanRunsSelected,
                        ]}>{nonStriker.runs}</Text>
                        <Text style={[
                          styles.retireBatsmanBalls,
                          retireBatsman === 'nonStriker' && styles.retireBatsmanBallsSelected,
                        ]}>({nonStriker.balls})</Text>
                      </View>
                      <View style={styles.nonStrikerLabel}>
                        <Text style={[
                          styles.nonStrikerLabelText,
                          retireBatsman === 'nonStriker' && styles.nonStrikerLabelTextSelected,
                        ]}>NON-STRIKER</Text>
                      </View>
                    </View>
                    {/* Selection checkmark */}
                    {retireBatsman === 'nonStriker' && (
                      <View style={styles.selectionCheck}>
                        <Text style={styles.selectionCheckText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Info */}
              <View style={styles.retireInfo}>
                {retireType === 'retired' ? (
                  <>
                    <Text style={styles.retireInfoTitle}>Retired (Not Out)</Text>
                    <Text style={styles.retireInfoText}>
                      • Not counted as wicket{'\n'}
                      • Batsman can return when all others are out
                    </Text>
                  </>
                ) : retireType === 'retiredOut' ? (
                  <>
                    <Text style={styles.retireInfoTitleOut}>Retired Out</Text>
                    <Text style={styles.retireInfoText}>
                      • Counted as wicket{'\n'}
                      • Batsman cannot bat again
                    </Text>
                  </>
                ) : (
                  <Text style={styles.retireInfoText}>
                    Select retire type and batsman to continue
                  </Text>
                )}
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.extraBallActions}>
              <TouchableOpacity
                style={styles.extraBallCancelButton}
                onPress={() => {
                  resetRetireModal();
                  setShowRetireModal(false);
                }}
              >
                <Text style={styles.extraBallCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.retireConfirmButton,
                  (!retireType || !retireBatsman) && styles.extraBallConfirmDisabled,
                  retireType === 'retiredOut' && styles.retireConfirmButtonOut,
                ]}
                onPress={handleRetireSubmit}
                disabled={!retireType || !retireBatsman}
              >
                <Text style={styles.extraBallConfirmText}>
                  {retireType === 'retiredOut' ? 'Retire Out' : 'Retire'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettingsModal} transparent animationType="slide">
        <View style={styles.settingsModalOverlay}>
          <View style={styles.settingsModalContainer}>
            {/* Settings Header */}
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>Match Settings</Text>
              <TouchableOpacity
                style={styles.settingsCloseButton}
                onPress={() => setShowSettingsModal(false)}
              >
                <Text style={styles.settingsCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.settingsScrollView}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              {/* Extra Ball Settings */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Extra Ball Runs</Text>

                {/* Wide Runs */}
                <View style={styles.settingsRow}>
                  <Text style={styles.settingsLabel}>Wide Ball Runs</Text>
                  <View style={styles.settingsValueControl}>
                    <TouchableOpacity
                      style={styles.settingsValueButton}
                      onPress={() => setSettings(prev => ({
                        ...prev,
                        wideRuns: Math.max(1, prev.wideRuns - 1)
                      }))}
                    >
                      <Text style={styles.settingsValueButtonText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.settingsValue}>{settings.wideRuns}</Text>
                    <TouchableOpacity
                      style={styles.settingsValueButton}
                      onPress={() => setSettings(prev => ({
                        ...prev,
                        wideRuns: Math.min(5, prev.wideRuns + 1)
                      }))}
                    >
                      <Text style={styles.settingsValueButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* No Ball Runs */}
                <View style={styles.settingsRow}>
                  <Text style={styles.settingsLabel}>No Ball Runs</Text>
                  <View style={styles.settingsValueControl}>
                    <TouchableOpacity
                      style={styles.settingsValueButton}
                      onPress={() => setSettings(prev => ({
                        ...prev,
                        noBallRuns: Math.max(1, prev.noBallRuns - 1)
                      }))}
                    >
                      <Text style={styles.settingsValueButtonText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.settingsValue}>{settings.noBallRuns}</Text>
                    <TouchableOpacity
                      style={styles.settingsValueButton}
                      onPress={() => setSettings(prev => ({
                        ...prev,
                        noBallRuns: Math.min(5, prev.noBallRuns + 1)
                      }))}
                    >
                      <Text style={styles.settingsValueButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Team A Players */}
              <View style={styles.settingsSection}>
                <View style={styles.settingsSectionTitleRow}>
                  <Text style={styles.settingsSectionTitle}>{teams.teamA.name} Players</Text>
                  <Text style={styles.settingsSectionSubtitle}>(Batting Order: 1→{settings.playersPerTeam})</Text>
                </View>
                {teams.teamA.playerNames.map((playerName, index) => (
                  <View key={`teamA-${index}`} style={[styles.playerNameRow, { zIndex: 1000 - index }]}>
                    <View style={styles.playerNumberBadge}>
                      <Text style={styles.playerNumberText}>{index + 1}</Text>
                    </View>
                    <AutocompleteInput
                      value={playerName}
                      onChangeText={(text) => {
                        setTeams(prev => ({
                          ...prev,
                          teamA: {
                            ...prev.teamA,
                            playerNames: prev.teamA.playerNames.map((name, i) =>
                              i === index ? text : name
                            )
                          }
                        }));
                      }}
                      type="player"
                      placeholder={`Player ${index + 1}`}
                      inputStyle={styles.playerNameInput}
                      style={styles.playerNameInputWrapper}
                      selectTextOnFocus={true}
                      returnKeyType="done"
                    />
                  </View>
                ))}
              </View>

              {/* Team B Players */}
              <View style={styles.settingsSection}>
                <View style={styles.settingsSectionTitleRow}>
                  <Text style={styles.settingsSectionTitle}>{teams.teamB.name} Players</Text>
                  <Text style={styles.settingsSectionSubtitle}>(Bowling Order: {settings.playersPerTeam}→1)</Text>
                </View>
                {teams.teamB.playerNames.map((playerName, index) => (
                  <View key={`teamB-${index}`} style={[styles.playerNameRow, { zIndex: 1000 - index }]}>
                    <View style={styles.playerNumberBadge}>
                      <Text style={styles.playerNumberText}>{index + 1}</Text>
                    </View>
                    <AutocompleteInput
                      value={playerName}
                      onChangeText={(text) => {
                        setTeams(prev => ({
                          ...prev,
                          teamB: {
                            ...prev.teamB,
                            playerNames: prev.teamB.playerNames.map((name, i) =>
                              i === index ? text : name
                            )
                          }
                        }));
                      }}
                      type="player"
                      placeholder={`Player ${index + 1}`}
                      inputStyle={styles.playerNameInput}
                      style={styles.playerNameInputWrapper}
                      selectTextOnFocus={true}
                      returnKeyType="done"
                    />
                  </View>
                ))}
              </View>

              {/* Apply Button */}
              <TouchableOpacity
                style={styles.settingsApplyButton}
                onPress={() => {
                  // Update batsmen and bowlers with new names
                  const battingTeamKey = getBattingTeamKey();
                  const bowlingTeamKey = getBowlingTeamKey();

                  const battingPlayerNames = teams[battingTeamKey].playerNames;
                  const bowlingPlayerNames = teams[bowlingTeamKey].playerNames;

                  // Update batsmen names (order 1 to last)
                  setAllBatsmen(prev => prev.map((batsman, index) => ({
                    ...batsman,
                    name: battingPlayerNames[index] || batsman.name
                  })));

                  // Update current batsmen
                  setCurrentBatsmen(prev => ({
                    striker: {
                      ...prev.striker,
                      name: battingPlayerNames[prev.striker.id - 1] || prev.striker.name
                    },
                    nonStriker: {
                      ...prev.nonStriker,
                      name: battingPlayerNames[prev.nonStriker.id - 1] || prev.nonStriker.name
                    }
                  }));

                  // Update bowlers names (order last to 1 - reversed)
                  setAllBowlers(prev => prev.map((bowler, index) => ({
                    ...bowler,
                    name: bowlingPlayerNames[settings.playersPerTeam - 1 - index] || bowler.name
                  })));

                  // Update current bowler
                  setCurrentBowler(prev => {
                    const bowlerIndex = settings.playersPerTeam - prev.id;
                    return {
                      ...prev,
                      name: bowlingPlayerNames[bowlerIndex] || prev.name
                    };
                  });

                  setShowSettingsModal(false);
                }}
              >
                <Text style={styles.settingsApplyButtonText}>Apply Changes</Text>
              </TouchableOpacity>

              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cardBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
    backgroundColor: colors.cardBg,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: responsiveFontSize.xl,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  logoContainer: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 20,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.sm,
    paddingBottom: responsiveSpacing.sm,
  },
  topSection: {
    // Contains score and batsmen info
  },
  inningsBadge: {
    alignSelf: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: responsiveSpacing.lg,
  },
  inningsBadgeText: {
    color: colors.primary,
    fontSize: responsiveFontSize.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
  },
  teamsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: responsiveSpacing.sm,
  },
  battingTeam: {
    fontSize: responsiveFontSize.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  battingTeamInput: {
    fontSize: responsiveFontSize.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    padding: 0,
    margin: 0,
    textAlign: 'center',
    backgroundColor: 'transparent',
  },
  vsText: {
    fontSize: responsiveFontSize.sm,
    color: colors.textMuted,
    marginHorizontal: responsiveSpacing.sm,
  },
  bowlingTeam: {
    fontSize: responsiveFontSize.sm,
    color: colors.textSecondary,
  },
  bowlingTeamInput: {
    fontSize: responsiveFontSize.sm,
    color: colors.textSecondary,
    padding: 0,
    margin: 0,
    textAlign: 'center',
    backgroundColor: 'transparent',
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: responsiveSpacing.xs,
  },
  scoreText: {
    fontSize: responsiveFontSize.score,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  oversText: {
    fontSize: responsiveFontSize.md,
    color: colors.textSecondary,
    marginLeft: responsiveSpacing.sm,
  },
  runRateText: {
    textAlign: 'center',
    fontSize: responsiveFontSize.sm,
    color: colors.textSecondary,
    marginBottom: responsiveSpacing.lg,
  },
  targetInfo: {
    backgroundColor: colors.primaryLight,
    padding: responsiveSpacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: responsiveSpacing.sm,
  },
  targetText: {
    textAlign: 'center',
    fontSize: responsiveFontSize.sm,
    fontWeight: fontWeights.semibold,
    color: colors.error,
  },
  batsmenContainer: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.sm,
    position: 'relative',
  },
  // Swap Animation Styles
  swapIconContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  swapIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  swapArrowsContainer: {
    width: 24,
    height: 16,
    justifyContent: 'space-between',
  },
  swapArrowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
  },
  swapArrowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  swapArrowLine: {
    width: 14,
    height: 2,
    backgroundColor: colors.surface,
    borderRadius: 1,
  },
  swapArrowHead: {
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderRightWidth: 5,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: colors.surface,
    marginRight: -1,
  },
  swapArrowHeadRight: {
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderLeftWidth: 5,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.surface,
    marginLeft: -1,
  },
  batsmanCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: responsiveSpacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    position: 'relative',
  },
  strikerCard: {
    borderColor: colors.primary,
    ...shadows.sm,
  },
  strikerLabel: {
    position: 'absolute',
    top: -8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  strikerLabelInner: {
    backgroundColor: colors.primary,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  strikerLabelText: {
    color: colors.surface,
    fontSize: responsiveFontSize.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
  },
  playerName: {
    fontSize: responsiveFontSize.sm,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: responsiveSpacing.xs,
    paddingVertical: responsiveSpacing.xs,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
  },
  playerNameWrapper: {
    zIndex: 1000,
  },
  batsmanStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
  },
  runsText: {
    fontSize: responsiveFontSize.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  ballsText: {
    fontSize: responsiveFontSize.sm,
    color: colors.textSecondary,
    marginLeft: responsiveSpacing.xs,
  },
  // Bowler & This Over Card
  bowlerOverCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: responsiveSpacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bowlerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bowlerNameContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  bowlerName: {
    fontSize: responsiveFontSize.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    paddingVertical: responsiveSpacing.sm,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
  },
  bowlerNameWrapper: {
    flex: 1,
    zIndex: 1000,
  },
  bowlerSpellContainer: {
    flex: 1,
    alignItems: 'center',
  },
  bowlerChangeContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  bowlerSpellLabel: {
    fontSize: responsiveFontSize.sm,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  bowlerSpell: {
    fontSize: responsiveFontSize.md,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  changeBowlerButton: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
  },
  changeBowlerButtonText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  bowlerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: responsiveSpacing.md,
  },
  thisOverSection: {
    alignItems: 'center',
  },
  thisOverTitle: {
    fontSize: responsiveFontSize.sm,
    fontWeight: fontWeights.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: responsiveSpacing.sm,
  },
  ballsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  viewHistoryButton: {
    marginTop: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  viewHistoryButtonText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: fontWeights.medium,
    color: colors.textSecondary,
  },
  ball: {
    width: responsiveSize.ballSize,
    height: responsiveSize.ballSize,
    borderRadius: responsiveSize.ballSize / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ballText: {
    color: colors.surface,
    fontSize: responsiveFontSize.xs,
    fontWeight: fontWeights.bold,
  },
  ballTextPlain: {
    fontSize: responsiveFontSize.xs,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    marginHorizontal: responsiveSpacing.xs,
    height: responsiveSize.ballSize,
    lineHeight: responsiveSize.ballSize,
    textAlignVertical: 'center',
  },
  emptyBall: {
    backgroundColor: colors.border,
  },
  emptyBallText: {
    color: colors.textMuted,
    fontSize: fontSizes.lg,
  },
  scoringContainer: {
    backgroundColor: colors.cardBg,
    paddingHorizontal: isSmallScreen ? 8 : 12,
    paddingTop: isSmallScreen ? 6 : 10,
    paddingBottom: Platform.OS === 'ios' ? (isSmallScreen ? 20 : 30) : (isSmallScreen ? 8 : 12),
    gap: isSmallScreen ? 5 : 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // End Innings Button (full width)
  endInningsButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: isSmallScreen ? 12 : 16,
    alignItems: 'center',
    ...shadows.sm,
  },
  endInningsText: {
    fontSize: isSmallScreen ? fontSizes.md : fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  // Line 2: Retire & Change Striker
  actionButtonsRow: {
    flexDirection: 'row',
    gap: isSmallScreen ? 5 : 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: isSmallScreen ? 12 : 16,
    alignItems: 'center',
    ...shadows.sm,
  },
  actionButtonText: {
    fontSize: isSmallScreen ? fontSizes.sm : fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  // Grid button rows
  buttonRow: {
    flexDirection: 'row',
    gap: isSmallScreen ? 5 : 8,
  },
  gridButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: isSmallScreen ? 12 : 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  gridButtonText: {
    fontSize: responsiveFontSize.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  wideButton: {
    backgroundColor: '#fbbf24',
  },
  wideButtonText: {
    color: '#78350f',
  },
  noballButton: {
    backgroundColor: '#fbbf24',
  },
  noballButtonText: {
    color: '#78350f',
  },
  byeButton: {
    backgroundColor: '#8b5cf6',
  },
  byeButtonText: {
    color: colors.surface,
  },
  undoButton: {
    backgroundColor: '#1e293b',
  },
  undoButtonText: {
    color: colors.surface,
  },
  outButton: {
    backgroundColor: colors.error,
  },
  outButtonText: {
    color: colors.surface,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  modalOption: {
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalOptionText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  modalOptionTextSelected: {
    color: colors.surface,
  },
  modalCancel: {
    marginTop: spacing.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textSecondary,
  },
  modalMessage: {
    fontSize: fontSizes.lg,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textSecondary,
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: colors.error,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.surface,
  },

  // Run out section
  runOutSection: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.md,
  },
  subTitle: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  runOutButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  runOutButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  runOutButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  runOutButtonText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
  },
  runOutRunsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  runOutRunButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  runOutRunButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  runOutRunButtonText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  confirmButtonText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.surface,
  },

  // Extras modal
  extrasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  extraOption: {
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minWidth: (width - 120) / 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  extraOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  extraEmoji: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  extraOptionText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  extraOptionTextSelected: {
    color: colors.surface,
  },
  extraRunsSection: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.md,
  },
  extraRunsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  extraRunButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  extraRunButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  extraRunButtonText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },

  // Change bowler modal
  bowlerList: {
    maxHeight: 300,
  },
  bowlerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bowlerOptionCurrent: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  bowlerOptionName: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  bowlerOptionStats: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  bowlerOptionDisabled: {
    backgroundColor: colors.surfaceGray,
    borderColor: colors.border,
    opacity: 0.5,
  },
  bowlerOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bowlerOptionNameDisabled: {
    color: colors.textMuted,
  },
  bowlerOptionStatsDisabled: {
    color: colors.textMuted,
  },
  previousBowlerLabel: {
    fontSize: fontSizes.xs,
    color: colors.error,
    fontWeight: fontWeights.medium,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  bowlerModalHint: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },

  // History modal
  historyList: {
    maxHeight: 400,
  },
  noHistoryText: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.xl,
  },
  historyItem: {
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  historyOverNumber: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  historyBowler: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  historyStats: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  historyBalls: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  historyBall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyBallText: {
    color: colors.surface,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },

  // Summary modal
  summaryModal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 400,
  },
  summaryHeader: {
    backgroundColor: colors.primaryLight,
    padding: spacing.lg,
    alignItems: 'center',
  },
  summaryEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  summaryTitle: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  summaryResult: {
    padding: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  summaryTeam: {
    fontSize: fontSizes.lg,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: spacing.xs,
  },
  summaryScore: {
    fontSize: 48,
    fontWeight: fontWeights.bold,
    color: colors.surface,
  },
  summaryOvers: {
    fontSize: fontSizes.md,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: spacing.xs,
  },
  summaryStats: {
    padding: spacing.lg,
  },
  summaryStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryStatLabel: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
  },
  summaryStatValue: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  continueButton: {
    backgroundColor: colors.primary,
    margin: spacing.lg,
    marginTop: 0,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.surface,
  },

  // Wide/No Ball Modal Styles - Modern Professional Design
  extraBallModal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 400,
  },
  extraBallHeader: {
    backgroundColor: '#fbbf24',
    padding: spacing.lg,
    alignItems: 'center',
  },
  noBallHeader: {
    backgroundColor: '#ef4444',
  },
  extraBallIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  noBallIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  extraBallIcon: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.extrabold,
    color: colors.surface,
  },
  extraBallTitle: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.surface,
  },
  extraBallSubtitle: {
    fontSize: fontSizes.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  extraBallContent: {
    padding: spacing.lg,
  },
  extraBallSection: {
    marginBottom: spacing.lg,
  },
  extraBallSectionTitle: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  extraBallGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  extraBallOption: {
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minWidth: 60,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  extraBallOptionSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  extraBallOptionText: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  extraBallOptionTextSelected: {
    color: colors.primary,
  },
  extraBallOptionSubtext: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  extraBallOptionSubtextSelected: {
    color: colors.primary,
  },
  runOutToggleButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  runOutToggleButtonSelected: {
    backgroundColor: '#fef2f2',
    borderColor: colors.error,
  },
  runOutToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  runOutToggleIcon: {
    fontSize: fontSizes.lg,
    marginRight: spacing.sm,
    color: colors.textMuted,
  },
  runOutToggleLabel: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  runOutToggleLabelSelected: {
    color: colors.error,
  },
  runOutToggleHint: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  batsmanSelectionContainer: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  batsmanSelectionTitle: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  batsmanCards: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  batsmanCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.sm,
  },
  batsmanCardSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  batsmanCardBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  batsmanCardBadgeSelected: {
    backgroundColor: colors.primary,
  },
  batsmanCardBadgeText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.textSecondary,
  },
  batsmanCardBadgeTextSelected: {
    color: colors.surface,
  },
  batsmanCardName: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  batsmanCardNameSelected: {
    color: colors.primary,
  },
  batsmanCardRole: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  extraBallActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingTop: 0,
  },
  extraBallCancelButton: {
    flex: 1,
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  extraBallCancelText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textSecondary,
  },
  extraBallConfirmButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  extraBallConfirmDisabled: {
    backgroundColor: colors.textMuted,
  },
  extraBallConfirmText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.surface,
  },

  // OUT Modal Styles
  outModalHeader: {
    backgroundColor: colors.error,
    padding: spacing.lg,
    alignItems: 'center',
  },
  outModalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  outModalIcon: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.extrabold,
    color: colors.surface,
  },
  outModalContent: {
    padding: spacing.lg,
  },
  wicketTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  wicketTypeOption: {
    width: '31%',
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  wicketTypeOptionSelected: {
    backgroundColor: '#fef2f2',
    borderColor: colors.error,
  },
  wicketTypeIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  wicketTypeText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  wicketTypeTextSelected: {
    color: colors.error,
  },
  outConfirmButton: {
    backgroundColor: colors.error,
  },

  // Run Out Expanded Section (Compact Design)
  runOutExpandedSection: {
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  batsmanCardsCompact: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  batsmanCardCompact: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  batsmanCardCompactSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  batsmanBadgeSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  batsmanBadgeSmallSelected: {
    backgroundColor: colors.primary,
  },
  batsmanBadgeSmallText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.textSecondary,
  },
  batsmanBadgeSmallTextSelected: {
    color: colors.surface,
  },
  batsmanCardCompactInfo: {
    flex: 1,
  },
  batsmanCardCompactName: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  batsmanCardCompactNameSelected: {
    color: colors.primary,
  },
  batsmanCardCompactRole: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  runsGridCompact: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  runOptionCompact: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  runOptionCompactSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  runOptionCompactText: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  runOptionCompactTextSelected: {
    color: colors.primary,
  },

  // Bye Modal Styles
  byeModalHeader: {
    backgroundColor: '#8b5cf6',
    padding: spacing.lg,
    alignItems: 'center',
  },
  byeModalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  byeConfirmButton: {
    backgroundColor: '#8b5cf6',
  },

  // More Runs Modal Styles
  moreRunsModalHeader: {
    backgroundColor: '#059669',
    padding: spacing.lg,
    alignItems: 'center',
  },
  moreRunsModalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  moreRunsIcon: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.extrabold,
    color: colors.surface,
  },
  moreRunsInfo: {
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  moreRunsInfoText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  moreRunsInfoList: {
    paddingLeft: spacing.sm,
  },
  moreRunsInfoItem: {
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    marginBottom: 4,
  },

  // Retire Modal Styles
  retireModalHeader: {
    backgroundColor: '#6366f1',
    padding: spacing.lg,
    alignItems: 'center',
  },
  retireModalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  // Retire header icon
  retireIconShape: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retireIconHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surface,
    position: 'absolute',
    top: 0,
    left: 4,
  },
  retireIconBody: {
    width: 12,
    height: 14,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    position: 'absolute',
    top: 10,
    left: 3,
  },
  retireIconArrow: {
    position: 'absolute',
    right: 0,
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  retireIconArrowLine: {
    width: 10,
    height: 3,
    backgroundColor: colors.surface,
    borderRadius: 1,
  },
  retireIconArrowHead: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.surface,
    marginLeft: -1,
  },
  retireTypeGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  retireTypeOption: {
    flex: 1,
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  retireTypeOptionSelected: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
  },
  retireTypeOptionSelectedOut: {
    backgroundColor: '#fef2f2',
    borderColor: colors.error,
  },
  retireTypeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  retireTypeIconContainerSelected: {
    backgroundColor: '#c7d2fe',
  },
  retireTypeIconContainerSelectedOut: {
    backgroundColor: '#fecaca',
  },
  // Refresh/Return Icon
  refreshIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIconSelected: {
    // Selected state for refresh icon container
  },
  refreshIconCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#94a3b8',
    borderTopColor: 'transparent',
  },
  refreshIconCircleSelected: {
    borderColor: '#6366f1',
    borderTopColor: 'transparent',
  },
  refreshIconArrow: {
    position: 'absolute',
    top: 0,
    right: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#94a3b8',
  },
  refreshIconArrowSelected: {
    borderBottomColor: '#6366f1',
  },
  // X Icon
  xIconContainer: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  xIconLine1: {
    position: 'absolute',
    width: 18,
    height: 3,
    backgroundColor: '#94a3b8',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  xIconLine2: {
    position: 'absolute',
    width: 18,
    height: 3,
    backgroundColor: '#94a3b8',
    borderRadius: 2,
    transform: [{ rotate: '-45deg' }],
  },
  xIconLineSelected: {
    backgroundColor: colors.error,
  },
  retireTypeText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  retireTypeTextSelected: {
    color: '#4f46e5',
  },
  retireTypeTextSelectedOut: {
    color: colors.error,
  },
  retireTypeSubtext: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  retireTypeSubtextSelected: {
    color: '#6366f1',
  },
  retireTypeSubtextSelectedOut: {
    color: '#ef4444',
  },
  // Batsman Selection Styles
  retireBatsmanGrid: {
    gap: spacing.md,
  },
  retireBatsmanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  retireBatsmanCardSelected: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
  },
  retireBatsmanIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    position: 'relative',
  },
  retireBatsmanIconWrapperSelected: {
    backgroundColor: '#c7d2fe',
  },
  batsmanIconContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  batsmanIconHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#94a3b8',
    position: 'absolute',
    top: 0,
  },
  batsmanIconBody: {
    width: 14,
    height: 12,
    backgroundColor: '#94a3b8',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    position: 'absolute',
    bottom: 0,
  },
  batsmanIconBat: {
    width: 3,
    height: 16,
    backgroundColor: '#b4bcd0',
    borderRadius: 1,
    position: 'absolute',
    right: 0,
    top: 4,
    transform: [{ rotate: '30deg' }],
  },
  batsmanIconSelected: {
    backgroundColor: '#6366f1',
  },
  batsmanIconBatSelected: {
    backgroundColor: '#818cf8',
  },
  strikerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fbbf24',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  strikerBadgeSelected: {
    backgroundColor: '#f59e0b',
    borderColor: '#eef2ff',
  },
  strikerBadgeText: {
    fontSize: 10,
    color: '#78350f',
  },
  strikerBadgeTextSelected: {
    color: '#fff',
  },
  retireBatsmanDetails: {
    flex: 1,
  },
  retireBatsmanName: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  retireBatsmanNameSelected: {
    color: '#4f46e5',
  },
  retireBatsmanStatsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  retireBatsmanRuns: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  retireBatsmanRunsSelected: {
    color: '#4f46e5',
  },
  retireBatsmanBalls: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  retireBatsmanBallsSelected: {
    color: '#6366f1',
  },
  retireStrikerLabel: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  retireStrikerLabelSelected: {
    backgroundColor: '#fde68a',
  },
  retireStrikerLabelText: {
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: '#92400e',
    letterSpacing: 0.5,
  },
  retireStrikerLabelTextSelected: {
    color: '#78350f',
  },
  nonStrikerLabel: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  nonStrikerLabelText: {
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: '#475569',
    letterSpacing: 0.5,
  },
  nonStrikerLabelTextSelected: {
    color: '#4f46e5',
  },
  selectionCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionCheckText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: fontWeights.bold,
  },
  retireInfo: {
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  retireInfoTitle: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: '#4f46e5',
    marginBottom: spacing.xs,
  },
  retireInfoTitleOut: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.error,
    marginBottom: spacing.xs,
  },
  retireInfoText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  retireConfirmButton: {
    flex: 1,
    backgroundColor: '#6366f1',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  retireConfirmButtonOut: {
    backgroundColor: colors.error,
  },

  // View Toggle Styles (Live/Scorecard Switch) - Animated
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    borderRadius: 25,
    padding: 3,
    alignItems: 'center',
    position: 'relative',
    height: 36,
  },
  viewToggleSlider: {
    position: 'absolute',
    width: 72,
    height: 30,
    backgroundColor: colors.primary,
    borderRadius: 22,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  viewToggleButton: {
    width: 72,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    flexDirection: 'row',
  },
  viewToggleText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginLeft: 4,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },

  // Settings Button Styles
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsGear: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gearCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textSecondary,
    position: 'absolute',
  },
  gearTooth: {
    position: 'absolute',
    width: 4,
    height: 18,
    backgroundColor: colors.textSecondary,
    borderRadius: 2,
  },

  // Full Scorecard Styles
  scorecardScrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  scorecardHeader: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  scorecardTeamsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  scorecardTeamContainer: {
    alignItems: 'center',
    flex: 1,
  },
  scorecardTeamBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  scorecardTeamBadgeText: {
    color: colors.surface,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
  },
  scorecardTeamName: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  scorecardTeamNameInput: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: 'transparent',
    minWidth: 80,
  },
  scorecardVsBadge: {
    backgroundColor: colors.surfaceGray,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginHorizontal: spacing.sm,
  },
  scorecardVsText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.textMuted,
  },
  scorecardScoreRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  scorecardMainScore: {
    fontSize: fontSizes.xxl + 8,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  scorecardOvers: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  scorecardRunRate: {
    textAlign: 'center',
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  scorecardTargetBanner: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  scorecardTargetText: {
    textAlign: 'center',
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.error,
  },

  // Innings Toggle Tabs
  inningsToggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    padding: 4,
    ...shadows.sm,
  },
  inningsToggleTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  inningsToggleTabActive: {
    backgroundColor: colors.primary,
  },
  inningsToggleText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.textSecondary,
  },
  inningsToggleTextActive: {
    color: colors.surface,
  },
  inningsToggleScore: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.textSecondary,
    marginTop: 2,
  },
  inningsToggleScoreActive: {
    color: colors.surface,
  },

  // Scorecard Section
  scorecardSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  scorecardSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  scorecardSectionTitle: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.surface,
  },
  scorecardSectionScore: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.surface,
  },

  // Scorecard Table
  scorecardTable: {
    padding: spacing.sm,
  },
  scorecardTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  scorecardBowlingHeader: {
    backgroundColor: colors.surfaceGray,
  },
  scorecardTableHeaderText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.textMuted,
    width: 32,
    textAlign: 'center',
  },
  scorecardNameCol: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  scorecardTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scorecardTableRowAlt: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  scorecardPlayerName: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  scorecardPlayerNameInput: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
    minHeight: 20,
  },
  scorecardPlayerNameText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    minHeight: 20,
    lineHeight: 20,
  },
  scorecardPlayerStatus: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  scorecardPlayerStatusOut: {
    color: colors.error,
  },
  scorecardStatText: {
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    width: 32,
    textAlign: 'center',
  },
  scorecardRunsText: {
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  scorecardWicketsText: {
    fontWeight: fontWeights.bold,
    color: colors.success,
  },
  scorecardCurrentBowler: {
    fontSize: fontSizes.xs,
    color: colors.primary,
    fontWeight: fontWeights.semibold,
    marginTop: 2,
  },

  // Yet to Bat
  scorecardYetToBat: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  scorecardYetToBatLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.textMuted,
  },
  scorecardYetToBatNames: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    flex: 1,
  },

  // Extras
  scorecardExtras: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  scorecardExtrasLabel: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  scorecardExtrasDetail: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },

  // Fall of Wickets
  scorecardFowContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  scorecardFowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    minWidth: '45%',
  },
  scorecardFowBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  scorecardFowWicket: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.surface,
  },
  scorecardFowDetails: {
    flex: 1,
  },
  scorecardFowScore: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  scorecardFowInfo: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },

  // Over History
  scorecardOverHistory: {
    padding: spacing.sm,
  },
  scorecardOverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scorecardOverNumber: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.textMuted,
    width: 50,
  },
  scorecardOverBalls: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  scorecardOverBall: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceGray,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  scorecardOverRuns: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
    width: 50,
    textAlign: 'right',
  },

  // Back to Live Button
  backToLiveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    ...shadows.md,
  },
  backToLiveText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.surface,
  },

  // Settings Modal Styles
  settingsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  settingsModalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
    ...shadows.lg,
  },
  settingsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsModalTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  settingsCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsCloseButtonText: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    fontWeight: fontWeights.bold,
  },
  settingsScrollView: {
    paddingHorizontal: spacing.lg,
  },
  settingsSection: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  settingsSectionTitle: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  settingsSectionSubtitle: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  settingsLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  settingsValueControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  settingsValueButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  settingsValueButtonText: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  settingsValue: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    minWidth: 40,
    textAlign: 'center',
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  playerNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  playerNumberText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.surface,
  },
  playerNameInput: {
    flex: 1,
    backgroundColor: colors.surfaceGray,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
  },
  playerNameInputWrapper: {
    flex: 1,
  },
  settingsApplyButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...shadows.md,
  },
  settingsApplyButtonText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.surface,
  },
});

export default ScoreCardScreen;
