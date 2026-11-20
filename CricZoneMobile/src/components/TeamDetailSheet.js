import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Pressable,
} from 'react-native';
import LogoPicker, { TeamCrest } from './LogoPicker';
import tournamentService from '../utils/tournamentService';

// Slide-up team detail + editor. Owners can change the crest, rename the team,
// and manage its squad; everyone sees the team's record and players.
//
// Props: { visible, teamName, tournament, isOwner, token, standing, onClose, onChanged }
//   standing — { played, won, lost, points, nrr } for the record chips (optional)
const TeamDetailSheet = ({ visible, teamName, tournament, isOwner = false, token, standing, onClose, onChanged }) => {
  const tournamentId = tournament?._id;
  const logo = tournament?.teamLogos?.[teamName] || '';
  const squadFromServer = useMemo(
    () => (tournament?.teamSquads?.[teamName] || []).map((p) => ({ name: p.name || '', role: p.role || '' })),
    [tournament, teamName],
  );

  const [name, setName] = useState(teamName || '');
  const [players, setPlayers] = useState(squadFromServer);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Reset local state whenever a different team is opened.
  useEffect(() => {
    setName(teamName || '');
    setPlayers(squadFromServer);
    setDirty(false);
  }, [teamName, squadFromServer, visible]);

  const addPlayer = () => { setPlayers((p) => [...p, { name: '', role: '' }]); setDirty(true); };
  const removePlayer = (i) => { setPlayers((p) => p.filter((_, idx) => idx !== i)); setDirty(true); };
  const editPlayer = (i, field, val) => {
    setPlayers((p) => p.map((pl, idx) => (idx === i ? { ...pl, [field]: val } : pl)));
    setDirty(true);
  };

  const setLogo = async (url) => {
    try {
      setBusy(true);
      await tournamentService.setTeamLogo(tournamentId, teamName, url || '', token);
      setBusy(false);
      onChanged && onChanged();
    } catch (err) {
      setBusy(false);
      Alert.alert('Logo update failed', err?.error || 'Please try again.');
    }
  };

  const saveSquad = async () => {
    const clean = players.map((p) => ({ name: p.name.trim(), role: p.role.trim() })).filter((p) => p.name);
    try {
      setBusy(true);
      await tournamentService.setTeamSquad(tournamentId, teamName, clean, token);
      // Rename last — it migrates the logo/squad keys to the new name server-side.
      const nextName = name.trim();
      if (nextName && nextName !== teamName) {
        await tournamentService.renameTeam(tournamentId, teamName, nextName, token);
      }
      setBusy(false);
      setDirty(false);
      onChanged && onChanged();
      onClose && onClose();
    } catch (err) {
      setBusy(false);
      Alert.alert('Save failed', err?.error || 'Could not save the team. Please try again.');
    }
  };

  const rec = standing || {};
  const nrr = typeof rec.nrr === 'number' ? (rec.nrr > 0 ? '+' : '') + rec.nrr.toFixed(3) : '—';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} />

        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Crest + name */}
            <View style={styles.head}>
              {isOwner ? (
                <LogoPicker value={logo} onChange={setLogo} token={token} folder="team" name={teamName} size={72} />
              ) : (
                <TeamCrest uri={logo} name={teamName} size={72} />
              )}
              {isOwner ? (
                <TextInput
                  style={styles.nameInput}
                  value={name}
                  onChangeText={(t) => { setName(t); setDirty(true); }}
                  placeholder="Team name"
                  placeholderTextColor="#94a3b8"
                  maxLength={24}
                  editable={!busy}
                />
              ) : (
                <Text style={styles.nameText} numberOfLines={1}>{teamName}</Text>
              )}
            </View>

            {/* Record chips */}
            {standing ? (
              <View style={styles.recordRow}>
                <Stat label="Played" value={rec.played ?? 0} />
                <Stat label="Won" value={rec.won ?? 0} accent="#16a34a" />
                <Stat label="Lost" value={rec.lost ?? 0} accent="#dc2626" />
                <Stat label="Points" value={rec.points ?? 0} accent="#2563eb" />
                <Stat label="NRR" value={nrr} small />
              </View>
            ) : null}

            {/* Squad */}
            <View style={styles.squadHead}>
              <Text style={styles.squadTitle}>Squad</Text>
              <Text style={styles.squadCount}>{players.filter((p) => p.name.trim()).length} players</Text>
            </View>

            {players.length === 0 ? (
              <Text style={styles.empty}>No players added yet.</Text>
            ) : (
              players.map((p, i) => (
                <View key={i} style={styles.playerRow}>
                  <View style={styles.playerNum}><Text style={styles.playerNumText}>{i + 1}</Text></View>
                  {isOwner ? (
                    <>
                      <TextInput
                        style={styles.playerNameInput}
                        value={p.name}
                        onChangeText={(t) => editPlayer(i, 'name', t)}
                        placeholder="Player name"
                        placeholderTextColor="#94a3b8"
                        editable={!busy}
                      />
                      <TextInput
                        style={styles.playerRoleInput}
                        value={p.role}
                        onChangeText={(t) => editPlayer(i, 'role', t)}
                        placeholder="Role"
                        placeholderTextColor="#cbd5e1"
                        editable={!busy}
                      />
                      <TouchableOpacity onPress={() => removePlayer(i)} style={styles.removeBtn} hitSlop={8}>
                        <Text style={styles.removeTxt}>×</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={styles.playerNameRead} numberOfLines={1}>{p.name}</Text>
                      {p.role ? <Text style={styles.playerRoleRead} numberOfLines={1}>{p.role}</Text> : null}
                    </>
                  )}
                </View>
              ))
            )}

            {isOwner ? (
              <TouchableOpacity style={styles.addBtn} onPress={addPlayer} activeOpacity={0.85}>
                <Text style={styles.addTxt}>＋  Add player</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            {isOwner ? (
              <TouchableOpacity
                style={[styles.saveBtn, (!dirty || busy) && styles.saveBtnDim]}
                onPress={saveSquad}
                disabled={!dirty || busy}
                activeOpacity={0.9}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Save changes</Text>}
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7} disabled={busy}>
              <Text style={styles.closeTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const Stat = ({ label, value, accent = '#0f172a', small }) => (
  <View style={styles.stat}>
    <Text style={[styles.statValue, small && { fontSize: 13 }, { color: accent }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 14, maxHeight: '88%',
  },
  grabber: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#e2e8f0', marginBottom: 14 },

  head: { alignItems: 'center', gap: 10, marginBottom: 14 },
  nameInput: {
    fontSize: 20, fontWeight: '800', color: '#0f172a', textAlign: 'center',
    borderBottomWidth: 1.5, borderBottomColor: '#e2e8f0', minWidth: 160, paddingVertical: 4,
  },
  nameText: { fontSize: 20, fontWeight: '800', color: '#0f172a' },

  recordRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#f8fafc', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10, marginBottom: 16,
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 17, fontWeight: '900' },
  statLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

  squadHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  squadTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  squadCount: { fontSize: 12, color: '#94a3b8', fontWeight: '700' },
  empty: { color: '#94a3b8', fontSize: 13, paddingVertical: 14, textAlign: 'center' },

  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  playerNum: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  playerNumText: { fontSize: 11, fontWeight: '800', color: '#6366f1' },
  playerNameInput: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#0f172a', fontWeight: '600' },
  playerRoleInput: { width: 86, backgroundColor: '#f8fafc', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 8, fontSize: 12, color: '#475569' },
  playerNameRead: { flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '600' },
  playerRoleRead: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  removeBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
  removeTxt: { color: '#ef4444', fontSize: 18, fontWeight: '800', marginTop: -2 },

  addBtn: { marginTop: 4, marginBottom: 6, paddingVertical: 11, borderRadius: 11, borderWidth: 1.5, borderColor: '#c7d2fe', borderStyle: 'dashed', alignItems: 'center' },
  addTxt: { color: '#4f46e5', fontWeight: '800', fontSize: 13.5 },

  footer: { flexDirection: 'row', gap: 10, paddingTop: 10 },
  saveBtn: { flex: 1, backgroundColor: '#2563eb', borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  saveBtnDim: { opacity: 0.45 },
  saveTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  closeBtn: { paddingHorizontal: 20, borderRadius: 13, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  closeTxt: { color: '#475569', fontWeight: '800', fontSize: 15 },
});

export default TeamDetailSheet;
