import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  TouchableWithoutFeedback, ActivityIndicator,
} from 'react-native';

// Modal to manually place a team into a bracket slot (owner only). Lists the
// tournament's teams, plus a "Clear" option to reset the slot to TBD. For a
// not-yet-qualified league-playoff entry slot it also offers group positions
// (A1, B2, …) so the owner can re-wire which qualifier feeds the slot.
//   visible, onClose
//   slotLabel        e.g. "Group A 1st" / "Winner of Match 3" (shown as subtitle)
//   teams            array of team names to choose from
//   currentName      the team currently in the slot (highlighted), or 'TBD'
//   onPick(name)     async; name '' means clear to TBD. Should resolve when done.
//   sources          [{ key:'A1', label:'Group A 1st' }] group positions (optional)
//   currentSource    the source key currently feeding the slot (highlighted)
//   onPickSource(key) async; key '' clears the source. Resolves when done.
const BracketTeamPicker = ({
  visible, onClose, slotLabel, teams = [], currentName, onPick,
  sources = [], currentSource = null, onPickSource,
}) => {
  const [busy, setBusy] = useState('');

  const pick = async (name) => {
    if (busy) return;
    setBusy(name || '__clear__');
    try {
      await onPick(name);
    } finally {
      setBusy('');
    }
  };

  const pickSource = async (key) => {
    if (busy || !onPickSource) return;
    setBusy(`src:${key}`);
    try {
      await onPickSource(key);
    } finally {
      setBusy('');
    }
  };

  const hasSources = sources && sources.length > 0 && !!onPickSource;
  const known = currentName && currentName !== 'TBD';

  // Always show the team currently in the slot, even if the caller's list has
  // been narrowed (e.g. to qualified teams only) and doesn't include it — so a
  // manual pick can never make the current team disappear from the picker.
  const list = known && !teams.includes(currentName) ? [currentName, ...teams] : teams;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.card}>
              <Text style={styles.title}>{hasSources ? 'Set slot' : 'Set team'}</Text>
              {slotLabel ? <Text style={styles.subtitle} numberOfLines={1}>{slotLabel}</Text> : null}

              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {hasSources ? (
                  <>
                    <Text style={styles.sectionLabel}>By group position</Text>
                    {sources.map((s) => {
                      const active = s.key === currentSource;
                      const loading = busy === `src:${s.key}`;
                      return (
                        <TouchableOpacity
                          key={`src_${s.key}`}
                          style={[styles.item, active && styles.itemActive]}
                          onPress={() => pickSource(s.key)}
                          disabled={!!busy}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.itemText, active && styles.itemTextActive]} numberOfLines={1}>{s.label}</Text>
                          {loading ? <ActivityIndicator size="small" color="#2563eb" />
                            : active ? <Text style={styles.check}>✓</Text> : null}
                        </TouchableOpacity>
                      );
                    })}
                    {list.length ? <Text style={styles.sectionLabel}>Or set a specific team</Text> : null}
                  </>
                ) : null}
                {list.map((name) => {
                  const active = name === currentName;
                  const loading = busy === name;
                  return (
                    <TouchableOpacity
                      key={name}
                      style={[styles.item, active && styles.itemActive]}
                      onPress={() => pick(name)}
                      disabled={!!busy}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.itemText, active && styles.itemTextActive]} numberOfLines={1}>{name}</Text>
                      {loading ? <ActivityIndicator size="small" color="#2563eb" />
                        : active ? <Text style={styles.check}>✓</Text> : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {known ? (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => pick('')}
                  disabled={!!busy}
                  activeOpacity={0.8}
                >
                  {busy === '__clear__'
                    ? <ActivityIndicator size="small" color="#dc2626" />
                    : <Text style={styles.clearText}>Clear (back to TBD)</Text>}
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity style={styles.cancel} onPress={onClose} disabled={!!busy} activeOpacity={0.7}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 26,
  },
  card: {
    width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 22, padding: 20,
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 28, elevation: 14,
  },
  title: { fontSize: 12, fontWeight: '800', color: '#94a3b8', textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase' },
  subtitle: { fontSize: 15, fontWeight: '800', color: '#1e293b', textAlign: 'center', marginTop: 4, marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 2 },
  list: { maxHeight: 340 },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 50, paddingHorizontal: 16, borderRadius: 13, backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#eef2f7', marginBottom: 8,
  },
  itemActive: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  itemText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  itemTextActive: { color: '#1d4ed8', fontWeight: '900' },
  check: { fontSize: 16, fontWeight: '900', color: '#2563eb' },
  clearBtn: {
    height: 46, borderRadius: 12, marginTop: 4,
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
    justifyContent: 'center', alignItems: 'center',
  },
  clearText: { fontSize: 14, fontWeight: '800', color: '#dc2626' },
  cancel: { height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 6 },
  cancelText: { fontSize: 15, fontWeight: '800', color: '#64748b' },
});

export default BracketTeamPicker;
