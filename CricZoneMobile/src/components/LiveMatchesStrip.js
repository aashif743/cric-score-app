import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Carousel geometry: a wide, centered card with the neighbours peeking on
// either side. Snap so each card lands centered.
const SCREEN_W = Dimensions.get('window').width;
const CARD_SPACING = 14;
const CARD_W = SCREEN_W - 100;         // smaller card → larger peek on both sides
const SNAP = CARD_W + CARD_SPACING;
const SIDE_PAD = (SCREEN_W - CARD_W) / 2 - CARD_SPACING / 2;
import io from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import liveService from '../utils/liveService';
import { SOCKET_URL } from '../api/config';

// --- Helpers ---------------------------------------------------------------

const initialOf = (s) => (s || '?').trim().charAt(0).toUpperCase();

// 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th" ...
const ordinal = (n) => {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

// Which schedule screen to open, by tournament format.
const scheduleRouteFor = (format) =>
  format === 'league' ? 'LeagueSchedule'
    : format === 'knockout' ? 'KnockoutSchedule'
    : 'TournamentDetail';

// Line shown under the scores: who's batting first (1st innings) or the chase
// equation (2nd innings).
const matchSituation = (m) => {
  if (m.innings === 2 && m.target) {
    const team = m.innings2?.battingTeam || m.teamB?.name || 'Team';
    const need = m.target - (m.innings2?.runs ?? 0);
    if (need > 0) return `${team} need ${need} run${need === 1 ? '' : 's'} to win`;
    return `${team} won`;
  }
  const team = m.innings1?.battingTeam || m.teamA?.name || 'Team';
  return `${team} batting first`;
};

// Return the score line for whichever team batted in this innings, or '—'
// when there's no data yet.
const scoreFor = (team, m) => {
  if (!team || !m) return null;
  const i1 = m.innings1 || {};
  const i2 = m.innings2 || {};
  let innings = null;
  if (i1.battingTeam === team) innings = i1;
  else if (i2.battingTeam === team) innings = i2;
  if (!innings) return null;
  return {
    runs: innings.runs ?? 0,
    wickets: innings.wickets ?? 0,
    overs: innings.overs ?? '0.0',
    isBatting: false,
  };
};

const currentlyBatting = (m) => {
  if (m.innings === 2 && m.innings2?.battingTeam) return m.innings2.battingTeam;
  if (m.innings === 1 && m.innings1?.battingTeam) return m.innings1.battingTeam;
  // Fallback: most recent innings with a battingTeam
  return m.innings2?.battingTeam || m.innings1?.battingTeam || null;
};

// --- Live pulse dot --------------------------------------------------------

const LivePulse = () => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.8, duration: 800, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, { opacity, transform: [{ scale }] }]} />
      <View style={styles.pulseDot} />
    </View>
  );
};

// --- Card ------------------------------------------------------------------

const LiveMatchCard = ({ match, index, onPress, navigation, cardWidth }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 280, delay: index * 60,
        useNativeDriver: true, easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(translateX, {
        toValue: 0, duration: 280, delay: index * 60,
        useNativeDriver: true, easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, []);

  const isCompleted = match.status === 'completed';
  const battingTeam = currentlyBatting(match);
  const teamA = match.teamA?.name || 'Team A';
  const teamB = match.teamB?.name || 'Team B';
  const scoreA = scoreFor(teamA, match);
  const scoreB = scoreFor(teamB, match);

  return (
    <Animated.View
      style={{ opacity, marginHorizontal: CARD_SPACING / 2, transform: [{ translateX }, { scale: scaleAnim }] }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPress(match)}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, friction: 8, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start()}
      >
        <LinearGradient
          colors={isCompleted ? ['#064e3b', '#0f766e', '#115e59'] : ['#1e1b4b', '#3b1d6e', '#1e3a8a']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.card, cardWidth ? { width: cardWidth } : null]}
        >
          {/* Top row: LIVE pulse / RESULT tag + tournament + match number */}
          <View style={styles.cardHeader}>
            {isCompleted ? (
              <View style={styles.doneTag}>
                <Text style={styles.doneText}>RESULT</Text>
              </View>
            ) : (
              <View style={styles.liveTag}>
                <LivePulse />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
            <View style={styles.tournamentRow}>
              <Text style={styles.tournamentName} numberOfLines={1}>{match.tournamentName || 'Live Match'}</Text>
              <Text style={styles.inningsText} numberOfLines={1}>
                {match.matchNumber ? `${ordinal(match.matchNumber)} match` : (isCompleted ? 'Result' : 'Live')}
                {match.status === 'innings_break' ? ' • Break' : ''}
                {isCompleted ? ' • Completed' : ''}
              </Text>
            </View>
          </View>

          {/* Team A row */}
          <View style={styles.teamRow}>
            <View style={[styles.teamBadge, battingTeam === teamA && styles.teamBadgeBatting]}>
              <Text style={styles.teamBadgeText}>{initialOf(teamA)}</Text>
            </View>
            <Text style={styles.teamName} numberOfLines={1}>{teamA}</Text>
            <View style={styles.scoreBlock}>
              {scoreA ? (
                <>
                  <Text style={styles.scoreRuns}>{scoreA.runs}/{scoreA.wickets}</Text>
                  <Text style={styles.scoreOvers}>({scoreA.overs})</Text>
                </>
              ) : (
                <Text style={styles.scorePending}>Yet to bat</Text>
              )}
            </View>
          </View>

          {/* Team B row */}
          <View style={styles.teamRow}>
            <View style={[styles.teamBadge, styles.teamBadgeAlt, battingTeam === teamB && styles.teamBadgeBatting]}>
              <Text style={styles.teamBadgeText}>{initialOf(teamB)}</Text>
            </View>
            <Text style={styles.teamName} numberOfLines={1}>{teamB}</Text>
            <View style={styles.scoreBlock}>
              {scoreB ? (
                <>
                  <Text style={styles.scoreRuns}>{scoreB.runs}/{scoreB.wickets}</Text>
                  <Text style={styles.scoreOvers}>({scoreB.overs})</Text>
                </>
              ) : (
                <Text style={styles.scorePending}>Yet to bat</Text>
              )}
            </View>
          </View>

          {/* Situation line: result (completed) or batting/chase equation (live) */}
          <View style={styles.situationRow}>
            <View style={styles.footerDot} />
            <Text style={styles.situationText} numberOfLines={1}>
              {isCompleted ? (match.result || 'Match completed') : matchSituation(match)}
            </Text>
          </View>

          {/* Actions: Schedule + (league only) Points Table */}
          {match.tournament ? (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                activeOpacity={0.8}
                onPress={() => navigation?.navigate(scheduleRouteFor(match.tournamentFormat), { tournamentId: match.tournament })}
              >
                <Text style={styles.actionBtnText}>Schedule</Text>
              </TouchableOpacity>
              {match.tournamentFormat === 'league' ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnAlt]}
                  activeOpacity={0.8}
                  onPress={() => navigation?.navigate('LeaguePointsTable', { tournamentId: match.tournament })}
                >
                  <Text style={styles.actionBtnText}>Points Table</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// --- Strip -----------------------------------------------------------------

// Refetch debounce so a flurry of socket events (each ball is one) collapses
// into a single API call within a small window. Important during fast scoring.
const REFETCH_DEBOUNCE_MS = 600;

// Fallback polling interval — guarantees the strip refreshes even when a socket
// event is missed (backgrounded app, dropped WebSocket, etc.).
const POLL_INTERVAL_MS = 12000;

const LiveMatchesStrip = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const [matches, setMatches] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef(null);
  const socketRef = useRef(null);
  const refetchTimer = useRef(null);
  const containerOpacity = useRef(new Animated.Value(0)).current;

  const fetchMatches = useCallback(async () => {
    if (!user?.token) return;
    try {
      const data = await liveService.getLiveMatches(user.token);
      setMatches(data);
    } catch (err) {
      console.warn('LiveMatchesStrip fetch error:', err);
    } finally {
      setLoaded(true);
      Animated.timing(containerOpacity, {
        toValue: 1, duration: 350, useNativeDriver: true,
      }).start();
    }
  }, [user?.token]);

  // Initial fetch + socket subscription. The socket gives instant updates; a
  // periodic poll is a fallback so scores still refresh within seconds even if
  // a socket event is dropped/delayed (mobile backgrounding, flaky networks,
  // WebSocket hiccups). We also re-fetch on every (re)connect to catch up.
  useEffect(() => {
    if (!user?.token) return;
    fetchMatches();

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    const debouncedRefetch = () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => { fetchMatches(); }, REFETCH_DEBOUNCE_MS);
    };

    socket.on('connect', () => {
      socket.emit('join-public-live');
      fetchMatches(); // catch up after a (re)connect
    });
    socket.on('public-live-update', debouncedRefetch);

    // Fallback poll — caps staleness even if no socket event arrives.
    const poll = setInterval(() => { fetchMatches(); }, POLL_INTERVAL_MS);

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      clearInterval(poll);
      try {
        socket.emit('leave-public-live');
        socket.disconnect();
      } catch (_) {}
      socketRef.current = null;
    };
  }, [user?.token, fetchMatches]);

  const onCardPress = (match) => {
    // Finished matches open the full scorecard; live ones open the live viewer.
    if (match.status === 'completed') {
      navigation.navigate('FullScorecard', { matchId: match._id });
    } else {
      navigation.navigate('PublicLiveMatch', { matchId: match._id });
    }
  };

  // Hide the entire strip until first load completes — avoids a flicker.
  if (!loaded || matches.length === 0) return null;

  const N = matches.length;
  const loop = N > 1;
  // For an infinite carousel we render three copies and keep the user parked in
  // the middle copy; when they cross into the first/last copy we silently jump
  // back to the equivalent card in the middle. Single match → no looping.
  const data = loop ? [...matches, ...matches, ...matches] : matches;

  // Live (per-frame) dot tracking so the indicator follows the finger, not just
  // the settle. Only commit state when the centered index actually changes.
  const onScroll = (e) => {
    const raw = Math.round(e.nativeEvent.contentOffset.x / SNAP);
    const real = ((raw % N) + N) % N;
    setActiveIndex((prev) => (prev === real ? prev : real));
  };

  const onMomentumEnd = (e) => {
    if (!loop) return;
    const raw = Math.round(e.nativeEvent.contentOffset.x / SNAP);
    if (raw < N || raw >= 2 * N) {
      const real = ((raw % N) + N) % N;
      listRef.current?.scrollToOffset({ offset: (N + real) * SNAP, animated: false });
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.headerDot} />
          <Text style={styles.headerTitle}>Live &amp; Recent</Text>
        </View>
        <Text style={styles.headerCount}>
          {N} {N === 1 ? 'match' : 'matches'}
        </Text>
      </View>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(m, i) => `${m._id}_${i}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        contentOffset={loop ? { x: N * SNAP, y: 0 } : undefined}
        snapToInterval={SNAP}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item, index }) => (
          <LiveMatchCard match={item} index={index % N} cardWidth={CARD_W} onPress={onCardPress} navigation={navigation} />
        )}
      />

      {/* Pagination dots */}
      {loop ? (
        <View style={styles.dotsRow}>
          {matches.map((m, i) => (
            <View key={m._id} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 4 },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#dc2626' },
  headerTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a', letterSpacing: 0.4, textTransform: 'uppercase' },
  headerCount: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },

  list: { paddingHorizontal: SIDE_PAD, paddingBottom: 14 },

  // Pagination dots
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingBottom: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#cbd5e1' },
  dotActive: { width: 18, backgroundColor: '#4f46e5' },

  // Card
  card: {
    width: CARD_W,
    padding: 16,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#1e1b4b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 14,
    elevation: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  liveTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(220,38,38,0.25)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)',
  },
  liveText: { color: '#fca5a5', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  doneTag: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(16,185,129,0.22)',
    borderWidth: 1, borderColor: 'rgba(110,231,183,0.45)',
  },
  doneText: { color: '#a7f3d0', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  tournamentRow: { flex: 1 },
  tournamentName: { color: 'rgba(255,255,255,0.95)', fontSize: 11, fontWeight: '700' },
  inningsText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600', marginTop: 1 },

  teamRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  teamBadge: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: '#0d3b66',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  teamBadgeAlt: { backgroundColor: '#2d7dd2' },
  teamBadgeBatting: { borderWidth: 2, borderColor: '#fde047' },
  teamBadgeText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  teamName: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '700' },
  scoreBlock: { alignItems: 'flex-end' },
  scoreRuns: { color: '#fff', fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] },
  scoreOvers: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'] },
  scorePending: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600', fontStyle: 'italic' },

  footerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)',
  },
  footerDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fde047' },
  footerText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700' },

  situationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12,
  },
  situationText: { flex: 1, color: '#fde047', fontSize: 12, fontWeight: '800' },

  actionRow: {
    flexDirection: 'row', gap: 10,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)',
  },
  actionBtn: {
    flex: 1, alignItems: 'center',
    paddingVertical: 8, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  actionBtnAlt: { backgroundColor: 'rgba(253,224,71,0.18)', borderColor: 'rgba(253,224,71,0.35)' },
  actionBtnText: { color: '#fff', fontSize: 11.5, fontWeight: '800', letterSpacing: 0.3 },

  // Pulse
  pulseWrap: { width: 8, height: 8, justifyContent: 'center', alignItems: 'center' },
  pulseRing: {
    position: 'absolute', width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
});

export default LiveMatchesStrip;
