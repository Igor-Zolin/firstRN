/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clearToken, login as apiLogin, me as apiMe, register as apiRegister } from '../api/client';
import type { User } from '../types';

type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type AuthContextValue = {
  user: User | null;
  isAuthed: boolean;
  bootLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  refreshMe: () => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [bootLoading, setBootLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const currentUser = await apiMe();
        if (active) setUser(currentUser);
      } catch {
        clearToken();
        if (active) setUser(null);
      } finally {
        if (active) setBootLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthed: Boolean(user),
      bootLoading,
      async login(username: string, password: string) {
        await apiLogin(username, password);
        const currentUser = await apiMe();
        setUser(currentUser);
      },
      async register(payload: RegisterPayload) {
        await apiRegister(payload);
        const currentUser = await apiMe();
        setUser(currentUser);
      },
      async refreshMe() {
        const currentUser = await apiMe();
        setUser(currentUser);
        return currentUser;
      },
      async logout() {
        clearToken();
        setUser(null);
      },
    }),
    [bootLoading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
