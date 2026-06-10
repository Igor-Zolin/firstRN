const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { validateTelegramInitData } = require('../services/telegram-auth.service');

function ensureUserStateAsync(ensureUserState, userId) {
  return new Promise((resolve, reject) => {
    ensureUserState(userId, (err) => (err ? reject(err) : resolve()));
  });
}

function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    created_at: user.created_at,
    telegram_id: user.telegram_id,
    telegram_username: user.telegram_username,
    first_name: user.first_name,
    last_name: user.last_name,
    language_code: user.language_code,
    photo_url: user.photo_url,
  };
}

function registerAuthRoutes(app, deps) {
  const {
    db,
    jwtSecret,
    telegramBotToken,
    telegramAuthMaxAgeSeconds,
    authenticateToken,
    game,
  } = deps;
  const { ensureUserState } = game;

  app.post('/api/auth/telegram', async (req, res) => {
    if (!telegramBotToken) {
      return res.status(503).json({ error: 'Telegram authentication is not configured' });
    }

    try {
      const telegram = validateTelegramInitData(req.body?.initData, telegramBotToken, {
        maxAgeSeconds: telegramAuthMaxAgeSeconds,
      });

      let result = await db.query(
        `SELECT id, username, email, created_at, telegram_id, telegram_username,
                first_name, last_name, language_code, photo_url
         FROM users
         WHERE telegram_id = ?`,
        [telegram.user.id]
      );
      let user = result.rows[0];

      if (user) {
        result = await db.query(
          `UPDATE users
           SET telegram_username = ?,
               first_name = ?,
               last_name = ?,
               language_code = ?,
               photo_url = ?
           WHERE telegram_id = ?
           RETURNING id, username, email, created_at, telegram_id,
                     telegram_username, first_name, last_name, language_code, photo_url`,
          [
            telegram.user.username,
            telegram.user.firstName,
            telegram.user.lastName,
            telegram.user.languageCode,
            telegram.user.photoUrl,
            telegram.user.id,
          ]
        );
        user = result.rows[0];
      } else {
        const suffix = crypto.randomBytes(4).toString('hex');
        const username = `tg_${telegram.user.id}_${suffix}`;
        const email = `tg_${telegram.user.id}_${suffix}@telegram.invalid`;
        const password = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

        result = await db.query(
          `INSERT INTO users (
             username, email, password, telegram_id, telegram_username,
             first_name, last_name, language_code, photo_url
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (telegram_id) DO UPDATE SET
             telegram_username = EXCLUDED.telegram_username,
             first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name,
             language_code = EXCLUDED.language_code,
             photo_url = EXCLUDED.photo_url
           RETURNING id, username, email, created_at, telegram_id,
                     telegram_username, first_name, last_name, language_code, photo_url`,
          [
            username,
            email,
            password,
            telegram.user.id,
            telegram.user.username,
            telegram.user.firstName,
            telegram.user.lastName,
            telegram.user.languageCode,
            telegram.user.photoUrl,
          ]
        );
        user = result.rows[0];
      }

      await ensureUserStateAsync(ensureUserState, user.id);
      const token = jwt.sign({ id: user.id, username: user.username }, jwtSecret, {
        expiresIn: '7d',
      });

      return res.json({ code: 200, user: toPublicUser(user), token });
    } catch (err) {
      if (err.code === 'TELEGRAM_AUTH_INVALID') {
        return res.status(401).json({ error: err.message });
      }

      console.error('Telegram authentication failed:', err.message);
      return res.status(500).json({ error: 'Failed to authenticate with Telegram' });
    }
  });

  app.post('/api/auth/register', (req, res) => {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.error('Error hashing password:', err.message);
        return res.status(500).json({ error: 'Failed to hash password' });
      }

      db.run(
        `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
        [username, email, hashedPassword],
        function onRegistered(err2) {
          if (err2) {
            if (err2.code === '23505') {
              return res.status(409).json({ error: 'Username or email already exists' });
            }
            console.error('Error registering user:', err2.message);
            return res.status(500).json({ error: 'Failed to register user' });
          }

          const userId = this.lastID;
          ensureUserState(userId, (e3) => {
            if (e3) {
              console.error('Error creating stats/meta:', e3.message);
              return res.status(500).json({ error: 'Failed to init user state' });
            }

            const token = jwt.sign({ id: userId, username }, jwtSecret, { expiresIn: '7d' });
            return res.status(201).json({
              code: 201,
              message: 'User registered successfully',
              user: { id: userId, username, email },
              token,
            });
          });
        }
      );
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
      if (err) {
        console.error('Error fetching user:', err.message);
        return res.status(500).json({ error: 'Failed to authenticate' });
      }
      if (!user) return res.status(401).json({ error: 'Invalid username or password' });

      bcrypt.compare(password, user.password, (err2, isMatch) => {
        if (err2) {
          console.error('Error comparing passwords:', err2.message);
          return res.status(500).json({ error: 'Failed to authenticate' });
        }
        if (!isMatch) return res.status(401).json({ error: 'Invalid username or password' });

        ensureUserState(user.id, (e3) => {
          if (e3) {
            console.error('Error ensure user state:', e3.message);
            return res.status(500).json({ error: 'Failed to init user state' });
          }

          const token = jwt.sign({ id: user.id, username: user.username }, jwtSecret, {
            expiresIn: '7d',
          });

          return res.status(200).json({
            code: 200,
            message: 'Login successful',
            user: { id: user.id, username: user.username, email: user.email },
            token,
          });
        });
      });
    });
  });

  app.get('/api/auth/me', authenticateToken, (req, res) => {
    db.get(
      `SELECT id, username, email, created_at, telegram_id, telegram_username,
              first_name, last_name, language_code, photo_url
       FROM users
       WHERE id = ?`,
      [req.user.id],
      (err, user) => {
        if (err) {
          console.error('Error fetching user:', err.message);
          return res.status(500).json({ error: 'Failed to fetch user' });
        }
        if (!user) return res.status(404).json({ error: 'User not found' });
        return res.json(user);
      }
    );
  });
}

module.exports = { registerAuthRoutes };
