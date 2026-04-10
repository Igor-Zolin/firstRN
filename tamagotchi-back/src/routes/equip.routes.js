function registerEquipRoutes(app, deps) {
  const { db, authenticateToken, requireDevRoute, game } = deps;
  const { nowSec } = game;
  const START_BY_SLOT = {
    background: 37,
    eyes: 84,
    cloth: 70,
    hat: 97,
    weapon: null,
  };

  function normalizeEquippedRow(row) {
    return {
      backgroundItemId: row?.background_item_id ?? null,
      weaponItemId: row?.weapon_item_id ?? null,
      eyesItemId: row?.eyes_item_id ?? null,
      clothItemId: row?.cloth_item_id ?? null,
      hatItemId: row?.hat_item_id ?? null,
    };
  }

  app.get('/api/equip/me', authenticateToken, (req, res) => {
    const userId = req.user.id;

    db.get(
      `SELECT *
       FROM user_equipped
       WHERE user_id = ?`,
      [userId],
      (err, row) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch equipped' });

        if (!row) {
          const now = nowSec();
          return db.run(
            `INSERT OR IGNORE INTO user_equipped (user_id, updated_at) VALUES (?, ?)`,
            [userId, now],
            (e2) => {
              if (e2) return res.status(500).json({ error: 'Failed to init equipped' });
              return res.json({
                backgroundItemId: null,
                weaponItemId: null,
                eyesItemId: null,
                clothItemId: null,
                hatItemId: null,
              });
            }
          );
        }

        return res.json({
          backgroundItemId: row.background_item_id ?? null,
          weaponItemId: row.weapon_item_id ?? null,
          eyesItemId: row.eyes_item_id ?? null,
          clothItemId: row.cloth_item_id ?? null,
          hatItemId: row.hat_item_id ?? null,
        });
      }
    );
  });

  app.post('/api/equip', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { slot, itemId } = req.body;

    const allowedSlots = new Set(['background', 'weapon', 'eyes', 'cloth', 'hat']);
    if (!allowedSlots.has(slot)) {
      return res.status(400).json({ error: 'Invalid slot' });
    }

    const id = Math.floor(Number(itemId));
    if (!id) return res.status(400).json({ error: 'Invalid itemId' });

    db.get(`SELECT id, type FROM items WHERE id = ?`, [id], (e1, item) => {
      if (e1) return res.status(500).json({ error: 'Failed to fetch item' });
      if (!item) return res.status(404).json({ error: 'Item not found' });

      if (item.type !== slot) {
        return res.status(400).json({
          error: `Item type "${item.type}" cannot be equipped into slot "${slot}"`,
        });
      }

      db.get(
        `SELECT 1 FROM inventory WHERE user_id = ? AND item_id = ?`,
        [userId, id],
        (e2, owned) => {
          if (e2) return res.status(500).json({ error: 'Failed to check inventory' });
          if (!owned) return res.status(403).json({ error: 'You do not own this item' });

          const now = nowSec();
          const colMap = {
            background: 'background_item_id',
            weapon: 'weapon_item_id',
            eyes: 'eyes_item_id',
            cloth: 'cloth_item_id',
            hat: 'hat_item_id',
          };
          const col = colMap[slot];

          db.serialize(() => {
            db.run(
              `INSERT OR IGNORE INTO user_equipped (user_id, updated_at) VALUES (?, ?)`,
              [userId, now]
            );

            db.run(
              `UPDATE user_equipped
               SET ${col} = ?, updated_at = ?
               WHERE user_id = ?`,
              [id, now, userId],
              (e3) => {
                if (e3) return res.status(500).json({ error: 'Failed to equip item' });

                db.get(`SELECT * FROM user_equipped WHERE user_id = ?`, [userId], (e4, row) => {
                  if (e4) return res.status(500).json({ error: 'Failed to fetch equipped' });

                  return res.json({
                    ok: true,
                    equipped: normalizeEquippedRow(row),
                  });
                });
              }
            );
          });
        }
      );
    });
  });

  app.post('/api/equip/unequip', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { slot } = req.body || {};

    const allowedSlots = new Set(['background', 'weapon', 'eyes', 'cloth', 'hat']);
    if (!allowedSlots.has(slot)) {
      return res.status(400).json({ error: 'Invalid slot' });
    }

    const colMap = {
      background: 'background_item_id',
      weapon: 'weapon_item_id',
      eyes: 'eyes_item_id',
      cloth: 'cloth_item_id',
      hat: 'hat_item_id',
    };

    const col = colMap[slot];
    const fallbackItemId = START_BY_SLOT[slot];
    const now = nowSec();

    db.serialize(() => {
      db.run(
        `INSERT OR IGNORE INTO user_equipped (user_id, updated_at) VALUES (?, ?)`,
        [userId, now],
        (e1) => {
          if (e1) return res.status(500).json({ error: 'Failed to init equipped' });

          db.run(
            `UPDATE user_equipped
             SET ${col} = ?, updated_at = ?
             WHERE user_id = ?`,
            [fallbackItemId, now, userId],
            (e2) => {
              if (e2) return res.status(500).json({ error: 'Failed to unequip item' });

              db.get(`SELECT * FROM user_equipped WHERE user_id = ?`, [userId], (e3, row) => {
                if (e3) return res.status(500).json({ error: 'Failed to fetch equipped' });

                return res.json({
                  ok: true,
                  slot,
                  fallbackItemId,
                  equipped: normalizeEquippedRow(row),
                });
              });
            }
          );
        }
      );
    });
  });

  app.post('/api/dev/apply-start-equip', requireDevRoute, (req, res) => {
    const now = nowSec();

    db.serialize(() => {
      db.run(`
        INSERT OR IGNORE INTO user_equipped (user_id, updated_at)
        SELECT id, ${now} FROM users
      `);

      db.run(
        `
        UPDATE user_equipped
        SET
          background_item_id = COALESCE(background_item_id, 37),
          eyes_item_id       = COALESCE(eyes_item_id, 84),
          cloth_item_id      = COALESCE(cloth_item_id, 70),
          hat_item_id        = COALESCE(hat_item_id, 97),
          updated_at         = ?
        `,
        [now],
        (err) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to apply start equip' });
          }
          return res.json({ ok: true });
        }
      );
    });
  });
}

module.exports = { registerEquipRoutes };
