import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { login as apiLogin, register as apiRegister, me as apiMe, logout as apiLogout } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [bootLoading, setBootLoading] = useState(true);

  // При старте: если токен есть и валиден — подтягиваем профайл
  useEffect(() => {
    (async () => {
      try {
        const u = await apiMe();
        setUser(u);
      } catch (e) {
        setUser(null);
      } finally {
        setBootLoading(false);
      }
    })();
  }, []);

  const value = useMemo(() => ({
    user,
    isAuthed: !!user,
    bootLoading,
    async login(username, password) {
      const data = await apiLogin(username, password);
      // /login уже возвращает user
      setUser(data.user);
      return data;
    },
    async register(payload) {
      const data = await apiRegister(payload);
      // /register возвращает user
      setUser(data.user);
      return data;
    },
    async refreshMe() {
      const u = await apiMe();
      setUser(u);
      return u;
    },
    async logout() {
      await apiLogout();
      setUser(null);
    },
  }), [user, bootLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
