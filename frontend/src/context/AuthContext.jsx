import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Hydrate the session SYNCHRONOUSLY from localStorage so the very first render
  // already knows whether the user is logged in. Loading it later (in an effect)
  // made the first render see user=null, which bounced direct visits to guarded
  // routes (e.g. /admin → /auth → /dashboard → /auctions) before auth hydrated.
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (e) {
      return null;
    }
  });

  // Keep in sync if another tab logs in/out.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'user') {
        try { setUser(e.newValue ? JSON.parse(e.newValue) : null); } catch { setUser(null); }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Function to update user state and save to localStorage
  const login = (userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  // Function to clear user state and localStorage
  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = { user, login, logout };
  
  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
