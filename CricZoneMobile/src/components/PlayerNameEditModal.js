import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Modal,
  Keyboard,
  FlatList,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import suggestionService from '../utils/suggestionService';
import { colors, spacing, borderRadius, fontWeights } from '../utils/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PlayerNameEditModal = ({
  visible,
  initialValue = '',
  onClose,
  onSave,
  title = 'Edit Name',
  placeholder = 'Enter player name',
  type = 'player', // 'player' or 'team'
}) => {
  const [value, setValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);
  const debounceTimer = useRef(null);
  const requestId = useRef(0);

  // Reset value when modal opens
  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      // Fetch initial suggestions
      if (initialValue.trim().length >= 1) {
        fetchSuggestions(initialValue.trim());
      } else {
        // Show recent suggestions when empty
        fetchRecentSuggestions();
      }
      // Focus input after a short delay
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setSuggestions([]);
    }
  }, [visible, initialValue]);

  // Fetch recent/popular suggestions when input is empty
  const fetchRecentSuggestions = async () => {
    try {
      const results = type === 'player'
        ? await suggestionService.getPlayerSuggestions('')
        : await suggestionService.getTeamSuggestions('');
      setSuggestions(results.slice(0, 10));
    } catch (error) {
      setSuggestions([]);
    }
  };

  // Fetch suggestions - fast with no debounce for immediate response
  const fetchSuggestions = async (query) => {
    requestId.current += 1;
    const currentRequestId = requestId.current;

    try {
      const results = type === 'player'
        ? await suggestionService.getPlayerSuggestions(query)
        : await suggestionService.getTeamSuggestions(query);

      if (currentRequestId === requestId.current) {
        setSuggestions(results);
      }
    } catch (error) {
      if (currentRequestId === requestId.current) {
        setSuggestions([]);
      }
    }
  };

  // Handle text change with very short debounce (50ms) for fast response
  const handleTextChange = useCallback((text) => {
    setValue(text);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (text.trim().length >= 1) {
      // Very short debounce for fast suggestions
      debounceTimer.current = setTimeout(() => {
        fetchSuggestions(text.trim());
      }, 50);
    } else {
      fetchRecentSuggestions();
    }
  }, [type]);

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion) => {
    setValue(suggestion.name);
    // Save selected suggestion to bump its usage count
    suggestionService.addSuggestion(suggestion.name, type);
    // Close modal with selected name
    handleSave(suggestion.name);
  };

  // Handle save/done
  const handleSave = (nameToSave = value) => {
    const trimmedName = nameToSave.trim();
    if (trimmedName) {
      // Save to suggestions for future use
      suggestionService.addSuggestion(trimmedName, type);
      onSave(trimmedName);
    }
    onClose();
  };

  // Handle cancel
  const handleCancel = () => {
    onClose();
  };

  // Handle backdrop press (save with current value)
  const handleBackdropPress = () => {
    handleSave();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const isPopular = (suggestion) => suggestion.usageCount >= 50;

  const renderSuggestionItem = ({ item: suggestion, index }) => (
    <TouchableOpacity
      style={[
        styles.suggestionItem,
        index === suggestions.length - 1 && styles.suggestionItemLast,
      ]}
      onPress={() => handleSelectSuggestion(suggestion)}
      activeOpacity={0.7}
    >
      <Text style={styles.suggestionText} numberOfLines={1}>
        {suggestion.name}
      </Text>
      {isPopular(suggestion) && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>Popular</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoid}
          >
            <TouchableWithoutFeedback>
              <View style={styles.modalContainer}>
                {/* Title */}
                <Text style={styles.title}>{title}</Text>

                {/* Input Field */}
                <View style={styles.inputContainer}>
                  <TextInput
                    ref={inputRef}
                    style={styles.input}
                    value={value}
                    onChangeText={handleTextChange}
                    placeholder={placeholder}
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={() => handleSave()}
                    selectTextOnFocus
                    maxLength={30}
                  />
                  {value.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => {
                        setValue('');
                        fetchRecentSuggestions();
                      }}
                    >
                      <View style={styles.clearIcon}>
                        <View style={[styles.clearLine, { transform: [{ rotate: '45deg' }] }]} />
                        <View style={[styles.clearLine, { transform: [{ rotate: '-45deg' }] }]} />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Suggestions List */}
                {suggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsLabel}>
                      {value.trim().length > 0 ? 'Suggestions' : 'Recent Players'}
                    </Text>
                    <FlatList
                      data={suggestions}
                      renderItem={renderSuggestionItem}
                      keyExtractor={(item, idx) => item._id || `${item.name}-${idx}`}
                      keyboardShouldPersistTaps="always"
                      showsVerticalScrollIndicator={suggestions.length > 5}
                      bounces={false}
                      style={styles.suggestionsList}
                    />
                  </View>
                )}

                {/* Buttons */}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancel}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={() => handleSave()}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
  },
  keyboardAvoid: {
    flex: 1,
  },
  modalContainer: {
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    maxHeight: SCREEN_HEIGHT * 0.6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    paddingVertical: 14,
  },
  clearButton: {
    padding: 8,
  },
  clearIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearLine: {
    position: 'absolute',
    width: 14,
    height: 2,
    backgroundColor: '#94a3b8',
    borderRadius: 1,
  },
  suggestionsContainer: {
    marginTop: 16,
    maxHeight: 250,
  },
  suggestionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionsList: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  popularBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  popularBadgeText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  doneButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default PlayerNameEditModal;
