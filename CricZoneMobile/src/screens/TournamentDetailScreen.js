import React, { useState, useContext, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import tournamentService from '../utils/tournamentService';
import StatsTable from '../components/StatsTable';
import { shadows } from '../utils/theme';

const statusConfig = {
  upcoming: { label: 'Upcoming', bg: '#fef3c7', color: '#d97706' },
  in_progress: { label: 'In Progress', bg: '#dbeafe', color: '#2563eb' },
  completed: { label: 'Completed', bg: '#d1fae5', color: '#059669' },
};

const oversToDecimal = (overs) => {
  if (!overs && overs !== 0) return 0;
  const parts = overs.toString().split('.');
  const whole = parseInt(parts[0]) || 0;
  const balls = parseInt(parts[1]) || 0;
  return whole + (balls / 6);
};

const calculateMatchNRR = (match) => {
  if (!match.innings1 || !match.innings2) return null;
  const scheduledOvers = match.totalOvers || 20;
  const allOutWickets = (match.playersPerTeam || 11) - 1;

  const i1 = match.innings1;
  const i2 = match.innings2;

  const aRuns = i1.runs || 0;
  const aOvers = (i1.wickets || 0) >= allOutWickets ? scheduledOvers : oversToDecimal(i1.overs);
  const bRuns = i2.runs || 0;
  const bOvers = (i2.wickets || 0) >= allOutWickets ? scheduledOvers : oversToDecimal(i2.overs);

  if (aOvers === 0 || bOvers === 0) return null;

  const aNRR = (aRuns / aOvers) - (bRuns / bOvers);
  const bNRR = (bRuns / bOvers) - (aRuns / aOvers);

  return {
    teamA: { name: match.teamA?.name || 'Team A', nrr: aNRR.toFixed(2) },
    teamB: { name: match.teamB?.name || 'Team B', nrr: bNRR.toFixed(2) },
  };
};

// Simple match card for tournament matches
const TournamentMatchCard = ({ match, index, onPress }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const isCompleted = match.status === 'completed';
  const teamA = match.teamA?.name || 'Team A';
  const teamB = match.teamB?.name || 'Team B';
  const accentColor = isCompleted ? '#059669' : '#2563eb';

  const getScore = (innings) => {
    if (!innings) return null;
    return { runs: innings.runs || 0, wickets: innings.wickets || 0, overs: innings.overs || '0.0' };
  };

  const scoreA = getScore(match.innings1);
  const scoreB = getScore(match.innings2);
  const nrr = isCompleted ? calculateMatchNRR(match) : null;

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <TouchableOpacity
        style={styles.matchCard}
        onPress={() => onPress(match)}
        activeOpacity={0.7}
      >
        {/* Accent strip */}
        <View style={[styles.matchAccent, { backgroundColor: accentColor }]} />

        <View style={styles.matchCardInner}>
          {/* Header: status + match number */}
          <View style={styles.matchCardHeader}>
            <View style={[styles.matchStatusPill, { backgroundColor: isCompleted ? '#ecfdf5' : '#eff6ff' }]}>
              <View style={[styles.matchStatusDot, { backgroundColor: accentColor }]} />
              <Text style={[styles.matchStatusLabel, { color: accentColor }]}>
                {isCompleted ? 'Completed' : 'Live'}
              </Text>
            </View>
            {match.totalOvers ? (
              <Text style={styles.matchOversLabel}>{match.totalOvers} ov</Text>
            ) : null}
          </View>

          {/* Teams & Scores */}
          <View style={styles.matchTeams}>
            <View style={styles.matchTeamRow}>
              <View style={styles.matchTeamBadge}>
                <Text style={styles.matchTeamInitial}>{teamA.charAt(0)}</Text>
              </View>
              <Text style={styles.matchTeamName} numberOfLines={1}>{teamA}</Text>
              {scoreA ? (
                <Text style={styles.matchTeamScore}>
                  {scoreA.runs}/{scoreA.wickets}
                  <Text style={styles.matchTeamOvers}> ({scoreA.overs})</Text>
                </Text>
              ) : (
                <Text style={styles.matchTeamScorePending}>-</Text>
              )}
            </View>
            <View style={styles.matchTeamRow}>
              <View style={[styles.matchTeamBadge, styles.matchTeamBadgeB]}>
                <Text style={styles.matchTeamInitial}>{teamB.charAt(0)}</Text>
              </View>
              <Text style={styles.matchTeamName} numberOfLines={1}>{teamB}</Text>
              {scoreB ? (
                <Text style={styles.matchTeamScore}>
                  {scoreB.runs}/{scoreB.wickets}
                  <Text style={styles.matchTeamOvers}> ({scoreB.overs})</Text>
                </Text>
              ) : (
                <Text style={styles.matchTeamScorePending}>-</Text>
              )}
            </View>
          </View>

          {/* Result + NRR on same line */}
          {isCompleted && (match.result || nrr) && (
            <View style={styles.matchFooter}>
              {match.result ? (
                <Text style={styles.matchResult} numberOfLines={1}>{match.result}</Text>
              ) : <View />}
              {nrr && (
                <View style={styles.matchNRRRow}>
                  <Text style={[
                    styles.matchNRRValue,
                    parseFloat(nrr.teamA.nrr) >= 0 ? styles.matchNRRPositive : styles.matchNRRNegative,
                  ]}>
                    {parseFloat(nrr.teamA.nrr) >= 0 ? '+' : ''}{nrr.teamA.nrr}
                  </Text>
                  <Text style={styles.matchNRRSep}>/</Text>
                  <Text style={[
                    styles.matchNRRValue,
                    parseFloat(nrr.teamB.nrr) >= 0 ? styles.matchNRRPositive : styles.matchNRRNegative,
                  ]}>
                    {parseFloat(nrr.teamB.nrr) >= 0 ? '+' : ''}{nrr.teamB.nrr}
                  </Text>
                  <Text style={styles.matchNRRLabel}>NRR</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const TournamentDetailScreen = ({ navigation, route }) => {
  const { user } = useContext(AuthContext);
  const { tournamentId } = route.params;

  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const hasFetchedOnce = useRef(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const fetchTournament = useCallback(async (showLoader = false) => {
    if (!user?.token) return;

    try {
      if (showLoader) setLoading(true);
      setError('');
      const tournamentRes = await tournamentService.getTournament(tournamentId, user.token);
      const data = tournamentRes.data;
      setTournament(data);
      setMatches(data.matches || []);
    } catch (err) {
      console.warn('Fetch tournament error:', err);
      if (!hasFetchedOnce.current) setError('Failed to load tournament.');
    } finally {
      setLoading(false);
      hasFetchedOnce.current = true;
    }
  }, [tournamentId, user?.token]);

  const fetchStats = useCallback(async () => {
    if (!user?.token) return;
    try {
      setStatsLoading(true);
      const statsRes = await tournamentService.getTournamentStats(tournamentId, user.token);
      setStats(statsRes.data);
    } catch (err) {
      console.warn('Fetch stats error:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [tournamentId, user?.token]);

  useFocusEffect(
    useCallback(() => {
      if (!hasFetchedOnce.current) {
        // First load — show spinner
        fetchTournament(true);
      } else {
        // Re-focus — background refresh, no spinner
        fetchTournament(false);
      }
    }, [fetchTournament])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchTournament(false),
      showStats ? fetchStats() : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [fetchTournament, fetchStats, showStats]);

  const handleMatchPress = (match) => {
    if (match.status === 'completed') {
      navigation.navigate('FullScorecard', { matchId: match._id });
    } else {
      navigation.navigate('ScoreCard', {
        matchData: match,
        matchSettings: {
          totalOvers: match.totalOvers,
          ballsPerOver: match.ballsPerOver,
          playersPerTeam: match.playersPerTeam,
        },
      });
    }
  };

  const handleNewMatch = () => {
    if (!tournament) return;
    navigation.navigate('MatchSetup', {
      tournamentId: tournament._id,
      tournamentDefaults: {
        totalOvers: tournament.totalOvers,
        playersPerTeam: tournament.playersPerTeam,
        ballsPerOver: tournament.ballsPerOver,
        teamNames: tournament.teamNames,
        venue: tournament.venue,
        tournamentName: tournament.name,
      },
    });
  };

  const handleEdit = () => {
    if (!tournament) return;
    navigation.navigate('TournamentCreate', {
      tournamentId: tournament._id,
      tournamentData: tournament,
    });
  };

  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (!user?.token || !tournament) return;
    try {
      setSharing(true);
      const res = await tournamentService.generateShareLink(tournament._id, user.token);
      if (res.success && res.data?.shareUrl) {
        await Share.share({
          message: `Check out ${tournament.name} on CricZone!\n${res.data.shareUrl}`,
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to generate share link.');
    } finally {
      setSharing(false);
    }
  }, [tournament, user?.token]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#d97706" />
          <Text style={styles.loadingText}>Loading tournament...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !tournament) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Tournament not found.'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const status = statusConfig[tournament.status] || statusConfig.upcoming;

  const ListHeader = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      {/* Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Teams</Text>
            <Text style={styles.infoValue}>{tournament.numberOfTeams}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Overs</Text>
            <Text style={styles.infoValue}>{tournament.totalOvers}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Players</Text>
            <Text style={styles.infoValue}>{tournament.playersPerTeam}</Text>
          </View>
        </View>

        {tournament.venue ? (
          <View style={styles.venueRow}>
            <Text style={styles.venueLabel}>Venue:</Text>
            <Text style={styles.venueValue}>{tournament.venue}</Text>
          </View>
        ) : null}

        {tournament.teamNames?.length > 0 && (
          <View style={styles.teamNamesContainer}>
            <Text style={styles.teamNamesLabel}>Teams:</Text>
            <View style={styles.teamPills}>
              {tournament.teamNames.filter(Boolean).map((tn, i) => (
                <View key={i} style={styles.teamPill}>
                  <Text style={styles.teamPillText}>{tn}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Stats Section */}
      {matches.length > 0 && (
        <View style={styles.statsSection}>
          <TouchableOpacity
            style={styles.statsToggle}
            onPress={() => {
              const next = !showStats;
              setShowStats(next);
              if (next && !stats) fetchStats();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.statsToggleText}>Tournament Stats</Text>
            <View style={[
              styles.statsChevron,
              showStats && styles.statsChevronOpen,
            ]} />
          </TouchableOpacity>

          {showStats && statsLoading && !stats && (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#d97706" />
            </View>
          )}

          {showStats && stats && (
            <View style={styles.statsContent}>
              {/* Overview */}
              <View style={styles.statsOverview}>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{stats.totalMatches}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{stats.completedMatches}</Text>
                  <Text style={styles.statLabel}>Completed</Text>
                </View>
                {stats.mostRunsInMatch && (
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{stats.mostRunsInMatch.runs}</Text>
                    <Text style={styles.statLabel}>Best Score</Text>
                    <Text style={styles.statSubLabel} numberOfLines={1}>
                      {stats.mostRunsInMatch.name}{stats.mostRunsInMatch.team ? ` (${stats.mostRunsInMatch.team})` : ''}
                    </Text>
                  </View>
                )}
                {stats.bestBowling && (
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{stats.bestBowling.wickets}/{stats.bestBowling.runs}</Text>
                    <Text style={styles.statLabel}>Best Bowling</Text>
                    <Text style={styles.statSubLabel} numberOfLines={1}>
                      {stats.bestBowling.name}{stats.bestBowling.team ? ` (${stats.bestBowling.team})` : ''}
                    </Text>
                  </View>
                )}
              </View>

              {/* Top Scorers */}
              <StatsTable
                title="Top Run Scorers"
                data={stats.topRunScorers}
                columns={[
                  { key: 'totalRuns', label: 'Runs' },
                  { key: 'innings', label: 'Inn' },
                ]}
              />

              {/* Top Wicket Takers */}
              <StatsTable
                title="Top Wicket Takers"
                data={stats.topWicketTakers}
                columns={[
                  { key: 'totalWickets', label: 'Wkts' },
                  { key: 'totalRuns', label: 'Runs' },
                  { key: 'innings', label: 'Inn' },
                ]}
              />
            </View>
          )}
        </View>
      )}

      {/* Matches Header */}
      <View style={styles.matchesHeader}>
        <Text style={styles.matchesTitle}>
          Matches ({matches.length})
        </Text>
      </View>
    </Animated.View>
  );

  const renderEmptyMatches = () => (
    <View style={styles.emptyMatches}>
      <Text style={styles.emptyMatchesTitle}>No matches yet</Text>
      <Text style={styles.emptyMatchesText}>
        Tap the button below to start your first match
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <View style={styles.backArrow} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{tournament.name}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            activeOpacity={0.7}
            disabled={sharing}
          >
            {sharing ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <View style={styles.shareIcon}>
                <View style={styles.shareArrow} />
                <View style={styles.shareBase} />
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEdit}
            activeOpacity={0.7}
          >
            <View style={styles.pencilIcon}>
              <View style={styles.pencilBody} />
              <View style={styles.pencilTip} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={matches}
        renderItem={({ item, index }) => (
          <TournamentMatchCard
            match={item}
            index={index}
            onPress={handleMatchPress}
          />
        )}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={renderEmptyMatches}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#d97706']}
            tintColor="#d97706"
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* New Match FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleNewMatch}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>New Match</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    width: 12,
    height: 12,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: '#64748b',
    transform: [{ rotate: '45deg' }, { translateX: 2 }],
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#2563eb',
    marginBottom: 1,
  },
  shareBase: {
    width: 2,
    height: 8,
    backgroundColor: '#2563eb',
    borderRadius: 1,
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pencilIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pencilBody: {
    width: 4,
    height: 14,
    backgroundColor: '#d97706',
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },
  pencilTip: {
    position: 'absolute',
    bottom: 0,
    left: 6,
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#d97706',
    transform: [{ rotate: '-45deg' }],
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  // Info Card
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...shadows.md,
    shadowColor: '#0f172a',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  venueLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginRight: 8,
  },
  venueValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  teamNamesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  teamNamesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  teamPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  teamPill: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  teamPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400e',
  },
  // Stats
  statsSection: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    ...shadows.md,
    shadowColor: '#0f172a',
    overflow: 'hidden',
  },
  statsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
  },
  statsToggleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  statsChevron: {
    width: 10,
    height: 10,
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: '#94a3b8',
    transform: [{ rotate: '45deg' }],
  },
  statsChevronOpen: {
    transform: [{ rotate: '-135deg' }],
  },
  statsContent: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  statsOverview: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  statSubLabel: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  // Matches
  matchesHeader: {
    marginBottom: 12,
    marginTop: 4,
  },
  matchesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  matchCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 10,
    ...shadows.md,
    shadowColor: '#0f172a',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  matchAccent: {
    width: 4,
  },
  matchCardInner: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  matchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  matchStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 4,
  },
  matchStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  matchStatusLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  matchOversLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
  },
  matchTeams: {
    gap: 4,
  },
  matchTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchTeamBadge: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#0d3b66',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  matchTeamBadgeB: {
    backgroundColor: '#2d7dd2',
  },
  matchTeamInitial: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  matchTeamName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  matchTeamScore: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  matchTeamOvers: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
  },
  matchTeamScorePending: {
    fontSize: 14,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  matchFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  matchResult: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#d97706',
    marginRight: 8,
  },
  matchNRRRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  matchNRRLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    marginLeft: 3,
  },
  matchNRRValue: {
    fontSize: 10,
    fontWeight: '800',
  },
  matchNRRPositive: {
    color: '#059669',
  },
  matchNRRNegative: {
    color: '#ef4444',
  },
  matchNRRSep: {
    fontSize: 9,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  emptyMatches: {
    alignItems: 'center',
    padding: 32,
  },
  emptyMatchesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 8,
  },
  emptyMatchesText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  // Loading & Error
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#94a3b8',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 15,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#d97706',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: '#d97706',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 20,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  fabText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default TournamentDetailScreen;
