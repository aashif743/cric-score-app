import React, { useState, useContext, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import liveService from '../utils/liveService';

// Which schedule screen to open, by tournament format.
const scheduleRouteFor = (format) =>
  format === 'league' ? 'LeagueSchedule'
    : format === 'knockout' ? 'KnockoutSchedule'
      : 'TournamentDetail';

const initialOf = (s) => (s || '?').trim().charAt(0).toUpperCase();

// Status pill: colour + label per derived status from the feed.
const STATUS = {
  live:      { label: 'LIVE',     bg: '#fee2e2', fg: '#dc2626', dot: '#dc2626' },
  ongoing:   { label: 'ONGOING',  bg: '#fef3c7', fg: '#b45309', dot: '#d97706' },
  upcoming:  { label: 'UPCOMING', bg: '#dbeafe', fg: '#1d4ed8', dot: '#2563eb' },
  completed: { label: 'FINISHED', bg: '#dcfce7', fg: '#047857', dot: '#059669' },
};

const POLL_INTERVAL_MS = 20000;

const TournamentCard = ({ t, onPress }) => {
  const st = STATUS[t.status] || STATUS.upcoming;
  const metaBits = [
    `${t.numberOfTeams || 0} teams`,
    t.format ? t.format.charAt(0).toUpperCase() + t.format.slice(1) : null,
  ].filter(Boolean).join('  ·  ');
  const progress = t.totalMatches > 0
    ? `${t.completedMatches}/${t.totalMatches} matches played`
    : 'Fixtures ready';
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => onPress(t)}>
      <View style={styles.cardTop}>
        {t.logoUrl ? (
          <Image source={{ uri: t.logoUrl }} style={styles.logo} resizeMode="cover" />
        ) : (
          <View style={styles.logoFallback}><Text style={styles.logoFallbackText}>{initialOf(t.name)}</Text></View>
        )}
        <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
          {t.status === 'live' ? <View style={[styles.statusDot, { backgroundColor: st.dot }]} /> : null}
          <Text style={[styles.statusText, { color: st.fg }]}>{st.label}</Text>
        </View>
      </View>

      <Text style={styles.name} numberOfLines={2}>{t.name}</Text>
      <Text style={styles.meta} numberOfLines={1}>{metaBits}</Text>
      {t.venue ? <Text style={styles.venue} numberOfLines={1}>📍 {t.venue}</Text> : null}

      <View style={styles.cardFooter}>
        <Text style={styles.progress} numberOfLines={1}>{progress}</Text>
        <Text style={styles.cta}>View ›</Text>
      </View>
    </TouchableOpacity>
  );
};

const FeaturedTournamentsStrip = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  const fetchFeatured = useCallback(async () => {
    if (!user?.token) return;
    try {
      const data = await liveService.getFeaturedTournaments(user.token);
      setItems(Array.isArray(data) ? data : []);
    } catch (_) {
      // keep whatever we had
    } finally {
      setLoaded(true);
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }
  }, [user?.token]);

  // Refetch whenever the dashboard regains focus, plus a slow poll so live
  // status badges stay fresh without a socket (tournament-level, not per-ball).
  useFocusEffect(
    useCallback(() => {
      fetchFeatured();
      const poll = setInterval(fetchFeatured, POLL_INTERVAL_MS);
      return () => clearInterval(poll);
    }, [fetchFeatured])
  );

  const onPress = (t) => {
    navigation?.navigate(scheduleRouteFor(t.format), { tournamentId: t._id });
  };

  if (!loaded || items.length === 0) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.headerDot} />
          <Text style={styles.headerTitle}>Tournaments</Text>
        </View>
        <Text style={styles.headerCount}>{items.length}</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(t) => String(t._id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <TournamentCard t={item} onPress={onPress} />}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 14, marginBottom: 0 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb' },
  headerTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a', letterSpacing: 0.4, textTransform: 'uppercase' },
  headerCount: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },

  list: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },

  card: {
    width: 230,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  logo: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f1f5f9' },
  logoFallback: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: '#1e293b',
    justifyContent: 'center', alignItems: 'center',
  },
  logoFallbackText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6 },

  name: { fontSize: 15, fontWeight: '900', color: '#0f172a', minHeight: 38 },
  meta: { fontSize: 11.5, fontWeight: '700', color: '#64748b', marginTop: 4 },
  venue: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 2 },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eef2f7',
  },
  progress: { flex: 1, fontSize: 11, fontWeight: '700', color: '#475569' },
  cta: { fontSize: 13, fontWeight: '900', color: '#2563eb' },
});

export default FeaturedTournamentsStrip;
