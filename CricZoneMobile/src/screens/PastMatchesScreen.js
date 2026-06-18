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
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../context/AuthContext';
import matchService from '../utils/matchService';
import tournamentService from '../utils/tournamentService';
import TournamentCard from '../components/TournamentCard';
import GradientHeader from '../components/GradientHeader';

// ---------------- Palette ----------------
const palette = {
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  textLight: '#cbd5e1',
  success: '#10b981',
  successBg: '#d1fae5',
  successDark: '#065f46',
  warning: '#f59e0b',
  warningBg: '#fef3c7',
  warningDark: '#92400e',
  error: '#ef4444',
  errorBg: '#fee2e2',
  errorDark: '#991b1b',
  info: '#3b82f6',
  infoBg: '#dbeafe',
  infoDark: '#1e3a8a',
  indigo: '#4f46e5',
  indigoBg: '#eef2ff',
};

// ---------------- Icons ----------------

const TrophyIcon = ({ size = 18, color = '#fff' }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{
      width: size * 0.72, height: size * 0.5,
      borderWidth: 2, borderBottomWidth: 0, borderColor: color,
      borderTopLeftRadius: 2, borderTopRightRadius: 2,
      borderBottomLeftRadius: 9, borderBottomRightRadius: 9,
    }} />
    <View style={{ width: 2, height: size * 0.2, backgroundColor: color }} />
    <View style={{ width: size * 0.55, height: 2, backgroundColor: color, borderRadius: 1 }} />
  </View>
);

const PlayIcon = ({ size = 14, color = '#fff' }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{
      width: 0, height: 0,
      borderTopWidth: size * 0.4,
      borderBottomWidth: size * 0.4,
      borderLeftWidth: size * 0.55,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: color,
      marginLeft: 2,
    }} />
  </View>
);

const TrashIcon = ({ size = 16, color = '#fff' }) => (
  <View style={{ width: size, height: size + 2, alignItems: 'center' }}>
    <View style={{
      width: size * 0.8, height: 2.5, backgroundColor: color, borderRadius: 1, marginBottom: 1,
    }} />
    <View style={{
      width: size * 0.7, height: size * 0.7,
      borderWidth: 2, borderTopWidth: 0, borderColor: color,
      borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
    }} />
  </View>
);

const ChevronIcon = ({ size = 14, color = '#fff' }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{
      width: size * 0.55, height: size * 0.55,
      borderRightWidth: 2.5, borderBottomWidth: 2.5,
      borderColor: color,
      transform: [{ rotate: '-45deg' }],
      marginLeft: -3,
    }} />
  </View>
);

const CricketBatIcon = ({ size = 80, color = palette.indigo }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{
      width: 8, height: size * 0.55, backgroundColor: color, borderRadius: 4,
      transform: [{ rotate: '-30deg' }], position: 'absolute',
    }} />
    <View style={{
      width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15,
      backgroundColor: palette.error,
      position: 'absolute', right: 8, top: 8,
      borderWidth: 2, borderColor: '#fff',
    }} />
  </View>
);

const LockIcon = ({ size = 50, color = palette.indigo }) => (
  <View style={{ width: size, height: size + 5, alignItems: 'center' }}>
    <View style={{
      width: size * 0.55, height: size * 0.5,
      borderWidth: 4, borderBottomWidth: 0, borderColor: color,
      borderTopLeftRadius: size * 0.3, borderTopRightRadius: size * 0.3,
    }} />
    <View style={{
      width: size * 0.85, height: size * 0.55, backgroundColor: color,
      borderRadius: 6, marginTop: -2,
    }} />
  </View>
);

// ---------------- Segmented Control ----------------

const Segmented = ({ options, selected, onSelect }) => {
  return (
    <View style={styles.segmented}>
      {options.map((opt, i) => {
        const active = selected === i;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.segmentedItem, active && styles.segmentedItemActive]}
            onPress={() => onSelect(i)}
            activeOpacity={0.7}
          >
            {active ? (
              <LinearGradient
                colors={['#312e81', '#4f46e5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <Text style={[styles.segmentedText, active && styles.segmentedTextActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ---------------- Stats Strip ----------------

const StatsStrip = ({ matches }) => {
  const completed = matches.filter(m => m.status === 'completed').length;
  const inProgress = matches.filter(m => m.status !== 'completed').length;
  const total = matches.length;

  const items = [
    { label: 'Total', value: total, color: palette.indigo, bg: palette.indigoBg },
    { label: 'Completed', value: completed, color: palette.success, bg: palette.successBg },
    { label: 'In Progress', value: inProgress, color: palette.warning, bg: palette.warningBg },
  ];

  return (
    <View style={styles.statsStrip}>
      {items.map((it, i) => (
        <View key={it.label} style={[styles.statCard, { backgroundColor: it.bg }]}>
          <Text style={[styles.statValue, { color: it.color }]}>{it.value}</Text>
          <Text style={[styles.statLabel, { color: it.color }]}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
};

// ---------------- Match Card ----------------

const MatchCard = ({ match, index, onView, onDelete }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const delay = Math.min(index * 60, 360);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 50, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  const onIn = () => Animated.spring(scale, { toValue: 0.98, friction: 8, tension: 200, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }).start();

  const isCompleted = match.status === 'completed';
  const teamAName = match.teamA?.name || 'Team A';
  const teamBName = match.teamB?.name || 'Team B';

  const getTeamScore = (teamName) => {
    if (match.innings1?.battingTeam === teamName) {
      return { runs: match.innings1.runs ?? 0, wickets: match.innings1.wickets ?? 0, overs: match.innings1.overs };
    }
    if (match.innings2?.battingTeam === teamName) {
      return { runs: match.innings2.runs ?? 0, wickets: match.innings2.wickets ?? 0, overs: match.innings2.overs };
    }
    return null;
  };
  const teamAScore = getTeamScore(teamAName);
  const teamBScore = getTeamScore(teamBName);

  const formatDate = (s) => {
    const d = new Date(s);
    return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  };
  const formatTime = (s) => new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const statusBg = isCompleted ? palette.successBg : palette.warningBg;
  const statusColor = isCompleted ? palette.successDark : palette.warningDark;
  const accentGradient = isCompleted ? ['#10b981', '#059669'] : ['#f59e0b', '#d97706'];

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }], marginBottom: 14 }}>
      <Pressable onPressIn={onIn} onPressOut={onOut} onPress={() => onView(match, isCompleted)}>
        <View style={styles.matchCard}>
          {/* Status accent bar */}
          <LinearGradient
            colors={accentGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.accentBar}
          />

          <View style={styles.matchCardBody}>
            {/* Top row: status + date */}
            <View style={styles.matchTop}>
              <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {isCompleted ? 'Completed' : 'In Progress'}
                </Text>
              </View>
              <View style={styles.dateBlock}>
                <Text style={styles.dateText}>{formatDate(match.updatedAt)}</Text>
                <Text style={styles.dateTime}>{formatTime(match.updatedAt)}</Text>
              </View>
            </View>

            {/* Teams */}
            <View style={styles.teamsBlock}>
              <View style={styles.teamRow}>
                <View style={[styles.teamBadge, styles.teamBadgeA]}>
                  <Text style={styles.teamBadgeText}>{teamAName.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.teamName} numberOfLines={1}>{teamAName}</Text>
                {teamAScore ? (
                  <View style={styles.scoreBlock}>
                    <Text style={styles.scoreText}>
                      {teamAScore.runs}<Text style={styles.scoreSlash}>/{teamAScore.wickets}</Text>
                    </Text>
                    <Text style={styles.oversText}>({teamAScore.overs})</Text>
                  </View>
                ) : (
                  <Text style={styles.scoreTBD}>—</Text>
                )}
              </View>

              <View style={styles.vsRow}>
                <View style={styles.vsLine} />
                <View style={styles.vsBubble}>
                  <Text style={styles.vsText}>VS</Text>
                </View>
                <View style={styles.vsLine} />
              </View>

              <View style={styles.teamRow}>
                <View style={[styles.teamBadge, styles.teamBadgeB]}>
                  <Text style={styles.teamBadgeText}>{teamBName.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.teamName} numberOfLines={1}>{teamBName}</Text>
                {teamBScore ? (
                  <View style={styles.scoreBlock}>
                    <Text style={styles.scoreText}>
                      {teamBScore.runs}<Text style={styles.scoreSlash}>/{teamBScore.wickets}</Text>
                    </Text>
                    <Text style={styles.oversText}>({teamBScore.overs})</Text>
                  </View>
                ) : (
                  <Text style={styles.scoreTBD}>—</Text>
                )}
              </View>
            </View>

            {/* Result */}
            {isCompleted && match.result ? (
              <View style={styles.resultBox}>
                <TrophyIcon size={14} color={palette.warningDark} />
                <Text style={styles.resultText} numberOfLines={2}>{match.result}</Text>
              </View>
            ) : null}

            {/* Footer */}
            <View style={styles.matchFooter}>
              <TouchableOpacity
                style={styles.primaryBtnWrap}
                onPress={() => onView(match, isCompleted)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={isCompleted ? ['#10b981', '#059669'] : ['#4f46e5', '#7c3aed']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtn}
                >
                  {isCompleted ? <TrophyIcon size={13} color="#fff" /> : <PlayIcon size={11} color="#fff" />}
                  <Text style={styles.primaryBtnText}>
                    {isCompleted ? 'View Scorecard' : 'Continue Match'}
                  </Text>
                  <ChevronIcon size={12} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteIconBtn}
                onPress={() => onDelete(match)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <TrashIcon size={15} color={palette.error} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ---------------- Empty / Login states ----------------

const EmptyState = ({ navigation }) => (
  <View style={styles.empty}>
    <View style={styles.emptyIconHalo}>
      <CricketBatIcon size={72} color={palette.indigo} />
    </View>
    <Text style={styles.emptyTitle}>No matches yet</Text>
    <Text style={styles.emptyText}>
      Once you start scoring, your match history{'\n'}will live here.
    </Text>
    <TouchableOpacity
      onPress={() => navigation.navigate('MatchSetup')}
      activeOpacity={0.85}
      style={styles.emptyBtnWrap}
    >
      <LinearGradient
        colors={['#4f46e5', '#7c3aed']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.emptyBtn}
      >
        <PlayIcon size={12} color="#fff" />
        <Text style={styles.emptyBtnText}>Start a Match</Text>
      </LinearGradient>
    </TouchableOpacity>
  </View>
);

const LoginRequired = ({ navigation }) => (
  <SafeAreaView style={styles.container} edges={['top']}>
    <GradientHeader title="Match History" />
    <View style={styles.empty}>
      <View style={styles.emptyIconHalo}>
        <LockIcon size={50} color={palette.indigo} />
      </View>
      <Text style={styles.emptyTitle}>Login required</Text>
      <Text style={styles.emptyText}>
        Please log in to view and manage{'\n'}your match history.
      </Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('Auth')}
        activeOpacity={0.85}
        style={styles.emptyBtnWrap}
      >
        <LinearGradient
          colors={['#4f46e5', '#7c3aed']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emptyBtn}
        >
          <Text style={styles.emptyBtnText}>Log In</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  </SafeAreaView>
);

// ---------------- Screen ----------------

const PastMatchesScreen = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [matchToDelete, setMatchToDelete] = useState(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [tournaments, setTournaments] = useState([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  const hasFetchedOnce = useRef(false);

  const fetchMatches = useCallback(async (showLoader = true) => {
    if (!user?.token) {
      setError('You must be logged in to view past matches.');
      setLoading(false);
      return;
    }
    try {
      if (showLoader) setLoading(true);
      setError('');
      const userMatches = await matchService.getMyMatches(user.token);
      setMatches(userMatches || []);
    } catch (err) {
      console.warn('Fetch matches error:', err);
      if (showLoader) setError('Failed to fetch matches. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  const fetchTournaments = useCallback(async (showLoader = true) => {
    if (!user?.token) return;
    try {
      if (showLoader) setTournamentsLoading(true);
      const data = await tournamentService.getMyTournaments(user.token);
      setTournaments(data || []);
    } catch (err) {
      console.warn('Fetch tournaments error:', err);
    } finally {
      setTournamentsLoading(false);
    }
  }, [user?.token]);

  useFocusEffect(
    useCallback(() => {
      if (user?.token) {
        const showLoader = !hasFetchedOnce.current;
        fetchMatches(showLoader);
        fetchTournaments(showLoader);
        hasFetchedOnce.current = true;
      }
    }, [user?.token, fetchMatches, fetchTournaments])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMatches();
    setRefreshing(false);
  }, [fetchMatches]);

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

  if (!user?.token) return <LoginRequired navigation={navigation} />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <GradientHeader
        title="Match History"
        subtitle={`${matches.length} ${matches.length === 1 ? 'match' : 'matches'} played`}
        rightSlot={
          matches.length > 0 ? (
            <TouchableOpacity
              style={styles.headerClearBtn}
              onPress={() => setShowDeleteAllModal(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <TrashIcon size={14} color="#fff" />
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Stats strip (only on All Matches tab) */}
      {selectedTab === 0 && matches.length > 0 ? (
        <StatsStrip matches={matches} />
      ) : null}

      {/* Segmented control */}
      <View style={styles.segmentedWrap}>
        <Segmented
          options={['All Matches', 'Tournaments']}
          selected={selectedTab}
          onSelect={setSelectedTab}
        />
      </View>

      {selectedTab === 0 ? (
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={palette.indigo} />
            <Text style={styles.loadingText}>Loading matches...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchMatches} style={styles.retryBtn} activeOpacity={0.85}>
              <Text style={styles.retryBtnText}>Try Again</Text>
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
              />
            )}
            keyExtractor={(item) => item._id}
            contentContainerStyle={[
              styles.listContent,
              matches.length === 0 && { flex: 1 },
            ]}
            ListEmptyComponent={<EmptyState navigation={navigation} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[palette.indigo]}
                tintColor={palette.indigo}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        tournamentsLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={palette.indigo} />
            <Text style={styles.loadingText}>Loading tournaments...</Text>
          </View>
        ) : (
          <FlatList
            data={tournaments}
            renderItem={({ item, index }) => (
              <TournamentCard
                tournament={item}
                index={index}
                onPress={(t) => navigation.navigate('TournamentDetail', { tournamentId: t._id })}
              />
            )}
            keyExtractor={(item) => item._id}
            contentContainerStyle={[
              styles.listContent,
              tournaments.length === 0 && { flex: 1 },
            ]}
            ListEmptyComponent={(
              <View style={styles.empty}>
                <View style={styles.emptyIconHalo}>
                  <TrophyIcon size={60} color={palette.indigo} />
                </View>
                <Text style={styles.emptyTitle}>No tournaments</Text>
                <Text style={styles.emptyText}>Create one from the Tournaments tab.</Text>
              </View>
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await fetchTournaments();
                  setRefreshing(false);
                }}
                colors={[palette.indigo]}
                tintColor={palette.indigo}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )
      )}

      {/* Delete single match */}
      <Modal visible={!!matchToDelete} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <TrashIcon size={28} color={palette.error} />
            </View>
            <Text style={styles.modalTitle}>Delete Match?</Text>
            <Text style={styles.modalBody}>
              This match will be permanently removed from your history. This cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setMatchToDelete(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteMatch}
                activeOpacity={0.85}
                style={styles.modalBtn}
              >
                <LinearGradient
                  colors={['#ef4444', '#b91c1c']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalConfirmBtn}
                >
                  <Text style={styles.modalConfirmText}>Delete</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete all */}
      <Modal visible={showDeleteAllModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <TrashIcon size={28} color={palette.error} />
            </View>
            <Text style={styles.modalTitle}>Clear All History?</Text>
            <Text style={styles.modalBody}>
              {matches.length} matches will be permanently deleted. This cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setShowDeleteAllModal(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteAll}
                activeOpacity={0.85}
                style={styles.modalBtn}
              >
                <LinearGradient
                  colors={['#ef4444', '#b91c1c']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalConfirmBtn}
                >
                  <Text style={styles.modalConfirmText}>Delete All</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ---------------- Styles ----------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },

  headerClearBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 2, letterSpacing: 0.4 },

  // Segmented control
  segmentedWrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: palette.borderLight,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  segmentedItemActive: {
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  segmentedText: { fontSize: 13, fontWeight: '700', color: palette.textSecondary },
  segmentedTextActive: { color: '#fff' },

  listContent: { padding: 16, paddingBottom: 120 },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: { marginTop: 12, fontSize: 14, color: palette.textMuted },
  errorText: { fontSize: 14, color: palette.error, marginBottom: 12, textAlign: 'center' },
  retryBtn: {
    backgroundColor: palette.indigo,
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Match card
  matchCard: {
    flexDirection: 'row',
    backgroundColor: palette.card,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  accentBar: { width: 5 },
  matchCardBody: { flex: 1, padding: 16 },

  matchTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  dateBlock: { alignItems: 'flex-end' },
  dateText: { fontSize: 13, fontWeight: '700', color: palette.textPrimary },
  dateTime: { fontSize: 11, color: palette.textMuted, marginTop: 1 },

  // Teams block
  teamsBlock: { gap: 10 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  teamBadge: {
    width: 36, height: 36, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  teamBadgeA: { backgroundColor: palette.indigoBg },
  teamBadgeB: { backgroundColor: '#fef3c7' },
  teamBadgeText: { fontSize: 15, fontWeight: '800', color: palette.textPrimary },
  teamName: { flex: 1, fontSize: 15, fontWeight: '700', color: palette.textPrimary },
  scoreBlock: { alignItems: 'flex-end' },
  scoreText: { fontSize: 17, fontWeight: '800', color: palette.textPrimary, letterSpacing: -0.3 },
  scoreSlash: { color: palette.textMuted, fontWeight: '700' },
  oversText: { fontSize: 11, color: palette.textMuted, fontWeight: '600' },
  scoreTBD: { fontSize: 16, color: palette.textLight, fontWeight: '700' },

  vsRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  vsLine: { flex: 1, height: 1, backgroundColor: palette.borderLight },
  vsBubble: {
    paddingHorizontal: 10, paddingVertical: 3,
    backgroundColor: palette.borderLight, borderRadius: 10,
    marginHorizontal: 8,
  },
  vsText: { fontSize: 10, fontWeight: '800', color: palette.textMuted, letterSpacing: 1 },

  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.warningBg,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    marginTop: 14,
    gap: 8,
  },
  resultText: { flex: 1, fontSize: 12, fontWeight: '700', color: palette.warningDark, lineHeight: 16 },

  matchFooter: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
    alignItems: 'center',
  },
  primaryBtnWrap: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 0.2 },
  deleteIconBtn: {
    width: 44, height: 40, borderRadius: 12,
    backgroundColor: palette.errorBg,
    justifyContent: 'center', alignItems: 'center',
  },

  // Empty / login
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconHalo: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: palette.card,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
    shadowColor: palette.indigo,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 6,
  },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: palette.textPrimary, marginBottom: 8, letterSpacing: -0.3 },
  emptyText: { fontSize: 14, color: palette.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 26 },
  emptyBtnWrap: { borderRadius: 14, overflow: 'hidden', shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 26, paddingVertical: 14,
    gap: 8,
  },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: palette.card,
    borderRadius: 22,
    padding: 26,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: palette.errorBg,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: palette.textPrimary, marginBottom: 8, letterSpacing: -0.3 },
  modalBody: { fontSize: 13.5, color: palette.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 22 },
  modalActions: { flexDirection: 'row', width: '100%', gap: 10 },
  modalBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  modalCancelBtn: {
    backgroundColor: palette.borderLight,
    paddingVertical: 13,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: palette.textSecondary },
  modalConfirmBtn: { paddingVertical: 13, alignItems: 'center' },
  modalConfirmText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});

export default PastMatchesScreen;
