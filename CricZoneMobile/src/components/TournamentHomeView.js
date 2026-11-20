import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Animated } from 'react-native';
import { TeamCrest } from './LogoPicker';
import TeamDetailSheet from './TeamDetailSheet';
import { computeGroupStandings, formatNRR } from '../utils/leagueStandings';

const groupLetter = (i) => String.fromCharCode(65 + i);
const FORMAT_LABEL = { league: 'League', knockout: 'Knockout', quick: 'Quick' };

// A section that fades + slides up on mount (built-in Animated — no extra deps).
const AnimatedIn = ({ delay = 0, style, children }) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay, useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
};

// The tournament "Home" — a clean summary hub: hero, progress, live/next match,
// a standings preview, and a tappable teams grid (tap → edit name/logo/players).
// Rendered inside the league schedule screen as the default tab.
//
// Props: { tournament, isOwner, token, onChanged, onGoToTab, refreshing, onRefresh }
const TournamentHomeView = ({ tournament, isOwner = false, token, onChanged, onGoToTab, refreshing, onRefresh }) => {
  const [selectedTeam, setSelectedTeam] = useState(null);

  const matches = tournament?.matches || [];
  const groups = tournament?.groups || [];
  const teamNames = tournament?.teamNames || [];
  const teamLogos = tournament?.teamLogos || {};
  const official = tournament?.nrrRule === 'official';

  // Per-group standings → a teamName → row lookup + a combined top list.
  const { byTeam, ranked } = useMemo(() => {
    const map = {};
    const all = [];
    groups.forEach((teams, gi) => {
      const gm = matches.filter((m) => m.stage === 'group' && m.group === groupLetter(gi));
      const rows = computeGroupStandings(gm, teams, { official });
      rows.forEach((r) => { map[r.team] = r; all.push(r); });
    });
    all.sort((a, b) => (b.points - a.points) || (b.nrr - a.nrr));
    return { byTeam: map, ranked: all };
  }, [groups, matches, official]);

  const total = matches.length;
  const completed = matches.filter((m) => m.status === 'completed').length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const live = matches.find((m) => m.status === 'in_progress' || m.status === 'innings_break');
  const next = matches.find((m) => m.status === 'scheduled');
  const feature = live || next;

  const statusPill = tournament?.status === 'completed'
    ? { t: 'Completed', c: '#64748b', bg: '#f1f5f9' }
    : live
      ? { t: 'Live now', c: '#dc2626', bg: '#fef2f2' }
      : { t: 'In progress', c: '#2563eb', bg: '#eff6ff' };

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor="#2563eb" /> : undefined}
      >
        {/* Hero */}
        <AnimatedIn style={styles.hero}>
          <TeamCrest uri={tournament?.logoUrl} name={tournament?.name || 'T'} size={64} />
          <View style={styles.heroText}>
            <Text style={styles.heroName} numberOfLines={2}>{tournament?.name}</Text>
            <View style={styles.heroMeta}>
              <View style={[styles.pill, { backgroundColor: '#eef2ff' }]}><Text style={[styles.pillText, { color: '#4f46e5' }]}>{FORMAT_LABEL[tournament?.format] || 'Tournament'}</Text></View>
              <View style={[styles.pill, { backgroundColor: statusPill.bg }]}><Text style={[styles.pillText, { color: statusPill.c }]}>{statusPill.t}</Text></View>
            </View>
            {(tournament?.venue || tournament?.date) ? (
              <Text style={styles.heroSub} numberOfLines={1}>
                {[tournament?.venue, tournament?.date].filter(Boolean).join('  ·  ')}
              </Text>
            ) : null}
          </View>
        </AnimatedIn>

        {/* Progress */}
        <AnimatedIn delay={60} style={styles.card}>
          <View style={styles.progressTop}>
            <Text style={styles.cardLabel}>Progress</Text>
            <Text style={styles.progressCount}>{completed} / {total} matches</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <View style={styles.chipRow}>
            <Chip value={teamNames.length} label="Teams" />
            <Chip value={groups.length || 1} label={groups.length === 1 ? 'Group' : 'Groups'} />
            <Chip value={`${pct}%`} label="Done" />
          </View>
        </AnimatedIn>

        {/* Live / Next match */}
        {feature ? (
          <AnimatedIn delay={120}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => onGoToTab && onGoToTab('matches')} style={styles.card}>
              <View style={styles.matchHead}>
                <Text style={styles.cardLabel}>{live ? '🔴  Live now' : 'Next up'}</Text>
                <Text style={styles.matchLink}>Matches ›</Text>
              </View>
              <View style={styles.matchRow}>
                <TeamSide name={feature.teamA?.name} logo={teamLogos[feature.teamA?.name]} />
                <Text style={styles.vs}>vs</Text>
                <TeamSide name={feature.teamB?.name} logo={teamLogos[feature.teamB?.name]} right />
              </View>
              {feature.matchLabel ? <Text style={styles.matchLabel}>{feature.matchLabel}</Text> : null}
            </TouchableOpacity>
          </AnimatedIn>
        ) : null}

        {/* Standings preview */}
        {ranked.length > 0 ? (
          <AnimatedIn delay={160} style={styles.card}>
            <View style={styles.matchHead}>
              <Text style={styles.cardLabel}>Standings</Text>
              <TouchableOpacity onPress={() => onGoToTab && onGoToTab('points')}><Text style={styles.matchLink}>Full table ›</Text></TouchableOpacity>
            </View>
            {ranked.slice(0, 4).map((r, i) => (
              <TouchableOpacity key={r.team} style={styles.standRow} activeOpacity={0.7} onPress={() => setSelectedTeam(r.team)}>
                <Text style={styles.standRank}>{i + 1}</Text>
                <TeamCrest uri={teamLogos[r.team]} name={r.team} size={24} />
                <Text style={styles.standName} numberOfLines={1}>{r.team}</Text>
                <Text style={styles.standPld}>{r.played}</Text>
                <Text style={styles.standPts}>{r.points}</Text>
                <Text style={styles.standNrr}>{formatNRR(r.nrr)}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.standLegend}><Text style={styles.standLegendTxt}>P · Pts · NRR</Text></View>
          </AnimatedIn>
        ) : null}

        {/* Teams grid */}
        <AnimatedIn delay={200}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Teams</Text>
            {isOwner ? <Text style={styles.sectionHint}>Tap to edit</Text> : null}
          </View>
          <View style={styles.grid}>
            {teamNames.map((name, i) => {
              const rec = byTeam[name];
              return (
                <View key={name + i} style={styles.gridCell}>
                  <TouchableOpacity style={styles.teamCard} activeOpacity={0.8} onPress={() => setSelectedTeam(name)}>
                    <TeamCrest uri={teamLogos[name]} name={name} size={44} />
                    <Text style={styles.teamName} numberOfLines={1}>{name}</Text>
                    {rec ? (
                      <Text style={styles.teamRec}>{rec.won}W · {rec.lost}L</Text>
                    ) : (
                      <Text style={styles.teamRecMuted}>{(tournament?.teamSquads?.[name] || []).length} players</Text>
                    )}
                    {isOwner ? <Text style={styles.teamEdit}>✎</Text> : null}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </AnimatedIn>

        <View style={{ height: 24 }} />
      </ScrollView>

      <TeamDetailSheet
        visible={!!selectedTeam}
        teamName={selectedTeam}
        tournament={tournament}
        isOwner={isOwner}
        token={token}
        standing={selectedTeam ? byTeam[selectedTeam] : null}
        onClose={() => setSelectedTeam(null)}
        onChanged={onChanged}
      />
    </>
  );
};

const Chip = ({ value, label }) => (
  <View style={styles.chip}>
    <Text style={styles.chipValue}>{value}</Text>
    <Text style={styles.chipLabel}>{label}</Text>
  </View>
);

const TeamSide = ({ name, logo, right }) => (
  <View style={[styles.teamSide, right && { flexDirection: 'row-reverse' }]}>
    <TeamCrest uri={logo} name={name || '?'} size={38} />
    <Text style={[styles.teamSideName, right && { textAlign: 'right' }]} numberOfLines={1}>{name || 'TBD'}</Text>
  </View>
);

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 6 },

  hero: { flexDirection: 'row', gap: 14, backgroundColor: '#fff', borderRadius: 18, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#eef2f7' },
  heroText: { flex: 1, gap: 6 },
  heroName: { fontSize: 19, fontWeight: '900', color: '#0f172a' },
  heroMeta: { flexDirection: 'row', gap: 6 },
  heroSub: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7 },
  pillText: { fontSize: 11, fontWeight: '800' },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginTop: 12, borderWidth: 1, borderColor: '#eef2f7' },
  cardLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 },

  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressCount: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  progressTrack: { height: 9, borderRadius: 5, backgroundColor: '#f1f5f9', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: '#2563eb' },
  chipRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  chip: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  chipValue: { fontSize: 17, fontWeight: '900', color: '#0f172a' },
  chipLabel: { fontSize: 10.5, color: '#94a3b8', fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },

  matchHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  matchLink: { fontSize: 12, fontWeight: '800', color: '#2563eb' },
  matchRow: { flexDirection: 'row', alignItems: 'center' },
  teamSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamSideName: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0f172a' },
  vs: { fontSize: 12, fontWeight: '800', color: '#cbd5e1', paddingHorizontal: 10 },
  matchLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '700', textAlign: 'center', marginTop: 10 },

  standRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  standRank: { width: 16, fontSize: 13, fontWeight: '800', color: '#94a3b8', textAlign: 'center' },
  standName: { flex: 1, fontSize: 13.5, fontWeight: '700', color: '#0f172a' },
  standPld: { width: 22, fontSize: 12.5, color: '#64748b', textAlign: 'center', fontWeight: '700' },
  standPts: { width: 30, fontSize: 13.5, color: '#0f172a', textAlign: 'center', fontWeight: '900' },
  standNrr: { width: 52, fontSize: 11.5, color: '#64748b', textAlign: 'right', fontWeight: '700' },
  standLegend: { alignItems: 'flex-end', marginTop: 4 },
  standLegendTxt: { fontSize: 10, color: '#cbd5e1', fontWeight: '700' },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  sectionHint: { fontSize: 12, color: '#94a3b8', fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCell: { width: '31.5%' },
  teamCard: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#eef2f7' },
  teamName: { fontSize: 12.5, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  teamRec: { fontSize: 11, color: '#64748b', fontWeight: '700' },
  teamRecMuted: { fontSize: 11, color: '#cbd5e1', fontWeight: '700' },
  teamEdit: { position: 'absolute', top: 7, right: 9, fontSize: 12, color: '#c7d2fe' },
});

export default TournamentHomeView;
