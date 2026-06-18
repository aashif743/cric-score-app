import React, { useContext, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../context/AuthContext';
import LiveMatchesStrip from '../components/LiveMatchesStrip';

// --- Icons (built from Views) ------------------------------------------------

const CricketBatIcon = () => (
  <View style={iconStyles.container}>
    <View style={iconStyles.batHandle} />
    <View style={iconStyles.batBlade} />
    <View style={iconStyles.ball} />
  </View>
);

const TrophyIcon = () => (
  <View style={iconStyles.container}>
    <View style={iconStyles.trophyCup} />
    <View style={iconStyles.trophyHandleL} />
    <View style={iconStyles.trophyHandleR} />
    <View style={iconStyles.trophyStem} />
    <View style={iconStyles.trophyBase} />
  </View>
);

const ClockIcon = () => (
  <View style={iconStyles.container}>
    <View style={iconStyles.clockFace} />
    <View style={iconStyles.clockHandV} />
    <View style={iconStyles.clockHandH} />
  </View>
);

const ChevronIcon = ({ color = '#fff' }) => (
  <View style={iconStyles.chevronContainer}>
    <View style={[iconStyles.chevronLine, { backgroundColor: color, transform: [{ rotate: '45deg' }, { translateY: -3 }] }]} />
    <View style={[iconStyles.chevronLine, { backgroundColor: color, transform: [{ rotate: '-45deg' }, { translateY: 3 }] }]} />
  </View>
);

// --- Animated section card ---------------------------------------------------

const SectionCard = ({ section, index, onPress }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(40)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 480,
        delay: 200 + index * 100,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay: 200 + index * 100,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onIn = () => {
    Animated.spring(scale, { toValue: 0.97, friction: 8, tension: 200, useNativeDriver: true }).start();
  };
  const onOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }).start();
  };

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }, { scale }],
        shadowColor: section.glow,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.32,
        shadowRadius: 16,
        elevation: 8,
      }}
    >
      <Pressable onPress={onPress} onPressIn={onIn} onPressOut={onOut}>
        <LinearGradient
          colors={section.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sectionCard}
        >
          <View style={styles.cardDecorLg} />
          <View style={styles.cardDecorSm} />

          <View style={styles.cardRow}>
            <View style={styles.cardIconBadge}>
              <section.icon />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{section.title}</Text>
              <Text style={styles.cardDescription}>{section.description}</Text>
            </View>
          </View>

          <View style={styles.cardCta}>
            <Text style={styles.cardCtaText}>{section.buttonText}</Text>
            <ChevronIcon color={section.gradient[0]} />
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
};

// --- Dashboard ---------------------------------------------------------------

const DashboardScreen = ({ navigation }) => {
  const { user } = useContext(AuthContext);

  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(-20)).current;
  const welcomeOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(heroY, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(welcomeOpacity, {
        toValue: 1,
        duration: 600,
        delay: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const userName = user?.name || user?.displayName || 'Player';
  const initial = userName.charAt(0).toUpperCase();

  const sections = [
    {
      id: 'quick-match',
      title: 'Quick Match',
      description: 'Start a new match instantly. Pick teams, overs, and go.',
      icon: CricketBatIcon,
      gradient: ['#6366f1', '#8b5cf6'],
      glow: '#7c3aed',
      buttonText: 'Start Match',
      onPress: () => navigation.navigate('MatchSetup'),
    },
    {
      id: 'tournament',
      title: 'Tournaments',
      description: 'Knockout, league, or quick — manage everything in one place.',
      icon: TrophyIcon,
      gradient: ['#f59e0b', '#ef4444'],
      glow: '#f97316',
      buttonText: 'View Tournaments',
      onPress: () => navigation.navigate('Tournaments'),
    },
    {
      id: 'past-matches',
      title: 'Match History',
      description: 'Replay scorecards and review your stats from past games.',
      icon: ClockIcon,
      gradient: ['#10b981', '#0891b2'],
      glow: '#06b6d4',
      buttonText: 'View History',
      onPress: () => navigation.navigate('PastMatches'),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <LinearGradient
            colors={['#1e1b4b', '#312e81', '#4338ca']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroDecorLg} />
          <View style={styles.heroDecorSm} />

          <Animated.View
            style={[
              styles.heroRow,
              { opacity: heroOpacity, transform: [{ translateY: heroY }] },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{getGreeting()},</Text>
              <Text style={styles.userName} numberOfLines={1}>{userName}</Text>
              <View style={styles.brandPill}>
                <View style={styles.brandDot} />
                <Text style={styles.brandPillText}>CricZone</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#fbbf24', '#f59e0b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{initial}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Live matches strip — only renders when there's at least one
            public live match. Self-contained: fetches + subscribes to its
            own socket so the dashboard stays a thin shell. */}
        <LiveMatchesStrip navigation={navigation} />

        {/* Welcome line */}
        <Animated.View style={{ opacity: welcomeOpacity }}>
          <Text style={styles.welcomeText}>What would you like to do today?</Text>
          <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        </Animated.View>

        {/* Sections */}
        <View style={styles.sectionsContainer}>
          {sections.map((s, i) => (
            <SectionCard key={s.id} section={s} index={i} onPress={s.onPress} />
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>CRICZONE</Text>
          <Text style={styles.footerTagline}>Your Cricket Companion</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { paddingBottom: 120 },

  // Hero
  hero: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroDecorLg: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroDecorSm: {
    position: 'absolute',
    top: 30,
    right: 80,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  userName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 10,
    gap: 6,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  brandPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  avatarButton: {
    marginLeft: 16,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },

  // Body
  welcomeText: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1.2,
    paddingHorizontal: 22,
    marginTop: 18,
    marginBottom: 4,
  },
  sectionsContainer: {
    paddingHorizontal: 22,
    paddingTop: 14,
    gap: 16,
  },

  // Card
  sectionCard: {
    borderRadius: 22,
    padding: 22,
    overflow: 'hidden',
    minHeight: 150,
  },
  cardDecorLg: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cardDecorSm: {
    position: 'absolute',
    bottom: -20,
    right: 100,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 18,
  },
  cardIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  cardDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 5,
    lineHeight: 19,
  },
  cardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignSelf: 'flex-start',
    gap: 10,
  },
  cardCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 32,
    paddingTop: 20,
  },
  footerBrand: {
    fontSize: 14,
    fontWeight: '800',
    color: '#cbd5e1',
    letterSpacing: 3,
  },
  footerTagline: {
    fontSize: 11,
    color: '#cbd5e1',
    marginTop: 4,
    letterSpacing: 0.5,
  },
});

const iconStyles = StyleSheet.create({
  container: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
  // Bat
  batHandle: {
    position: 'absolute', width: 4, height: 14, borderRadius: 2,
    backgroundColor: '#fff', top: 0,
    transform: [{ rotate: '-45deg' }],
  },
  batBlade: {
    position: 'absolute', width: 10, height: 20, borderRadius: 3,
    backgroundColor: '#fff', bottom: 2,
    transform: [{ rotate: '-45deg' }],
  },
  ball: {
    position: 'absolute', width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#fff', opacity: 0.7, right: 2, top: 2,
  },
  // Trophy
  trophyCup: {
    width: 22, height: 14,
    borderWidth: 3, borderBottomWidth: 0, borderColor: '#fff',
    borderTopLeftRadius: 3, borderTopRightRadius: 3,
    borderBottomLeftRadius: 11, borderBottomRightRadius: 11,
  },
  trophyHandleL: {
    position: 'absolute', left: 2, top: 4,
    width: 5, height: 8,
    borderWidth: 2, borderColor: '#fff', borderRightWidth: 0,
    borderTopLeftRadius: 4, borderBottomLeftRadius: 4,
  },
  trophyHandleR: {
    position: 'absolute', right: 2, top: 4,
    width: 5, height: 8,
    borderWidth: 2, borderColor: '#fff', borderLeftWidth: 0,
    borderTopRightRadius: 4, borderBottomRightRadius: 4,
  },
  trophyStem: { width: 4, height: 6, backgroundColor: '#fff', marginTop: 1 },
  trophyBase: { width: 16, height: 4, backgroundColor: '#fff', borderRadius: 2, marginTop: 1 },
  // Clock
  clockFace: { width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, borderColor: '#fff' },
  clockHandV: {
    position: 'absolute', width: 2, height: 8, borderRadius: 1,
    backgroundColor: '#fff', top: 5,
  },
  clockHandH: {
    position: 'absolute', width: 6, height: 2, borderRadius: 1,
    backgroundColor: '#fff', right: 6,
  },
  // Chevron
  chevronContainer: { width: 12, height: 18, justifyContent: 'center', alignItems: 'center' },
  chevronLine: {
    position: 'absolute', width: 8, height: 2.5, borderRadius: 1.5,
  },
});

export default DashboardScreen;
