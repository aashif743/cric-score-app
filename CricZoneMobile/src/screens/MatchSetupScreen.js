import React, { useState, useContext, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
  Dimensions,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import matchService from '../utils/matchService';
import suggestionService from '../utils/suggestionService';
import AutocompleteInput from '../components/AutocompleteInput';
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

const MatchSetupScreen = ({ navigation, route }) => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  // Tournament params
  const tournamentId = route.params?.tournamentId || null;
  const tournamentDefaults = route.params?.tournamentDefaults || null;

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const teamAInputRef = useRef(null);
  const teamBInputRef = useRef(null);

  // Match settings (use tournament defaults if available)
  const initialTeamNames = tournamentDefaults?.teamNames?.filter(Boolean) || [];
  const [battingTeam, setBattingTeam] = useState(
    initialTeamNames.length >= 2 ? initialTeamNames[0] : 'Team A'
  );
  const [bowlingTeam, setBowlingTeam] = useState(
    initialTeamNames.length >= 2 ? initialTeamNames[1] : 'Team B'
  );
  const [overs, setOvers] = useState(
    tournamentDefaults?.totalOvers?.toString() || '4'
  );
  const [playersPerTeam, setPlayersPerTeam] = useState(
    tournamentDefaults?.playersPerTeam?.toString() || '11'
  );
  const [ballsPerOver, setBallsPerOver] = useState(
    tournamentDefaults?.ballsPerOver?.toString() || '6'
  );
  const [isEditingBatting, setIsEditingBatting] = useState(false);
  const [isEditingBowling, setIsEditingBowling] = useState(false);

  // Tournament team selection
  const tournamentTeamNames = tournamentDefaults?.teamNames?.filter(Boolean) || [];
  const hasTournamentTeams = tournamentTeamNames.length >= 2;
  const [showBattingDropdown, setShowBattingDropdown] = useState(false);
  const [showBowlingDropdown, setShowBowlingDropdown] = useState(false);
  const battingDropdownAnim = useRef(new Animated.Value(0)).current;
  const bowlingDropdownAnim = useRef(new Animated.Value(0)).current;

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
      venue: tournamentDefaults?.venue || 'Not specified',
      toss: {
        winner: teamA,
        decision: 'bat',
      },
      ...(tournamentId ? { tournament: tournamentId } : {}),
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
        <Text style={styles.headerTitle}>{tournamentId ? 'Tournament Match' : 'New Match'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={() => Keyboard.dismiss()}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Tournament Info Banner */}
          {tournamentId && tournamentDefaults?.tournamentName && (
            <View style={styles.tournamentBanner}>
              <View style={styles.tournamentBannerIcon}>
                <View style={styles.trophyMini} />
                <View style={styles.trophyBaseMini} />
              </View>
              <View style={styles.tournamentBannerText}>
                <Text style={styles.tournamentBannerLabel}>Tournament</Text>
                <Text style={styles.tournamentBannerName} numberOfLines={1}>
                  {tournamentDefaults.tournamentName}
                </Text>
              </View>
            </View>
          )}

          {/* Team Setup Section */}
          <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Team Setup</Text>

            {/* Tournament Team Dropdowns */}
            {hasTournamentTeams ? (
              <View style={styles.tournamentTeamCard}>
                {/* Batting Team Dropdown */}
                <View style={styles.tournamentDropdownSection}>
                  <View style={styles.tournamentDropdownHeader}>
                    <View style={styles.teamLabelContainer}>
                      <View style={styles.batIconSmall}>
                        <View style={styles.batHandle} />
                        <View style={styles.batBlade} />
                      </View>
                      <Text style={styles.teamLabel}>Batting First</Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.tournamentDropdownTrigger,
                        showBattingDropdown && styles.tournamentDropdownTriggerOpen,
                      ]}
                      onPress={() => {
                        const opening = !showBattingDropdown;
                        setShowBattingDropdown(opening);
                        setShowBowlingDropdown(false);
                        Animated.spring(battingDropdownAnim, {
                          toValue: opening ? 1 : 0,
                          friction: 8,
                          tension: 100,
                          useNativeDriver: false,
                        }).start();
                        Animated.spring(bowlingDropdownAnim, {
                          toValue: 0,
                          friction: 8,
                          tension: 100,
                          useNativeDriver: false,
                        }).start();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.tournamentDropdownText} numberOfLines={1}>
                        {battingTeam}
                      </Text>
                      <View style={[
                        styles.tournamentChevron,
                        showBattingDropdown && styles.tournamentChevronOpen,
                      ]} />
                    </TouchableOpacity>
                  </View>
                  <Animated.View style={{
                    maxHeight: battingDropdownAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.ceil(tournamentTeamNames.length / 2) * 52 + 16],
                    }),
                    overflow: 'hidden',
                  }}>
                    <View style={styles.tournamentDropdownList}>
                      {tournamentTeamNames.map((tn) => (
                        <TouchableOpacity
                          key={tn}
                          style={[
                            styles.tournamentDropdownItem,
                            battingTeam === tn && styles.tournamentDropdownItemSelected,
                            bowlingTeam === tn && styles.tournamentDropdownItemDisabled,
                          ]}
                          onPress={() => {
                            if (bowlingTeam === tn) return;
                            setBattingTeam(tn);
                            setShowBattingDropdown(false);
                            Animated.spring(battingDropdownAnim, {
                              toValue: 0,
                              friction: 8,
                              tension: 100,
                              useNativeDriver: false,
                            }).start();
                          }}
                          disabled={bowlingTeam === tn}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.tournamentDropdownItemText,
                            battingTeam === tn && styles.tournamentDropdownItemTextSelected,
                            bowlingTeam === tn && styles.tournamentDropdownItemTextDisabled,
                          ]}>
                            {tn}
                          </Text>
                          {battingTeam === tn && (
                            <View style={styles.checkMark}>
                              <View style={styles.checkLine1} />
                              <View style={styles.checkLine2} />
                            </View>
                          )}
                          {bowlingTeam === tn && (
                            <Text style={styles.alreadySelectedTag}>BOWLING</Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Animated.View>
                </View>

                <View style={styles.tournamentVsDivider}>
                  <View style={styles.tournamentVsLine} />
                  <View style={styles.tournamentVsCircle}>
                    <Text style={styles.tournamentVsText}>VS</Text>
                  </View>
                  <View style={styles.tournamentVsLine} />
                </View>

                {/* Bowling Team Dropdown */}
                <View style={styles.tournamentDropdownSection}>
                  <View style={styles.tournamentDropdownHeader}>
                    <View style={styles.teamLabelContainer}>
                      <View style={styles.ballIconSmall} />
                      <Text style={styles.teamLabel}>Bowling First</Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.tournamentDropdownTrigger,
                        showBowlingDropdown && styles.tournamentDropdownTriggerOpen,
                      ]}
                      onPress={() => {
                        const opening = !showBowlingDropdown;
                        setShowBowlingDropdown(opening);
                        setShowBattingDropdown(false);
                        Animated.spring(bowlingDropdownAnim, {
                          toValue: opening ? 1 : 0,
                          friction: 8,
                          tension: 100,
                          useNativeDriver: false,
                        }).start();
                        Animated.spring(battingDropdownAnim, {
                          toValue: 0,
                          friction: 8,
                          tension: 100,
                          useNativeDriver: false,
                        }).start();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.tournamentDropdownText} numberOfLines={1}>
                        {bowlingTeam}
                      </Text>
                      <View style={[
                        styles.tournamentChevron,
                        showBowlingDropdown && styles.tournamentChevronOpen,
                      ]} />
                    </TouchableOpacity>
                  </View>
                  <Animated.View style={{
                    maxHeight: bowlingDropdownAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.ceil(tournamentTeamNames.length / 2) * 52 + 16],
                    }),
                    overflow: 'hidden',
                  }}>
                    <View style={styles.tournamentDropdownList}>
                      {tournamentTeamNames.map((tn) => (
                        <TouchableOpacity
                          key={tn}
                          style={[
                            styles.tournamentDropdownItem,
                            bowlingTeam === tn && styles.tournamentDropdownItemSelected,
                            battingTeam === tn && styles.tournamentDropdownItemDisabled,
                          ]}
                          onPress={() => {
                            if (battingTeam === tn) return;
                            setBowlingTeam(tn);
                            setShowBowlingDropdown(false);
                            Animated.spring(bowlingDropdownAnim, {
                              toValue: 0,
                              friction: 8,
                              tension: 100,
                              useNativeDriver: false,
                            }).start();
                          }}
                          disabled={battingTeam === tn}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.tournamentDropdownItemText,
                            bowlingTeam === tn && styles.tournamentDropdownItemTextSelected,
                            battingTeam === tn && styles.tournamentDropdownItemTextDisabled,
                          ]}>
                            {tn}
                          </Text>
                          {bowlingTeam === tn && (
                            <View style={styles.checkMark}>
                              <View style={styles.checkLine1} />
                              <View style={styles.checkLine2} />
                            </View>
                          )}
                          {battingTeam === tn && (
                            <Text style={styles.alreadySelectedTag}>BATTING</Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Animated.View>
                </View>
              </View>
            ) : (
              /* Original team card for non-tournament matches */
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
                      <View style={styles.autocompleteWrapper}>
                        <AutocompleteInput
                          value={battingTeam}
                          onChangeText={setBattingTeam}
                          type="team"
                          placeholder="Team A"
                          inputStyle={styles.teamInput}
                          onBlur={() => setIsEditingBatting(false)}
                          maxLength={20}
                          autoFocus
                          selectTextOnFocus={true}
                        />
                      </View>
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
                      <View style={styles.autocompleteWrapper}>
                        <AutocompleteInput
                          value={bowlingTeam}
                          onChangeText={setBowlingTeam}
                          type="team"
                          placeholder="Team B"
                          inputStyle={styles.teamInput}
                          onBlur={() => setIsEditingBowling(false)}
                          maxLength={20}
                          autoFocus
                          selectTextOnFocus={true}
                        />
                      </View>
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
            )}
          </View>
          </TouchableWithoutFeedback>

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
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
  },
  autocompleteWrapper: {
    width: '100%',
    zIndex: 1000,
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
  // Tournament Banner
  tournamentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 14,
    padding: 14,
    marginBottom: spacing.xl,
    gap: 12,
  },
  tournamentBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fde68a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trophyMini: {
    width: 14,
    height: 10,
    borderWidth: 2.5,
    borderBottomWidth: 0,
    borderColor: '#d97706',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
  },
  trophyBaseMini: {
    width: 8,
    height: 3,
    backgroundColor: '#d97706',
    borderRadius: 1,
    marginTop: -1,
  },
  tournamentBannerText: {
    flex: 1,
  },
  tournamentBannerLabel: {
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tournamentBannerName: {
    fontSize: 15,
    fontWeight: fontWeights.bold,
    color: '#78350f',
    marginTop: 1,
  },
  // Tournament Team Dropdown
  tournamentTeamCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: spacing.lg,
    ...shadows.md,
    shadowColor: '#0f172a',
  },
  tournamentDropdownSection: {
    marginBottom: 4,
  },
  tournamentDropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tournamentDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 130,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  tournamentDropdownTriggerOpen: {
    borderColor: '#d97706',
    backgroundColor: '#fef3c7',
  },
  tournamentDropdownText: {
    flex: 1,
    fontSize: 15,
    fontWeight: fontWeights.bold,
    color: '#0f172a',
    marginRight: 8,
  },
  tournamentChevron: {
    width: 8,
    height: 8,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#64748b',
    transform: [{ rotate: '45deg' }],
  },
  tournamentChevronOpen: {
    transform: [{ rotate: '-135deg' }],
    borderColor: '#d97706',
  },
  tournamentDropdownList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },
  tournamentDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 6,
  },
  tournamentDropdownItemSelected: {
    backgroundColor: '#fef3c7',
    borderColor: '#d97706',
  },
  tournamentDropdownItemDisabled: {
    opacity: 0.5,
  },
  tournamentDropdownItemText: {
    fontSize: 14,
    fontWeight: fontWeights.semibold,
    color: '#334155',
  },
  tournamentDropdownItemTextSelected: {
    color: '#92400e',
    fontWeight: fontWeights.bold,
  },
  tournamentDropdownItemTextDisabled: {
    color: '#94a3b8',
  },
  checkMark: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkLine1: {
    position: 'absolute',
    width: 6,
    height: 2,
    backgroundColor: '#d97706',
    borderRadius: 1,
    transform: [{ rotate: '45deg' }, { translateX: -2 }, { translateY: 2 }],
  },
  checkLine2: {
    position: 'absolute',
    width: 10,
    height: 2,
    backgroundColor: '#d97706',
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }, { translateX: 2 }, { translateY: 0 }],
  },
  alreadySelectedTag: {
    fontSize: 9,
    fontWeight: fontWeights.bold,
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  tournamentVsDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  tournamentVsLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  tournamentVsCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
    ...shadows.sm,
    shadowColor: colors.primary,
  },
  tournamentVsText: {
    fontSize: 11,
    fontWeight: fontWeights.bold,
    color: '#fff',
    letterSpacing: 0.5,
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
