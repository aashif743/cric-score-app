import React, { useState, useContext, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../context/AuthContext';
import tournamentService from '../utils/tournamentService';
import GradientHeader from '../components/GradientHeader';
import TournamentTopTabs from '../components/TournamentTopTabs';

// --- Helpers ---------------------------------------------------------------
const initialOf = (s) => (s || '?').trim().charAt(0).toUpperCase();
const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#059669'];
const MEDALS = {
  1: { bg: '#fef3c7', fg: '#b45309', ring: '#fbbf24' },
  2: { bg: '#f1f5f9', fg: '#475569', ring: '#cbd5e1' },
  3: { bg: '#ffedd5', fg: '#9a3412', ring: '#fdba74' },
};

// --- Entrance wrapper (fade + rise, staggered) -----------------------------
const Rise = ({ delay = 0, children, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.timing(ty, { toValue: 0, duration: 420, delay, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
    ]).start();
  }, []);
  return <Animated.View style={[style, { opacity, transform: [{ translateY: ty }] }]}>{children}</Animated.View>;
};

// --- Leaderboard row (medal/avatar + name + value) -------------------------
const PlayerRow = ({ rank, name, team, value, accent, delay }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const tx = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 360, delay, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.timing(tx, { toValue: 0, duration: 360, delay, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
    ]).start();
  }, []);

  const medal = MEDALS[rank];

  return (
    <Animated.View style={[styles.row, rank === 1 && styles.rowTop, { opacity, transform: [{ translateX: tx }] }]}>
      <View style={[styles.rank, medal && { backgroundColor: medal.bg, borderColor: medal.ring }]}>
        <Text style={[styles.rankText, medal && { color: medal.fg }]}>{rank}</Text>
      </View>
      <View style={styles.rowMid}>
        <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
        {team ? <Text style={styles.rowTeam} numberOfLines={1}>{team}</Text> : null}
      </View>
      <Text style={[styles.rowValue, { color: accent }]}>{value}</Text>
    </Animated.View>
  );
};

// --- Leaderboard card ------------------------------------------------------
const Leaderboard = ({ title, accent, unit, players, valueOf, delay }) => (
  <Rise delay={delay} style={styles.card}>
    <View style={styles.cardHead}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.unitChip}>
        <Text style={[styles.unitChipText, { color: accent }]}>{unit}</Text>
      </View>
    </View>
    {players.length === 0 ? (
      <Text style={styles.empty}>No data yet — finish a match to see the leaders.</Text>
    ) : players.map((p, i) => (
      <PlayerRow
        key={`${title}_${i}`}
        rank={i + 1}
        name={p.name}
        team={p.team}
        value={valueOf(p)}
        accent={accent}
        delay={delay + 80 + i * 70}
      />
    ))}
  </Rise>
);

const TournamentStatsScreen = ({ navigation, route }) => {
  const { user } = useContext(AuthContext);
  const { tournamentId, tournamentName } = route.params || {};

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    if (!user?.token || !tournamentId) return;
    try {
      setError('');
      const res = await tournamentService.getTournamentStats(tournamentId, user.token);
      setStats(res?.data || res || {});
    } catch (err) {
      console.warn('Tournament stats error:', err);
      setError('Failed to load stats.');
    } finally {
      setLoading(false);
    }
  }, [user?.token, tournamentId]);

  useFocusEffect(useCallback(() => { fetchStats(); }, [fetchStats]));

  const runScorers = stats?.topRunScorers || [];
  const wicketTakers = stats?.topWicketTakers || [];
  const total = stats?.totalMatches ?? 0;
  const done = stats?.completedMatches ?? 0;
  const progress = total > 0 ? done / total : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <GradientHeader
        title="Statistics"
        subtitle={tournamentName || 'Tournament'}
        onBack={() => navigation.goBack()}
      />

      {/* Top nav: Matches · Points Table · Stats (active) — league tournaments only */}
      {route.params?.showTournamentTabs ? (
        <TournamentTopTabs
          active="stats"
          navigation={navigation}
          tournamentId={tournamentId}
          tournamentName={tournamentName}
        />
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Loading stats…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchStats}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Overview hero */}
          <Rise delay={0}>
            <LinearGradient
              colors={['#1e1b4b', '#4338ca', '#6d28d9']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View style={styles.heroRow}>
                <View style={styles.heroCell}>
                  <Text style={styles.heroNum}>{done}</Text>
                  <Text style={styles.heroLabel}>Completed</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroCell}>
                  <Text style={styles.heroNum}>{total}</Text>
                  <Text style={styles.heroLabel}>Total Matches</Text>
                </View>
              </View>
              <View style={styles.heroProgressTrack}>
                <ProgressBar progress={progress} />
              </View>
              <Text style={styles.heroProgressText}>
                {total > 0 ? `${Math.round(progress * 100)}% of matches played` : 'Tournament not started'}
              </Text>
            </LinearGradient>
          </Rise>

          {/* Top run scorers — runs only */}
          <Leaderboard
            title="Top Run Scorers"
            accent="#2563eb"
            unit="RUNS"
            players={runScorers}
            valueOf={(p) => p.totalRuns ?? 0}
            delay={120}
          />

          {/* Top wicket takers — wickets only */}
          <Leaderboard
            title="Top Wicket Takers"
            accent="#7c3aed"
            unit="WICKETS"
            players={wicketTakers}
            valueOf={(p) => p.totalWickets ?? 0}
            delay={220}
          />

          {/* Highlights */}
          {(stats?.mostRunsInMatch || stats?.bestBowling) ? (
            <Rise delay={320} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>Highlights</Text>
              </View>
              {stats.mostRunsInMatch ? (
                <View style={styles.highlightRow}>
                  <Text style={styles.highlightLabel}>Best Batting</Text>
                  <Text style={styles.highlightValue} numberOfLines={1}>
                    <Text style={styles.highlightName}>{stats.mostRunsInMatch.name}</Text>
                    {'  '}{stats.mostRunsInMatch.runs}
                    {stats.mostRunsInMatch.balls ? ` (${stats.mostRunsInMatch.balls})` : ''}
                  </Text>
                </View>
              ) : null}
              {stats.bestBowling ? (
                <View style={styles.highlightRow}>
                  <Text style={styles.highlightLabel}>Best Bowling</Text>
                  <Text style={styles.highlightValue} numberOfLines={1}>
                    <Text style={styles.highlightName}>{stats.bestBowling.name}</Text>
                    {'  '}{stats.bestBowling.wickets}/{stats.bestBowling.runs}
                    {stats.bestBowling.overs ? ` (${stats.bestBowling.overs})` : ''}
                  </Text>
                </View>
              ) : null}
            </Rise>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// Animated progress bar for the hero.
const ProgressBar = ({ progress }) => {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(grow, { toValue: 1, duration: 800, delay: 200, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start();
  }, []);
  const width = grow.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.round(progress * 100)}%`] });
  return <Animated.View style={[styles.heroProgressFill, { width }]} />;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#94a3b8' },
  errorText: { fontSize: 15, color: '#ef4444', marginBottom: 16 },
  retryButton: { backgroundColor: '#4f46e5', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  retryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 44 },

  // Hero
  hero: {
    borderRadius: 20, padding: 18, marginBottom: 16,
    shadowColor: '#4338ca', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 16, elevation: 8,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroCell: { flex: 1, alignItems: 'center' },
  heroDivider: { width: 1, height: 38, backgroundColor: 'rgba(255,255,255,0.18)' },
  heroNum: { fontSize: 30, fontWeight: '900', color: '#fff', fontVariant: ['tabular-nums'] },
  heroLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  heroProgressTrack: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 16, overflow: 'hidden' },
  heroProgressFill: { height: '100%', borderRadius: 4, backgroundColor: '#fde047' },
  heroProgressText: { fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 8, textAlign: 'center' },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  badge: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  badgeEmoji: { fontSize: 15 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#0f172a', letterSpacing: 0.2 },
  unitChip: { backgroundColor: '#f1f5f9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  unitChipText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  empty: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', paddingVertical: 12 },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10,
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  rowTop: { borderTopWidth: 0 },
  rank: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center',
  },
  rankText: { fontSize: 12, fontWeight: '900', color: '#94a3b8', fontVariant: ['tabular-nums'] },
  avatar: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  rowMid: { flex: 1 },
  rowName: { fontSize: 14.5, fontWeight: '800', color: '#1e293b' },
  rowTeam: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 1 },
  barTrack: { height: 5, borderRadius: 3, backgroundColor: '#f1f5f9', marginTop: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  rowValue: { fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'], minWidth: 40, textAlign: 'right' },

  // Highlights
  highlightRow: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  highlightLabel: { fontSize: 10.5, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
  highlightValue: { fontSize: 14.5, fontWeight: '600', color: '#334155', marginTop: 3, fontVariant: ['tabular-nums'] },
  highlightName: { fontWeight: '800', color: '#0f172a' },
});

export default TournamentStatsScreen;
