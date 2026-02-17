import { Platform } from 'react-native';

// 1) База API: web берет hostname текущей страницы, native — руками IP/эмулятор
export const getApiBase = () => {
  if (Platform.OS === 'web') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3000`;
  }
  // Варианты:
  // Android emulator: 10.0.2.2
  // iOS simulator: localhost
  // Real device: IP твоего ПК в Wi-Fi, например http://192.168.1.10:3000
  return 'http://10.0.2.2:3000';
};

const API_BASE = getApiBase();

// 2) Хранилище токена (минимально)
const tokenStorage = {
  async get() {
    if (Platform.OS === 'web') return localStorage.getItem('token');
    // если хочешь позже — подключим expo-secure-store
    return global.__token ?? null;
  },
  async set(token) {
    if (Platform.OS === 'web') localStorage.setItem('token', token);
    else global.__token = token;
  },
  async clear() {
    if (Platform.OS === 'web') localStorage.removeItem('token');
    else global.__token = null;
  },
};

// 3) Универсальный запрос
export async function apiFetch(path, options = {}) {
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

  // Научимся читать ошибки красиво
  const contentType = res.headers.get('content-type') || '';
  const bodyText = await res.text();
  const data = contentType.includes('application/json') && bodyText
    ? JSON.parse(bodyText)
    : bodyText;

  if (!res.ok) {
    const message =
      (typeof data === 'object' && data && data.error) ? data.error :
      (typeof data === 'string' && data) ? data :
      `Request failed with ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

// 4) Методы auth
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
