const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/database/db');

const { _internals } = db;

test('converts SQLite placeholders to PostgreSQL placeholders', () => {
  assert.equal(
    _internals.toPostgresPlaceholders('SELECT * FROM users WHERE id = ? AND email = ?'),
    'SELECT * FROM users WHERE id = $1 AND email = $2'
  );
});

test('adds RETURNING to inserts used by callback run()', () => {
  assert.equal(
    _internals.withReturning('INSERT INTO users (username) VALUES (?)'),
    'INSERT INTO users (username) VALUES (?) RETURNING *'
  );
});

test('does not add RETURNING to non-insert statements', () => {
  assert.equal(
    _internals.withReturning('UPDATE users SET username = ? WHERE id = ?'),
    'UPDATE users SET username = ? WHERE id = ?'
  );
});

test('serialize keeps a transaction on one PostgreSQL client', async () => {
  const calls = [];
  const originalConnect = db.pool.connect;
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.startsWith('INSERT')) {
        return { rowCount: 1, rows: [{ id: 42 }] };
      }
      return { rowCount: 0, rows: [] };
    },
    release() {
      calls.push({ sql: 'RELEASE', params: [] });
    },
  };

  db.pool.connect = async () => client;

  try {
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (beginErr) => {
          if (beginErr) return reject(beginErr);

          db.run(
            'INSERT INTO users (username) VALUES (?)',
            ['alice'],
            function onInserted(insertErr) {
              if (insertErr) return reject(insertErr);
              assert.equal(this.lastID, 42);

              db.run('COMMIT', (commitErr) => {
                if (commitErr) return reject(commitErr);
                resolve();
              });
            }
          );
        });
      });
    });
  } finally {
    db.pool.connect = originalConnect;
  }

  assert.deepEqual(calls, [
    { sql: 'BEGIN', params: [] },
    { sql: 'INSERT INTO users (username) VALUES ($1) RETURNING *', params: ['alice'] },
    { sql: 'COMMIT', params: [] },
    { sql: 'RELEASE', params: [] },
  ]);
});