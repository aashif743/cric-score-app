import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
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
import io from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import matchService from '../utils/matchService';
import { SOCKET_URL } from '../api/config';
import GradientHeader from '../components/GradientHeader';

// --- Helpers ---------------------------------------------------------------

const initialOf = (s) => (s || '?').trim().charAt(0).toUpperCase();

// "Azmatullah Omarzai" -> "A. Omarzai". Single-word names pass through.
const abbrevName = (name) => {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0].charAt(0)}. ${parts[parts.length - 1]}`;
};

const isCompleted = (status) => status === 'completed' || status === 'abandoned';

// "19.3" with 6 balls/over -> 117 legal balls.
const oversToBalls = (overs, bpo = 6) => {
  const [o, b] = String(overs ?? '0.0').split('.').map((n) => parseInt(n, 10) || 0);
  return o * bpo + b;
};

const crrOf = (runs, overs, bpo = 6) => {
  const balls = oversToBalls(overs, bpo);
  if (!balls) return null;
  return ((runs ?? 0) * bpo) / balls;
};

const srOf = (runs, balls) => (balls ? ((runs / balls) * 100).toFixed(1) : '—');

const econOf = (runs, overs, bpo = 6) => {
  const balls = oversToBalls(overs, bpo);
  if (!balls) return '—';
  return (((runs ?? 0) * bpo) / balls).toFixed(2);
};

// Readable dismissal from the stored outType (we don't persist fielder/bowler).
const dismissalText = (b) => {
  if (!b?.isOut) return (b?.balls ?? 0) >= 0 ? 'not out' : '';
  const map = {
    Bowled: 'bowled',
    Caught: 'caught',
    LBW: 'lbw',
    'Run Out': 'run out',
    Stumped: 'stumped',
    'Hit Wicket': 'hit wicket',
    Retired: 'retired',
    'Retired Out': 'retired out',
  };
  return map[b.outType] || (b.outType ? String(b.outType).toLowerCase() : 'out');
};

// Ball-chip colour — mirrors getBallColor() in ScoreCardScreen exactly so the
// Ball-by-Ball tab matches what the scorer sees while marking the score.
const BALL_COLORS = {
  run: '#94a3b8',
  boundary: '#22c55e',
  wicket: '#ef4444',
  extra: '#f59e0b',
  bye: '#6366f1',
};
const ballColor = (ball) => {
  if (ball === 'W') return BALL_COLORS.wicket;
  if (ball === '4' || ball === '6') return BALL_COLORS.boundary;
  if (ball.includes('WD') || ball.includes('NB')) return BALL_COLORS.extra;
  if (ball.includes('BYE') || ball.includes('LB')) return BALL_COLORS.bye;
  return BALL_COLORS.run;
};

// Which batters appear in the batting table vs the "Yet to bat" line.
// Shown = out, or has faced a ball, or is currently at the crease.
const splitBatters = (batting, atCreaseNames) => {
  const batted = [];
  const yetToBat = [];
  (batting || []).forEach((b) => {
    const atCrease = atCreaseNames.includes(b.name);
    if (b.isOut || (b.balls ?? 0) > 0 || atCrease) batted.push(b);
    else yetToBat.push(b);
  });
  return { batted, yetToBat };
};

const matchStatusLine = (m) => {
  if (isCompleted(m.status)) return m.result || m.matchSummary?.winner || 'Match completed';
  if (m.status === 'innings_break') return 'Innings break';
  if (m.innings === 2 && m.target) {
    const need = m.target - (m.innings2?.runs ?? 0);
    const ballsLeft = oversToBalls(m.totalOvers + '.0', m.ballsPerOver) - oversToBalls(m.innings2?.overs, m.ballsPerOver);
    if (need > 0) return `Need ${need} run${need === 1 ? '' : 's'}${ballsLeft > 0 ? ` in ${ballsLeft} ball${ballsLeft === 1 ? '' : 's'}` : ''}`;
    return `Target ${m.target}`;
  }
  return 'Live';
};

const tossLine = (m) => {
  if (!m.toss?.winner || !m.toss?.decision) return '';
  return `${abbrevName(m.toss.winner)} chose to ${m.toss.decision}`;
};

// --- Live pulse dot --------------------------------------------------------

const LivePulse = () => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 2, duration: 900, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
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

// --- Scoreboard hero (gradient) -------------------------------------------
// Top section: both teams + scores, status line, toss + CRR, and (while live)
// the current batters / bowler mini-summary — mirrors the reference image.

const ScoreboardHero = ({ match }) => {
  const teamA = match.teamA?.name || 'Team A';
  const teamB = match.teamB?.name || 'Team B';
  const bpo = match.ballsPerOver || 6;
  const completed = isCompleted(match.status);

  const inningsOf = (teamName) => {
    if (match.innings1?.battingTeam === teamName) return match.innings1;
    if (match.innings2?.battingTeam === teamName) return match.innings2;
    return null;
  };
  const scoreA = inningsOf(teamA);
  const scoreB = inningsOf(teamB);

  const teamRow = (team, color, score) => (
    <View style={styles.heroTeamRow}>
      <View style={[styles.heroTeamBadge, { backgroundColor: color }]}>
        <Text style={styles.heroTeamBadgeText}>{initialOf(team)}</Text>
      </View>
      <Text style={styles.heroTeamName} numberOfLines={1}>{team}</Text>
      <View style={styles.heroScoreBlock}>
        {score ? (
          <>
            <Text style={styles.heroScoreRuns}>{score.runs ?? 0}/{score.wickets ?? 0}</Text>
            <Text style={styles.heroScoreOvers}>({score.overs || '0.0'})</Text>
          </>
        ) : (
          <Text style={styles.heroScorePending}>Yet to bat</Text>
        )}
      </View>
    </View>
  );

  // Current batters / bowler (live only) from currentState, with fallbacks.
  const cur = match.innings === 2 ? match.innings2 : match.innings1;
  const cs = match.currentState || {};
  const strikerName = cs.striker?.name;
  let liveBatters = [];
  if (!completed && cur) {
    const fromState = [cs.striker, cs.nonStriker].filter((b) => b && b.name);
    liveBatters = fromState.length
      ? fromState
      : (cur.batting || []).filter((b) => !b.isOut && (b.balls ?? 0) >= 0).slice(-2);
  }
  let liveBowler = null;
  if (!completed && cur) {
    liveBowler = (cs.currentBowler && cs.currentBowler.name)
      ? cs.currentBowler
      : [...(cur.bowling || [])].reverse().find((b) => oversToBalls(b.overs, bpo) > 0);
  }
  const crr = cur ? crrOf(cur.runs, cur.overs, bpo) : null;

  return (
    <LinearGradient
      colors={['#1e1b4b', '#3b1d6e', '#1e3a8a']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.heroTopRow}>
        <View style={[styles.heroLiveChip, completed && styles.heroDoneChip]}>
          {!completed && <LivePulse />}
          <Text style={[styles.heroLiveText, completed && styles.heroDoneText]}>
            {completed ? 'RESULT' : match.status === 'innings_break' ? 'BREAK' : 'LIVE'}
          </Text>
        </View>
        <Text style={styles.heroTournament} numberOfLines={1}>{match.tournamentName || match.venue || ''}</Text>
      </View>

      {teamRow(teamA, '#0d3b66', scoreA)}
      {teamRow(teamB, '#2d7dd2', scoreB)}

      <View style={styles.heroSummaryRow}>
        <Text style={styles.heroStatusText} numberOfLines={2}>{matchStatusLine(match)}</Text>
        {(tossLine(match) || crr != null) ? (
          <Text style={styles.heroSubText} numberOfLines={1}>
            {[tossLine(match), crr != null ? `CRR ${crr.toFixed(2)}` : ''].filter(Boolean).join('  •  ')}
          </Text>
        ) : null}
      </View>

      {/* Current batters / bowler mini-summary (live) */}
      {!completed && (liveBatters.length > 0 || liveBowler) ? (
        <View style={styles.heroMiniRow}>
          <View style={styles.heroMiniCol}>
            <Text style={styles.heroMiniLabel}>{cur?.battingTeam || ''} batting</Text>
            {liveBatters.map((b, i) => (
              <Text key={`hb_${i}`} style={styles.heroMiniText} numberOfLines={1}>
                {abbrevName(b.name)}: {b.runs ?? 0}{b.name === strikerName ? '*' : ''} ({b.balls ?? 0})
              </Text>
            ))}
          </View>
          <View style={styles.heroMiniCol}>
            <Text style={[styles.heroMiniLabel, styles.heroMiniLabelRight]}>{cur?.bowlingTeam || ''} bowling</Text>
            {liveBowler ? (
              <Text style={[styles.heroMiniText, styles.heroMiniTextRight]} numberOfLines={1}>
                {abbrevName(liveBowler.name)}: {liveBowler.wickets ?? 0}/{liveBowler.runs ?? 0} ({liveBowler.overs || '0.0'})
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </LinearGradient>
  );
};

// --- Tabs ------------------------------------------------------------------

const TabBar = ({ tabs, active, onChange }) => (
  <View style={styles.tabBar}>
    {tabs.map((t) => {
      const isActive = active === t.id;
      return (
        <TouchableOpacity
          key={t.id}
          style={styles.tab}
          onPress={() => onChange(t.id)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{t.label}</Text>
          {isActive && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      );
    })}
  </View>
);

// --- Scorecard tab ---------------------------------------------------------

const InningsScorecard = ({ innings, atCreaseNames, strikerName, bpo }) => {
  if (!innings) {
    return <Text style={styles.emptyText}>Yet to bat.</Text>;
  }
  const { batted, yetToBat } = splitBatters(innings.batting, atCreaseNames);
  const bowlers = (innings.bowling || []).filter((b) => oversToBalls(b.overs, bpo) > 0 || (b.wickets ?? 0) > 0 || (b.runs ?? 0) > 0);
  const ex = innings.extras || {};
  const exParts = [
    ex.byes ? `B ${ex.byes}` : '',
    ex.legByes ? `LB ${ex.legByes}` : '',
    ex.wides ? `W ${ex.wides}` : '',
    ex.noBalls ? `NB ${ex.noBalls}` : '',
  ].filter(Boolean);

  return (
    <View style={styles.card}>
      {/* Batting */}
      <View style={styles.colHeader}>
        <Text style={[styles.colHeaderText, styles.colName]}>Batting</Text>
        <Text style={styles.colHeaderText}>R</Text>
        <Text style={styles.colHeaderText}>B</Text>
        <Text style={styles.colHeaderText}>4s</Text>
        <Text style={styles.colHeaderText}>6s</Text>
        <Text style={[styles.colHeaderText, styles.colSR]}>S/R</Text>
      </View>
      {batted.length === 0 ? (
        <Text style={styles.cardEmpty}>No batters yet.</Text>
      ) : batted.map((b, i) => {
        const onStrike = !b.isOut && b.name === strikerName;
        return (
          <View key={`bat_${i}`} style={styles.row}>
            <View style={styles.colName}>
              <Text style={styles.cellName} numberOfLines={1}>
                {b.name}{onStrike ? ' *' : ''}
              </Text>
              <Text style={[styles.cellDismissal, !b.isOut && styles.cellNotOut]} numberOfLines={1}>
                {dismissalText(b)}
              </Text>
            </View>
            <Text style={styles.cellNum}>{b.runs ?? 0}</Text>
            <Text style={styles.cellNum}>{b.balls ?? 0}</Text>
            <Text style={styles.cellNum}>{b.fours ?? 0}</Text>
            <Text style={styles.cellNum}>{b.sixes ?? 0}</Text>
            <Text style={[styles.cellNum, styles.colSR]}>{srOf(b.runs ?? 0, b.balls ?? 0)}</Text>
          </View>
        );
      })}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Extras</Text>
        <Text style={styles.totalValue}>
          {ex.total ?? 0}{exParts.length ? `  (${exParts.join(', ')})` : ''}
        </Text>
      </View>
      <View style={[styles.totalRow, styles.totalRowMain]}>
        <Text style={styles.totalLabelMain}>Total</Text>
        <Text style={styles.totalValueMain}>
          {innings.runs ?? 0}/{innings.wickets ?? 0}
          <Text style={styles.totalOvers}>  ({innings.overs || '0.0'} ov)</Text>
        </Text>
      </View>

      {yetToBat.length > 0 ? (
        <View style={styles.metaBlock}>
          <Text style={styles.metaTitle}>Yet to bat</Text>
          <Text style={styles.metaText}>{yetToBat.map((b) => b.name).join('  ·  ')}</Text>
        </View>
      ) : null}

      {(innings.fallOfWickets || []).length > 0 ? (
        <View style={styles.metaBlock}>
          <Text style={styles.metaTitle}>Fall of wickets</Text>
          <Text style={styles.metaText}>
            {innings.fallOfWickets
              .map((f) => `${f.score}/${f.wicket} (${abbrevName(f.batsman)}, ${f.over} ov)`)
              .join('   ·   ')}
          </Text>
        </View>
      ) : null}

      {/* Bowling */}
      <View style={[styles.colHeader, styles.colHeaderBowling]}>
        <Text style={[styles.colHeaderText, styles.colName]}>Bowling</Text>
        <Text style={styles.colHeaderText}>O</Text>
        <Text style={styles.colHeaderText}>M</Text>
        <Text style={styles.colHeaderText}>R</Text>
        <Text style={styles.colHeaderText}>W</Text>
        <Text style={[styles.colHeaderText, styles.colSR]}>Econ</Text>
      </View>
      {bowlers.length === 0 ? (
        <Text style={styles.cardEmpty}>No bowling yet.</Text>
      ) : bowlers.map((bo, i) => (
        <View key={`bow_${i}`} style={styles.row}>
          <Text style={[styles.cellName, styles.colName]} numberOfLines={1}>{bo.name}</Text>
          <Text style={styles.cellNum}>{bo.overs || '0.0'}</Text>
          <Text style={styles.cellNum}>{bo.maidens ?? 0}</Text>
          <Text style={styles.cellNum}>{bo.runs ?? 0}</Text>
          <Text style={styles.cellNum}>{bo.wickets ?? 0}</Text>
          <Text style={[styles.cellNum, styles.colSR]}>
            {bo.economyRate != null ? Number(bo.economyRate).toFixed(2) : econOf(bo.runs, bo.overs, bpo)}
          </Text>
        </View>
      ))}
    </View>
  );
};

const ScorecardTab = ({ match }) => {
  const teamA = match.teamA?.name || 'Team A';
  const teamB = match.teamB?.name || 'Team B';
  const bpo = match.ballsPerOver || 6;

  const inningsOf = (teamName) => {
    if (match.innings1?.battingTeam === teamName) return match.innings1;
    if (match.innings2?.battingTeam === teamName) return match.innings2;
    return null;
  };

  // Default to the team currently/most recently batting.
  const currentBattingTeam = (match.innings === 2 ? match.innings2 : match.innings1)?.battingTeam || teamA;
  const [team, setTeam] = useState(currentBattingTeam);
  const selected = team === teamA || team === teamB ? team : currentBattingTeam;

  const completed = isCompleted(match.status);
  const atCreaseNames = completed ? [] : [match.currentState?.striker?.name, match.currentState?.nonStriker?.name].filter(Boolean);
  const strikerName = completed ? null : match.currentState?.striker?.name;

  const teamTab = (name, color) => {
    const active = selected === name;
    return (
      <TouchableOpacity
        style={[styles.inningsTab, active && styles.inningsTabActive]}
        onPress={() => setTeam(name)}
        activeOpacity={0.8}
      >
        <View style={[styles.inningsTabBadge, { backgroundColor: color }]}>
          <Text style={styles.inningsTabBadgeText}>{initialOf(name)}</Text>
        </View>
        <Text style={[styles.inningsTabText, active && styles.inningsTabTextActive]} numberOfLines={1}>{name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.tabContent}>
      <View style={styles.inningsTabRow}>
        {teamTab(teamA, '#0d3b66')}
        {teamTab(teamB, '#2d7dd2')}
      </View>
      <InningsScorecard
        innings={inningsOf(selected)}
        atCreaseNames={selected === currentBattingTeam ? atCreaseNames : []}
        strikerName={selected === currentBattingTeam ? strikerName : null}
        bpo={bpo}
      />
      <MatchFooter match={match} />
    </View>
  );
};

// --- Ball by Ball tab ------------------------------------------------------

const BallChip = ({ ball }) => (
  <View style={[styles.bbBall, { backgroundColor: ballColor(ball) }]}>
    <Text style={styles.bbBallText}>{ball}</Text>
  </View>
);

const OverCard = ({ over, live }) => (
  <View style={styles.overCard}>
    <View style={styles.overHeader}>
      <View style={[styles.overChip, live && styles.overChipLive]}>
        <Text style={[styles.overChipText, live && styles.overChipTextLive]}>
          {live ? 'THIS OVER' : `OVER ${over.overNumber}`}
        </Text>
      </View>
      <Text style={styles.overBowler} numberOfLines={1}>{abbrevName(over.bowlerName) || ''}</Text>
      <Text style={styles.overTotalText}>
        {over.runs ?? 0} run{over.runs === 1 ? '' : 's'}{over.wickets ? `, ${over.wickets} wkt` : ''}
      </Text>
    </View>
    <View style={styles.bbBallRow}>
      {(over.balls || []).map((b, i) => <BallChip key={`b_${i}`} ball={String(b)} />)}
    </View>
  </View>
);

const InningsBallByBall = ({ innings, label, currentOverBalls, currentBowlerName }) => {
  const overs = innings?.overHistory || [];
  const hasCurrent = (currentOverBalls || []).length > 0;
  if (overs.length === 0 && !hasCurrent) return null;
  // Most recent over first.
  const reversed = [...overs].reverse();
  return (
    <View style={styles.bbInnings}>
      <Text style={styles.bbInningsLabel}>{label}</Text>
      {hasCurrent ? (
        <OverCard
          live
          over={{
            balls: currentOverBalls,
            bowlerName: currentBowlerName,
            runs: currentOverBalls.reduce((sum, b) => {
              const n = parseInt(String(b).replace(/[^0-9]/g, ''), 10);
              return sum + (Number.isNaN(n) ? 0 : n);
            }, 0),
            wickets: currentOverBalls.filter((b) => String(b).includes('W')).length,
          }}
        />
      ) : null}
      {reversed.map((ov, idx) => <OverCard key={`${ov.overNumber}_${idx}`} over={ov} />)}
    </View>
  );
};

const BallByBallTab = ({ match }) => {
  const completed = isCompleted(match.status);
  const cs = match.currentState || {};
  const currentInningsNum = match.innings || 1;

  const i1 = match.innings1;
  const i2 = match.innings2;
  const anything =
    (i1?.overHistory || []).length || (i2?.overHistory || []).length || (cs.currentOverBalls || []).length;

  if (!anything) {
    return (
      <View style={styles.tabContent}>
        <Text style={styles.emptyText}>Ball-by-ball will appear once play begins.</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {/* Current innings first */}
      {currentInningsNum === 2 && i2 ? (
        <>
          <InningsBallByBall
            innings={i2}
            label={`${i2.battingTeam || 'Team B'} — 2nd innings`}
            currentOverBalls={!completed ? cs.currentOverBalls : null}
            currentBowlerName={cs.currentBowler?.name}
          />
          <InningsBallByBall innings={i1} label={`${i1?.battingTeam || 'Team A'} — 1st innings`} />
        </>
      ) : (
        <>
          <InningsBallByBall
            innings={i1}
            label={`${i1?.battingTeam || 'Team A'} — 1st innings`}
            currentOverBalls={!completed && currentInningsNum === 1 ? cs.currentOverBalls : null}
            currentBowlerName={cs.currentBowler?.name}
          />
          {i2 ? <InningsBallByBall innings={i2} label={`${i2.battingTeam || 'Team B'} — 2nd innings`} /> : null}
        </>
      )}
    </View>
  );
};

// --- Summary tab (completed matches) ---------------------------------------

// Look up a player's batting + bowling figures by name across both innings,
// to flesh out the Player of the Match line like "1/42 (10) & 111* (125)".
const playerFigures = (match, name) => {
  if (!name) return '';
  const innings = [match.innings1, match.innings2].filter(Boolean);
  let bat = '';
  let bowl = '';
  innings.forEach((inn) => {
    const b = (inn.batting || []).find((x) => x.name === name);
    if (b && ((b.balls ?? 0) > 0 || b.isOut)) bat = `${b.runs ?? 0}${b.isOut ? '' : '*'} (${b.balls ?? 0})`;
    const bo = (inn.bowling || []).find((x) => x.name === name);
    if (bo && (oversToBalls(bo.overs, match.ballsPerOver || 6) > 0)) bowl = `${bo.wickets ?? 0}/${bo.runs ?? 0} (${bo.overs})`;
  });
  return [bowl, bat].filter(Boolean).join(' & ');
};

const InningsSummary = ({ innings, badgeColor }) => {
  if (!innings) return null;
  const topBat = [...(innings.batting || [])]
    .filter((b) => (b.balls ?? 0) > 0 || b.isOut)
    .sort((a, b) => (b.runs ?? 0) - (a.runs ?? 0))
    .slice(0, 3);
  const topBowl = [...(innings.bowling || [])]
    .filter((b) => oversToBalls(b.overs) > 0)
    .sort((a, b) => (b.wickets ?? 0) - (a.wickets ?? 0) || (a.runs ?? 0) - (b.runs ?? 0))
    .slice(0, 3);
  const rows = Math.max(topBat.length, topBowl.length);

  return (
    <View style={styles.sumInnings}>
      <View style={styles.sumInningsHeader}>
        <View style={[styles.sumBadge, { backgroundColor: badgeColor }]}>
          <Text style={styles.sumBadgeText}>{initialOf(innings.battingTeam)}</Text>
        </View>
        <Text style={styles.sumInningsTitle}>{innings.battingTeam}</Text>
        <Text style={styles.sumInningsScore}>{innings.runs ?? 0}/{innings.wickets ?? 0} ({innings.overs || '0.0'})</Text>
      </View>
      {Array.from({ length: rows }).map((_, i) => {
        const bat = topBat[i];
        const bowl = topBowl[i];
        return (
          <View key={`sr_${i}`} style={styles.sumRow}>
            <View style={styles.sumCell}>
              {bat ? (
                <Text style={styles.sumCellText} numberOfLines={1}>
                  <Text style={styles.sumName}>{abbrevName(bat.name)} </Text>
                  {bat.runs ?? 0}{bat.isOut ? '' : '*'} ({bat.balls ?? 0})
                </Text>
              ) : null}
            </View>
            <View style={[styles.sumCell, styles.sumCellRight]}>
              {bowl ? (
                <Text style={[styles.sumCellText, styles.sumCellTextRight]} numberOfLines={1}>
                  <Text style={styles.sumName}>{abbrevName(bowl.name)} </Text>
                  {bowl.wickets ?? 0}/{bowl.runs ?? 0} ({bowl.overs})
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const SummaryTab = ({ match }) => {
  const pom = match.matchSummary?.playerOfMatch;
  const pomFigures = playerFigures(match, pom);
  const i1 = match.innings1;
  const i2 = match.innings2;
  const firstColor = i1?.battingTeam === match.teamA?.name ? '#0d3b66' : '#2d7dd2';
  const secondColor = firstColor === '#0d3b66' ? '#2d7dd2' : '#0d3b66';

  return (
    <View style={styles.tabContent}>
      <View style={styles.resultBanner}>
        <Text style={styles.resultText}>{match.result || match.matchSummary?.winner || 'Match completed'}</Text>
      </View>

      {pom ? (
        <LinearGradient
          colors={['#4f46e5', '#6d28d9']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.pomCard}
        >
          <View style={styles.pomBadge}>
            <Text style={styles.pomBadgeText}>{initialOf(pom)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pomLabel}>Player of the Match</Text>
            <Text style={styles.pomName} numberOfLines={1}>{pom}</Text>
            {pomFigures ? <Text style={styles.pomFigures} numberOfLines={1}>{pomFigures}</Text> : null}
          </View>
        </LinearGradient>
      ) : null}

      <InningsSummary innings={i1} badgeColor={firstColor} />
      <InningsSummary innings={i2} badgeColor={secondColor} />

      <MatchFooter match={match} />
    </View>
  );
};

// --- Shared footer (toss + venue) ------------------------------------------

const MatchFooter = ({ match }) => {
  const toss = tossLine(match);
  const venue = match.venue && match.venue !== 'Unknown Venue' ? match.venue : '';
  if (!toss && !venue) return null;
  return (
    <View style={styles.footerCard}>
      {toss ? (
        <Text style={styles.footerLine}><Text style={styles.footerKey}>Toss: </Text>{toss}</Text>
      ) : null}
      {venue ? (
        <Text style={styles.footerLine}><Text style={styles.footerKey}>Venue: </Text>{venue}</Text>
      ) : null}
    </View>
  );
};

// --- Screen ----------------------------------------------------------------

const PublicLiveMatchScreen = ({ navigation, route }) => {
  const { user } = useContext(AuthContext);
  const { matchId } = route.params || {};

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('scorecard');
  const didInitTab = useRef(false);
  const socketRef = useRef(null);
  const refetchTimer = useRef(null);
  const contentFade = useRef(new Animated.Value(0)).current;

  const fetchMatch = useCallback(async () => {
    if (!user?.token || !matchId) return;
    try {
      setError('');
      const res = await matchService.getMatch(matchId, user.token);
      const data = res?.data || res;
      setMatch(data);
      Animated.timing(contentFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } catch (err) {
      console.warn('Public live match fetch error:', err);
      setError('Failed to load match.');
    } finally {
      setLoading(false);
    }
  }, [user?.token, matchId]);

  useFocusEffect(useCallback(() => { fetchMatch(); }, [fetchMatch]));

  // Pick a sensible default tab once, based on match status.
  useEffect(() => {
    if (match && !didInitTab.current) {
      didInitTab.current = true;
      setActiveTab(isCompleted(match.status) ? 'summary' : 'scorecard');
    }
  }, [match]);

  // Subscribe to the match's socket room — debounced refetch on every event.
  useEffect(() => {
    if (!matchId) return;
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join-match', matchId));
    socket.on('score-updated', () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => { fetchMatch(); }, 600);
    });
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      try {
        socket.emit('leave-match', matchId);
        socket.disconnect();
      } catch (_) {}
      socketRef.current = null;
    };
  }, [matchId, fetchMatch]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <GradientHeader title="Match Centre" subtitle="" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading match…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !match) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <GradientHeader title="Match Centre" subtitle="" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || 'Match not found.'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchMatch}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const completed = isCompleted(match.status);
  const tabs = completed
    ? [{ id: 'summary', label: 'Summary' }, { id: 'scorecard', label: 'Scorecard' }, { id: 'ballbyball', label: 'Ball by Ball' }]
    : [{ id: 'scorecard', label: 'Scorecard' }, { id: 'ballbyball', label: 'Ball by Ball' }];
  // Guard: if status flipped and the active tab no longer exists, fall back.
  const safeActive = tabs.some((t) => t.id === activeTab) ? activeTab : tabs[0].id;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <GradientHeader
        title={`${match.teamA?.name || 'Team A'} vs ${match.teamB?.name || 'Team B'}`}
        subtitle={match.tournamentName || ''}
        onBack={() => navigation.goBack()}
      />
      <Animated.View style={{ flex: 1, opacity: contentFade }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <ScoreboardHero match={match} />
          <TabBar tabs={tabs} active={safeActive} onChange={setActiveTab} />
          {safeActive === 'summary' && <SummaryTab match={match} />}
          {safeActive === 'scorecard' && <ScorecardTab match={match} />}
          {safeActive === 'ballbyball' && <BallByBallTab match={match} />}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
};

// --- Styles ----------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#94a3b8' },
  errorText: { fontSize: 15, color: '#ef4444', marginBottom: 16 },
  retryButton: { backgroundColor: '#2563eb', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  retryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  scrollContent: { paddingBottom: 40 },

  // Hero
  hero: {
    marginHorizontal: 16, marginTop: 16,
    padding: 16, borderRadius: 22,
    shadowColor: '#1e1b4b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16,
    elevation: 8,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  heroLiveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(220,38,38,0.25)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)',
  },
  heroDoneChip: { backgroundColor: 'rgba(34,197,94,0.22)', borderColor: 'rgba(74,222,128,0.4)' },
  heroLiveText: { color: '#fca5a5', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  heroDoneText: { color: '#86efac' },
  heroTournament: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700', textAlign: 'right' },

  heroTeamRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  heroTeamBadge: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  heroTeamBadgeText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  heroTeamName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700' },
  heroScoreBlock: { alignItems: 'flex-end' },
  heroScoreRuns: { color: '#fff', fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  heroScoreOvers: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  heroScorePending: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600', fontStyle: 'italic' },

  heroSummaryRow: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)',
  },
  heroStatusText: { color: '#fde047', fontSize: 14, fontWeight: '800' },
  heroSubText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', marginTop: 3 },

  heroMiniRow: {
    flexDirection: 'row', marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)',
  },
  heroMiniCol: { flex: 1 },
  heroMiniLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 },
  heroMiniLabelRight: { textAlign: 'right' },
  heroMiniText: { color: 'rgba(255,255,255,0.92)', fontSize: 12, fontWeight: '700', marginTop: 1, fontVariant: ['tabular-nums'] },
  heroMiniTextRight: { textAlign: 'right' },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginTop: 16, marginHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  tabTextActive: { color: '#2563eb', fontWeight: '800' },
  tabUnderline: {
    position: 'absolute', bottom: -1, left: '20%', right: '20%',
    height: 3, backgroundColor: '#2563eb', borderRadius: 2,
  },

  tabContent: { paddingHorizontal: 16, paddingTop: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 14,
    padding: 14, marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardEmpty: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', paddingVertical: 8 },
  emptyText: { textAlign: 'center', color: '#94a3b8', fontSize: 13, paddingVertical: 50 },

  // Innings (team) selector
  inningsTabRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  inningsTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  inningsTabActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  inningsTabBadge: { width: 24, height: 24, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  inningsTabBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  inningsTabText: { fontSize: 13, fontWeight: '700', color: '#64748b', flexShrink: 1 },
  inningsTabTextActive: { color: '#1d4ed8', fontWeight: '800' },

  // Table
  colHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: 8, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  colHeaderBowling: { marginTop: 8 },
  colHeaderText: {
    flex: 1, textAlign: 'center',
    fontSize: 10, fontWeight: '800', color: '#94a3b8',
    letterSpacing: 0.3, textTransform: 'uppercase',
  },
  colName: { flex: 3.2, textAlign: 'left' },
  colSR: { flex: 1.4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  cellName: { fontSize: 13.5, fontWeight: '700', color: '#0f172a' },
  cellDismissal: { fontSize: 10.5, fontWeight: '500', color: '#94a3b8', marginTop: 1 },
  cellNotOut: { color: '#16a34a', fontWeight: '700' },
  cellNum: { flex: 1, textAlign: 'center', fontSize: 13, color: '#334155', fontWeight: '600', fontVariant: ['tabular-nums'] },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, marginTop: 2,
  },
  totalLabel: { fontSize: 13, fontWeight: '700', color: '#475569' },
  totalValue: { fontSize: 13, fontWeight: '600', color: '#475569', fontVariant: ['tabular-nums'] },
  totalRowMain: { borderTopWidth: 1, borderTopColor: '#e2e8f0', marginTop: 0 },
  totalLabelMain: { fontSize: 14, fontWeight: '900', color: '#0f172a' },
  totalValueMain: { fontSize: 15, fontWeight: '900', color: '#0f172a', fontVariant: ['tabular-nums'] },
  totalOvers: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },

  metaBlock: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  metaTitle: { fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 },
  metaText: { fontSize: 12.5, fontWeight: '600', color: '#475569', lineHeight: 19 },

  // Ball by Ball
  bbInnings: { marginBottom: 8 },
  bbInningsLabel: { fontSize: 12, fontWeight: '800', color: '#64748b', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 },
  overCard: {
    backgroundColor: '#fff', borderRadius: 14,
    padding: 12, marginBottom: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  overHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  overChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#f1f5f9' },
  overChipLive: { backgroundColor: '#fee2e2' },
  overChipText: { fontSize: 10, fontWeight: '900', color: '#475569', letterSpacing: 0.5 },
  overChipTextLive: { color: '#dc2626' },
  overBowler: { flex: 1, fontSize: 12, fontWeight: '700', color: '#334155' },
  overTotalText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  bbBallRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  bbBall: {
    minWidth: 32, height: 32, borderRadius: 16, paddingHorizontal: 6,
    justifyContent: 'center', alignItems: 'center',
  },
  bbBallText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Summary
  resultBanner: {
    backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14,
  },
  resultText: { fontSize: 14, fontWeight: '800', color: '#047857', textAlign: 'center' },
  pomCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, padding: 14, marginBottom: 16,
  },
  pomBadge: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center', alignItems: 'center',
  },
  pomBadgeText: { color: '#fff', fontSize: 19, fontWeight: '900' },
  pomLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  pomName: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 2 },
  pomFigures: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: '700', marginTop: 2 },

  sumInnings: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12,
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  sumInningsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingBottom: 10, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  sumBadge: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sumBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  sumInningsTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0f172a' },
  sumInningsScore: { fontSize: 14, fontWeight: '900', color: '#0f172a', fontVariant: ['tabular-nums'] },
  sumRow: { flexDirection: 'row', paddingVertical: 5 },
  sumCell: { flex: 1, paddingRight: 8 },
  sumCellRight: { paddingRight: 0, paddingLeft: 8 },
  sumCellText: { fontSize: 12.5, color: '#475569', fontWeight: '600', fontVariant: ['tabular-nums'] },
  sumCellTextRight: { textAlign: 'right' },
  sumName: { color: '#0f172a', fontWeight: '800' },

  // Footer
  footerCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 2, marginBottom: 8,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  footerLine: { fontSize: 12.5, color: '#475569', fontWeight: '600', lineHeight: 20 },
  footerKey: { fontWeight: '800', color: '#0f172a' },

  // Pulse
  pulseWrap: { width: 8, height: 8, justifyContent: 'center', alignItems: 'center' },
  pulseRing: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
});

export default PublicLiveMatchScreen;
