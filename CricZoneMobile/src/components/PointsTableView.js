import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Easing,
  Modal, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { computeGroupStandings, formatNRR } from '../utils/leagueStandings';
import tournamentService from '../utils/tournamentService';

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

const TableRow = ({ row, rank, qualified, eliminated, isQualifyingSlot, isLastQualifyingSlot, index, onPress }) => {
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
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity
        activeOpacity={onPress ? 0.6 : 1}
        onPress={onPress}
        disabled={!onPress}
        style={[
          styles.row,
          isQualifyingSlot && styles.rowQualifying,
          isLastQualifyingSlot && styles.rowQualifyingCutoff,
        ]}
      >
        <View style={[styles.rankCol, { width: COL.rank }]}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>

        <View style={[styles.teamCol, { flex: COL.team }]}>
          <Text style={styles.teamCode} numberOfLines={1}>{displayName(row.team)}</Text>
          {qualified && <Text style={styles.qSuffix}>(Q)</Text>}
          {eliminated && <Text style={styles.eSuffix}>(E)</Text>}
          {onPress ? <Text style={styles.editHint}>✎</Text> : null}
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
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * Points-table body for a league tournament. Pure render from the already
 * fetched tournament object (no network) so it can be used as an instant tab.
 */
const PointsTableView = ({ tournament, isOwner = false, tournamentId, token, onChanged }) => {
  const [activeGroup, setActiveGroup] = useState(0);

  const groups = tournament?.groups || [];
  const matches = tournament?.matches || [];
  const advance = tournament?.teamsAdvancePerGroup || 0;

  // Owner can tap a team to rename it or swap its group. Swapping is blocked
  // once any group match has started (it would rebuild the fixtures).
  const canEdit = !!(isOwner && tournamentId && token);
  const groupStarted = useMemo(
    () => matches.some((m) => m.stage === 'group' && m.status && m.status !== 'scheduled'),
    [matches],
  );

  const [editTeam, setEditTeam] = useState(null);   // team name being edited
  const [mode, setMode] = useState('edit');          // 'edit' | 'swap'
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const openEdit = (name) => { setEditTeam(name); setMode('edit'); setRenameValue(name); };
  const closeEdit = () => { if (busy) return; setEditTeam(null); setMode('edit'); };

  // When the editor opens, focus the field and highlight the whole name so the
  // user can just start typing to replace it. selectTextOnFocus alone doesn't
  // fire reliably on iOS auto-focus, so we set the selection explicitly.
  useEffect(() => {
    if (!editTeam || mode !== 'edit') return undefined;
    const len = (renameValue || '').length;
    const t = setTimeout(() => {
      inputRef.current?.focus?.();
      inputRef.current?.setNativeProps?.({ selection: { start: 0, end: len } });
    }, 160);
    return () => clearTimeout(t);
  }, [editTeam, mode]);

  // Teams in the OTHER groups — the valid swap partners for the edited team.
  const swapCandidates = useMemo(() => {
    if (!editTeam) return [];
    const homeIdx = groups.findIndex((g) => g.includes(editTeam));
    const out = [];
    groups.forEach((g, gi) => {
      if (gi === homeIdx) return;
      g.forEach((name) => out.push({ name, group: groupLetter(gi) }));
    });
    return out;
  }, [editTeam, groups]);

  const doRename = async () => {
    const next = renameValue.trim();
    if (!next || next === editTeam) { setEditTeam(null); return; }
    try {
      setBusy(true);
      await tournamentService.renameTeam(tournamentId, editTeam, next, token);
      setBusy(false); setEditTeam(null); setMode('menu');
      onChanged && onChanged();
    } catch (err) {
      setBusy(false);
      Alert.alert('Rename failed', err?.error || 'Could not rename the team. Please try again.');
    }
  };

  const doSwap = async (partner) => {
    try {
      setBusy(true);
      await tournamentService.swapTeams(tournamentId, editTeam, partner, token);
      setBusy(false); setEditTeam(null); setMode('menu');
      onChanged && onChanged();
    } catch (err) {
      setBusy(false);
      Alert.alert('Move failed', err?.error || 'Could not move the team. Please try again.');
    }
  };

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
                  onPress={canEdit ? () => openEdit(row.team) : undefined}
                />
              );
            })
          )}
        </View>

        {canEdit ? <Text style={styles.editTip}>Tap a team to rename or move its group</Text> : null}

        {advance > 0 && (
          <View style={styles.qualifyNote}>
            <View style={styles.qualifyDot} />
            <Text style={styles.qualifyText}>
              Top {advance} {advance === 1 ? 'team' : 'teams'} will qualify for next round
            </Text>
          </View>
        )}
      </ScrollView>

      {canEdit && (
        <Modal visible={!!editTeam} transparent animationType="fade" onRequestClose={closeEdit}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <TouchableWithoutFeedback onPress={closeEdit}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>

            <View style={styles.modalCard}>
              {mode === 'edit' ? (
                <>
                  <Text style={styles.modalTitle}>Edit team</Text>

                  {/* Rename — pre-filled + selected; tap to bring up the keyboard */}
                  <View style={styles.renameRow}>
                    <TextInput
                      ref={inputRef}
                      style={styles.renameInput}
                      value={renameValue}
                      onChangeText={setRenameValue}
                      placeholder="Team name"
                      placeholderTextColor="#94a3b8"
                      maxLength={24}
                      autoFocus
                      selectTextOnFocus
                      editable={!busy}
                      returnKeyType="done"
                      onSubmitEditing={doRename}
                    />
                    <TouchableOpacity
                      style={[styles.saveBtn, busy && styles.saveBtnBusy]}
                      onPress={doRename}
                      disabled={busy}
                      activeOpacity={0.85}
                    >
                      {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
                    </TouchableOpacity>
                  </View>

                  {/* Move team to another group */}
                  {groups.length > 1 ? (
                    groupStarted ? (
                      <View style={styles.moveLocked}>
                        <Text style={styles.moveLockedText}>Moving groups is locked — matches have started</Text>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.moveBtn} onPress={() => setMode('swap')} activeOpacity={0.85}>
                        <Text style={styles.moveIcon}>⇄</Text>
                        <Text style={styles.moveBtnText}>Move to another group</Text>
                      </TouchableOpacity>
                    )
                  ) : null}

                  <TouchableOpacity style={styles.modalCancel} onPress={closeEdit} activeOpacity={0.7}>
                    <Text style={styles.modalCancelText}>Close</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle} numberOfLines={1}>Move {editTeam}</Text>
                  <Text style={styles.modalHint}>Swap with a team from another group</Text>
                  <ScrollView style={styles.swapList} keyboardShouldPersistTaps="handled">
                    {swapCandidates.map((c) => (
                      <TouchableOpacity key={c.name} style={styles.swapItem} onPress={() => doSwap(c.name)} disabled={busy} activeOpacity={0.7}>
                        <Text style={styles.swapItemName} numberOfLines={1}>{c.name}</Text>
                        <View style={styles.swapItemRight}>
                          <Text style={styles.swapItemGroup}>Group {c.group}</Text>
                          <Text style={styles.swapChevron}>›</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => setMode('edit')} disabled={busy} activeOpacity={0.7}>
                    <Text style={styles.modalCancelText}>Back</Text>
                  </TouchableOpacity>
                  {busy ? <View style={styles.swapBusy}><ActivityIndicator size="small" color="#2563eb" /></View> : null}
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
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

  editHint: { fontSize: 12, color: '#94a3b8', marginLeft: 4 },
  editTip: { textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 12, fontWeight: '600' },

  // Edit sheet
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 26,
  },
  modalCard: {
    width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 22, padding: 20,
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 28, elevation: 14,
  },
  modalTitle: {
    fontSize: 12, fontWeight: '800', color: '#94a3b8', textAlign: 'center',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14,
  },

  // Rename row: input + inline Save (stays above the keyboard)
  renameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  renameInput: {
    flex: 1, height: 54, borderWidth: 2, borderColor: '#2563eb', borderRadius: 14,
    paddingHorizontal: 16, fontSize: 17, fontWeight: '800', color: '#0f172a',
    backgroundColor: '#f8fbff',
  },
  saveBtn: {
    height: 54, minWidth: 74, paddingHorizontal: 18, borderRadius: 14,
    backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#1e40af', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  saveBtnBusy: { opacity: 0.85 },
  saveBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '900', letterSpacing: 0.3 },

  // Move team
  moveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 14, marginTop: 14,
    backgroundColor: '#eff6ff', borderWidth: 1.5, borderColor: '#bfdbfe',
  },
  moveIcon: { fontSize: 17, fontWeight: '900', color: '#2563eb' },
  moveBtnText: { fontSize: 15, fontWeight: '800', color: '#1d4ed8' },
  moveLocked: {
    marginTop: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#eef2f7',
  },
  moveLockedText: { fontSize: 12.5, fontWeight: '600', color: '#94a3b8', textAlign: 'center' },

  modalCancel: { height: 46, justifyContent: 'center', alignItems: 'center', marginTop: 6 },
  modalCancelText: { fontSize: 15, fontWeight: '800', color: '#64748b' },

  modalHint: { fontSize: 13, color: '#64748b', fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  swapList: { maxHeight: 260 },
  swapItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 52, paddingHorizontal: 16, borderRadius: 13, backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#eef2f7', marginBottom: 9,
  },
  swapItemName: { flex: 1, fontSize: 15, fontWeight: '800', color: '#0f172a' },
  swapItemRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swapItemGroup: { fontSize: 12, fontWeight: '800', color: '#2563eb' },
  swapChevron: { fontSize: 20, fontWeight: '700', color: '#cbd5e1', marginTop: -2 },
  swapBusy: { position: 'absolute', top: 16, right: 16 },
});

export default PointsTableView;
