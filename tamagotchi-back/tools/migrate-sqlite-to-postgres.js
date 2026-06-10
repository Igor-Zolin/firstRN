const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const db = require('../src/database/db');

const TABLES = [
  {
    name: 'users',
    columns: [
      'id', 'username', 'password', 'email', 'created_at',
      'ton_wallet_address', 'ton_wallet_connected_at',
    ],
  },
  {
    name: 'items',
    columns: ['id', 'name', 'type', 'model_name', 'rarity', 'price', 'supply', 'created_at'],
  },
  {
    name: 'user_stats',
    columns: [
      'user_id', 'energy', 'energy_cap', 'coins', 'coins_cap', 'beanz', 'xp', 'level',
      'tap_mult_x100', 'coins_rate_x100', 'beanz_rate_x1000', 'upg_tap_level',
      'upg_coins_level', 'upg_energy_cap_level', 'upg_beanz_level', 'updated_at',
    ],
  },
  {
    name: 'user_meta',
    columns: [
      'user_id', 'last_tick_at', 'balance_ver', 'is_banned', 'updated_at',
      'daily_streak', 'last_daily_day',
    ],
  },
  {
    name: 'inventory',
    columns: ['id', 'user_id', 'item_id', 'quantity', 'acquired_at'],
  },
  {
    name: 'market_listings',
    columns: [
      'id', 'seller_user_id', 'item_id', 'price_per_unit', 'quantity_total',
      'quantity_left', 'status', 'created_at', 'updated_at', 'settlement_currency',
      'price_per_unit_ton_nano',
    ],
  },
  {
    name: 'user_equipped',
    columns: [
      'user_id', 'background_item_id', 'weapon_item_id', 'eyes_item_id',
      'cloth_item_id', 'hat_item_id', 'updated_at',
    ],
  },
];

function parseArgs(argv) {
  const sourceFlag = argv.find((value) => value.startsWith('--source='));
  return {
    source: path.resolve(sourceFlag ? sourceFlag.slice('--source='.length) : './db.sqlite'),
    truncate: argv.includes('--truncate'),
    dryRun: argv.includes('--dry-run'),
  };
}

function openSqlite(filename) {
  return new Promise((resolve, reject) => {
    const source = new sqlite3.Database(filename, sqlite3.OPEN_READONLY, (err) => {
      if (err) reject(err);
      else resolve(source);
    });
  });
}

function sqliteAll(source, sql) {
  return new Promise((resolve, reject) => {
    source.all(sql, [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function closeSqlite(source) {
  return new Promise((resolve, reject) => {
    source.close((err) => (err ? reject(err) : resolve()));
  });
}

async function getSourceRows(source, table) {
  const tableInfo = await sqliteAll(source, `PRAGMA table_info("${table.name}")`);
  if (tableInfo.length === 0) return [];

  const sourceColumns = new Set(tableInfo.map((column) => column.name));
  const columns = table.columns.filter((column) => sourceColumns.has(column));
  const rows = await sqliteAll(source, `SELECT * FROM "${table.name}"`);
  return rows.map((row) => ({
    columns,
    values: columns.map((column) => row[column]),
    record: row,
  }));
}

function removeOrphans(sourceData) {
  const validUserIds = new Set(sourceData.get('users').map((row) => row.record.id));
  const validItemIds = new Set(sourceData.get('items').map((row) => row.record.id));
  const userForeignKey = {
    user_stats: 'user_id',
    user_meta: 'user_id',
    inventory: 'user_id',
    market_listings: 'seller_user_id',
    user_equipped: 'user_id',
  };

  for (const [tableName, userColumn] of Object.entries(userForeignKey)) {
    const rows = sourceData.get(tableName);
    const filtered = rows.filter((row) => validUserIds.has(row.record[userColumn]));
    const skipped = rows.length - filtered.length;
    if (skipped > 0) {
      console.warn(`[WARN] ${tableName}: skipped ${skipped} orphan rows with missing users`);
    }
    sourceData.set(tableName, filtered);
  }

  for (const tableName of ['inventory', 'market_listings']) {
    const rows = sourceData.get(tableName);
    const filtered = rows.filter((row) => validItemIds.has(row.record.item_id));
    const skipped = rows.length - filtered.length;
    if (skipped > 0) {
      console.warn(`[WARN] ${tableName}: skipped ${skipped} orphan rows with missing items`);
    }
    sourceData.set(tableName, filtered);
  }

  const equippedItemColumns = [
    'background_item_id', 'weapon_item_id', 'eyes_item_id', 'cloth_item_id', 'hat_item_id',
  ];
  for (const row of sourceData.get('user_equipped')) {
    for (const column of equippedItemColumns) {
      const itemId = row.record[column];
      if (itemId != null && !validItemIds.has(itemId)) {
        row.record[column] = null;
        const valueIndex = row.columns.indexOf(column);
        if (valueIndex >= 0) row.values[valueIndex] = null;
        console.warn(`[WARN] user_equipped: cleared missing item ${itemId} from ${column}`);
      }
    }
  }
}

async function destinationRowCount(client) {
  let total = 0;
  for (const table of TABLES) {
    const result = await client.query(`SELECT COUNT(*)::BIGINT AS count FROM ${table.name}`);
    total += Number(result.rows[0].count);
  }
  return total;
}

async function resetSequences(client) {
  for (const table of ['users', 'items', 'inventory', 'market_listings']) {
    await client.query(
      `SELECT setval(
         pg_get_serial_sequence($1, 'id'),
         COALESCE((SELECT MAX(id) FROM ${table}), 1),
         EXISTS (SELECT 1 FROM ${table})
       )`,
      [table]
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log(`[INFO] SQLite source: ${options.source}`);

  const source = await openSqlite(options.source);
  let client = null;
  let databaseInitialized = false;

  try {
    const sourceData = new Map();
    for (const table of TABLES) {
      sourceData.set(table.name, await getSourceRows(source, table));
    }
    removeOrphans(sourceData);

    if (options.dryRun) {
      for (const table of TABLES) {
        console.log(`[OK] ${table.name}: ${sourceData.get(table.name).length} rows ready`);
      }
      console.log('[OK] Dry run completed; PostgreSQL was not modified');
      return;
    }

    await db.init();
    databaseInitialized = true;
    client = await db.pool.connect();

    const existingRows = await destinationRowCount(client);
    if (existingRows > 0 && !options.truncate) {
      throw new Error(
        `PostgreSQL already contains ${existingRows} rows. ` +
        'Use --truncate only if replacing all destination data is intentional.'
      );
    }

    await client.query('BEGIN');
    if (options.truncate) {
      await client.query('TRUNCATE TABLE users, items RESTART IDENTITY CASCADE');
    }

    for (const table of TABLES) {
      const rows = sourceData.get(table.name);
      for (const row of rows) {
        const placeholders = row.values.map((_, index) => `$${index + 1}`).join(', ');
        const columns = row.columns.map((column) => `"${column}"`).join(', ');
        await client.query(
          `INSERT INTO ${table.name} (${columns}) VALUES (${placeholders})`,
          row.values
        );
      }
      console.log(`[OK] ${table.name}: ${rows.length} rows`);
    }

    await resetSequences(client);
    await client.query('COMMIT');
    console.log('[OK] SQLite data migrated to PostgreSQL');
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    if (client) client.release();
    await closeSqlite(source);
    if (databaseInitialized) await db.close();
  }
}
main().catch((err) => {
  console.error('[ERROR] Migration failed:', err.message);
  process.exit(1);
});