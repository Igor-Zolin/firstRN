const crypto = require('crypto');
const { Address } = require('@ton/core');
const { verifyTonProof } = require('../services/ton-proof.service');

const CHAIN_BY_NETWORK = {
  mainnet: '-239',
  testnet: '-3',
};

function toWalletResponse(row) {
  if (!row?.ton_wallet_address) {
    return {
      walletAddress: null,
      walletAddressFriendly: null,
      network: null,
      connectedAt: null,
    };
  }

  const testOnly = row.ton_wallet_network === 'testnet';
  const friendly = Address.parse(row.ton_wallet_address).toString({
    bounceable: false,
    testOnly,
  });

  return {
    walletAddress: row.ton_wallet_address,
    walletAddressFriendly: friendly,
    network: row.ton_wallet_network,
    connectedAt: row.ton_wallet_connected_at,
  };
}

function registerTonRoutes(app, deps) {
  const { db, authenticateToken, tonConfig } = deps;
  const {
    network,
    domain,
    appUrl,
    appName,
    iconUrl,
    termsUrl,
    privacyUrl,
    proofTtlSeconds,
    proofMaxAgeSeconds,
  } = tonConfig;

  app.get('/tonconnect-manifest.json', (_req, res) => {
    const manifest = {
      url: appUrl,
      name: appName,
      iconUrl: iconUrl || `${appUrl}/tonconnect-icon.png`,
    };
    if (termsUrl) manifest.termsOfUseUrl = termsUrl;
    if (privacyUrl) manifest.privacyPolicyUrl = privacyUrl;

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json(manifest);
  });

  app.get('/api/ton/config', authenticateToken, (_req, res) => {
    return res.json({
      network,
      chain: CHAIN_BY_NETWORK[network],
      domain,
      manifestUrl: '/tonconnect-manifest.json',
    });
  });

  app.post('/api/tonconnect/nonce', authenticateToken, async (req, res) => {
    const now = Math.floor(Date.now() / 1000);
    const payload = crypto.randomBytes(32).toString('base64url');
    const expiresAt = now + proofTtlSeconds;

    try {
      await db.query(
        `DELETE FROM ton_proof_challenges
         WHERE user_id = ? AND (used_at IS NOT NULL OR expires_at < ?)`,
        [req.user.id, now]
      );
      await db.query(
        `INSERT INTO ton_proof_challenges (payload, user_id, expires_at, created_at)
         VALUES (?, ?, ?, ?)`,
        [payload, req.user.id, expiresAt, now]
      );

      return res.json({
        payload,
        expiresAt,
        domain,
        network,
        chain: CHAIN_BY_NETWORK[network],
      });
    } catch (err) {
      console.error('Failed to create TON proof challenge:', err.message);
      return res.status(500).json({ error: 'Failed to create TON proof challenge' });
    }
  });

  app.post('/api/tonconnect/verify', authenticateToken, async (req, res) => {
    const account = req.body?.account;
    const proof = req.body?.proof;
    const payload = proof?.payload;
    const now = Math.floor(Date.now() / 1000);

    if (!payload) return res.status(400).json({ error: 'TON proof payload is required' });

    try {
      const challengeResult = await db.query(
        `SELECT payload, expires_at, used_at
         FROM ton_proof_challenges
         WHERE payload = ? AND user_id = ?`,
        [payload, req.user.id]
      );
      const challenge = challengeResult.rows[0];

      if (!challenge || challenge.used_at || Number(challenge.expires_at) < now) {
        return res.status(401).json({ error: 'TON proof challenge is invalid or expired' });
      }

      const verified = verifyTonProof({
        account,
        proof,
        expectedDomain: domain,
        expectedPayload: challenge.payload,
        expectedNetwork: CHAIN_BY_NETWORK[network],
        maxAgeSeconds: proofMaxAgeSeconds,
        nowSeconds: now,
      });

      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        const consumeResult = await client.query(
          `UPDATE ton_proof_challenges
           SET used_at = $1
           WHERE payload = $2 AND user_id = $3
             AND used_at IS NULL AND expires_at >= $1`,
          [now, payload, req.user.id]
        );
        if (consumeResult.rowCount !== 1) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'TON proof challenge was already used' });
        }

        const updateResult = await client.query(
          `UPDATE users
           SET ton_wallet_address = $1,
               ton_wallet_network = $2,
               ton_wallet_public_key = $3,
               ton_wallet_connected_at = $4
           WHERE id = $5
           RETURNING ton_wallet_address, ton_wallet_network, ton_wallet_connected_at`,
          [
            verified.rawAddress,
            network,
            verified.publicKey,
            now,
            req.user.id,
          ]
        );
        await client.query('COMMIT');

        return res.json({
          ok: true,
          wallet: toWalletResponse(updateResult.rows[0]),
          walletVersion: verified.walletVersion,
        });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        if (err.code === '23505') {
          return res.status(409).json({
            error: 'This TON wallet is already linked to another account',
          });
        }
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      if (err.code === 'TON_PROOF_INVALID') {
        return res.status(401).json({ error: err.message });
      }
      console.error('TON proof verification failed:', err.message);
      return res.status(500).json({ error: 'Failed to verify TON wallet' });
    }
  });

  app.get('/api/ton/wallet/me', authenticateToken, async (req, res) => {
    try {
      const result = await db.query(
        `SELECT ton_wallet_address, ton_wallet_network, ton_wallet_connected_at
         FROM users WHERE id = ?`,
        [req.user.id]
      );
      return res.json(toWalletResponse(result.rows[0]));
    } catch (err) {
      console.error('Failed to fetch TON wallet:', err.message);
      return res.status(500).json({ error: 'Failed to fetch TON wallet' });
    }
  });

  app.delete('/api/ton/wallet/me', authenticateToken, async (req, res) => {
    try {
      await db.query(
        `UPDATE users
         SET ton_wallet_address = NULL,
             ton_wallet_network = NULL,
             ton_wallet_public_key = NULL,
             ton_wallet_connected_at = NULL
         WHERE id = ?`,
        [req.user.id]
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error('Failed to unlink TON wallet:', err.message);
      return res.status(500).json({ error: 'Failed to unlink TON wallet' });
    }
  });
}

module.exports = { registerTonRoutes };
