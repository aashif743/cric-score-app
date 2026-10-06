import React, { useContext, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import API from '../api/config';

// Deep-link target for https://cric-zone.com/tournament/:shareId (and the
// criczone://tournament/:shareId scheme). Resolves the share code to a
// tournament via the PUBLIC endpoint (no auth), then opens its live schedule.
const scheduleRouteFor = (format) =>
  format === 'league' ? 'LeagueSchedule'
    : format === 'knockout' ? 'KnockoutSchedule'
      : 'TournamentDetail';

const TournamentLinkScreen = ({ route, navigation }) => {
  const { user } = useContext(AuthContext);
  const shareId = route.params?.shareId;
  const [error, setError] = useState('');
  const [tournament, setTournament] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!shareId) { setError('This tournament link looks invalid.'); return; }
      try {
        const res = await API.get(`/public/tournament/${shareId}`);
        const data = res?.data?.data || res?.data;
        if (cancelled) return;
        if (!data || !data._id) { setError('Tournament not found.'); return; }
        setTournament(data);
        // Logged in → jump straight to the live schedule.
        if (user?.token) {
          navigation.replace(scheduleRouteFor(data.format), { tournamentId: data._id });
        }
      } catch (e) {
        if (!cancelled) setError('Could not open this tournament. Please try again.');
      }
    })();
    return () => { cancelled = true; };
  }, [shareId, user?.token]);

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text style={styles.title}>{error}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.replace(user ? 'MainTabs' : 'Auth')} activeOpacity={0.85}>
            <Text style={styles.btnText}>{user ? 'Go to Home' : 'Sign in'}</Text>
          </TouchableOpacity>
        </>
      ) : !user ? (
        <>
          <Text style={styles.brand}>CricZone</Text>
          <Text style={styles.title}>{tournament?.name || 'Tournament'}</Text>
          <Text style={styles.sub}>Sign in to CricZone to follow this tournament's schedule and live scores.</Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.replace('Auth')} activeOpacity={0.85}>
            <Text style={styles.btnText}>Sign in</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loading}>Opening tournament…</Text>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', padding: 28 },
  brand: { fontSize: 14, fontWeight: '900', color: '#2563eb', letterSpacing: 1, marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '900', color: '#0f172a', textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 22, lineHeight: 20 },
  loading: { marginTop: 14, fontSize: 14, color: '#94a3b8', fontWeight: '600' },
  btn: { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

export default TournamentLinkScreen;
