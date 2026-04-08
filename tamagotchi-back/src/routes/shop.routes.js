function registerShopRoutes(app, deps) {
  const { db, authenticateToken, game } = deps;
  const { nowSec, applyTick, recalcLevel, toClientStats, XP_BY_RARITY } = game;

  app.get('/api/shop/items', (req, res) => {
    const { type, q, rarity, limit = 200, offset = 0 } = req.query;

    const where = [];
    const params = [];

    if (type) {
      where.push('type = ?');
      params.push(type);
    }
    if (rarity) {
      where.push('rarity = ?');
      params.push(rarity);
    }
    if (q) {
      where.push('(name LIKE ? OR model_name LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    db.all(
      `SELECT * FROM items ${whereSql} ORDER BY rarity DESC, price ASC, id ASC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)],
      (err, rows) => {
        if (err) {
          console.error('Error fetching shop items:', err.message);
          return res.status(500).json({ error: 'Failed to fetch items' });
        }

        const base = `${req.protocol}://${req.get('host')}`;
        const items = rows.map((it) => ({
          ...it,
          imageUrl: `${base}/static/items/${it.model_name}`,
        }));

        return res.json(items);
      }
    );
  });

  app.get('/api/shop/categories', (req, res) => {
    db.all(`SELECT DISTINCT type FROM items ORDER BY type ASC`, [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch categories' });
      return res.json(rows.map((r) => r.type));
    });
  });

  app.post('/api/shop/buy', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { itemId } = req.body;

    const id = Math.floor(Number(itemId));
    if (!id) return res.status(400).json({ error: 'Invalid itemId' });

    applyTick(userId, (tickErr) => {
      if (tickErr) return res.status(500).json({ error: 'Failed to fetch stats' });

      const now = nowSec();
      const rollback = (status, payload) => {
        db.run('ROLLBACK', () => res.status(status).json(payload));
      };

      db.serialize(() => {
        db.run('BEGIN IMMEDIATE TRANSACTION', (eBegin) => {
          if (eBegin) {
            return res.status(500).json({ error: 'Failed to begin transaction' });
          }

          db.get(`SELECT id, name, type, rarity, price FROM items WHERE id = ?`, [id], (e1, item) => {
            if (e1) return rollback(500, { error: 'Failed to fetch item' });
            if (!item) return rollback(404, { error: 'Item not found' });

            const total = Number(item.price) || 0;
            if (total <= 0) return rollback(400, { error: 'Bad item price' });

            const xpGain = XP_BY_RARITY[item.rarity] || 0;

            db.run(
              `UPDATE items
                SET supply = supply - 1
                WHERE id = ? AND supply > 0`,
              [id],
              function onSupplyUpdated(e2) {
                if (e2) return rollback(500, { error: 'Failed to update supply' });
                if (this.changes === 0) {
                  return rollback(400, { error: 'Item is out of stock' });
                }

                db.run(
                  `UPDATE user_stats
                   SET beanz = beanz - ?, updated_at = ?
                   WHERE user_id = ? AND beanz >= ?`,
                  [total, now, userId, total],
                  function onCharged(e3) {
                    if (e3) return rollback(500, { error: 'Failed to charge beanz' });
                    if (this.changes === 0) {
                      return rollback(400, { error: 'Not enough beanz' });
                    }

                    db.run(
                      `INSERT INTO inventory (user_id, item_id, quantity)
                       VALUES (?, ?, 1)
                       ON CONFLICT(user_id, item_id)
                       DO UPDATE SET quantity = quantity + 1`,
                      [userId, id],
                      (e4) => {
                        if (e4) return rollback(500, { error: 'Failed to add to inventory' });

                        db.get(
                          `SELECT xp, level, beanz FROM user_stats WHERE user_id=?`,
                          [userId],
                          (e5, curStats) => {
                            if (e5) return rollback(500, { error: 'Failed to fetch stats' });
                            if (!curStats) return rollback(404, { error: 'Stats not found' });

                            const leveled = xpGain > 0
                              ? recalcLevel(curStats.xp + xpGain, curStats.level, curStats.beanz)
                              : { xp: curStats.xp, level: curStats.level, beanz: curStats.beanz };

                            db.run(
                              `UPDATE user_stats
                               SET xp=?, level=?, beanz=?, updated_at=?
                               WHERE user_id=?`,
                              [leveled.xp, leveled.level, leveled.beanz, now, userId],
                              (e6) => {
                                if (e6) return rollback(500, { error: 'Failed to apply XP' });

                                db.get(`SELECT supply FROM items WHERE id=?`, [id], (e7, supplyRow) => {
                                  if (e7) return rollback(500, { error: 'Failed to fetch supply' });

                                  db.get(`SELECT * FROM user_stats WHERE user_id=?`, [userId], (e8, finalRow) => {
                                    if (e8) return rollback(500, { error: 'Failed to fetch stats' });

                                    db.run('COMMIT', (eCommit) => {
                                      if (eCommit) {
                                        return rollback(500, { error: 'Failed to commit transaction' });
                                      }

                                      return res.json({
                                        ok: true,
                                        spent: total,
                                        remainingSupply: supplyRow?.supply ?? null,
                                        item: {
                                          id: item.id,
                                          name: item.name,
                                          type: item.type,
                                        },
                                        stats: toClientStats(finalRow),
                                        xpGained: xpGain,
                                      });
                                    });
                                  });
                                });
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          });
        });
      });
    });
  });
}

module.exports = { registerShopRoutes };
