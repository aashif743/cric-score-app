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
const CARD_W = 168;
const MATCH_H = 66;
const GUTTER = 48;          // horizontal gap between rounds (connector space)
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
  if (!m || m.status !== 'completed') return null;
  return m.matchSummary?.winner || null;
};

// Rebuild the full sequential bracket (games + byes) from the team list — mirrors
// the backend generator, so teams read 1..N top-to-bottom and every bye is shown.
const buildBracket = (teamNames) => {
  const N = teamNames.length;
  if (N < 2) return null;
  const numRounds = Math.ceil(Math.log2(N));
  const slots = 2 ** numRounds;
  const half = slots / 2;
  const games = N - half;

  const round1 = [];
  for (let j = 1; j <= half; j++) {
    if (j <= games) {
      round1.push({ slot: j, isBye: false, a: teamNames[2 * j - 2], b: teamNames[2 * j - 1] });
    } else {
      const team = teamNames[games + j - 1];
      const side = (j - games) % 2 === 1 ? 'A' : 'B';
      round1.push({ slot: j, isBye: true, team, side });
    }
  }

  // Number the real games (byes excluded), round by round, top to bottom.
  const gameNo = {};
  let g = 0;
  for (let r = 1; r <= numRounds; r++) {
    const count = r === 1 ? games : slots / 2 ** r;
    for (let s = 1; s <= count; s++) { g += 1; gameNo[`${r}_${s}`] = g; }
  }

  return { N, numRounds, slots, half, games, round1, gameNo };
};

// --- Small pieces ----------------------------------------------------------
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

const ByeLine = () => (
  <View style={styles.teamLine}>
    <View style={[styles.seedBadge, styles.seedBadgeBye]}><Text style={styles.byeBadgeText}>–</Text></View>
    <Text style={styles.byeText}>BYE</Text>
  </View>
);

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

const ByeNode = ({ team, side, x, y, seedOf }) => (
  <View style={[styles.node, { left: x, top: y, width: CARD_W, height: MATCH_H }]}>
    <View style={[styles.nodeAccent, { backgroundColor: '#93c5fd' }]} />
    <View style={styles.nodeBody}>
      {side === 'A' ? <TeamLine name={team} seed={seedOf(team)} /> : <ByeLine />}
      <View style={styles.nodeDivider} />
      {side === 'A' ? <ByeLine /> : <TeamLine name={team} seed={seedOf(team)} />}
    </View>
  </View>
);

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
      const ms = (data?.matches || []).filter((m) => m.round != null && m.stage !== 'group');
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

  const bracket = buildBracket(teamNames);
  const numRounds = bracket?.numRounds || 0;
  const slots = bracket?.slots || 0;

  const seedOf = (name) => {
    const i = teamNames.indexOf(name);
    return i >= 0 ? i + 1 : null;
  };
  const matchAt = (round, slot) => matches.find((m) => m.round === round && m.bracketSlot === slot);

  // Standard bracket geometry: parents sit centred between their two children.
  const centreY = (round, slot) => PAD + 24 + PITCH * (2 ** (round - 1)) * ((slot - 1) + 0.5);
  const colX = (round) => PAD + (round - 1) * COL_W;

  const finalMatch = numRounds ? matchAt(numRounds, 1) : null;
  const champion = winnerName(finalMatch);
  const championX = colX(numRounds) + COL_W;

  const totalW = PAD * 2 + numRounds * COL_W - GUTTER + (numRounds ? COL_W : 0);
  const totalH = PAD * 2 + 24 + PITCH * (slots / 2);

  // Connectors: every round-1 slot (game OR bye) → its round-2 parent, and every
  // slot in later rounds → its parent, then the final → the Champion box.
  const connectors = [];
  if (bracket) {
    for (let r = 1; r < numRounds; r += 1) {
      const count = r === 1 ? bracket.half : slots / 2 ** r;
      for (let s = 1; s <= count; s += 1) {
        const cy = centreY(r, s);
        const parentSlot = Math.floor((s - 1) / 2) + 1;
        const py = centreY(r + 1, parentSlot);
        const startX = colX(r) + CARD_W;
        const midX = startX + GUTTER / 2;
        const parentX = colX(r + 1);
        connectors.push({ key: `h1_${r}_${s}`, left: startX, top: cy - 1, width: GUTTER / 2, height: 2 });
        connectors.push({ key: `v_${r}_${s}`, left: midX - 1, top: Math.min(cy, py), width: 2, height: Math.abs(py - cy) || 2 });
        connectors.push({ key: `h2_${r}_${s}`, left: midX, top: py - 1, width: parentX - midX, height: 2 });
      }
    }
    // Final → Champion
    const fy = centreY(numRounds, 1);
    connectors.push({ key: 'champ_h', left: colX(numRounds) + CARD_W, top: fy - 1, width: GUTTER, height: 2 });
  }

  // Game-number labels ("G1"…) sit in the gutter to the RIGHT of each game — near
  // the connector, like the paper sample — so they never cover the seed numbers.
  const gameBadges = [];
  if (bracket) {
    for (let r = 1; r <= numRounds; r += 1) {
      const count = r === 1 ? bracket.games : slots / 2 ** r;
      for (let s = 1; s <= count; s += 1) {
        gameBadges.push({ key: `g_${r}_${s}`, n: bracket.gameNo[`${r}_${s}`], left: colX(r) + CARD_W + 5, top: centreY(r, s) - 9 });
      }
    }
  }

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
      ) : !bracket || matches.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>No bracket yet.</Text>
        </View>
      ) : (
        <>
          <View style={styles.hintBar}>
            <Text style={styles.hintText}>Pinch to zoom • drag to pan</Text>
          </View>
          <ScrollView
            style={styles.canvas}
            contentContainerStyle={{ width: Math.max(totalW, 1), height: Math.max(totalH, 1) }}
            maximumZoomScale={3}
            minimumZoomScale={0.4}
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
              <Text style={[styles.roundHead, styles.champHead, { left: championX, top: 2, width: CARD_W }]} numberOfLines={1}>
                Champion
              </Text>

              {/* Connectors (behind the nodes) */}
              {connectors.map((c) => (
                <View key={c.key} style={[styles.connector, { left: c.left, top: c.top, width: c.width, height: c.height }]} />
              ))}

              {/* Round 1 — real games and BYE boxes, teams in order */}
              {bracket.round1.map((r1) => {
                const y = centreY(1, r1.slot) - MATCH_H / 2;
                if (r1.isBye) {
                  return <ByeNode key={`bye_${r1.slot}`} team={r1.team} side={r1.side} seedOf={seedOf} x={colX(1)} y={y} />;
                }
                const m = matchAt(1, r1.slot) || { teamA: { name: r1.a }, teamB: { name: r1.b } };
                return (
                  <MatchNode key={`m1_${r1.slot}`} match={m} seedOf={seedOf} gameNo={bracket.gameNo[`1_${r1.slot}`]} x={colX(1)} y={y} />
                );
              })}

              {/* Rounds 2..final — actual matches */}
              {Array.from({ length: Math.max(0, numRounds - 1) }, (_, i) => i + 2).map((r) => {
                const count = slots / 2 ** r;
                return Array.from({ length: count }, (_, i) => i + 1).map((s) => {
                  const m = matchAt(r, s) || { teamA: { name: 'TBD' }, teamB: { name: 'TBD' } };
                  return (
                    <MatchNode key={`m_${r}_${s}`} match={m} seedOf={seedOf} gameNo={bracket.gameNo[`${r}_${s}`]} x={colX(r)} y={centreY(r, s) - MATCH_H / 2} />
                  );
                });
              })}

              {/* Champion box */}
              <View style={[styles.champNode, { left: championX, top: centreY(numRounds, 1) - MATCH_H / 2 }]}>
                <Text style={styles.champTrophy}>🏆</Text>
                <Text style={[styles.champName, !champion && styles.champNameTBD]} numberOfLines={1}>
                  {champion || 'TBD'}
                </Text>
              </View>

              {/* Game-number labels (on top, in the gutter) */}
              {gameBadges.map((b) => (
                <View key={b.key} style={[styles.gameLabel, { left: b.left, top: b.top }]}>
                  <Text style={styles.gameLabelText}>G{b.n}</Text>
                </View>
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
  champHead: { color: '#d97706' },

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
  seedBadgeBye: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  seedBadgeText: { fontSize: 10.5, fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'] },
  byeBadgeText: { fontSize: 10.5, fontWeight: '800', color: '#93c5fd' },
  teamName: { flex: 1, fontSize: 12.5, fontWeight: '700', color: '#334155' },
  teamNameWin: { fontWeight: '800', color: '#047857' },
  teamNameTBD: { color: '#94a3b8', fontWeight: '500' },
  byeText: { flex: 1, fontSize: 11.5, fontWeight: '800', color: '#93c5fd', letterSpacing: 1 },

  gameLabel: {
    position: 'absolute',
    backgroundColor: '#eef2ff', borderRadius: 5,
    paddingHorizontal: 5, paddingVertical: 1,
    borderWidth: 1, borderColor: '#c7d2fe',
  },
  gameLabelText: { fontSize: 9, fontWeight: '900', color: '#4f46e5', letterSpacing: 0.2 },

  liveDotWrap: { position: 'absolute', top: 5, right: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#dc2626' },

  champNode: {
    position: 'absolute', width: CARD_W, height: MATCH_H,
    backgroundColor: '#fffbeb', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#fbbf24',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 8,
    shadowColor: '#d97706', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  champTrophy: { fontSize: 20 },
  champName: { flex: 1, fontSize: 14, fontWeight: '900', color: '#b45309' },
  champNameTBD: { color: '#d6b06b', fontWeight: '600' },
});

export default FullBracketScreen;
