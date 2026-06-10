CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ton_wallet_address TEXT,
  ton_wallet_connected_at BIGINT
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS language_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ton_wallet_network TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ton_wallet_public_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id
  ON users(telegram_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ton_wallet_address
  ON users(ton_wallet_address)
  WHERE ton_wallet_address IS NOT NULL;

CREATE TABLE IF NOT EXISTS ton_proof_challenges (
  payload TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  used_at BIGINT,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
);

CREATE INDEX IF NOT EXISTS idx_ton_proof_challenges_user
  ON ton_proof_challenges(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ton_proof_challenges_expiry
  ON ton_proof_challenges(expires_at)
  WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS user_stats (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  energy INTEGER NOT NULL DEFAULT 0,
  energy_cap INTEGER NOT NULL DEFAULT 100,
  coins NUMERIC(20, 2) NOT NULL DEFAULT 0,
  coins_cap INTEGER NOT NULL DEFAULT 500,
  beanz BIGINT NOT NULL DEFAULT 0,
  xp BIGINT NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  tap_mult_x100 INTEGER NOT NULL DEFAULT 100,
  coins_rate_x100 INTEGER NOT NULL DEFAULT 100,
  beanz_rate_x1000 INTEGER NOT NULL DEFAULT 0,
  upg_tap_level INTEGER NOT NULL DEFAULT 0,
  upg_coins_level INTEGER NOT NULL DEFAULT 0,
  upg_energy_cap_level INTEGER NOT NULL DEFAULT 0,
  upg_beanz_level INTEGER NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
);

CREATE TABLE IF NOT EXISTS user_meta (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_tick_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT),
  balance_ver INTEGER NOT NULL DEFAULT 1,
  is_banned SMALLINT NOT NULL DEFAULT 0 CHECK (is_banned IN (0, 1)),
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT),
  daily_streak INTEGER NOT NULL DEFAULT 0,
  last_daily_day BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS items (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  model_name TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'common',
  price BIGINT NOT NULL DEFAULT 0,
  supply INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_items_model_name ON items(model_name);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_rarity_price_id ON items(rarity, price, id);

CREATE TABLE IF NOT EXISTS inventory (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id);

CREATE TABLE IF NOT EXISTS market_listings (
  id BIGSERIAL PRIMARY KEY,
  seller_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  price_per_unit BIGINT NOT NULL CHECK (price_per_unit > 0),
  quantity_total INTEGER NOT NULL CHECK (quantity_total > 0),
  quantity_left INTEGER NOT NULL CHECK (quantity_left >= 0),
  status TEXT NOT NULL DEFAULT 'active',
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT),
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT),
  settlement_currency TEXT NOT NULL DEFAULT 'beanz',
  price_per_unit_ton_nano TEXT
);

CREATE INDEX IF NOT EXISTS idx_market_status
  ON market_listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_status_qty_created
  ON market_listings(status, quantity_left, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_market_seller
  ON market_listings(seller_user_id, status);
CREATE INDEX IF NOT EXISTS idx_market_currency
  ON market_listings(settlement_currency, status);

CREATE TABLE IF NOT EXISTS user_equipped (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  background_item_id BIGINT REFERENCES items(id) ON DELETE SET NULL,
  weapon_item_id BIGINT REFERENCES items(id) ON DELETE SET NULL,
  eyes_item_id BIGINT REFERENCES items(id) ON DELETE SET NULL,
  cloth_item_id BIGINT REFERENCES items(id) ON DELETE SET NULL,
  hat_item_id BIGINT REFERENCES items(id) ON DELETE SET NULL,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
);

CREATE INDEX IF NOT EXISTS idx_equipped_user ON user_equipped(user_id);
