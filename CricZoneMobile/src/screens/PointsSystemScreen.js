import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Brand colors matching CricZone
const colors = {
  primary: '#0d3b66',
  primaryLight: '#2d7dd2',
  secondary: '#5dade2',
  accent: '#a8d8ea',
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceGray: '#f1f5f9',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  warning: '#f59e0b',
  success: '#22c55e',
  purple: '#8b5cf6',
  pink: '#ec4899',
};

// Custom Icon Components (no emojis)
const ChartIcon = ({ size = 60, color = colors.primary }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    {/* Bar chart icon */}
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: size * 0.08 }}>
      <View style={{
        width: size * 0.18,
        height: size * 0.4,
        backgroundColor: color,
        borderRadius: size * 0.04,
        opacity: 0.6,
      }} />
      <View style={{
        width: size * 0.18,
        height: size * 0.7,
        backgroundColor: color,
        borderRadius: size * 0.04,
        opacity: 0.8,
      }} />
      <View style={{
        width: size * 0.18,
        height: size * 0.55,
        backgroundColor: color,
        borderRadius: size * 0.04,
      }} />
      <View style={{
        width: size * 0.18,
        height: size * 0.85,
        backgroundColor: color,
        borderRadius: size * 0.04,
      }} />
    </View>
  </View>
);

const TrophyIcon = ({ size = 24, color = colors.warning }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.7,
      height: size * 0.5,
      borderWidth: 2.5,
      borderColor: color,
      borderBottomLeftRadius: size * 0.35,
      borderBottomRightRadius: size * 0.35,
      borderTopWidth: 0,
    }} />
    <View style={{
      width: size * 0.15,
      height: size * 0.2,
      backgroundColor: color,
      marginTop: -2,
    }} />
    <View style={{
      width: size * 0.4,
      height: size * 0.1,
      backgroundColor: color,
      borderRadius: size * 0.02,
    }} />
  </View>
);

const GraphIcon = ({ size = 24, color = colors.success }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    {/* Upward trending line */}
    <View style={{
      width: size * 0.8,
      height: size * 0.6,
      borderLeftWidth: 2.5,
      borderBottomWidth: 2.5,
      borderColor: color,
      justifyContent: 'flex-end',
      paddingLeft: size * 0.1,
      paddingBottom: size * 0.1,
    }}>
      <View style={{
        width: size * 0.5,
        height: 2.5,
        backgroundColor: color,
        transform: [{ rotate: '-35deg' }],
        position: 'absolute',
        bottom: size * 0.15,
        left: size * 0.1,
      }} />
      <View style={{
        width: size * 0.12,
        height: size * 0.12,
        borderRadius: size * 0.06,
        backgroundColor: color,
        position: 'absolute',
        bottom: size * 0.35,
        right: size * 0.1,
      }} />
    </View>
  </View>
);

const StarIcon = ({ size = 24, color = colors.purple }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.35,
      height: size * 0.35,
      backgroundColor: color,
      transform: [{ rotate: '45deg' }],
    }} />
    <View style={{
      width: size * 0.35,
      height: size * 0.35,
      backgroundColor: color,
      transform: [{ rotate: '45deg' }],
      position: 'absolute',
      top: size * 0.15,
    }} />
    <View style={{
      width: size * 0.7,
      height: size * 0.25,
      backgroundColor: color,
      position: 'absolute',
      borderRadius: size * 0.05,
    }} />
    <View style={{
      width: size * 0.25,
      height: size * 0.7,
      backgroundColor: color,
      position: 'absolute',
      borderRadius: size * 0.05,
    }} />
  </View>
);

const TargetIcon = ({ size = 24, color = colors.pink }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.8,
      height: size * 0.8,
      borderRadius: size * 0.4,
      borderWidth: 2.5,
      borderColor: color,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <View style={{
        width: size * 0.5,
        height: size * 0.5,
        borderRadius: size * 0.25,
        borderWidth: 2.5,
        borderColor: color,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <View style={{
          width: size * 0.2,
          height: size * 0.2,
          borderRadius: size * 0.1,
          backgroundColor: color,
        }} />
      </View>
    </View>
  </View>
);

// Animated Feature Item Component
const AnimatedFeatureItem = ({ icon, label, delay, index }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 500,
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.spring(scaleValue, {
        toValue: 1,
        tension: 100,
        friction: 8,
        delay: delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.featureItem,
        {
          opacity: animatedValue,
          transform: [
            { scale: scaleValue },
            {
              translateX: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.featureIconContainer, { backgroundColor: getFeatureBgColor(index) }]}>
        {icon}
      </View>
      <Text style={styles.featureText}>{label}</Text>
    </Animated.View>
  );
};

const getFeatureBgColor = (index) => {
  const bgColors = [
    'rgba(245, 158, 11, 0.12)',  // warning/gold
    'rgba(34, 197, 94, 0.12)',   // success/green
    'rgba(139, 92, 246, 0.12)', // purple
    'rgba(236, 72, 153, 0.12)', // pink
  ];
  return bgColors[index] || bgColors[0];
};

const PointsSystemScreen = () => {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animations
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress bar animation (non-native driver for width)
    Animated.timing(progressAnim, {
      toValue: 0.65,
      duration: 1000,
      delay: 500,
      useNativeDriver: false,
    }).start();

    // Pulse animation for the icon
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <Text style={styles.headerTitle}>Points System</Text>

          {/* Main Card */}
          <View style={styles.contentBox}>
            {/* Animated Icon */}
            <Animated.View
              style={[
                styles.mainIconContainer,
                {
                  transform: [
                    { scale: iconScale },
                  ],
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.iconGlow,
                  { transform: [{ scale: pulseAnim }] }
                ]}
              />
              <ChartIcon size={70} color={colors.primary} />
            </Animated.View>

            {/* Badge */}
            <View style={styles.comingSoonBadge}>
              <Text style={styles.badgeText}>COMING SOON</Text>
            </View>

            <Text style={styles.title}>Under Development</Text>

            <Text style={styles.subtitle}>
              <Text style={styles.countryText}>Sri Lanka</Text> softball outdoor & indoor
              points system is currently being built.
            </Text>

            {/* Progress indicator */}
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>65% Complete</Text>
            </View>

            {/* Features Preview */}
            <View style={styles.featuresPreview}>
              <Text style={styles.featuresTitle}>Upcoming Features</Text>

              <AnimatedFeatureItem
                icon={<TrophyIcon size={24} color={colors.warning} />}
                label="Tournament Rankings"
                delay={600}
                index={0}
              />

              <AnimatedFeatureItem
                icon={<GraphIcon size={24} color={colors.success} />}
                label="Player Statistics"
                delay={750}
                index={1}
              />

              <AnimatedFeatureItem
                icon={<StarIcon size={24} color={colors.purple} />}
                label="Performance Points"
                delay={900}
                index={2}
              />

              <AnimatedFeatureItem
                icon={<TargetIcon size={24} color={colors.pink} />}
                label="Leaderboards"
                delay={1050}
                index={3}
              />
            </View>
          </View>

          {/* Footer */}
          <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
            <Text style={styles.footerText}>Stay tuned for updates</Text>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  contentBox: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  mainIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  iconGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accent,
    opacity: 0.5,
  },
  comingSoonBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  badgeText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  countryText: {
    fontWeight: '700',
    color: colors.primary,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 28,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.surfaceGray,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primaryLight,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    fontWeight: '600',
  },
  featuresPreview: {
    width: '100%',
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceGray,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  featureText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PointsSystemScreen;
