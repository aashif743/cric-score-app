import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { AuthContext } from '../context/AuthContext';
import { colors } from '../utils/theme';

// Screens
import AuthScreen from '../screens/AuthScreen';
import MatchSetupScreen from '../screens/MatchSetupScreen';
import ScoreCardScreen from '../screens/ScoreCardScreen';
import FullScorecardScreen from '../screens/FullScorecardScreen';

// Tab Navigator
import BottomTabNavigator from '../components/BottomTabNavigator';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { user, loading } = useContext(AuthContext);

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {user ? (
          // Authenticated user screens
          <>
            <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
            <Stack.Screen name="MatchSetup" component={MatchSetupScreen} />
            <Stack.Screen name="ScoreCard" component={ScoreCardScreen} />
            <Stack.Screen name="FullScorecard" component={FullScorecardScreen} />
          </>
        ) : (
          // Non-authenticated user screens
          <>
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="MatchSetup" component={MatchSetupScreen} />
            <Stack.Screen name="ScoreCard" component={ScoreCardScreen} />
            <Stack.Screen name="FullScorecard" component={FullScorecardScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

export default AppNavigator;
