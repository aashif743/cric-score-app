import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../context/AuthContext';
import auctionService from '../utils/auctionService';
import { formatMoney } from '../utils/auctionFormat';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = SCREEN_W - 44;
const POLL_MS = 12000;

const initials = (name) => {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
};

const LiveDot = () => {
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

export default function LiveAuctionsStrip({ navigation }) {
  const { user } = useContext(AuthContext);
  const [auctions, setAuctions] = useState([]);

  const fetchAuctions = useCallback(async () => {
    const list = await auctionService.getLiveAuctions(user?.token);
    setAuctions(Array.isArray(list) ? list : []);
  }, [user?.token]);

  useEffect(() => {
    fetchAuctions();
    const poll = setInterval(fetchAuctions, POLL_MS);
    return () => clearInterval(poll);
  }, [fetchAuctions]);

  if (!auctions.length) return null;

  const open = (a) => navigation.navigate('LiveAuction', { shareId: a.shareId, auctionId: a._id, name: a.name, coverUrl: a.coverUrl });
  const fmt = (a, amt) => formatMoney(amt, { symbol: a.currencySymbol || 'Rs', format: a.currencyFormat || 'plain' });

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Live Auctions</Text>
        <Text style={styles.count}>{auctions.length}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + 12}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {auctions.map((a) => {
          const soldPct = a.playersTotal ? Math.round((a.playersSold / a.playersTotal) * 100) : 0;
          return (
            <TouchableOpacity key={a._id} activeOpacity={0.9} onPress={() => open(a)} style={[styles.card, { width: CARD_W }]}>
              {a.coverUrl ? <Image source={{ uri: a.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
              <LinearGradient
                colors={a.coverUrl ? ['rgba(15,17,32,0.30)', 'rgba(15,17,32,0.94)'] : ['#312e81', '#4338ca', '#1e3a8a']}
                style={StyleSheet.absoluteFill}
              />
              {/* top row */}
              <View style={styles.cardTop}>
                <View style={styles.livePill}>
                  {a.status === 'live' ? <LiveDot /> : null}
                  <Text style={styles.livePillText}>{a.status === 'completed' ? 'RESULTS' : a.status === 'paused' ? 'PAUSED' : 'LIVE'}</Text>
                </View>
                <View style={styles.auctionTag}><Text style={styles.auctionTagText}>AUCTION</Text></View>
              </View>

              {/* identity */}
              <View style={styles.cardIdentity}>
                {a.logoUrl ? <Image source={{ uri: a.logoUrl }} style={styles.cardLogo} /> : <View style={styles.cardLogoFallback}><Text style={styles.cardLogoInitial}>{initials(a.name)}</Text></View>}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.cardName} numberOfLines={1}>{a.name}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>{a.teamsCount} teams · {a.playersSold}/{a.playersTotal} sold{a.venue ? ` · ${a.venue}` : ''}</Text>
                </View>
              </View>

              {/* current lot / bid */}
              <View style={styles.cardBottom}>
                {a.currentPlayer ? (
                  <>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.onBlockLabel}>ON THE BLOCK</Text>
                      <Text style={styles.onBlockName} numberOfLines={1}>{a.currentPlayer.name}</Text>
                      {a.topTeam ? <Text style={styles.topTeam} numberOfLines={1}>↑ {a.topTeam.name}</Text> : <Text style={styles.topTeamMuted}>No bids yet</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.bidLabel}>BID</Text>
                      <Text style={styles.bidValue}>{fmt(a, a.currentBid || a.currentPlayer.basePrice || 0)}</Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.idleText}>Waiting for the next player…</Text>
                )}
              </View>

              <View style={styles.viewRow}><Text style={styles.viewText}>Tap to watch live  ›</Text></View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6, marginBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  heading: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  count: { marginLeft: 8, fontSize: 11, fontWeight: '900', color: '#4f46e5', backgroundColor: '#eef2ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },

  card: { height: 190, borderRadius: 22, overflow: 'hidden', marginRight: 12, padding: 16, justifyContent: 'space-between', backgroundColor: '#312e81' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  livePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.25)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  livePillText: { color: '#fecaca', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  auctionTag: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  auctionTagText: { color: 'rgba(255,255,255,0.9)', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },

  cardIdentity: { flexDirection: 'row', alignItems: 'center' },
  cardLogo: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#fff' },
  cardLogoFallback: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  cardLogoInitial: { color: '#fff', fontWeight: '800', fontSize: 15 },
  cardName: { color: '#fff', fontSize: 18, fontWeight: '900' },
  cardMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600', marginTop: 2 },

  cardBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)', paddingTop: 10 },
  onBlockLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  onBlockName: { color: '#fff', fontSize: 15, fontWeight: '800', marginTop: 2 },
  topTeam: { color: '#fbbf24', fontSize: 11, fontWeight: '700', marginTop: 2 },
  topTeamMuted: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  bidLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  bidValue: { color: '#34d399', fontSize: 22, fontWeight: '900', marginTop: 1 },
  idleText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700', paddingVertical: 6 },

  viewRow: { alignItems: 'flex-end' },
  viewText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800' },
});
