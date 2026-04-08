function registerAvatarRoutes(app, deps) {
  const { authenticateToken, avatarService } = deps;
  const { renderEquippedPngBuffer } = avatarService;

  app.get('/api/avatar/download', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const png = await renderEquippedPngBuffer(userId);
      const fileName = `avatar_${userId}.png`;

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'no-store');

      return res.status(200).send(png);
    } catch (e) {
      const code = e?.code === 404 ? 404 : 500;
      return res.status(code).json({ error: e.message || 'Failed to generate avatar' });
    }
  });
}

module.exports = { registerAvatarRoutes };
