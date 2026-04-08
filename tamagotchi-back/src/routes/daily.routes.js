function registerDailyRoutes(app, deps) {
  const { db, authenticateToken, game } = deps;
  const { nowSec, utcDay, recalcLevel } = game;

  app.post('/api/daily/claim', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const now = nowSec();
    const today = utcDay();

    db.get(`SELECT * FROM user_meta WHERE user_id=?`, [userId], (e1, meta) => {
      if (e1) return res.status(500).json({ error: 'Failed to fetch meta' });
      if (!meta) return res.status(404).json({ error: 'Meta not found' });

      const last = meta.last_daily_day || 0;
      let streak = meta.daily_streak || 0;

      if (last === today) {
        return res.json({ ok: true, claimed: false, streak, rewardXp: 0, beanzReward: 0 });
      }

      if (last === today - 1) streak += 1;
      else streak = 1;

      const beanzReward = 5 + Math.min(streak * 2, 10);
      const rewardXp = Math.min(50, streak * 10);

      db.get(`SELECT xp, level, beanz FROM user_stats WHERE user_id=?`, [userId], (e2, s) => {
        if (e2) return res.status(500).json({ error: 'Failed to fetch stats' });
        if (!s) return res.status(404).json({ error: 'Stats not found' });

        const { xp, level, beanz } = recalcLevel(s.xp + rewardXp, s.level, s.beanz + beanzReward);

        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          db.run(
            `UPDATE user_meta
             SET daily_streak=?, last_daily_day=?, updated_at=?
             WHERE user_id=?`,
            [streak, today, now, userId],
            (e3) => {
              if (e3) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to update daily meta' });
              }

              db.run(
                `UPDATE user_stats SET xp=?, level=?, beanz=?, updated_at=? WHERE user_id=?`,
                [xp, level, beanz, now, userId],
                (e4) => {
                  if (e4) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Failed to add xp' });
                  }

                  db.run('COMMIT', (e5) => {
                    if (e5) return res.status(500).json({ error: 'Failed to commit' });
                    return res.json({
                      ok: true,
                      claimed: true,
                      streak,
                      rewardXp,
                      level,
                      xp,
                    });
                  });
                }
              );
            }
          );
        });
      });
    });
  });
}

module.exports = { registerDailyRoutes };
