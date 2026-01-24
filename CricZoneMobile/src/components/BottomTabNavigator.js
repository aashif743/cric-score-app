import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors, spacing, fontWeights, shadows } from '../utils/theme';

import DashboardScreen from '../screens/DashboardScreen';
import PointsSystemScreen from '../screens/PointsSystemScreen';
import PastMatchesScreen from '../screens/PastMatchesScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

// Animated Tab Item Component
const AnimatedTabItem = ({ focused, onPress, Icon, label }) => {
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.9)).current;
  const translateY = useRef(new Animated.Value(focused ? -8 : 0)).current;
  const labelOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const labelTranslateY = useRef(new Animated.Value(focused ? 0 : 10)).current;
  const bgOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.1 : 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: focused ? -6 : 0,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(labelOpacity, {
        toValue: focused ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(labelTranslateY, {
        toValue: focused ? 0 : 8,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(bgOpacity, {
        toValue: focused ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  return (
    <TouchableOpacity
      style={styles.tabItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          styles.tabIconWrapper,
          {
            transform: [{ scale: scaleAnim }, { translateY }],
          },
        ]}
      >
        <Animated.View style={[styles.iconBg, { opacity: bgOpacity }]} />
        <Icon focused={focused} />
      </Animated.View>
      <Animated.Text
        style={[
          styles.tabLabel,
          focused && styles.tabLabelActive,
          {
            opacity: labelOpacity,
            transform: [{ translateY: labelTranslateY }],
          },
        ]}
      >
        {label}
      </Animated.Text>
    </TouchableOpacity>
  );
};

// Animated Center Button
const AnimatedCenterButton = ({ onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.9,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <View style={styles.centerButtonWrapper}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <Animated.View
          style={[
            styles.centerButton,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Animated.View style={{ transform: [{ rotate }] }}>
            <View style={styles.plusContainer}>
              <View style={styles.plusHorizontal} />
              <View style={styles.plusVertical} />
            </View>
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

// Modern Minimal Icons
const HomeIcon = ({ focused }) => (
  <View style={styles.iconContainer}>
    <View style={[styles.homeRoof, focused ? styles.iconActive : styles.iconInactive]}>
      <View style={[styles.homeRoofInner, { borderBottomColor: focused ? colors.primary : '#94a3b8' }]} />
    </View>
    <View style={[styles.homeBody, { backgroundColor: focused ? colors.primary : '#94a3b8' }]}>
      <View style={[styles.homeWindow, { backgroundColor: focused ? '#eef2ff' : '#f8fafc' }]} />
    </View>
  </View>
);

const TrophyIcon = ({ focused }) => (
  <View style={styles.iconContainer}>
    <View style={[styles.trophyCup, { backgroundColor: focused ? colors.primary : '#94a3b8' }]}>
      <View style={[styles.trophyShine, { backgroundColor: focused ? '#818cf8' : '#b4bcd0' }]} />
    </View>
    <View style={[styles.trophyStemNew, { backgroundColor: focused ? colors.primary : '#94a3b8' }]} />
    <View style={[styles.trophyBaseNew, { backgroundColor: focused ? colors.primary : '#94a3b8' }]} />
  </View>
);

const HistoryIcon = ({ focused }) => (
  <View style={styles.iconContainer}>
    <View style={[styles.clockFace, { borderColor: focused ? colors.primary : '#94a3b8' }]}>
      <View style={[styles.clockDot, { backgroundColor: focused ? colors.primary : '#94a3b8' }]} />
      <View style={[styles.clockMinute, { backgroundColor: focused ? colors.primary : '#94a3b8' }]} />
      <View style={[styles.clockHour, { backgroundColor: focused ? colors.primary : '#94a3b8' }]} />
    </View>
  </View>
);

const ProfileIcon = ({ focused }) => (
  <View style={styles.iconContainer}>
    <View style={[styles.profileHeadNew, { backgroundColor: focused ? colors.primary : '#94a3b8' }]} />
    <View style={[styles.profileBodyNew, { backgroundColor: focused ? colors.primary : '#94a3b8' }]} />
  </View>
);

// Custom Tab Bar Component
const CustomTabBar = ({ state, descriptors, navigation }) => {
  const tabs = [
    { name: 'Dashboard', label: 'Home', Icon: HomeIcon },
    { name: 'PointsSystem', label: 'Points', Icon: TrophyIcon },
    { name: 'PastMatches', label: 'History', Icon: HistoryIcon },
    { name: 'Profile', label: 'Profile', Icon: ProfileIcon },
  ];

  return (
    <View style={styles.tabBarWrapper}>
      <View style={styles.tabBarContainer}>
        {/* First two tabs */}
        {tabs.slice(0, 2).map((tab, index) => {
          const isFocused = state.index === index;
          return (
            <AnimatedTabItem
              key={tab.name}
              focused={isFocused}
              onPress={() => navigation.navigate(tab.name)}
              Icon={tab.Icon}
              label={tab.label}
            />
          );
        })}

        {/* Center Action Button */}
        <AnimatedCenterButton
          onPress={() => navigation.navigate('MatchSetup')}
        />

        {/* Last two tabs */}
        {tabs.slice(2).map((tab, index) => {
          const actualIndex = index + 2;
          const isFocused = state.index === actualIndex;
          return (
            <AnimatedTabItem
              key={tab.name}
              focused={isFocused}
              onPress={() => navigation.navigate(tab.name)}
              Icon={tab.Icon}
              label={tab.label}
            />
          );
        })}
      </View>
    </View>
  );
};

const BottomTabNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="PointsSystem" component={PointsSystemScreen} />
      <Tab.Screen name="PastMatches" component={PastMatchesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    backgroundColor: 'transparent',
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
  tabIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  iconBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#eef2ff',
    borderRadius: 16,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: colors.primary,
  },
  centerButtonWrapper: {
    marginHorizontal: 8,
    marginTop: -35,
  },
  centerButton: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 4,
    borderColor: '#ffffff',
  },
  // Icon Container
  iconContainer: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconActive: {
    color: colors.primary,
  },
  iconInactive: {
    color: '#94a3b8',
  },
  // Home Icon - Modern
  homeRoof: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
  },
  homeRoofInner: {
    width: 0,
    height: 0,
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderBottomWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  homeBody: {
    position: 'absolute',
    bottom: 0,
    width: 18,
    height: 13,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeWindow: {
    width: 6,
    height: 8,
    borderRadius: 2,
    marginTop: 2,
  },
  // Trophy Icon - Modern
  trophyCup: {
    width: 16,
    height: 12,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  trophyShine: {
    position: 'absolute',
    left: 2,
    top: 2,
    width: 4,
    height: 6,
    borderRadius: 2,
    opacity: 0.5,
  },
  trophyStemNew: {
    width: 4,
    height: 5,
    position: 'absolute',
    bottom: 5,
    borderRadius: 1,
  },
  trophyBaseNew: {
    width: 14,
    height: 4,
    position: 'absolute',
    bottom: 0,
    borderRadius: 2,
  },
  // Clock Icon - Modern
  clockFace: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clockDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    position: 'absolute',
  },
  clockMinute: {
    width: 2,
    height: 8,
    borderRadius: 1,
    position: 'absolute',
    top: 4,
    transformOrigin: 'bottom',
  },
  clockHour: {
    width: 2,
    height: 5,
    borderRadius: 1,
    position: 'absolute',
    left: 11,
    transform: [{ rotate: '90deg' }],
  },
  // Profile Icon - Modern
  profileHeadNew: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    top: 0,
  },
  profileBodyNew: {
    width: 18,
    height: 11,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    position: 'absolute',
    bottom: 0,
  },
  // Plus Icon
  plusContainer: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusHorizontal: {
    position: 'absolute',
    width: 20,
    height: 3.5,
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  plusVertical: {
    position: 'absolute',
    width: 3.5,
    height: 20,
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
});

export default BottomTabNavigator;
