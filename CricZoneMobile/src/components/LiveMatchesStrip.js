import React, { useState, useContext, useEffect, useRef, useCallback, useMemo } from 'react';
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

// Carousel geometry: a wide, centered card with the neighbours peeking on
// either side. Snap so each card lands centered.
const SCREEN_W = Dimensions.get('window').width;
const CARD_SPACING = 12;
const CARD_W = SCREEN_W - 44;          // wide, near-full-width card with a small peek
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

// Which match in a tournament group to show by default: the live one (earliest
// live by order) if any, otherwise the most recent (last, since sorted ascending).
const primaryMatchIndex = (list) => {
  const live = list.findIndex((m) => m.status === 'in_progress' || m.status === 'innings_break');
  return live >= 0 ? live : list.length - 1;
};

// One card per TOURNAMENT. Shows the current match (the live one, or the most
// recent if none live). All matches are browsable via the Schedule button, so
// the card just shows one match — keeping every card the same size.
const TournamentLiveCard = ({ group, index, onPress, navigation, cardWidth }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const list = group.matches;
  const activeIdx = primaryMatchIndex(list);
  const match = list[activeIdx] || list[0];

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
  const contextLine =
    match.matchLabel ||
    (match.group ? `Group ${match.group} Match` : null) ||
    (match.matchNumber ? `${ordinal(match.matchNumber)} Match` : (isCompleted ? 'Result' : 'Live Match'));

  const openTournament = () =>
    navigation?.navigate(scheduleRouteFor(match.tournamentFormat), { tournamentId: match.tournament });

  return (
    <Animated.View
      style={{ opacity, marginHorizontal: CARD_SPACING / 2, transform: [{ translateX }, { scale: scaleAnim }] }}
    >
      <View style={[styles.card, cardWidth ? { width: cardWidth } : null]}>
        {/* Context + LIVE / RESULT */}
        <View style={styles.cardHeader}>
          <Text style={styles.contextText} numberOfLines={1}>{contextLine}</Text>
          {isCompleted ? (
            <Text style={styles.resultTag}>RESULT</Text>
          ) : (
            <View style={styles.liveTag}>
              <LivePulse />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        {/* Teams — tap to open the match (live viewer / scorecard) */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onPress(match)}
          onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.985, friction: 8, useNativeDriver: true }).start()}
          onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start()}
        >
          {[{ name: teamA, score: scoreA, batting: battingTeam === teamA },
            { name: teamB, score: scoreB, batting: battingTeam === teamB }].map((t, i) => (
            <View key={i} style={styles.teamRow}>
              <View style={styles.teamBadge}>
                <Text style={styles.teamBadgeText}>{initialOf(t.name)}</Text>
              </View>
              <Text style={styles.teamName} numberOfLines={1}>{t.name}</Text>
              {t.score ? (
                <View style={styles.scoreBlock}>
                  {!isCompleted && t.batting ? <View style={styles.battingDot} /> : null}
                  <Text style={styles.scoreRuns}>{t.score.runs}/{t.score.wickets}</Text>
                  <Text style={styles.scoreOvers}> ({t.score.overs})</Text>
                </View>
              ) : null}
            </View>
          ))}
        </TouchableOpacity>

        {/* Result line for completed matches (subtle) */}
        {isCompleted && match.result ? (
          <Text style={styles.resultLine} numberOfLines={1}>{match.result}</Text>
        ) : null}

        {/* Footer: tournament name + the single "View Tournament" action */}
        {match.tournament ? (
          <TouchableOpacity style={styles.footer} activeOpacity={0.6} onPress={openTournament}>
            <Text style={styles.footerLabel} numberOfLines={1}>{match.tournamentName || 'Tournament'}</Text>
            <Text style={styles.footerCta}>View Tournament</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.footer} activeOpacity={0.6} onPress={() => onPress(match)}>
            <Text style={styles.footerCta}>{isCompleted ? 'View Scorecard' : 'View Live Match'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

// --- Strip -----------------------------------------------------------------

// Refetch debounce so a flurry of socket events (each ball is one) collapses
// into a single API call within a small window. Kept short so the public score
// updates almost immediately after the scorer marks a ball.
const REFETCH_DEBOUNCE_MS = 250;

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

  // Group matches by tournament so each tournament shows as ONE card (a quick/
  // standalone match with no tournament becomes its own single-match group).
  // Within a group, matches are ordered by match number so the pager steps in
  // fixture order.
  const groups = useMemo(() => {
    const byT = new Map();
    const singles = [];
    for (const m of matches) {
      if (m.tournament) {
        const key = String(m.tournament);
        if (!byT.has(key)) byT.set(key, []);
        byT.get(key).push(m);
      } else {
        singles.push({ key: `single_${m._id}`, tournament: null, tournamentName: m.tournamentName, matches: [m] });
      }
    }
    const tGroups = [...byT.entries()].map(([key, ms]) => {
      const sorted = [...ms].sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
      return {
        key,
        tournament: sorted[0].tournament,
        tournamentName: sorted[0].tournamentName,
        tournamentFormat: sorted[0].tournamentFormat,
        matches: sorted,
      };
    });
    return [...tGroups, ...singles];
  }, [matches]);

  // Hide the entire strip until first load completes — avoids a flicker.
  if (!loaded || groups.length === 0) return null;

  const N = groups.length;
  const loop = N > 1;
  // For an infinite carousel we render three copies and keep the user parked in
  // the middle copy; when they cross into the first/last copy we silently jump
  // back to the equivalent card in the middle. Single group → no looping.
  const data = loop ? [...groups, ...groups, ...groups] : groups;

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
          {matches.length} {matches.length === 1 ? 'match' : 'matches'}
        </Text>
      </View>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(g, i) => `${g.key}_${i}`}
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
          <TournamentLiveCard group={item} index={index % N} cardWidth={CARD_W} onPress={onCardPress} navigation={navigation} />
        )}
      />

      {/* Pagination dots — one per tournament */}
      {loop ? (
        <View style={styles.dotsRow}>
          {groups.map((g, i) => (
            <View key={g.key} style={[styles.dot, i === activeIndex && styles.dotActive]} />
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

  // Card — clean, light, wide & short (no colourful background)
  card: {
    width: CARD_W,
    backgroundColor: '#f4f4f5',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: '#ececee',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  contextText: { flex: 1, color: '#71717a', fontSize: 13, fontWeight: '700', marginRight: 10 },

  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveText: { color: '#dc2626', fontSize: 12.5, fontWeight: '900', letterSpacing: 0.8 },
  resultTag: { color: '#059669', fontSize: 12.5, fontWeight: '900', letterSpacing: 0.6 },

  teamRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  teamBadge: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#18181b',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  teamBadgeText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  teamName: { flex: 1, color: '#18181b', fontSize: 16.5, fontWeight: '800' },
  scoreBlock: { flexDirection: 'row', alignItems: 'center' },
  battingDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#dc2626', marginRight: 6 },
  scoreRuns: { color: '#18181b', fontSize: 15.5, fontWeight: '900', fontVariant: ['tabular-nums'] },
  scoreOvers: { color: '#a1a1aa', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },

  resultLine: { color: '#3f3f46', fontSize: 12.5, fontWeight: '700', marginTop: 8, marginLeft: 2 },

  // Footer — tournament name (small) + the single "View Tournament" action
  footer: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#e4e4e7',
  },
  footerLabel: {
    color: '#a1a1aa', fontSize: 11, fontWeight: '800',
    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4,
  },
  footerCta: { color: '#18181b', fontSize: 15.5, fontWeight: '900' },

  // Pulse
  pulseWrap: { width: 8, height: 8, justifyContent: 'center', alignItems: 'center' },
  pulseRing: {
    position: 'absolute', width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
});

export default LiveMatchesStrip;
