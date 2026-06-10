function registerActionRoutes(app, deps) {
  const { db, authenticateToken, requireDevRoute, game } = deps;
  const { nowSec, rounded, getFreshStats, toClientStats } = game;

  app.post('/api/actions/tap', authenticateToken, (req, res) => {
    const userId = req.user.id;

    getFreshStats(userId, (err, s) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch stats' });

      const mult = Math.max(0, Math.floor(s.tap_mult_x100 / 100));
      const nextEnergy = Math.min(s.energy_cap, s.energy + mult);
      const now = nowSec();

      db.run(
        `UPDATE user_stats SET energy = ?, updated_at = ? WHERE user_id = ?`,
        [nextEnergy, now, userId],
        (err2) => {
          if (err2) return res.status(500).json({ error: 'Failed to update energy' });

          db.get(`SELECT * FROM user_stats WHERE user_id = ?`, [userId], (err3, row) => {
            if (err3) return res.status(500).json({ error: 'Failed to fetch stats' });
            return res.json(toClientStats(row));
          });
        }
      );
    });
  });

  app.post('/api/actions/upgrade', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { kind } = req.body;

    const allowed = new Set([
      'tap_plus',
      'tap_multi',
      'cap_energy',
      'cap_coins',
      'coin_rate',
      'beanz_mining',
    ]);
    if (!allowed.has(kind)) return res.status(400).json({ error: 'Invalid upgrade kind' });

    getFreshStats(userId, (err, s) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch stats' });

      let coins = s.coins;
      const next = { ...s };

      if (kind === 'beanz_mining') {
        const price = Math.floor(s.coins_cap * 0.5 + s.upg_beanz_level * s.upg_beanz_level * 20);
        if (coins < price) return res.status(400).json({ error: 'Not enough coins' });
        coins -= price;
        next.beanz_rate_x1000 = s.beanz_rate_x1000 + 1000;
        next.upg_beanz_level = s.upg_beanz_level + 1;
      }

      if (kind === 'tap_plus') {
        const price = 50;
        if (coins < price) return res.status(400).json({ error: 'Not enough coins' });
        coins -= price;
        next.tap_mult_x100 = s.tap_mult_x100 + 100;
        next.upg_tap_level = s.upg_tap_level + 1;
      }

      if (kind === 'tap_multi') {
        const price = Math.floor(s.coins_cap * 0.33);
        if (coins < price) return res.status(400).json({ error: 'Not enough coins' });
        coins -= price;
        next.tap_mult_x100 = Math.floor((s.tap_mult_x100 * 150) / 100);
        next.upg_tap_level = s.upg_tap_level + 1;
      }

      if (kind === 'cap_energy') {
        const price = Math.floor(s.coins_cap * 0.7);
        if (coins < price) {
          return res.status(400).json({ error: `Not enough coins. Need ${price}` });
        }
        coins -= price;
        next.energy_cap = s.energy_cap + 50;
        next.upg_energy_cap_level = s.upg_energy_cap_level + 1;
      }

      if (kind === 'cap_coins') {
        const price = Math.floor(s.coins_cap * 0.8);
        if (coins < price) {
          return res.status(400).json({ error: `Not enough coins. Need ${price}` });
        }
        coins -= price;
        next.coins_cap = Math.floor(s.coins_cap * 1.25);
        next.upg_coins_level = s.upg_coins_level + 1;
      }

      if (kind === 'coin_rate') {
        const price = Math.floor(s.coins_cap * 0.9);
        if (coins < price) {
          return res.status(400).json({ error: `Not enough coins. Need ${price}` });
        }
        coins -= price;
        next.coins_rate_x100 = rounded(s.coins_rate_x100 + 20, 2);
        next.upg_coins_level = s.upg_coins_level + 1;
      }

      next.coins = Math.max(0, Math.min(next.coins_cap, coins));
      const now = nowSec();

      db.run(
        `UPDATE user_stats SET
          energy = ?, energy_cap = ?,
          coins = ?, coins_cap = ?,
          beanz = ?,
          xp = ?, level = ?,
          tap_mult_x100 = ?, coins_rate_x100 = ?, beanz_rate_x1000 = ?,
          upg_tap_level = ?, upg_coins_level = ?, upg_energy_cap_level = ?, upg_beanz_level = ?,
          updated_at = ?
         WHERE user_id = ?`,
        [
          next.energy,
          next.energy_cap,
          next.coins,
          next.coins_cap,
          next.beanz,
          next.xp,
          next.level,
          next.tap_mult_x100,
          next.coins_rate_x100,
          next.beanz_rate_x1000,
          next.upg_tap_level,
          next.upg_coins_level,
          next.upg_energy_cap_level,
          next.upg_beanz_level,
          now,
          userId,
        ],
        (err2) => {
          if (err2) {
            console.error('Error applying upgrade:', err2.message);
            return res.status(500).json({ error: 'Failed to apply upgrade' });
          }

          db.get(`SELECT * FROM user_stats WHERE user_id = ?`, [userId], (err3, row) => {
            if (err3) return res.status(500).json({ error: 'Failed to fetch stats' });
            return res.json(toClientStats(row));
          });
        }
      );
    });
  });

  app.post('/api/actions/reset', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const now = nowSec();

    db.serialize(() => {
      db.run(
        `UPDATE user_stats SET
          energy=0, energy_cap=100,
          coins=0, coins_cap=500,
          beanz=0,
          xp=0, level=1,
          tap_mult_x100=100, coins_rate_x100=100, beanz_rate_x1000=0,
          upg_tap_level=0, upg_coins_level=0, upg_energy_cap_level=0, upg_beanz_level=0,
          updated_at=?
         WHERE user_id=?`,
        [now, userId],
        (err) => {
          if (err) return res.status(500).json({ error: 'Failed to reset stats' });

          db.run(
            `UPDATE user_meta SET last_tick_at=?, updated_at=? WHERE user_id=?`,
            [now, now, userId],
            (err2) => {
              if (err2) return res.status(500).json({ error: 'Failed to reset meta' });

              db.get(`SELECT * FROM user_stats WHERE user_id=?`, [userId], (err3, row) => {
                if (err3) return res.status(500).json({ error: 'Failed to fetch stats' });
                return res.json(toClientStats(row));
              });
            }
          );
        }
      );
    });
  });

  app.post('/api/actions/reset-inv', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const now = nowSec();

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(`DELETE FROM inventory WHERE user_id=?`, [userId], (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Failed to reset inventory' });
        }

        const starter = [
          [userId, 37, 1],
          [userId, 84, 1],
          [userId, 70, 1],
          [userId, 97, 1],
        ];

        const stmt = db.prepare(`
          INSERT INTO inventory (user_id, item_id, quantity)
          VALUES (?, ?, ?)
          ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = EXCLUDED.quantity
        `);

        for (const row of starter) stmt.run(row);
        stmt.finalize((e2) => {
          if (e2) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Failed to grant starter items' });
          }

          db.run(
            `
            INSERT INTO user_equipped (
              user_id,
              background_item_id,
              weapon_item_id,
              eyes_item_id,
              cloth_item_id,
              hat_item_id,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              background_item_id = EXCLUDED.background_item_id,
              weapon_item_id     = EXCLUDED.weapon_item_id,
              eyes_item_id       = EXCLUDED.eyes_item_id,
              cloth_item_id      = EXCLUDED.cloth_item_id,
              hat_item_id        = EXCLUDED.hat_item_id,
              updated_at         = EXCLUDED.updated_at
            `,
            [userId, 37, null, 84, 70, 97, now],
            (e3) => {
              if (e3) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to reset equipped' });
              }

              db.run('COMMIT', (e4) => {
                if (e4) return res.status(500).json({ error: 'Failed to commit reset' });

                return res.json({
                  ok: true,
                  equipped: {
                    backgroundItemId: 37,
                    weaponItemId: null,
                    eyesItemId: 84,
                    clothItemId: 70,
                    hatItemId: 97,
                  },
                });
              });
            }
          );
        });
      });
    });
  });

  app.post('/api/actions/cheat', authenticateToken, requireDevRoute, (req, res) => {
    const userId = req.user.id;
    const now = nowSec();

    getFreshStats(userId, (err, s) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch stats' });

      const energy = Math.min(s.energy_cap, 50);
      const coins = Math.min(s.coins_cap, 500);
      const beanz = s.beanz + 50;

      db.run(
        `UPDATE user_stats SET energy=?, coins=?, beanz=?, updated_at=? WHERE user_id=?`,
        [energy, coins, beanz, now, userId],
        (err2) => {
          if (err2) return res.status(500).json({ error: 'Failed to cheat' });

          db.get(`SELECT * FROM user_stats WHERE user_id=?`, [userId], (err3, row) => {
            if (err3) return res.status(500).json({ error: 'Failed to fetch stats' });
            return res.json(toClientStats(row));
          });
        }
      );
    });
  });
}

module.exports = { registerActionRoutes };
