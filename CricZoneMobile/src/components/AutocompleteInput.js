import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import suggestionService from '../utils/suggestionService';
import { colors, spacing, borderRadius, fontWeights } from '../utils/theme';

// Suggestion card width — narrow enough that even with a worst-case input
// position, clamping keeps both edges inside the screen. 260 sits inside
// the smallest common phone width (~320) with room to spare.
const SCREEN_WIDTH = Dimensions.get('window').width;
const DROPDOWN_WIDTH = Math.min(SCREEN_WIDTH - 32, 260);
const SIDE_MARGIN = 8; // minimum gap from each screen edge

// Inline autocomplete: dropdown is a sibling of the TextInput (NOT inside a
// Modal — Modals on Android steal focus and force the keyboard closed on
// every keystroke). We measure the input's screen position on focus and
// clamp the dropdown's horizontal offset so it's centred on the input
// whenever possible but never overflows past the device edges.

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
  const [containerLayout, setContainerLayout] = useState(null);

  const debounceTimer = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const hasSelectedSuggestion = useRef(false);
  const requestId = useRef(0);
  const isFocusedRef = useRef(false);
  const blurTimer = useRef(null);

  const measureContainer = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.measureInWindow((x, y, w, h) => {
      if (typeof x === 'number' && typeof y === 'number') {
        setContainerLayout({ x, y, width: w, height: h });
      }
    });
  }, []);

  const fetchSuggestions = useCallback(async (query, currentRequestId) => {
    try {
      const results = type === 'player'
        ? await suggestionService.getPlayerSuggestions(query)
        : await suggestionService.getTeamSuggestions(query);

      if (currentRequestId === requestId.current && isFocusedRef.current) {
        setSuggestions(results);
        if (results.length > 0) measureContainer();
        setShowDropdown(results.length > 0);
      }
    } catch (error) {
      if (currentRequestId === requestId.current) {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }
  }, [type, measureContainer]);

  const handleTextChange = useCallback((text) => {
    hasSelectedSuggestion.current = false;
    setSelection(undefined);
    onChangeText(text);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    requestId.current += 1;
    const currentRequestId = requestId.current;

    if (text.trim().length >= 1) {
      debounceTimer.current = setTimeout(() => {
        fetchSuggestions(text.trim(), currentRequestId);
      }, 80);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }, [onChangeText, fetchSuggestions]);

  const handleSelectSuggestion = useCallback((suggestion) => {
    hasSelectedSuggestion.current = true;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (blurTimer.current) clearTimeout(blurTimer.current);
    requestId.current += 1;

    onChangeText(suggestion.name);
    setShowDropdown(false);
    setSuggestions([]);

    // Bump usage count for the picked suggestion (fire-and-forget).
    if (saveSuggestion) {
      suggestionService.addSuggestion(suggestion.name, type);
    }

    Keyboard.dismiss();
  }, [onChangeText, saveSuggestion, type]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    isFocusedRef.current = true;

    if (selectTextOnFocus && value) {
      setSelection({ start: 0, end: value.length });
      setTimeout(() => setSelection(undefined), 100);
    }

    measureContainer();

    requestId.current += 1;
    const currentRequestId = requestId.current;
    if (value && value.trim().length >= 1) {
      fetchSuggestions(value.trim(), currentRequestId);
    }

    onFocus && onFocus();
  }, [value, fetchSuggestions, onFocus, selectTextOnFocus, measureContainer]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    isFocusedRef.current = false;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    requestId.current += 1;

    // Delay hiding so a tap on a suggestion still registers (taps briefly
    // blur the input on Android).
    blurTimer.current = setTimeout(() => {
      setShowDropdown(false);
      setSuggestions([]);
    }, 180);

    if (saveSuggestion && value && value.trim() && !hasSelectedSuggestion.current) {
      suggestionService.addSuggestion(value.trim(), type);
    }

    onBlur && onBlur();
  }, [value, type, onBlur, saveSuggestion]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  const isPopular = (suggestion) => suggestion.usageCount >= 50;
  const dropdownMaxHeight = Math.min(suggestions.length * 44, 220);

  // Compute the dropdown's left offset relative to the AutocompleteInput
  // container so its centre lines up with the input's centre while staying
  // clamped inside the screen edges.
  let dropdownLeftOffset = 0;
  if (containerLayout) {
    const idealScreenLeft =
      containerLayout.x + (containerLayout.width - DROPDOWN_WIDTH) / 2;
    const clampedScreenLeft = Math.max(
      SIDE_MARGIN,
      Math.min(idealScreenLeft, SCREEN_WIDTH - DROPDOWN_WIDTH - SIDE_MARGIN)
    );
    dropdownLeftOffset = clampedScreenLeft - containerLayout.x;
  }

  const renderSuggestionItem = (suggestion, index) => (
    <TouchableOpacity
      key={suggestion._id || `${suggestion.name}-${index}`}
      style={[
        styles.suggestionItem,
        index === suggestions.length - 1 && styles.suggestionItemLast,
      ]}
      onPress={() => handleSelectSuggestion(suggestion)}
      activeOpacity={0.7}
    >
      <Text style={styles.suggestionText} numberOfLines={2}>
        {suggestion.name}
      </Text>
      {isPopular(suggestion) && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>Popular</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const isDropdownVisible = showDropdown && suggestions.length > 0;

  return (
    <View style={[styles.container, style]} ref={containerRef} onLayout={measureContainer}>
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

      {isDropdownVisible && (
        <View
          style={[
            styles.dropdownInline,
            { left: dropdownLeftOffset, maxHeight: dropdownMaxHeight },
          ]}
        >
          {/* Suggestion lists are short (<=20). Use ScrollView + map instead
              of FlatList so we don't trip RN's "VirtualizedLists nested
              inside ScrollView" warning when this dropdown lives inside a
              parent ScrollView (e.g. MatchSetup). */}
          <ScrollView
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            nestedScrollEnabled
            showsVerticalScrollIndicator={suggestions.length > 5}
            bounces={false}
            scrollEnabled={suggestions.length > 5}
          >
            {suggestions.map((item, idx) => renderSuggestionItem(item, idx))}
          </ScrollView>
        </View>
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
  // Positioned absolutely beneath the input. `left` is set inline based on
  // the measured input position so the dropdown stays within the screen.
  dropdownInline: {
    position: 'absolute',
    top: '100%',
    width: DROPDOWN_WIDTH,
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 1001,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
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
    minHeight: 44,
    paddingVertical: 8,
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
