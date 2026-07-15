import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Clean line-style settings gear (Feather-ish). Crisp at any size.
const SettingsIcon = ({ size = 20, color = '#475569' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Shared top navigation for a league tournament: Matches · Points Table · Stats.
 * The three pills appear on every tournament page (schedule, points table, stats)
 * so the user can switch between them; the active page's pill is highlighted.
 *
 * Props:
 *   active           'matches' | 'points' | 'stats'
 *   navigation       react-navigation object
 *   tournamentId     string
 *   tournamentName   string (needed by the Stats screen header)
 *   isOwner          bool  — when true, shows the settings gear
 *   onPressSettings  fn    — required for the gear to render
 */
const TournamentTopTabs = ({
  active,
  navigation,
  tournamentId,
  tournamentName,
  isOwner = false,
  onPressSettings,
  onSelect,
}) => {
  const go = (key) => {
    if (key === active) return;
    // Local mode: switch an in-screen tab instead of navigating to a new page.
    if (onSelect) { onSelect(key); return; }
    if (!tournamentId) return;
    if (key === 'matches') {
      navigation.navigate('LeagueSchedule', { tournamentId });
    } else if (key === 'points') {
      navigation.navigate('LeaguePointsTable', { tournamentId });
    } else if (key === 'stats') {
      // showTournamentTabs tells the (shared) Stats screen to render these
      // league tabs. Knockout tournaments open Stats without it, so they
      // don't get Matches/Points-Table pills that don't apply to them.
      navigation.navigate('TournamentStats', { tournamentId, tournamentName, showTournamentTabs: true });
    }
  };

  const Pill = ({ tabKey, label }) => {
    const isActive = active === tabKey;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => go(tabKey)}
        style={[styles.pill, isActive ? styles.pillActive : styles.pillIdle]}
      >
        <Text style={isActive ? styles.pillTextActive : styles.pillTextIdle} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.bar}>
      <Pill tabKey="matches" label="Matches" />
      <Pill tabKey="points" label="Points Table" />
      <Pill tabKey="stats" label="Stats" />
      {isOwner && onPressSettings ? (
        <TouchableOpacity activeOpacity={0.7} style={styles.settingsButton} onPress={onPressSettings}>
          <SettingsIcon size={20} color="#475569" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  pillActive: {
    backgroundColor: '#2563eb',
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 6,
    elevation: 3,
  },
  pillIdle: {
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#dbe3ee',
  },
  pillTextActive: { color: '#fff', fontSize: 13.5, fontWeight: '800', letterSpacing: 0.2 },
  pillTextIdle: { color: '#334155', fontSize: 13.5, fontWeight: '800', letterSpacing: 0.2 },

  settingsButton: {
    width: 42, height: 42, borderRadius: 11,
    borderWidth: 1.5, borderColor: '#dbe3ee',
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
});

export default TournamentTopTabs;
