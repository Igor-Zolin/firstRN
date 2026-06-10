function registerDailyRoutes(app, deps) {
  const { db, authenticateToken, game } = deps;
  const { nowSec, utcDay, recalcLevel } = game;

  app.post('/api/daily/claim', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const now = nowSec();
    const today = utcDay();
    const rollback = (status, payload) => {
      db.run('ROLLBACK', () => res.status(status).json(payload));
    };

    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) {
          return res.status(500).json({ error: 'Failed to begin transaction' });
        }

        db.get(
          `SELECT * FROM user_meta WHERE user_id = ? FOR UPDATE`,
          [userId],
          (metaErr, meta) => {
            if (metaErr) return rollback(500, { error: 'Failed to fetch meta' });
            if (!meta) return rollback(404, { error: 'Meta not found' });

            const last = meta.last_daily_day || 0;
            let streak = meta.daily_streak || 0;

            if (last === today) {
              return db.run('ROLLBACK', () => {
                res.json({ ok: true, claimed: false, streak, rewardXp: 0, beanzReward: 0 });
              });
            }

            streak = last === today - 1 ? streak + 1 : 1;
            const beanzReward = 5 + Math.min(streak * 2, 10);
            const rewardXp = Math.min(50, streak * 10);

            db.get(
              `SELECT xp, level, beanz FROM user_stats WHERE user_id = ? FOR UPDATE`,
              [userId],
              (statsErr, stats) => {
                if (statsErr) return rollback(500, { error: 'Failed to fetch stats' });
                if (!stats) return rollback(404, { error: 'Stats not found' });

                const leveled = recalcLevel(
                  stats.xp + rewardXp,
                  stats.level,
                  stats.beanz + beanzReward
                );

                db.run(
                  `UPDATE user_meta
                   SET daily_streak = ?, last_daily_day = ?, updated_at = ?
                   WHERE user_id = ?`,
                  [streak, today, now, userId],
                  (metaUpdateErr) => {
                    if (metaUpdateErr) {
                      return rollback(500, { error: 'Failed to update daily meta' });
                    }

                    db.run(
                      `UPDATE user_stats
                       SET xp = ?, level = ?, beanz = ?, updated_at = ?
                       WHERE user_id = ?`,
                      [leveled.xp, leveled.level, leveled.beanz, now, userId],
                      (statsUpdateErr) => {
                        if (statsUpdateErr) {
                          return rollback(500, { error: 'Failed to add xp' });
                        }

                        db.run('COMMIT', (commitErr) => {
                          if (commitErr) {
                            return res.status(500).json({ error: 'Failed to commit' });
                          }
                          return res.json({
                            ok: true,
                            claimed: true,
                            streak,
                            rewardXp,
                            beanzReward,
                            level: leveled.level,
                            xp: leveled.xp,
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
      });
    });
  });
}

module.exports = { registerDailyRoutes };