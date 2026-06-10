const path = require('path');
const fs = require('fs');
const db = require('../src/database/db');

const ITEMS_DIR = path.join(__dirname, '..', 'public', 'items');

function walk(dir) {
  const result = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walk(fullPath));
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.png') {
      result.push(fullPath);
    }
  }

  return result;
}

function humanize(filename) {
  const base = filename.replace(/\.[^/.]+$/, '');
  return base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function defaultRarity(modelName) {
  const value = modelName.toLowerCase();
  if (value.includes('legendary')) return 'legendary';
  if (value.includes('epic')) return 'epic';
  if (value.includes('rare')) return 'rare';
  return 'common';
}

function defaultPrice(rarity) {
  if (rarity === 'legendary') return 1000;
  if (rarity === 'epic') return 500;
  if (rarity === 'rare') return 250;
  return 100;
}

async function main() {
  await db.init();
  const client = await db.pool.connect();

  try {
    const files = walk(ITEMS_DIR);
    let inserted = 0;

    await client.query('BEGIN');
    for (const absolutePath of files) {
      const modelName = path.relative(ITEMS_DIR, absolutePath).replaceAll('\\', '/');
      const parts = modelName.split('/');
      const type = parts.length > 1 ? parts[0] : 'misc';
      const name = humanize(path.basename(modelName));
      const rarity = defaultRarity(modelName);
      const price = defaultPrice(rarity);

      const result = await client.query(
        `INSERT INTO items (name, type, model_name, rarity, price)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (model_name) DO NOTHING`,
        [name, type, modelName, rarity, price]
      );
      inserted += result.rowCount;
    }
    await client.query('COMMIT');

    console.log(`[OK] scanned: ${files.length} png`);
    console.log(`[OK] inserted: ${inserted} new items`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await db.close();
  }
}

main().catch((err) => {
  console.error('[ERROR] Item import failed:', err.message);
  process.exit(1);
});