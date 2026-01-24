import React, { useContext, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';

const { width } = Dimensions.get('window');

// Brand colors matching CricZone
const colors = {
  primary: '#0d3b66',
  primaryLight: '#2d7dd2',
  secondary: '#5dade2',
  accent: '#a8d8ea',
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceGray: '#f1f5f9',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  error: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
};

// Custom Icon Components (no emojis)
const UserIcon = ({ size = 24, color = colors.primary }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.userHead, {
      width: size * 0.4,
      height: size * 0.4,
      borderRadius: size * 0.2,
      backgroundColor: color,
    }]} />
    <View style={[styles.userBody, {
      width: size * 0.6,
      height: size * 0.35,
      borderTopLeftRadius: size * 0.3,
      borderTopRightRadius: size * 0.3,
      backgroundColor: color,
      marginTop: size * 0.08,
    }]} />
  </View>
);

const PhoneIcon = ({ size = 24, color = colors.primary }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.phoneBody, {
      width: size * 0.5,
      height: size * 0.85,
      borderRadius: size * 0.1,
      borderWidth: 2,
      borderColor: color,
    }]}>
      <View style={[styles.phoneScreen, {
        width: size * 0.35,
        height: size * 0.55,
        backgroundColor: color,
        opacity: 0.3,
        borderRadius: size * 0.05,
        marginTop: size * 0.08,
      }]} />
      <View style={[styles.phoneButton, {
        width: size * 0.15,
        height: size * 0.08,
        backgroundColor: color,
        borderRadius: size * 0.04,
        marginTop: size * 0.05,
      }]} />
    </View>
  </View>
);

const BellIcon = ({ size = 24, color = colors.primary }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.bellTop, {
      width: size * 0.08,
      height: size * 0.15,
      backgroundColor: color,
      borderRadius: size * 0.04,
    }]} />
    <View style={[styles.bellBody, {
      width: size * 0.65,
      height: size * 0.55,
      borderTopLeftRadius: size * 0.3,
      borderTopRightRadius: size * 0.3,
      borderBottomLeftRadius: size * 0.05,
      borderBottomRightRadius: size * 0.05,
      backgroundColor: color,
    }]} />
    <View style={[styles.bellClapper, {
      width: size * 0.15,
      height: size * 0.15,
      borderRadius: size * 0.075,
      backgroundColor: color,
      marginTop: size * 0.03,
    }]} />
  </View>
);

const GlobeIcon = ({ size = 24, color = colors.primary }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.globeOuter, {
      width: size * 0.8,
      height: size * 0.8,
      borderRadius: size * 0.4,
      borderWidth: 2,
      borderColor: color,
    }]}>
      <View style={[styles.globeLine, {
        width: size * 0.8,
        height: 2,
        backgroundColor: color,
        position: 'absolute',
        top: size * 0.39,
      }]} />
      <View style={[styles.globeLine, {
        width: 2,
        height: size * 0.8,
        backgroundColor: color,
        position: 'absolute',
        left: size * 0.39,
      }]} />
    </View>
  </View>
);

const InfoIcon = ({ size = 24, color = colors.primary }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.infoCircle, {
      width: size * 0.8,
      height: size * 0.8,
      borderRadius: size * 0.4,
      borderWidth: 2,
      borderColor: color,
    }]}>
      <View style={[styles.infoDot, {
        width: size * 0.12,
        height: size * 0.12,
        borderRadius: size * 0.06,
        backgroundColor: color,
        marginBottom: size * 0.08,
      }]} />
      <View style={[styles.infoLine, {
        width: size * 0.1,
        height: size * 0.3,
        backgroundColor: color,
        borderRadius: size * 0.05,
      }]} />
    </View>
  </View>
);

const LogoutIcon = ({ size = 24, color = colors.error }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.logoutBox, {
      width: size * 0.5,
      height: size * 0.7,
      borderWidth: 2,
      borderColor: color,
      borderRightWidth: 0,
      borderTopLeftRadius: size * 0.1,
      borderBottomLeftRadius: size * 0.1,
    }]} />
    <View style={[styles.logoutArrow, {
      width: size * 0.4,
      height: 2,
      backgroundColor: color,
      position: 'absolute',
      right: size * 0.1,
    }]} />
    <View style={[styles.logoutArrowHead, {
      width: 0,
      height: 0,
      borderTopWidth: size * 0.12,
      borderBottomWidth: size * 0.12,
      borderLeftWidth: size * 0.15,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: color,
      position: 'absolute',
      right: size * 0.05,
    }]} />
  </View>
);

const LockIcon = ({ size = 24, color = colors.primary }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.lockShackle, {
      width: size * 0.5,
      height: size * 0.35,
      borderWidth: 2.5,
      borderColor: color,
      borderBottomWidth: 0,
      borderTopLeftRadius: size * 0.25,
      borderTopRightRadius: size * 0.25,
    }]} />
    <View style={[styles.lockBody, {
      width: size * 0.7,
      height: size * 0.45,
      backgroundColor: color,
      borderRadius: size * 0.08,
      marginTop: -2,
    }]}>
      <View style={[styles.lockHole, {
        width: size * 0.12,
        height: size * 0.12,
        borderRadius: size * 0.06,
        backgroundColor: colors.surface,
        marginTop: size * 0.1,
      }]} />
    </View>
  </View>
);

const ChevronIcon = ({ size = 20, color = colors.textMuted }) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.chevronLine, {
      width: size * 0.4,
      height: 2.5,
      backgroundColor: color,
      transform: [{ rotate: '45deg' }, { translateY: -size * 0.08 }],
    }]} />
    <View style={[styles.chevronLine, {
      width: size * 0.4,
      height: 2.5,
      backgroundColor: color,
      transform: [{ rotate: '-45deg' }, { translateY: size * 0.08 }],
    }]} />
  </View>
);

// Animated Setting Item Component
const AnimatedSettingItem = ({ icon, label, value, onPress, delay, isLast }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 400,
      delay: delay,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={{
        opacity: animatedValue,
        transform: [
          { translateX: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [30, 0],
          })},
          { scale: scaleValue },
        ],
      }}
    >
      <TouchableOpacity
        style={[styles.settingItem, isLast && styles.settingItemLast]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        <View style={styles.settingLeft}>
          <View style={styles.settingIconContainer}>
            {icon}
          </View>
          <Text style={styles.settingText}>{label}</Text>
        </View>
        <View style={styles.settingRight}>
          {value && <Text style={styles.settingValue}>{value}</Text>}
          <ChevronIcon size={18} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const ProfileScreen = ({ navigation }) => {
  const { user, logout } = useContext(AuthContext);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const avatarScale = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Staggered entrance animations
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(avatarScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Auth' }],
            });
          },
        },
      ]
    );
  };

  const handleButtonPressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handleButtonPressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Animated.View
          style={[
            styles.loginPrompt,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
            <View style={styles.lockIconContainer}>
              <LockIcon size={60} color={colors.primary} />
            </View>
          </Animated.View>
          <Text style={styles.loginTitle}>Login Required</Text>
          <Text style={styles.loginText}>Please login to view your profile and access all features.</Text>
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => navigation.navigate('Auth')}
              onPressIn={handleButtonPressIn}
              onPressOut={handleButtonPressOut}
              activeOpacity={0.9}
            >
              <Text style={styles.loginButtonText}>Login Now</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const getInitial = () => {
    return (user.name || user.displayName || 'U').charAt(0).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          <Text style={styles.headerTitle}>Profile</Text>
        </Animated.View>

        {/* Profile Card */}
        <Animated.View
          style={[
            styles.profileCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          {/* Avatar with animation */}
          <Animated.View style={[styles.avatarContainer, { transform: [{ scale: avatarScale }] }]}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitial()}</Text>
              </View>
            </View>
            <View style={styles.statusDot} />
          </Animated.View>

          {/* User Name */}
          <Text style={styles.userName}>{user.name || user.displayName || 'User'}</Text>
          <Text style={styles.userSubtitle}>Cricket Enthusiast</Text>

          {/* Details Section */}
          <Animated.View
            style={[
              styles.detailsSection,
              {
                opacity: cardAnim,
                transform: [{
                  translateY: cardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                }],
              }
            ]}
          >
            <View style={styles.detailItem}>
              <View style={styles.detailIconContainer}>
                <UserIcon size={20} color={colors.primaryLight} />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Full Name</Text>
                <Text style={styles.detailValue}>
                  {user.name || user.displayName || 'Not Provided'}
                </Text>
              </View>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailItem}>
              <View style={styles.detailIconContainer}>
                <PhoneIcon size={20} color={colors.primaryLight} />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Phone Number</Text>
                <Text style={styles.detailValue}>
                  {user.phoneNumber || 'Not Provided'}
                </Text>
              </View>
            </View>
          </Animated.View>
        </Animated.View>

        {/* Settings Section */}
        <Animated.View
          style={[
            styles.settingsSection,
            {
              opacity: cardAnim,
              transform: [{
                translateY: cardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              }],
            }
          ]}
        >
          <Text style={styles.sectionTitle}>Settings</Text>

          <AnimatedSettingItem
            icon={<BellIcon size={22} color={colors.primaryLight} />}
            label="Notifications"
            delay={400}
          />

          <AnimatedSettingItem
            icon={<GlobeIcon size={22} color={colors.primaryLight} />}
            label="Language"
            value="English"
            delay={500}
          />

          <AnimatedSettingItem
            icon={<InfoIcon size={22} color={colors.primaryLight} />}
            label="About"
            delay={600}
            isLast
          />
        </Animated.View>

        {/* Logout Button */}
        <Animated.View
          style={[
            {
              opacity: cardAnim,
              transform: [
                { scale: buttonScale },
                {
                  translateY: cardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                }
              ],
            }
          ]}
        >
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            onPressIn={handleButtonPressIn}
            onPressOut={handleButtonPressOut}
            activeOpacity={0.9}
          >
            <LogoutIcon size={22} color={colors.error} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* App Version */}
        <Animated.View style={{ opacity: cardAnim }}>
          <Text style={styles.versionText}>CricZone v1.0.0</Text>
          <Text style={styles.copyrightText}>Made with passion for cricket</Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarRing: {
    padding: 4,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.surface,
  },
  statusDot: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  userName: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  userSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 24,
  },
  detailsSection: {
    width: '100%',
    backgroundColor: colors.surfaceGray,
    borderRadius: 16,
    padding: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  detailIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  settingsSection: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surfaceGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 14,
    color: colors.textMuted,
    marginRight: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.error,
    gap: 10,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.error,
  },
  versionText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  copyrightText: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 12,
    color: colors.textMuted,
    opacity: 0.7,
  },
  loginPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  lockIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  loginText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  loginButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 48,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  loginButtonText: {
    color: colors.surface,
    fontSize: 18,
    fontWeight: '700',
  },
  // Icon styles
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  userHead: {},
  userBody: {},
  phoneBody: {
    alignItems: 'center',
  },
  phoneScreen: {},
  phoneButton: {},
  bellTop: {},
  bellBody: {},
  bellClapper: {},
  globeOuter: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  globeLine: {},
  infoCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoDot: {},
  infoLine: {},
  logoutBox: {},
  logoutArrow: {},
  logoutArrowHead: {},
  lockShackle: {},
  lockBody: {
    alignItems: 'center',
  },
  lockHole: {},
  chevronLine: {},
});

export default ProfileScreen;
