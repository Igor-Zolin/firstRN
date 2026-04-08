const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./database/db');
const {
  PORT,
  ENABLE_DEV_ROUTES,
  JWT_SECRET,
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

app.use(express.json());
app.use('/static', express.static(path.join(__dirname, '..', 'public')));
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);

      const ok =
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:');

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

app.listen(PORT, () => {
  console.log(`[~] Server running on http://127.0.0.1:${PORT}`);
});
