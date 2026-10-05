import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const criczoneLogo = require('../../assets/logo/criczone_icon.png');

// Compact team name so a two-team row stays tidy in the exported image.
const displayName = (raw) => {
  const n = (raw || '').trim() || 'TBD';
  if (n.length <= 20) return n;
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length === 1) return `${n.slice(0, 19)}…`;
  const first = words[0];
  const rest = words.slice(1).map((w) => w.charAt(0).toUpperCase()).join('');
  const out = `${first} ${rest}`;
  return out.length <= 22 ? out : `${first.slice(0, 19)}…`;
};
const initial = (name) => (name || 'T').trim().charAt(0).toUpperCase();

// hex (#rrggbb) + alpha → rgba() string, for translucent accent fills on the
// dark poster.
const hexA = (hex, a) => {
  const h = (hex || '#2563eb').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

// A team crest: real logo if we have one, else a clean lettered chip. On a
// normal row it's tinted by the accent (white letter); on a `strong` (accent-
// filled) row it's a white chip with a dark letter so it stays legible. A still-
// unknown (TBD) slot shows a dashed "?" placeholder instead.
const TeamCrest = ({ name, logo, accent, strong, tbd }) => {
  if (logo) return <Image source={{ uri: logo }} style={styles.crestImg} resizeMode="cover" />;
  if (tbd) {
    return (
      <View style={[styles.crest, styles.crestTBD, strong && { borderColor: 'rgba(255,255,255,0.7)' }]}>
        <Text style={[styles.crestTBDText, strong && { color: '#fff' }]}>?</Text>
      </View>
    );
  }
  return (
    <View style={[styles.crest, { backgroundColor: strong ? 'rgba(255,255,255,0.95)' : hexA(accent, 0.9) }]}>
      <Text style={[styles.crestText, strong && { color: '#0f172a' }]}>{initial(name)}</Text>
    </View>
  );
};

// One fixture line: match label · Team A (vs) Team B · optional venue.
// Deliberately NO scores / status / result — this is a clean fixtures poster.
// `strong` rows (semis / final / playoffs) get an accent-filled band so the
// business end of the tournament stands out.
const FixtureRow = ({ match, label, accent, alt, strong, logos, aName: aNameP, bName: bNameP, aTBD, bTBD }) => {
  // Resolved names (source labels for TBD slots) fall back to the raw match.
  const aName = aNameP != null ? aNameP : match.teamA?.name;
  const bName = bNameP != null ? bNameP : match.teamB?.name;
  const venue = (match.venue || '').trim();
  const aLogo = aTBD ? null : logos?.[aName];
  const bLogo = bTBD ? null : logos?.[bName];
  const rowStyle = strong
    ? [styles.row, styles.rowStrong, { backgroundColor: hexA(accent, 0.92) }]
    : [styles.row, alt && styles.rowAlt];
  const nameStyle = strong ? styles.teamStrong : null;
  const tbdStyle = strong ? styles.teamTBDStrong : styles.teamTBD;
  // A real team name gets compacted; a source label ("Winner of Match 2") is
  // shown as-is (never run through the initials compactor).
  const aDisp = aTBD ? aName : displayName(aName);
  const bDisp = bTBD ? bName : displayName(bName);
  return (
    <View style={rowStyle}>
      <View style={styles.labelCol}>
        {label ? (
          <Text style={[styles.labelText, { color: strong ? '#fff' : hexA(accent, 1) }]} numberOfLines={1}>{label}</Text>
        ) : null}
      </View>

      <View style={styles.teamsCol}>
        <Text style={[styles.teamA, aTBD ? tbdStyle : nameStyle]} numberOfLines={1}>{aDisp}</Text>
        <TeamCrest name={aName} logo={aLogo} accent={accent} strong={strong} tbd={aTBD} />
        <Text style={[styles.vs, strong && styles.vsStrong]}>V</Text>
        <TeamCrest name={bName} logo={bLogo} accent={accent} strong={strong} tbd={bTBD} />
        <Text style={[styles.teamB, bTBD ? tbdStyle : nameStyle]} numberOfLines={1}>{bDisp}</Text>
      </View>

      {venue ? <Text style={[styles.venue, strong && styles.venueStrong]} numberOfLines={1}>{venue}</Text> : <View style={styles.venueSpacer} />}
    </View>
  );
};

/**
 * Share-ready full-schedule poster (fixtures only — no live scores or status).
 * `sections` = [{ title, accent, rows:[{match,label}] }].
 * `logos`    = { [teamName]: uri } optional crests.
 * Rendered inside a ViewShot and captured to a high-res image / PDF.
 */
const ShareableSchedule = ({ tournamentName, subtitle, sections = [], logos = {}, onLayout }) => (
  <View style={styles.card} onLayout={onLayout}>
    <LinearGradient
      colors={['#090d26', '#141a52', '#241c7a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.poster}
    >
      {/* Decorative accent bolts (evoke the modern fixtures-poster look) */}
      <View style={styles.boltTR} pointerEvents="none" />
      <View style={styles.boltTR2} pointerEvents="none" />
      <View style={styles.boltBL} pointerEvents="none" />
      <View style={styles.boltBL2} pointerEvents="none" />

      {/* ───────── Header ───────── */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image source={criczoneLogo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandName}>CricZone</Text>
          <View style={{ flex: 1 }} />
          <View style={styles.schedulePill}><Text style={styles.schedulePillText}>SCHEDULE</Text></View>
        </View>

        <Text style={styles.fixturesTitle}>FIXTURES</Text>
        <View style={styles.titleAccent} />
        <Text style={styles.tournamentName} numberOfLines={2}>{tournamentName || 'Tournament'}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {/* ───────── Body ───────── */}
      <View style={styles.body}>
        {/* faint diagonal watermark behind the rows */}
        <Text style={styles.watermark} pointerEvents="none">CricZone</Text>

        {sections.length === 0 ? (
          <Text style={styles.empty}>No fixtures scheduled yet.</Text>
        ) : sections.map((sec, si) => (
          <View key={si} style={styles.section}>
            {sec.title ? (
              <View style={[styles.sectionBand, { backgroundColor: hexA(sec.accent, 0.22), borderLeftColor: sec.accent }]}>
                <Text style={styles.sectionTitle} numberOfLines={1}>{sec.title}</Text>
                <View style={{ flex: 1 }} />
                <View style={[styles.sectionCountPill, { backgroundColor: hexA(sec.accent, 0.9) }]}>
                  <Text style={styles.sectionCountText}>{sec.rows.length}</Text>
                </View>
              </View>
            ) : null}
            {sec.rows.map((r, ri) => (
              <FixtureRow
                key={ri}
                match={r.match}
                label={r.label}
                accent={r.accent || sec.accent}
                strong={r.strong}
                alt={ri % 2 === 1}
                logos={logos}
                aName={r.aName}
                bName={r.bName}
                aTBD={r.aTBD}
                bTBD={r.bTBD}
              />
            ))}
          </View>
        ))}
      </View>

      {/* ───────── Footer ───────── */}
      <View style={styles.footer}>
        <Image source={criczoneLogo} style={styles.footerLogo} resizeMode="contain" />
        <Text style={styles.footerText}>
          Made with <Text style={styles.footerBrand}>CricZone</Text> — Cricket Scoring App
        </Text>
      </View>
    </LinearGradient>
  </View>
);

const styles = StyleSheet.create({
  card: { width: 460, borderRadius: 24, overflow: 'hidden', backgroundColor: '#090d26' },
  poster: { width: '100%' },

  // Decorative bolts — skewed accent slivers in the corners.
  boltTR: {
    position: 'absolute', top: -30, right: 30, width: 90, height: 230,
    backgroundColor: 'rgba(236,72,153,0.22)', transform: [{ rotate: '22deg' }, { skewX: '-18deg' }],
  },
  boltTR2: {
    position: 'absolute', top: -10, right: -20, width: 46, height: 200,
    backgroundColor: 'rgba(99,102,241,0.25)', transform: [{ rotate: '22deg' }, { skewX: '-18deg' }],
  },
  boltBL: {
    position: 'absolute', bottom: 40, left: -24, width: 80, height: 210,
    backgroundColor: 'rgba(236,72,153,0.18)', transform: [{ rotate: '22deg' }, { skewX: '-18deg' }],
  },
  boltBL2: {
    position: 'absolute', bottom: 70, left: 34, width: 40, height: 170,
    backgroundColor: 'rgba(56,189,248,0.18)', transform: [{ rotate: '22deg' }, { skewX: '-18deg' }],
  },

  // Header
  header: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 30, height: 30, borderRadius: 8, marginRight: 9 },
  brandName: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  schedulePill: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  schedulePillText: { color: 'rgba(255,255,255,0.92)', fontSize: 9.5, fontWeight: '900', letterSpacing: 1.5 },
  fixturesTitle: { color: '#fff', fontSize: 44, fontWeight: '900', letterSpacing: 1, marginTop: 16, lineHeight: 48 },
  titleAccent: { width: 68, height: 5, borderRadius: 3, backgroundColor: '#ec4899', marginTop: 6 },
  tournamentName: { color: '#fff', fontSize: 19, fontWeight: '800', marginTop: 14, letterSpacing: 0.2 },
  subtitle: { color: 'rgba(199,210,254,0.85)', fontSize: 12, fontWeight: '700', marginTop: 5, letterSpacing: 0.2 },

  // Body
  body: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, position: 'relative' },
  watermark: {
    position: 'absolute', top: '34%', left: -30, right: 0,
    textAlign: 'center', color: 'rgba(255,255,255,0.045)',
    fontSize: 70, fontWeight: '900', letterSpacing: 4,
    transform: [{ rotate: '-24deg' }],
  },
  empty: { textAlign: 'center', color: 'rgba(199,210,254,0.7)', fontSize: 13, fontWeight: '600', paddingVertical: 28 },

  section: { marginBottom: 12 },
  sectionBand: {
    flexDirection: 'row', alignItems: 'center',
    borderLeftWidth: 4, borderRadius: 8,
    paddingLeft: 10, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 6,
  },
  sectionTitle: { color: '#fff', fontSize: 12.5, fontWeight: '900', letterSpacing: 0.8 },
  sectionCountPill: { minWidth: 22, height: 20, borderRadius: 999, paddingHorizontal: 7, justifyContent: 'center', alignItems: 'center' },
  sectionCountText: { color: '#fff', fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },

  // Fixture row
  row: {
    flexDirection: 'row', alignItems: 'center',
    minHeight: 38, paddingHorizontal: 8, borderRadius: 7,
  },
  rowAlt: { backgroundColor: 'rgba(255,255,255,0.05)' },
  rowStrong: { minHeight: 42, marginTop: 5, marginBottom: 2 },
  labelCol: { width: 52 },
  labelText: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.3, fontVariant: ['tabular-nums'] },
  teamsCol: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  teamA: { flex: 1, textAlign: 'right', color: '#e8ecff', fontSize: 13, fontWeight: '700', marginRight: 8 },
  teamB: { flex: 1, textAlign: 'left', color: '#e8ecff', fontSize: 13, fontWeight: '700', marginLeft: 8 },
  teamStrong: { color: '#fff', fontWeight: '900' },
  teamTBD: { color: 'rgba(199,210,254,0.78)', fontWeight: '600', fontStyle: 'italic', fontSize: 11.5 },
  teamTBDStrong: { color: 'rgba(255,255,255,0.92)', fontWeight: '700', fontStyle: 'italic', fontSize: 11.5 },
  vs: { color: 'rgba(199,210,254,0.65)', fontSize: 10, fontWeight: '900', marginHorizontal: 7, letterSpacing: 0.5 },
  vsStrong: { color: 'rgba(255,255,255,0.9)' },
  crest: { width: 22, height: 22, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  crestText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  crestTBD: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(199,210,254,0.5)', borderStyle: 'dashed' },
  crestTBDText: { color: 'rgba(199,210,254,0.85)', fontSize: 12, fontWeight: '900' },
  crestImg: { width: 22, height: 22, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)' },
  venue: { width: 64, textAlign: 'right', color: 'rgba(199,210,254,0.72)', fontSize: 10, fontWeight: '600', marginLeft: 6 },
  venueStrong: { color: 'rgba(255,255,255,0.9)' },
  venueSpacer: { width: 52 },

  // Footer
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.3)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  footerLogo: { width: 16, height: 16, marginRight: 7, borderRadius: 4 },
  footerText: { fontSize: 11, fontWeight: '600', color: 'rgba(199,210,254,0.72)' },
  footerBrand: { color: '#fff', fontWeight: '900' },
});

export default ShareableSchedule;
