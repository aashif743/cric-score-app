import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Alert,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import matchService from '../utils/matchService';
import tournamentService from '../utils/tournamentService';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

// Import logo
const criczoneLogo = require('../../assets/logo/criczone_icon.png');

const { width } = Dimensions.get('window');

// Brand colors matching CricZone
const colors = {
  primary: '#0d3b66',
  primaryLight: '#2d7dd2',
  secondary: '#5dade2',
  accent: '#a8d8ea',
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceGray: '#f1f5f9',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  error: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
  gold: '#fbbf24',
};

// Custom Icon Components
const BackIcon = ({ size = 24, color = colors.textPrimary }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.5,
      height: size * 0.5,
      borderLeftWidth: 3,
      borderBottomWidth: 3,
      borderColor: color,
      transform: [{ rotate: '45deg' }],
      marginLeft: size * 0.15,
    }} />
  </View>
);

const PlusIcon = ({ size = 24, color = colors.surface }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.6,
      height: 3,
      backgroundColor: color,
      borderRadius: 1.5,
      position: 'absolute',
    }} />
    <View style={{
      width: 3,
      height: size * 0.6,
      backgroundColor: color,
      borderRadius: 1.5,
      position: 'absolute',
    }} />
  </View>
);

const HomeIcon = ({ size = 24, color = colors.primary }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: 0,
      height: 0,
      borderLeftWidth: size * 0.45,
      borderRightWidth: size * 0.45,
      borderBottomWidth: size * 0.35,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: color,
    }} />
    <View style={{
      width: size * 0.65,
      height: size * 0.45,
      backgroundColor: color,
      marginTop: -2,
      borderBottomLeftRadius: size * 0.05,
      borderBottomRightRadius: size * 0.05,
    }} />
  </View>
);

const TrophyIcon = ({ size = 24, color = colors.gold }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.7,
      height: size * 0.5,
      borderWidth: 2.5,
      borderColor: color,
      borderBottomLeftRadius: size * 0.35,
      borderBottomRightRadius: size * 0.35,
      borderTopWidth: 0,
    }} />
    <View style={{
      width: size * 0.15,
      height: size * 0.2,
      backgroundColor: color,
      marginTop: -2,
    }} />
    <View style={{
      width: size * 0.4,
      height: size * 0.1,
      backgroundColor: color,
      borderRadius: size * 0.02,
    }} />
  </View>
);

const CricketBatIcon = ({ size = 24, color = colors.primary }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.25,
      height: size * 0.6,
      backgroundColor: color,
      borderRadius: size * 0.08,
      transform: [{ rotate: '-30deg' }],
    }} />
    <View style={{
      width: size * 0.12,
      height: size * 0.35,
      backgroundColor: color,
      position: 'absolute',
      bottom: size * 0.05,
      borderRadius: size * 0.04,
      transform: [{ rotate: '-30deg' }],
    }} />
  </View>
);

const BallIcon = ({ size = 24, color = colors.error }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.7,
      height: size * 0.7,
      borderRadius: size * 0.35,
      backgroundColor: color,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <View style={{
        width: size * 0.5,
        height: 2,
        backgroundColor: colors.surface,
        opacity: 0.5,
      }} />
    </View>
  </View>
);

const ErrorIcon = ({ size = 60, color = colors.error }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.8,
      height: size * 0.8,
      borderRadius: size * 0.4,
      borderWidth: 3,
      borderColor: color,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <View style={{
        width: 4,
        height: size * 0.35,
        backgroundColor: color,
        borderRadius: 2,
        marginBottom: size * 0.08,
      }} />
      <View style={{
        width: size * 0.1,
        height: size * 0.1,
        backgroundColor: color,
        borderRadius: size * 0.05,
      }} />
    </View>
  </View>
);

const DownloadIcon = ({ size = 24, color = colors.surface }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.5,
      height: size * 0.4,
      borderBottomWidth: 2.5,
      borderLeftWidth: 2.5,
      borderRightWidth: 2.5,
      borderColor: color,
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: 4,
      position: 'absolute',
      bottom: size * 0.1,
    }} />
    <View style={{
      width: 2.5,
      height: size * 0.4,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.1,
    }} />
    <View style={{
      width: 0,
      height: 0,
      borderLeftWidth: size * 0.15,
      borderRightWidth: size * 0.15,
      borderTopWidth: size * 0.15,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: color,
      position: 'absolute',
      top: size * 0.4,
    }} />
  </View>
);

const ShareIcon = ({ size = 24, color = colors.surface }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.25,
      height: size * 0.25,
      borderRadius: size * 0.125,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.1,
      right: size * 0.15,
    }} />
    <View style={{
      width: size * 0.25,
      height: size * 0.25,
      borderRadius: size * 0.125,
      backgroundColor: color,
      position: 'absolute',
      bottom: size * 0.1,
      left: size * 0.15,
    }} />
    <View style={{
      width: size * 0.25,
      height: size * 0.25,
      borderRadius: size * 0.125,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.1,
      left: size * 0.15,
    }} />
    <View style={{
      width: size * 0.35,
      height: 2,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.35,
      transform: [{ rotate: '30deg' }],
    }} />
    <View style={{
      width: size * 0.35,
      height: 2,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.55,
      transform: [{ rotate: '-30deg' }],
    }} />
  </View>
);

// Animated Table Row Component
const AnimatedTableRow = ({ children, delay, style }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 400,
      delay: delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: animatedValue,
          transform: [{
            translateX: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            }),
          }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

const FullScorecardScreen = ({ navigation, route }) => {
  const { user } = useContext(AuthContext);
  const { matchData: initialMatchData, matchId } = route.params || {};

  // Safe navigation functions
  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // Fallback to MainTabs if can't go back
      navigation.navigate('MainTabs', { screen: 'Dashboard' });
    }
  };

  const handleGoToDashboard = () => {
    navigation.navigate('MainTabs', { screen: 'Dashboard' });
  };

  const [matchData, setMatchData] = useState(initialMatchData || null);
  const [loading, setLoading] = useState(!initialMatchData && matchId);
  const [error, setError] = useState(null);
  const [activeInnings, setActiveInnings] = useState(1);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Tournament data for "Next Match" navigation
  const [tournamentDefaults, setTournamentDefaults] = useState(null);

  // Refs
  const shareableRef = useRef(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const headerScale = useRef(new Animated.Value(0.9)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!initialMatchData && matchId && user?.token) {
      fetchMatchData();
    }

    // Entrance animations
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(headerScale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(resultAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [matchId, user]);

  // Pre-fetch tournament data for "Next Match" button
  useEffect(() => {
    const tid = matchData?.tournament || initialMatchData?.tournament;
    if (tid && user?.token) {
      tournamentService.getTournament(tid, user.token)
        .then((response) => {
          const tournament = response.data || response;
          if (tournament) {
            setTournamentDefaults({
              totalOvers: tournament.totalOvers,
              playersPerTeam: tournament.playersPerTeam,
              ballsPerOver: tournament.ballsPerOver,
              teamNames: tournament.teamNames,
              venue: tournament.venue,
              tournamentName: tournament.name,
            });
          }
        })
        .catch((err) => console.log('Tournament pre-fetch error:', err));
    }
  }, [matchData?.tournament, initialMatchData?.tournament, user?.token]);

  useEffect(() => {
    // Animate tab indicator
    Animated.spring(tabIndicatorAnim, {
      toValue: activeInnings === 1 ? 0 : 1,
      tension: 100,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [activeInnings]);

  const fetchMatchData = async () => {
    try {
      setLoading(true);
      const response = await matchService.getMatch(matchId, user.token);
      setMatchData(response.data || response);
    } catch (err) {
      setError(err.error || 'Failed to load match data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date N/A';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const calculateStrikeRate = (runs, balls) => {
    if (!balls || balls === 0) return '0.00';
    return ((runs / balls) * 100).toFixed(2);
  };

  const calculateEconomyRate = (overs, runs) => {
    if (!overs) return '0.00';
    const [whole, part] = overs.toString().split('.').map(Number);
    const totalBalls = (whole || 0) * 6 + (part || 0);
    if (totalBalls === 0) return '0.00';
    return ((runs / totalBalls) * 6).toFixed(2);
  };

  /**
   * Convert cricket overs format to decimal
   * Cricket format: X.Y where Y is balls (0-5), NOT a decimal
   * Example: 10.3 overs = 10 overs + 3 balls = 10 + (3/6) = 10.5 decimal
   *
   * @param {string|number} overs - Overs in cricket format (e.g., "10.3")
   * @returns {number} - Overs in decimal format (e.g., 10.5)
   */
  const oversToDecimal = (overs) => {
    if (!overs && overs !== 0) return 0;
    const oversStr = overs.toString();
    const parts = oversStr.split('.');
    const wholeOvers = parseInt(parts[0]) || 0;
    const balls = parseInt(parts[1]) || 0;
    // Balls range from 0-5, divide by 6 to convert to decimal
    return wholeOvers + (balls / 6);
  };

  /**
   * Calculate Net Run Rate (NRR) following ICC Cricket Rules
   *
   * ICC NRR RULES:
   * 1. NRR = (Runs Scored / Overs Faced) - (Runs Conceded / Overs Bowled)
   *
   * 2. ALL-OUT RULE (Critical):
   *    If a team is ALL OUT before completing their allotted overs,
   *    they are deemed to have faced the FULL QUOTA of scheduled overs.
   *    This prevents teams from manipulating NRR by getting out quickly.
   *
   * 3. Overs Bowled = Opponent's Overs Faced (using adjusted figures)
   *
   * EXAMPLE:
   * Match: 20 overs, Team A: 120/10 in 18.4 ov (all out), Team B: 121/2 in 15 ov
   * - Team A overs faced = 20 (all-out rule applied)
   * - Team B overs faced = 15 (actual, since they won)
   * - Team A overs bowled = 15 (Team B's overs)
   * - Team B overs bowled = 20 (Team A's adjusted overs)
   * - Team A NRR = (120/20) - (121/15) = 6.00 - 8.07 = -2.07
   * - Team B NRR = (121/15) - (120/20) = 8.07 - 6.00 = +2.07
   */
  const calculateNetRunRates = () => {
    // Need both innings to calculate NRR
    if (!matchData?.innings1 || !matchData?.innings2) return null;

    // Match configuration
    const scheduledOvers = matchData.totalOvers || 20;
    const playersPerTeam = matchData.playersPerTeam || 11;
    const allOutWickets = playersPerTeam - 1; // e.g., 10 wickets for 11 players

    const innings1 = matchData.innings1;
    const innings2 = matchData.innings2;

    // ========== TEAM A (Batted First - Innings 1) ==========
    const teamARuns = innings1.runs || 0;
    const teamAActualOvers = oversToDecimal(innings1.overs);
    const teamAWickets = innings1.wickets || 0;
    const teamAAllOut = teamAWickets >= allOutWickets;

    // ========== TEAM B (Batted Second - Innings 2, Chasing) ==========
    const teamBRuns = innings2.runs || 0;
    const teamBActualOvers = oversToDecimal(innings2.overs);
    const teamBWickets = innings2.wickets || 0;
    const teamBAllOut = teamBWickets >= allOutWickets;

    // ========== APPLY ICC ALL-OUT RULE ==========
    // If a team is all out, they are deemed to have faced full scheduled overs
    const teamAOversFaced = teamAAllOut ? scheduledOvers : teamAActualOvers;
    const teamBOversFaced = teamBAllOut ? scheduledOvers : teamBActualOvers;

    // ========== CALCULATE OVERS BOWLED ==========
    // Overs bowled by a team = Overs faced by the opponent (using adjusted figures)
    const teamAOversBowled = teamBOversFaced; // Team A bowled to Team B
    const teamBOversBowled = teamAOversFaced; // Team B bowled to Team A

    // Prevent division by zero
    if (teamAOversFaced === 0 || teamBOversFaced === 0) return null;

    // ========== CALCULATE RUN RATES ==========
    const teamARunRate = teamARuns / teamAOversFaced;
    const teamBRunRate = teamBRuns / teamBOversFaced;

    // ========== CALCULATE NET RUN RATES ==========
    // NRR = (Runs Scored / Overs Faced) - (Runs Conceded / Overs Bowled)
    const teamANRR = teamARunRate - (teamBRuns / teamAOversBowled);
    const teamBNRR = teamBRunRate - (teamARuns / teamBOversBowled);

    return {
      teamA: {
        name: matchData.teamA?.name || 'Team A',
        runs: teamARuns,
        wickets: teamAWickets,
        actualOvers: teamAActualOvers,
        oversForNRR: teamAOversFaced,
        isAllOut: teamAAllOut,
        runRate: teamARunRate.toFixed(2),
        nrr: teamANRR.toFixed(3),
      },
      teamB: {
        name: matchData.teamB?.name || 'Team B',
        runs: teamBRuns,
        wickets: teamBWickets,
        actualOvers: teamBActualOvers,
        oversForNRR: teamBOversFaced,
        isAllOut: teamBAllOut,
        runRate: teamBRunRate.toFixed(2),
        nrr: teamBNRR.toFixed(3),
      },
      scheduledOvers,
    };
  };

  const nrrData = calculateNetRunRates();

  // Capture scorecard as image
  const captureScorecard = async () => {
    try {
      if (!shareableRef.current) {
        console.log('No ref available, waiting...');
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!shareableRef.current) {
          console.log('Still no ref after waiting');
          return null;
        }
      }

      console.log('Capturing scorecard...');

      // Try using the capture method first
      if (typeof shareableRef.current.capture === 'function') {
        const uri = await shareableRef.current.capture();
        console.log('Captured with capture() URI:', uri);
        return uri;
      }

      // Fallback to captureRef
      console.log('Using captureRef fallback...');
      const uri = await captureRef(shareableRef.current, {
        format: 'png',
        quality: 1,
      });
      console.log('Captured with captureRef URI:', uri);
      return uri;
    } catch (error) {
      console.error('Error capturing scorecard:', error.message || error);
      Alert.alert('Debug', `Capture error: ${error.message || error}`);
      return null;
    }
  };

  // Save image to gallery
  const handleDownload = async () => {
    try {
      setIsSaving(true);
      setShowShareModal(true);

      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to save images to your gallery.');
        setIsSaving(false);
        setShowShareModal(false);
        return;
      }

      // Wait for the modal and view to render fully
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Capture the image
      const uri = await captureScorecard();
      if (!uri) {
        Alert.alert('Error', 'Failed to capture scorecard. Please try again.');
        setIsSaving(false);
        setShowShareModal(false);
        return;
      }

      // Save to gallery
      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync('CricZone', asset, false);

      setShowShareModal(false);
      Alert.alert('Success', 'Scorecard saved to your gallery!');
    } catch (error) {
      console.error('Error saving scorecard:', error);
      Alert.alert('Error', 'Failed to save scorecard. Please try again.');
      setShowShareModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Share image
  const handleShare = async () => {
    try {
      setIsSharing(true);
      setShowShareModal(true);

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        setIsSharing(false);
        setShowShareModal(false);
        return;
      }

      // Wait for the modal and view to render fully
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Capture the image
      const uri = await captureScorecard();
      if (!uri) {
        Alert.alert('Error', 'Failed to capture scorecard. Please try again.');
        setIsSharing(false);
        setShowShareModal(false);
        return;
      }

      // Close modal before sharing
      setShowShareModal(false);

      // Small delay before sharing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Share the image
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Scorecard',
        UTI: 'public.png',
      });
    } catch (error) {
      console.error('Error sharing scorecard:', error);
      if (error.message && !error.message.includes('User did not share') && !error.message.includes('cancelled')) {
        Alert.alert('Error', 'Failed to share scorecard. Please try again.');
      }
    } finally {
      setIsSharing(false);
      setShowShareModal(false);
    }
  };

  const handleButtonPressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handleButtonPressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const renderBattingTable = (batting, label) => {
    const playedBatsmen = (batting || []).filter(
      b => (b.balls || 0) > 0 || (b.runs || 0) > 0 || b.isOut === true
    );

    if (playedBatsmen.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <CricketBatIcon size={32} color={colors.textMuted} />
          <Text style={styles.noDataText}>No batting data available</Text>
        </View>
      );
    }

    return (
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.nameColumn]}>Batsman</Text>
          <Text style={styles.tableHeaderText}>R</Text>
          <Text style={styles.tableHeaderText}>B</Text>
          <Text style={styles.tableHeaderText}>4s</Text>
          <Text style={styles.tableHeaderText}>6s</Text>
          <Text style={styles.tableHeaderText}>SR</Text>
        </View>
        {playedBatsmen.map((batsman, index) => (
          <AnimatedTableRow key={index} delay={index * 50} style={styles.tableRow}>
            <View style={styles.nameColumn}>
              <Text style={styles.playerName}>{batsman.name}</Text>
              <Text style={[styles.playerStatus, batsman.isOut && styles.playerStatusOut]}>
                {batsman.status || (batsman.isOut ? 'Out' : 'Not Out')}
              </Text>
            </View>
            <Text style={[styles.statText, styles.runsText]}>{batsman.runs || 0}</Text>
            <Text style={styles.statText}>{batsman.balls || 0}</Text>
            <Text style={styles.statText}>{batsman.fours || 0}</Text>
            <Text style={styles.statText}>{batsman.sixes || 0}</Text>
            <Text style={[styles.statText, styles.srText]}>
              {calculateStrikeRate(batsman.runs, batsman.balls)}
            </Text>
          </AnimatedTableRow>
        ))}
      </View>
    );
  };

  const renderBowlingTable = (bowling, label) => {
    const bowledBowlers = (bowling || []).filter(b => {
      if (!b.overs) return false;
      const [whole, part] = b.overs.toString().split('.').map(Number);
      return (whole || 0) > 0 || (part || 0) > 0;
    });

    if (bowledBowlers.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <BallIcon size={32} color={colors.textMuted} />
          <Text style={styles.noDataText}>No bowling data available</Text>
        </View>
      );
    }

    return (
      <View style={styles.tableContainer}>
        <View style={[styles.tableHeader, styles.bowlingHeader]}>
          <Text style={[styles.tableHeaderText, styles.nameColumn]}>Bowler</Text>
          <Text style={styles.tableHeaderText}>O</Text>
          <Text style={styles.tableHeaderText}>M</Text>
          <Text style={styles.tableHeaderText}>R</Text>
          <Text style={styles.tableHeaderText}>W</Text>
          <Text style={styles.tableHeaderText}>ER</Text>
        </View>
        {bowledBowlers.map((bowler, index) => (
          <AnimatedTableRow key={index} delay={index * 50} style={styles.tableRow}>
            <Text style={[styles.playerName, styles.nameColumn]}>{bowler.name}</Text>
            <Text style={styles.statText}>{bowler.overs || '0.0'}</Text>
            <Text style={styles.statText}>{bowler.maidens || 0}</Text>
            <Text style={styles.statText}>{bowler.runs || 0}</Text>
            <Text style={[styles.statText, styles.wicketsText]}>{bowler.wickets || 0}</Text>
            <Text style={[styles.statText, styles.erText]}>
              {bowler.economyRate || calculateEconomyRate(bowler.overs, bowler.runs)}
            </Text>
          </AnimatedTableRow>
        ))}
      </View>
    );
  };

  const renderExtras = (extras) => {
    if (!extras || extras.total === 0) return null;

    return (
      <Animated.View style={[styles.extrasContainer, { opacity: fadeAnim }]}>
        <View style={styles.extrasHeader}>
          <Text style={styles.extrasTitle}>Extras</Text>
          <Text style={styles.extrasTotal}>{extras.total || 0}</Text>
        </View>
        <View style={styles.extrasDetails}>
          {extras.wides > 0 && (
            <View style={styles.extraItem}>
              <Text style={styles.extraLabel}>Wide</Text>
              <Text style={styles.extraValue}>{extras.wides}</Text>
            </View>
          )}
          {extras.noBalls > 0 && (
            <View style={styles.extraItem}>
              <Text style={styles.extraLabel}>No Ball</Text>
              <Text style={styles.extraValue}>{extras.noBalls}</Text>
            </View>
          )}
          {extras.byes > 0 && (
            <View style={styles.extraItem}>
              <Text style={styles.extraLabel}>Byes</Text>
              <Text style={styles.extraValue}>{extras.byes}</Text>
            </View>
          )}
          {extras.legByes > 0 && (
            <View style={styles.extraItem}>
              <Text style={styles.extraLabel}>Leg Byes</Text>
              <Text style={styles.extraValue}>{extras.legByes}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  const renderFallOfWickets = (fow) => {
    if (!fow || fow.length === 0) return null;

    return (
      <Animated.View style={[styles.fowContainer, { opacity: fadeAnim }]}>
        <Text style={styles.fowTitle}>Fall of Wickets</Text>
        <View style={styles.fowList}>
          {fow.map((wicket, index) => (
            <View key={index} style={styles.fowItem}>
              <View style={styles.fowBadge}>
                <Text style={styles.fowWicket}>{wicket.wicket}</Text>
              </View>
              <View style={styles.fowDetails}>
                <Text style={styles.fowScore}>{wicket.score}</Text>
                <Text style={styles.fowInfo}>
                  {wicket.batsman_name} ({wicket.over} ov)
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Animated.View>
    );
  };

  const getBallColor = (ball) => {
    if (ball === 'W') return colors.error;
    if (ball === '4' || ball === '6') return colors.success;
    if (ball.includes('WD') || ball.includes('NB')) return colors.warning;
    if (ball.includes('BYE') || ball.includes('LB')) return '#f97316';
    return colors.primaryLight;
  };

  const renderOverHistory = (overHistory) => {
    if (!overHistory || overHistory.length === 0) return null;

    return (
      <Animated.View style={[styles.overHistoryContainer, { opacity: fadeAnim }]}>
        <Text style={styles.overHistoryTitle}>Over by Over</Text>
        <View style={styles.overHistoryList}>
          {overHistory.map((over, index) => (
            <View key={index} style={styles.overHistoryItem}>
              <View style={styles.overHistoryHeader}>
                <Text style={styles.overHistoryNumber}>Over {over.overNumber || index + 1}</Text>
                {over.bowlerName ? (
                  <Text style={styles.overHistoryBowler}>{over.bowlerName}</Text>
                ) : null}
                <Text style={styles.overHistoryStats}>
                  {over.runs}R{over.wickets > 0 ? `, ${over.wickets}W` : ''}
                </Text>
              </View>
              <View style={styles.overHistoryBalls}>
                {(over.balls || []).map((ball, ballIndex) => (
                  <View
                    key={ballIndex}
                    style={[styles.overHistoryBall, { backgroundColor: getBallColor(ball) }]}
                  >
                    <Text style={styles.overHistoryBallText}>{ball}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </Animated.View>
    );
  };

  const renderInningsSection = (innings, teamName, label) => {
    if (!innings) {
      return (
        <Animated.View style={[styles.inningsSection, { opacity: fadeAnim }]}>
          <View style={styles.yetToBat}>
            <CricketBatIcon size={40} color={colors.textMuted} />
            <Text style={styles.yetToBatText}>{teamName}</Text>
            <Text style={styles.yetToBatSubtext}>Yet to bat</Text>
          </View>
        </Animated.View>
      );
    }

    return (
      <Animated.View
        style={[
          styles.inningsSection,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Innings Score Header */}
        <View style={styles.inningsHeader}>
          <View style={styles.inningsTeamInfo}>
            <View style={styles.teamBadge}>
              <Text style={styles.teamBadgeText}>
                {(innings.battingTeam || innings.teamName || teamName).charAt(0)}
              </Text>
            </View>
            <Text style={styles.inningsTeamName}>
              {innings.battingTeam || innings.teamName || teamName}
            </Text>
          </View>
          <View style={styles.inningsScoreContainer}>
            <Text style={styles.inningsScore}>
              {innings.runs || 0}<Text style={styles.inningsWickets}>/{innings.wickets || 0}</Text>
            </Text>
            <View style={styles.oversContainer}>
              <Text style={styles.inningsOvers}>{innings.overs || '0.0'} Overs</Text>
            </View>
          </View>
        </View>

        {/* Batting Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <CricketBatIcon size={18} color={colors.primary} />
            <Text style={styles.sectionLabel}>Batting</Text>
          </View>
          {renderBattingTable(innings.batting, label)}
        </View>

        {/* Bowling Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <BallIcon size={18} color={colors.error} />
            <Text style={styles.sectionLabel}>Bowling</Text>
          </View>
          {renderBowlingTable(innings.bowling, label)}
        </View>

        {renderExtras(innings.extras)}
        {renderFallOfWickets(innings.fallOfWickets)}
        {renderOverHistory(innings.overHistory)}
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIconContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
          <Text style={styles.loadingText}>Loading scorecard...</Text>
          <Text style={styles.loadingSubtext}>Please wait</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !matchData) {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View
          style={[
            styles.errorContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: headerScale }],
            },
          ]}
        >
          <View style={styles.errorIconContainer}>
            <ErrorIcon size={70} color={colors.error} />
          </View>
          <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
          <Text style={styles.errorText}>{error || 'No match data available'}</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={handleGoToDashboard}
            onPressIn={handleButtonPressIn}
            onPressOut={handleButtonPressOut}
            activeOpacity={0.9}
          >
            <HomeIcon size={20} color={colors.surface} />
            <Text style={styles.errorButtonText}>Go to Dashboard</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: Animated.multiply(slideAnim, -1) }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleGoBack}
          activeOpacity={0.7}
        >
          <BackIcon size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Full Scorecard</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={handleDownload}
            activeOpacity={0.8}
          >
            <DownloadIcon size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <ShareIcon size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        {/* Match Header Card */}
        <Animated.View
          style={[
            styles.matchHeader,
            {
              opacity: fadeAnim,
              transform: [{ scale: headerScale }],
            },
          ]}
        >
          <View style={styles.matchTeamsContainer}>
            {/* Team A */}
            <View style={styles.teamContainer}>
              <View style={styles.teamAvatar}>
                <Text style={styles.teamAvatarText}>
                  {(matchData.teamA?.name || 'A').charAt(0)}
                </Text>
              </View>
              <Text style={styles.teamName} numberOfLines={2}>
                {matchData.teamA?.name || 'Team A'}
              </Text>
              {matchData.innings1 && (
                <Text style={styles.teamScore}>
                  {matchData.innings1.runs || 0}/{matchData.innings1.wickets || 0}
                </Text>
              )}
            </View>

            {/* VS Badge */}
            <View style={styles.vsBadge}>
              <Text style={styles.vsText}>VS</Text>
            </View>

            {/* Team B */}
            <View style={styles.teamContainer}>
              <View style={[styles.teamAvatar, styles.teamAvatarB]}>
                <Text style={styles.teamAvatarText}>
                  {(matchData.teamB?.name || 'B').charAt(0)}
                </Text>
              </View>
              <Text style={styles.teamName} numberOfLines={2}>
                {matchData.teamB?.name || 'Team B'}
              </Text>
              {matchData.innings2 && (
                <Text style={styles.teamScore}>
                  {matchData.innings2.runs || 0}/{matchData.innings2.wickets || 0}
                </Text>
              )}
            </View>
          </View>

          {/* Match Info */}
          <View style={styles.matchInfoContainer}>
            {matchData.totalOvers && (
              <View style={styles.matchInfoItem}>
                <Text style={styles.matchInfoLabel}>Format</Text>
                <Text style={styles.matchInfoValue}>{matchData.totalOvers} Overs</Text>
              </View>
            )}
            {matchData.date && (
              <View style={styles.matchInfoItem}>
                <Text style={styles.matchInfoLabel}>Date</Text>
                <Text style={styles.matchInfoValue}>{formatDate(matchData.date)}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Result Banner */}
        {matchData.result && (
          <Animated.View
            style={[
              styles.resultContainer,
              {
                opacity: resultAnim,
                transform: [{
                  scale: resultAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                }],
              },
            ]}
          >
            <View style={styles.resultIconContainer}>
              <TrophyIcon size={28} color={colors.gold} />
            </View>
            <View style={styles.resultTextContainer}>
              <Text style={styles.resultLabel}>MATCH RESULT</Text>
              <Text style={styles.resultText}>{matchData.result}</Text>
            </View>
          </Animated.View>
        )}

        {/* Net Run Rate Section */}
        {nrrData && (
          <Animated.View
            style={[
              styles.nrrContainer,
              {
                opacity: resultAnim,
                transform: [{
                  translateY: resultAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                }],
              },
            ]}
          >
            <View style={styles.nrrHeader}>
              <View style={styles.nrrIconContainer}>
                <Text style={styles.nrrIcon}>📊</Text>
              </View>
              <Text style={styles.nrrTitle}>Net Run Rate</Text>
            </View>

            <View style={styles.nrrTeamsContainer}>
              {/* Team A NRR */}
              <View style={styles.nrrTeamCard}>
                <View style={[styles.nrrTeamBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.nrrTeamBadgeText}>
                    {nrrData.teamA.name.charAt(0)}
                  </Text>
                </View>
                <Text style={styles.nrrTeamName} numberOfLines={1}>
                  {nrrData.teamA.name}
                </Text>
                {nrrData.teamA.isAllOut && (
                  <View style={styles.allOutBadge}>
                    <Text style={styles.allOutBadgeText}>All Out</Text>
                  </View>
                )}
                <View style={[styles.nrrValueContainer, parseFloat(nrrData.teamA.nrr) >= 0 ? styles.nrrValuePositive : styles.nrrValueNegative]}>
                  <Text style={styles.nrrLabel}>NRR</Text>
                  <Text style={[
                    styles.nrrValueText,
                    parseFloat(nrrData.teamA.nrr) >= 0 ? styles.nrrPositive : styles.nrrNegative
                  ]}>
                    {parseFloat(nrrData.teamA.nrr) >= 0 ? '+' : ''}{nrrData.teamA.nrr}
                  </Text>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.nrrDivider} />

              {/* Team B NRR */}
              <View style={styles.nrrTeamCard}>
                <View style={[styles.nrrTeamBadge, { backgroundColor: colors.secondary }]}>
                  <Text style={styles.nrrTeamBadgeText}>
                    {nrrData.teamB.name.charAt(0)}
                  </Text>
                </View>
                <Text style={styles.nrrTeamName} numberOfLines={1}>
                  {nrrData.teamB.name}
                </Text>
                {nrrData.teamB.isAllOut && (
                  <View style={styles.allOutBadge}>
                    <Text style={styles.allOutBadgeText}>All Out</Text>
                  </View>
                )}
                <View style={[styles.nrrValueContainer, parseFloat(nrrData.teamB.nrr) >= 0 ? styles.nrrValuePositive : styles.nrrValueNegative]}>
                  <Text style={styles.nrrLabel}>NRR</Text>
                  <Text style={[
                    styles.nrrValueText,
                    parseFloat(nrrData.teamB.nrr) >= 0 ? styles.nrrPositive : styles.nrrNegative
                  ]}>
                    {parseFloat(nrrData.teamB.nrr) >= 0 ? '+' : ''}{nrrData.teamB.nrr}
                  </Text>
                </View>
              </View>
            </View>

            {/* ICC Rule Note */}
            {(nrrData.teamA.isAllOut || nrrData.teamB.isAllOut) && (
              <View style={styles.nrrNoteContainer}>
                <Text style={styles.nrrNoteText}>
                  * All-out teams use full {nrrData.scheduledOvers} overs for NRR (ICC Rule)
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* Innings Tabs */}
        <View style={styles.inningsTabs}>
          <Animated.View
            style={[
              styles.tabIndicator,
              {
                transform: [{
                  translateX: tabIndicatorAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, (width - 56) / 2],
                  }),
                }],
              },
            ]}
          />
          <TouchableOpacity
            style={styles.inningsTab}
            onPress={() => setActiveInnings(1)}
            activeOpacity={0.7}
          >
            <Text style={[styles.inningsTabText, activeInnings === 1 && styles.inningsTabTextActive]}>
              1st Innings
            </Text>
          </TouchableOpacity>
          {matchData.innings2 && (
            <TouchableOpacity
              style={styles.inningsTab}
              onPress={() => setActiveInnings(2)}
              activeOpacity={0.7}
            >
              <Text style={[styles.inningsTabText, activeInnings === 2 && styles.inningsTabTextActive]}>
                2nd Innings
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Innings Content */}
        {activeInnings === 1 &&
          renderInningsSection(
            matchData.innings1,
            matchData.teamA?.name || 'Team A',
            '1st Innings'
          )}
        {activeInnings === 2 &&
          matchData.innings2 &&
          renderInningsSection(
            matchData.innings2,
            matchData.teamB?.name || 'Team B',
            '2nd Innings'
          )}

        {/* Action Buttons */}
        {(() => {
          const tid = matchData?.tournament || initialMatchData?.tournament;
          return (
            <View style={styles.actionButtons}>
              <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: buttonScale }] }]}>
                <TouchableOpacity
                  style={styles.dashboardButton}
                  onPress={tid
                    ? () => navigation.navigate('TournamentDetail', { tournamentId: tid })
                    : handleGoToDashboard
                  }
                  onPressIn={handleButtonPressIn}
                  onPressOut={handleButtonPressOut}
                  activeOpacity={0.9}
                >
                  {tid ? <BackIcon size={20} color={colors.primary} /> : <HomeIcon size={20} color={colors.primary} />}
                  <Text style={styles.dashboardButtonText}>{tid ? 'Tournament' : 'Dashboard'}</Text>
                </TouchableOpacity>
              </Animated.View>
              <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: buttonScale }] }]}>
                <TouchableOpacity
                  style={styles.newMatchButtonLarge}
                  onPress={() => tid
                    ? navigation.replace('MatchSetup', {
                        tournamentId: tid,
                        ...(tournamentDefaults ? { tournamentDefaults } : {}),
                      })
                    : navigation.navigate('MatchSetup')
                  }
                  onPressIn={handleButtonPressIn}
                  onPressOut={handleButtonPressOut}
                  activeOpacity={0.9}
                >
                  <PlusIcon size={20} color={colors.surface} />
                  <Text style={styles.newMatchButtonLargeText}>{tid ? 'Next Match' : 'New Match'}</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          );
        })()}
      </ScrollView>

      {/* Shareable Scorecard Modal */}
      <Modal visible={showShareModal} transparent animationType="fade">
        <View style={styles.shareModalOverlay}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.shareCloseButton}
            onPress={() => {
              setShowShareModal(false);
              setIsSaving(false);
              setIsSharing(false);
            }}
          >
            <Text style={styles.shareCloseButtonText}>✕</Text>
          </TouchableOpacity>

          {/* Loading Indicator */}
          {(isSaving || isSharing) && (
            <View style={styles.shareLoadingOverlay}>
              <ActivityIndicator size="large" color={colors.surface} />
              <Text style={styles.shareLoadingText}>
                {isSaving ? 'Saving scorecard...' : 'Preparing to share...'}
              </Text>
            </View>
          )}

          {/* Shareable View - Rendered but scrollable */}
          <ScrollView
            style={styles.shareableScrollView}
            contentContainerStyle={styles.shareableScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <ViewShot
              ref={shareableRef}
              style={styles.shareableContainer}
              options={{ format: 'png', quality: 1 }}
            >
            <View style={styles.shareableCard}>
              {/* Header with Logo */}
              <View style={styles.shareableHeader}>
                <Image
                  source={criczoneLogo}
                  style={styles.shareableLogo}
                  resizeMode="contain"
                />
                <View style={styles.shareableHeaderText}>
                  <Text style={styles.shareableAppName}>CricZone</Text>
                  <Text style={styles.shareableTagline}>Cricket Scoring App</Text>
                </View>
              </View>

              {/* Match Title */}
              <View style={styles.shareableMatchTitle}>
                <Text style={styles.shareableMatchTitleText}>
                  {matchData?.teamA?.name || 'Team A'} vs {matchData?.teamB?.name || 'Team B'}
                </Text>
                <Text style={styles.shareableMatchInfo}>
                  {matchData?.totalOvers || 20} Overs Match • {formatDate(matchData?.date)}
                </Text>
              </View>

              {/* Result Banner */}
              {matchData?.result && (
                <View style={styles.shareableResult}>
                  <Text style={styles.shareableResultText}>{matchData.result}</Text>
                </View>
              )}

              {/* Scores Summary */}
              <View style={styles.shareableScores}>
                {/* Team A Score */}
                <View style={styles.shareableTeamScore}>
                  <View style={[styles.shareableTeamBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.shareableTeamBadgeText}>
                      {(matchData?.teamA?.name || 'A').charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.shareableTeamInfo}>
                    <Text style={styles.shareableTeamName}>{matchData?.teamA?.name || 'Team A'}</Text>
                    <Text style={styles.shareableTeamScoreText}>
                      {matchData?.innings1?.runs || 0}/{matchData?.innings1?.wickets || 0}
                      <Text style={styles.shareableOvers}> ({matchData?.innings1?.overs || '0.0'} ov)</Text>
                    </Text>
                  </View>
                </View>

                {/* VS Divider */}
                <View style={styles.shareableVsDivider}>
                  <Text style={styles.shareableVsText}>VS</Text>
                </View>

                {/* Team B Score */}
                <View style={styles.shareableTeamScore}>
                  <View style={[styles.shareableTeamBadge, { backgroundColor: colors.secondary }]}>
                    <Text style={styles.shareableTeamBadgeText}>
                      {(matchData?.teamB?.name || 'B').charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.shareableTeamInfo}>
                    <Text style={styles.shareableTeamName}>{matchData?.teamB?.name || 'Team B'}</Text>
                    <Text style={styles.shareableTeamScoreText}>
                      {matchData?.innings2?.runs || 0}/{matchData?.innings2?.wickets || 0}
                      <Text style={styles.shareableOvers}> ({matchData?.innings2?.overs || '0.0'} ov)</Text>
                    </Text>
                  </View>
                </View>
              </View>

              {/* NRR Section */}
              {nrrData && (
                <View style={styles.shareableNRR}>
                  <Text style={styles.shareableNRRTitle}>Net Run Rate</Text>
                  <View style={styles.shareableNRRRow}>
                    <View style={styles.shareableNRRItem}>
                      <Text style={styles.shareableNRRTeam}>{nrrData.teamA.name}</Text>
                      <Text style={[
                        styles.shareableNRRValue,
                        parseFloat(nrrData.teamA.nrr) >= 0 ? styles.shareableNRRPositive : styles.shareableNRRNegative
                      ]}>
                        {parseFloat(nrrData.teamA.nrr) >= 0 ? '+' : ''}{nrrData.teamA.nrr}
                      </Text>
                    </View>
                    <View style={styles.shareableNRRDivider} />
                    <View style={styles.shareableNRRItem}>
                      <Text style={styles.shareableNRRTeam}>{nrrData.teamB.name}</Text>
                      <Text style={[
                        styles.shareableNRRValue,
                        parseFloat(nrrData.teamB.nrr) >= 0 ? styles.shareableNRRPositive : styles.shareableNRRNegative
                      ]}>
                        {parseFloat(nrrData.teamB.nrr) >= 0 ? '+' : ''}{nrrData.teamB.nrr}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* First Innings */}
              {matchData?.innings1 && (
                <View style={styles.shareableInnings}>
                  <View style={styles.shareableInningsHeader}>
                    <Text style={styles.shareableInningsTitle}>
                      1st Innings - {matchData.innings1.battingTeam || matchData?.teamA?.name}
                    </Text>
                    <Text style={styles.shareableInningsScore}>
                      {matchData.innings1.runs}/{matchData.innings1.wickets} ({matchData.innings1.overs} ov)
                    </Text>
                  </View>

                  {/* Batting */}
                  <View style={styles.shareableTable}>
                    <View style={styles.shareableTableHeader}>
                      <Text style={[styles.shareableTableHeaderText, styles.shareableNameCol]}>Batsman</Text>
                      <Text style={styles.shareableTableHeaderText}>R</Text>
                      <Text style={styles.shareableTableHeaderText}>B</Text>
                      <Text style={styles.shareableTableHeaderText}>4s</Text>
                      <Text style={styles.shareableTableHeaderText}>6s</Text>
                      <Text style={styles.shareableTableHeaderText}>SR</Text>
                    </View>
                    {(matchData.innings1.batting || [])
                      .filter(b => (b.balls || 0) > 0 || (b.runs || 0) > 0 || b.isOut)
                      .map((batsman, idx) => (
                        <View key={idx} style={styles.shareableTableRow}>
                          <Text style={[styles.shareableTableCell, styles.shareableNameCol]} numberOfLines={1}>
                            {batsman.name}
                          </Text>
                          <Text style={[styles.shareableTableCell, styles.shareableRunsCell]}>{batsman.runs || 0}</Text>
                          <Text style={styles.shareableTableCell}>{batsman.balls || 0}</Text>
                          <Text style={styles.shareableTableCell}>{batsman.fours || 0}</Text>
                          <Text style={styles.shareableTableCell}>{batsman.sixes || 0}</Text>
                          <Text style={styles.shareableTableCell}>{calculateStrikeRate(batsman.runs, batsman.balls)}</Text>
                        </View>
                      ))}
                  </View>

                  {/* Bowling */}
                  <View style={[styles.shareableTable, { marginTop: 8 }]}>
                    <View style={[styles.shareableTableHeader, styles.shareableBowlingHeader]}>
                      <Text style={[styles.shareableTableHeaderText, styles.shareableNameCol]}>Bowler</Text>
                      <Text style={styles.shareableTableHeaderText}>O</Text>
                      <Text style={styles.shareableTableHeaderText}>M</Text>
                      <Text style={styles.shareableTableHeaderText}>R</Text>
                      <Text style={styles.shareableTableHeaderText}>W</Text>
                      <Text style={styles.shareableTableHeaderText}>ER</Text>
                    </View>
                    {(matchData.innings1.bowling || [])
                      .filter(b => b.overs && b.overs !== '0.0')
                      .map((bowler, idx) => (
                        <View key={idx} style={styles.shareableTableRow}>
                          <Text style={[styles.shareableTableCell, styles.shareableNameCol]} numberOfLines={1}>
                            {bowler.name}
                          </Text>
                          <Text style={styles.shareableTableCell}>{bowler.overs || '0.0'}</Text>
                          <Text style={styles.shareableTableCell}>{bowler.maidens || 0}</Text>
                          <Text style={styles.shareableTableCell}>{bowler.runs || 0}</Text>
                          <Text style={[styles.shareableTableCell, styles.shareableWicketsCell]}>{bowler.wickets || 0}</Text>
                          <Text style={styles.shareableTableCell}>{calculateEconomyRate(bowler.overs, bowler.runs)}</Text>
                        </View>
                      ))}
                  </View>

                  {/* Over by Over */}
                  {matchData.innings1.overHistory?.length > 0 && (
                    <View style={styles.shareableOverHistory}>
                      <Text style={styles.shareableOverHistoryTitle}>Over by Over</Text>
                      {matchData.innings1.overHistory.map((over, idx) => (
                        <View key={idx} style={styles.shareableOverItem}>
                          <Text style={styles.shareableOverNumber}>Ov {over.overNumber || idx + 1}</Text>
                          <View style={styles.shareableOverBalls}>
                            {(over.balls || []).map((ball, bIdx) => (
                              <View key={bIdx} style={[styles.shareableOverBall, { backgroundColor: getBallColor(ball) }]}>
                                <Text style={styles.shareableOverBallText}>{ball}</Text>
                              </View>
                            ))}
                          </View>
                          <Text style={styles.shareableOverRuns}>{over.runs}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Second Innings */}
              {matchData?.innings2 && (
                <View style={styles.shareableInnings}>
                  <View style={styles.shareableInningsHeader}>
                    <Text style={styles.shareableInningsTitle}>
                      2nd Innings - {matchData.innings2.battingTeam || matchData?.teamB?.name}
                    </Text>
                    <Text style={styles.shareableInningsScore}>
                      {matchData.innings2.runs}/{matchData.innings2.wickets} ({matchData.innings2.overs} ov)
                    </Text>
                  </View>

                  {/* Batting */}
                  <View style={styles.shareableTable}>
                    <View style={styles.shareableTableHeader}>
                      <Text style={[styles.shareableTableHeaderText, styles.shareableNameCol]}>Batsman</Text>
                      <Text style={styles.shareableTableHeaderText}>R</Text>
                      <Text style={styles.shareableTableHeaderText}>B</Text>
                      <Text style={styles.shareableTableHeaderText}>4s</Text>
                      <Text style={styles.shareableTableHeaderText}>6s</Text>
                      <Text style={styles.shareableTableHeaderText}>SR</Text>
                    </View>
                    {(matchData.innings2.batting || [])
                      .filter(b => (b.balls || 0) > 0 || (b.runs || 0) > 0 || b.isOut)
                      .map((batsman, idx) => (
                        <View key={idx} style={styles.shareableTableRow}>
                          <Text style={[styles.shareableTableCell, styles.shareableNameCol]} numberOfLines={1}>
                            {batsman.name}
                          </Text>
                          <Text style={[styles.shareableTableCell, styles.shareableRunsCell]}>{batsman.runs || 0}</Text>
                          <Text style={styles.shareableTableCell}>{batsman.balls || 0}</Text>
                          <Text style={styles.shareableTableCell}>{batsman.fours || 0}</Text>
                          <Text style={styles.shareableTableCell}>{batsman.sixes || 0}</Text>
                          <Text style={styles.shareableTableCell}>{calculateStrikeRate(batsman.runs, batsman.balls)}</Text>
                        </View>
                      ))}
                  </View>

                  {/* Bowling */}
                  <View style={[styles.shareableTable, { marginTop: 8 }]}>
                    <View style={[styles.shareableTableHeader, styles.shareableBowlingHeader]}>
                      <Text style={[styles.shareableTableHeaderText, styles.shareableNameCol]}>Bowler</Text>
                      <Text style={styles.shareableTableHeaderText}>O</Text>
                      <Text style={styles.shareableTableHeaderText}>M</Text>
                      <Text style={styles.shareableTableHeaderText}>R</Text>
                      <Text style={styles.shareableTableHeaderText}>W</Text>
                      <Text style={styles.shareableTableHeaderText}>ER</Text>
                    </View>
                    {(matchData.innings2.bowling || [])
                      .filter(b => b.overs && b.overs !== '0.0')
                      .map((bowler, idx) => (
                        <View key={idx} style={styles.shareableTableRow}>
                          <Text style={[styles.shareableTableCell, styles.shareableNameCol]} numberOfLines={1}>
                            {bowler.name}
                          </Text>
                          <Text style={styles.shareableTableCell}>{bowler.overs || '0.0'}</Text>
                          <Text style={styles.shareableTableCell}>{bowler.maidens || 0}</Text>
                          <Text style={styles.shareableTableCell}>{bowler.runs || 0}</Text>
                          <Text style={[styles.shareableTableCell, styles.shareableWicketsCell]}>{bowler.wickets || 0}</Text>
                          <Text style={styles.shareableTableCell}>{calculateEconomyRate(bowler.overs, bowler.runs)}</Text>
                        </View>
                      ))}
                  </View>

                  {/* Over by Over */}
                  {matchData.innings2.overHistory?.length > 0 && (
                    <View style={styles.shareableOverHistory}>
                      <Text style={styles.shareableOverHistoryTitle}>Over by Over</Text>
                      {matchData.innings2.overHistory.map((over, idx) => (
                        <View key={idx} style={styles.shareableOverItem}>
                          <Text style={styles.shareableOverNumber}>Ov {over.overNumber || idx + 1}</Text>
                          <View style={styles.shareableOverBalls}>
                            {(over.balls || []).map((ball, bIdx) => (
                              <View key={bIdx} style={[styles.shareableOverBall, { backgroundColor: getBallColor(ball) }]}>
                                <Text style={styles.shareableOverBallText}>{ball}</Text>
                              </View>
                            ))}
                          </View>
                          <Text style={styles.shareableOverRuns}>{over.runs}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Footer */}
              <View style={styles.shareableFooter}>
                <Text style={styles.shareableFooterText}>Generated by CricZone App</Text>
              </View>
            </View>
            </ViewShot>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  newMatchButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surfaceGray,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  loadingSubtext: {
    fontSize: 14,
    color: colors.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  errorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  errorButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  matchHeader: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  matchTeamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
  },
  teamAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  teamAvatarB: {
    backgroundColor: colors.secondary,
  },
  teamAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.surface,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  teamScore: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  vsBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  vsText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textMuted,
  },
  matchInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  matchInfoItem: {
    alignItems: 'center',
  },
  matchInfoLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  resultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  resultIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  resultText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.surface,
    lineHeight: 24,
  },
  // Net Run Rate Styles
  nrrContainer: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  nrrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  nrrIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  nrrIcon: {
    fontSize: 18,
  },
  nrrTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  nrrTeamsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  nrrTeamCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  nrrTeamBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  nrrTeamBadgeText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.surface,
  },
  nrrTeamName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
    maxWidth: '90%',
  },
  nrrValueContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 90,
    alignItems: 'center',
  },
  nrrLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  nrrValuePositive: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  nrrValueNegative: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  nrrValueText: {
    fontSize: 20,
    fontWeight: '800',
  },
  nrrPositive: {
    color: colors.success,
  },
  nrrNegative: {
    color: colors.error,
  },
  nrrDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 12,
    marginVertical: 8,
  },
  allOutBadge: {
    backgroundColor: colors.error,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  allOutBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.surface,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nrrNoteContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  nrrNoteText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  inningsTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 6,
    marginBottom: 16,
    position: 'relative',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tabIndicator: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: '50%',
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  inningsTab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    zIndex: 1,
  },
  inningsTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  inningsTabTextActive: {
    color: colors.surface,
  },
  inningsSection: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  inningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  inningsTeamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teamBadgeText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.surface,
  },
  inningsTeamName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  inningsScoreContainer: {
    alignItems: 'flex-end',
  },
  inningsScore: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
  },
  inningsWickets: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  oversContainer: {
    backgroundColor: colors.surfaceGray,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  inningsOvers: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  yetToBat: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  yetToBatText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 12,
  },
  yetToBatSubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tableContainer: {
    backgroundColor: colors.surfaceGray,
    borderRadius: 14,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  bowlingHeader: {
    backgroundColor: colors.secondary,
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: colors.surface,
    textAlign: 'center',
  },
  nameColumn: {
    flex: 2.5,
    textAlign: 'left',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  playerStatus: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  playerStatusOut: {
    color: colors.error,
  },
  statText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  runsText: {
    fontWeight: '700',
    color: colors.primary,
  },
  wicketsText: {
    fontWeight: '700',
    color: colors.success,
  },
  srText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  erText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  noDataContainer: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: colors.surfaceGray,
    borderRadius: 14,
  },
  noDataText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 12,
  },
  extrasContainer: {
    backgroundColor: colors.surfaceGray,
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
  },
  extrasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  extrasTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  extrasTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  extrasDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  extraItem: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  extraLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  extraValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  fowContainer: {
    backgroundColor: colors.surfaceGray,
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
  },
  fowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  fowList: {
    gap: 10,
  },
  fowItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fowBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fowWicket: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.surface,
  },
  fowDetails: {
    flex: 1,
  },
  fowScore: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  fowInfo: {
    fontSize: 12,
    color: colors.textMuted,
  },
  // Over History
  overHistoryContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  overHistoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  overHistoryList: {},
  overHistoryItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  overHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  overHistoryNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    width: 55,
  },
  overHistoryBowler: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
  },
  overHistoryStats: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  overHistoryBalls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  overHistoryBall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 28,
    alignItems: 'center',
  },
  overHistoryBallText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.surface,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  buttonWrapper: {
    flex: 1,
  },
  dashboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: 8,
  },
  dashboardButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  newMatchButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  newMatchButtonLargeText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.surface,
  },
  // Share Modal Styles
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  shareCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  shareCloseButtonText: {
    fontSize: 20,
    color: colors.surface,
    fontWeight: '600',
  },
  shareLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  shareLoadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: colors.surface,
  },
  shareableScrollView: {
    flex: 1,
  },
  shareableScrollContent: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  // Shareable Scorecard Styles
  shareableContainer: {
    width: width - 40,
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  shareableCard: {
    backgroundColor: colors.surface,
    borderRadius: 0,
    overflow: 'hidden',
  },
  shareableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    padding: 16,
  },
  shareableLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 12,
  },
  shareableHeaderText: {
    flex: 1,
  },
  shareableAppName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.surface,
  },
  shareableTagline: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  shareableMatchTitle: {
    padding: 16,
    backgroundColor: colors.surfaceGray,
    alignItems: 'center',
  },
  shareableMatchTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  shareableMatchInfo: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  shareableResult: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
  },
  shareableResultText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surface,
    textAlign: 'center',
  },
  shareableScores: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
  },
  shareableTeamScore: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareableTeamBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  shareableTeamBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.surface,
  },
  shareableTeamInfo: {
    flex: 1,
  },
  shareableTeamName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  shareableTeamScoreText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  shareableOvers: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  shareableVsDivider: {
    paddingHorizontal: 12,
  },
  shareableVsText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  shareableNRR: {
    backgroundColor: colors.surfaceGray,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 12,
  },
  shareableNRRTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  shareableNRRRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareableNRRItem: {
    flex: 1,
    alignItems: 'center',
  },
  shareableNRRTeam: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  shareableNRRValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  shareableNRRPositive: {
    color: colors.success,
  },
  shareableNRRNegative: {
    color: colors.error,
  },
  shareableNRRDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
  shareableInnings: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.surfaceGray,
    borderRadius: 12,
    overflow: 'hidden',
  },
  shareableInningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  shareableInningsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.surface,
  },
  shareableInningsScore: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.surface,
  },
  shareableTable: {
    backgroundColor: colors.surface,
  },
  shareableTableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  shareableBowlingHeader: {
    backgroundColor: colors.secondary,
  },
  shareableTableHeaderText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: colors.surface,
    textAlign: 'center',
  },
  shareableNameCol: {
    flex: 2.5,
    textAlign: 'left',
  },
  shareableTableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    alignItems: 'center',
  },
  shareableTableCell: {
    flex: 1,
    fontSize: 11,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  shareableRunsCell: {
    fontWeight: '700',
    color: colors.primary,
  },
  shareableWicketsCell: {
    fontWeight: '700',
    color: colors.success,
  },
  // Shareable Over History
  shareableOverHistory: {
    padding: 8,
    backgroundColor: colors.surface,
  },
  shareableOverHistoryTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  shareableOverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  shareableOverNumber: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    width: 30,
  },
  shareableOverBalls: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  shareableOverBall: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 18,
    alignItems: 'center',
  },
  shareableOverBallText: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.surface,
  },
  shareableOverRuns: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    width: 22,
    textAlign: 'right',
  },
  shareableFooter: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shareableFooterText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
});

export default FullScorecardScreen;
