const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./db.sqlite');

db.serialize(() => {
  // SQLite does not enforce FK constraints unless this is enabled per connection.
  db.run(`PRAGMA foreign_keys = ON`);
  db.run(`PRAGMA journal_mode = WAL`);
  db.run(`PRAGMA synchronous = NORMAL`);
  db.run(`PRAGMA temp_store = MEMORY`);
  db.run(`PRAGMA busy_timeout = 5000`);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id               INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

      energy                INTEGER NOT NULL DEFAULT 0,
      energy_cap            INTEGER NOT NULL DEFAULT 100,

      coins                 INTEGER NOT NULL DEFAULT 0,
      coins_cap             INTEGER NOT NULL DEFAULT 500,

      beanz                 INTEGER NOT NULL DEFAULT 0,

      xp                    INTEGER NOT NULL DEFAULT 0,
      level                 INTEGER NOT NULL DEFAULT 1,

      tap_mult_x100         INTEGER NOT NULL DEFAULT 100,
      coins_rate_x100       INTEGER NOT NULL DEFAULT 100,
      beanz_rate_x1000      INTEGER NOT NULL DEFAULT 0,

      upg_tap_level         INTEGER NOT NULL DEFAULT 0,
      upg_coins_level       INTEGER NOT NULL DEFAULT 0,
      upg_energy_cap_level  INTEGER NOT NULL DEFAULT 0,
      upg_beanz_level       INTEGER NOT NULL DEFAULT 0,

      updated_at            INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_meta (
      user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

      last_tick_at   INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      balance_ver    INTEGER NOT NULL DEFAULT 1,
      is_banned      INTEGER NOT NULL DEFAULT 0,
      updated_at     INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      daily_streak   INTEGER NOT NULL DEFAULT 0,
      last_daily_day INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Таблица предметов
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      model_name TEXT NOT NULL,
      rarity TEXT DEFAULT 'common',
      price INTEGER DEFAULT 0,
      supply INTEGER NOT NULL DEFAULT 50,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_items_model_name ON items(model_name)`);

  // Таблица инвентаря (relations table)
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
      UNIQUE(user_id, item_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS market_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      price_per_unit INTEGER NOT NULL,
      quantity_total INTEGER NOT NULL,
      quantity_left INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS user_equipped (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

      background_item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
      weapon_item_id     INTEGER REFERENCES items(id) ON DELETE SET NULL,
      eyes_item_id       INTEGER REFERENCES items(id) ON DELETE SET NULL,
      cloth_item_id      INTEGER REFERENCES items(id) ON DELETE SET NULL,
      hat_item_id        INTEGER REFERENCES items(id) ON DELETE SET NULL,

      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_equipped_user ON user_equipped(user_id)`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_items_type ON items(type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_items_rarity_price_id ON items(rarity, price, id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_market_status ON market_listings(status, created_at DESC)`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_market_status_qty_created
     ON market_listings(status, quantity_left, created_at DESC, id DESC)`
  );
  db.run(`CREATE INDEX IF NOT EXISTS idx_market_seller ON market_listings(seller_user_id, status)`);

  // TON migrations/indexes are temporarily disabled.
  // const ensureUsersTonIndex = () => {
  //   db.run(
  //     `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ton_wallet_address
  //      ON users(ton_wallet_address)
  //      WHERE ton_wallet_address IS NOT NULL`
  //   );
  // };
  // const ensureMarketTonIndex = () => {
  //   db.run(
  //     `CREATE INDEX IF NOT EXISTS idx_market_currency
  //      ON market_listings(settlement_currency, status)`
  //   );
  // };
  //
  // db.run(`ALTER TABLE users ADD COLUMN ton_wallet_address TEXT`, (err) => {
  //   if (err && !String(err.message).includes('duplicate column name')) {
  //     console.error('Migration error (users.ton_wallet_address):', err.message);
  //   }
  //   ensureUsersTonIndex();
  // });
  // db.run(`ALTER TABLE users ADD COLUMN ton_wallet_connected_at INTEGER`, (err) => {
  //   if (err && !String(err.message).includes('duplicate column name')) {
  //     console.error('Migration error (users.ton_wallet_connected_at):', err.message);
  //   }
  // });
  // db.run(
  //   `ALTER TABLE market_listings ADD COLUMN settlement_currency TEXT NOT NULL DEFAULT 'beanz'`,
  //   (err) => {
  //     if (err && !String(err.message).includes('duplicate column name')) {
  //       console.error('Migration error (market_listings.settlement_currency):', err.message);
  //     }
  //     ensureMarketTonIndex();
  //   }
  // );
  // db.run(`ALTER TABLE market_listings ADD COLUMN price_per_unit_ton_nano TEXT`, (err) => {
  //   if (err && !String(err.message).includes('duplicate column name')) {
  //     console.error('Migration error (market_listings.price_per_unit_ton_nano):', err.message);
  //   }
  // });
});

db.on('open', () => console.log('Connected to SQLite database'));
db.on('error', (err) => console.error('Database error:', err.message));

module.exports = db;
