import React, { useState, useContext, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import matchService from '../utils/matchService';
import { colors, spacing, borderRadius, fontSizes, fontWeights, shadows } from '../utils/theme';

const { width } = Dimensions.get('window');

// Dropdown Component with horizontal pill options
const Dropdown = ({ label, value, options, onSelect, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const toggleDropdown = () => {
    const toValue = isOpen ? 0 : 1;
    Animated.parallel([
      Animated.spring(animatedHeight, {
        toValue,
        friction: 8,
        tension: 100,
        useNativeDriver: false,
      }),
      Animated.timing(rotateAnim, {
        toValue,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    setIsOpen(!isOpen);
  };

  const selectOption = (option) => {
    onSelect(option);
    toggleDropdown();
  };

  // Calculate height based on rows needed (5 items per row)
  const itemsPerRow = 5;
  const rows = Math.ceil(options.length / itemsPerRow);
  const optionsHeight = rows * 52 + 16;

  const maxHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, optionsHeight],
  });

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.dropdownContainer}>
      <View style={styles.dropdownRow}>
        <View style={styles.dropdownLabelContainer}>
          <View style={styles.dropdownIconWrapper}>
            {icon}
          </View>
          <Text style={styles.dropdownLabel}>{label}</Text>
        </View>
        <TouchableOpacity
          style={[styles.dropdownButton, isOpen && styles.dropdownButtonActive]}
          onPress={toggleDropdown}
          activeOpacity={0.7}
        >
          <Text style={styles.dropdownValue}>{value}</Text>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <View style={styles.chevron}>
              <View style={styles.chevronLine1} />
              <View style={styles.chevronLine2} />
            </View>
          </Animated.View>
        </TouchableOpacity>
      </View>
      <Animated.View style={[styles.dropdownOptions, { maxHeight }]}>
        <View style={styles.optionsPillContainer}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.toString()}
              style={[
                styles.optionPill,
                value === option.toString() && styles.optionPillActive,
              ]}
              onPress={() => selectOption(option.toString())}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.optionPillText,
                  value === option.toString() && styles.optionPillTextActive,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </View>
  );
};

// Icon Components
const PlayersIcon = () => (
  <View style={styles.iconBox}>
    <View style={styles.personIcon}>
      <View style={styles.personHead} />
      <View style={styles.personBody} />
    </View>
  </View>
);

const OversIcon = () => (
  <View style={styles.iconBox}>
    <View style={styles.ballIcon} />
  </View>
);

const BallsIcon = () => (
  <View style={styles.iconBox}>
    <View style={styles.ballsContainer}>
      <View style={styles.smallBall} />
      <View style={styles.smallBall} />
      <View style={styles.smallBall} />
    </View>
  </View>
);

const MatchSetupScreen = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const teamAInputRef = useRef(null);
  const teamBInputRef = useRef(null);

  // Match settings
  const [battingTeam, setBattingTeam] = useState('Team A');
  const [bowlingTeam, setBowlingTeam] = useState('Team B');
  const [overs, setOvers] = useState('6');
  const [playersPerTeam, setPlayersPerTeam] = useState('6');
  const [ballsPerOver, setBallsPerOver] = useState('6');
  const [isEditingBatting, setIsEditingBatting] = useState(false);
  const [isEditingBowling, setIsEditingBowling] = useState(false);

  // Dropdown options
  const playerOptions = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const overOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50];
  const ballsOptions = [2, 3, 4, 5, 6];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleTeamNamePress = (team) => {
    if (team === 'batting') {
      setIsEditingBatting(true);
      setTimeout(() => {
        teamAInputRef.current?.focus();
        teamAInputRef.current?.setNativeProps({ selection: { start: 0, end: battingTeam.length } });
      }, 100);
    } else {
      setIsEditingBowling(true);
      setTimeout(() => {
        teamBInputRef.current?.focus();
        teamBInputRef.current?.setNativeProps({ selection: { start: 0, end: bowlingTeam.length } });
      }, 100);
    }
  };

  const handleStartMatch = async () => {
    const teamA = battingTeam.trim() || 'Team A';
    const teamB = bowlingTeam.trim() || 'Team B';

    if (teamA === teamB) {
      Alert.alert('Error', 'Team names must be different');
      return;
    }

    setLoading(true);

    const matchData = {
      teamA: { name: teamA, shortName: teamA.substring(0, 3).toUpperCase() },
      teamB: { name: teamB, shortName: teamB.substring(0, 3).toUpperCase() },
      totalOvers: parseInt(overs),
      playersPerTeam: parseInt(playersPerTeam),
      ballsPerOver: parseInt(ballsPerOver),
      matchType: 'T20',
      venue: 'Not specified',
      toss: {
        winner: teamA,
        decision: 'bat',
      },
    };

    try {
      if (user?.token) {
        const response = await matchService.createMatch(matchData, user.token);
        navigation.replace('ScoreCard', {
          matchData: response.data || response,
          matchSettings: matchData,
        });
      } else {
        const guestMatch = {
          _id: `guest_${Date.now()}`,
          ...matchData,
          status: 'in_progress',
          date: new Date().toISOString(),
        };
        navigation.replace('ScoreCard', {
          matchData: guestMatch,
          matchSettings: matchData,
        });
      }
    } catch (error) {
      Alert.alert('Error', error.error || 'Failed to create match. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <View style={styles.backIcon}>
            <View style={styles.backArrow} />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Match</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Team Setup Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Team Setup</Text>
            <View style={styles.teamCard}>
              {/* VS Circle */}
              <View style={styles.vsCircle}>
                <Text style={styles.vsText}>VS</Text>
              </View>

              {/* Team Container */}
              <View style={styles.teamsContainer}>
                {/* Batting Team - Left */}
                <View style={styles.teamBox}>
                  <View style={styles.teamLabelContainer}>
                    <View style={styles.batIconSmall}>
                      <View style={styles.batHandle} />
                      <View style={styles.batBlade} />
                    </View>
                    <Text style={styles.teamLabel}>Batting</Text>
                  </View>

                  {isEditingBatting ? (
                    <TextInput
                      ref={teamAInputRef}
                      style={styles.teamInput}
                      value={battingTeam}
                      onChangeText={setBattingTeam}
                      onBlur={() => setIsEditingBatting(false)}
                      selectTextOnFocus={true}
                      maxLength={20}
                      autoFocus
                    />
                  ) : (
                    <TouchableOpacity
                      style={styles.teamNameButton}
                      onPress={() => handleTeamNamePress('batting')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.teamName} numberOfLines={1}>
                        {battingTeam || 'Team A'}
                      </Text>
                      <View style={styles.editHint}>
                        <Text style={styles.editHintText}>Tap to edit</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Bowling Team - Right */}
                <View style={styles.teamBox}>
                  <View style={styles.teamLabelContainer}>
                    <View style={styles.ballIconSmall} />
                    <Text style={styles.teamLabel}>Bowling</Text>
                  </View>

                  {isEditingBowling ? (
                    <TextInput
                      ref={teamBInputRef}
                      style={styles.teamInput}
                      value={bowlingTeam}
                      onChangeText={setBowlingTeam}
                      onBlur={() => setIsEditingBowling(false)}
                      selectTextOnFocus={true}
                      maxLength={20}
                      autoFocus
                    />
                  ) : (
                    <TouchableOpacity
                      style={styles.teamNameButton}
                      onPress={() => handleTeamNamePress('bowling')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.teamName} numberOfLines={1}>
                        {bowlingTeam || 'Team B'}
                      </Text>
                      <View style={styles.editHint}>
                        <Text style={styles.editHintText}>Tap to edit</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Match Options Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Match Options</Text>
            <View style={styles.optionsCard}>
              <Dropdown
                label="Players per Team"
                value={playersPerTeam}
                options={playerOptions}
                onSelect={setPlayersPerTeam}
                icon={<PlayersIcon />}
              />

              <View style={styles.divider} />

              <Dropdown
                label="Number of Overs"
                value={overs}
                options={overOptions}
                onSelect={setOvers}
                icon={<OversIcon />}
              />

              <View style={styles.divider} />

              <Dropdown
                label="Balls per Over"
                value={ballsPerOver}
                options={ballsOptions}
                onSelect={setBallsPerOver}
                icon={<BallsIcon />}
              />
            </View>
          </View>

          {/* Match Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Match Format</Text>
              <Text style={styles.summaryValue}>
                {overs} Overs • {ballsPerOver} Balls/Over
              </Text>
            </View>
          </View>

          {/* Start Match Button */}
          <TouchableOpacity
            style={[styles.startButton, loading && styles.startButtonDisabled]}
            onPress={handleStartMatch}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <View style={styles.playIcon}>
                  <View style={styles.playTriangle} />
                </View>
                <Text style={styles.startButtonText}>Start Match</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Footer Note */}
          <Text style={styles.footerNote}>
            {battingTeam || 'Team A'} will bat first
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    width: 12,
    height: 12,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: '#64748b',
    transform: [{ rotate: '45deg' }, { translateX: 2 }],
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: fontWeights.bold,
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 44,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: fontWeights.semibold,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  // Team Card Styles
  teamCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    ...shadows.md,
    shadowColor: '#0f172a',
    position: 'relative',
    minHeight: 160,
  },
  vsCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    ...shadows.md,
    shadowColor: colors.primary,
  },
  vsText: {
    fontSize: 12,
    fontWeight: fontWeights.bold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  teamsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    maxWidth: '42%',
  },
  teamLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  teamLabel: {
    fontSize: 12,
    fontWeight: fontWeights.semibold,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  teamNameButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    width: '100%',
  },
  teamName: {
    fontSize: 18,
    fontWeight: fontWeights.bold,
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  teamInput: {
    fontSize: 18,
    fontWeight: fontWeights.bold,
    color: '#0f172a',
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    width: '100%',
    letterSpacing: -0.3,
  },
  editHint: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
  },
  editHintText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: fontWeights.medium,
  },
  // Small Icons for team labels
  batIconSmall: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  batHandle: {
    position: 'absolute',
    width: 2,
    height: 8,
    backgroundColor: '#64748b',
    borderRadius: 1,
    top: 0,
    transform: [{ rotate: '-45deg' }],
  },
  batBlade: {
    position: 'absolute',
    width: 6,
    height: 10,
    backgroundColor: '#64748b',
    borderRadius: 2,
    bottom: 0,
    transform: [{ rotate: '-45deg' }],
  },
  ballIconSmall: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#64748b',
  },
  // Options Card Styles
  optionsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: spacing.sm,
    ...shadows.md,
    shadowColor: '#0f172a',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginHorizontal: spacing.lg,
  },
  // Dropdown Styles
  dropdownContainer: {
    overflow: 'hidden',
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dropdownLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  dropdownLabel: {
    fontSize: 15,
    fontWeight: fontWeights.medium,
    color: '#334155',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    minWidth: 80,
    justifyContent: 'center',
  },
  dropdownValue: {
    fontSize: 16,
    fontWeight: fontWeights.bold,
    color: colors.primary,
    marginRight: spacing.sm,
  },
  chevron: {
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronLine1: {
    position: 'absolute',
    width: 7,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }, { translateX: -2 }],
  },
  chevronLine2: {
    position: 'absolute',
    width: 7,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }, { translateX: 2 }],
  },
  dropdownOptions: {
    marginHorizontal: spacing.md,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  dropdownButtonActive: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  optionsPillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: 8,
  },
  optionPill: {
    minWidth: 48,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionPillActive: {
    backgroundColor: '#eef2ff',
    borderColor: colors.primary,
  },
  optionPillText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: fontWeights.semibold,
  },
  optionPillTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.bold,
  },
  // Icon styles
  iconBox: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personIcon: {
    alignItems: 'center',
  },
  personHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginBottom: 2,
  },
  personBody: {
    width: 14,
    height: 8,
    backgroundColor: colors.primary,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  ballIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },
  ballsContainer: {
    flexDirection: 'row',
    gap: 3,
  },
  smallBall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  // Summary Card
  summaryCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: fontWeights.medium,
  },
  summaryValue: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: fontWeights.bold,
  },
  // Start Button
  startButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
  },
  startButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0.2,
  },
  playIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#fff',
    marginLeft: 2,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: fontWeights.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
  // Footer Note
  footerNote: {
    textAlign: 'center',
    marginTop: spacing.lg,
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: fontWeights.medium,
  },
});

export default MatchSetupScreen;
