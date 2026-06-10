function registerHealthRoutes(app, deps) {
  const { db } = deps;

  app.get('/api/heartbeat', (req, res) => {
    db.get('SELECT 1 AS ok', [], (err) => {
      if (err) {
        return res.status(503).json({ code: 503, message: 'Database unavailable' });
      }
      return res.status(200).json({ code: 200, message: 'Healthy!' });
    });
  });
}

module.exports = { registerHealthRoutes };