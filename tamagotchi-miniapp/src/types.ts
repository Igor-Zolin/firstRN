export type Stats = {
  energy: number;
  energyCap: number;
  coins: number;
  coinsCap: number;
  beanz: number;
  level: number;
  xp: number;
  xpToNext: number;
  xpProgress: number;
  tapMult: number;
  coinsRate: number;
  beanzRate: number;
  upg_beanz_level: number;
  upg_tap_level: number;
  upg_coins_level: number;
  upg_energy_cap_level: number;
};

export type Equipped = {
  backgroundItemId: number | null;
  weaponItemId: number | null;
  eyesItemId: number | null;
  clothItemId: number | null;
  hatItemId: number | null;
};

export type InventoryItem = {
  item_id: number;
  quantity: number;
  name: string;
  type: string;
  model_name: string;
  rarity: string;
  price: number;
  imageUrl: string;
};

export type SellableItem = {
  item_id: number;
  quantity: number;
  name: string;
  type: string;
  model_name: string;
  rarity: string;
  imageUrl: string;
  lockedByEquip: number;
  maxListable: number;
};

export type MarketListing = {
  id: number;
  seller_user_id: number;
  seller_username?: string;
  item_id: number;
  name: string;
  type: string;
  rarity: string;
  imageUrl: string;
  price_per_unit: number;
  quantity_total: number;
  quantity_left: number;
  isMine?: boolean;
};

export type HomeSnapshot = {
  stats: Stats;
  equipped: Equipped;
  inventory: InventoryItem[];
};

export type ProfileSnapshot = {
  equipped: Equipped;
  inventory: InventoryItem[];
};

export type MarketSnapshot = {
  stats: Stats;
  sellable: SellableItem[] | null;
  listings: MarketListing[];
  myListings: MarketListing[];
};

export type ShopItem = {
  id: number;
  name: string;
  type: string;
  model_name: string;
  rarity: string;
  price: number;
  supply: number;
  imageUrl: string;
};

export type BuyItemResponse = {
  ok: boolean;
  spent: number;
  remainingSupply: number | null;
  item: {
    id: number;
    name: string;
    type: string;
  };
  stats: Stats;
  xpGained: number;
};

export type MarketCreateListingResponse = {
  ok: boolean;
  listing: MarketListing;
};

export type MarketCancelListingResponse = {
  ok: boolean;
  listingId: number;
  returnedQuantity: number;
};

export type MarketBuyResponse = {
  ok: boolean;
  listingId: number;
  spent: number;
  quantityBought: number;
  newQuantityLeft: number;
  status: string;
  buyerBeanz: number | null;
};

export type User = {
  id: number;
  username: string;
  email: string;
  created_at?: string;
  ton_wallet_address?: string | null;
  ton_wallet_network?: 'testnet' | 'mainnet' | null;
  ton_wallet_connected_at?: number | null;
};

export type TonWalletBinding = {
  walletAddress: string | null;
  walletAddressFriendly: string | null;
  network: 'testnet' | 'mainnet' | null;
  connectedAt: number | null;
};

export type TonProofChallenge = {
  payload: string;
  expiresAt: number;
  domain: string;
  network: 'testnet' | 'mainnet';
  chain: '-239' | '-3';
};
