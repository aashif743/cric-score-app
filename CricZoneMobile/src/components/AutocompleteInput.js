import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Keyboard,
  Platform,
  FlatList,
  Modal,
  Dimensions,
} from 'react-native';
import suggestionService from '../utils/suggestionService';
import { colors, spacing, borderRadius, fontWeights } from '../utils/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AutocompleteInput = ({
  value,
  onChangeText,
  type = 'player', // 'player' or 'team'
  placeholder = 'Enter name',
  style,
  inputStyle,
  onBlur,
  onFocus,
  selectTextOnFocus = true,
  maxLength = 30,
  returnKeyType = 'done',
  autoFocus = false,
  editable = true,
  saveSuggestion = true,
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [selection, setSelection] = useState(undefined);
  const [inputLayout, setInputLayout] = useState(null);

  const debounceTimer = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const hasSelectedSuggestion = useRef(false);
  const requestId = useRef(0);
  const isFocusedRef = useRef(false);

  // Measure input position on screen for dropdown placement
  const measureInput = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.measureInWindow((x, y, w, h) => {
        if (x !== undefined && y !== undefined) {
          setInputLayout({ x, y, width: w, height: h });
        }
      });
    }
  }, []);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async (query, currentRequestId) => {
    try {
      const results = type === 'player'
        ? await suggestionService.getPlayerSuggestions(query)
        : await suggestionService.getTeamSuggestions(query);

      if (currentRequestId === requestId.current && isFocusedRef.current) {
        setSuggestions(results);
        if (results.length > 0) {
          measureInput();
          setShowDropdown(true);
        } else {
          setShowDropdown(false);
        }
      }
    } catch (error) {
      if (currentRequestId === requestId.current) {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }
  }, [type, measureInput]);

  // Debounced search
  const handleTextChange = useCallback((text) => {
    hasSelectedSuggestion.current = false;
    setSelection(undefined);
    onChangeText(text);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    requestId.current += 1;
    const currentRequestId = requestId.current;

    if (text.trim().length >= 1) {
      // Fast debounce for immediate suggestions
      debounceTimer.current = setTimeout(() => {
        fetchSuggestions(text.trim(), currentRequestId);
      }, 50);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }, [onChangeText, fetchSuggestions]);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback((suggestion) => {
    hasSelectedSuggestion.current = true;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    requestId.current += 1;

    onChangeText(suggestion.name);
    setShowDropdown(false);
    setSuggestions([]);

    // Save selected suggestion to bump its usage count
    if (saveSuggestion) {
      suggestionService.addSuggestion(suggestion.name, type);
    }
  }, [onChangeText, saveSuggestion, type]);

  // Handle input focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    isFocusedRef.current = true;

    if (selectTextOnFocus && value) {
      setSelection({ start: 0, end: value.length });
      setTimeout(() => {
        setSelection(undefined);
      }, 100);
    }

    requestId.current += 1;
    const currentRequestId = requestId.current;

    if (value && value.trim().length >= 1) {
      fetchSuggestions(value.trim(), currentRequestId);
    }

    onFocus && onFocus();
  }, [value, fetchSuggestions, onFocus, selectTextOnFocus]);

  // Handle input blur
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    isFocusedRef.current = false;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    requestId.current += 1;

    // Don't close dropdown immediately — Modal may have caused blur on Android.
    // Only close if dropdown is not showing (no suggestions) or after a longer delay
    // to allow the user to tap a suggestion in the Modal.
    setTimeout(() => {
      // If suggestions are still showing in Modal, don't auto-close them.
      // User will dismiss by tapping a suggestion or tapping outside.
      if (!showDropdown) {
        setSuggestions([]);
      }
    }, 300);

    if (saveSuggestion && value && value.trim() && !hasSelectedSuggestion.current) {
      suggestionService.addSuggestion(value.trim(), type);
    }

    onBlur && onBlur();
  }, [value, type, onBlur, saveSuggestion, showDropdown]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const isPopular = (suggestion) => suggestion.usageCount >= 50;

  const dropdownMaxHeight = Math.min(suggestions.length * 44, 220);

  // Calculate dropdown position for Modal — always wide enough, anchored near input
  const getModalDropdownStyle = () => {
    if (!inputLayout) return { top: 100, left: 16, width: SCREEN_WIDTH - 32 };

    const minWidth = 220;
    let width = Math.max(inputLayout.width, minWidth);
    let left = inputLayout.x;

    // If wider than parent, try to center on input
    if (width > inputLayout.width) {
      left = inputLayout.x + inputLayout.width / 2 - width / 2;
    }

    // Clamp to screen edges
    if (left < 8) left = 8;
    if (left + width > SCREEN_WIDTH - 8) {
      width = SCREEN_WIDTH - left - 8;
    }
    if (width < minWidth) {
      left = 8;
      width = SCREEN_WIDTH - 16;
    }

    return {
      top: inputLayout.y + inputLayout.height + 4,
      left,
      width,
    };
  };

  const renderSuggestionItem = useCallback(({ item: suggestion, index }) => (
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
  ), [suggestions.length, handleSelectSuggestion]);

  const isDropdownVisible = showDropdown && suggestions.length > 0 && inputLayout !== null;

  return (
    <View style={[styles.container, style]} ref={containerRef}>
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          inputStyle,
        ]}
        value={value}
        onChangeText={handleTextChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        selection={selection}
        maxLength={maxLength}
        returnKeyType={returnKeyType}
        autoFocus={autoFocus}
        editable={editable}
        autoCapitalize="words"
        autoCorrect={false}
        blurOnSubmit={true}
        onSubmitEditing={() => Keyboard.dismiss()}
      />

      {/* Suggestions Dropdown via Modal — renders above everything, never clipped */}
      <Modal
        visible={isDropdownVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => {
          setShowDropdown(false);
          setSuggestions([]);
        }}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            setShowDropdown(false);
            setSuggestions([]);
            Keyboard.dismiss();
          }}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.dropdown, getModalDropdownStyle(), { maxHeight: dropdownMaxHeight }]}>
                <FlatList
                  data={suggestions}
                  renderItem={renderSuggestionItem}
                  keyExtractor={(item, idx) => item._id || `${item.name}-${idx}`}
                  keyboardShouldPersistTaps="always"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={suggestions.length > 5}
                  bounces={false}
                  scrollEnabled={suggestions.length > 5}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  input: {
    fontSize: 16,
    fontWeight: fontWeights.medium,
    color: '#0f172a',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: '#f8fafc',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdown: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: fontWeights.medium,
    flex: 1,
  },
  popularBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: spacing.sm,
  },
  popularBadgeText: {
    fontSize: 10,
    color: '#92400e',
    fontWeight: fontWeights.semibold,
  },
});

export default AutocompleteInput;
