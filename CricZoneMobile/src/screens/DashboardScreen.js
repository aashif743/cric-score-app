import React, { useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { colors, spacing, borderRadius, fontSizes, fontWeights, shadows } from '../utils/theme';

const { width } = Dimensions.get('window');

// Modern Icon Components using shapes
const CricketBatIcon = ({ color = '#fff' }) => (
  <View style={styles.iconContainer}>
    <View style={[styles.batHandle, { backgroundColor: color }]} />
    <View style={[styles.batBlade, { backgroundColor: color }]} />
    <View style={[styles.ball, { backgroundColor: color, opacity: 0.6 }]} />
  </View>
);

const TrophyIcon = ({ color = '#fff' }) => (
  <View style={styles.iconContainer}>
    <View style={[styles.trophyCup, { borderColor: color }]} />
    <View style={[styles.trophyBase, { backgroundColor: color }]} />
    <View style={[styles.trophyStar, { backgroundColor: color }]} />
  </View>
);

const ClockIcon = ({ color = '#fff' }) => (
  <View style={styles.iconContainer}>
    <View style={[styles.clockFace, { borderColor: color }]} />
    <View style={[styles.clockHand, { backgroundColor: color }]} />
    <View style={[styles.clockHandShort, { backgroundColor: color }]} />
  </View>
);

const ArrowRightIcon = ({ color = '#fff' }) => (
  <View style={styles.arrowContainer}>
    <View style={[styles.arrowLine, { backgroundColor: color }]} />
    <View style={[styles.arrowHead, { borderLeftColor: color }]} />
  </View>
);

const DashboardScreen = ({ navigation }) => {
  const { user } = useContext(AuthContext);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const sections = [
    {
      id: 'quick-match',
      title: 'Quick Match',
      description: 'Start a new match instantly. Set up teams, choose overs, and begin scoring in seconds.',
      icon: CricketBatIcon,
      gradient: ['#4f46e5', '#7c3aed'],
      buttonText: 'Start Match',
      disabled: false,
      onPress: () => navigation.navigate('MatchSetup'),
    },
    {
      id: 'tournament',
      title: 'Tournament',
      description: 'Create and manage tournaments with multiple teams, schedules, and leaderboards.',
      icon: TrophyIcon,
      gradient: ['#d97706', '#f59e0b'],
      buttonText: 'View Tournaments',
      disabled: false,
      onPress: () => navigation.navigate('TournamentList'),
    },
    {
      id: 'past-matches',
      title: 'Past Matches',
      description: 'View your match history, detailed scorecards, and player statistics.',
      icon: ClockIcon,
      gradient: ['#059669', '#10b981'],
      buttonText: 'View History',
      disabled: false,
      onPress: () => navigation.navigate('PastMatches'),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>
              {user?.name || user?.displayName || 'Player'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.name || user?.displayName || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Welcome Message */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>
            What would you like to do today?
          </Text>
        </View>

        {/* Feature Sections */}
        <View style={styles.sectionsContainer}>
          {sections.map((section, index) => {
            const IconComponent = section.icon;
            return (
              <View
                key={section.id}
                style={[
                  styles.sectionCard,
                  { backgroundColor: section.gradient[0] },
                  section.disabled && styles.sectionCardDisabled,
                ]}
              >
                {/* Background Pattern */}
                <View style={styles.cardPattern}>
                  <View style={[styles.patternCircle, styles.patternCircle1]} />
                  <View style={[styles.patternCircle, styles.patternCircle2]} />
                </View>

                <View style={styles.cardContent}>
                  {/* Icon */}
                  <View style={styles.cardIconWrapper}>
                    <IconComponent color="#fff" />
                  </View>

                  {/* Text Content */}
                  <View style={styles.cardTextContent}>
                    <Text style={styles.cardTitle}>{section.title}</Text>
                    <Text style={styles.cardDescription}>
                      {section.description}
                    </Text>
                  </View>

                  {/* Button */}
                  <TouchableOpacity
                    style={[
                      styles.cardButton,
                      section.disabled && styles.cardButtonDisabled,
                    ]}
                    onPress={section.onPress}
                    disabled={section.disabled}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.cardButtonText,
                        section.disabled && styles.cardButtonTextDisabled,
                      ]}
                    >
                      {section.buttonText}
                    </Text>
                    {!section.disabled && <ArrowRightIcon color={section.gradient[0]} />}
                  </TouchableOpacity>
                </View>

                {/* Disabled Overlay */}
                {section.disabled && (
                  <View style={styles.disabledBadge}>
                    <Text style={styles.disabledBadgeText}>COMING SOON</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* App Branding */}
        <View style={styles.brandingContainer}>
          <Text style={styles.brandingText}>CricZone</Text>
          <Text style={styles.brandingSubtext}>Your Cricket Companion</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: fontSizes.md,
    color: '#64748b',
    fontWeight: fontWeights.medium,
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: fontWeights.bold,
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  avatarButton: {
    marginLeft: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  avatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: fontWeights.bold,
  },
  welcomeContainer: {
    marginBottom: spacing.xl,
  },
  welcomeText: {
    fontSize: fontSizes.lg,
    color: '#475569',
    lineHeight: 26,
  },
  sectionsContainer: {
    gap: spacing.lg,
  },
  sectionCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.lg,
  },
  sectionCardDisabled: {
    opacity: 0.85,
  },
  cardPattern: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  patternCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  patternCircle1: {
    width: 150,
    height: 150,
    top: -50,
    right: -30,
  },
  patternCircle2: {
    width: 100,
    height: 100,
    bottom: -30,
    right: 50,
  },
  cardContent: {
    padding: spacing.xl,
  },
  cardIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cardTextContent: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: fontWeights.bold,
    color: '#fff',
    marginBottom: spacing.sm,
    letterSpacing: -0.3,
  },
  cardDescription: {
    fontSize: fontSizes.md,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 22,
  },
  cardButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    ...shadows.sm,
  },
  cardButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  cardButtonText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
    marginRight: spacing.sm,
  },
  cardButtonTextDisabled: {
    color: '#fff',
    marginRight: 0,
  },
  disabledBadge: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  disabledBadgeText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: '#fff',
    letterSpacing: 1,
  },
  brandingContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
  },
  brandingText: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: '#cbd5e1',
    letterSpacing: 1,
  },
  brandingSubtext: {
    fontSize: fontSizes.sm,
    color: '#cbd5e1',
    marginTop: 4,
  },
  // Icon Styles
  iconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Cricket Bat Icon
  batHandle: {
    position: 'absolute',
    width: 4,
    height: 14,
    borderRadius: 2,
    top: 0,
    transform: [{ rotate: '-45deg' }],
  },
  batBlade: {
    position: 'absolute',
    width: 10,
    height: 20,
    borderRadius: 3,
    bottom: 2,
    transform: [{ rotate: '-45deg' }],
  },
  ball: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    right: 2,
    top: 2,
  },
  // Trophy Icon
  trophyCup: {
    width: 20,
    height: 16,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  trophyBase: {
    position: 'absolute',
    bottom: 2,
    width: 14,
    height: 4,
    borderRadius: 1,
  },
  trophyStar: {
    position: 'absolute',
    top: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Clock Icon
  clockFace: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
  },
  clockHand: {
    position: 'absolute',
    width: 2,
    height: 8,
    borderRadius: 1,
    top: 8,
  },
  clockHandShort: {
    position: 'absolute',
    width: 6,
    height: 2,
    borderRadius: 1,
    right: 10,
  },
  // Arrow Icon
  arrowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 16,
    height: 16,
  },
  arrowLine: {
    width: 10,
    height: 2,
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
    marginLeft: -2,
  },
});

export default DashboardScreen;
