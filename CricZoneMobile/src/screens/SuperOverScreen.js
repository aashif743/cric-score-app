import React, { useState, useContext, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
  Modal, TouchableWithoutFeedback, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import matchService from '../utils/matchService';
import GradientHeader from '../components/GradientHeader';

// Super Over rules used here (standard, simplified):
//  • Each team faces `overs × ballsPerOver` legal balls.
//  • A team is all out after `maxWickets` wickets (default 2).
//  • Wide / No-ball add 1 run and are re-bowled (don't use a ball).
//  • The side batting second wins the instant it passes the first side's score.

const emptyInnings = (team) => ({ team, runs: 0, wickets: 0, balls: 0, log: [] });

const SuperOverScreen = ({ navigation, route }) => {
  const { user } = useContext(AuthContext);
  const {
    matchId,
    battingOrder = [],          // [firstBatTeam, secondBatTeam]
    overs = 1,
    ballsPerOver = 6,
    maxWickets = 2,
    mainMatchData = {},          // the tied match payload to finalise with
    tournamentName,
  } = route.params || {};

  const MAX_WICKETS = Math.max(1, maxWickets);
  const maxBalls = Math.max(1, overs * ballsPerOver);

  // Which of the two teams bats first — editable until the first ball is bowled.
  const [battingFirstIdx, setBattingFirstIdx] = useState(0);
  const firstBat = battingOrder[battingFirstIdx];
  const secondBat = battingOrder[1 - battingFirstIdx];

  // innings[0] = first team's super over, innings[1] = second team's chase.
  const [innings, setInnings] = useState([emptyInnings(firstBat), emptyInnings(secondBat)]);
  const [phase, setPhase] = useState(0);     // 0 = first batting, 1 = chase, 2 = decided
  const [history, setHistory] = useState([]); // for undo
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false); // recording the result as a tie
  const [round, setRound] = useState(1);      // super-over number (re-tie → next round)
  const [extraModal, setExtraModal] = useState(null); // 'Wd' | 'Nb' | null
  const [wicketModal, setWicketModal] = useState(false);
  // Wide/No-ball popup selection (mirrors the main scorer's extras popup).
  const [wideNoBallRuns, setWideNoBallRuns] = useState(null);
  const [wideNoBallRunOut, setWideNoBallRunOut] = useState(false);

  const cur = innings[phase] || innings[1];
  const target = phase === 1 ? innings[0].runs + 1 : null;
  const ballsLeft = Math.max(0, maxBalls - (cur?.balls || 0));
  // Batting order can only be changed before the very first ball.
  const canChooseOrder = phase === 0 && innings[0].balls === 0 && innings[0].log.length === 0 && round === 1;

  const chooseFirst = (idx) => {
    if (!canChooseOrder || idx === battingFirstIdx) return;
    setBattingFirstIdx(idx);
    setInnings([emptyInnings(battingOrder[idx]), emptyInnings(battingOrder[1 - idx])]);
    setHistory([]);
  };

  const snapshot = () => ({ innings: JSON.parse(JSON.stringify(innings)), phase });
  const pushHistory = () => setHistory((h) => [...h.slice(-40), snapshot()]);

  const inningsOver = (inn) => inn.balls >= maxBalls || inn.wickets >= MAX_WICKETS;

  // Apply a scoring event to the current innings, then check for transitions.
  //  run     : { type:'run', runs }                 → runs, uses a ball
  //  wicket  : { type:'wicket' }                     → wicket, uses a ball
  //  runout  : { type:'runout', runs }               → runs completed + wicket, uses a ball
  //  extra   : { type:'extra', label:'Wd'|'Nb', runs}→ 1 + extra runs, re-bowled (no ball used)
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
      } else if (evt.type === 'runout') {
        inn.runs += (evt.runs || 0); inn.wickets += 1; inn.balls += 1;
        inn.log.push(evt.runs ? `${evt.runs}+W` : 'W');
      } else if (evt.type === 'extra') {
        const add = 1 + (evt.runs || 0);
        inn.runs += add;
        if (evt.runOut) inn.wickets += 1; // run out off a wide/no-ball (re-bowled)
        inn.log.push(
          evt.runOut
            ? `${evt.label}${evt.runs ? '+' + evt.runs : ''}+W`
            : (evt.runs ? `${evt.label}+${evt.runs}` : evt.label)
        );
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

  const applyAndClose = (evt) => { applyEvent(evt); setExtraModal(null); setWicketModal(false); };

  // Open the wide/no-ball popup fresh (no run selected, run-out off).
  const openExtra = (label) => { setWideNoBallRuns(null); setWideNoBallRunOut(false); setExtraModal(label); };
  const confirmExtra = () => {
    if (wideNoBallRuns === null) return;
    applyEvent({ type: 'extra', label: extraModal, runs: wideNoBallRuns, runOut: wideNoBallRunOut });
    setExtraModal(null); setWideNoBallRuns(null); setWideNoBallRunOut(false);
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
    setInnings([emptyInnings(firstBat), emptyInnings(secondBat)]);
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
      // Rebuild the stack so the match-ended scorecard sits directly on top of
      // wherever the match was launched from (the tournament schedule / home).
      // This removes the now-finished ScoreCard + this SuperOver + any MatchSetup
      // so the back button returns to the tournament — and the stale scorer can't
      // re-save the match as in-progress and undo the completion.
      navigation.dispatch((state) => {
        const kept = state.routes.filter(
          (r) => !['SuperOver', 'ScoreCard', 'MatchSetup'].includes(r.name),
        );
        kept.push({ name: 'FullScorecard', params: { matchId, matchData: { _id: matchId, ...payload } } });
        return CommonActions.reset({ ...state, routes: kept, index: kept.length - 1 });
      });
    } catch (err) {
      setSaving(false);
      Alert.alert('Could not save', err?.error || 'Please try again.');
    }
  };

  // Cancelling / backing out of the Super Over records the match as a TIE (the
  // main match was level) — never leaves it stuck in-progress. The tie can be
  // broken later by playing the Super Over again from the schedule.
  const finalizeAsTie = async () => {
    if (saving || finalizing) return;
    setFinalizing(true);
    try {
      if (user?.token && matchId && !String(matchId).startsWith('guest_')) {
        await matchService.endMatch(matchId, { ...mainMatchData, status: 'completed' }, user.token);
      }
    } catch (e) { /* best-effort — a retry from the schedule can re-save */ }
    navigation.dispatch((state) => {
      const kept = state.routes.filter((r) => !['SuperOver', 'ScoreCard', 'MatchSetup'].includes(r.name));
      kept.push({ name: 'FullScorecard', params: { matchId, matchData: { _id: matchId, ...mainMatchData } } });
      return CommonActions.reset({ ...state, routes: kept, index: kept.length - 1 });
    });
  };

  const confirmCancel = () => {
    if (saving || finalizing) return true;
    Alert.alert(
      'Cancel Super Over?',
      'The match will be recorded as a TIE. You can play the Super Over again later from the schedule.',
      [
        { text: 'Keep Scoring', style: 'cancel' },
        { text: 'Record as Tie', style: 'destructive', onPress: finalizeAsTie },
      ],
    );
    return true; // block the default back action
  };

  // Android hardware back → same confirm (don't silently drop the match).
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', confirmCancel);
      return () => sub.remove();
    }, [saving, finalizing]),
  );

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
        onBack={confirmCancel}
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

        {/* Batting order — editable until the first ball */}
        {canChooseOrder ? (
          <View style={styles.orderWrap}>
            <Text style={styles.orderLabel}>Who bats first?</Text>
            <View style={styles.orderRow}>
              {battingOrder.map((t, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.orderChip, battingFirstIdx === i && styles.orderChipActive]}
                  onPress={() => chooseFirst(i)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.orderChipText, battingFirstIdx === i && styles.orderChipTextActive]} numberOfLines={1}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

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
              <RunBtn label="Wd" style={styles.btnExtra} textStyle={styles.btnExtraText} onPress={() => openExtra('Wd')} />
              <RunBtn label="Nb" style={styles.btnExtra} textStyle={styles.btnExtraText} onPress={() => openExtra('Nb')} />
            </View>
            <View style={styles.padRow}>
              <RunBtn label="WICKET" style={[styles.btnWide, styles.btnWicket]} textStyle={styles.btnWicketText} onPress={() => setWicketModal(true)} />
              <TouchableOpacity style={[styles.btn, styles.btnWide, styles.btnUndo]} onPress={undo} activeOpacity={0.8} disabled={!history.length || saving}>
                <Text style={[styles.btnText, styles.btnUndoText, !history.length && styles.btnUndoDisabled]}>Undo</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.padHint}>Wd / Nb open a runs option · Wicket has run-out</Text>
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
            {/* Deciding ball wrong? Undo it and keep scoring. */}
            {history.length ? (
              <TouchableOpacity style={styles.undoLink} onPress={undo} activeOpacity={0.7} disabled={saving}>
                <Text style={styles.undoLinkText}>↶  Undo last ball</Text>
              </TouchableOpacity>
            ) : null}
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

      {/* Wide / No-ball — same design, buttons, texts & options as the main
          scorer's extras popup. */}
      <Modal visible={!!extraModal} transparent animationType="fade" onRequestClose={() => setExtraModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.extraBallModal}>
            {/* Header */}
            <View style={[styles.extraBallHeader, extraModal === 'Nb' && styles.noBallHeader]}>
              <View style={styles.extraBallIconContainer}>
                <Text style={styles.extraBallIcon}>{extraModal === 'Wd' ? 'WD' : 'NB'}</Text>
              </View>
              <Text style={styles.extraBallTitle}>{extraModal === 'Wd' ? 'Wide Ball' : 'No Ball'}</Text>
              <Text style={styles.extraBallSubtitle}>Select runs and options</Text>
            </View>

            {/* Content */}
            <ScrollView style={styles.extraBallContent} showsVerticalScrollIndicator={false}>
              <View style={styles.extraBallSection}>
                <Text style={styles.extraBallSectionTitle}>Runs</Text>
                <View style={styles.extraBallGrid}>
                  {(extraModal === 'Wd' ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6]).map((runs) => (
                    <TouchableOpacity
                      key={runs}
                      style={[styles.extraBallOption, wideNoBallRuns === runs && styles.extraBallOptionSelected]}
                      onPress={() => setWideNoBallRuns(runs)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.extraBallOptionText, wideNoBallRuns === runs && styles.extraBallOptionTextSelected]}>
                        {runs === 0 ? (extraModal === 'Wd' ? 'WD' : 'NB') : `+${runs}`}
                      </Text>
                      <Text style={[styles.extraBallOptionSubtext, wideNoBallRuns === runs && styles.extraBallOptionSubtextSelected]}>
                        {runs === 0 ? '1 run' : `${runs + 1} runs`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Run Out (Optional) */}
              <View style={styles.extraBallSection}>
                <Text style={styles.extraBallSectionTitle}>Run Out (Optional)</Text>
                <TouchableOpacity
                  style={[styles.runOutToggleButton, wideNoBallRunOut && styles.runOutToggleButtonSelected]}
                  onPress={() => setWideNoBallRunOut((v) => !v)}
                  activeOpacity={0.8}
                >
                  <View style={styles.runOutToggleLeft}>
                    <Text style={styles.runOutToggleIcon}>{wideNoBallRunOut ? '✓' : '○'}</Text>
                    <Text style={[styles.runOutToggleLabel, wideNoBallRunOut && styles.runOutToggleLabelSelected]}>Batsman Run Out</Text>
                  </View>
                  <Text style={styles.runOutToggleHint}>{wideNoBallRunOut ? 'Selected' : 'Tap to select'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.extraBallActions}>
              <TouchableOpacity style={styles.extraBallCancelButton} onPress={() => setExtraModal(null)} activeOpacity={0.8}>
                <Text style={styles.extraBallCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.extraBallConfirmButton, wideNoBallRuns === null && styles.extraBallConfirmDisabled]}
                onPress={confirmExtra}
                disabled={wideNoBallRuns === null}
                activeOpacity={0.85}
              >
                <Text style={styles.extraBallConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Wicket: plain out, or a run-out with the runs completed */}
      <Modal visible={wicketModal} transparent animationType="fade" onRequestClose={() => setWicketModal(false)}>
        <TouchableWithoutFeedback onPress={() => setWicketModal(false)}>
          <View style={styles.mOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.mCard}>
                <Text style={styles.mTitle}>Wicket</Text>
                <TouchableOpacity style={styles.mOutBtn} onPress={() => applyAndClose({ type: 'wicket' })} activeOpacity={0.85}>
                  <Text style={styles.mOutText}>Out (0 runs)</Text>
                </TouchableOpacity>
                <Text style={styles.mHint}>Run out — runs completed before the wicket:</Text>
                <View style={styles.mGrid}>
                  {[0, 1, 2, 3].map((r) => (
                    <TouchableOpacity key={r} style={styles.mBtn} onPress={() => applyAndClose({ type: 'runout', runs: r })} activeOpacity={0.8}>
                      <Text style={styles.mBtnText}>{r}</Text>
                      <Text style={styles.mBtnSub}>run out</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={styles.mCancel} onPress={() => setWicketModal(false)} activeOpacity={0.7}><Text style={styles.mCancelText}>Cancel</Text></TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  body: { padding: 16, paddingBottom: 40 },

  roundChip: { alignSelf: 'center', backgroundColor: '#fef3c7', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 12 },
  roundChipText: { fontSize: 12, fontWeight: '900', color: '#b45309', letterSpacing: 0.5 },

  // Batting-order selector
  orderWrap: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: '#eef2f7',
  },
  orderLabel: { fontSize: 12, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, textAlign: 'center' },
  orderRow: { flexDirection: 'row', gap: 10 },
  orderChip: {
    flex: 1, height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  orderChipActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  orderChipText: { fontSize: 14, fontWeight: '800', color: '#64748b' },
  orderChipTextActive: { color: '#1d4ed8' },

  padHint: { textAlign: 'center', fontSize: 11.5, color: '#94a3b8', marginTop: 4, fontWeight: '600' },

  // Extra / wicket modals
  mOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 26 },
  mCard: {
    width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 22, padding: 20,
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 28, elevation: 14,
  },
  mTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', textAlign: 'center', marginBottom: 4 },
  mHint: { fontSize: 12.5, fontWeight: '600', color: '#64748b', textAlign: 'center', marginTop: 6, marginBottom: 12 },
  mGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  mBtn: {
    width: 96, height: 60, borderRadius: 14, backgroundColor: '#f8fafc',
    borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center',
  },
  mBtnText: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
  mBtnSub: { fontSize: 10, fontWeight: '700', color: '#94a3b8', marginTop: 1 },
  mOutBtn: { height: 50, borderRadius: 14, backgroundColor: '#fef2f2', borderWidth: 1.5, borderColor: '#fecaca', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  mOutText: { fontSize: 15, fontWeight: '900', color: '#dc2626', letterSpacing: 0.3 },
  mCancel: { height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  mCancelText: { fontSize: 15, fontWeight: '800', color: '#64748b' },

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
  undoLink: { height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  undoLinkText: { fontSize: 14, fontWeight: '800', color: '#64748b' },

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

  // Wide / No-ball popup — matches the main scorer's extras modal design.
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  extraBallModal: { backgroundColor: '#fff', borderRadius: 22, overflow: 'hidden', width: '100%', maxWidth: 400, maxHeight: '90%' },
  extraBallHeader: { backgroundColor: '#fbbf24', padding: 20, alignItems: 'center' },
  noBallHeader: { backgroundColor: '#ef4444' },
  extraBallIconContainer: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  extraBallIcon: { fontSize: 20, fontWeight: '800', color: '#fff' },
  extraBallTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  extraBallSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  extraBallContent: { padding: 20, flexShrink: 1 },
  extraBallSection: { marginBottom: 20 },
  extraBallSectionTitle: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  extraBallGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  extraBallOption: { backgroundColor: '#f8fafc', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, minWidth: 60, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  extraBallOptionSelected: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  extraBallOptionText: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  extraBallOptionTextSelected: { color: '#2563eb' },
  extraBallOptionSubtext: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  extraBallOptionSubtextSelected: { color: '#2563eb' },
  runOutToggleButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 14, padding: 12, borderWidth: 2, borderColor: 'transparent' },
  runOutToggleButtonSelected: { backgroundColor: '#fef2f2', borderColor: '#dc2626' },
  runOutToggleLeft: { flexDirection: 'row', alignItems: 'center' },
  runOutToggleIcon: { fontSize: 18, marginRight: 8, color: '#94a3b8' },
  runOutToggleLabel: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  runOutToggleLabelSelected: { color: '#dc2626' },
  runOutToggleHint: { fontSize: 12, color: '#94a3b8' },
  extraBallActions: { flexDirection: 'row', gap: 8, padding: 20, paddingTop: 0 },
  extraBallCancelButton: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 14, padding: 12, alignItems: 'center' },
  extraBallCancelText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  extraBallConfirmButton: { flex: 1, backgroundColor: '#2563eb', borderRadius: 14, padding: 12, alignItems: 'center', shadowColor: '#1e40af', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  extraBallConfirmDisabled: { backgroundColor: '#94a3b8' },
  extraBallConfirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

export default SuperOverScreen;
