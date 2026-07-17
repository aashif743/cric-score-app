import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Easing } from 'react-native';
import { computeGroupStandings, formatNRR } from '../utils/leagueStandings';

const groupLetter = (i) => String.fromCharCode(65 + i);

// Compact team name for the standings. Short names show in full; a very long
// name keeps its first word and abbreviates the rest to initials
// (e.g. "Royal Challengers Bangalore" -> "Royal CB"), so the column stays tidy
// without hiding which team it is. A single very long word is truncated.
const displayName = (raw) => {
  const n = (raw || '').trim();
  if (n.length <= 12) return n;
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length === 1) return `${n.slice(0, 11)}…`;
  const first = words[0];
  const rest = words.slice(1).map((w) => w.charAt(0).toUpperCase()).join('');
  const out = `${first} ${rest}`;
  return out.length <= 15 ? out : `${first.slice(0, 12)}…`;
};

// Column flex weights. Wide Team col, compact numeric cols, wider NRR col.
const COL = {
  rank: 32,        // fixed px
  team: 2.4,       // flex
  num: 0.75,       // flex
  nrr: 1.2,        // flex
};

const HeaderRow = () => (
  <View style={styles.headerRow}>
    <View style={{ width: COL.rank }} />
    <Text style={[styles.headerCell, { flex: COL.team, textAlign: 'left' }]}>Team</Text>
    <Text style={[styles.headerCell, { flex: COL.num }]}>P</Text>
    <Text style={[styles.headerCell, { flex: COL.num }]}>W</Text>
    <Text style={[styles.headerCell, { flex: COL.num }]}>L</Text>
    <Text style={[styles.headerCell, { flex: COL.num }]}>NR</Text>
    <Text style={[styles.headerCell, { flex: COL.num }]}>Pts</Text>
    <Text style={[styles.headerCell, { flex: COL.nrr }]}>NRR</Text>
  </View>
);

const TableRow = ({ row, rank, qualified, eliminated, isQualifyingSlot, isLastQualifyingSlot, index }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 240, delay: index * 35,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0, duration: 240, delay: index * 35,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.row,
        isQualifyingSlot && styles.rowQualifying,
        isLastQualifyingSlot && styles.rowQualifyingCutoff,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <View style={[styles.rankCol, { width: COL.rank }]}>
        <Text style={styles.rankText}>{rank}</Text>
      </View>

      <View style={[styles.teamCol, { flex: COL.team }]}>
        <Text style={styles.teamCode} numberOfLines={1}>{displayName(row.team)}</Text>
        {qualified && <Text style={styles.qSuffix}>(Q)</Text>}
        {eliminated && <Text style={styles.eSuffix}>(E)</Text>}
      </View>

      <Text style={[styles.numCell, { flex: COL.num }]}>{row.played}</Text>
      <Text style={[styles.numCell, { flex: COL.num }]}>{row.won}</Text>
      <Text style={[styles.numCell, { flex: COL.num }]}>{row.lost}</Text>
      <Text style={[styles.numCell, { flex: COL.num }]}>{row.tied}</Text>
      <Text style={[styles.numCell, styles.ptsCell, { flex: COL.num }]}>{row.points}</Text>
      <Text
        style={[
          styles.numCell, { flex: COL.nrr },
          row.nrr > 0 && styles.nrrPositive,
          row.nrr < 0 && styles.nrrNegative,
        ]}
      >
        {formatNRR(row.nrr)}
      </Text>
    </Animated.View>
  );
};

/**
 * Points-table body for a league tournament. Pure render from the already
 * fetched tournament object (no network) so it can be used as an instant tab.
 */
const PointsTableView = ({ tournament }) => {
  const [activeGroup, setActiveGroup] = useState(0);

  const groups = tournament?.groups || [];
  const matches = tournament?.matches || [];
  const advance = tournament?.teamsAdvancePerGroup || 0;

  const standingsByGroup = useMemo(
    () => groups.map((teams, gIdx) => {
      const letter = groupLetter(gIdx);
      const gm = matches.filter((m) => m.stage === 'group' && m.group === letter);
      return computeGroupStandings(gm, teams);
    }),
    [groups, matches],
  );

  const activeGroupComplete = useMemo(() => {
    const letter = groupLetter(activeGroup);
    const gm = matches.filter((m) => m.stage === 'group' && m.group === letter);
    return gm.length > 0 && gm.every((m) => m.status === 'completed' || m.status === 'abandoned');
  }, [matches, activeGroup]);

  const activeStandings = standingsByGroup[activeGroup] || [];
  const showQE = advance > 0 && activeGroupComplete;

  return (
    <>
      {/* Group tabs */}
      {groups.length > 1 && (
        <View style={styles.tabStripWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabStrip}
          >
            {groups.map((_, i) => {
              const isActive = activeGroup === i;
              return (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.7}
                  onPress={() => setActiveGroup(i)}
                  style={[styles.tab, isActive && styles.tabActive]}
                >
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
                    Group {groupLetter(i)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* The table itself — column header + rows in a card */}
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tableCard}>
          <HeaderRow />
          {activeStandings.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No standings yet</Text>
              <Text style={styles.emptyText}>Play some group matches to populate the table.</Text>
            </View>
          ) : (
            activeStandings.map((row, idx) => {
              const rank = idx + 1;
              const isQualifyingSlot = advance > 0 && rank <= advance;
              const isLastQualifyingSlot = advance > 0 && rank === advance;
              return (
                <TableRow
                  key={row.team}
                  row={row}
                  rank={rank}
                  index={idx}
                  qualified={showQE && rank <= advance}
                  eliminated={showQE && rank > advance}
                  isQualifyingSlot={isQualifyingSlot}
                  isLastQualifyingSlot={isLastQualifyingSlot}
                />
              );
            })
          )}
        </View>

        {advance > 0 && (
          <View style={styles.qualifyNote}>
            <View style={styles.qualifyDot} />
            <Text style={styles.qualifyText}>
              Top {advance} {advance === 1 ? 'team' : 'teams'} will qualify for next round
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  tabStripWrap: { height: 60, paddingTop: 8 },
  tabStrip: {
    paddingHorizontal: 16, paddingVertical: 6,
    gap: 8, alignItems: 'center',
  },
  tab: {
    minWidth: 92, height: 40,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#e2e8f0',
    justifyContent: 'center', alignItems: 'center',
  },
  tabActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  tabTextActive: { color: '#2563eb', fontWeight: '800' },

  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },

  tableCard: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },

  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 10, paddingHorizontal: 12,
  },
  headerCell: {
    fontSize: 11, fontWeight: '800', color: '#64748b',
    letterSpacing: 0.5, textTransform: 'uppercase',
    textAlign: 'center',
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  rowQualifying: { backgroundColor: '#eff6ff' },
  rowQualifyingCutoff: { borderBottomWidth: 1, borderBottomColor: '#93c5fd' },

  rankCol: { alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 13, fontWeight: '700', color: '#475569', fontVariant: ['tabular-nums'] },

  teamCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamCode: { fontSize: 14, fontWeight: '800', color: '#0f172a', letterSpacing: 0.2 },
  qSuffix: { fontSize: 11, fontWeight: '700', color: '#059669', marginLeft: 2 },
  eSuffix: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginLeft: 2 },

  numCell: {
    fontSize: 13, fontWeight: '600', color: '#0f172a',
    textAlign: 'center', fontVariant: ['tabular-nums'],
  },
  ptsCell: { fontWeight: '900' },
  nrrPositive: { color: '#059669', fontWeight: '700' },
  nrrNegative: { color: '#dc2626', fontWeight: '700' },

  qualifyNote: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 14,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  qualifyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb' },
  qualifyText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1e40af' },

  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#94a3b8', marginBottom: 6 },
  emptyText: { fontSize: 12, color: '#cbd5e1', textAlign: 'center' },
});

export default PointsTableView;
