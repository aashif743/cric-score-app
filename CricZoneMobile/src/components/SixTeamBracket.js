import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { slotSourceLabel, knockoutGameNumbers } from '../utils/bracketLabels';
import Icon from './Icon';

// 6-team hybrid playoff bracket (2 groups, top 3):
//   Knockout 1 (A2 v B3) ┐
//   Knockout 2 (B2 v A3) ┴─► Eliminator ─(winner)─► Qualifier 2 (B)
//   Qualifier 1 (A1 v B1) ─┬─(winner)───────────────► Final (A)
//                          └─(loser)──► Qualifier 2 (A) ─(winner)─► Final (B)
// The two group winners (A1, B1) get a bye straight to Qualifier 1.

const initial = (name) => (name || '?').trim().charAt(0).toUpperCase();
const isReal = (name) => !!name && name !== 'TBD';
const winnerOf = (m) => {
  if (!m || m.status !== 'completed') return null;
  if (m.matchSummary?.winner) return m.matchSummary.winner;
  const idx = m.result?.indexOf(' won by ') ?? -1;
  return idx > 0 ? m.result.slice(0, idx) : null;
};

const C_ELIM = '#0d9488';  // feeds the Eliminator
const C_Q2 = '#2563eb';    // feeds Qualifier 2
const C_FINAL = '#f97316'; // feeds the Final

const Slot = ({ name, placeholder, accent, isWinner, onEdit }) => {
  const known = isReal(name);
  const body = (
    <>
      <View style={[styles.slotDot, { backgroundColor: known ? accent : '#cbd5e1' }]}>
        <Text style={styles.slotDotText}>{known ? initial(name) : '?'}</Text>
      </View>
      <Text style={[styles.slotName, !known && styles.slotNamePlaceholder, isWinner && styles.slotNameWin]} numberOfLines={1}>
        {known ? name : placeholder}
      </Text>
      {isWinner ? <View style={styles.winCheck}><View style={styles.winCheckA} /><View style={styles.winCheckB} /></View>
        : onEdit ? <Icon name="edit" size={11} color="#94a3b8" /> : null}
    </>
  );
  if (onEdit) return <TouchableOpacity style={styles.slot} onPress={onEdit} activeOpacity={0.6}>{body}</TouchableOpacity>;
  return <View style={styles.slot}>{body}</View>;
};

const Node = ({ x, y, w, h, label, headerColor, match, slotA, slotB, onPress, onEditA, onEditB }) => {
  const win = winnerOf(match);
  const live = match?.status === 'in_progress' || match?.status === 'innings_break';
  return (
    <View style={[styles.node, { left: x, top: y, width: w, height: h }]}>
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.nodeHeader, { backgroundColor: headerColor }]}>
        <Text style={styles.nodeHeaderText} numberOfLines={1}>{label}</Text>
        {live ? <View style={styles.liveDot} /> : null}
      </TouchableOpacity>
      <View style={styles.nodeBody}>
        <Slot name={slotA.name} placeholder={slotA.placeholder} accent={headerColor} isWinner={win && win === slotA.name} onEdit={onEditA} />
        <View style={styles.slotSep} />
        <Slot name={slotB.name} placeholder={slotB.placeholder} accent={headerColor} isWinner={win && win === slotB.name} onEdit={onEditB} />
      </View>
    </View>
  );
};

const SixTeamBracket = ({ matches = [], onStart, isOwner, onEditSlot }) => {
  const byLabel = (label) => matches.find((m) => m.matchLabel === label);
  const ko1 = byLabel('Knockout 1');
  const ko2 = byLabel('Knockout 2');
  const q1 = byLabel('Qualifier 1');
  const elim = byLabel('Eliminator');
  const q2 = byLabel('Qualifier 2');
  const final = byLabel('Final');

  const gameNos = knockoutGameNumbers(matches);
  const lbl = (m, slot) => slotSourceLabel(m, slot, matches, gameNos, { short: true });
  const editFn = (m, slot) => (isOwner && onEditSlot && m && m.status === 'scheduled') ? () => onEditSlot(m, slot) : undefined;
  const tap = (m) => () => { if (m && onStart) onStart(m); };

  const NODE_W = 112, NODE_H = 86, W = 560, H = 400;
  const c0 = 0, c1 = 150, c2 = 300, c3 = 450;
  const ko1y = 16, ko2y = 298, q1y = 16, elimy = 298, q2y = 157, finaly = 90;

  const midY = (ny) => ny + 43;
  const slotAY = (ny) => ny + 42;
  const slotBY = (ny) => ny + 68;

  const line = (pts, color) => (
    <Polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: C_ELIM }]} /><Text style={styles.legendText}>to Eliminator</Text>
        <View style={[styles.legendDot, { backgroundColor: C_Q2, marginLeft: 12 }]} /><Text style={styles.legendText}>to Qualifier 2</Text>
        <View style={[styles.legendDot, { backgroundColor: C_FINAL, marginLeft: 12 }]} /><Text style={styles.legendText}>to Final</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingHorizontal: 12 }}>
        <View style={{ width: W, height: H }}>
          <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
            {/* KO winners → Eliminator */}
            {line([[NODE_W, midY(ko1y)], [c1 - 8, midY(ko1y)], [c1 - 8, slotAY(elimy)], [c1, slotAY(elimy)]], C_ELIM)}
            {line([[NODE_W, midY(ko2y)], [c1 - 8, midY(ko2y)], [c1 - 8, slotBY(elimy)], [c1, slotBY(elimy)]], C_ELIM)}
            {/* Q1 winner → Final (A) */}
            {line([[c1 + NODE_W, midY(q1y)], [c3 - 8, midY(q1y)], [c3 - 8, slotAY(finaly)], [c3, slotAY(finaly)]], C_FINAL)}
            {/* Q1 loser → Qualifier 2 (A) */}
            {line([[c1 + NODE_W, midY(q1y)], [c2 - 16, midY(q1y)], [c2 - 16, slotAY(q2y)], [c2, slotAY(q2y)]], C_Q2)}
            {/* Eliminator winner → Qualifier 2 (B) */}
            {line([[c1 + NODE_W, midY(elimy)], [c2 - 16, midY(elimy)], [c2 - 16, slotBY(q2y)], [c2, slotBY(q2y)]], C_Q2)}
            {/* Qualifier 2 winner → Final (B) */}
            {line([[c2 + NODE_W, midY(q2y)], [c3 - 8, midY(q2y)], [c3 - 8, slotBY(finaly)], [c3, slotBY(finaly)]], C_FINAL)}
          </Svg>

          <Node x={c0} y={ko1y} w={NODE_W} h={NODE_H} label="KNOCKOUT 1" headerColor="#334155" match={ko1}
            slotA={{ name: ko1?.teamA?.name, placeholder: lbl(ko1, 'A') }} slotB={{ name: ko1?.teamB?.name, placeholder: lbl(ko1, 'B') }}
            onPress={tap(ko1)} onEditA={editFn(ko1, 'A')} onEditB={editFn(ko1, 'B')} />
          <Node x={c0} y={ko2y} w={NODE_W} h={NODE_H} label="KNOCKOUT 2" headerColor="#334155" match={ko2}
            slotA={{ name: ko2?.teamA?.name, placeholder: lbl(ko2, 'A') }} slotB={{ name: ko2?.teamB?.name, placeholder: lbl(ko2, 'B') }}
            onPress={tap(ko2)} onEditA={editFn(ko2, 'A')} onEditB={editFn(ko2, 'B')} />
          <Node x={c1} y={q1y} w={NODE_W} h={NODE_H} label="QUALIFIER 1" headerColor="#0d3b66" match={q1}
            slotA={{ name: q1?.teamA?.name, placeholder: lbl(q1, 'A') }} slotB={{ name: q1?.teamB?.name, placeholder: lbl(q1, 'B') }}
            onPress={tap(q1)} onEditA={editFn(q1, 'A')} onEditB={editFn(q1, 'B')} />
          <Node x={c1} y={elimy} w={NODE_W} h={NODE_H} label="ELIMINATOR" headerColor="#0d3b66" match={elim}
            slotA={{ name: elim?.teamA?.name, placeholder: lbl(elim, 'A') }} slotB={{ name: elim?.teamB?.name, placeholder: lbl(elim, 'B') }}
            onPress={tap(elim)} onEditA={editFn(elim, 'A')} onEditB={editFn(elim, 'B')} />
          <Node x={c2} y={q2y} w={NODE_W} h={NODE_H} label="QUALIFIER 2" headerColor={C_Q2} match={q2}
            slotA={{ name: q2?.teamA?.name, placeholder: lbl(q2, 'A') }} slotB={{ name: q2?.teamB?.name, placeholder: lbl(q2, 'B') }}
            onPress={tap(q2)} onEditA={editFn(q2, 'A')} onEditB={editFn(q2, 'B')} />
          <Node x={c3} y={finaly} w={NODE_W} h={NODE_H} label="FINAL" headerColor={C_FINAL} match={final}
            slotA={{ name: final?.teamA?.name, placeholder: lbl(final, 'A') }} slotB={{ name: final?.teamB?.name, placeholder: lbl(final, 'B') }}
            onPress={tap(final)} onEditA={editFn(final, 'A')} onEditB={editFn(final, 'B')} />
        </View>
      </ScrollView>

      <Text style={styles.hint}>
        Group winners get a bye to Qualifier 1. Swipe to see the full bracket · tap a header to {isOwner ? 'start/view' : 'view'}{isOwner ? ' · tap a team to set it' : ''}.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingTop: 4, paddingBottom: 8 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 6, flexWrap: 'wrap' },
  legendDot: { width: 9, height: 9, borderRadius: 5, marginRight: 5 },
  legendText: { fontSize: 10.5, fontWeight: '700', color: '#64748b' },
  node: {
    position: 'absolute', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#e8edf3',
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  nodeHeader: { height: 24, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  nodeHeaderText: { color: '#fff', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', position: 'absolute', right: 7 },
  nodeBody: { flex: 1, paddingHorizontal: 7, justifyContent: 'center' },
  slot: { flexDirection: 'row', alignItems: 'center', height: 28 },
  slotDot: { width: 20, height: 20, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  slotDotText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  slotName: { flex: 1, fontSize: 12, fontWeight: '700', color: '#1e293b' },
  slotNamePlaceholder: { color: '#94a3b8', fontWeight: '600', fontStyle: 'italic', fontSize: 10.5 },
  slotNameWin: { color: '#059669', fontWeight: '900' },
  slotSep: { height: 1, backgroundColor: '#f1f5f9' },
  winCheck: { width: 14, height: 14, marginLeft: 2, position: 'relative' },
  winCheckA: { position: 'absolute', left: 2, top: 7, width: 5, height: 2, backgroundColor: '#059669', borderRadius: 1, transform: [{ rotate: '45deg' }] },
  winCheckB: { position: 'absolute', left: 4, top: 5, width: 9, height: 2, backgroundColor: '#059669', borderRadius: 1, transform: [{ rotate: '-50deg' }] },
  hint: { textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 8, fontWeight: '600', paddingHorizontal: 12 },
});

export default SixTeamBracket;
