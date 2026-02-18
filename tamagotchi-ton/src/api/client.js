import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOKEN_KEY = 'auth_token';

export const getApiBase = () => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window?.location) {
      const { protocol, hostname } = window.location;
      return `${protocol}//${hostname}:3000`;
    }
    return 'http://localhost:3000';
  }

  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  // iOS simulator может работать с localhost, но ты указал IP — оставлю твой вариант
  return 'http://192.168.3.72:3000';
};

async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

async function setToken(token) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body } = {}) {
  const token = await getToken();
  const API_BASE = getApiBase(); // ВАЖНО: вызываем функцию

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text().catch(() => '');
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && (data.error || data.message)) ||
      (typeof data === 'string' && data) ||
      `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

// ---- auth ----
export async function login(username, password) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });

  if (data?.token) await setToken(data.token);
  return data;
}

export async function register(payload) {
  const data = await request('/api/auth/register', {
    method: 'POST',
    body: payload,
  });

  if (data?.token) await setToken(data.token);
  return data;
}

export async function me() {
  return request('/api/auth/me');
}

export async function logout() {
  await clearToken();
}

// ---- stats ----
export async function getMyStats() {
  return request('/api/stats/me');
}

// ---- actions ----
export async function tap() {
  return request('/api/actions/tap', { method: 'POST' });
}

export async function upgrade(kind) {
  return request('/api/actions/upgrade', { method: 'POST', body: { kind } });
}

export async function resetProgress() {
  return request('/api/actions/reset', { method: 'POST' });
}

export async function cheat() {
  return request('/api/actions/cheat', { method: 'POST' });
}
