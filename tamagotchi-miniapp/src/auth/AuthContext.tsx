/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearToken,
  login as apiLogin,
  loginWithTelegram,
  me as apiMe,
  register as apiRegister,
} from '../api/client';
import { getTelegramInitData } from '../lib/telegram';
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
  telegramAuthError: string;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  refreshMe: () => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [telegramAuthError, setTelegramAuthError] = useState('');

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const initData = getTelegramInitData();
        if (initData) {
          await loginWithTelegram(initData);
        }

        const currentUser = await apiMe();
        if (active) setUser(currentUser);
      } catch (error) {
        clearToken();
        if (active) {
          setUser(null);
          if (getTelegramInitData()) {
            setTelegramAuthError(
              error instanceof Error ? error.message : 'Telegram login failed'
            );
          }
        }
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
      telegramAuthError,
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
    [bootLoading, telegramAuthError, user]
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
