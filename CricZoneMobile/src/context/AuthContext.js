import React, { createContext, useState, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UNAUTHORIZED_EVENT } from '../api/config';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from storage on app start
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Error loading user from storage:', error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  // When any API call gets a 401 (expired/invalid token), the axios interceptor
  // clears storage and emits this event. Drop the user from state so the app
  // navigates back to the login screen and they can re-authenticate.
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
      setUser(userData);
    } catch (error) {
      console.error('Error saving user to storage:', error);
    }
  };

  // Logout function - clears user from state and storage
  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('currentMatch');
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
