import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const SettingsIcon = ({ size = 20, color = '#475569' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Generic in-screen tab bar for a tournament hub (knockout / quick). Purely
// presentational — the parent owns the active state and content switching.
// Matches the look of TournamentTopTabs (used by league).
//
// Props: { tabs: [{ key, label }], active, onSelect, isOwner, onPressSettings }
const TournamentTabBar = ({ tabs = [], active, onSelect, isOwner = false, onPressSettings }) => (
  <View style={styles.bar}>
    {tabs.map((t) => {
      const isActive = active === t.key;
      return (
        <TouchableOpacity
          key={t.key}
          activeOpacity={0.85}
          onPress={() => { if (t.key !== active) onSelect(t.key); }}
          style={[styles.pill, isActive ? styles.pillActive : styles.pillIdle]}
        >
          <Text style={isActive ? styles.pillTextActive : styles.pillTextIdle} numberOfLines={1}>{t.label}</Text>
        </TouchableOpacity>
      );
    })}
    {isOwner && onPressSettings ? (
      <TouchableOpacity activeOpacity={0.7} style={styles.settingsButton} onPress={onPressSettings}>
        <SettingsIcon size={20} color="#475569" />
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 10, gap: 6, alignItems: 'center' },
  pill: { flex: 1, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  pillActive: { backgroundColor: '#2563eb', shadowColor: '#1e40af', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 6, elevation: 3 },
  pillIdle: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#dbe3ee' },
  pillTextActive: { color: '#fff', fontSize: 12.5, fontWeight: '800', letterSpacing: 0.1 },
  pillTextIdle: { color: '#334155', fontSize: 12.5, fontWeight: '800', letterSpacing: 0.1 },
  settingsButton: { width: 42, height: 42, borderRadius: 11, borderWidth: 1.5, borderColor: '#dbe3ee', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
});

export default TournamentTabBar;
