function registerHealthRoutes(app) {
  app.get('/api/heartbeat', (req, res) => {
    return res.status(200).json({ code: 200, message: 'Healthy!' });
  });
}

module.exports = { registerHealthRoutes };
