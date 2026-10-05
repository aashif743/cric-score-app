import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert, Dimensions } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import ShareableSchedule from './ShareableSchedule';
import { slotSourceLabel, knockoutGameNumbers } from '../utils/bracketLabels';

// ---- stage accent colors ----
const BLUE = '#2563eb';   // league
const AMBER = '#d97706';  // knockout rounds / 2nd round
const PURPLE = '#7c3aed'; // playoffs / semis
const GOLD = '#ca8a04';   // final

const winnerOf = (m) => {
  if (m.status !== 'completed') return null;
  if (m.matchSummary?.winner) return m.matchSummary.winner;
  const idx = m.result ? m.result.indexOf(' won by ') : -1;
  return idx > 0 ? m.result.slice(0, idx) : null;
};
const koLabel = (round, numRounds) => {
  if (round >= numRounds) return 'FINAL';
  if (round === numRounds - 1) return 'SEMIFINAL';
  if (round === numRounds - 2) return 'QUARTERFINAL';
  return `ROUND ${round}`;
};
// Short stage code shown in the left column for a knockout/playoff row.
const koShort = (matchLabel) => {
  const map = { 'Qualifier 1': 'Q1', 'Qualifier 2': 'Q2', 'Eliminator': 'ELIM', 'Final': 'FINAL' };
  if (map[matchLabel]) return map[matchLabel];
  let m = matchLabel && matchLabel.match(/^Knockout (\d+)$/i); if (m) return `KO${m[1]}`;
  m = matchLabel && matchLabel.match(/^Match (\d+)$/i); if (m) return `M${m[1]}`;
  return matchLabel || '';
};
const koRowLabel = (roundText, idx, countInRound) => {
  if (roundText === 'FINAL') return 'FINAL';
  const base = roundText === 'SEMIFINAL' ? 'SF' : roundText === 'QUARTERFINAL' ? 'QF' : roundText.replace('ROUND ', 'R');
  return countInRound > 1 ? `${base}${idx + 1}` : base;
};
const koAccent = (r, numRounds) => (r >= numRounds ? GOLD : (r === numRounds - 1 ? PURPLE : AMBER));
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
// A row carries its own accent; `strong` rows (semis/final/playoffs) are
// highlighted so they stand out at the foot of the schedule. `info` optionally
// supplies resolved team names for still-TBD knockout slots.
const mk = (m, label, accent, strong, info) => ({ match: m, label, accent, strong: !!strong, ...(info || {}) });

// Resolve the two slots of a knockout/qualifier match for display: a real team
// name if known, else the SOURCE label the app shows ("Group A 1st", "Winner of
// Match 2", "Q1 Loser", …) so the schedule reads properly before teams are set.
const resolveSlots = (m, koMatches, gameNoMap) => {
  const aRaw = (m.teamA?.name || '').trim();
  const bRaw = (m.teamB?.name || '').trim();
  const aTBD = !aRaw || aRaw === 'TBD';
  const bTBD = !bRaw || bRaw === 'TBD';
  return {
    aName: aTBD ? slotSourceLabel(m, 'A', koMatches, gameNoMap) : aRaw,
    bName: bTBD ? slotSourceLabel(m, 'B', koMatches, gameNoMap) : bRaw,
    aTBD, bTBD,
  };
};

// Build ONE continuous, properly-ordered fixture list (no group-wise sections).
// Group matches are interleaved across groups round-by-round — so it reads like
// a real fixture list (A v B, C v D, A v C, …) rather than every Group A game
// first. Knockouts/playoffs follow, labelled by stage. Returns a single section
// with no title so the poster renders a clean flat schedule.
function buildSections(tournament, matches) {
  const fmt = tournament?.format;
  // Anything that isn't an explicit knockout counts as a group/league fixture,
  // so no match is ever dropped from the schedule.
  const groupMatches = matches.filter((m) => m.stage !== 'knockout');
  const knockoutMatches = matches.filter((m) => m.stage === 'knockout');
  const rows = [];

  // Pure knockout tournament (no league stage) — list rounds in order.
  if ((fmt === 'knockout' && groupMatches.length === 0) || groupMatches.length === 0) {
    const gameNoMap = knockoutGameNumbers(matches);
    const byRound = {};
    matches.forEach((m) => { const r = m.round || 1; (byRound[r] = byRound[r] || []).push(m); });
    const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
    const numRounds = rounds.length ? Math.max(...rounds) : 0;
    rounds.forEach((r) => {
      const list = byRound[r].sort((a, b) => (a.bracketSlot || 0) - (b.bracketSlot || 0));
      const rText = koLabel(r, numRounds);
      const acc = koAccent(r, numRounds);
      list.forEach((m, i) => rows.push(mk(m, m.matchLabel ? koShort(m.matchLabel) : koRowLabel(rText, i, list.length), acc, acc === GOLD || acc === PURPLE, resolveSlots(m, matches, gameNoMap))));
    });
    return [{ title: null, accent: BLUE, rows }];
  }

  // ── Group / league stage: interleave across groups, round by round ──
  const groupsPresent = [...new Set(groupMatches.map((m) => m.group).filter(Boolean))].sort();
  const groupKeys = groupsPresent.length ? groupsPresent : ['-'];
  const byGR = {};
  let maxRound = 1;
  groupMatches.forEach((m) => {
    const g = m.group || '-';
    const r = m.round || 1;
    (byGR[`${g}#${r}`] = byGR[`${g}#${r}`] || []).push(m);
    if (r > maxRound) maxRound = r;
  });
  let matchNo = 0;
  for (let r = 1; r <= maxRound; r++) {
    const perGroup = groupKeys.map((g) => byGR[`${g}#${r}`] || []);
    const widest = Math.max(0, ...perGroup.map((l) => l.length));
    for (let i = 0; i < widest; i++) {
      for (const list of perGroup) {
        if (list[i]) { matchNo += 1; rows.push(mk(list[i], pad2(matchNo), BLUE, false)); }
      }
    }
  }

  // ── Knockouts / playoffs (always after the group stage) ──
  if (knockoutMatches.length) {
    const gameNoMap = knockoutGameNumbers(knockoutMatches);
    const rs = (m) => resolveSlots(m, knockoutMatches, gameNoMap);
    const isQualifier = tournament?.playoffFormat === 'qualifier';
    if (isQualifier) {
      const secondRound = knockoutMatches
        .filter((m) => typeof m.matchLabel === 'string' && m.matchLabel.startsWith('Knockout'))
        .sort((a, b) => (a.round || 0) - (b.round || 0) || (a.bracketSlot || 0) - (b.bracketSlot || 0));
      secondRound.forEach((m) => { matchNo += 1; rows.push(mk(m, pad2(matchNo), AMBER, false, rs(m))); });
      const order = ['Qualifier 1', 'Eliminator', 'Qualifier 2', 'Final'];
      order.map((lbl) => knockoutMatches.find((m) => m.matchLabel === lbl)).filter(Boolean)
        .forEach((m) => rows.push(mk(m, koShort(m.matchLabel), m.matchLabel === 'Final' ? GOLD : PURPLE, true, rs(m))));
    } else {
      const numKo = Math.max(...knockoutMatches.map((m) => m.round || 0));
      const byRound = {};
      knockoutMatches.forEach((m) => { const r = m.round || 1; (byRound[r] = byRound[r] || []).push(m); });
      Object.keys(byRound).map(Number).sort((a, b) => a - b).forEach((r) => {
        const list = byRound[r].sort((a, b) => (a.bracketSlot || 0) - (b.bracketSlot || 0));
        const rText = koLabel(r, numKo);
        const acc = koAccent(r, numKo);
        list.forEach((m, i) => rows.push(mk(m, m.matchLabel ? koShort(m.matchLabel) : koRowLabel(rText, i, list.length), acc, acc === GOLD || acc === PURPLE, rs(m))));
      });
    }
  }
  return [{ title: null, accent: BLUE, rows }];
}

export default function ScheduleShareButton({ tournament, matches = [], style }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null); // 'saveImg' | 'shareImg' | 'pdf' | null
  const [cardSize, setCardSize] = useState({ w: 400, h: 560 });
  const shareRef = useRef(null);

  const sections = useMemo(() => buildSections(tournament, matches || []), [tournament, matches]);
  const subtitle = useMemo(() => {
    const teams = tournament?.teamNames?.length || 0;
    return [
      teams ? `${teams} teams` : null,
      `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`,
      tournament?.venue || null,
    ].filter(Boolean).join('   •   ');
  }, [matches.length, tournament]);
  // Team crests (name → logo URL) for the fixture rows, if the tournament has them.
  const logos = useMemo(() => {
    const tl = tournament?.teamLogos;
    if (!tl || typeof tl !== 'object') return {};
    return { ...tl };
  }, [tournament]);

  const onCardLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    if (width && height) setCardSize({ w: width, h: height });
  };

  const captureTmp = async () => {
    const node = shareRef.current;
    if (!node) return null;
    return await captureRef(node, { format: 'png', quality: 1 });
  };

  const doSaveImage = async () => {
    if (busy) return;
    try {
      setBusy('saveImg');
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to save the schedule to your gallery.'); return; }
      await new Promise((r) => setTimeout(r, 650));
      const uri = await captureTmp();
      if (!uri) { Alert.alert('Error', 'Could not create the image.'); return; }
      await MediaLibrary.saveToLibraryAsync(uri);
      setOpen(false);
      Alert.alert('Saved', 'Schedule image saved to your gallery.');
    } catch (e) { Alert.alert('Error', 'Could not save the image. Please try again.'); }
    finally { setBusy(null); }
  };

  const doShareImage = async () => {
    if (busy) return;
    try {
      setBusy('shareImg');
      const ok = await Sharing.isAvailableAsync();
      if (!ok) { Alert.alert('Unavailable', 'Sharing is not available on this device.'); return; }
      await new Promise((r) => setTimeout(r, 650));
      const uri = await captureTmp();
      if (!uri) { Alert.alert('Error', 'Could not create the image.'); return; }
      setOpen(false);
      await new Promise((r) => setTimeout(r, 120));
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share Schedule', UTI: 'public.png' });
    } catch (e) {
      const msg = String(e?.message || '');
      if (!/cancel|did not share/i.test(msg)) Alert.alert('Error', 'Could not share the image. Please try again.');
    } finally { setBusy(null); }
  };

  const doSharePdf = async () => {
    if (busy) return;
    try {
      setBusy('pdf');
      const ok = await Sharing.isAvailableAsync();
      if (!ok) { Alert.alert('Unavailable', 'Sharing is not available on this device.'); return; }
      await new Promise((r) => setTimeout(r, 650));
      const node = shareRef.current;
      const b64 = await captureRef(node, { format: 'png', quality: 1, result: 'base64' });
      if (!b64) { Alert.alert('Error', 'Could not create the PDF.'); return; }
      const Print = require('expo-print'); // lazy — avoids load-time native dependency
      // Single continuous page sized to the card's aspect ratio (no row cutting).
      const ratio = cardSize.h && cardSize.w ? cardSize.h / cardSize.w : 1.4;
      const pageW = 595; // A4 width in points
      const pageH = Math.round(pageW * ratio);
      const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>*{margin:0;padding:0;}@page{margin:0;}</style></head><body><img src="data:image/png;base64,${b64}" style="width:100%;display:block;"/></body></html>`;
      const { uri } = await Print.printToFileAsync({ html, width: pageW, height: pageH });
      setOpen(false);
      await new Promise((r) => setTimeout(r, 120));
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Schedule (PDF)', UTI: 'com.adobe.pdf' });
    } catch (e) {
      const msg = String(e?.message || '');
      if (!/cancel|did not share/i.test(msg)) Alert.alert('Error', 'Could not create the PDF. Please try again.');
    } finally { setBusy(null); }
  };

  const previewMaxH = Math.round(Dimensions.get('window').height * 0.52);

  return (
    <>
      <TouchableOpacity style={[styles.shareBtn, style]} onPress={() => setOpen(true)} activeOpacity={0.85} disabled={!matches.length}>
        <Text style={styles.shareBtnIcon}>⤴</Text>
        <Text style={styles.shareBtnText}>Share Schedule</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => !busy && setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.head}>
              <Text style={styles.title}>Share Full Schedule</Text>
              <TouchableOpacity onPress={() => !busy && setOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={[styles.previewScroll, { maxHeight: previewMaxH }]} contentContainerStyle={styles.previewContent} showsVerticalScrollIndicator={false}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'flex-start' }}>
                <ViewShot ref={shareRef} options={{ format: 'png', quality: 1 }}>
                  <ShareableSchedule tournamentName={tournament?.name} subtitle={subtitle} sections={sections} logos={logos} onLayout={onCardLayout} />
                </ViewShot>
              </ScrollView>
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.actionBtn, styles.saveBtn]} onPress={doSaveImage} disabled={!!busy} activeOpacity={0.85}>
                {busy === 'saveImg' ? <ActivityIndicator size="small" color="#1d4ed8" /> : <Text style={styles.saveText}>Save Image</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.pdfBtn]} onPress={doSharePdf} disabled={!!busy} activeOpacity={0.85}>
                {busy === 'pdf' ? <ActivityIndicator size="small" color="#b45309" /> : <Text style={styles.pdfText}>PDF</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]} onPress={doShareImage} disabled={!!busy} activeOpacity={0.85}>
                {busy === 'shareImg' ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryText}>Share Image</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: '#2563eb', borderRadius: 999, paddingHorizontal: 16, height: 40,
    shadowColor: '#1e40af', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 6, elevation: 3,
  },
  shareBtnIcon: { color: '#fff', fontSize: 15, fontWeight: '900', marginTop: -2 },
  shareBtnText: { color: '#fff', fontSize: 13.5, fontWeight: '800', letterSpacing: 0.3 },

  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#f8fafc', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '900', color: '#0f172a' },
  close: { fontSize: 18, fontWeight: '800', color: '#94a3b8' },

  previewScroll: { backgroundColor: '#e2e8f0', borderRadius: 18 },
  previewContent: { padding: 16, alignItems: 'center' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { backgroundColor: '#dbeafe' },
  saveText: { color: '#1d4ed8', fontSize: 14, fontWeight: '800' },
  pdfBtn: { backgroundColor: '#fef3c7', flex: 0.7 },
  pdfText: { color: '#b45309', fontSize: 14, fontWeight: '800' },
  primaryBtn: { backgroundColor: '#2563eb' },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
