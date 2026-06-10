const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./database/db');
const {
  PORT,
  ENABLE_DEV_ROUTES,
  JWT_SECRET,
  CORS_ALLOWED_ORIGINS,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_AUTH_MAX_AGE_SECONDS,
  // TON_NETWORK,
  // TON_MARKET_RECEIVER,
  // TON_MARKET_ENABLED,
} = require('./config/env');
const { createAuthMiddleware } = require('./middleware/auth');
const { createDevOnlyMiddleware } = require('./middleware/devOnly');
const { createGameService } = require('./services/game.service');
const { createAvatarService } = require('./services/avatar.service');

const { registerHealthRoutes } = require('./routes/health.routes');
const { registerAuthRoutes } = require('./routes/auth.routes');
const { registerDailyRoutes } = require('./routes/daily.routes');
const { registerStatsRoutes } = require('./routes/stats.routes');
const { registerActionRoutes } = require('./routes/actions.routes');
const { registerShopRoutes } = require('./routes/shop.routes');
const { registerMarketRoutes } = require('./routes/market.routes');
const { registerInventoryRoutes } = require('./routes/inventory.routes');
const { registerEquipRoutes } = require('./routes/equip.routes');
const { registerAvatarRoutes } = require('./routes/avatar.routes');
// const { registerTonRoutes } = require('./routes/ton.routes');
const { registerSnapshotRoutes } = require('./routes/snapshot.routes');

const app = express();
const LOCAL_ORIGIN_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?$/i;
const allowedOrigins = new Set(CORS_ALLOWED_ORIGINS);

app.use(express.json());
app.use('/static', express.static(path.join(__dirname, '..', 'public')));
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);

      const ok = LOCAL_ORIGIN_RE.test(origin) || allowedOrigins.has(origin);

      cb(ok ? null : new Error('Not allowed by CORS'), ok);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.options(/.*/, cors());

const authenticateToken = createAuthMiddleware(JWT_SECRET);
const requireDevRoute = createDevOnlyMiddleware(ENABLE_DEV_ROUTES);
const game = createGameService(db);
const avatarService = createAvatarService(db);

const deps = {
  db,
  jwtSecret: JWT_SECRET,
  telegramBotToken: TELEGRAM_BOT_TOKEN,
  telegramAuthMaxAgeSeconds: TELEGRAM_AUTH_MAX_AGE_SECONDS,
  authenticateToken,
  requireDevRoute,
  game,
  avatarService,
  // tonConfig: {
  //   network: TON_NETWORK,
  //   marketReceiver: TON_MARKET_RECEIVER,
  //   marketEnabled: TON_MARKET_ENABLED,
  // },
};

registerHealthRoutes(app, deps);
registerAuthRoutes(app, deps);
registerDailyRoutes(app, deps);
registerStatsRoutes(app, deps);
registerActionRoutes(app, deps);
registerShopRoutes(app, deps);
registerMarketRoutes(app, deps);
registerInventoryRoutes(app, deps);
registerEquipRoutes(app, deps);
registerAvatarRoutes(app, deps);
// registerTonRoutes(app, deps);
registerSnapshotRoutes(app, deps);

async function start() {
  await db.init();

  const server = app.listen(PORT, () => {
    console.log(`[~] Server running on http://127.0.0.1:${PORT}`);
  });

  const shutdown = (signal) => {
    console.log(`[~] ${signal} received, shutting down`);
    server.close(async () => {
      try {
        await db.close();
        process.exit(0);
      } catch (err) {
        console.error('Failed to close PostgreSQL pool:', err.message);
        process.exit(1);
      }
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  return server;
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
}

module.exports = { app, start };
