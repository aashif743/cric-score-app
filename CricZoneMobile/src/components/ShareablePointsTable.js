import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatNRR } from '../utils/leagueStandings';

const criczoneLogo = require('../../assets/logo/criczone_icon.png');

// Compact team name so the table column stays tidy in the exported image.
const displayName = (raw) => {
  const n = (raw || '').trim();
  if (n.length <= 16) return n;
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length === 1) return `${n.slice(0, 15)}…`;
  const first = words[0];
  const rest = words.slice(1).map((w) => w.charAt(0).toUpperCase()).join('');
  const out = `${first} ${rest}`;
  return out.length <= 18 ? out : `${first.slice(0, 15)}…`;
};

const initial = (name) => (name || '?').trim().charAt(0).toUpperCase();

const HeaderRow = () => (
  <View style={styles.tHead}>
    <View style={{ width: 26 }} />
    <Text style={[styles.tHeadCell, { flex: 2.4, textAlign: 'left' }]}>Team</Text>
    <Text style={[styles.tHeadCell, { flex: 0.7 }]}>P</Text>
    <Text style={[styles.tHeadCell, { flex: 0.7 }]}>W</Text>
    <Text style={[styles.tHeadCell, { flex: 0.7 }]}>L</Text>
    <Text style={[styles.tHeadCell, { flex: 0.8 }]}>Pts</Text>
    <Text style={[styles.tHeadCell, { flex: 1.2 }]}>NRR</Text>
  </View>
);

const Row = ({ row, rank, qualifying, cutoff, status }) => (
  <View style={[styles.tRow, qualifying && styles.tRowQualifying, cutoff && styles.tRowCutoff]}>
    <View style={styles.rankBadge}>
      <Text style={styles.rankText}>{rank}</Text>
    </View>
    <View style={{ flex: 2.4, flexDirection: 'row', alignItems: 'center' }}>
      <View style={styles.teamDot}><Text style={styles.teamDotText}>{initial(row.team)}</Text></View>
      <Text style={styles.teamName} numberOfLines={1}>{displayName(row.team)}</Text>
      {status === 'Q' ? <Text style={styles.qTag}>Q</Text> : null}
      {status === 'E' ? <Text style={styles.eTag}>E</Text> : null}
    </View>
    <Text style={[styles.tCell, { flex: 0.7 }]}>{row.played}</Text>
    <Text style={[styles.tCell, { flex: 0.7 }]}>{row.won}</Text>
    <Text style={[styles.tCell, { flex: 0.7 }]}>{row.lost}</Text>
    <Text style={[styles.tCell, styles.tCellPts, { flex: 0.8 }]}>{row.points}</Text>
    <Text style={[styles.tCell, { flex: 1.2 }, row.nrr > 0 && styles.nrrPos, row.nrr < 0 && styles.nrrNeg]}>
      {formatNRR(row.nrr)}
    </Text>
  </View>
);

const GroupBlock = ({ group, advance, showLabel }) => (
  <View style={styles.groupBlock}>
    {showLabel ? (
      <View style={styles.groupLabelRow}>
        <View style={styles.groupLabelBar} />
        <Text style={styles.groupLabel}>Group {group.letter}</Text>
      </View>
    ) : null}
    <View style={styles.tableCard}>
      <HeaderRow />
      {group.standings.map((row, idx) => (
        <Row
          key={row.team}
          row={row}
          rank={idx + 1}
          qualifying={advance > 0 && idx < advance}
          cutoff={advance > 0 && idx + 1 === advance}
          status={group.qualStatus?.[row.team] || null}
        />
      ))}
    </View>
  </View>
);

/**
 * A polished, share-ready points-table card. Rendered inside a ViewShot and
 * captured to an image for sharing / saving. `groups` is an array of
 * { letter, standings, qualStatus }.
 */
const ShareablePointsTable = ({ tournamentName, groups = [], advance = 0, subtitle }) => (
  <View style={styles.card}>
    <LinearGradient
      colors={['#0b1220', '#15308a', '#2563eb']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <View style={styles.brandRow}>
        <Image source={criczoneLogo} style={styles.logo} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={styles.appName}>CricZone</Text>
          <Text style={styles.tagline}>Cricket Scoring App</Text>
        </View>
        <View style={styles.pill}><Text style={styles.pillText}>POINTS TABLE</Text></View>
      </View>
      <Text style={styles.tournamentName} numberOfLines={2}>{tournamentName || 'Tournament'}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </LinearGradient>

    <View style={styles.body}>
      {groups.map((g, i) => (
        <GroupBlock key={g.letter || i} group={g} advance={advance} showLabel={groups.length > 1} />
      ))}

      {advance > 0 ? (
        <View style={styles.legend}>
          <View style={styles.legendChipQual} />
          <Text style={styles.legendText}>Top {advance} qualify</Text>
          <Text style={styles.legendDot}>·</Text>
          <Text style={[styles.legendTag, { color: '#059669' }]}>Q</Text>
          <Text style={styles.legendText}>Qualified</Text>
          <Text style={styles.legendDot}>·</Text>
          <Text style={[styles.legendTag, { color: '#94a3b8' }]}>E</Text>
          <Text style={styles.legendText}>Eliminated</Text>
        </View>
      ) : null}
    </View>

    <View style={styles.footer}>
      <Image source={criczoneLogo} style={styles.footerLogo} resizeMode="contain" />
      <Text style={styles.footerText}>
        Generated with <Text style={styles.footerBrand}>CricZone</Text> — Cricket Scoring App
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: { width: 360, backgroundColor: '#fff', borderRadius: 22, overflow: 'hidden' },

  // Header
  header: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 34, height: 34, marginRight: 10, borderRadius: 8 },
  appName: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
  tagline: { color: 'rgba(255,255,255,0.72)', fontSize: 10.5, fontWeight: '600', marginTop: 1 },
  pill: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { color: '#fff', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
  tournamentName: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 14, letterSpacing: 0.2 },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', marginTop: 3 },

  body: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 },

  groupBlock: { marginBottom: 14 },
  groupLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: 2 },
  groupLabelBar: { width: 4, height: 15, borderRadius: 2, backgroundColor: '#2563eb', marginRight: 7 },
  groupLabel: { fontSize: 13, fontWeight: '900', color: '#0f172a', letterSpacing: 0.3 },

  tableCard: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#eef2f7',
  },
  tHead: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 10 },
  tHeadCell: { fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 0.4, textTransform: 'uppercase', textAlign: 'center' },

  tRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff',
  },
  tRowQualifying: { backgroundColor: '#eff6ff' },
  tRowCutoff: { borderBottomWidth: 2, borderBottomColor: '#93c5fd' },

  rankBadge: { width: 26, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 12, fontWeight: '800', color: '#475569', fontVariant: ['tabular-nums'] },

  teamDot: {
    width: 22, height: 22, borderRadius: 7, backgroundColor: '#0d3b66',
    justifyContent: 'center', alignItems: 'center', marginRight: 7,
  },
  teamDotText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  teamName: { flexShrink: 1, fontSize: 13, fontWeight: '800', color: '#0f172a' },
  qTag: { fontSize: 10, fontWeight: '900', color: '#059669', marginLeft: 5 },
  eTag: { fontSize: 10, fontWeight: '900', color: '#94a3b8', marginLeft: 5 },

  tCell: { fontSize: 12.5, fontWeight: '600', color: '#0f172a', textAlign: 'center', fontVariant: ['tabular-nums'] },
  tCellPts: { fontWeight: '900' },
  nrrPos: { color: '#059669', fontWeight: '800' },
  nrrNeg: { color: '#dc2626', fontWeight: '800' },

  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2, marginBottom: 4, paddingHorizontal: 2 },
  legendChipQual: { width: 12, height: 12, borderRadius: 3, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#93c5fd', marginRight: 5 },
  legendText: { fontSize: 10.5, fontWeight: '700', color: '#64748b' },
  legendTag: { fontSize: 11, fontWeight: '900', marginRight: 3 },
  legendDot: { fontSize: 12, fontWeight: '900', color: '#cbd5e1', marginHorizontal: 6 },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: '#0b1220',
  },
  footerLogo: { width: 16, height: 16, marginRight: 7, borderRadius: 4 },
  footerText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.72)' },
  footerBrand: { color: '#fff', fontWeight: '900' },
});

export default ShareablePointsTable;
