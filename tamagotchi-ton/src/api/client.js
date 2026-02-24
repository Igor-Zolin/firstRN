import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export const TOKEN_KEY = 'auth_token';

export const getApiBase = () => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window?.location) {
      const { protocol, hostname } = window.location;
      return `${protocol}//${hostname}:3000`;
    }
    return 'http://localhost:3000';
  }
  // localhost for Android
  if (Platform.OS === 'android') return 'http://172.20.10.5:3000';
  // localhost's IP for iOS simulator
  return 'http://172.20.10.5:3000';
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
  const API_BASE = getApiBase(); // Call function

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

export async function downloadAvatar() {
  const API_BASE = getApiBase();
  const token = await AsyncStorage.getItem(TOKEN_KEY);

  // ---------- WEB ----------
  if (Platform.OS === 'web') {
    const res = await fetch(`${API_BASE}/api/avatar/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) throw new Error(`Download failed: ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'avatar.png';
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
    return;
  }

  // ---------- iOS / Android ----------
  const fileUri = FileSystem.cacheDirectory + `avatar_${Date.now()}.png`;

  const { uri } = await FileSystem.downloadAsync(
    `${API_BASE}/api/avatar/download`,
    fileUri,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle: 'Save avatar',
    UTI: 'public.png', // iOS
  });
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

export async function dailyClaim() {
  return request('/api/daily/claim', { method: 'POST' });
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

// ---- shop ----
export async function getShopCategories() {
  return request('/api/shop/categories');
}

export async function getShopItemsMe(params = {}) {
  const q = new URLSearchParams();
  if (params.type) q.set('type', params.type);
  if (params.rarity) q.set('rarity', params.rarity);
  if (params.q) q.set('q', params.q);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));

  const qs = q.toString();
  return request(`/api/shop/items/me${qs ? `?${qs}` : ''}`);
}

export async function buyItem(itemId) {
  return request('/api/shop/buy', { method: 'POST', body: { itemId } });
}

export async function getInventoryMe() {
  return request('/api/inventory/me');
}

export async function resetInventory() {
  return request('/api/actions/reset-inv', {method: 'POST'});
}

// ---- equip ----
export async function getEquippedMe() {
  return request('/api/equip/me');
}

export async function equipItem(slot, itemId) {
  return request('/api/equip', { method: 'POST', body: { slot, itemId } });
}