import React, { useState, useEffect, useRef, useContext, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Image, StyleSheet, TouchableOpacity,
  ActivityIndicator, Animated, RefreshControl, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import io from 'socket.io-client';
import { SOCKET_URL } from '../api/config';
import { AuthContext } from '../context/AuthContext';
import auctionService from '../utils/auctionService';
import { formatMoney } from '../utils/auctionFormat';

const REFRESH_POLL_MS = 9000;

// ---- small helpers --------------------------------------------------------
const initials = (name) => {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
};

const Crest = ({ uri, name, size = 40, square = false }) => {
  const radius = square ? size * 0.22 : size / 2;
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#fff' }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  );
};

const LivePulse = () => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.9, duration: 850, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 850, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
      ]),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={{ width: 8, height: 8, marginRight: 6, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#f87171', transform: [{ scale }], opacity }} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
    </View>
  );
};

export default function LiveAuctionScreen({ route, navigation }) {
  const { user } = useContext(AuthContext);
  const { shareId, auctionId: paramAuctionId, name: paramName, coverUrl: paramCover } = route.params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('teams'); // teams | sold | upcoming
  const [expanded, setExpanded] = useState(null);

  const auctionId = data?.auctionId || paramAuctionId;

  const fetchData = useCallback(async () => {
    try {
      const d = await auctionService.getPublicAuction(shareId, user?.token);
      if (d) { setData(d); setError(''); }
    } catch (e) {
      setError('Could not load this auction.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [shareId, user?.token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time: apply the socket payload DIRECTLY (it's the full state) for the
  // fastest possible updates, with a poll fallback + refetch on reconnect.
  useEffect(() => {
    if (!auctionId) return undefined;
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('connect', () => { socket.emit('join-auction', auctionId); });
    socket.on('auction:update', (payload) => {
      if (payload) setData((prev) => ({ ...(prev || {}), ...payload }));
    });
    const poll = setInterval(fetchData, REFRESH_POLL_MS);
    return () => {
      clearInterval(poll);
      try { socket.emit('leave-auction', auctionId); } catch (_) {}
      socket.disconnect();
    };
  }, [auctionId, fetchData]);

  const d = useMemo(() => {
    const auction = data?.auction;
    if (!auction) return null;
    const teams = data.teams || [];
    const players = data.players || [];
    const fmt = (amt) => formatMoney(amt, { symbol: auction.currencySymbol || 'Rs', format: auction.currencyFormat || 'plain' });
    const teamById = {};
    teams.forEach((t) => { teamById[String(t._id)] = t; });
    const current = players.find((p) => String(p._id) === String(auction.currentPlayer)) || null;
    const topTeam = teams.find((t) => String(t._id) === String(auction.currentBidTeam)) || null;
    const sold = players.filter((p) => p.status === 'sold').sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0));
    const pending = players.filter((p) => p.status === 'pending').sort((a, b) => (a.order || 0) - (b.order || 0));
    const unsold = players.filter((p) => p.status === 'unsold');
    return { auction, teams, players, fmt, teamById, current, topTeam, sold, pending, unsold };
  }, [data]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}><ActivityIndicator size="large" color="#4f46e5" /><Text style={styles.centerText}>Loading auction…</Text></SafeAreaView>
    );
  }
  if (!d) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errIcon}>⚠️</Text>
        <Text style={styles.centerText}>{error || 'Auction not available.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchData}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 12 }} onPress={() => navigation.goBack()}><Text style={{ color: '#64748b', fontWeight: '700' }}>Go back</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { auction, teams, fmt, teamById, current, topTeam, sold, pending, unsold } = d;
  const isLive = auction.status === 'live';
  const done = auction.status === 'completed';
  const coverUrl = auction.coverUrl || paramCover;

  const TABS = [
    { key: 'teams', label: `Teams ${teams.length}` },
    { key: 'sold', label: `Sold ${sold.length}` },
    { key: 'upcoming', label: `Upcoming ${pending.length}` },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Text style={styles.backIcon}>‹</Text></TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{auction.name || paramName || 'Auction'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />}
      >
        {/* Cover hero */}
        <View style={styles.hero}>
          {coverUrl ? <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <LinearGradient colors={coverUrl ? ['rgba(15,17,32,0.35)', 'rgba(15,17,32,0.92)'] : ['#1e1b4b', '#3b1d6e', '#1e3a8a']} style={StyleSheet.absoluteFill} />
          <View style={styles.heroContent}>
            <View style={styles.heroTop}>
              <View style={[styles.statusPill, { backgroundColor: done ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)' }]}>
                {isLive ? <LivePulse /> : null}
                <Text style={[styles.statusText, { color: done ? '#86efac' : '#fecaca' }]}>{done ? 'COMPLETED' : auction.status === 'paused' ? 'PAUSED' : 'LIVE'}</Text>
              </View>
            </View>
            <View style={styles.heroBottom}>
              <Crest uri={auction.logoUrl} name={auction.name} size={54} square />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.heroName} numberOfLines={2}>{auction.name}</Text>
                {!!auction.venue && <Text style={styles.heroVenue} numberOfLines={1}>📍 {auction.venue}</Text>}
              </View>
            </View>
          </View>
        </View>

        {/* Current lot */}
        <View style={styles.lotCard}>
          <Text style={styles.lotLabel}>ON THE BLOCK</Text>
          {current ? (
            <>
              <View style={styles.lotRow}>
                {current.photoUrl ? <Image source={{ uri: current.photoUrl }} style={styles.lotPhoto} /> : <View style={[styles.lotPhoto, styles.lotPhotoFallback]}><Text style={styles.lotPhotoInitial}>{initials(current.name)}</Text></View>}
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.lotName} numberOfLines={1}>{current.name}</Text>
                  <Text style={styles.lotMeta} numberOfLines={1}>{[current.role, current.category].filter(Boolean).join(' · ') || 'Player'}</Text>
                  <Text style={styles.lotBase}>Base {fmt(current.basePrice)}</Text>
                </View>
              </View>
              <View style={styles.bidRow}>
                <View>
                  <Text style={styles.bidLabel}>CURRENT BID</Text>
                  <Text style={styles.bidAmount}>{fmt(auction.currentBid || 0)}</Text>
                </View>
                <View style={styles.topTeamBox}>
                  {topTeam ? (
                    <>
                      <Crest uri={topTeam.logoUrl} name={topTeam.name} size={28} />
                      <Text style={styles.topTeamName} numberOfLines={1}>{topTeam.name}</Text>
                    </>
                  ) : (
                    <Text style={styles.noBid}>No bids yet</Text>
                  )}
                </View>
              </View>
            </>
          ) : (
            <View style={styles.lotIdle}><Text style={styles.lotIdleText}>{done ? 'Auction completed' : 'Waiting for the next player…'}</Text></View>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {TABS.map((t) => (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View style={{ paddingHorizontal: 16 }}>
          {tab === 'teams' && teams.map((t) => {
            const bought = d.players.filter((p) => p.status === 'sold' && String(p.soldTo) === String(t._id));
            const squadCount = bought.length + (t.retainedCount || 0);
            const isOpen = expanded === t._id;
            return (
              <View key={t._id} style={styles.teamCard}>
                <TouchableOpacity activeOpacity={0.8} onPress={() => setExpanded(isOpen ? null : t._id)} style={styles.teamHead}>
                  <Crest uri={t.logoUrl} name={t.name} size={42} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.teamName} numberOfLines={1}>{t.name}</Text>
                    <Text style={styles.teamOwner} numberOfLines={1}>{t.ownerName || 'No owner'} · {squadCount} player{squadCount === 1 ? '' : 's'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.teamRemaining}>{fmt(t.remaining != null ? t.remaining : Math.max(0, (t.purse || 0) - (t.spent || 0)))}</Text>
                    <Text style={styles.teamRemainingLabel}>left</Text>
                  </View>
                  <Text style={styles.chevron}>{isOpen ? '⌄' : '›'}</Text>
                </TouchableOpacity>
                {isOpen && (
                  <View style={styles.squadBox}>
                    <View style={styles.squadStatsRow}>
                      <SquadStat label="Purse" value={fmt(t.purse || 0)} />
                      <SquadStat label="Spent" value={fmt(t.spent || 0)} />
                      <SquadStat label="Max bid" value={fmt(t.maxBid != null ? t.maxBid : (t.remaining || 0))} />
                    </View>
                    {[...retainedRows(t), ...bought.map((p) => ({ _id: p._id, name: p.name, role: p.role, photoUrl: p.photoUrl, price: p.soldPrice, captain: t.captainName && p.name === t.captainName }))].map((m) => (
                      <View key={m._id} style={styles.squadRow}>
                        {m.photoUrl ? <Image source={{ uri: m.photoUrl }} style={styles.squadPhoto} /> : <View style={[styles.squadPhoto, styles.squadPhotoFallback]}><Text style={styles.squadInitial}>{initials(m.name)}</Text></View>}
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                            <Text style={styles.squadName} numberOfLines={1}>{m.name}</Text>
                            {m.captain ? <Tag text="C" bg="#4f46e5" color="#fff" /> : null}
                            {m.owner ? <Tag text="Owner" bg="#e0e7ff" color="#4338ca" /> : null}
                            {m.tag ? <Tag text={m.tag} bg="#fef3c7" color="#b45309" /> : null}
                          </View>
                          {!!m.role && <Text style={styles.squadRole}>{m.role}</Text>}
                        </View>
                        <Text style={styles.squadPrice}>{m.retained && !m.price ? 'Free' : fmt(m.price || 0)}</Text>
                      </View>
                    ))}
                    {bought.length === 0 && (t.retainedCount || 0) === 0 && <Text style={styles.emptySmall}>No players yet.</Text>}
                  </View>
                )}
              </View>
            );
          })}

          {tab === 'sold' && (sold.length === 0 ? <Empty text="No players sold yet." /> : sold.map((p) => {
            const t = teamById[String(p.soldTo)];
            return (
              <View key={p._id} style={styles.playerRow}>
                {p.photoUrl ? <Image source={{ uri: p.photoUrl }} style={styles.playerPhoto} /> : <View style={[styles.playerPhoto, styles.squadPhotoFallback]}><Text style={styles.squadInitial}>{initials(p.name)}</Text></View>}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.playerMeta} numberOfLines={1}>{t ? t.name : '—'}{p.role ? ` · ${p.role}` : ''}</Text>
                </View>
                <Text style={styles.soldPrice}>{fmt(p.soldPrice || 0)}</Text>
              </View>
            );
          }))}

          {tab === 'upcoming' && (pending.length === 0 ? <Empty text="No players left in the pool." /> : pending.map((p, i) => (
            <View key={p._id} style={styles.playerRow}>
              <Text style={styles.upIndex}>{i + 1}</Text>
              {p.photoUrl ? <Image source={{ uri: p.photoUrl }} style={styles.playerPhoto} /> : <View style={[styles.playerPhoto, styles.squadPhotoFallback]}><Text style={styles.squadInitial}>{initials(p.name)}</Text></View>}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.playerMeta} numberOfLines={1}>{[p.role, p.category].filter(Boolean).join(' · ') || 'Player'}</Text>
              </View>
              <Text style={styles.basePrice}>{fmt(p.basePrice || 0)}</Text>
            </View>
          )))}

          {tab === 'upcoming' && unsold.length > 0 && (
            <>
              <Text style={styles.unsoldHeading}>Unsold ({unsold.length})</Text>
              {unsold.map((p) => (
                <View key={p._id} style={styles.playerRow}>
                  {p.photoUrl ? <Image source={{ uri: p.photoUrl }} style={styles.playerPhoto} /> : <View style={[styles.playerPhoto, styles.squadPhotoFallback]}><Text style={styles.squadInitial}>{initials(p.name)}</Text></View>}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.playerMeta} numberOfLines={1}>{[p.role, p.category].filter(Boolean).join(' · ') || 'Player'}</Text>
                  </View>
                  <Text style={styles.unsoldTag}>UNSOLD</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Retained players + managers of a team as squad rows (with tags).
function retainedRows(t) {
  const rows = (t.retainedPlayers || []).map((p, i) => ({
    _id: `ret-${i}-${p.name}`, name: p.name, role: p.role, photoUrl: p.photoUrl,
    price: p.price, retained: true, tag: 'Retained', captain: t.captainName && p.name === t.captainName,
  }));
  (t.managers || []).forEach((m, i) => {
    rows.push({
      _id: `mgr-${i}-${m.name}`, name: m.name, role: 'Manager', photoUrl: m.photoUrl,
      price: m.price, retained: true, owner: m.isOwner, tag: m.plays ? 'Mgr · Plays' : 'Manager',
      captain: t.captainName && m.name === t.captainName,
    });
  });
  return rows;
}

const Tag = ({ text, bg, color }) => <Text style={[styles.tag, { backgroundColor: bg, color }]}>{text}</Text>;
const SquadStat = ({ label, value }) => (
  <View style={styles.squadStat}><Text style={styles.squadStatLabel}>{label}</Text><Text style={styles.squadStatValue}>{value}</Text></View>
);
const Empty = ({ text }) => <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', padding: 24 },
  centerText: { marginTop: 12, color: '#64748b', fontWeight: '600', textAlign: 'center' },
  errIcon: { fontSize: 34 },
  retryBtn: { marginTop: 16, backgroundColor: '#4f46e5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '800' },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  backIcon: { fontSize: 26, color: '#334155', marginTop: -2 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#0f172a' },

  hero: { height: 168, margin: 16, borderRadius: 22, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: '#1e1b4b' },
  heroContent: { flex: 1, padding: 16, justifyContent: 'space-between' },
  heroTop: { flexDirection: 'row', justifyContent: 'flex-start' },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  heroBottom: { flexDirection: 'row', alignItems: 'flex-end' },
  heroName: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroVenue: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', marginTop: 3 },

  lotCard: { backgroundColor: '#0f172a', marginHorizontal: 16, borderRadius: 20, padding: 16 },
  lotLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 10 },
  lotRow: { flexDirection: 'row', alignItems: 'center' },
  lotPhoto: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#1e293b' },
  lotPhotoFallback: { alignItems: 'center', justifyContent: 'center' },
  lotPhotoInitial: { color: '#cbd5e1', fontWeight: '800', fontSize: 22 },
  lotName: { color: '#fff', fontSize: 19, fontWeight: '900' },
  lotMeta: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginTop: 2 },
  lotBase: { color: '#64748b', fontSize: 11, fontWeight: '700', marginTop: 4 },
  bidRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 14 },
  bidLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  bidAmount: { color: '#34d399', fontSize: 32, fontWeight: '900', marginTop: 2 },
  topTeamBox: { alignItems: 'flex-end', maxWidth: '46%' },
  topTeamName: { color: '#fbbf24', fontSize: 13, fontWeight: '800', marginTop: 5, textAlign: 'right' },
  noBid: { color: '#64748b', fontSize: 13, fontWeight: '700' },
  lotIdle: { paddingVertical: 22, alignItems: 'center' },
  lotIdleText: { color: '#64748b', fontSize: 14, fontWeight: '700' },

  tabBar: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, marginBottom: 12, backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff', shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  tabTextActive: { color: '#4f46e5' },

  teamCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  teamHead: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  teamName: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  teamOwner: { fontSize: 11, color: '#64748b', fontWeight: '600', marginTop: 2 },
  teamRemaining: { fontSize: 15, fontWeight: '900', color: '#16a34a' },
  teamRemainingLabel: { fontSize: 9, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' },
  chevron: { fontSize: 18, color: '#94a3b8', marginLeft: 8, width: 14, textAlign: 'center' },
  squadBox: { borderTopWidth: 1, borderTopColor: '#f1f5f9', padding: 12, backgroundColor: '#f8fafc' },
  squadStatsRow: { flexDirection: 'row', marginBottom: 10 },
  squadStat: { flex: 1, alignItems: 'center' },
  squadStatLabel: { fontSize: 9, color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' },
  squadStatValue: { fontSize: 13, color: '#0f172a', fontWeight: '900', marginTop: 2 },
  squadRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  squadPhoto: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#e2e8f0' },
  squadPhotoFallback: { alignItems: 'center', justifyContent: 'center' },
  squadInitial: { color: '#64748b', fontWeight: '800', fontSize: 12 },
  squadName: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  squadRole: { fontSize: 10, color: '#94a3b8', fontWeight: '600', marginTop: 1 },
  squadPrice: { fontSize: 13, fontWeight: '800', color: '#16a34a' },
  emptySmall: { fontSize: 12, color: '#94a3b8', fontWeight: '600', textAlign: 'center', paddingVertical: 8 },
  tag: { fontSize: 8, fontWeight: '900', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, marginLeft: 6, overflow: 'hidden', textTransform: 'uppercase' },

  playerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  playerPhoto: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e2e8f0' },
  playerName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  playerMeta: { fontSize: 11, color: '#64748b', fontWeight: '600', marginTop: 2 },
  soldPrice: { fontSize: 15, fontWeight: '900', color: '#16a34a' },
  basePrice: { fontSize: 13, fontWeight: '800', color: '#475569' },
  upIndex: { width: 20, textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#94a3b8', marginRight: 4 },
  unsoldHeading: { fontSize: 11, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginTop: 8, marginBottom: 8 },
  unsoldTag: { fontSize: 10, fontWeight: '900', color: '#dc2626' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#94a3b8', fontWeight: '600' },
});
