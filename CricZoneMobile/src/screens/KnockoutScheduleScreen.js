import React, { useState, useContext, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { AuthContext } from '../context/AuthContext';
import tournamentService from '../utils/tournamentService';
import GradientHeader from '../components/GradientHeader';

// Clean line-style settings gear (matches the league schedule screen).
const SettingsIcon = ({ size = 20, color = '#475569' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    />
    <Path
      d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    />
  </Svg>
);

const roundLabel = (round, numRounds) => {
  if (round === numRounds) return 'Final';
  if (round === 1) return '1st Round';
  if (round === 2) return '2nd';
  if (round === 3) return '3rd';
  if (round === 4) return '4th';
  return `${round}th`;
};

const KnockoutScheduleScreen = ({ navigation, route }) => {
  const { user } = useContext(AuthContext);
  const { tournamentId } = route.params || {};

  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeRound, setActiveRound] = useState(1);

  const fetchData = useCallback(async () => {
    if (!user?.token || !tournamentId) return;
    try {
      setLoading(true);
      setError('');
      const res = await tournamentService.getTournament(tournamentId, user.token);
      const data = res.data;
      setTournament(data);
      setMatches(data.matches || []);
    } catch (err) {
      console.warn('Fetch knockout schedule error:', err);
      setError('Failed to load schedule.');
    } finally {
      setLoading(false);
    }
  }, [user?.token, tournamentId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // Group matches by round
  const matchesByRound = matches.reduce((acc, m) => {
    if (!m.round) return acc;
    if (!acc[m.round]) acc[m.round] = [];
    acc[m.round].push(m);
    return acc;
  }, {});
  Object.keys(matchesByRound).forEach((r) => {
    matchesByRound[r].sort((a, b) => (a.bracketSlot || 0) - (b.bracketSlot || 0));
  });

  const numRounds = Object.keys(matchesByRound).length
    ? Math.max(...Object.keys(matchesByRound).map(Number))
    : 0;

  // Settings is owner-only; visitors opening the schedule from a live card
  // just view the bracket.
  const myId = user?.id || user?._id;
  const isOwner = !!(tournament?.user && myId && String(tournament.user) === String(myId));

  // Seed number for a team = its position in the entry order (seed 1 first).
  const seedOf = (name) => {
    const i = (tournament?.teamNames || []).indexOf(name);
    return i >= 0 ? i + 1 : null;
  };

  const onPressFullSchedule = () => {
    if (!tournament?._id) return;
    navigation.navigate('FullBracket', { tournamentId: tournament._id, tournamentName: tournament.name });
  };
  const onPressStats = () => {
    if (!tournament?._id) return;
    navigation.navigate('TournamentStats', { tournamentId: tournament._id, tournamentName: tournament.name });
  };
  const onPressSettings = () => {
    if (!tournament?._id) return;
    navigation.navigate('TournamentCreate', { tournamentId: tournament._id, tournamentData: tournament });
  };

  // Winner of a completed match: prefer the explicit matchSummary.winner,
  // but fall back to parsing the result string ("X won by N runs/wickets")
  // for matches saved before matchSummary was wired up.
  const winnerOf = (m) => {
    if (m.status !== 'completed') return null;
    if (m.matchSummary?.winner) return m.matchSummary.winner;
    const idx = m.result?.indexOf(' won by ') ?? -1;
    return idx > 0 ? m.result.slice(0, idx) : null;
  };

  const handleStartMatch = (match) => {
    if (match.status === 'completed') {
      navigation.navigate('FullScorecard', { matchId: match._id });
      return;
    }
    // Visitors can watch a live match, but never start/resume scoring.
    if (!isOwner) {
      if (match.status === 'in_progress' || match.status === 'innings_break') {
        navigation.navigate('PublicLiveMatch', { matchId: match._id });
      }
      return;
    }
    if (!match.teamA?.name || match.teamA.name === 'TBD' ||
        !match.teamB?.name || match.teamB.name === 'TBD') {
      return; // can't start until both teams are known
    }
    // In-progress knockout matches should resume directly without re-running setup.
    if (match.status === 'in_progress' || match.status === 'innings_break') {
      navigation.navigate('ScoreCard', {
        matchData: match,
        matchSettings: {
          totalOvers: match.totalOvers,
          ballsPerOver: match.ballsPerOver,
          playersPerTeam: match.playersPerTeam,
        },
      });
      return;
    }
    // Scheduled: open MatchSetup with the bracket's two teams locked in.
    // Passing matchId tells MatchSetup to update the pre-generated match
    // instead of creating a duplicate.
    navigation.navigate('MatchSetup', {
      tournamentId: tournament?._id,
      matchId: match._id,
      tournamentDefaults: {
        totalOvers: tournament?.totalOvers ?? match.totalOvers,
        playersPerTeam: tournament?.playersPerTeam ?? match.playersPerTeam,
        ballsPerOver: tournament?.ballsPerOver ?? match.ballsPerOver,
        venue: tournament?.venue,
        tournamentName: tournament?.name,
        // Lock dropdown to just the bracket pair so the user can only pick
        // toss/innings between these two.
        teamNames: [match.teamA.name, match.teamB.name],
      },
    });
  };

  const renderMatchCard = (match, idx) => {
    const isCompleted = match.status === 'completed';
    const isLive = match.status === 'in_progress' || match.status === 'innings_break';
    const winner = winnerOf(match);
    const teamAName = match.teamA?.name || 'TBD';
    const teamBName = match.teamB?.name || 'TBD';
    const bothKnown = teamAName !== 'TBD' && teamBName !== 'TBD';
    const showLine = idx > 0;

    const buttonLabel = isCompleted ? 'View Summary' : 'Start Match';
    const buttonDisabled = !isCompleted && !bothKnown;

    return (
      <View key={match._id}>
        {showLine && <View style={styles.matchDivider} />}
        <View style={styles.matchRow}>
          {/* Match number */}
          <View style={styles.matchNumberContainer}>
            <Text style={styles.matchNumberText}>{idx + 1}</Text>
          </View>

          {/* Left column: Team A / button / Team B */}
          <View style={styles.matchCenter}>
            <View style={[
              styles.teamBox,
              teamAName === 'TBD' && styles.teamBoxTBD,
              winner === teamAName && styles.teamBoxWinner,
            ]}>
              <View style={[styles.seedBadge, teamAName === 'TBD' && styles.seedBadgeTBD, winner === teamAName && styles.seedBadgeWin]}>
                <Text style={[styles.seedBadgeText, winner === teamAName && styles.seedBadgeTextWin]}>{seedOf(teamAName) ?? '–'}</Text>
              </View>
              <Text style={[styles.teamBoxText, teamAName === 'TBD' && styles.teamBoxTextTBD, winner === teamAName && styles.teamBoxTextWin]} numberOfLines={1}>
                {teamAName}
              </Text>
            </View>
            {(isOwner || isCompleted) ? (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  isCompleted ? styles.actionButtonCompleted : styles.actionButtonStart,
                  buttonDisabled && styles.actionButtonDisabled,
                ]}
                onPress={() => handleStartMatch(match)}
                disabled={buttonDisabled}
                activeOpacity={0.7}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.actionButtonText,
                    isCompleted ? styles.actionButtonTextCompleted : styles.actionButtonTextStart,
                    buttonDisabled && styles.actionButtonTextDisabled,
                  ]}
                >
                  {buttonDisabled ? 'Waiting…' : buttonLabel}
                </Text>
              </TouchableOpacity>
            ) : isLive ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonStart]}
                onPress={() => handleStartMatch(match)}
                activeOpacity={0.7}
              >
                <Text numberOfLines={1} style={[styles.actionButtonText, styles.actionButtonTextStart]}>Watch Live</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.actionButton, styles.actionButtonDisabled]}>
                <Text numberOfLines={1} style={[styles.actionButtonText, styles.actionButtonTextDisabled]}>Upcoming</Text>
              </View>
            )}
            <View style={[
              styles.teamBox,
              teamBName === 'TBD' && styles.teamBoxTBD,
              winner === teamBName && styles.teamBoxWinner,
            ]}>
              <View style={[styles.seedBadge, teamBName === 'TBD' && styles.seedBadgeTBD, winner === teamBName && styles.seedBadgeWin]}>
                <Text style={[styles.seedBadgeText, winner === teamBName && styles.seedBadgeTextWin]}>{seedOf(teamBName) ?? '–'}</Text>
              </View>
              <Text style={[styles.teamBoxText, teamBName === 'TBD' && styles.teamBoxTextTBD, winner === teamBName && styles.teamBoxTextWin]} numberOfLines={1}>
                {teamBName}
              </Text>
            </View>
          </View>

          {/* Bracket connector — both teams join into the winner */}
          <View style={styles.bracket}>
            <View style={[styles.bracketHLine, styles.bracketTopLine]} />
            <View style={[styles.bracketHLine, styles.bracketBottomLine]} />
            <View style={styles.bracketVLine} />
            <View style={[styles.bracketHLine, styles.bracketMidLine]} />
          </View>

          {/* Right column: winner */}
          <View style={styles.winnerColumn}>
            <View style={[styles.winnerBox, !winner && styles.winnerBoxEmpty]}>
              {winner ? (
                <Text style={styles.winnerText} numberOfLines={1}>{winner}</Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const currentRoundMatches = matchesByRound[activeRound] || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <GradientHeader
        title={tournament?.name || 'Schedule'}
        subtitle="Knockout bracket"
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#d97706" />
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      ) : error ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Action bar: Full Schedule + Stats (equal), Settings (owner only) */}
          <View style={styles.actionBar}>
            <TouchableOpacity activeOpacity={0.85} onPress={onPressFullSchedule} style={[styles.actionPill, styles.actionPillPrimary]}>
              <Text style={styles.actionPillTextPrimary}>Full Schedule</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.85} onPress={onPressStats} style={[styles.actionPill, styles.actionPillSecondary]}>
              <Text style={styles.actionPillTextSecondary}>Stats</Text>
            </TouchableOpacity>

            {isOwner ? (
              <TouchableOpacity activeOpacity={0.7} style={styles.settingsButton} onPress={onPressSettings}>
                <SettingsIcon size={20} color="#475569" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Round Tabs (equal-width, fit-to-screen) */}
          <View style={styles.roundTabs}>
            {Array.from({ length: numRounds }, (_, i) => i + 1).map((round) => {
              const isActive = activeRound === round;
              return (
                <TouchableOpacity
                  key={round}
                  style={[styles.roundTab, isActive && styles.roundTabActive]}
                  onPress={() => setActiveRound(round)}
                  activeOpacity={0.7}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.roundTabText, isActive && styles.roundTabTextActive]}
                  >
                    {roundLabel(round, numRounds)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Match Cards */}
          <ScrollView contentContainerStyle={styles.scheduleList}>
            {currentRoundMatches.length === 0 ? (
              <Text style={styles.emptyText}>No matches in this round yet.</Text>
            ) : (
              currentRoundMatches.map((m, i) => renderMatchCard(m, i))
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center', alignItems: 'center',
  },
  backArrow: {
    width: 12, height: 12,
    borderLeftWidth: 2.5, borderBottomWidth: 2.5,
    borderColor: '#64748b',
    transform: [{ rotate: '45deg' }, { translateX: 2 }],
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    gap: 10,
    alignItems: 'center',
  },
  actionPill: {
    flex: 1, height: 42, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  actionPillPrimary: {
    backgroundColor: '#2563eb',
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 6,
    elevation: 3,
  },
  actionPillSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#dbe3ee',
  },
  actionPillTextPrimary: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  actionPillTextSecondary: { color: '#334155', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  settingsButton: {
    width: 42, height: 42, borderRadius: 11,
    borderWidth: 1.5, borderColor: '#dbe3ee',
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  loadingText: { marginTop: 12, fontSize: 15, color: '#94a3b8' },
  errorText: { fontSize: 15, color: '#ef4444', marginBottom: 16 },
  retryButton: {
    backgroundColor: '#d97706',
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12,
  },
  retryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  fullScheduleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScheduleText: { fontSize: 14, fontWeight: '700', color: '#0f172a' },

  roundTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
  },
  roundTab: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundTabActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  roundTabText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  roundTabTextActive: { color: '#2563eb', fontWeight: '700' },

  scheduleList: { padding: 16, paddingBottom: 60 },
  emptyText: {
    textAlign: 'center', color: '#94a3b8', fontSize: 14, marginTop: 40,
  },

  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  matchDivider: {
    height: 1,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 8,
  },
  matchNumberContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#eef2ff',
    borderWidth: 1.5,
    borderColor: '#c7d2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  matchNumberText: { fontSize: 13, fontWeight: '800', color: '#4f46e5' },

  // Left column: stacked Team A / action / Team B. Equal flex with winner column.
  // Heights are fixed so the bracket connector can position its lines precisely.
  matchCenter: {
    flex: 1,
    gap: 6,
    alignItems: 'stretch',
  },
  teamBox: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 8,
    gap: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
    elevation: 1,
  },
  teamBoxTBD: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    shadowOpacity: 0,
    elevation: 0,
  },
  teamBoxWinner: {
    backgroundColor: '#ecfdf5',
    borderColor: '#6ee7b7',
  },
  teamBoxText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1e293b' },
  teamBoxTextTBD: { color: '#94a3b8', fontWeight: '500', fontSize: 13 },
  teamBoxTextWin: { color: '#047857', fontWeight: '800' },

  // Seed number badge shown next to each team.
  seedBadge: {
    width: 22, height: 22, borderRadius: 7,
    backgroundColor: '#1e293b',
    justifyContent: 'center', alignItems: 'center',
  },
  seedBadgeTBD: { backgroundColor: '#cbd5e1' },
  seedBadgeWin: { backgroundColor: '#059669' },
  seedBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'] },
  seedBadgeTextWin: { color: '#fff' },

  actionButton: {
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    minWidth: 96,
    maxWidth: '95%',
  },
  actionButtonStart: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  actionButtonCompleted: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  actionButtonDisabled: { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  actionButtonText: { fontSize: 12, fontWeight: '700' },
  actionButtonTextStart: { color: '#2563eb' },
  actionButtonTextCompleted: { color: '#10b981' },
  actionButtonTextDisabled: { color: '#94a3b8' },

  // Bracket connector: two horizontal stubs from team boxes meet a vertical
  // line, which then sends one horizontal line out to the winner box.
  // matchCenter total height = 36 + 6 + 28 + 6 + 36 = 112.
  // Team A vertical center: 18. Team B vertical center: 36+6+28+6+18 = 94. Mid: 56.
  bracket: {
    width: 28,
    height: 112,
    position: 'relative',
  },
  bracketHLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#cbd5e1',
  },
  bracketTopLine: {
    top: 17,         // 18 - half line thickness
    left: 0,
    width: 14,       // stub from team A to vertical
  },
  bracketBottomLine: {
    top: 93,         // 94 - half line thickness
    left: 0,
    width: 14,
  },
  bracketVLine: {
    position: 'absolute',
    width: 2,
    backgroundColor: '#cbd5e1',
    left: 12,        // sits just inside the stub right-edge
    top: 18,
    height: 76,      // 94 - 18
  },
  bracketMidLine: {
    top: 55,         // 56 - half line thickness
    left: 12,
    width: 16,       // from vertical line out to winner box
  },

  // Right column: winner box, same width as Team boxes via flex:1.
  winnerColumn: {
    flex: 1,
    height: 112,
    justifyContent: 'center',
  },
  winnerBox: {
    height: 36,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 10,
    backgroundColor: '#fffbeb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  winnerBoxEmpty: {
    borderStyle: 'dashed',
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  winnerText: { fontSize: 14, fontWeight: '800', color: '#b45309' },
});

export default KnockoutScheduleScreen;
