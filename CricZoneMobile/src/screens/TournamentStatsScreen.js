import React, { useState, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import tournamentService from '../utils/tournamentService';
import GradientHeader from '../components/GradientHeader';

const StatRow = ({ rank, name, team, primary, secondary }) => (
  <View style={styles.statRow}>
    <Text style={styles.statRank}>{rank}</Text>
    <View style={styles.statNameWrap}>
      <Text style={styles.statName} numberOfLines={1}>{name}</Text>
      {team ? <Text style={styles.statTeam} numberOfLines={1}>{team}</Text> : null}
    </View>
    <View style={styles.statValWrap}>
      <Text style={styles.statPrimary}>{primary}</Text>
      {secondary ? <Text style={styles.statSecondary}>{secondary}</Text> : null}
    </View>
  </View>
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <GradientHeader
        title="Statistics"
        subtitle={tournamentName || 'Tournament'}
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
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
          {/* Overview */}
          <View style={styles.overview}>
            <View style={styles.overviewCell}>
              <Text style={styles.overviewNum}>{stats?.totalMatches ?? 0}</Text>
              <Text style={styles.overviewLabel}>Matches</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewCell}>
              <Text style={styles.overviewNum}>{stats?.completedMatches ?? 0}</Text>
              <Text style={styles.overviewLabel}>Completed</Text>
            </View>
          </View>

          {/* Top run scorers */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Run Scorers</Text>
            {runScorers.length === 0 ? (
              <Text style={styles.empty}>No data yet.</Text>
            ) : runScorers.map((p, i) => (
              <StatRow
                key={`r_${i}`}
                rank={i + 1}
                name={p.name}
                team={p.team}
                primary={`${p.totalRuns ?? 0}`}
                secondary={p.totalBalls ? `${p.totalBalls} balls` : null}
              />
            ))}
          </View>

          {/* Top wicket takers */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Wicket Takers</Text>
            {wicketTakers.length === 0 ? (
              <Text style={styles.empty}>No data yet.</Text>
            ) : wicketTakers.map((p, i) => (
              <StatRow
                key={`w_${i}`}
                rank={i + 1}
                name={p.name}
                team={p.team}
                primary={`${p.totalWickets ?? 0}`}
                secondary={`${p.totalRuns ?? 0} runs`}
              />
            ))}
          </View>

          {/* Highlights */}
          {(stats?.mostRunsInMatch || stats?.bestBowling) ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Highlights</Text>
              {stats.mostRunsInMatch ? (
                <View style={styles.highlightRow}>
                  <Text style={styles.highlightLabel}>Most runs (innings)</Text>
                  <Text style={styles.highlightValue} numberOfLines={1}>
                    {stats.mostRunsInMatch.name} — {stats.mostRunsInMatch.runs}
                    {stats.mostRunsInMatch.balls ? ` (${stats.mostRunsInMatch.balls})` : ''}
                  </Text>
                </View>
              ) : null}
              {stats.bestBowling ? (
                <View style={styles.highlightRow}>
                  <Text style={styles.highlightLabel}>Best bowling</Text>
                  <Text style={styles.highlightValue} numberOfLines={1}>
                    {stats.bestBowling.name} — {stats.bestBowling.wickets}/{stats.bestBowling.runs}
                    {stats.bestBowling.overs ? ` (${stats.bestBowling.overs})` : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#94a3b8' },
  errorText: { fontSize: 15, color: '#ef4444', marginBottom: 16 },
  retryButton: { backgroundColor: '#2563eb', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  retryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 40 },

  overview: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, marginBottom: 14,
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  overviewCell: { flex: 1, alignItems: 'center' },
  overviewDivider: { width: 1, height: 32, backgroundColor: '#e2e8f0' },
  overviewNum: { fontSize: 24, fontWeight: '900', color: '#1e293b', fontVariant: ['tabular-nums'] },
  overviewLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 14,
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
  empty: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },

  statRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 9,
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  statRank: { width: 22, fontSize: 13, fontWeight: '800', color: '#94a3b8', textAlign: 'center' },
  statNameWrap: { flex: 1, marginLeft: 6 },
  statName: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  statTeam: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 1 },
  statValWrap: { alignItems: 'flex-end' },
  statPrimary: { fontSize: 16, fontWeight: '900', color: '#2563eb', fontVariant: ['tabular-nums'] },
  statSecondary: { fontSize: 10.5, fontWeight: '600', color: '#94a3b8', marginTop: 1 },

  highlightRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  highlightLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.3 },
  highlightValue: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginTop: 2 },
});

export default TournamentStatsScreen;
