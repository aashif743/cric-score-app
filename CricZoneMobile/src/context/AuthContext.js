import React, { createContext, useState, useEffect } from 'react';
import { DeviceEventEmitter, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API, { UNAUTHORIZED_EVENT, TOKEN_REFRESHED_EVENT } from '../api/config';

export const AuthContext = createContext();

// Stay logged in while the app is used; only sign out after a month of not
// opening it. We track the last time the app was active and compare on launch.
const INACTIVITY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const LAST_ACTIVE_KEY = 'lastActiveAt';

const stampActive = () =>
  AsyncStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())).catch(() => {});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Silently swap the stored token for a fresh long-lived one. Keeps an active
  // user logged in indefinitely. A 401 here means the token is truly dead — the
  // axios interceptor will clear the session and fire UNAUTHORIZED_EVENT.
  const refreshSession = async (current) => {
    if (!current?.token) return;
    try {
      const res = await API.post(
        '/users/refresh-token',
        {},
        { headers: { Authorization: `Bearer ${current.token}` } },
      );
      const newToken = res?.data?.token;
      if (newToken) {
        const updated = { ...current, token: newToken };
        await AsyncStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
      }
    } catch (e) {
      // 401 → handled by the interceptor (logout). Network errors → stay signed
      // in so offline launches don't kick the user out.
    }
  };

  // Load user from storage on app start
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          const lastActive = parseInt((await AsyncStorage.getItem(LAST_ACTIVE_KEY)) || '0', 10);
          if (lastActive && Date.now() - lastActive > INACTIVITY_MS) {
            // Untouched for over a month → sign out.
            await AsyncStorage.multiRemove(['user', 'currentMatch', LAST_ACTIVE_KEY]);
            setUser(null);
          } else {
            setUser(parsed);
            await stampActive();
            refreshSession(parsed); // background; don't block the UI
          }
        }
      } catch (error) {
        console.error('Error loading user from storage:', error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  // Bump the last-active timestamp whenever the app is brought to foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') stampActive();
    });
    return () => sub.remove();
  }, []);

  // The interceptor recovered a 401 by refreshing the token — mirror the new
  // token into state so in-flight screens keep using a valid one.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(TOKEN_REFRESHED_EVENT, (updated) => {
      if (updated?.token) setUser((prev) => (prev ? { ...prev, ...updated } : updated));
    });
    return () => sub.remove();
  }, []);

  // Only fires when a token is genuinely dead (refresh failed). Drop the user so
  // the app returns to login.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(UNAUTHORIZED_EVENT, () => {
      setUser(null);
    });
    return () => sub.remove();
  }, []);

  // Login function - saves user to state and storage
  const login = async (userData) => {
    try {
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await stampActive();
      setUser(userData);
    } catch (error) {
      console.error('Error saving user to storage:', error);
    }
  };

  // Logout function - clears user from state and storage
  const logout = async () => {
    try {
      await AsyncStorage.multiRemove(['user', 'currentMatch', LAST_ACTIVE_KEY]);
      setUser(null);
    } catch (error) {
      console.error('Error removing user from storage:', error);
    }
  };

  // Update user data
  const updateUser = async (userData) => {
    try {
      const updatedUser = { ...user, ...userData };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
