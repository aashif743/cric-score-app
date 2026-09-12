import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// "Update available" prompt — CricZone-branded (navy→indigo gradient header,
// a current→new version transition, gradient CTA). Shown a few seconds after
// the app opens when a newer version is on the store. When info.forceUpdate is
// true it can't be dismissed — the user must update to continue.
const UpdatePromptModal = ({ visible, info, onUpdate, onLater }) => {
  if (!info) return null;
  const force = !!info.forceUpdate;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={force ? () => {} : onLater}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Branded gradient header */}
          <LinearGradient
            colors={['#1e1b4b', '#312e81', '#4338ca']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.decorLg} />
            <View style={styles.decorSm} />
            <View style={styles.badge}>
              <View style={styles.arrowUp} />
              <View style={styles.arrowStem} />
            </View>
            <Text style={styles.kicker}>NEW VERSION AVAILABLE</Text>
          </LinearGradient>

          {/* Body */}
          <View style={styles.body}>
            <Text style={styles.title}>Time to update CricZone</Text>

            {/* current → new version transition */}
            <View style={styles.versionRow}>
              <View style={styles.verPill}>
                <Text style={styles.verPillLabel}>YOURS</Text>
                <Text style={styles.verPillValue}>{info.currentVersion}</Text>
              </View>
              <View style={styles.verArrow} />
              <View style={[styles.verPill, styles.verPillNew]}>
                <Text style={[styles.verPillLabel, styles.verPillLabelNew]}>LATEST</Text>
                <Text style={[styles.verPillValue, styles.verPillValueNew]}>{info.latestVersion}</Text>
              </View>
            </View>

            {info.releaseNotes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>WHAT'S NEW</Text>
                <Text style={styles.notes}>{info.releaseNotes}</Text>
              </View>
            ) : null}

            <TouchableOpacity onPress={onUpdate} activeOpacity={0.9} style={styles.updateShadow}>
              <LinearGradient
                colors={['#4f46e5', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.updateBtn}
              >
                <Text style={styles.updateText}>Update Now</Text>
              </LinearGradient>
            </TouchableOpacity>

            {force ? (
              <Text style={styles.forceHint}>This update is required to continue.</Text>
            ) : (
              <TouchableOpacity style={styles.laterBtn} onPress={onLater} activeOpacity={0.7}>
                <Text style={styles.laterText}>Maybe later</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 12,
  },

  // Gradient header
  header: {
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: 'center',
    overflow: 'hidden',
  },
  decorLg: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  decorSm: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  badge: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  arrowUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 13,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#fff',
    marginBottom: 1,
  },
  arrowStem: { width: 6, height: 11, backgroundColor: '#fff', borderRadius: 1 },
  kicker: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.4,
  },

  // Body
  body: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 20, alignItems: 'center' },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
    marginBottom: 16,
  },

  versionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  verPill: {
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
    minWidth: 92,
  },
  verPillNew: { backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe' },
  verPillLabel: { fontSize: 9.5, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.8 },
  verPillLabelNew: { color: '#6366f1' },
  verPillValue: { fontSize: 16, fontWeight: '900', color: '#475569', marginTop: 2 },
  verPillValueNew: { color: '#4338ca' },
  verArrow: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 9,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#cbd5e1',
    marginHorizontal: 12,
  },

  notesBox: {
    alignSelf: 'stretch',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eef0f3',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 18,
  },
  notesLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  notes: { fontSize: 13, lineHeight: 19, color: '#475569' },

  updateShadow: {
    alignSelf: 'stretch',
    marginTop: 22,
    borderRadius: 15,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 5,
  },
  updateBtn: { borderRadius: 15, paddingVertical: 16, alignItems: 'center' },
  updateText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  laterBtn: { paddingVertical: 12, marginTop: 6 },
  laterText: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },
  forceHint: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
  },
});

export default UpdatePromptModal;
