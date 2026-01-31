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

  const getScore = (innings) => {
    if (!innings) return '-';
    return `${innings.runs || 0}/${innings.wickets || 0}`;
  };

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
        <View style={styles.matchCardHeader}>
          <View style={[
            styles.matchStatusDot,
            { backgroundColor: isCompleted ? '#059669' : '#2563eb' }
          ]} />
          <Text style={styles.matchStatusLabel}>
            {isCompleted ? 'Completed' : 'In Progress'}
          </Text>
        </View>

        <View style={styles.matchTeams}>
          <View style={styles.matchTeamRow}>
            <View style={styles.matchTeamBadge}>
              <Text style={styles.matchTeamInitial}>{teamA.charAt(0)}</Text>
            </View>
            <Text style={styles.matchTeamName} numberOfLines={1}>{teamA}</Text>
            <Text style={styles.matchTeamScore}>{getScore(match.innings1)}</Text>
          </View>
          <View style={styles.matchTeamRow}>
            <View style={[styles.matchTeamBadge, styles.matchTeamBadgeB]}>
              <Text style={styles.matchTeamInitial}>{teamB.charAt(0)}</Text>
            </View>
            <Text style={styles.matchTeamName} numberOfLines={1}>{teamB}</Text>
            <Text style={styles.matchTeamScore}>{getScore(match.innings2)}</Text>
          </View>
        </View>

        {isCompleted && match.result && (
          <Text style={styles.matchResult} numberOfLines={1}>{match.result}</Text>
        )}
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

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const fetchData = useCallback(async () => {
    if (!user?.token) return;

    try {
      setError('');
      const [tournamentRes, statsRes] = await Promise.all([
        tournamentService.getTournament(tournamentId, user.token),
        tournamentService.getTournamentStats(tournamentId, user.token),
      ]);

      const data = tournamentRes.data;
      setTournament(data);
      setMatches(data.matches || []);
      setStats(statsRes.data);
    } catch (err) {
      console.warn('Fetch tournament error:', err);
      setError('Failed to load tournament.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, user?.token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

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
      {stats && (stats.totalMatches > 0) && (
        <View style={styles.statsSection}>
          <TouchableOpacity
            style={styles.statsToggle}
            onPress={() => setShowStats(!showStats)}
            activeOpacity={0.7}
          >
            <Text style={styles.statsToggleText}>Tournament Stats</Text>
            <View style={[
              styles.statsChevron,
              showStats && styles.statsChevronOpen,
            ]} />
          </TouchableOpacity>

          {showStats && (
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
                  </View>
                )}
                {stats.bestBowling && (
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{stats.bestBowling.wickets}/{stats.bestBowling.runs}</Text>
                    <Text style={styles.statLabel}>Best Bowling</Text>
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
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    ...shadows.sm,
    shadowColor: '#0f172a',
  },
  matchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  matchStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  matchStatusLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  matchTeams: {
    gap: 6,
  },
  matchTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchTeamBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#0d3b66',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  matchTeamBadgeB: {
    backgroundColor: '#2d7dd2',
  },
  matchTeamInitial: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  matchTeamName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  matchTeamScore: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  matchResult: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d97706',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
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
