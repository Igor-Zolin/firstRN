function registerInventoryRoutes(app, deps) {
  const { db, authenticateToken } = deps;

  app.get('/api/users/:id/inventory', authenticateToken, (req, res) => {
    const userId = req.params.id;

    if (req.user.id != userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    db.all(
      `
      SELECT i.id, i.quantity, it.name, it.type, it.model_name, it.rarity
      FROM inventory i
      JOIN items it ON i.item_id = it.id
      WHERE i.user_id = ?
    `,
      [userId],
      (err, rows) => {
        if (err) {
          console.error('Error fetching inventory:', err.message);
          return res.status(500).json({ error: 'Failed to fetch inventory' });
        }

        return res.json({ user_id: userId, items: rows });
      }
    );
  });

  app.get('/api/inventory/me', authenticateToken, (req, res) => {
    const userId = req.user.id;

    db.all(
      `SELECT i.item_id, i.quantity,
              it.name, it.type, it.model_name, it.rarity, it.price
       FROM inventory i
       JOIN items it ON it.id = i.item_id
       WHERE i.user_id = ?
       ORDER BY it.type ASC, it.rarity DESC, it.price ASC`,
      [userId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch inventory' });

        const base = `${req.protocol}://${req.get('host')}`;
        const items = rows.map((r) => ({
          ...r,
          imageUrl: `${base}/static/items/${r.model_name}`,
        }));

        return res.json(items);
      }
    );
  });
}

module.exports = { registerInventoryRoutes };
