import React, { useEffect, useRef } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';

import DashboardScreen from '../screens/DashboardScreen';
import TournamentListScreen from '../screens/TournamentListScreen';
import PastMatchesScreen from '../screens/PastMatchesScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const ACTIVE_COLOR = '#fff';
const INACTIVE_COLOR = '#94a3b8';
const TAB_GRADIENT = ['#312e81', '#4f46e5'];

// ---------------- Tab Item (icon only) ----------------

const AnimatedTabItem = ({ focused, onPress, Icon }) => {
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: focused ? 1 : 0,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <TouchableOpacity
      style={styles.tabItem}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View style={[styles.iconBubble, { transform: [{ scale }] }]}>
        {focused ? (
          <LinearGradient
            colors={TAB_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <Icon focused={focused} />
      </Animated.View>
      {/* Active dot under the icon */}
      <Animated.View style={[styles.activeDot, { opacity: anim }]} />
    </TouchableOpacity>
  );
};

// ---------------- Center Button (CricZone brand + plus) ----------------

const LogoButton = ({ onPress }) => {
  const press = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Idle vertical float — gentle, alive but not distracting
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    ).start();
    // Diagonal shimmer sweep — premium feel
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.delay(1400),
      ])
    ).start();
    // Soft halo pulse around the button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const onIn = () => {
    Animated.spring(press, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }).start();
  };
  const onOut = () => {
    Animated.spring(press, { toValue: 0, friction: 3, tension: 160, useNativeDriver: true }).start();
  };

  const scale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-120, 200] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

  return (
    <View style={styles.logoBtnWrap}>
      {/* Pulsing halo behind */}
      <Animated.View
        pointerEvents="none"
        style={[styles.logoHalo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
      />

      <Animated.View style={{ transform: [{ translateY: floatY }, { scale }] }}>
        <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={onIn} onPressOut={onOut}>
          <View style={styles.logoBtn}>
            <View style={styles.logoInner}>
              <Image
                source={require('../../assets/logo/criczone_icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.shimmer,
                  { transform: [{ translateX: shimmerX }, { rotate: '20deg' }] },
                ]}
              />
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// ---------------- Icons ----------------

const iconColor = (focused) => (focused ? ACTIVE_COLOR : INACTIVE_COLOR);

const HomeIcon = ({ focused }) => {
  const c = iconColor(focused);
  return (
    <View style={iconStyles.box}>
      <View style={[iconStyles.homeRoof, { borderBottomColor: c }]} />
      <View style={[iconStyles.homeBody, { backgroundColor: c }]} />
    </View>
  );
};

const TrophyIcon = ({ focused }) => {
  const c = iconColor(focused);
  return (
    <View style={iconStyles.box}>
      <View style={[iconStyles.trophyCup, { borderColor: c }]} />
      <View style={[iconStyles.trophyStem, { backgroundColor: c }]} />
      <View style={[iconStyles.trophyBase, { backgroundColor: c }]} />
    </View>
  );
};

const HistoryIcon = ({ focused }) => {
  const c = iconColor(focused);
  return (
    <View style={iconStyles.box}>
      <View style={[iconStyles.clockFace, { borderColor: c }]} />
      <View style={[iconStyles.clockHandV, { backgroundColor: c }]} />
      <View style={[iconStyles.clockHandH, { backgroundColor: c }]} />
    </View>
  );
};

const ProfileIcon = ({ focused }) => {
  const c = iconColor(focused);
  return (
    <View style={iconStyles.box}>
      <View style={[iconStyles.profileHead, { backgroundColor: c }]} />
      <View style={[iconStyles.profileShoulders, { backgroundColor: c }]} />
    </View>
  );
};

// ---------------- Custom Tab Bar ----------------

const CustomTabBar = ({ state, navigation }) => {
  const tabs = [
    { name: 'Dashboard', Icon: HomeIcon },
    { name: 'Tournaments', Icon: TrophyIcon },
    { name: 'PastMatches', Icon: HistoryIcon },
    { name: 'Profile', Icon: ProfileIcon },
  ];

  return (
    <View style={styles.tabBarWrapper}>
      <View style={styles.tabBarContainer}>
        {tabs.slice(0, 2).map((tab, i) => (
          <AnimatedTabItem
            key={tab.name}
            focused={state.index === i}
            onPress={() => navigation.navigate(tab.name)}
            Icon={tab.Icon}
          />
        ))}
        <LogoButton onPress={() => navigation.navigate('MatchSetup')} />
        {tabs.slice(2).map((tab, i) => {
          const idx = i + 2;
          return (
            <AnimatedTabItem
              key={tab.name}
              focused={state.index === idx}
              onPress={() => navigation.navigate(tab.name)}
              Icon={tab.Icon}
            />
          );
        })}
      </View>
    </View>
  );
};

const BottomTabNavigator = () => (
  <Tab.Navigator
    tabBar={(props) => <CustomTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="Dashboard" component={DashboardScreen} />
    <Tab.Screen name="Tournaments" component={TournamentListScreen} />
    <Tab.Screen name="PastMatches" component={PastMatchesScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

// ---------------- Styles ----------------

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    backgroundColor: 'transparent',
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#1e1b4b',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 24,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.08)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDot: {
    position: 'absolute',
    bottom: 2,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#4f46e5',
  },

  // CricZone logo center button (icon + plus badge)
  logoBtnWrap: {
    marginHorizontal: 6,
    marginTop: -28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoHalo: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0ea5e9',
  },
  logoBtn: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0c4a6e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 14,
  },
  logoInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  shimmer: {
    position: 'absolute',
    top: -10,
    width: 18,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 4,
  },
});

const iconStyles = StyleSheet.create({
  box: { width: 22, height: 22, justifyContent: 'center', alignItems: 'center' },
  // Home
  homeRoof: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  homeBody: {
    position: 'absolute',
    bottom: 1,
    width: 14,
    height: 9,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  // Trophy
  trophyCup: {
    width: 16,
    height: 11,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  trophyStem: { width: 3, height: 4, marginTop: 1 },
  trophyBase: { width: 12, height: 2.5, borderRadius: 1.5, marginTop: 1 },
  // Clock
  clockFace: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  clockHandV: {
    position: 'absolute',
    width: 1.8,
    height: 7,
    borderRadius: 1,
    top: 4,
  },
  clockHandH: {
    position: 'absolute',
    width: 5,
    height: 1.8,
    borderRadius: 1,
    right: 4.5,
  },
  // Profile
  profileHead: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    position: 'absolute',
    top: 1,
  },
  profileShoulders: {
    width: 16,
    height: 9,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    position: 'absolute',
    bottom: 1,
  },
});

export default BottomTabNavigator;
