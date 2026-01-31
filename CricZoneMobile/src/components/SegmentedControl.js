import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';

const SegmentedControl = ({ options, selectedIndex, onSelect }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const containerWidth = useRef(0);

  useEffect(() => {
    if (containerWidth.current > 0) {
      const segmentWidth = containerWidth.current / options.length;
      Animated.spring(slideAnim, {
        toValue: selectedIndex * segmentWidth,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedIndex]);

  const onLayout = (e) => {
    const { width } = e.nativeEvent.layout;
    containerWidth.current = width;
    const segmentWidth = width / options.length;
    slideAnim.setValue(selectedIndex * segmentWidth);
  };

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Animated.View
        style={[
          styles.slider,
          {
            width: `${100 / options.length}%`,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      />
      {options.map((option, index) => (
        <TouchableOpacity
          key={option}
          style={styles.option}
          onPress={() => onSelect(index)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.optionText,
              selectedIndex === index && styles.optionTextActive,
            ]}
          >
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 3,
    position: 'relative',
  },
  slider: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  option: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  optionTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
});

export default SegmentedControl;
