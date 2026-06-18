import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Shared deep-indigo gradient (matches the Tournament picker hero).
const DEFAULT_GRADIENT = ['#1e1b4b', '#312e81'];

/**
 * Premium gradient header used across the app.
 *
 * Props:
 *   title       — Main heading text.
 *   subtitle    — Optional small text under the title.
 *   onBack      — If provided, shows a translucent back button on the left.
 *   rightSlot   — Optional React node rendered on the right (for actions).
 *   gradient    — Optional [startColor, endColor]. Defaults to deep indigo.
 *   compact     — Smaller padding when true (use for list/detail screens).
 */
const GradientHeader = ({
  title,
  subtitle,
  onBack,
  rightSlot,
  gradient = DEFAULT_GRADIENT,
  compact = false,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Decorative bubble */}
      <View style={styles.decorCircle} />

      <Animated.View
        style={[
          styles.row,
          { opacity, transform: [{ translateY }] },
        ]}
      >
        {onBack ? (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.backArrow} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}

        <View style={styles.center}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>

        {rightSlot ? (
          <View style={styles.rightSlot}>{rightSlot}</View>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  containerCompact: {
    paddingBottom: 18,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  decorCircle: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconPlaceholder: {
    width: 42,
    height: 42,
  },
  backArrow: {
    width: 11,
    height: 11,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: '#fff',
    transform: [{ rotate: '45deg' }, { translateX: 2 }],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 3,
    letterSpacing: 0.3,
  },
  rightSlot: {
    minWidth: 42,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});

export default GradientHeader;
