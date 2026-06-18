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
import TournamentListScreen from '../screens/TournamentListScreen';
import TournamentFormatListScreen from '../screens/TournamentFormatListScreen';
import TournamentCreateScreen from '../screens/TournamentCreateScreen';
import TournamentDetailScreen from '../screens/TournamentDetailScreen';
import KnockoutScheduleScreen from '../screens/KnockoutScheduleScreen';
import LeagueScheduleScreen from '../screens/LeagueScheduleScreen';
import LeaguePointsTableScreen from '../screens/LeaguePointsTableScreen';
import TournamentStatsScreen from '../screens/TournamentStatsScreen';
import FullBracketScreen from '../screens/FullBracketScreen';
import PublicLiveMatchScreen from '../screens/PublicLiveMatchScreen';

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
            <Stack.Screen name="TournamentList" component={TournamentListScreen} />
            <Stack.Screen name="TournamentFormatList" component={TournamentFormatListScreen} />
            <Stack.Screen name="TournamentCreate" component={TournamentCreateScreen} />
            <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
            <Stack.Screen name="KnockoutSchedule" component={KnockoutScheduleScreen} />
            <Stack.Screen name="LeagueSchedule" component={LeagueScheduleScreen} />
            <Stack.Screen name="LeaguePointsTable" component={LeaguePointsTableScreen} />
            <Stack.Screen name="TournamentStats" component={TournamentStatsScreen} />
            <Stack.Screen name="FullBracket" component={FullBracketScreen} />
            <Stack.Screen name="PublicLiveMatch" component={PublicLiveMatchScreen} />
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
