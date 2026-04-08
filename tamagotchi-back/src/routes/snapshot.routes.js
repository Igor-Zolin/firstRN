function registerSnapshotRoutes(app, deps) {
  const { db, authenticateToken, game } = deps;
  const { getFreshStats, toClientStats, countEquippedCopies } = game;

  const dbGet = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
    });

  const dbAll = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });

  const getFreshStatsAsync = (userId) =>
    new Promise((resolve, reject) => {
      getFreshStats(userId, (err, row) => (err ? reject(err) : resolve(row)));
    });

  const mapEquipped = (eq) => ({
    backgroundItemId: eq?.background_item_id ?? eq?.backgroundItemId ?? null,
    weaponItemId: eq?.weapon_item_id ?? eq?.weaponItemId ?? null,
    eyesItemId: eq?.eyes_item_id ?? eq?.eyesItemId ?? null,
    clothItemId: eq?.cloth_item_id ?? eq?.clothItemId ?? null,
    hatItemId: eq?.hat_item_id ?? eq?.hatItemId ?? null,
  });

  app.get('/api/snapshot/home', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const base = `${req.protocol}://${req.get('host')}`;

    try {
      const [statsRow, equipped, inventoryRows] = await Promise.all([
        getFreshStatsAsync(userId),
        dbGet(`SELECT * FROM user_equipped WHERE user_id = ?`, [userId]),
        dbAll(
          `SELECT i.item_id, i.quantity,
                  it.name, it.type, it.model_name, it.rarity, it.price
           FROM inventory i
           JOIN items it ON it.id = i.item_id
           WHERE i.user_id = ?
           ORDER BY it.type ASC, it.rarity DESC, it.price ASC`,
          [userId]
        ),
      ]);

      const inventory = inventoryRows.map((r) => ({
        ...r,
        imageUrl: `${base}/static/items/${r.model_name}`,
      }));

      return res.json({
        stats: toClientStats(statsRow),
        equipped: mapEquipped(equipped),
        inventory,
      });
    } catch (err) {
      console.error('snapshot/home error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch home snapshot' });
    }
  });

  app.get('/api/snapshot/profile', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const base = `${req.protocol}://${req.get('host')}`;

    try {
      const [equipped, inventoryRows] = await Promise.all([
        dbGet(`SELECT * FROM user_equipped WHERE user_id = ?`, [userId]),
        dbAll(
          `SELECT i.item_id, i.quantity,
                  it.name, it.type, it.model_name, it.rarity, it.price
           FROM inventory i
           JOIN items it ON it.id = i.item_id
           WHERE i.user_id = ?
           ORDER BY it.type ASC, it.rarity DESC, it.price ASC`,
          [userId]
        ),
      ]);

      const inventory = inventoryRows.map((r) => ({
        ...r,
        imageUrl: `${base}/static/items/${r.model_name}`,
      }));

      return res.json({
        equipped: mapEquipped(equipped),
        inventory,
      });
    } catch (err) {
      console.error('snapshot/profile error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch profile snapshot' });
    }
  });

  app.get('/api/snapshot/market', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const mode = String(req.query.mode || 'full').toLowerCase(); // full | focus
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 100)));
    const offset = Math.max(0, Number(req.query.offset || 0));
    const base = `${req.protocol}://${req.get('host')}`;

    try {
      const statsPromise = getFreshStatsAsync(userId);
      const publicListingsPromise = dbAll(
        `SELECT l.id, l.seller_user_id, l.item_id, l.price_per_unit, l.quantity_total, l.quantity_left,
                l.status, l.created_at, l.updated_at,
                u.username AS seller_username,
                it.name, it.type, it.model_name, it.rarity
         FROM market_listings l
         JOIN users u ON u.id = l.seller_user_id
         JOIN items it ON it.id = l.item_id
         WHERE l.status = 'active' AND l.quantity_left > 0
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      const myListingsPromise = dbAll(
        `SELECT l.id, l.seller_user_id, l.item_id, l.price_per_unit, l.quantity_total, l.quantity_left,
                l.status, l.created_at, l.updated_at,
                it.name, it.type, it.model_name, it.rarity
         FROM market_listings l
         JOIN items it ON it.id = l.item_id
         WHERE l.seller_user_id = ? AND l.status = 'active' AND l.quantity_left > 0
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );

      let sellablePromise = Promise.resolve(null);
      if (mode !== 'focus') {
        sellablePromise = (async () => {
          const [rows, equipped] = await Promise.all([
            dbAll(
              `SELECT i.item_id, i.quantity,
                      it.name, it.type, it.model_name, it.rarity
               FROM inventory i
               JOIN items it ON it.id = i.item_id
               WHERE i.user_id = ?
               ORDER BY it.type ASC, it.rarity DESC, it.name ASC`,
              [userId]
            ),
            dbGet(
              `SELECT background_item_id, weapon_item_id, eyes_item_id, cloth_item_id, hat_item_id
               FROM user_equipped
               WHERE user_id = ?`,
              [userId]
            ),
          ]);

          return rows
            .map((r) => {
              const lockedByEquip = countEquippedCopies(equipped, Number(r.item_id));
              const maxListable = Math.max(0, Number(r.quantity || 0) - lockedByEquip);
              return {
                ...r,
                imageUrl: `${base}/static/items/${r.model_name}`,
                lockedByEquip,
                maxListable,
              };
            })
            .filter((r) => r.maxListable > 0);
        })();
      }

      const [statsRow, publicRows, myRows, sellable] = await Promise.all([
        statsPromise,
        publicListingsPromise,
        myListingsPromise,
        sellablePromise,
      ]);

      const listings = publicRows.map((r) => ({
        ...r,
        imageUrl: `${base}/static/items/${r.model_name}`,
        isMine: Number(r.seller_user_id) === Number(userId),
      }));
      const myListings = myRows.map((r) => ({
        ...r,
        imageUrl: `${base}/static/items/${r.model_name}`,
      }));

      return res.json({
        stats: toClientStats(statsRow),
        sellable: mode === 'focus' ? null : sellable,
        listings,
        myListings,
      });
    } catch (err) {
      console.error('snapshot/market error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch market snapshot' });
    }
  });
}

module.exports = { registerSnapshotRoutes };
