const fs = require('fs/promises');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');
const { Pool, types } = require('pg');
const {
  DATABASE_URL,
  DATABASE_SSL,
  DATABASE_SSL_REJECT_UNAUTHORIZED,
  DATABASE_POOL_MAX,
} = require('../config/env');

types.setTypeParser(types.builtins.INT8, Number);
types.setTypeParser(types.builtins.NUMERIC, Number);

const transactionStorage = new AsyncLocalStorage();
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: DATABASE_POOL_MAX,
  ssl: DATABASE_SSL
    ? { rejectUnauthorized: DATABASE_SSL_REJECT_UNAUTHORIZED }
    : undefined,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

function toPostgresPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function withReturning(sql) {
  const trimmed = sql.trim().replace(/;$/, '');
  if (!/^INSERT\s+/i.test(trimmed) || /\bRETURNING\b/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed} RETURNING *`;
}

function normalizeArgs(params, callback) {
  if (typeof params === 'function') {
    return { params: [], callback: params };
  }
  return {
    params: Array.isArray(params) ? params : [],
    callback: typeof callback === 'function' ? callback : null,
  };
}

function invokeCallback(callback, context, ...args) {
  if (!callback) return;
  callback.call(context, ...args);
}

function enqueue(task, onSuccess, onError) {
  const store = transactionStorage.getStore();
  const previous = store?.chain || Promise.resolve();
  const operation = previous.then(task);

  if (store) {
    store.chain = operation.catch(() => undefined);
  }

  operation.then(onSuccess, onError);
  return operation;
}

async function executeControlStatement(command, store) {
  if (!store) {
    throw new Error(`${command} must be called inside db.serialize()`);
  }

  if (command === 'BEGIN') {
    if (store.client) throw new Error('Transaction already started');
    store.client = await pool.connect();
    try {
      await store.client.query('BEGIN');
    } catch (err) {
      store.client.release();
      store.client = null;
      throw err;
    }
    return { rowCount: 0, rows: [] };
  }

  if (!store.client) throw new Error(`Cannot ${command} without an active transaction`);

  try {
    return await store.client.query(command);
  } finally {
    store.client.release();
    store.client = null;
  }
}

async function execute(sql, params, { returning = false } = {}) {
  const store = transactionStorage.getStore();
  const normalizedCommand = sql.trim().replace(/;$/, '').replace(/\s+/g, ' ').toUpperCase();

  if (normalizedCommand === 'BEGIN' || normalizedCommand === 'BEGIN TRANSACTION') {
    return executeControlStatement('BEGIN', store);
  }
  if (normalizedCommand === 'BEGIN IMMEDIATE TRANSACTION') {
    return executeControlStatement('BEGIN', store);
  }
  if (normalizedCommand === 'COMMIT' || normalizedCommand === 'ROLLBACK') {
    return executeControlStatement(normalizedCommand, store);
  }

  const query = returning
    ? withReturning(toPostgresPlaceholders(sql))
    : toPostgresPlaceholders(sql);
  const executor = store?.client || pool;
  return executor.query(query, params);
}

function run(sql, params, callback) {
  const args = normalizeArgs(params, callback);
  return enqueue(
    () => execute(sql, args.params, { returning: true }),
    (result) => {
      const firstRow = result.rows?.[0];
      const context = {
        changes: result.rowCount || 0,
        lastID: firstRow?.id ?? firstRow?.user_id ?? null,
      };
      invokeCallback(args.callback, context, null);
    },
    (err) => invokeCallback(args.callback, { changes: 0, lastID: null }, err)
  );
}

function get(sql, params, callback) {
  const args = normalizeArgs(params, callback);
  return enqueue(
    () => execute(sql, args.params),
    (result) => invokeCallback(args.callback, null, null, result.rows[0]),
    (err) => invokeCallback(args.callback, null, err)
  );
}

function all(sql, params, callback) {
  const args = normalizeArgs(params, callback);
  return enqueue(
    () => execute(sql, args.params),
    (result) => invokeCallback(args.callback, null, null, result.rows),
    (err) => invokeCallback(args.callback, null, err)
  );
}

function prepare(sql) {
  let firstError = null;

  return {
    run(params, callback) {
      return run(sql, params, function onPreparedRun(err) {
        if (err && !firstError) firstError = err;
        invokeCallback(callback, this, err);
      });
    },
    finalize(callback) {
      return enqueue(
        async () => undefined,
        () => invokeCallback(callback, null, firstError),
        (err) => invokeCallback(callback, null, firstError || err)
      );
    },
  };
}

function serialize(callback) {
  const store = { chain: Promise.resolve(), client: null };
  transactionStorage.run(store, callback);
}

async function init() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = await fs.readFile(schemaPath, 'utf8');
  await pool.query(schema);
  await pool.query('SELECT 1');
  console.log('Connected to PostgreSQL database');
}

async function close() {
  await pool.end();
}

module.exports = {
  pool,
  run,
  get,
  all,
  prepare,
  serialize,
  init,
  close,
  query(sql, params = []) {
    return execute(sql, params);
  },
  _internals: {
    toPostgresPlaceholders,
    withReturning,
  },
};