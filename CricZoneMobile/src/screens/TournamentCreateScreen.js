import React, { useState, useContext, useRef, useEffect, useMemo } from 'react';
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
import GradientHeader from '../components/GradientHeader';
import { colors, spacing, fontWeights, shadows } from '../utils/theme';

// Dropdown Component (same pattern as MatchSetupScreen)
// When `disabled` is true, the dropdown becomes a read-only chip with a small
// lock indicator — used in edit mode for fields that can't change after the
// tournament's matches have been generated.
const Dropdown = ({ label, value, options, onSelect, icon, info, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;

  const toggleDropdown = () => {
    if (disabled) return;
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
          {info && (
            <TouchableOpacity
              style={[styles.infoBadge, showInfo && styles.infoBadgeActive]}
              onPress={() => setShowInfo((v) => !v)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.infoBadgeText, showInfo && styles.infoBadgeTextActive]}>i</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.dropdownButton,
            isOpen && styles.dropdownButtonActive,
            disabled && styles.dropdownButtonDisabled,
          ]}
          onPress={toggleDropdown}
          activeOpacity={disabled ? 1 : 0.7}
        >
          <Text style={[styles.dropdownValue, disabled && styles.dropdownValueDisabled]}>{value}</Text>
          {disabled ? (
            <View style={styles.lockIcon}>
              <View style={styles.lockShackle} />
              <View style={styles.lockBody} />
            </View>
          ) : (
            <View style={styles.chevronIcon}>
              <View style={[styles.chevronLine, { transform: [{ rotate: '45deg' }, { translateX: -2 }] }]} />
              <View style={[styles.chevronLine, { transform: [{ rotate: '-45deg' }, { translateX: 2 }] }]} />
            </View>
          )}
        </TouchableOpacity>
      </View>
      {info && showInfo && (
        <Text style={styles.infoHint}>{info}</Text>
      )}
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
  // Format: 'quick' | 'knockout' | 'league'.
  // Edit mode preserves the existing format; create mode reads from route param.
  const format = existingData?.format || route.params?.format || 'quick';
  // Any group/league match already started? Changing the team count / number of
  // groups / matches-per-pair rebuilds the group schedule and clears results, so
  // we confirm before saving those.
  const matchesStarted = !!isEditMode && (existingData?.matches || []).some(
    (m) => m.status && m.status !== 'scheduled',
  );
  // Teams-advancing and playoff format only depend on the final standings, so
  // they stay editable until the playoffs themselves start.
  const knockoutStarted = !!isEditMode && (existingData?.matches || []).some(
    (m) => m.stage === 'knockout' && m.status && m.status !== 'scheduled',
  );
  // Team count rebuilds for league tournaments only; locked when editing a
  // knockout/quick tournament (their bracket isn't regenerated on update).
  const teamsLocked = isEditMode && format !== 'league';

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
  // Visibility: 'public' (anyone signed in can see live scores) or 'private'.
  // Default 'public' so the live feed has content unless the creator opts out.
  const [visibility, setVisibility] = useState(existingData?.visibility || 'public');

  // League-only configuration. Defaults match the user's example
  // (2 groups, top 2 from each → cross-paired knockout, single round-robin).
  const [numberOfGroups, setNumberOfGroups] = useState(
    (existingData?.numberOfGroups || 2).toString()
  );
  const [teamsAdvancePerGroup, setTeamsAdvancePerGroup] = useState(
    (existingData?.teamsAdvancePerGroup ?? 2).toString()
  );
  const [matchesPerPair, setMatchesPerPair] = useState(
    (existingData?.matchesPerPair || 1).toString()
  );
  // Playoff format: 'knockout' (semis/finals bracket) or 'qualifier' (IPL-style:
  // Qualifier 1, Eliminator, Qualifier 2, Final) — only valid for a top-4 playoff.
  const [playoffFormat, setPlayoffFormat] = useState(
    existingData?.playoffFormat || 'knockout'
  );
  // Qualifier playoffs require exactly 4 teams advancing overall (top 4).
  const advancingTotal = (parseInt(numberOfGroups, 10) || 0) * (parseInt(teamsAdvancePerGroup, 10) || 0);
  const qualifierAvailable = advancingTotal === 4;

  // Team name edit modal state
  const [teamNameModal, setTeamNameModal] = useState({
    visible: false,
    index: null,
    currentName: '',
  });

  // Collapsible Team Names section
  const [teamNamesExpanded, setTeamNamesExpanded] = useState(false);
  const teamNamesChevron = useRef(new Animated.Value(0)).current;
  const toggleTeamNames = () => {
    Animated.spring(teamNamesChevron, {
      toValue: teamNamesExpanded ? 0 : 1,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
    setTeamNamesExpanded((v) => !v);
  };
  const teamNamesChevronRotate = teamNamesChevron.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
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

    // League validations — surface them client-side so the user gets a clear
    // message rather than a generic backend 500.
    if (format === 'league') {
      const groups = parseInt(numberOfGroups, 10);
      const advance = parseInt(teamsAdvancePerGroup, 10);
      const smallestGroupSize = Math.floor(numTeams / groups);
      if (groups > numTeams) {
        Alert.alert('Error', 'Number of groups cannot exceed team count.');
        setLoading(false); return;
      }
      if (smallestGroupSize < 2) {
        Alert.alert('Error', `Each group needs at least 2 teams. With ${numTeams} teams in ${groups} groups the smallest group would have ${smallestGroupSize}.`);
        setLoading(false); return;
      }
      if (advance > smallestGroupSize) {
        Alert.alert('Error', `Cannot advance ${advance} teams when the smallest group only has ${smallestGroupSize}.`);
        setLoading(false); return;
      }
    }

    const data = {
      name: name.trim(),
      numberOfTeams: numTeams,
      teamNames: finalTeamNames,
      playersPerTeam: parseInt(playersPerTeam),
      totalOvers: parseInt(totalOvers),
      ballsPerOver: parseInt(ballsPerOver),
      venue: venue.trim(),
      description: description.trim(),
      format,
      visibility,
      ...(format === 'league' ? {
        numberOfGroups: parseInt(numberOfGroups, 10),
        teamsAdvancePerGroup: parseInt(teamsAdvancePerGroup, 10),
        matchesPerPair: parseInt(matchesPerPair, 10),
        // Qualifier playoffs only make sense for a top-4 bracket.
        playoffFormat: (parseInt(numberOfGroups, 10) * parseInt(teamsAdvancePerGroup, 10) === 4 && playoffFormat === 'qualifier')
          ? 'qualifier' : 'knockout',
      } : {}),
    };

    try {
      if (isEditMode) {
        // A GROUP change (team count / number of groups / matches-per-pair)
        // reshapes the group schedule → the backend rebuilds every match (so
        // per-team renames are skipped, and we confirm if it clears results).
        const groupChanged = format === 'league' && (
          parseInt(numberOfTeams, 10) !== existingData?.numberOfTeams ||
          parseInt(numberOfGroups, 10) !== existingData?.numberOfGroups ||
          parseInt(matchesPerPair, 10) !== existingData?.matchesPerPair
        );

        // Confirm a destructive rebuild (group change after matches have started).
        if (groupChanged && matchesStarted) {
          const ok = await new Promise((resolve) => {
            Alert.alert(
              'Rebuild schedule?',
              'Changing the teams, number of groups, or matches per pair rebuilds the whole schedule and clears all played results. Continue?',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Rebuild', style: 'destructive', onPress: () => resolve(true) },
              ],
            );
          });
          if (!ok) { setLoading(false); return; }
        }

        // 1) Team renames first (name-only edits) — propagate through every
        //    match so the bracket/schedule stay consistent. Skipped on a group
        //    rebuild (those matches are about to be recreated).
        if (!groupChanged) {
          const originalNames = (existingData?.teamNames || []);
          for (let i = 0; i < finalTeamNames.length; i++) {
            const oldName = (originalNames[i] || '').trim();
            const newName = finalTeamNames[i];
            if (oldName && newName && oldName !== newName) {
              try {
                await tournamentService.renameTeam(route.params.tournamentId, oldName, newName, user.token);
              } catch (e) {
                const message = e?.error || e?.response?.data?.error || `Could not rename "${oldName}".`;
                Alert.alert('Rename failed', message);
                setLoading(false);
                return;
              }
            }
          }
        }
        // 2) Save the settings (format isn't editable). The backend rebuilds the
        //    league/knockout as needed, or propagates basic settings.
        const { format: _fmt, ...editable } = data;
        const resp = await tournamentService.updateTournament(route.params.tournamentId, editable, user.token);
        if (resp?.warning) {
          Alert.alert('Saved', resp.warning);
        } else {
          Alert.alert('Success', 'Tournament updated successfully.');
        }
        navigation.goBack();
      } else {
        const res = await tournamentService.createTournament(data, user.token);
        const created = res?.data || res;
        // Knockout / League: jump straight into the auto-generated schedule.
        if (format === 'knockout' && created?._id) {
          navigation.replace('KnockoutSchedule', { tournamentId: created._id });
        } else if (format === 'league' && created?._id) {
          navigation.replace('LeagueSchedule', { tournamentId: created._id });
        } else {
          navigation.goBack();
        }
      }
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

  // Total matches the chosen settings will generate — mirrors the backend:
  // knockout = teams-1; league = per-group round-robins (× matches-per-pair)
  // plus playoffs (advancing-1, or 4 for a qualifier). Quick pre-generates none.
  const totalMatches = useMemo(() => {
    const teams = parseInt(numberOfTeams, 10) || 0;
    if (format === 'knockout') return Math.max(0, teams - 1);
    if (format === 'league') {
      const groups = Math.max(1, parseInt(numberOfGroups, 10) || 1);
      const mpp = Math.max(1, parseInt(matchesPerPair, 10) || 1);
      const advance = Math.max(0, parseInt(teamsAdvancePerGroup, 10) || 0);
      const base = Math.floor(teams / groups);
      const rem = teams % groups;
      let group = 0;
      for (let i = 0; i < groups; i++) {
        const size = base + (i < rem ? 1 : 0);
        group += (size * (size - 1) / 2) * mpp;
      }
      const advancing = groups * advance;
      let playoff = 0;
      if (advance > 0 && advancing >= 2) {
        playoff = (playoffFormat === 'qualifier' && advancing === 4) ? 4 : advancing - 1;
      }
      return group + playoff;
    }
    return 0;
  }, [format, numberOfTeams, numberOfGroups, matchesPerPair, teamsAdvancePerGroup, playoffFormat]);

  const matchCountLabel = `${totalMatches} ${totalMatches === 1 ? 'match' : 'matches'} total`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <GradientHeader
        title={isEditMode ? 'Edit Tournament' : 'New Tournament'}
        subtitle={format === 'quick'
          ? (isEditMode ? 'Update tournament details' : 'Set up your format')
          : matchCountLabel}
        onBack={() => navigation.goBack()}
        rightSlot={
          isEditMode ? (
            <TouchableOpacity
              style={styles.headerSaveButton}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.headerSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          ) : null
        }
      />

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
                  disabled={teamsLocked}
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

            {/* League-only configuration */}
            {format === 'league' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>League Format</Text>
                {matchesStarted ? (
                  <Text style={styles.lockedNote}>
                    Changing teams, groups or matches-per-pair will rebuild the schedule and clear played results. Teams-advancing and playoff format stay editable until the playoffs start.
                  </Text>
                ) : null}
                <View style={styles.optionsCard}>
                  <Dropdown
                    label="Number of Groups"
                    value={numberOfGroups}
                    options={Array.from(
                      { length: Math.max(1, Math.floor(parseInt(numberOfTeams || '2', 10) / 2)) },
                      (_, i) => i + 1,
                    )}
                    onSelect={setNumberOfGroups}
                    disabled={false}
                    info="How many pools the teams are split into. Each team only plays others in its own group."
                  />
                  <View style={styles.divider} />
                  <Dropdown
                    label="Teams Advance per Group"
                    value={teamsAdvancePerGroup}
                    options={[0, 1, 2, 3, 4]}
                    onSelect={setTeamsAdvancePerGroup}
                    disabled={knockoutStarted}
                    info="Top teams from each group that move on to the knockout stage. Use 0 for no knockouts."
                  />
                  <View style={styles.divider} />
                  <Dropdown
                    label="Matches per Pair"
                    value={matchesPerPair}
                    options={[1, 2, 3, 4]}
                    onSelect={setMatchesPerPair}
                    disabled={false}
                    info="How many times each pair of teams plays. 1 = once, 2 = home & away."
                  />

                  {/* Playoff format — editable until the playoffs start */}
                  {!knockoutStarted && (parseInt(teamsAdvancePerGroup, 10) || 0) > 0 ? (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.playoffRow}>
                        <Text style={styles.dropdownLabel}>2nd Round Format</Text>
                        <View style={styles.playoffOptions}>
                          <TouchableOpacity
                            style={[styles.playoffPill, playoffFormat !== 'qualifier' || !qualifierAvailable ? styles.playoffPillActive : null]}
                            onPress={() => setPlayoffFormat('knockout')}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.playoffPillText, (playoffFormat !== 'qualifier' || !qualifierAvailable) && styles.playoffPillTextActive]}>Knockout</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.playoffPill,
                              playoffFormat === 'qualifier' && qualifierAvailable ? styles.playoffPillActive : null,
                              !qualifierAvailable ? styles.playoffPillDisabled : null,
                            ]}
                            onPress={() => qualifierAvailable && setPlayoffFormat('qualifier')}
                            activeOpacity={qualifierAvailable ? 0.8 : 1}
                          >
                            <Text style={[
                              styles.playoffPillText,
                              playoffFormat === 'qualifier' && qualifierAvailable && styles.playoffPillTextActive,
                              !qualifierAvailable && styles.playoffPillTextDisabled,
                            ]}>Qualifier</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={styles.playoffHint}>
                        {qualifierAvailable
                          ? (playoffFormat === 'qualifier'
                              ? 'IPL-style: Qualifier 1, Eliminator, Qualifier 2, Final.'
                              : 'Standard single-elimination (semifinals & final).')
                          : 'Qualifier (IPL-style) needs exactly 4 teams advancing.'}
                      </Text>
                    </>
                  ) : null}
                </View>
              </View>
            )}

            {/* Team Names (collapsible) */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.collapsibleHeader}
                onPress={toggleTeamNames}
                activeOpacity={0.7}
              >
                <Text style={styles.sectionTitle}>Team Names</Text>
                <Animated.View
                  style={[
                    styles.collapsibleChevron,
                    { transform: [{ rotate: teamNamesChevronRotate }] },
                  ]}
                >
                  <View style={[styles.chevronLine, { transform: [{ rotate: '45deg' }, { translateX: -2 }] }]} />
                  <View style={[styles.chevronLine, { transform: [{ rotate: '-45deg' }, { translateX: 2 }] }]} />
                </Animated.View>
              </TouchableOpacity>
              {teamNamesExpanded && (
                <>
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
                </>
              )}
            </View>

            {/* Visibility: Public live feed vs Private (owner-only) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Visibility</Text>
              <View style={styles.visibilityRow}>
                <TouchableOpacity
                  style={[styles.visibilityCard, visibility === 'public' && styles.visibilityCardActive]}
                  onPress={() => setVisibility('public')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.visibilityIcon, visibility === 'public' && styles.visibilityIconActive]}>
                    <View style={styles.globeRing} />
                    <View style={styles.globeMeridian} />
                  </View>
                  <Text style={[styles.visibilityTitle, visibility === 'public' && styles.visibilityTitleActive]}>Public</Text>
                  <Text style={styles.visibilityHint}>Shown on the live feed</Text>
                  {visibility === 'public' && <View style={styles.visibilityCheck} />}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.visibilityCard, visibility === 'private' && styles.visibilityCardActive]}
                  onPress={() => setVisibility('private')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.visibilityIcon, visibility === 'private' && styles.visibilityIconActive]}>
                    <View style={styles.lockShackleLg} />
                    <View style={styles.lockBodyLg} />
                  </View>
                  <Text style={[styles.visibilityTitle, visibility === 'private' && styles.visibilityTitleActive]}>Private</Text>
                  <Text style={styles.visibilityHint}>Only you can see it</Text>
                  {visibility === 'private' && <View style={styles.visibilityCheck} />}
                </TouchableOpacity>
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
  // Top-right Save chip in the gradient header (edit mode only).
  headerSaveButton: {
    minWidth: 70, height: 36,
    paddingHorizontal: 14, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerSaveText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.3 },

  // Visibility picker (Public / Private)
  visibilityRow: { flexDirection: 'row', gap: 12 },
  visibilityCard: {
    flex: 1, padding: 16, borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 2, borderColor: '#e2e8f0',
    alignItems: 'flex-start',
    position: 'relative',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8,
    elevation: 1,
  },
  visibilityCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  visibilityIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  visibilityIconActive: { backgroundColor: '#bfdbfe' },
  globeRing: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#2563eb',
  },
  globeMeridian: {
    position: 'absolute', width: 22, height: 2, backgroundColor: '#2563eb',
  },
  lockShackleLg: {
    width: 14, height: 8,
    borderTopLeftRadius: 7, borderTopRightRadius: 7,
    borderWidth: 2, borderBottomWidth: 0, borderColor: '#475569',
    marginBottom: -1,
  },
  lockBodyLg: {
    width: 20, height: 13,
    backgroundColor: '#475569', borderRadius: 3,
  },
  visibilityTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  visibilityTitleActive: { color: '#1e40af' },
  visibilityHint: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  visibilityCheck: {
    position: 'absolute', top: 12, right: 12,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#2563eb',
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
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  collapsibleChevron: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
    marginBottom: spacing.sm,
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
  // Playoff format selector
  playoffRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  playoffOptions: { flexDirection: 'row', gap: 8 },
  playoffPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9,
    borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff',
  },
  playoffPillActive: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  playoffPillDisabled: { backgroundColor: '#f8fafc', borderColor: '#f1f5f9' },
  playoffPillText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  playoffPillTextActive: { color: '#4338ca', fontWeight: '800' },
  playoffPillTextDisabled: { color: '#cbd5e1' },
  playoffHint: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    fontSize: 12, color: '#94a3b8', lineHeight: 17,
  },
  lockedNote: {
    fontSize: 12.5, color: '#b45309', lineHeight: 18,
    marginBottom: spacing.sm, fontWeight: '600',
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
  infoBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  infoBadgeActive: {
    backgroundColor: '#4f46e5',
  },
  infoBadgeText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: fontWeights.bold,
    color: '#4f46e5',
    fontStyle: 'italic',
  },
  infoBadgeTextActive: {
    color: '#ffffff',
  },
  infoHint: {
    fontSize: 13,
    lineHeight: 18,
    color: '#64748b',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    marginTop: -4,
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
  dropdownButtonDisabled: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  dropdownValue: {
    fontSize: 16,
    fontWeight: fontWeights.bold,
    color: '#d97706',
    marginRight: spacing.sm,
  },
  dropdownValueDisabled: { color: '#64748b' },
  lockIcon: { width: 12, height: 14, alignItems: 'center', justifyContent: 'flex-end' },
  lockShackle: {
    width: 8, height: 6,
    borderTopLeftRadius: 4, borderTopRightRadius: 4,
    borderWidth: 1.5, borderBottomWidth: 0, borderColor: '#64748b',
  },
  lockBody: {
    width: 12, height: 8,
    backgroundColor: '#94a3b8',
    borderRadius: 2,
    marginTop: -1,
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
