const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'db.sqlite'); // поправь если БД в другом месте
const ITEMS_DIR = path.join(__dirname, '..', 'public', 'items');

const db = new sqlite3.Database(DB_PATH);

function walk(dir) {
  const result = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dir, e.name);

    if (e.isDirectory()) {
      result.push(...walk(full));
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (ext === '.png') result.push(full);
    }
  }
  return result;
}

// "golden_head.png" -> "Golden Head"
function humanize(filename) {
  const base = filename.replace(/\.[^/.]+$/, '');
  return base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Простейшие дефолты (потом можно сделать умнее)
function defaultRarity(type, modelName) {
  // пример: если в имени есть legendary/epic/rare/common
  const s = modelName.toLowerCase();
  if (s.includes('legendary')) return 'legendary';
  if (s.includes('epic')) return 'epic';
  if (s.includes('rare')) return 'rare';
  return 'common';
}

function defaultPrice(rarity) {
  if (rarity === 'legendary') return 1000;
  if (rarity === 'epic') return 500;
  if (rarity === 'rare') return 250;
  return 100;
}

db.serialize(() => {
  // 1) защита от дублей
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_items_model_name ON items(model_name)`);

  const files = walk(ITEMS_DIR);

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO items (name, type, model_name, rarity, price)
    VALUES (?, ?, ?, ?, ?)
  `);

  let inserted = 0;

  for (const absPath of files) {
    // relative от public/items/
    const relFromItems = path.relative(ITEMS_DIR, absPath).replaceAll('\\', '/');
    // type = первая папка (hair/weapon/eyes/...)
    const parts = relFromItems.split('/');
    const type = parts.length > 1 ? parts[0] : 'misc';

    const fileName = path.basename(relFromItems);
    const name = humanize(fileName);

    const rarity = defaultRarity(type, relFromItems);
    const price = defaultPrice(rarity);

    // model_name храним как "hair/xxx.png"
    const model_name = relFromItems;

    stmt.run([name, type, model_name, rarity, price], function (err) {
      if (err) {
        console.error('Insert error:', err.message, model_name);
      } else {
        // changes = 1 если реально вставили, 0 если IGNORE
        inserted += this.changes;
      }
    });
  }

  stmt.finalize(() => {
    console.log(`[OK] scanned: ${files.length} png`);
    console.log(`[OK] inserted: ${inserted} new items`);
    db.close();
  });
});
