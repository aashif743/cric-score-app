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
import Icon from '../components/Icon';

// --- Icons (built from Views) ------------------------------------------------

const CricketBatIcon = ({ color = '#4f46e5' }) => (
  <View style={iconStyles.container}>
    <View style={[iconStyles.batHandle, { backgroundColor: color }]} />
    <View style={[iconStyles.batBlade, { backgroundColor: color }]} />
    <View style={[iconStyles.ball, { backgroundColor: color, opacity: 0.55 }]} />
  </View>
);

const TrophyIcon = ({ color = '#4f46e5' }) => (
  <View style={iconStyles.container}><Icon name="trophy" size={22} color={color} /></View>
);

const ClockIcon = ({ color = '#4f46e5' }) => (
  <View style={iconStyles.container}><Icon name="clock" size={22} color={color} /></View>
);

const ChevronIcon = ({ color = '#4f46e5' }) => (
  <Icon name="chevron-right" size={17} color={color} strokeWidth={2.6} />
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
    Animated.spring(scale, { toValue: 0.98, friction: 8, tension: 200, useNativeDriver: true }).start();
  };
  const onOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }).start();
  };

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }, { scale }],
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 3,
      }}
    >
      <Pressable onPress={onPress} onPressIn={onIn} onPressOut={onOut} style={styles.sectionCard}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIconBadge, { backgroundColor: section.tint }]}>
            <section.icon color={section.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{section.title}</Text>
            <Text style={styles.cardDescription}>{section.description}</Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardCta}>
          <Text style={[styles.cardCtaText, { color: section.accent }]}>{section.buttonText}</Text>
          <ChevronIcon color={section.accent} />
        </View>
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
      accent: '#4f46e5',
      tint: '#eef2ff',
      buttonText: 'Start Match',
      onPress: () => navigation.navigate('MatchSetup'),
    },
    {
      id: 'tournament',
      title: 'Tournaments',
      description: 'Knockout, league, or quick — manage everything in one place.',
      icon: TrophyIcon,
      accent: '#d97706',
      tint: '#fef3c7',
      buttonText: 'View Tournaments',
      onPress: () => navigation.navigate('Tournaments'),
    },
    {
      id: 'past-matches',
      title: 'Match History',
      description: 'Replay scorecards and review your stats from past games.',
      icon: ClockIcon,
      accent: '#0d9488',
      tint: '#ccfbf1',
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
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
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
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
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
    gap: 14,
  },

  // Card
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#eef0f3',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  cardIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  cardDescription: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 19,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginTop: 16,
  },
  cardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 14,
    gap: 6,
  },
  cardCtaText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
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
    top: 0,
    transform: [{ rotate: '-45deg' }],
  },
  batBlade: {
    position: 'absolute', width: 10, height: 20, borderRadius: 3,
    bottom: 2,
    transform: [{ rotate: '-45deg' }],
  },
  ball: {
    position: 'absolute', width: 9, height: 9, borderRadius: 5,
    right: 2, top: 2,
  },
});

export default DashboardScreen;
