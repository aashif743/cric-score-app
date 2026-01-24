import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  StatusBar,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import authService from '../utils/authService';

const { width, height } = Dimensions.get('window');

// Brand colors matching your logo
const colors = {
  primary: '#0d3b66',
  secondary: '#2d7dd2',
  accent: '#5dade2',
  light: '#a8d8ea',
  background: '#f0f7ff',
  white: '#ffffff',
  text: '#0d3b66',
  textLight: '#5a7a9a',
  error: '#e74c3c',
};

const AuthScreen = ({ navigation }) => {
  const { login } = useContext(AuthContext);
  const [step, setStep] = useState('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP input refs
  const otpInputs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
  ];

  // Animation values
  const logoAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const bgCircle1Anim = useRef(new Animated.Value(0)).current;
  const bgCircle2Anim = useRef(new Animated.Value(0)).current;

  // OTP box animations
  const otpBoxAnims = [
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
  ];

  // Initial animations
  useEffect(() => {
    Animated.parallel([
      // Logo animation
      Animated.spring(logoAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      // Card slide up
      Animated.spring(cardAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        delay: 200,
        useNativeDriver: true,
      }),
      // Background circles
      Animated.timing(bgCircle1Anim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(bgCircle2Anim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Animate step transitions
  const animateStepChange = (newStep) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => setStep(newStep), 150);
  };

  // Animate OTP box on fill
  const animateOtpBox = (index) => {
    Animated.sequence([
      Animated.timing(otpBoxAnims[index], {
        toValue: 1.15,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(otpBoxAnims[index], {
        toValue: 1,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const isValidPhone = (phone) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 15;
  };

  const handleSendOTP = async () => {
    if (!phoneNumber || !isValidPhone(phoneNumber)) {
      setError('Please enter a valid phone number');
      return;
    }
    setLoading(true);
    setError('');
    Keyboard.dismiss();
    try {
      await authService.sendOTP(phoneNumber);
      animateStepChange('otp');
    } catch (err) {
      setError(err.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (otpCode) => {
    const code = otpCode || otp.join('');
    if (!code || code.length < 4) {
      setError('Please enter the OTP');
      return;
    }
    setLoading(true);
    setError('');
    Keyboard.dismiss();
    try {
      const response = await authService.verifyOTP(phoneNumber, code);
      if (response.isNewUser) {
        animateStepChange('name');
      } else {
        await login({
          id: response._id,
          name: response.name,
          phoneNumber: response.phoneNumber,
          token: response.token,
          displayName: response.name,
        });
      }
    } catch (err) {
      setError(err.error || 'Invalid OTP');
      setOtp(['', '', '', '']);
      otpInputs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value, index) => {
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];

    if (value.length > 1) {
      const digits = value.slice(0, 4).split('');
      digits.forEach((digit, i) => {
        if (i < 4) {
          newOtp[i] = digit;
          animateOtpBox(i);
        }
      });
      setOtp(newOtp);
      if (digits.length >= 4) {
        Keyboard.dismiss();
        handleVerifyOTP(newOtp.join(''));
      } else {
        otpInputs[Math.min(digits.length, 3)].current?.focus();
      }
      return;
    }

    newOtp[index] = value;
    setOtp(newOtp);

    if (value) {
      animateOtpBox(index);
      if (index < 3) {
        otpInputs[index + 1].current?.focus();
      }
    }

    if (value && index === 3) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 4) {
        handleVerifyOTP(fullOtp);
      }
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs[index - 1].current?.focus();
    }
  };

  const handleCompleteName = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    setLoading(true);
    setError('');
    Keyboard.dismiss();
    try {
      const response = await authService.completeRegistration(phoneNumber, name);
      await login({
        id: response._id,
        name: response.name,
        phoneNumber: response.phoneNumber,
        token: response.token,
        displayName: response.name,
      });
    } catch (err) {
      setError(err.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => {
    navigation.replace('MatchSetup');
  };

  // Animated button component
  const AnimatedButton = ({ onPress, disabled, loading, text, style, textStyle }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        friction: 5,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }).start();
    };

    return (
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={1}
      >
        <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }, disabled && styles.btnDisabled]}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={textStyle}>{text}</Text>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  };

  // Logo interpolations
  const logoScale = logoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });
  const logoOpacity = logoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Card interpolations
  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
  });
  const cardOpacity = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

        {/* Animated Background Decorations */}
        <Animated.View
          style={[
            styles.bgCircle1,
            {
              opacity: bgCircle1Anim,
              transform: [{
                scale: bgCircle1Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1],
                })
              }]
            }
          ]}
        />
        <Animated.View
          style={[
            styles.bgCircle2,
            {
              opacity: bgCircle2Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.2],
              }),
              transform: [{
                scale: bgCircle2Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                })
              }]
            }
          ]}
        />
        <Animated.View
          style={[
            styles.bgCircle3,
            {
              opacity: bgCircle1Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.15],
              }),
            }
          ]}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* Top Section - Logo */}
            <Animated.View
              style={[
                styles.logoSection,
                {
                  opacity: logoOpacity,
                  transform: [{ scale: logoScale }],
                }
              ]}
            >
              <Image
                source={require('../../assets/logo/criczone_logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Bottom Section - Form */}
            <Animated.View
              style={[
                styles.formSection,
                {
                  opacity: cardOpacity,
                  transform: [{ translateY: cardTranslateY }],
                }
              ]}
            >
          <View style={styles.card}>
            {error ? (
              <Animated.View style={[styles.errorBox, { opacity: fadeAnim }]}>
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}

            {/* Phone Step */}
            {step === 'phone' && (
              <Animated.View style={{ opacity: fadeAnim }}>
                <Text style={styles.title}>Welcome!</Text>
                <Text style={styles.subtitle}>Enter your phone number to get started</Text>

                <View style={styles.inputGroup}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>+94</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="Phone Number"
                    placeholderTextColor={colors.textLight}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    maxLength={15}
                  />
                </View>

                <AnimatedButton
                  onPress={handleSendOTP}
                  disabled={loading}
                  loading={loading}
                  text="Continue"
                  style={styles.primaryBtn}
                  textStyle={styles.primaryBtnText}
                />

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <AnimatedButton
                  onPress={handleGuest}
                  disabled={false}
                  loading={false}
                  text="Continue as Guest"
                  style={styles.secondaryBtn}
                  textStyle={styles.secondaryBtnText}
                />
              </Animated.View>
            )}

            {/* OTP Step */}
            {step === 'otp' && (
              <Animated.View style={{ opacity: fadeAnim }}>
                <View style={styles.stepIconContainer}>
                  <View style={styles.stepIcon}>
                    <Text style={styles.stepIconText}>OTP</Text>
                  </View>
                </View>

                <Text style={styles.title}>Verification</Text>
                <Text style={styles.subtitle}>
                  Enter the 4-digit code sent to{'\n'}
                  <Text style={styles.phoneHighlight}>{phoneNumber}</Text>
                </Text>

                <View style={styles.otpContainer}>
                  {[0, 1, 2, 3].map((index) => (
                    <Animated.View
                      key={index}
                      style={[
                        styles.otpBoxWrapper,
                        { transform: [{ scale: otpBoxAnims[index] }] }
                      ]}
                    >
                      <TextInput
                        ref={otpInputs[index]}
                        style={[
                          styles.otpBox,
                          otp[index] ? styles.otpBoxFilled : null,
                        ]}
                        value={otp[index]}
                        onChangeText={(value) => handleOtpChange(value, index)}
                        onKeyPress={(e) => handleOtpKeyPress(e, index)}
                        keyboardType="number-pad"
                        maxLength={index === 0 ? 4 : 1}
                        selectTextOnFocus
                      />
                    </Animated.View>
                  ))}
                </View>

                {loading && (
                  <View style={styles.verifyingContainer}>
                    <ActivityIndicator color={colors.secondary} size="small" />
                    <Text style={styles.verifyingText}>Verifying...</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => {
                    setOtp(['', '', '', '']);
                    setError('');
                    animateStepChange('phone');
                  }}
                >
                  <Text style={styles.linkText}>Change phone number</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Name Step */}
            {step === 'name' && (
              <Animated.View style={{ opacity: fadeAnim }}>
                <View style={styles.stepIconContainer}>
                  <View style={[styles.stepIcon, { backgroundColor: colors.accent }]}>
                    <Text style={styles.stepIconText}>Hi!</Text>
                  </View>
                </View>

                <Text style={styles.title}>Almost There!</Text>
                <Text style={styles.subtitle}>What should we call you?</Text>

                <TextInput
                  style={styles.nameInput}
                  placeholder="Your Name"
                  placeholderTextColor={colors.textLight}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />

                <AnimatedButton
                  onPress={handleCompleteName}
                  disabled={loading}
                  loading={loading}
                  text="Get Started"
                  style={styles.primaryBtn}
                  textStyle={styles.primaryBtnText}
                />
              </Animated.View>
            )}
          </View>

            {/* Footer */}
            <Animated.Text style={[styles.footer, { opacity: cardOpacity }]}>
              Secure & Private
            </Animated.Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Background decorations
  bgCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.light,
    opacity: 0.4,
    top: -80,
    right: -80,
  },
  bgCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.accent,
    opacity: 0.2,
    top: height * 0.3,
    left: -100,
  },
  bgCircle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.secondary,
    opacity: 0.15,
    bottom: 50,
    right: -50,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  // Logo Section - Top
  logoSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
    minHeight: height * 0.35,
  },
  logo: {
    width: width * 0.55,
    height: width * 0.55,
  },
  // Form Section - Bottom
  formSection: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 28,
    padding: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 216, 234, 0.3)',
  },
  // Typography
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  // Input Group
  inputGroup: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  countryCode: {
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingHorizontal: 18,
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: colors.light,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.light,
  },
  // Step Icon
  stepIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  stepIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  stepIconText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
  },
  phoneHighlight: {
    color: colors.secondary,
    fontWeight: '700',
  },
  // OTP Boxes
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 24,
  },
  otpBoxWrapper: {
    // Wrapper for animation
  },
  otpBox: {
    width: 58,
    height: 64,
    backgroundColor: colors.background,
    borderRadius: 16,
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: colors.light,
  },
  otpBoxFilled: {
    borderColor: colors.secondary,
    backgroundColor: 'rgba(45, 125, 210, 0.08)',
  },
  verifyingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyingText: {
    marginLeft: 10,
    fontSize: 15,
    color: colors.secondary,
    fontWeight: '600',
  },
  // Name Input
  nameInput: {
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.light,
    marginBottom: 20,
  },
  // Buttons
  primaryBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.secondary,
    backgroundColor: 'rgba(45, 125, 210, 0.05)',
  },
  secondaryBtnText: {
    color: colors.secondary,
    fontSize: 16,
    fontWeight: '700',
  },
  linkBtn: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: '600',
  },
  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: colors.light,
  },
  dividerText: {
    paddingHorizontal: 18,
    color: colors.textLight,
    fontSize: 14,
    fontWeight: '500',
  },
  // Error
  errorBox: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(231, 76, 60, 0.25)',
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  // Footer
  footer: {
    textAlign: 'center',
    color: colors.textLight,
    fontSize: 13,
    marginTop: 20,
  },
});

export default AuthScreen;
