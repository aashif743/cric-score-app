import React, { useState, useContext, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import matchService from '../utils/matchService';
import GradientHeader from '../components/GradientHeader';

// Super Over rules used here (standard, simplified):
//  • Each team faces `overs × ballsPerOver` legal balls.
//  • A team is all out after 2 wickets.
//  • Wide / No-ball add 1 run and are re-bowled (don't use a ball).
//  • The side batting second wins the instant it passes the first side's score.
const MAX_WICKETS = 2;

const emptyInnings = (team) => ({ team, runs: 0, wickets: 0, balls: 0, log: [] });

const SuperOverScreen = ({ navigation, route }) => {
  const { user } = useContext(AuthContext);
  const {
    matchId,
    battingOrder = [],          // [firstBatTeam, secondBatTeam]
    overs = 1,
    ballsPerOver = 6,
    mainMatchData = {},          // the tied match payload to finalise with
    tournamentName,
  } = route.params || {};

  const maxBalls = Math.max(1, overs * ballsPerOver);
  const [first, second] = battingOrder;

  // innings[0] = first team's super over, innings[1] = second team's chase.
  const [innings, setInnings] = useState([emptyInnings(first), emptyInnings(second)]);
  const [phase, setPhase] = useState(0);     // 0 = first batting, 1 = chase, 2 = decided
  const [history, setHistory] = useState([]); // for undo
  const [saving, setSaving] = useState(false);
  const [round, setRound] = useState(1);      // super-over number (re-tie → next round)

  const cur = innings[phase] || innings[1];
  const target = phase === 1 ? innings[0].runs + 1 : null;
  const ballsLeft = Math.max(0, maxBalls - (cur?.balls || 0));

  const snapshot = () => ({ innings: JSON.parse(JSON.stringify(innings)), phase });
  const pushHistory = () => setHistory((h) => [...h.slice(-40), snapshot()]);

  const inningsOver = (inn) => inn.balls >= maxBalls || inn.wickets >= MAX_WICKETS;

  // Apply a scoring event to the current innings, then check for transitions.
  const applyEvent = (evt) => {
    if (phase === 2 || saving) return;
    pushHistory();
    setInnings((prev) => {
      const next = prev.map((x) => ({ ...x, log: [...x.log] }));
      const inn = next[phase];
      if (evt.type === 'run') {
        inn.runs += evt.runs; inn.balls += 1; inn.log.push(String(evt.runs));
      } else if (evt.type === 'wicket') {
        inn.wickets += 1; inn.balls += 1; inn.log.push('W');
      } else if (evt.type === 'extra') {
        inn.runs += 1; inn.log.push(evt.label); // wide / no-ball: +1, no ball used
      }

      // Decide transitions off the freshly-updated innings.
      if (phase === 0) {
        if (inningsOver(inn)) setTimeout(() => setPhase(1), 0);
      } else {
        const tgt = next[0].runs + 1;
        if (inn.runs >= tgt || inningsOver(inn)) setTimeout(() => setPhase(2), 0);
      }
      return next;
    });
  };

  const undo = () => {
    if (!history.length || saving) return;
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setInnings(last.innings);
    setPhase(last.phase);
  };

  const result = useMemo(() => {
    if (phase !== 2) return null;
    const a = innings[0], b = innings[1];
    if (b.runs > a.runs) return { winner: b.team, tie: false };
    if (a.runs > b.runs) return { winner: a.team, tie: false };
    return { winner: null, tie: true };
  }, [phase, innings]);

  const playAnother = () => {
    setInnings([emptyInnings(first), emptyInnings(second)]);
    setPhase(0);
    setHistory([]);
    setRound((r) => r + 1);
  };

  const finish = async () => {
    if (!result || result.tie || saving) return;
    setSaving(true);
    const superOver = {
      overs, ballsPerOver, round,
      innings: innings.map((i) => ({ team: i.team, runs: i.runs, wickets: i.wickets, balls: i.balls })),
      winner: result.winner,
    };
    const margin = `Super Over (${innings[0].runs}-${innings[1].runs})`;
    const payload = {
      ...mainMatchData,
      status: 'completed',
      result: `${result.winner} won the Super Over`,
      matchSummary: {
        ...(mainMatchData.matchSummary || {}),
        winner: result.winner,
        margin,
      },
      superOver,
    };
    try {
      if (user?.token && matchId && !String(matchId).startsWith('guest_')) {
        await matchService.endMatch(matchId, payload, user.token);
      }
      navigation.replace('FullScorecard', { matchId, matchData: { _id: matchId, ...payload } });
    } catch (err) {
      setSaving(false);
      Alert.alert('Could not save', err?.error || 'Please try again.');
    }
  };

  const RunBtn = ({ label, onPress, style, textStyle }) => (
    <TouchableOpacity style={[styles.btn, style]} onPress={onPress} activeOpacity={0.8} disabled={phase === 2 || saving}>
      <Text style={[styles.btnText, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );

  const battingTeam = cur?.team;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <GradientHeader
        title="Super Over"
        subtitle={tournamentName || 'Tie-breaker'}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Round chip when replaying after a tied super over */}
        {round > 1 ? (
          <View style={styles.roundChip}><Text style={styles.roundChipText}>Super Over #{round}</Text></View>
        ) : null}

        {/* Score cards for both innings */}
        <View style={styles.scoreRow}>
          {innings.map((inn, i) => {
            const active = i === phase;
            return (
              <View key={i} style={[styles.scoreCard, active && styles.scoreCardActive]}>
                <Text style={[styles.scoreTeam, active && styles.scoreTeamActive]} numberOfLines={1}>{inn.team}</Text>
                <Text style={styles.scoreValue}>{inn.runs}/{inn.wickets}</Text>
                <Text style={styles.scoreBalls}>{inn.balls}/{maxBalls} balls</Text>
              </View>
            );
          })}
        </View>

        {/* Situation banner */}
        {phase === 2 ? (
          result?.tie ? (
            <View style={[styles.banner, styles.bannerTie]}>
              <Text style={styles.bannerTitle}>Super Over Tied!</Text>
              <Text style={styles.bannerText}>Both scored {innings[0].runs}. Play another super over to decide.</Text>
            </View>
          ) : (
            <View style={[styles.banner, styles.bannerWin]}>
              <Text style={styles.bannerTrophy}>🏆</Text>
              <Text style={styles.bannerWinName} numberOfLines={1}>{result?.winner}</Text>
              <Text style={styles.bannerText}>won the Super Over</Text>
            </View>
          )
        ) : (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle} numberOfLines={1}>{battingTeam} batting</Text>
            {phase === 1 ? (
              <Text style={styles.bannerText}>
                Need {Math.max(0, target - cur.runs)} from {ballsLeft} {ballsLeft === 1 ? 'ball' : 'balls'} · {MAX_WICKETS - cur.wickets} wkts left
              </Text>
            ) : (
              <Text style={styles.bannerText}>{ballsLeft} {ballsLeft === 1 ? 'ball' : 'balls'} · max {MAX_WICKETS} wickets</Text>
            )}
          </View>
        )}

        {/* Scoring pad */}
        {phase !== 2 ? (
          <View style={styles.pad}>
            <View style={styles.padRow}>
              {[0, 1, 2, 3].map((r) => (
                <RunBtn key={r} label={String(r)} onPress={() => applyEvent({ type: 'run', runs: r })} />
              ))}
            </View>
            <View style={styles.padRow}>
              <RunBtn label="4" style={styles.btnBoundary} textStyle={styles.btnBoundaryText} onPress={() => applyEvent({ type: 'run', runs: 4 })} />
              <RunBtn label="6" style={styles.btnBoundary} textStyle={styles.btnBoundaryText} onPress={() => applyEvent({ type: 'run', runs: 6 })} />
              <RunBtn label="Wd" style={styles.btnExtra} textStyle={styles.btnExtraText} onPress={() => applyEvent({ type: 'extra', label: 'Wd' })} />
              <RunBtn label="Nb" style={styles.btnExtra} textStyle={styles.btnExtraText} onPress={() => applyEvent({ type: 'extra', label: 'Nb' })} />
            </View>
            <View style={styles.padRow}>
              <RunBtn label="WICKET" style={[styles.btnWide, styles.btnWicket]} textStyle={styles.btnWicketText} onPress={() => applyEvent({ type: 'wicket' })} />
              <TouchableOpacity style={[styles.btn, styles.btnWide, styles.btnUndo]} onPress={undo} activeOpacity={0.8} disabled={!history.length || saving}>
                <Text style={[styles.btnText, styles.btnUndoText, !history.length && styles.btnUndoDisabled]}>Undo</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.finishArea}>
            {result?.tie ? (
              <TouchableOpacity style={styles.anotherBtn} onPress={playAnother} activeOpacity={0.85}>
                <Text style={styles.anotherBtnText}>Play Another Super Over</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.finishBtn} onPress={finish} activeOpacity={0.85} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.finishBtnText}>Finish &amp; Save Result</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Ball-by-ball log for the current innings */}
        {cur?.log?.length ? (
          <View style={styles.logWrap}>
            <Text style={styles.logTitle}>{cur.team} · this over</Text>
            <View style={styles.logRow}>
              {cur.log.map((b, i) => (
                <View key={i} style={[styles.logBall, b === 'W' && styles.logBallW, (b === '4' || b === '6') && styles.logBallBoundary]}>
                  <Text style={[styles.logBallText, b === 'W' && styles.logBallTextW]}>{b}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  body: { padding: 16, paddingBottom: 40 },

  roundChip: { alignSelf: 'center', backgroundColor: '#fef3c7', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 12 },
  roundChipText: { fontSize: 12, fontWeight: '900', color: '#b45309', letterSpacing: 0.5 },

  scoreRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  scoreCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#eef2f7',
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  scoreCardActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  scoreTeam: { fontSize: 13, fontWeight: '800', color: '#64748b', marginBottom: 6 },
  scoreTeamActive: { color: '#1d4ed8' },
  scoreValue: { fontSize: 30, fontWeight: '900', color: '#0f172a', fontVariant: ['tabular-nums'] },
  scoreBalls: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 2 },

  banner: {
    backgroundColor: '#0f172a', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 16,
  },
  bannerTie: { backgroundColor: '#7c2d12' },
  bannerWin: { backgroundColor: '#065f46' },
  bannerTitle: { fontSize: 16, fontWeight: '900', color: '#fff' },
  bannerText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 4, textAlign: 'center' },
  bannerTrophy: { fontSize: 30 },
  bannerWinName: { fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 4 },

  pad: { gap: 12 },
  padRow: { flexDirection: 'row', gap: 12 },
  btn: {
    flex: 1, height: 60, borderRadius: 14, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center',
  },
  btnText: { fontSize: 22, fontWeight: '900', color: '#1e293b' },
  btnBoundary: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  btnBoundaryText: { color: '#1d4ed8' },
  btnExtra: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  btnExtraText: { color: '#b45309', fontSize: 18 },
  btnWide: { flex: 1 },
  btnWicket: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  btnWicketText: { color: '#dc2626', fontSize: 16, letterSpacing: 1 },
  btnUndo: { backgroundColor: '#f8fafc' },
  btnUndoText: { color: '#475569', fontSize: 16 },
  btnUndoDisabled: { color: '#cbd5e1' },

  finishArea: { marginTop: 4 },
  finishBtn: {
    height: 56, borderRadius: 16, backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#047857', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  finishBtnText: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
  anotherBtn: {
    height: 56, borderRadius: 16, backgroundColor: '#ea580c', justifyContent: 'center', alignItems: 'center',
  },
  anotherBtnText: { fontSize: 16, fontWeight: '900', color: '#fff' },

  logWrap: { marginTop: 20 },
  logTitle: { fontSize: 12, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  logRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  logBall: {
    minWidth: 34, height: 34, borderRadius: 17, paddingHorizontal: 8,
    backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center',
  },
  logBallW: { backgroundColor: '#fee2e2' },
  logBallBoundary: { backgroundColor: '#dbeafe' },
  logBallText: { fontSize: 13, fontWeight: '800', color: '#334155' },
  logBallTextW: { color: '#dc2626' },
});

export default SuperOverScreen;
