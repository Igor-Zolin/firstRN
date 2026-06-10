const db = require('../src/database/db');

async function main() {
  try {
    await db.init();
    console.log('[OK] PostgreSQL schema is ready');
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('[ERROR] Failed to initialize PostgreSQL:', err.message);
  process.exit(1);
});