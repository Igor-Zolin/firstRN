function createDevOnlyMiddleware(enableDevRoutes) {
  return (req, res, next) => {
    if (!enableDevRoutes) {
      return res.status(404).json({ error: 'Not found' });
    }
    next();
  };
}

module.exports = { createDevOnlyMiddleware };
