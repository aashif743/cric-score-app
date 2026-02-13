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
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import tournamentService from '../utils/tournamentService';
import PlayerNameEditModal from '../components/PlayerNameEditModal';
import { colors, spacing, fontWeights, shadows } from '../utils/theme';

// Dropdown Component (same pattern as MatchSetupScreen)
const Dropdown = ({ label, value, options, onSelect, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;

  const toggleDropdown = () => {
    const toValue = isOpen ? 0 : 1;
    Animated.spring(animatedHeight, {
      toValue,
      friction: 8,
      tension: 100,
      useNativeDriver: false,
    }).start();
    setIsOpen(!isOpen);
  };

  const selectOption = (option) => {
    onSelect(option);
    toggleDropdown();
  };

  const itemsPerRow = 5;
  const rows = Math.ceil(options.length / itemsPerRow);
  const optionsHeight = rows * 52 + 16;

  const maxHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, optionsHeight],
  });

  return (
    <View style={styles.dropdownContainer}>
      <View style={styles.dropdownRow}>
        <View style={styles.dropdownLabelContainer}>
          {icon && <View style={styles.dropdownIconWrapper}>{icon}</View>}
          <Text style={styles.dropdownLabel}>{label}</Text>
        </View>
        <TouchableOpacity
          style={[styles.dropdownButton, isOpen && styles.dropdownButtonActive]}
          onPress={toggleDropdown}
          activeOpacity={0.7}
        >
          <Text style={styles.dropdownValue}>{value}</Text>
          <View style={styles.chevronIcon}>
            <View style={[styles.chevronLine, { transform: [{ rotate: '45deg' }, { translateX: -2 }] }]} />
            <View style={[styles.chevronLine, { transform: [{ rotate: '-45deg' }, { translateX: 2 }] }]} />
          </View>
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

const TournamentCreateScreen = ({ navigation, route }) => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  // Edit mode
  const isEditMode = route.params?.tournamentId && route.params?.tournamentData;
  const existingData = route.params?.tournamentData;

  // Form state
  const [name, setName] = useState(existingData?.name || '');
  const [numberOfTeams, setNumberOfTeams] = useState(
    (existingData?.numberOfTeams || 4).toString()
  );
  const [teamNames, setTeamNames] = useState(
    existingData?.teamNames?.length > 0
      ? existingData.teamNames
      : Array(existingData?.numberOfTeams || 4).fill('')
  );
  const [playersPerTeam, setPlayersPerTeam] = useState(
    (existingData?.playersPerTeam || 11).toString()
  );
  const [totalOvers, setTotalOvers] = useState(
    (existingData?.totalOvers || 20).toString()
  );
  const [ballsPerOver, setBallsPerOver] = useState(
    (existingData?.ballsPerOver || 6).toString()
  );
  const [venue, setVenue] = useState(existingData?.venue || '');
  const [description, setDescription] = useState(existingData?.description || '');

  // Team name edit modal state
  const [teamNameModal, setTeamNameModal] = useState({
    visible: false,
    index: null,
    currentName: '',
  });

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

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

  // Update team name slots when numberOfTeams changes
  const handleTeamCountChange = (val) => {
    const num = parseInt(val);
    setNumberOfTeams(val);
    setTeamNames((prev) => {
      if (num > prev.length) {
        return [...prev, ...Array(num - prev.length).fill('')];
      }
      return prev.slice(0, num);
    });
  };

  const handleTeamNameChange = (index, value) => {
    setTeamNames((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const openTeamNameModal = (index) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRST';
    const currentName = teamNames[index] || '';
    setTeamNameModal({
      visible: true,
      index,
      currentName,
      defaultName: `Team ${alphabet[index] || index + 1}`,
    });
  };

  const handleTeamNameModalSave = (newName) => {
    if (teamNameModal.index !== null) {
      handleTeamNameChange(teamNameModal.index, newName);
    }
    setTeamNameModal({ visible: false, index: null, currentName: '' });
  };

  const closeTeamNameModal = () => {
    setTeamNameModal({ visible: false, index: null, currentName: '' });
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Tournament name is required.');
      return;
    }

    if (!user?.token) {
      Alert.alert('Error', 'You must be logged in.');
      return;
    }

    setLoading(true);

    // Generate default names for any empty team name slots
    const numTeams = parseInt(numberOfTeams);
    const alphabet = 'ABCDEFGHIJKLMNOPQRST';
    const finalTeamNames = Array.from({ length: numTeams }, (_, i) => {
      const userProvided = teamNames[i]?.trim();
      return userProvided || `Team ${alphabet[i] || i + 1}`;
    });

    const data = {
      name: name.trim(),
      numberOfTeams: numTeams,
      teamNames: finalTeamNames,
      playersPerTeam: parseInt(playersPerTeam),
      totalOvers: parseInt(totalOvers),
      ballsPerOver: parseInt(ballsPerOver),
      venue: venue.trim(),
      description: description.trim(),
    };

    try {
      if (isEditMode) {
        await tournamentService.updateTournament(route.params.tournamentId, data, user.token);
        Alert.alert('Success', 'Tournament updated successfully.');
      } else {
        await tournamentService.createTournament(data, user.token);
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.error || 'Failed to save tournament.');
    } finally {
      setLoading(false);
    }
  };

  const teamCountOptions = Array.from({ length: 19 }, (_, i) => i + 2);
  const playerOptions = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const overOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50];
  const ballsOptions = [2, 3, 4, 5, 6];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <View style={styles.backArrow} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Edit Tournament' : 'New Tournament'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
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
            {/* Tournament Name */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tournament Name</Text>
              <View style={styles.inputCard}>
                <TextInput
                  style={styles.nameInput}
                  placeholder="e.g. Summer League 2025"
                  placeholderTextColor="#94a3b8"
                  value={name}
                  onChangeText={setName}
                  maxLength={40}
                />
              </View>
            </View>

            {/* Match Options */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Match Settings</Text>
              <View style={styles.optionsCard}>
                <Dropdown
                  label="Number of Teams"
                  value={numberOfTeams}
                  options={teamCountOptions}
                  onSelect={handleTeamCountChange}
                />

                <View style={styles.divider} />

                <Dropdown
                  label="Players per Team"
                  value={playersPerTeam}
                  options={playerOptions}
                  onSelect={setPlayersPerTeam}
                />

                <View style={styles.divider} />

                <Dropdown
                  label="Overs"
                  value={totalOvers}
                  options={overOptions}
                  onSelect={setTotalOvers}
                />

                <View style={styles.divider} />

                <Dropdown
                  label="Balls per Over"
                  value={ballsPerOver}
                  options={ballsOptions}
                  onSelect={setBallsPerOver}
                />
              </View>
            </View>

            {/* Team Names */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Team Names</Text>
              <Text style={styles.sectionHint}>Tap to edit team names</Text>
              <View style={styles.teamNamesCard}>
                {teamNames.map((teamName, index) => {
                  const alphabet = 'ABCDEFGHIJKLMNOPQRST';
                  const defaultName = `Team ${alphabet[index] || index + 1}`;
                  const displayName = teamName?.trim() || defaultName;
                  const isDefault = !teamName?.trim();
                  return (
                    <View key={index}>
                      <TouchableOpacity
                        style={styles.teamNameItem}
                        onPress={() => openTeamNameModal(index)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.teamNameLeft}>
                          <View style={styles.teamNumberBadge}>
                            <Text style={styles.teamNumberText}>{index + 1}</Text>
                          </View>
                          <Text
                            style={[
                              styles.teamNameText,
                              isDefault && styles.teamNameTextDefault,
                            ]}
                            numberOfLines={1}
                          >
                            {displayName}
                          </Text>
                        </View>
                        <View style={styles.editIconContainer}>
                          <Text style={styles.editIcon}>✎</Text>
                        </View>
                      </TouchableOpacity>
                      {index < teamNames.length - 1 && <View style={styles.teamDivider} />}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Venue & Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Details (Optional)</Text>
              <View style={styles.inputCard}>
                <TextInput
                  style={styles.detailInput}
                  placeholder="Venue"
                  placeholderTextColor="#94a3b8"
                  value={venue}
                  onChangeText={setVenue}
                  maxLength={50}
                />
                <View style={styles.teamDivider} />
                <TextInput
                  style={[styles.detailInput, styles.descriptionInput]}
                  placeholder="Description"
                  placeholderTextColor="#94a3b8"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  maxLength={200}
                />
              </View>
            </View>

            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Tournament Format</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Teams</Text>
                <Text style={styles.summaryValue}>{numberOfTeams}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Format</Text>
                <Text style={styles.summaryValue}>
                  {totalOvers} Overs, {ballsPerOver} Balls/Over
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Players</Text>
                <Text style={styles.summaryValue}>{playersPerTeam} per team</Text>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isEditMode ? 'Save Changes' : 'Create Tournament'}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Team Name Edit Modal */}
      <PlayerNameEditModal
        visible={teamNameModal.visible}
        initialValue={teamNameModal.currentName}
        title={`Edit Team ${teamNameModal.index !== null ? teamNameModal.index + 1 : ''}`}
        placeholder={teamNameModal.defaultName || 'Enter team name'}
        type="team"
        onSave={handleTeamNameModalSave}
        onClose={closeTeamNameModal}
      />
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
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  sectionHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: spacing.lg,
    ...shadows.md,
    shadowColor: '#0f172a',
  },
  nameInput: {
    fontSize: 18,
    fontWeight: fontWeights.bold,
    color: '#0f172a',
    paddingVertical: spacing.sm,
  },
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
  teamDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginHorizontal: spacing.md,
  },
  teamNamesCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    ...shadows.small,
  },
  teamNameItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  teamNameLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  teamNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teamNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#d97706',
  },
  teamNameText: {
    fontSize: 15,
    fontWeight: fontWeights.semibold,
    color: '#1e293b',
    flex: 1,
  },
  teamNameTextDefault: {
    color: '#94a3b8',
    fontWeight: fontWeights.medium,
  },
  editIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIcon: {
    fontSize: 14,
    color: '#64748b',
  },
  detailInput: {
    fontSize: 15,
    fontWeight: fontWeights.medium,
    color: '#0f172a',
    paddingVertical: spacing.sm,
  },
  descriptionInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  // Dropdown styles
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
    backgroundColor: '#fef3c7',
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
  dropdownButtonActive: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#d97706',
  },
  dropdownValue: {
    fontSize: 16,
    fontWeight: fontWeights.bold,
    color: '#d97706',
    marginRight: spacing.sm,
  },
  chevronIcon: {
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronLine: {
    position: 'absolute',
    width: 7,
    height: 2,
    backgroundColor: '#d97706',
    borderRadius: 1,
  },
  dropdownOptions: {
    marginHorizontal: spacing.md,
    overflow: 'hidden',
    marginBottom: spacing.xs,
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
    backgroundColor: '#fef3c7',
    borderColor: '#d97706',
  },
  optionPillText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: fontWeights.semibold,
  },
  optionPillTextActive: {
    color: '#d97706',
    fontWeight: fontWeights.bold,
  },
  // Summary
  summaryCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: fontWeights.bold,
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#92400e',
    fontWeight: fontWeights.medium,
  },
  summaryValue: {
    fontSize: 15,
    color: '#78350f',
    fontWeight: fontWeights.bold,
  },
  // Submit
  submitButton: {
    backgroundColor: '#d97706',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
    shadowColor: '#d97706',
    shadowOpacity: 0.4,
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0.2,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: fontWeights.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
});

export default TournamentCreateScreen;
