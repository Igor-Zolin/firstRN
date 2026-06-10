const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ENABLE_DEV_ROUTES = !IS_PROD && process.env.ENABLE_DEV_ROUTES !== 'false';
const JWT_SECRET = process.env.JWT_SECRET || (!IS_PROD ? 'dev_only_secret_change_me' : '');
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const DATABASE_URL = process.env.DATABASE_URL || '';
const DATABASE_SSL = process.env.DATABASE_SSL === 'true';
const DATABASE_SSL_REJECT_UNAUTHORIZED =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
const DATABASE_POOL_MAX = Math.max(1, Number(process.env.DATABASE_POOL_MAX || 10));
// const TON_NETWORK = process.env.TON_NETWORK || 'testnet';
// const TON_MARKET_RECEIVER = process.env.TON_MARKET_RECEIVER || null;
// const TON_MARKET_ENABLED = process.env.TON_MARKET_ENABLED === 'true';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

module.exports = {
  PORT,
  IS_PROD,
  ENABLE_DEV_ROUTES,
  JWT_SECRET,
  CORS_ALLOWED_ORIGINS,
  DATABASE_URL,
  DATABASE_SSL,
  DATABASE_SSL_REJECT_UNAUTHORIZED,
  DATABASE_POOL_MAX,
  // TON_NETWORK,
  // TON_MARKET_RECEIVER,
  // TON_MARKET_ENABLED,
};