import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Keyboard,
  Platform,
  ScrollView,
} from 'react-native';
import suggestionService from '../utils/suggestionService';
import { colors, spacing, borderRadius, fontWeights } from '../utils/theme';

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
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [selection, setSelection] = useState(undefined);

  const debounceTimer = useRef(null);
  const inputRef = useRef(null);
  const dropdownHeight = useRef(new Animated.Value(0)).current;
  const hasSelectedSuggestion = useRef(false);
  const requestId = useRef(0); // Track request to prevent race conditions
  const isFocusedRef = useRef(false); // Use ref to avoid stale closure

  // Fetch suggestions
  const fetchSuggestions = useCallback(async (query, currentRequestId) => {
    try {
      const results = type === 'player'
        ? await suggestionService.getPlayerSuggestions(query)
        : await suggestionService.getTeamSuggestions(query);

      // Only update if this is still the latest request and input is focused
      if (currentRequestId === requestId.current && isFocusedRef.current) {
        setSuggestions(results);
        if (results.length > 0) {
          setShowDropdown(true);
        } else {
          setShowDropdown(false);
        }
      }
    } catch (error) {
      // Silently fail - suggestions are not critical
      if (currentRequestId === requestId.current) {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }
  }, [type]);

  // Debounced search
  const handleTextChange = useCallback((text) => {
    hasSelectedSuggestion.current = false;
    setSelection(undefined); // Clear selection when typing
    onChangeText(text);

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Increment request ID to invalidate any pending requests
    requestId.current += 1;
    const currentRequestId = requestId.current;

    if (text.trim().length >= 2) {
      // Set new timer for debounced search
      debounceTimer.current = setTimeout(() => {
        fetchSuggestions(text.trim(), currentRequestId);
      }, 300);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }, [onChangeText, fetchSuggestions]);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback((suggestion) => {
    hasSelectedSuggestion.current = true;

    // Clear any pending requests
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    requestId.current += 1;

    onChangeText(suggestion.name);
    setSuggestions([]);
    setShowDropdown(false);
    Keyboard.dismiss();
  }, [onChangeText]);

  // Handle input focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    isFocusedRef.current = true;

    // Select all text on focus
    if (selectTextOnFocus && value) {
      setSelection({ start: 0, end: value.length });
      // Clear selection after a short delay so user can type normally
      setTimeout(() => {
        setSelection(undefined);
      }, 100);
    }

    // Increment request ID and fetch if there's existing text
    requestId.current += 1;
    const currentRequestId = requestId.current;

    if (value && value.trim().length >= 2) {
      fetchSuggestions(value.trim(), currentRequestId);
    }

    onFocus && onFocus();
  }, [value, fetchSuggestions, onFocus, selectTextOnFocus]);

  // Handle input blur
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    isFocusedRef.current = false;

    // Cancel any pending requests
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    requestId.current += 1;

    // Delay hiding dropdown to allow tap on suggestion
    setTimeout(() => {
      setShowDropdown(false);
      setSuggestions([]);
    }, 250);

    // Save the name if it's new and user didn't select from suggestions
    if (value && value.trim() && !hasSelectedSuggestion.current) {
      suggestionService.addSuggestion(value.trim(), type);
    }

    onBlur && onBlur();
  }, [value, type, onBlur]);

  // Animate dropdown
  useEffect(() => {
    const toHeight = showDropdown && suggestions.length > 0
      ? Math.min(suggestions.length * 48, 192)
      : 0;

    Animated.timing(dropdownHeight, {
      toValue: toHeight,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [showDropdown, suggestions.length, dropdownHeight]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const isPopular = (suggestion) => suggestion.usageCount >= 50;

  return (
    <View style={[styles.container, style]}>
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

      {/* Suggestions Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <Animated.View style={[styles.dropdown, { maxHeight: dropdownHeight }]}>
          <ScrollView
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
          >
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={suggestion._id || `${suggestion.name}-${index}`}
                style={[
                  styles.suggestionItem,
                  index === suggestions.length - 1 && styles.suggestionItemLast,
                ]}
                onPress={() => handleSelectSuggestion(suggestion)}
                activeOpacity={0.7}
              >
                <Text style={styles.suggestionText}>
                  {suggestion.name}
                </Text>
                {isPopular(suggestion) && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>Popular</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
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
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    minWidth: 200,
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    marginTop: 4,
    overflow: 'visible',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 12,
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
    flexShrink: 0,
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
