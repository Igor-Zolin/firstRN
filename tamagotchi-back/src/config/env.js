const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ENABLE_DEV_ROUTES = !IS_PROD && process.env.ENABLE_DEV_ROUTES !== 'false';
const JWT_SECRET = process.env.JWT_SECRET || (!IS_PROD ? 'dev_only_secret_change_me' : '');

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

module.exports = {
  PORT,
  IS_PROD,
  ENABLE_DEV_ROUTES,
  JWT_SECRET,
};
