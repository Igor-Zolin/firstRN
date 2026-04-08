function registerStatsRoutes(app, deps) {
  const { authenticateToken, game } = deps;
  const { getFreshStats, toClientStats } = game;

  app.get('/api/stats/me', authenticateToken, (req, res) => {
    const userId = req.user.id;

    getFreshStats(userId, (err, row) => {
      if (err) {
        if (err.code === 404) return res.status(404).json({ error: 'Stats not found' });
        console.error('Error fetching stats:', err.message);
        return res.status(500).json({ error: 'Failed to fetch stats' });
      }
      return res.json(toClientStats(row));
    });
  });
}

module.exports = { registerStatsRoutes };
