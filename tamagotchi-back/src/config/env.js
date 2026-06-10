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
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_AUTH_MAX_AGE_SECONDS = Math.max(
  60,
  Number(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || 86400)
);
const DATABASE_URL = process.env.DATABASE_URL || '';
const DATABASE_SSL = process.env.DATABASE_SSL === 'true';
const DATABASE_SSL_REJECT_UNAUTHORIZED =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
const DATABASE_POOL_MAX = Math.max(1, Number(process.env.DATABASE_POOL_MAX || 10));
const TON_NETWORK = process.env.TON_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
const TON_CONNECT_DOMAIN = (
  process.env.TON_CONNECT_DOMAIN || (!IS_PROD ? 'localhost' : '')
).trim().toLowerCase();
const TON_CONNECT_APP_URL = (
  process.env.TON_CONNECT_APP_URL || (!IS_PROD ? 'http://localhost:5173' : '')
).trim().replace(/\/+$/, '');
const TON_CONNECT_APP_NAME = (process.env.TON_CONNECT_APP_NAME || 'Tamagotchi').trim();
const TON_CONNECT_ICON_URL = (process.env.TON_CONNECT_ICON_URL || '').trim();
const TON_CONNECT_TERMS_URL = (process.env.TON_CONNECT_TERMS_URL || '').trim();
const TON_CONNECT_PRIVACY_URL = (process.env.TON_CONNECT_PRIVACY_URL || '').trim();
const TON_PROOF_TTL_SECONDS = Math.max(
  60,
  Math.min(900, Number(process.env.TON_PROOF_TTL_SECONDS || 300))
);
const TON_PROOF_MAX_AGE_SECONDS = Math.max(
  60,
  Math.min(900, Number(process.env.TON_PROOF_MAX_AGE_SECONDS || 300))
);
// const TON_MARKET_RECEIVER = process.env.TON_MARKET_RECEIVER || null;
// const TON_MARKET_ENABLED = process.env.TON_MARKET_ENABLED === 'true';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}
if (IS_PROD && (!TON_CONNECT_DOMAIN || !TON_CONNECT_APP_URL)) {
  throw new Error('TON_CONNECT_DOMAIN and TON_CONNECT_APP_URL are required in production');
}

module.exports = {
  PORT,
  IS_PROD,
  ENABLE_DEV_ROUTES,
  JWT_SECRET,
  CORS_ALLOWED_ORIGINS,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_AUTH_MAX_AGE_SECONDS,
  DATABASE_URL,
  DATABASE_SSL,
  DATABASE_SSL_REJECT_UNAUTHORIZED,
  DATABASE_POOL_MAX,
  TON_NETWORK,
  TON_CONNECT_DOMAIN,
  TON_CONNECT_APP_URL,
  TON_CONNECT_APP_NAME,
  TON_CONNECT_ICON_URL,
  TON_CONNECT_TERMS_URL,
  TON_CONNECT_PRIVACY_URL,
  TON_PROOF_TTL_SECONDS,
  TON_PROOF_MAX_AGE_SECONDS,
  // TON_MARKET_RECEIVER,
  // TON_MARKET_ENABLED,
};
