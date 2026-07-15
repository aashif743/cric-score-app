import React, { useState, useContext, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { AuthContext } from '../context/AuthContext';
import tournamentService from '../utils/tournamentService';
import GradientHeader from '../components/GradientHeader';
import TournamentTopTabs from '../components/TournamentTopTabs';
import PointsTableView from '../components/PointsTableView';
import TournamentStatsView from '../components/TournamentStatsView';

// --- Small helpers ---------------------------------------------------------

// Clean line-style settings gear (Feather-ish). Crisp at any size.
const SettingsIcon = ({ size = 20, color = '#475569' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const groupLetter = (i) => String.fromCharCode(65 + i);

const koRoundLabel = (round, numRounds) => {
  if (round === numRounds) return 'Final';
  if (round === numRounds - 1) return 'Semifinal';
  if (round === numRounds - 2) return 'Quarterfinal';
  return `Round ${round}`;
};

const winnerOf = (m) => {
  if (m.status !== 'completed') return null;
  if (m.matchSummary?.winner) return m.matchSummary.winner;
  const idx = m.result?.indexOf(' won by ') ?? -1;
  return idx > 0 ? m.result.slice(0, idx) : null;
};

const scoreLine = (innings) => {
  if (!innings || (!innings.runs && innings.runs !== 0)) return null;
  return `${innings.runs || 0}/${innings.wickets || 0}`;
};

// Pull each team's score regardless of which innings they batted in.
const teamScores = (match) => {
  const aName = match.teamA?.name;
  const i1 = match.innings1 || {};
  const i2 = match.innings2 || {};
  const aFirst = i1.battingTeam === aName;
  return {
    a: aFirst ? i1 : i2,
    b: aFirst ? i2 : i1,
  };
};

const initial = (name) => (name || '?').trim().charAt(0).toUpperCase();

// --- Status pill -----------------------------------------------------------

const STATUS = {
  scheduled:  { label: 'Upcoming',  bg: '#f1f5f9', fg: '#64748b', dot: '#94a3b8' },
  in_progress:{ label: 'Live',      bg: '#fee2e2', fg: '#dc2626', dot: '#dc2626' },
  innings_break:{ label: 'Innings Break', bg: '#fef3c7', fg: '#d97706', dot: '#d97706' },
  completed:  { label: 'Completed', bg: '#dcfce7', fg: '#059669', dot: '#10b981' },
  abandoned:  { label: 'Abandoned', bg: '#f1f5f9', fg: '#64748b', dot: '#94a3b8' },
};

const StatusPill = ({ status }) => {
  const cfg = STATUS[status] || STATUS.scheduled;
  return (
    <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.statusText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
};

// --- Animated card wrapper -------------------------------------------------

const AnimatedCard = ({ index, children, onPress }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay: index * 55,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        delay: index * 55,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, []);

  const pressIn = () => Animated.spring(scale, { toValue: 0.98, friction: 9, tension: 120, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, friction: 9, tension: 120, useNativeDriver: true }).start();

  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      <Wrapper
        activeOpacity={0.85}
        {...(onPress ? { onPress, onPressIn: pressIn, onPressOut: pressOut } : {})}
      >
        {children}
      </Wrapper>
    </Animated.View>
  );
};

// --- Group-stage match card ------------------------------------------------

const GroupMatchCard = ({ match, index, ordinal, groupId, onStart, isOwner }) => {
  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'in_progress' || match.status === 'innings_break';
  const winner = winnerOf(match);
  const teamA = match.teamA?.name || 'Team A';
  const teamB = match.teamB?.name || 'Team B';
  const scores = teamScores(match);
  const showScores = isCompleted || isLive || !!scores.a?.runs || !!scores.b?.runs;

  const TeamRow = ({ name, score, isWinner, color }) => (
    <View style={styles.teamRow}>
      <View style={[styles.teamBadge, { backgroundColor: color }]}>
        <Text style={styles.teamBadgeText}>{initial(name)}</Text>
      </View>
      <Text
        style={[styles.teamName, isWinner && styles.teamNameWinner]}
        numberOfLines={1}
      >
        {name}
      </Text>
      {showScores && score ? (
        <View style={styles.scoreBlock}>
          <Text style={[styles.scoreRuns, isWinner && styles.scoreRunsWinner]}>
            {scoreLine(score) || '—'}
          </Text>
          {score.overs ? (
            <Text style={styles.scoreOvers}>({score.overs})</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <AnimatedCard index={index} onPress={() => onStart(match)}>
      <View style={styles.matchCard}>
        {/* Accent strip on the left. Color shifts based on status. */}
        <View
          style={[
            styles.accentStrip,
            {
              backgroundColor:
                isCompleted ? '#10b981'
                : isLive    ? '#dc2626'
                : '#cbd5e1',
            },
          ]}
        />

        <View style={styles.matchCardInner}>
          {/* Header row: ordinal + group + status */}
          <View style={styles.matchCardHeader}>
            <View style={styles.matchLabels}>
              <Text style={styles.matchOrdinal}>Match {ordinal}</Text>
              <View style={styles.groupChip}>
                <Text style={styles.groupChipText}>Group {groupId}</Text>
              </View>
            </View>
            <StatusPill status={match.status} />
          </View>

          {/* Teams (with scores when applicable) */}
          <View style={styles.teamsBlock}>
            <TeamRow
              name={teamA}
              score={scores.a}
              isWinner={winner === teamA}
              color="#0d3b66"
            />
            <TeamRow
              name={teamB}
              score={scores.b}
              isWinner={winner === teamB}
              color="#2d7dd2"
            />
          </View>

          {/* Result line for completed matches */}
          {isCompleted && match.result ? (
            <View style={styles.resultRow}>
              <View style={styles.resultBullet} />
              <Text style={styles.resultText} numberOfLines={2}>{match.result}</Text>
            </View>
          ) : null}

          {/* Action button. Owners see Start/Resume/View Summary; visitors
              only get the read-only View Summary (live → tap card to watch). */}
          {(isOwner || isCompleted) ? (
            <View style={styles.actionRow}>
              <View
                style={[
                  styles.actionButton,
                  isCompleted ? styles.actionButtonCompleted
                  : isLive    ? styles.actionButtonLive
                              : styles.actionButtonStart,
                ]}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    isCompleted ? styles.actionButtonTextCompleted
                    : isLive    ? styles.actionButtonTextLive
                                : styles.actionButtonTextStart,
                  ]}
                >
                  {isCompleted ? 'View Summary' : isLive ? 'Resume' : 'Start Match'}
                </Text>
                <View
                  style={[
                    styles.actionChevron,
                    {
                      borderColor: isCompleted ? '#059669' : isLive ? '#dc2626' : '#2563eb',
                    },
                  ]}
                />
              </View>
            </View>
          ) : isLive ? (
            <View style={styles.actionRow}>
              <View style={[styles.actionButton, styles.actionButtonLive]}>
                <Text style={[styles.actionButtonText, styles.actionButtonTextLive]}>Watch Live</Text>
                <View style={[styles.actionChevron, { borderColor: '#dc2626' }]} />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </AnimatedCard>
  );
};

// --- Knockout match card (bracket-style, polished) -------------------------

const KnockoutMatchCard = ({ match, index, ordinal, roundLabel, onStart, isOwner }) => {
  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'in_progress' || match.status === 'innings_break';
  const winner = winnerOf(match);
  const teamAName = match.teamA?.name || 'TBD';
  const teamBName = match.teamB?.name || 'TBD';
  const bothKnown = teamAName !== 'TBD' && teamBName !== 'TBD';
  const scores = teamScores(match);
  const showScores = isCompleted || isLive;

  const buttonLabel = isCompleted ? 'View Summary' : isLive ? 'Resume' : (bothKnown ? 'Start Match' : 'Waiting…');
  const buttonDisabled = !isCompleted && !isLive && !bothKnown;

  return (
    <AnimatedCard index={index} onPress={buttonDisabled ? null : () => onStart(match)}>
      <View style={[styles.matchCard, styles.knockoutCard]}>
        <View
          style={[
            styles.accentStrip,
            {
              backgroundColor:
                isCompleted ? '#10b981'
                : isLive    ? '#dc2626'
                : bothKnown ? '#94a3b8'
                : '#cbd5e1',
            },
          ]}
        />
        <View style={styles.matchCardInner}>
          <View style={styles.matchCardHeader}>
            <View style={styles.matchLabels}>
              <Text style={styles.matchOrdinal}>Match {ordinal}</Text>
              <View style={[styles.groupChip, styles.koChip]}>
                <Text style={[styles.groupChipText, styles.koChipText]}>{roundLabel}</Text>
              </View>
            </View>
            <StatusPill status={match.status} />
          </View>

          <View style={styles.teamsBlock}>
            <View style={styles.teamRow}>
              <View style={[styles.teamBadge, { backgroundColor: teamAName === 'TBD' ? '#cbd5e1' : '#0d3b66' }]}>
                <Text style={styles.teamBadgeText}>{teamAName === 'TBD' ? '?' : initial(teamAName)}</Text>
              </View>
              <Text style={[styles.teamName, winner === teamAName && styles.teamNameWinner, teamAName === 'TBD' && styles.teamNameTBD]} numberOfLines={1}>
                {teamAName}
              </Text>
              {showScores && scores.a ? (
                <View style={styles.scoreBlock}>
                  <Text style={[styles.scoreRuns, winner === teamAName && styles.scoreRunsWinner]}>
                    {scoreLine(scores.a) || '—'}
                  </Text>
                  {scores.a?.overs ? <Text style={styles.scoreOvers}>({scores.a.overs})</Text> : null}
                </View>
              ) : null}
            </View>
            <View style={styles.teamRow}>
              <View style={[styles.teamBadge, { backgroundColor: teamBName === 'TBD' ? '#cbd5e1' : '#2d7dd2' }]}>
                <Text style={styles.teamBadgeText}>{teamBName === 'TBD' ? '?' : initial(teamBName)}</Text>
              </View>
              <Text style={[styles.teamName, winner === teamBName && styles.teamNameWinner, teamBName === 'TBD' && styles.teamNameTBD]} numberOfLines={1}>
                {teamBName}
              </Text>
              {showScores && scores.b ? (
                <View style={styles.scoreBlock}>
                  <Text style={[styles.scoreRuns, winner === teamBName && styles.scoreRunsWinner]}>
                    {scoreLine(scores.b) || '—'}
                  </Text>
                  {scores.b?.overs ? <Text style={styles.scoreOvers}>({scores.b.overs})</Text> : null}
                </View>
              ) : null}
            </View>
          </View>

          {isCompleted && match.result ? (
            <View style={styles.resultRow}>
              <View style={styles.resultBullet} />
              <Text style={styles.resultText} numberOfLines={2}>{match.result}</Text>
            </View>
          ) : null}

          {(isOwner || isCompleted) ? (
            <View style={styles.actionRow}>
              <View
                style={[
                  styles.actionButton,
                  isCompleted ? styles.actionButtonCompleted
                  : isLive    ? styles.actionButtonLive
                  : buttonDisabled ? styles.actionButtonDisabled
                                   : styles.actionButtonStart,
                ]}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    isCompleted ? styles.actionButtonTextCompleted
                    : isLive    ? styles.actionButtonTextLive
                    : buttonDisabled ? styles.actionButtonTextDisabled
                                     : styles.actionButtonTextStart,
                  ]}
                >
                  {buttonLabel}
                </Text>
                {!buttonDisabled && (
                  <View
                    style={[
                      styles.actionChevron,
                      {
                        borderColor: isCompleted ? '#059669' : isLive ? '#dc2626' : '#2563eb',
                      },
                    ]}
                  />
                )}
              </View>
            </View>
          ) : isLive ? (
            <View style={styles.actionRow}>
              <View style={[styles.actionButton, styles.actionButtonLive]}>
                <Text style={[styles.actionButtonText, styles.actionButtonTextLive]}>Watch Live</Text>
                <View style={[styles.actionChevron, { borderColor: '#dc2626' }]} />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </AnimatedCard>
  );
};

// --- Screen ----------------------------------------------------------------

const LeagueScheduleScreen = ({ navigation, route }) => {
  const { user } = useContext(AuthContext);
  const { tournamentId } = route.params || {};

  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState({ kind: 'group', id: 'A' });
  const [switchingFormat, setSwitchingFormat] = useState(false);

  // Top-level view tab: Matches | Points Table | Stats — switched in-place so
  // it feels like tabs (no page navigation / reload).
  const [activeView, setActiveView] = useState('matches');
  // Stats are lazily fetched the first time the Stats tab is opened, then cached
  // so switching back is instant.
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');

  const fetchData = useCallback(async () => {
    if (!user?.token || !tournamentId) return;
    try {
      setLoading(true); setError('');
      const res = await tournamentService.getTournament(tournamentId, user.token);
      setTournament(res.data);
      setMatches(res.data.matches || []);
    } catch (err) {
      console.warn('Fetch league schedule error:', err);
      setError('Failed to load schedule.');
    } finally {
      setLoading(false);
    }
  }, [user?.token, tournamentId]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const fetchStats = useCallback(async () => {
    if (!user?.token || !tournamentId) return;
    try {
      setStatsLoading(true); setStatsError('');
      const res = await tournamentService.getTournamentStats(tournamentId, user.token);
      setStats(res?.data || res || {});
    } catch (err) {
      console.warn('Tournament stats error:', err);
      setStatsError('Failed to load stats.');
    } finally {
      setStatsLoading(false);
    }
  }, [user?.token, tournamentId]);

  // Load stats the first time the Stats tab is opened.
  useEffect(() => {
    if (activeView === 'stats' && stats === null && !statsLoading && !statsError) {
      fetchStats();
    }
  }, [activeView, stats, statsLoading, statsError, fetchStats]);

  const groups = tournament?.groups || [];
  const hasKnockout = (tournament?.teamsAdvancePerGroup || 0) > 0;
  const groupMatches = matches.filter((m) => m.stage === 'group');
  const knockoutMatches = matches.filter((m) => m.stage === 'knockout');
  const numKnockoutRounds = knockoutMatches.length
    ? Math.max(...knockoutMatches.map((m) => m.round || 0))
    : 0;

  // Only the tournament creator gets owner actions (Settings, Start/Resume).
  // Visitors who open the schedule from a live card only view.
  const myId = user?.id || user?._id;
  const isOwner = !!(tournament?.user && myId && String(tournament.user) === String(myId));

  const isQualifier = tournament?.playoffFormat === 'qualifier';
  // Qualifier playoffs require exactly 4 qualifiers; the format can only be
  // changed before any playoff match has started.
  const advancingTotal = (tournament?.numberOfGroups || 0) * (tournament?.teamsAdvancePerGroup || 0);
  const qualifierAvailable = advancingTotal === 4;
  const playoffsStarted = knockoutMatches.some((m) => m.status && m.status !== 'scheduled');

  const changePlayoffFormat = async (fmt) => {
    if (!tournament?._id || switchingFormat || fmt === tournament.playoffFormat) return;
    setSwitchingFormat(true);
    try {
      await tournamentService.setPlayoffFormat(tournament._id, fmt, user.token);
      await fetchData();
    } catch (err) {
      Alert.alert('Cannot change format', err?.response?.data?.error || err?.error || 'Failed to change playoff format.');
    } finally {
      setSwitchingFormat(false);
    }
  };

  const tabs = useMemo(() => {
    const g = groups.map((_, i) => ({
      key: `g_${groupLetter(i)}`, kind: 'group', id: groupLetter(i),
      label: `Group ${groupLetter(i)}`,
    }));
    // IPL-style playoffs are shown together under one "Playoffs" tab (their
    // labels — Qualifier 1, Eliminator, … — distinguish them). A standard
    // knockout uses one tab per round.
    const k = isQualifier
      ? [{ key: 'po', kind: 'playoffs', id: 'po', label: '2nd Round' }]
      : Array.from({ length: numKnockoutRounds }, (_, i) => ({
          key: `k_${i + 1}`, kind: 'knockout', id: i + 1,
          label: koRoundLabel(i + 1, numKnockoutRounds),
        }));
    return [...g, ...(hasKnockout ? k : [])];
  }, [groups, numKnockoutRounds, hasKnockout, isQualifier]);

  const startMatchPayload = (match) => ({
    tournamentId: tournament?._id,
    matchId: match._id,
    tournamentDefaults: {
      totalOvers: tournament?.totalOvers ?? match.totalOvers,
      playersPerTeam: tournament?.playersPerTeam ?? match.playersPerTeam,
      ballsPerOver: tournament?.ballsPerOver ?? match.ballsPerOver,
      venue: tournament?.venue,
      tournamentName: tournament?.name,
      teamNames: [match.teamA.name, match.teamB.name],
    },
  });

  const handleStartMatch = (match) => {
    // Completed matches are read-only for everyone → open the summary.
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
        !match.teamB?.name || match.teamB.name === 'TBD') return;
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
    navigation.navigate('MatchSetup', startMatchPayload(match));
  };

  const matchesForActiveTab = useMemo(() => {
    if (activeTab.kind === 'group') {
      return groupMatches
        .filter((m) => m.group === activeTab.id)
        .sort((a, b) => (a.round || 0) - (b.round || 0));
    }
    if (activeTab.kind === 'playoffs') {
      // All playoff matches in playing order (Qualifier 1, Eliminator, …).
      return [...knockoutMatches].sort((a, b) =>
        (a.round || 0) - (b.round || 0) || (a.bracketSlot || 0) - (b.bracketSlot || 0));
    }
    return knockoutMatches
      .filter((m) => m.round === activeTab.id)
      .sort((a, b) => (a.bracketSlot || 0) - (b.bracketSlot || 0));
  }, [activeTab, groupMatches, knockoutMatches]);

  const onPressSettings = () => {
    if (!tournament?._id) return;
    navigation.navigate('TournamentCreate', { tournamentId: tournament._id, tournamentData: tournament });
  };

  // --- Render ---

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <GradientHeader title="Schedule" subtitle="League" onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading schedule…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <GradientHeader title="Schedule" subtitle="League" onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentTabLabel = tabs.find((t) => t.kind === activeTab.kind && t.id === activeTab.id)?.label;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <GradientHeader
        title={tournament?.name || 'Schedule'}
        subtitle={`${matches.length} ${matches.length === 1 ? 'match' : 'matches'} • ${groups.length} ${groups.length === 1 ? 'group' : 'groups'}`}
        onBack={() => navigation.goBack()}
      />

      {/* Top nav: Matches · Points Table · Stats — switches in-place (tabs) */}
      <TournamentTopTabs
        active={activeView}
        onSelect={setActiveView}
        tournamentId={tournament?._id}
        tournamentName={tournament?.name}
        isOwner={isOwner}
        onPressSettings={onPressSettings}
      />

      {activeView === 'points' ? (
        <PointsTableView tournament={tournament} />
      ) : activeView === 'stats' ? (
        statsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text style={styles.loadingText}>Loading stats…</Text>
          </View>
        ) : statsError ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.errorText}>{statsError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchStats}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TournamentStatsView stats={stats} />
        )
      ) : (
      <>
      {/* Stage tab strip — group / playoff filters, Matches page only */}
      <View style={styles.tabStripWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabStrip}
        >
          {tabs.map((t) => {
            const isActive = activeTab.kind === t.kind && activeTab.id === t.id;
            return (
              <TouchableOpacity
                key={t.key}
                activeOpacity={0.7}
                onPress={() => setActiveTab({ kind: t.kind, id: t.id })}
                style={[styles.tab, isActive && styles.tabActive]}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Match list */}
      <ScrollView contentContainerStyle={styles.scheduleList} showsVerticalScrollIndicator={false}>
        {matchesForActiveTab.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {activeTab.kind === 'group' ? 'No matches yet' : 'Knockout not ready'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab.kind === 'group'
                ? `Group ${activeTab.id} hasn't started.`
                : 'Teams will fill in once the group stage finishes.'}
            </Text>
          </View>
        ) : activeTab.kind === 'group' ? (
          matchesForActiveTab.map((m, i) => (
            <GroupMatchCard
              key={m._id}
              index={i}
              ordinal={i + 1}
              groupId={activeTab.id}
              match={m}
              onStart={handleStartMatch}
              isOwner={isOwner}
            />
          ))
        ) : (
          matchesForActiveTab.map((m, i) => (
            <KnockoutMatchCard
              key={m._id}
              index={i}
              ordinal={i + 1}
              roundLabel={m.matchLabel || currentTabLabel}
              match={m}
              onStart={handleStartMatch}
              isOwner={isOwner}
            />
          ))
        )}
      </ScrollView>
      </>
      )}
    </SafeAreaView>
  );
};

// --- Styles ----------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#94a3b8' },
  errorText: { fontSize: 15, color: '#ef4444', marginBottom: 16 },
  retryButton: { backgroundColor: '#2563eb', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  retryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    gap: 10,
    alignItems: 'center',
  },
  actionPill: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
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

  // Tabs — explicit height + minWidth keeps the pills readable when a
  // horizontal ScrollView is nested inside a fragment.
  tabStripWrap: { height: 52 },
  tabStrip: {
    paddingHorizontal: 16, paddingVertical: 6,
    gap: 8, alignItems: 'center',
  },
  tab: {
    minWidth: 100, height: 40,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#e2e8f0',
    justifyContent: 'center', alignItems: 'center',
  },
  tabActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  tabTextActive: { color: '#2563eb', fontWeight: '800' },

  scheduleList: { padding: 16, paddingBottom: 60 },

  // Playoff format switch
  formatBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 14, borderWidth: 1, borderColor: '#eef2f7',
  },
  formatBarLabel: { fontSize: 13, fontWeight: '800', color: '#334155' },
  formatLocked: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
  formatPills: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  formatPill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff',
  },
  formatPillActive: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  formatPillDisabled: { backgroundColor: '#f8fafc', borderColor: '#f1f5f9' },
  formatPillText: { fontSize: 12.5, fontWeight: '700', color: '#64748b' },
  formatPillTextActive: { color: '#4338ca', fontWeight: '800' },
  formatPillTextDisabled: { color: '#cbd5e1' },

  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#94a3b8', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#cbd5e1', textAlign: 'center' },

  // Match card
  matchCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  knockoutCard: {},
  accentStrip: { width: 4 },
  matchCardInner: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },

  matchCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  matchLabels: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchOrdinal: { fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 0.8, textTransform: 'uppercase' },
  groupChip: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, backgroundColor: '#eff6ff',
  },
  groupChipText: { fontSize: 11, fontWeight: '700', color: '#2563eb' },
  koChip: { backgroundColor: '#fef3c7' },
  koChipText: { color: '#b45309' },

  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },

  // Teams
  teamsBlock: { gap: 6 },
  teamRow: { flexDirection: 'row', alignItems: 'center' },
  teamBadge: {
    width: 28, height: 28, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  teamBadgeText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  teamName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0f172a' },
  teamNameWinner: { color: '#059669', fontWeight: '800' },
  teamNameTBD: { color: '#94a3b8', fontWeight: '500', fontStyle: 'italic' },

  scoreBlock: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  scoreRuns: { fontSize: 15, fontWeight: '800', color: '#0f172a', fontVariant: ['tabular-nums'] },
  scoreRunsWinner: { color: '#059669' },
  scoreOvers: { fontSize: 11, fontWeight: '600', color: '#94a3b8', fontVariant: ['tabular-nums'] },

  // Result + action
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  resultBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#d97706' },
  resultText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#475569' },

  actionRow: { marginTop: 10, alignItems: 'flex-end' },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1.5,
  },
  actionButtonStart:     { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  actionButtonCompleted: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  actionButtonLive:      { borderColor: '#dc2626', backgroundColor: '#fee2e2' },
  actionButtonDisabled:  { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  actionButtonText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  actionButtonTextStart:     { color: '#2563eb' },
  actionButtonTextCompleted: { color: '#059669' },
  actionButtonTextLive:      { color: '#dc2626' },
  actionButtonTextDisabled:  { color: '#94a3b8' },
  actionChevron: {
    width: 6, height: 6,
    borderRightWidth: 2, borderTopWidth: 2,
    transform: [{ rotate: '45deg' }],
  },

  // Stats panel
  statsLoading: { alignItems: 'center', paddingVertical: 60 },
  statsOverview: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, marginBottom: 14,
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  overviewCell: { flex: 1, alignItems: 'center' },
  overviewDivider: { width: 1, height: 32, backgroundColor: '#e2e8f0' },
  overviewNum: { fontSize: 24, fontWeight: '900', color: '#1e293b', fontVariant: ['tabular-nums'] },
  overviewLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },

  statsCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 14,
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statsCardTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
  statsEmpty: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },

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

  highlightRow: {
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  highlightLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.3 },
  highlightValue: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginTop: 2 },
});

export default LeagueScheduleScreen;
