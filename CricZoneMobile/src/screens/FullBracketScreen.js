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

// --- Layout constants ------------------------------------------------------
const CARD_W = 166;
const MATCH_H = 66;
const GUTTER = 46;          // horizontal gap between rounds (connector space)
const COL_W = CARD_W + GUTTER;
const PITCH = MATCH_H + 26; // round-1 vertical spacing
const PAD = 20;
const LINE = '#cbd5e1';

const roundLabel = (round, numRounds) => {
  if (round === numRounds) return 'Final';
  if (round === numRounds - 1) return 'Semifinal';
  if (round === numRounds - 2) return 'Quarterfinal';
  return `Round ${round}`;
};

const winnerName = (m) => {
  if (m.status !== 'completed') return null;
  return m.matchSummary?.winner || null;
};

// --- Match node ------------------------------------------------------------
const TeamLine = ({ name, seed, isWinner }) => {
  const tbd = !name || name === 'TBD';
  return (
    <View style={styles.teamLine}>
      <View style={[styles.seedBadge, tbd && styles.seedBadgeTBD, isWinner && styles.seedBadgeWin]}>
        <Text style={styles.seedBadgeText}>{seed ?? '–'}</Text>
      </View>
      <Text style={[styles.teamName, isWinner && styles.teamNameWin, tbd && styles.teamNameTBD]} numberOfLines={1}>
        {name || 'TBD'}
      </Text>
    </View>
  );
};

const MatchNode = ({ match, x, y, seedOf }) => {
  const win = winnerName(match);
  const isLive = match.status === 'in_progress' || match.status === 'innings_break';
  const accent = match.status === 'completed' ? '#10b981' : isLive ? '#dc2626' : '#cbd5e1';
  return (
    <View style={[styles.node, { left: x, top: y, width: CARD_W, height: MATCH_H }]}>
      <View style={[styles.nodeAccent, { backgroundColor: accent }]} />
      <View style={styles.nodeBody}>
        <TeamLine name={match.teamA?.name} seed={seedOf(match.teamA?.name)} isWinner={win && win === match.teamA?.name} />
        <View style={styles.nodeDivider} />
        <TeamLine name={match.teamB?.name} seed={seedOf(match.teamB?.name)} isWinner={win && win === match.teamB?.name} />
      </View>
      {isLive ? <View style={styles.liveDotWrap}><View style={styles.liveDot} /></View> : null}
    </View>
  );
};

// --- Screen ----------------------------------------------------------------
const FullBracketScreen = ({ navigation, route }) => {
  const { user } = useContext(AuthContext);
  const { tournamentId, tournamentName } = route.params || {};

  const [matches, setMatches] = useState([]);
  const [teamNames, setTeamNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!user?.token || !tournamentId) return;
    try {
      setError('');
      const res = await tournamentService.getTournament(tournamentId, user.token);
      const data = res?.data || res;
      // Knockout-stage matches only (a league tournament's bracket is its KO stage).
      const ms = (data?.matches || []).filter((m) => m.round != null);
      setMatches(ms);
      setTeamNames(data?.teamNames || []);
    } catch (err) {
      console.warn('Full bracket fetch error:', err);
      setError('Failed to load bracket.');
    } finally {
      setLoading(false);
    }
  }, [user?.token, tournamentId]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const numRounds = matches.length ? Math.max(...matches.map((m) => m.round || 1)) : 0;
  const slots = numRounds ? 2 ** numRounds : 0;
  const seedOf = (name) => {
    const i = teamNames.indexOf(name);
    return i >= 0 ? i + 1 : null;
  };

  // Position of a match's vertical centre — standard bracket geometry, so byes
  // (missing round-1 slots) leave a natural gap and parents sit between children.
  const centreY = (round, slot) => PAD + PITCH * (2 ** (round - 1)) * ((slot - 1) + 0.5);
  const colX = (round) => PAD + (round - 1) * COL_W;

  const totalW = PAD * 2 + numRounds * COL_W - GUTTER;
  const totalH = PAD * 2 + PITCH * (slots / 2);

  // Pre-compute connectors (child → parent elbows).
  const connectors = [];
  matches.forEach((m) => {
    if (m.round >= numRounds) return;
    const cy = centreY(m.round, m.bracketSlot);
    const parentSlot = Math.floor((m.bracketSlot - 1) / 2) + 1;
    const py = centreY(m.round + 1, parentSlot);
    const startX = colX(m.round) + CARD_W;
    const midX = startX + GUTTER / 2;
    const parentX = colX(m.round + 1);
    connectors.push({ key: `h1_${m.round}_${m.bracketSlot}`, left: startX, top: cy - 1, width: GUTTER / 2, height: 2 });
    connectors.push({ key: `v_${m.round}_${m.bracketSlot}`, left: midX - 1, top: Math.min(cy, py), width: 2, height: Math.abs(py - cy) || 2 });
    connectors.push({ key: `h2_${m.round}_${m.bracketSlot}`, left: midX, top: py - 1, width: parentX - midX, height: 2 });
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <GradientHeader
        title="Full Bracket"
        subtitle={tournamentName || 'Knockout'}
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.muted}>Loading bracket…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>No bracket yet.</Text>
        </View>
      ) : (
        <>
          <View style={styles.hintBar}>
            <Text style={styles.hintText}>Pinch to zoom • drag to pan</Text>
          </View>
          {/* iOS supports pinch-zoom on ScrollView; explicit content size enables
              two-axis panning so the whole bracket is reachable. */}
          <ScrollView
            style={styles.canvas}
            contentContainerStyle={{ width: Math.max(totalW, 1), height: Math.max(totalH, 1) }}
            maximumZoomScale={3}
            minimumZoomScale={0.5}
            bouncesZoom
            directionalLockEnabled={false}
            showsHorizontalScrollIndicator
            showsVerticalScrollIndicator
          >
            <View style={{ width: totalW, height: totalH }}>
              {/* Round headings */}
              {Array.from({ length: numRounds }, (_, i) => i + 1).map((r) => (
                <Text key={`rh_${r}`} style={[styles.roundHead, { left: colX(r), top: 2, width: CARD_W }]} numberOfLines={1}>
                  {roundLabel(r, numRounds)}
                </Text>
              ))}
              {/* Connectors (behind the nodes) */}
              {connectors.map((c) => (
                <View key={c.key} style={[styles.connector, { left: c.left, top: c.top, width: c.width, height: c.height }]} />
              ))}
              {/* Match nodes */}
              {matches.map((m) => (
                <MatchNode
                  key={`${m.round}_${m.bracketSlot}`}
                  match={m}
                  seedOf={seedOf}
                  x={colX(m.round)}
                  y={centreY(m.round, m.bracketSlot) - MATCH_H / 2}
                />
              ))}
            </View>
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted: { marginTop: 12, fontSize: 15, color: '#94a3b8' },
  errorText: { fontSize: 15, color: '#ef4444', marginBottom: 16 },
  retryButton: { backgroundColor: '#2563eb', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  retryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  hintBar: { alignItems: 'center', paddingVertical: 8, backgroundColor: '#eef2f7' },
  hintText: { fontSize: 12, fontWeight: '600', color: '#64748b', letterSpacing: 0.3 },

  canvas: { flex: 1, backgroundColor: '#f1f5f9' },

  roundHead: {
    position: 'absolute', textAlign: 'center',
    fontSize: 11, fontWeight: '800', color: '#94a3b8',
    letterSpacing: 0.4, textTransform: 'uppercase',
  },

  connector: { position: 'absolute', backgroundColor: LINE },

  node: {
    position: 'absolute',
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  nodeAccent: { width: 4, height: '100%' },
  nodeBody: { flex: 1, justifyContent: 'center', paddingHorizontal: 8 },
  nodeDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 4 },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  seedBadge: {
    width: 20, height: 20, borderRadius: 6,
    backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center',
  },
  seedBadgeTBD: { backgroundColor: '#cbd5e1' },
  seedBadgeWin: { backgroundColor: '#059669' },
  seedBadgeText: { fontSize: 10.5, fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'] },
  teamName: { flex: 1, fontSize: 12.5, fontWeight: '700', color: '#334155' },
  teamNameWin: { fontWeight: '800', color: '#047857' },
  teamNameTBD: { color: '#94a3b8', fontWeight: '500' },
  liveDotWrap: { position: 'absolute', top: 5, right: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#dc2626' },
});

export default FullBracketScreen;
