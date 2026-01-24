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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import matchService from '../utils/matchService';

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
        <TouchableOpacity
          style={styles.newMatchButton}
          onPress={() => navigation.navigate('MatchSetup')}
          activeOpacity={0.8}
        >
          <PlusIcon size={20} color={colors.surface} />
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
        <View style={styles.actionButtons}>
          <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: buttonScale }] }]}>
            <TouchableOpacity
              style={styles.dashboardButton}
              onPress={handleGoToDashboard}
              onPressIn={handleButtonPressIn}
              onPressOut={handleButtonPressOut}
              activeOpacity={0.9}
            >
              <HomeIcon size={20} color={colors.primary} />
              <Text style={styles.dashboardButtonText}>Dashboard</Text>
            </TouchableOpacity>
          </Animated.View>
          <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: buttonScale }] }]}>
            <TouchableOpacity
              style={styles.newMatchButtonLarge}
              onPress={() => navigation.navigate('MatchSetup')}
              onPressIn={handleButtonPressIn}
              onPressOut={handleButtonPressOut}
              activeOpacity={0.9}
            >
              <PlusIcon size={20} color={colors.surface} />
              <Text style={styles.newMatchButtonLargeText}>New Match</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>
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
});

export default FullScorecardScreen;
