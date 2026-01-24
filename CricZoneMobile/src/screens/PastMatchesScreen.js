import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import matchService from '../utils/matchService';

const { width } = Dimensions.get('window');

// Brand colors
const colors = {
  primary: '#0d3b66',
  secondary: '#2d7dd2',
  accent: '#5dade2',
  light: '#a8d8ea',
  background: '#f0f7ff',
  white: '#ffffff',
  text: '#0d3b66',
  textLight: '#5a7a9a',
  textMuted: '#94a3b8',
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  error: '#ef4444',
  errorLight: '#fee2e2',
  border: '#e2e8f0',
};

// Custom Icons
const TrophyIcon = ({ size = 24, color = colors.warning }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.trophyCup, { borderColor: color, width: size * 0.7, height: size * 0.55 }]} />
    <View style={[styles.trophyBase, { backgroundColor: color, width: size * 0.5, height: size * 0.15 }]} />
  </View>
);

const ClockIcon = ({ size = 20, color = colors.secondary }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.clockFace, { borderColor: color, width: size * 0.9, height: size * 0.9 }]}>
      <View style={[styles.clockHand, { backgroundColor: color, height: size * 0.3 }]} />
      <View style={[styles.clockHandShort, { backgroundColor: color, width: size * 0.2 }]} />
    </View>
  </View>
);

const TrashIcon = ({ size = 20, color = colors.error }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.trashTop, { backgroundColor: color, width: size * 0.7 }]} />
    <View style={[styles.trashBody, { borderColor: color, width: size * 0.6, height: size * 0.6 }]} />
  </View>
);

const ChevronRightIcon = ({ size = 20, color = colors.white }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.chevron, { borderColor: color }]} />
  </View>
);

const LockIcon = ({ size = 50, color = colors.secondary }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.lockTop, { borderColor: color, width: size * 0.5, height: size * 0.4 }]} />
    <View style={[styles.lockBody, { backgroundColor: color, width: size * 0.6, height: size * 0.45 }]} />
  </View>
);

const CricketIcon = ({ size = 60, color = colors.secondary }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.cricketBat, { backgroundColor: color }]} />
    <View style={[styles.cricketBall, { backgroundColor: colors.error }]} />
  </View>
);

// Animated Match Card Component
const MatchCard = ({ match, index, onView, onDelete, navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const isCompleted = match.status === 'completed';
  const teamAName = match.teamA?.name || 'Team A';
  const teamBName = match.teamB?.name || 'Team B';

  const parseResult = () => {
    if (!match.result) return 'Match in progress';
    return match.result;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-GB', options);
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onView(match, isCompleted)}
      >
        <View style={styles.matchCard}>
          {/* Card Header with Status */}
          <View style={styles.cardHeader}>
            <View style={[
              styles.statusPill,
              isCompleted ? styles.completedPill : styles.inProgressPill
            ]}>
              {isCompleted ? (
                <TrophyIcon size={14} color={colors.success} />
              ) : (
                <ClockIcon size={14} color={colors.secondary} />
              )}
              <Text style={[
                styles.statusText,
                isCompleted ? styles.completedText : styles.inProgressText
              ]}>
                {isCompleted ? 'Completed' : 'In Progress'}
              </Text>
            </View>
            <View style={styles.dateContainer}>
              <Text style={styles.dateText}>{formatDate(match.updatedAt)}</Text>
              <Text style={styles.timeText}>{formatTime(match.updatedAt)}</Text>
            </View>
          </View>

          {/* Teams Section */}
          <View style={styles.teamsSection}>
            <View style={styles.teamRow}>
              <View style={styles.teamBadge}>
                <Text style={styles.teamInitial}>{teamAName.charAt(0)}</Text>
              </View>
              <Text style={styles.teamName} numberOfLines={1}>{teamAName}</Text>
              {match.teamA?.runs !== undefined && (
                <Text style={styles.teamScore}>
                  {match.teamA.runs}/{match.teamA.wickets || 0}
                </Text>
              )}
            </View>

            <View style={styles.vsDivider}>
              <View style={styles.vsLine} />
              <Text style={styles.vsText}>VS</Text>
              <View style={styles.vsLine} />
            </View>

            <View style={styles.teamRow}>
              <View style={[styles.teamBadge, styles.teamBadgeB]}>
                <Text style={styles.teamInitial}>{teamBName.charAt(0)}</Text>
              </View>
              <Text style={styles.teamName} numberOfLines={1}>{teamBName}</Text>
              {match.teamB?.runs !== undefined && (
                <Text style={styles.teamScore}>
                  {match.teamB.runs}/{match.teamB.wickets || 0}
                </Text>
              )}
            </View>
          </View>

          {/* Result Section */}
          {isCompleted && (
            <View style={styles.resultSection}>
              <TrophyIcon size={18} color={colors.warning} />
              <Text style={styles.resultText} numberOfLines={1}>{parseResult()}</Text>
            </View>
          )}

          {/* Card Footer */}
          <View style={styles.cardFooter}>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => onView(match, isCompleted)}
              activeOpacity={0.8}
            >
              <Text style={styles.viewButtonText}>
                {isCompleted ? 'View Scorecard' : 'Continue Match'}
              </Text>
              <ChevronRightIcon size={16} color={colors.white} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDelete(match)}
              activeOpacity={0.7}
            >
              <TrashIcon size={18} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const PastMatchesScreen = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [matchToDelete, setMatchToDelete] = useState(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  // Header animation
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    fetchMatches();
  }, [user]);

  const fetchMatches = async () => {
    if (!user?.token) {
      setError('You must be logged in to view past matches.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const userMatches = await matchService.getMyMatches(user.token);
      const sortedMatches = (userMatches || []).sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      );
      setMatches(sortedMatches);
    } catch (err) {
      setError('Failed to fetch matches. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMatches();
    setRefreshing(false);
  }, [user]);

  const handleDeleteMatch = async () => {
    if (!matchToDelete || !user?.token) return;

    try {
      await matchService.deleteMatch(matchToDelete._id, user.token);
      setMatches(prev => prev.filter(m => m._id !== matchToDelete._id));
    } catch (err) {
      setError('Failed to delete match.');
    } finally {
      setMatchToDelete(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!user?.token) return;

    try {
      await matchService.deleteAllMatches(user.token);
      setMatches([]);
    } catch (err) {
      setError('Failed to delete all matches.');
    } finally {
      setShowDeleteAllModal(false);
    }
  };

  const handleViewMatch = (match, isCompleted) => {
    if (isCompleted) {
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

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <CricketIcon size={70} color={colors.light} />
      </View>
      <Text style={styles.emptyTitle}>No Matches Yet</Text>
      <Text style={styles.emptyText}>
        Start playing and your match history{'\n'}will appear here
      </Text>
      <TouchableOpacity
        style={styles.newMatchButton}
        onPress={() => navigation.navigate('MatchSetup')}
        activeOpacity={0.8}
      >
        <Text style={styles.newMatchButtonText}>Start New Match</Text>
      </TouchableOpacity>
    </View>
  );

  // Login Required Screen
  if (!user?.token) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Match History</Text>
        </View>
        <View style={styles.loginPrompt}>
          <View style={styles.lockIconContainer}>
            <LockIcon size={60} color={colors.secondary} />
          </View>
          <Text style={styles.loginTitle}>Login Required</Text>
          <Text style={styles.loginText}>
            Please login to view and manage{'\n'}your match history
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Auth')}
            activeOpacity={0.8}
          >
            <Text style={styles.loginButtonText}>Login to Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Animated Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerAnim,
            transform: [{
              translateY: headerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0],
              })
            }]
          }
        ]}
      >
        <View>
          <Text style={styles.headerTitle}>Match History</Text>
          <Text style={styles.headerSubtitle}>
            {matches.length} {matches.length === 1 ? 'match' : 'matches'} played
          </Text>
        </View>
        {matches.length > 0 && (
          <TouchableOpacity
            style={styles.deleteAllButton}
            onPress={() => setShowDeleteAllModal(true)}
            activeOpacity={0.7}
          >
            <TrashIcon size={16} color={colors.error} />
            <Text style={styles.deleteAllText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.secondary} />
          <Text style={styles.loadingText}>Loading matches...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchMatches}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={matches}
          renderItem={({ item, index }) => (
            <MatchCard
              match={item}
              index={index}
              onView={handleViewMatch}
              onDelete={setMatchToDelete}
              navigation={navigation}
            />
          )}
          keyExtractor={(item) => item._id}
          contentContainerStyle={[
            styles.listContent,
            matches.length === 0 && styles.emptyListContent,
          ]}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.secondary]}
              tintColor={colors.secondary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Delete Single Match Modal */}
      <Modal visible={!!matchToDelete} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <TrashIcon size={32} color={colors.error} />
            </View>
            <Text style={styles.modalTitle}>Delete Match?</Text>
            <Text style={styles.modalMessage}>
              This will permanently remove this match from your history. This action cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setMatchToDelete(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeleteButton}
                onPress={handleDeleteMatch}
                activeOpacity={0.8}
              >
                <Text style={styles.modalDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Delete All Modal */}
      <Modal visible={showDeleteAllModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconContainer, styles.modalIconWarning]}>
              <TrashIcon size={32} color={colors.error} />
            </View>
            <Text style={styles.modalTitle}>Clear All History?</Text>
            <Text style={styles.modalMessage}>
              This will permanently delete all {matches.length} matches from your history. This cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowDeleteAllModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeleteButton}
                onPress={handleDeleteAll}
                activeOpacity={0.8}
              >
                <Text style={styles.modalDeleteText}>Delete All</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  // Icon styles
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  trophyCup: {
    borderWidth: 2,
    borderBottomWidth: 0,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  trophyBase: {
    borderRadius: 2,
    marginTop: -2,
  },
  clockFace: {
    borderWidth: 2,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clockHand: {
    width: 2,
    position: 'absolute',
    bottom: '50%',
    borderRadius: 1,
  },
  clockHandShort: {
    height: 2,
    position: 'absolute',
    left: '50%',
    borderRadius: 1,
  },
  trashTop: {
    height: 3,
    borderRadius: 1,
    marginBottom: 2,
  },
  trashBody: {
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  chevron: {
    width: 8,
    height: 8,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '-45deg' }],
    marginLeft: -4,
  },
  lockTop: {
    borderWidth: 3,
    borderBottomWidth: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    top: 0,
  },
  lockBody: {
    borderRadius: 4,
    position: 'absolute',
    bottom: 0,
  },
  cricketBat: {
    width: 8,
    height: 35,
    borderRadius: 4,
    transform: [{ rotate: '-30deg' }],
    position: 'absolute',
  },
  cricketBall: {
    width: 18,
    height: 18,
    borderRadius: 9,
    position: 'absolute',
    right: 5,
    top: 5,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 2,
  },
  deleteAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  deleteAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
  },
  // List
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyListContent: {
    flex: 1,
  },
  // Match Card
  cardContainer: {
    marginBottom: 16,
  },
  matchCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  completedPill: {
    backgroundColor: colors.successLight,
  },
  inProgressPill: {
    backgroundColor: '#e0f2fe',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  completedText: {
    color: colors.success,
  },
  inProgressText: {
    color: colors.secondary,
  },
  dateContainer: {
    alignItems: 'flex-end',
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  timeText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  // Teams Section
  teamsSection: {
    padding: 16,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teamBadgeB: {
    backgroundColor: colors.secondary,
  },
  teamInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  teamName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  teamScore: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  vsDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    paddingLeft: 48,
  },
  vsLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  vsText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    paddingHorizontal: 10,
  },
  // Result
  resultSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    gap: 8,
  },
  resultText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#b45309',
  },
  // Card Footer
  cardFooter: {
    flexDirection: 'row',
    padding: 12,
    paddingTop: 0,
    gap: 10,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  viewButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  deleteButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    borderRadius: 12,
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
    color: colors.textLight,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 15,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  newMatchButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  newMatchButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  // Login Prompt
  loginPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  lockIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  loginText: {
    fontSize: 15,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  loginButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
  },
  loginButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 59, 102, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconWarning: {
    backgroundColor: colors.errorLight,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textLight,
  },
  modalDeleteButton: {
    flex: 1,
    backgroundColor: colors.error,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalDeleteText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
});

export default PastMatchesScreen;
