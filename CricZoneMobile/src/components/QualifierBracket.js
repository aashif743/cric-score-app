import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { slotSourceLabel, knockoutGameNumbers } from '../utils/bracketLabels';

// --- helpers ---------------------------------------------------------------
const initial = (name) => (name || '?').trim().charAt(0).toUpperCase();
const isReal = (name) => !!name && name !== 'TBD';
const winnerOf = (m) => {
  if (!m || m.status !== 'completed') return null;
  if (m.matchSummary?.winner) return m.matchSummary.winner;
  const idx = m.result?.indexOf(' won by ') ?? -1;
  return idx > 0 ? m.result.slice(0, idx) : null;
};

// Colours: blue feeds into Qualifier 2, orange/red feeds into the Final —
// mirrors the IPL playoff graphic so the flow reads at a glance.
const C_Q2 = '#2563eb';
const C_FINAL = '#f97316';

// A single team line inside a match node. Editable (owner) when onEdit is given.
const Slot = ({ name, placeholder, accent, isWinner, onEdit }) => {
  const known = isReal(name);
  const body = (
    <>
      <View style={[styles.slotDot, { backgroundColor: known ? accent : '#cbd5e1' }]}>
        <Text style={styles.slotDotText}>{known ? initial(name) : '?'}</Text>
      </View>
      <Text
        style={[
          styles.slotName,
          !known && styles.slotNamePlaceholder,
          isWinner && styles.slotNameWin,
        ]}
        numberOfLines={1}
      >
        {known ? name : placeholder}
      </Text>
      {isWinner ? <View style={styles.winCheck}><View style={styles.winCheckA} /><View style={styles.winCheckB} /></View>
        : onEdit ? <Text style={styles.slotEdit}>✎</Text> : null}
    </>
  );
  if (onEdit) {
    return <TouchableOpacity style={styles.slot} onPress={onEdit} activeOpacity={0.6}>{body}</TouchableOpacity>;
  }
  return <View style={styles.slot}>{body}</View>;
};

// One match box in the bracket. Header tap starts/views; slots (owner) edit.
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

/**
 * IPL-style qualifier playoff bracket.
 *   Qualifier 1 ─┬─(winner)──────────────► Final (A)
 *                └─(loser)──► Qualifier 2 (A)
 *   Eliminator ────(winner)─► Qualifier 2 (B)
 *   Qualifier 2 ───(winner)─────────────► Final (B)
 */
const QualifierBracket = ({ matches = [], onStart, isOwner, onEditSlot }) => {
  const byLabel = (label) => matches.find((m) => m.matchLabel === label);
  const q1 = byLabel('Qualifier 1');
  const elim = byLabel('Eliminator');
  const q2 = byLabel('Qualifier 2');
  const final = byLabel('Final');

  const gameNos = knockoutGameNumbers(matches);
  const lbl = (m, slot) => slotSourceLabel(m, slot, matches, gameNos);
  // Owner can edit a slot while that match hasn't started.
  const editFn = (m, slot) =>
    (isOwner && onEditSlot && m && m.status === 'scheduled') ? () => onEditSlot(m, slot) : undefined;

  const canvasW = Math.min(Dimensions.get('window').width - 24, 380);
  const NODE_W = Math.min(112, (canvasW - 8) / 3);
  const NODE_H = 88;
  const H = 430;

  const q1x = 0;
  const finalx = canvasW - NODE_W;
  const q2x = (canvasW - NODE_W) / 2;

  const q1y = 16;
  const elimy = H - NODE_H - 16;
  const q2y = (H - NODE_H) / 2;
  const finaly = 100;

  // Vertical anchor helpers
  const midY = (ny) => ny + NODE_H / 2;
  const slotAY = (ny) => ny + 42;
  const slotBY = (ny) => ny + 70;

  const tap = (m) => () => { if (m && onStart) onStart(m); };

  // Orthogonal connectors (start x, y … end at a node's left edge)
  const line = (pts, color) => (
    <Polyline
      points={pts.map((p) => p.join(',')).join(' ')}
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: C_Q2 }]} />
        <Text style={styles.legendText}>to Qualifier 2</Text>
        <View style={[styles.legendDot, { backgroundColor: C_FINAL, marginLeft: 14 }]} />
        <Text style={styles.legendText}>to Final</Text>
      </View>

      <View style={{ width: canvasW, height: H, alignSelf: 'center' }}>
        {/* Connectors behind the nodes */}
        <Svg width={canvasW} height={H} style={StyleSheet.absoluteFill}>
          {/* Q1 winner → Final (top) */}
          {line([[NODE_W, midY(q1y)], [finalx - 16, midY(q1y)], [finalx - 16, slotAY(finaly)], [finalx, slotAY(finaly)]], C_FINAL)}
          {/* Q1 loser → Qualifier 2 (top) */}
          {line([[NODE_W, midY(q1y)], [q2x - 16, midY(q1y)], [q2x - 16, slotAY(q2y)], [q2x, slotAY(q2y)]], C_Q2)}
          {/* Eliminator winner → Qualifier 2 (bottom) */}
          {line([[NODE_W, midY(elimy)], [q2x - 8, midY(elimy)], [q2x - 8, slotBY(q2y)], [q2x, slotBY(q2y)]], C_Q2)}
          {/* Qualifier 2 winner → Final (bottom) */}
          {line([[q2x + NODE_W, midY(q2y)], [finalx - 8, midY(q2y)], [finalx - 8, slotBY(finaly)], [finalx, slotBY(finaly)]], C_FINAL)}
        </Svg>

        <Node
          x={q1x} y={q1y} w={NODE_W} h={NODE_H}
          label="QUALIFIER 1" headerColor="#0d3b66" match={q1}
          slotA={{ name: q1?.teamA?.name, placeholder: lbl(q1, 'A') }}
          slotB={{ name: q1?.teamB?.name, placeholder: lbl(q1, 'B') }}
          onPress={tap(q1)} onEditA={editFn(q1, 'A')} onEditB={editFn(q1, 'B')}
        />
        <Node
          x={q1x} y={elimy} w={NODE_W} h={NODE_H}
          label="ELIMINATOR" headerColor="#0d3b66" match={elim}
          slotA={{ name: elim?.teamA?.name, placeholder: lbl(elim, 'A') }}
          slotB={{ name: elim?.teamB?.name, placeholder: lbl(elim, 'B') }}
          onPress={tap(elim)} onEditA={editFn(elim, 'A')} onEditB={editFn(elim, 'B')}
        />
        <Node
          x={q2x} y={q2y} w={NODE_W} h={NODE_H}
          label="QUALIFIER 2" headerColor={C_Q2} match={q2}
          slotA={{ name: q2?.teamA?.name, placeholder: lbl(q2, 'A') }}
          slotB={{ name: q2?.teamB?.name, placeholder: lbl(q2, 'B') }}
          onPress={tap(q2)} onEditA={editFn(q2, 'A')} onEditB={editFn(q2, 'B')}
        />
        <Node
          x={finalx} y={finaly} w={NODE_W} h={NODE_H}
          label="FINAL" headerColor={C_FINAL} match={final}
          slotA={{ name: final?.teamA?.name, placeholder: lbl(final, 'A') }}
          slotB={{ name: final?.teamB?.name, placeholder: lbl(final, 'B') }}
          onPress={tap(final)} onEditA={editFn(final, 'A')} onEditB={editFn(final, 'B')}
        />
      </View>

      <Text style={styles.hint}>
        Tap a header to {isOwner ? 'start/view' : 'view'}{isOwner ? ' · tap a team to set it' : ''}.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingTop: 4, paddingBottom: 8 },

  legend: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  legendDot: { width: 9, height: 9, borderRadius: 5, marginRight: 5 },
  legendText: { fontSize: 11, fontWeight: '700', color: '#64748b' },

  node: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1, borderColor: '#e8edf3',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 6,
    elevation: 3,
  },
  nodeHeader: {
    height: 24, paddingHorizontal: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  nodeHeaderText: {
    color: '#fff', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff',
    position: 'absolute', right: 7,
  },

  nodeBody: { flex: 1, paddingHorizontal: 7, justifyContent: 'center' },
  slot: { flexDirection: 'row', alignItems: 'center', height: 28 },
  slotDot: {
    width: 20, height: 20, borderRadius: 6,
    justifyContent: 'center', alignItems: 'center', marginRight: 6,
  },
  slotDotText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  slotName: { flex: 1, fontSize: 12, fontWeight: '700', color: '#1e293b' },
  slotNamePlaceholder: { color: '#94a3b8', fontWeight: '600', fontStyle: 'italic', fontSize: 11 },
  slotNameWin: { color: '#059669', fontWeight: '900' },
  slotEdit: { fontSize: 11, color: '#94a3b8', marginLeft: 2 },
  slotSep: { height: 1, backgroundColor: '#f1f5f9' },

  winCheck: { width: 14, height: 14, marginLeft: 2, position: 'relative' },
  winCheckA: {
    position: 'absolute', left: 2, top: 7, width: 5, height: 2,
    backgroundColor: '#059669', borderRadius: 1, transform: [{ rotate: '45deg' }],
  },
  winCheckB: {
    position: 'absolute', left: 4, top: 5, width: 9, height: 2,
    backgroundColor: '#059669', borderRadius: 1, transform: [{ rotate: '-50deg' }],
  },

  hint: { textAlign: 'center', fontSize: 11.5, color: '#94a3b8', marginTop: 8, fontWeight: '600' },
});

export default QualifierBracket;
