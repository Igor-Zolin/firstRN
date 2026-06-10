import type {
  BuyItemResponse,
  Equipped,
  HomeSnapshot,
  MarketBuyResponse,
  MarketCancelListingResponse,
  MarketCreateListingResponse,
  MarketSnapshot,
  ProfileSnapshot,
  ShopItem,
  Stats,
  User,
} from '../types';

const TOKEN_KEY = 'miniapp_auth_token';

export function getApiBase() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim().replace(/\/+$/, '');

  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname } = window.location;
    const isLocal = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(
      hostname
    );
    if (isLocal) return `${protocol}//${hostname}:3000`;

    return window.location.origin;
  }

  return 'http://localhost:3000';
}

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
};

type AuthResponse = {
  token?: string;
  user?: User;
  message?: string;
  code?: number;
};

type DailyClaimResponse = {
  ok?: boolean;
  claimed?: boolean;
  streak?: number;
  rewardXp?: number;
  level?: number;
  xp?: number;
};

type EquipResponse = {
  ok?: boolean;
  equipped?: Equipped;
};

async function request(path: string, { method = 'GET', body }: RequestOptions = {}) {
  const token = getToken();
  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text().catch(() => '');
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!res.ok) {
    const fromObject =
      data &&
      typeof data === 'object' &&
      ('error' in data || 'message' in data)
        ? String(
            (data as { error?: unknown; message?: unknown }).error ??
              (data as { error?: unknown; message?: unknown }).message
          )
        : '';
    const fromString = typeof data === 'string' ? data : '';
    const msgText = fromObject || fromString || `HTTP ${res.status}`;
    const err = new Error(msgText) as Error & { status?: number; data?: unknown };
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function login(username: string, password: string) {
  const data = (await request('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  })) as AuthResponse;
  if (data?.token) setToken(data.token);
  return data;
}

export async function register(payload: {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  const data = (await request('/api/auth/register', {
    method: 'POST',
    body: payload,
  })) as AuthResponse;
  if (data?.token) setToken(data.token);
  return data;
}

export async function loginWithTelegram(initData: string) {
  const data = (await request('/api/auth/telegram', {
    method: 'POST',
    body: { initData },
  })) as AuthResponse;

  if (!data?.token) throw new Error('Telegram login did not return a token');
  setToken(data.token);
  return data;
}

export async function me() {
  return request('/api/auth/me') as Promise<User>;
}

export async function getMyStats() {
  return request('/api/stats/me') as Promise<Stats>;
}

export async function getHomeSnapshot() {
  return request('/api/snapshot/home') as Promise<HomeSnapshot>;
}

export async function getProfileSnapshot() {
  return request('/api/snapshot/profile') as Promise<ProfileSnapshot>;
}

export async function getMarketSnapshot(params: { mode?: 'focus' | 'full'; limit?: number; offset?: number } = {}) {
  const q = new URLSearchParams();
  if (params.mode) q.set('mode', params.mode);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  const qs = q.toString();
  return request(`/api/snapshot/market${qs ? `?${qs}` : ''}`) as Promise<MarketSnapshot>;
}

export async function dailyClaim() {
  return request('/api/daily/claim', { method: 'POST' }) as Promise<DailyClaimResponse>;
}

export async function tap() {
  return request('/api/actions/tap', { method: 'POST' }) as Promise<Stats>;
}

export async function upgrade(kind: string) {
  return request('/api/actions/upgrade', { method: 'POST', body: { kind } }) as Promise<Stats>;
}

export async function resetProgress() {
  return request('/api/actions/reset', { method: 'POST' }) as Promise<Stats>;
}

export async function resetInventory() {
  return request('/api/actions/reset-inv', { method: 'POST' });
}

export async function cheat() {
  return request('/api/actions/cheat', { method: 'POST' }) as Promise<Stats>;
}

export async function getShopCategories() {
  return request('/api/shop/categories') as Promise<string[]>;
}

export async function getShopItems(params: { type?: string; rarity?: string; q?: string; limit?: number; offset?: number } = {}) {
  const q = new URLSearchParams();
  if (params.type) q.set('type', params.type);
  if (params.rarity) q.set('rarity', params.rarity);
  if (params.q) q.set('q', params.q);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  const qs = q.toString();
  return request(`/api/shop/items${qs ? `?${qs}` : ''}`) as Promise<ShopItem[]>;
}

export async function buyItem(itemId: number) {
  return request('/api/shop/buy', { method: 'POST', body: { itemId } }) as Promise<BuyItemResponse>;
}

export async function equipItem(slot: string, itemId: number) {
  return request('/api/equip', { method: 'POST', body: { slot, itemId } }) as Promise<EquipResponse>;
}

export async function unequipItem(slot: string) {
  return request('/api/equip/unequip', { method: 'POST', body: { slot } }) as Promise<EquipResponse>;
}

export async function createMarketListing(payload: { itemId: number; quantity: number; pricePerUnit: number }) {
  return request('/api/market/listings', { method: 'POST', body: payload }) as Promise<MarketCreateListingResponse>;
}

export async function cancelMarketListing(listingId: number) {
  return request(`/api/market/listings/${listingId}/cancel`, { method: 'POST' }) as Promise<MarketCancelListingResponse>;
}

export async function buyFromMarket(listingId: number, quantity = 1) {
  return request('/api/market/buy', { method: 'POST', body: { listingId, quantity } }) as Promise<MarketBuyResponse>;
}

export async function downloadAvatar() {
  const token = getToken();
  const res = await fetch(`${getApiBase()}/api/avatar/download`, {
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
}
