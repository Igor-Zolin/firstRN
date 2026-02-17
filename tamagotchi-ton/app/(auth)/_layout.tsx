import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { useAuth } from '../src/auth/AuthContext';

export default function AuthLayout() {
  const { isAuthed, bootLoading } = useAuth();

  if (bootLoading) return null;

  // Уже залогинен → в приложение
  if (isAuthed) {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}