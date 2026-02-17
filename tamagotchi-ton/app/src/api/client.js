import { Platform } from 'react-native';

// ВАЖНО: не вычисляем API_BASE на верхнем уровне файла

export const getApiBase = () => {
  // Web: window доступен только в браузере, не в SSR
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window?.location) {
      const { protocol, hostname } = window.location;
      return `${protocol}//${hostname}:3000`;
    }
    // SSR fallback (когда window нет)
    return 'http://localhost:3000';
  }

  // Native: подставь актуальный адрес под свою среду
  return 'http://10.0.2.2:3000';
};

// Простое хранилище токена (пока)
const tokenStorage = {
  async get() {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return null; // SSR
      return localStorage.getItem('token');
    }
    return global.__token ?? null;
  },
  async set(token) {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return; // SSR
      localStorage.setItem('token', token);
      return;
    }
    global.__token = token;
  },
  async clear() {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return; // SSR
      localStorage.removeItem('token');
      return;
    }
    global.__token = null;
  },
};

export async function apiFetch(path, options = {}) {
  const API_BASE = getApiBase(); // <-- вычисляем здесь, когда уже есть окружение
  const token = await tokenStorage.get();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  const bodyText = await res.text();
  const data =
    contentType.includes('application/json') && bodyText
      ? JSON.parse(bodyText)
      : bodyText;

  if (!res.ok) {
    const message =
      typeof data === 'object' && data?.error
        ? data.error
        : typeof data === 'string' && data
        ? data
        : `Request failed with ${res.status}`;

    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function login(username, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (data?.token) await tokenStorage.set(data.token);
  return data;
}

export async function register(payload) {
  const data = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (data?.token) await tokenStorage.set(data.token);
  return data;
}

export async function me() {
  return apiFetch('/api/auth/me');
}

export async function logout() {
  await tokenStorage.clear();
}
