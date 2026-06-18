import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

// --- Icon primitives (built from Views — no asset deps) -----------------------

const QuickIcon = () => (
  // Lightning bolt
  <View style={iconStyles.bolt}>
    <View style={iconStyles.boltTop} />
    <View style={iconStyles.boltBottom} />
  </View>
);

const KnockoutIcon = () => (
  // Trophy
  <View style={iconStyles.trophyContainer}>
    <View style={iconStyles.trophyCup} />
    <View style={iconStyles.trophyHandleL} />
    <View style={iconStyles.trophyHandleR} />
    <View style={iconStyles.trophyStem} />
    <View style={iconStyles.trophyBase} />
  </View>
);

const LeagueIcon = () => (
  // Bar chart / table
  <View style={iconStyles.barsContainer}>
    <View style={[iconStyles.bar, { height: 10 }]} />
    <View style={[iconStyles.bar, { height: 18 }]} />
    <View style={[iconStyles.bar, { height: 14 }]} />
    <View style={[iconStyles.bar, { height: 22 }]} />
  </View>
);

const HybridIcon = () => (
  // League rows on top + bracket below
  <View style={iconStyles.hybridContainer}>
    <View style={iconStyles.hybridRow} />
    <View style={iconStyles.hybridRow} />
    <View style={iconStyles.hybridRow} />
    <View style={iconStyles.hybridDivider} />
    <View style={iconStyles.hybridBracketRow}>
      <View style={iconStyles.hybridBracketLeft} />
      <View style={iconStyles.hybridBracketStem} />
      <View style={iconStyles.hybridBracketRight} />
    </View>
  </View>
);

const ChevronRight = ({ color = 'rgba(255,255,255,0.9)' }) => (
  <View style={iconStyles.chevron}>
    <View style={[iconStyles.chevronLine, { backgroundColor: color, transform: [{ rotate: '45deg' }, { translateY: -3 }] }]} />
    <View style={[iconStyles.chevronLine, { backgroundColor: color, transform: [{ rotate: '-45deg' }, { translateY: 3 }] }]} />
  </View>
);

const LockIcon = () => (
  <View style={iconStyles.lockContainer}>
    <View style={iconStyles.lockShackle} />
    <View style={iconStyles.lockBody} />
  </View>
);

// --- Format definitions -------------------------------------------------------

const FORMATS = [
  {
    key: 'quick',
    label: 'Quick Tournament',
    subtitle: 'Matches + player stats, no bracket',
    gradient: ['#fb923c', '#ef4444'],
    glow: '#f97316',
    Icon: QuickIcon,
    enabled: true,
  },
  {
    key: 'knockout',
    label: 'Knockout',
    subtitle: 'Single-elimination bracket',
    gradient: ['#ec4899', '#be123c'],
    glow: '#e11d48',
    Icon: KnockoutIcon,
    enabled: true,
  },
  {
    key: 'league',
    label: 'League',
    subtitle: 'Group stage with optional knockout playoffs',
    gradient: ['#3b82f6', '#1e40af'],
    glow: '#2563eb',
    Icon: LeagueIcon,
    enabled: true,
  },
];

// --- Animated card ------------------------------------------------------------

const FormatCard = ({ fmt, index, onPress }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(40)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        delay: 150 + index * 90,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay: 150 + index * 90,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      friction: 8,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const disabled = !fmt.enabled;
  const colors = disabled
    ? ['#cbd5e1', '#94a3b8']
    : fmt.gradient;

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }, { scale }],
        shadowColor: fmt.glow,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: disabled ? 0.1 : 0.35,
        shadowRadius: 16,
        elevation: disabled ? 2 : 8,
      }}
    >
      <Pressable
        onPress={() => onPress(fmt)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          {/* Decorative circles */}
          <View style={styles.decorCircleLg} />
          <View style={styles.decorCircleSm} />

          <View style={styles.cardContent}>
            <View style={styles.iconBadge}>
              <fmt.Icon />
            </View>
            <View style={styles.cardTextWrap}>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle}>{fmt.label}</Text>
                {disabled && (
                  <View style={styles.soonBadge}>
                    <LockIcon />
                    <Text style={styles.soonBadgeText}>SOON</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardSubtitle}>{fmt.subtitle}</Text>
            </View>
            <ChevronRight />
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
};

// --- Screen -------------------------------------------------------------------

const TournamentListScreen = ({ navigation }) => {
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(headerY, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePick = (fmt) => {
    if (!fmt.enabled) {
      Alert.alert(
        'Coming Soon',
        `${fmt.label} tournaments are not yet available. Stay tuned!`
      );
      return;
    }
    navigation.navigate('TournamentFormatList', { format: fmt.key });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top accent gradient strip */}
      <View style={styles.topAccent}>
        <LinearGradient
          colors={['#1e1b4b', '#312e81']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          style={[
            styles.headerInner,
            { opacity: headerOpacity, transform: [{ translateY: headerY }] },
          ]}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <View style={styles.backArrow} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Tournaments</Text>
            <Text style={styles.headerSubtitle}>Choose your format</Text>
          </View>
          <View style={styles.headerSpacer} />
        </Animated.View>
      </View>

      <ScrollView
        contentContainerStyle={styles.cardsContainer}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text
          style={[
            styles.sectionLabel,
            { opacity: headerOpacity, transform: [{ translateY: headerY }] },
          ]}
        >
          PICK A FORMAT
        </Animated.Text>
        {FORMATS.map((fmt, i) => (
          <FormatCard key={fmt.key} fmt={fmt} index={i} onPress={handlePick} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  topAccent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 4,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    width: 11,
    height: 11,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: '#fff',
    transform: [{ rotate: '45deg' }, { translateX: 2 }],
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 3,
    letterSpacing: 0.3,
  },
  headerSpacer: { width: 42 },

  cardsContainer: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
    gap: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1.2,
    marginBottom: 4,
    marginLeft: 4,
  },

  cardGradient: {
    borderRadius: 20,
    padding: 22,
    overflow: 'hidden',
    minHeight: 110,
    justifyContent: 'center',
  },
  decorCircleLg: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  decorCircleSm: {
    position: 'absolute',
    bottom: -20,
    right: 60,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBadge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextWrap: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 3,
    fontWeight: '500',
  },
  soonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  soonBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});

const iconStyles = StyleSheet.create({
  // Lightning bolt
  bolt: { width: 22, height: 28, alignItems: 'center' },
  boltTop: {
    width: 12,
    height: 14,
    backgroundColor: '#fff',
    transform: [{ skewX: '-15deg' }],
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    marginRight: 6,
  },
  boltBottom: {
    width: 12,
    height: 14,
    backgroundColor: '#fff',
    marginTop: -3,
    marginLeft: 6,
    transform: [{ skewX: '-15deg' }],
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },

  // Trophy
  trophyContainer: {
    width: 28,
    height: 30,
    alignItems: 'center',
  },
  trophyCup: {
    width: 22,
    height: 14,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: '#fff',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
  },
  trophyHandleL: {
    position: 'absolute',
    left: -2,
    top: 2,
    width: 5,
    height: 8,
    borderWidth: 2,
    borderColor: '#fff',
    borderRightWidth: 0,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  trophyHandleR: {
    position: 'absolute',
    right: -2,
    top: 2,
    width: 5,
    height: 8,
    borderWidth: 2,
    borderColor: '#fff',
    borderLeftWidth: 0,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  trophyStem: {
    width: 4,
    height: 6,
    backgroundColor: '#fff',
    marginTop: 1,
  },
  trophyBase: {
    width: 16,
    height: 4,
    backgroundColor: '#fff',
    borderRadius: 2,
    marginTop: 1,
  },

  // League bars
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 24,
  },
  bar: {
    width: 5,
    backgroundColor: '#fff',
    borderTopLeftRadius: 1.5,
    borderTopRightRadius: 1.5,
  },

  // Hybrid
  hybridContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hybridRow: {
    width: 22,
    height: 2.5,
    backgroundColor: '#fff',
    borderRadius: 1.5,
    marginVertical: 1.2,
  },
  hybridDivider: {
    width: 22,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginVertical: 2,
  },
  hybridBracketRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hybridBracketLeft: {
    width: 7,
    height: 2.5,
    backgroundColor: '#fff',
    borderRadius: 1.5,
  },
  hybridBracketStem: {
    width: 5,
    height: 2.5,
    backgroundColor: '#fff',
  },
  hybridBracketRight: {
    width: 7,
    height: 2.5,
    backgroundColor: '#fff',
    borderRadius: 1.5,
  },

  // Chevron
  chevron: {
    width: 14,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronLine: {
    position: 'absolute',
    width: 9,
    height: 2.5,
    borderRadius: 1.5,
  },

  // Lock
  lockContainer: {
    width: 9,
    alignItems: 'center',
  },
  lockShackle: {
    width: 6,
    height: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
    borderBottomWidth: 0,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  lockBody: {
    width: 9,
    height: 6,
    backgroundColor: '#fff',
    borderRadius: 1.5,
    marginTop: -0.5,
  },
});

export default TournamentListScreen;
