import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  me as apiMe,
  logout as apiLogout,
} from '../api/client';

type AuthUser = {
  id: number;
  username: string;
  email: string;
  created_at?: string;
};

type LoginResponse = {
  user: AuthUser;
  token?: string;
};

type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthed: boolean;
  bootLoading: boolean;
  login: (username: string, password: string) => Promise<LoginResponse>;
  register: (payload: RegisterPayload) => Promise<LoginResponse>;
  refreshMe: () => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bootLoading, setBootLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const u = await apiMe();
        setUser(u);
      } catch {
        setUser(null);
      } finally {
        setBootLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthed: !!user,
      bootLoading,
      async login(username: string, password: string) {
        const data = await apiLogin(username, password);
        setUser(data.user);
        return data;
      },
      async register(payload: RegisterPayload) {
        const data = await apiRegister(payload);
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
    }),
    [user, bootLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
