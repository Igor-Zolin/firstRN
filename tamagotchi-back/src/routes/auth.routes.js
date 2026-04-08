const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

function registerAuthRoutes(app, deps) {
  const { db, jwtSecret, authenticateToken, game } = deps;
  const { ensureUserState } = game;

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
            if (err2.message.includes('UNIQUE constraint failed')) {
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
      `SELECT id, username, email, created_at
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
