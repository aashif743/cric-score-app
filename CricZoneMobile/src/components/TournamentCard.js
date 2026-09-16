import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert, Clipboard, Share, Image } from 'react-native';

const statusConfig = {
  upcoming: { label: 'Upcoming', bg: '#fef3c7', color: '#d97706' },
  in_progress: { label: 'In Progress', bg: '#dbeafe', color: '#2563eb' },
  completed: { label: 'Completed', bg: '#d1fae5', color: '#059669' },
};

const TrophyIconSmall = ({ color = '#d97706' }) => (
  <View style={[styles.iconContainer, { width: 16, height: 16 }]}>
    <View style={[styles.trophyCup, { borderColor: color, width: 11, height: 9 }]} />
    <View style={[styles.trophyBase, { backgroundColor: color, width: 8, height: 3 }]} />
  </View>
);

const TournamentCard = ({ tournament, index, onPress, onLongPress }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const status = statusConfig[tournament.status] || statusConfig.upcoming;

  // One broadcast link for the WHOLE tournament (TV + OBS). Set once — it
  // auto-switches to each new match and shows the summary between games.
  const handleBroadcast = () => {
    const tvUrl = `https://cric-zone.com/tv/tournament/${tournament._id}`;
    const obsUrl = `https://cric-zone.com/overlay/tournament/${tournament._id}`;
    Alert.alert(
      'Tournament Broadcast',
      'One link for the whole tournament. Set it once — it automatically switches to each new match and shows the match summary between games.',
      [
        {
          text: 'Copy TV Link',
          onPress: () => {
            Clipboard.setString(tvUrl);
            Alert.alert('Copied!', 'Tournament TV link copied.\n\nOpen it in your TV browser — it runs the whole tournament.');
          },
        },
        {
          text: 'Copy OBS Overlay Link',
          onPress: () => {
            Clipboard.setString(obsUrl);
            Alert.alert('Copied!', 'Tournament OBS overlay link copied.\n\nAdd as a Browser Source (transparent background) in OBS.');
          },
        },
        {
          text: 'Share',
          onPress: async () => {
            try {
              await Share.share({ message: `${tournament.name} — Live Broadcast\n\nTV: ${tvUrl}\n\nOBS overlay: ${obsUrl}` });
            } catch (e) { /* cancelled */ }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onPress(tournament)}
        onLongPress={() => onLongPress && onLongPress(tournament)}
      >
        <View style={styles.card}>
          {/* Amber accent stripe */}
          <View style={styles.accentStripe} />

          <View style={styles.cardContent}>
            {/* Header: Name + Status */}
            <View style={styles.cardHeader}>
              <View style={styles.nameRow}>
                {tournament.logoUrl ? (
                  <Image source={{ uri: tournament.logoUrl }} style={styles.tournamentLogo} />
                ) : (
                  <TrophyIconSmall color="#d97706" />
                )}
                <Text style={styles.tournamentName} numberOfLines={1}>
                  {tournament.name}
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
            </View>

            {/* Info Row */}
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Teams</Text>
                <Text style={styles.infoValue}>{tournament.numberOfTeams}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Matches</Text>
                <Text style={styles.infoValue}>{tournament.matchCount || 0}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Format</Text>
                <Text style={styles.infoValue}>{tournament.totalOvers} ov</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.cardFooter}>
              <Text style={styles.dateText}>{formatDate(tournament.updatedAt)}</Text>
              <View style={styles.footerRight}>
                <TouchableOpacity
                  style={styles.broadcastPill}
                  onPress={handleBroadcast}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <View style={styles.tvIcon}><View style={styles.tvStand} /></View>
                  <Text style={styles.broadcastText}>Broadcast</Text>
                </TouchableOpacity>
                <View style={styles.arrowContainer}>
                  <View style={styles.arrowLine} />
                  <View style={styles.arrowHead} />
                </View>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    flexDirection: 'row',
  },
  accentStripe: {
    width: 4,
    backgroundColor: '#d97706',
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
    gap: 8,
  },
  tournamentLogo: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  tournamentName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  infoDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e2e8f0',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  broadcastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
  },
  tvIcon: {
    width: 15,
    height: 11,
    borderWidth: 1.6,
    borderColor: '#4f46e5',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tvStand: {
    width: 7,
    height: 1.6,
    backgroundColor: '#4f46e5',
    marginBottom: -3,
  },
  broadcastText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4f46e5',
  },
  arrowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowLine: {
    width: 14,
    height: 2,
    backgroundColor: '#d97706',
    borderRadius: 1,
  },
  arrowHead: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#d97706',
    marginLeft: -1,
  },
  // Icon styles
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  trophyCup: {
    borderWidth: 2,
    borderBottomWidth: 0,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  trophyBase: {
    borderRadius: 2,
    marginTop: -1,
  },
});

export default TournamentCard;
