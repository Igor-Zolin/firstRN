// server.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const cors = require('cors');

const db = require('./database/db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key_change_this';

// ---------- middleware ----------
app.use(express.json());

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);

      const ok =
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:');

      cb(ok ? null : new Error('Not allowed by CORS'), ok);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.options(/.*/, cors());

// ---------- auth middleware ----------
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// ---------- helpers ----------
const nowSec = () => Math.floor(Date.now() / 1000);

function toClientStats(row) {
  return {
    energy: row.energy,
    energyCap: row.energy_cap,

    coins: row.coins,
    coinsCap: row.coins_cap,

    beanz: row.beanz,

    xp: row.xp,
    level: row.level,

    tapMult: row.tap_mult_x100 / 100,
    coinsRate: row.coins_rate_x100 / 100,
    beanzRate: row.beanz_rate_x1000 / 1000,
  };
}

function ensureUserState(userId, cb) {
  const now = nowSec();
  db.serialize(() => {
    db.run(
      `INSERT OR IGNORE INTO user_stats (user_id, updated_at) VALUES (?, ?)`,
      [userId, now],
      (e1) => {
        if (e1) return cb(e1);
        db.run(
          `INSERT OR IGNORE INTO user_meta (user_id, last_tick_at, updated_at) VALUES (?, ?, ?)`,
          [userId, now, now],
          (e2) => cb(e2 || null)
        );
      }
    );
  });
}

// tick: пересчёт offline прогресса по last_tick_at
function applyTick(userId, cb) {
  db.get(
    `SELECT s.*, m.last_tick_at
     FROM user_stats s
     JOIN user_meta m ON m.user_id = s.user_id
     WHERE s.user_id = ?`,
    [userId],
    (err, row) => {
      if (err) return cb(err);
      if (!row) return cb(Object.assign(new Error('Stats not found'), { code: 404 }));

      const now = nowSec();
      const last = row.last_tick_at || now;
      const delta = Math.max(0, now - last);

      if (delta === 0) return cb(null);

      // rules:
      const energyLoss = Math.floor(delta / 60); // 1 энергия / 1 мин
      const beanzTicks = Math.floor(delta / 600); // каждые 10 минут
      const coinTicks = Math.floor(delta / 60);  // + монеты каждую минуту

      let energy = row.energy;
      energy = Math.max(0, energy - energyLoss);

      let coins = row.coins;
      if (energy > 0 && coinTicks > 0) {
        const coinsPerTick = row.coins_rate_x100 / 100;
        coins += Math.floor(coinTicks * coinsPerTick);
      }
      coins = Math.min(coins, row.coins_cap);

      let beanz = row.beanz;
      const beanzPerTick = row.beanz_rate_x1000 / 1000;
      if (beanzTicks > 0 && beanzPerTick > 0) {
        beanz += Math.floor(beanzTicks * beanzPerTick);
      }

      db.serialize(() => {
        db.run(
          `UPDATE user_stats
           SET energy = ?, coins = ?, beanz = ?, updated_at = ?
           WHERE user_id = ?`,
          [energy, coins, beanz, now, userId]
        );
        db.run(
          `UPDATE user_meta
           SET last_tick_at = ?, updated_at = ?
           WHERE user_id = ?`,
          [now, now, userId],
          (e2) => cb(e2 || null)
        );
      });
    }
  );
}

function getFreshStats(userId, cb) {
  applyTick(userId, (err) => {
    if (err) return cb(err);
    db.get(`SELECT * FROM user_stats WHERE user_id = ?`, [userId], (err2, row) => {
      if (err2) return cb(err2);
      if (!row) return cb(Object.assign(new Error('Stats not found'), { code: 404 }));
      cb(null, row);
    });
  });
}

// ---------- test route ----------
app.get('/api/heartbeat', (req, res) => {
  return res.status(200).json({ code: 200, message: 'Healthy!' });
});

// ---------- auth ----------
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
      function (err2) {
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

          const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '7d' });

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
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    bcrypt.compare(password, user.password, (err2, isMatch) => {
      if (err2) {
        console.error('Error comparing passwords:', err2.message);
        return res.status(500).json({ error: 'Failed to authenticate' });
      }
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      ensureUserState(user.id, (e3) => {
        if (e3) {
          console.error('Error ensure user state:', e3.message);
          return res.status(500).json({ error: 'Failed to init user state' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
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

// Запрос ответа текущего пользователя
app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get(
    `SELECT id, username, email, created_at FROM users WHERE id = ?`,
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

// ---------- stats ----------
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

// ---------- actions ----------
app.post('/api/actions/tap', authenticateToken, (req, res) => {
  const userId = req.user.id;

  getFreshStats(userId, (err, s) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch stats' });

    const mult = Math.max(0, Math.floor(s.tap_mult_x100 / 100));
    const nextEnergy = Math.min(s.energy_cap, s.energy + mult);
    const now = nowSec();

    db.run(
      `UPDATE user_stats SET energy = ?, updated_at = ? WHERE user_id = ?`,
      [nextEnergy, now, userId],
      (err2) => {
        if (err2) return res.status(500).json({ error: 'Failed to update energy' });

        db.get(`SELECT * FROM user_stats WHERE user_id = ?`, [userId], (err3, row) => {
          if (err3) return res.status(500).json({ error: 'Failed to fetch stats' });
          return res.json(toClientStats(row));
        });
      }
    );
  });
});

app.post('/api/actions/upgrade', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { kind } = req.body;

  const allowed = new Set(['tap_plus', 'tap_multi', 'cap_energy', 'coin_rate', 'beanz_mining']);
  if (!allowed.has(kind)) return res.status(400).json({ error: 'Invalid upgrade kind' });

  getFreshStats(userId, (err, s) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch stats' });

    let coins = s.coins;
    const next = { ...s };

    if (kind === 'beanz_mining') {
      if (coins < 20) return res.status(400).json({ error: 'Not enough coins' });
      coins -= 20;
      next.beanz_rate_x1000 = s.beanz_rate_x1000 + 1000; // +1.0
      next.upg_beanz_level = s.upg_beanz_level + 1;
    }

    if (kind === 'tap_plus') {
      if (coins < 50) return res.status(400).json({ error: 'Not enough coins' });
      coins -= 50;
      next.tap_mult_x100 = s.tap_mult_x100 + 100; // +1.00
      next.upg_tap_level = s.upg_tap_level + 1;
    }

    if (kind === 'tap_multi') {
      if (coins < 100) return res.status(400).json({ error: 'Not enough coins' });
      coins -= 100;
      next.tap_mult_x100 = Math.floor(s.tap_mult_x100 * 150 / 100); // *1.5
      next.upg_tap_level = s.upg_tap_level + 1;
    }

    if (kind === 'cap_energy') {
      const price = Math.floor(s.coins_cap * 0.7);

      if (coins < price) {
        return res.status(400).json({
          error: `Not enough coins. Need ${price}`,
        });
      }
      coins -= price;
      next.energy_cap = s.energy_cap + 50;
      next.upg_energy_cap_level = s.upg_energy_cap_level + 1;
    }

    if (kind === 'cap_coins') {
      const price = Math.floor(s.coins_cap * 0.80);

      if (coins < price) {
        return res.status(400).json({
          error: `Not enough coins. Need ${price}`,
        });
      }

      coins -= price;
      next.coins_cap = Math.floor(s.coins_cap * 1.25); // +25% coins cap
      next.upg_coins_level = s.upg_coins_level + 1;
    }
    
    if (kind === 'coin_rate') {
      const price = Math.floor(s.coins_cap * 0.90);

      if (coins < price) {
        return res.status(400).json({
          error: `Not enough coins. Need ${price}`,
        });
      }

      coins -= price;
      next.coins_rate_x100 = s.coins_rate_x100 + 10; // +0.10 coins / min
      next.upg_coins_level = s.upg_coins_level + 1;
    }

    next.coins = Math.max(0, Math.min(next.coins_cap, coins));

    const now = nowSec();

    db.run(
      `UPDATE user_stats SET
        energy = ?, energy_cap = ?,
        coins = ?, coins_cap = ?,
        beanz = ?,
        xp = ?, level = ?,
        tap_mult_x100 = ?, coins_rate_x100 = ?, beanz_rate_x1000 = ?,
        upg_tap_level = ?, upg_coins_level = ?, upg_energy_cap_level = ?, upg_beanz_level = ?,
        updated_at = ?
       WHERE user_id = ?`,
      [
        next.energy,
        next.energy_cap,
        next.coins,
        next.coins_cap,
        next.beanz,
        next.xp,
        next.level,
        next.tap_mult_x100,
        next.coins_rate_x100,
        next.beanz_rate_x1000,
        next.upg_tap_level,
        next.upg_coins_level,
        next.upg_energy_cap_level,
        next.upg_beanz_level,
        now,
        userId,
      ],
      (err2) => {
        if (err2) {
          console.error('Error applying upgrade:', err2.message);
          return res.status(500).json({ error: 'Failed to apply upgrade' });
        }

        db.get(`SELECT * FROM user_stats WHERE user_id = ?`, [userId], (err3, row) => {
          if (err3) return res.status(500).json({ error: 'Failed to fetch stats' });
          return res.json(toClientStats(row));
        });
      }
    );
  });
});

app.post('/api/actions/reset', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const now = nowSec();

  db.serialize(() => {
    db.run(
      `UPDATE user_stats SET
        energy=0, energy_cap=100,
        coins=0, coins_cap=501,
        beanz=0,
        xp=0, level=1,
        tap_mult_x100=100, coins_rate_x100=100, beanz_rate_x1000=0,
        upg_tap_level=0, upg_coins_level=0, upg_energy_cap_level=0, upg_beanz_level=0,
        updated_at=?
       WHERE user_id=?`,
      [now, userId],
      (err) => {
        if (err) return res.status(500).json({ error: 'Failed to reset stats' });

        db.run(
          `UPDATE user_meta SET last_tick_at=?, updated_at=? WHERE user_id=?`,
          [now, now, userId],
          (err2) => {
            if (err2) return res.status(500).json({ error: 'Failed to reset meta' });

            db.get(`SELECT * FROM user_stats WHERE user_id=?`, [userId], (err3, row) => {
              if (err3) return res.status(500).json({ error: 'Failed to fetch stats' });
              return res.json(toClientStats(row));
            });
          }
        );
      }
    );
  });
});

app.post('/api/actions/cheat', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const now = nowSec();

  getFreshStats(userId, (err, s) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch stats' });

    const energy = Math.min(s.energy_cap, 50);
    const coins = Math.min(s.coins_cap, 500);
    const beanz = s.beanz + 50;

    db.run(
      `UPDATE user_stats SET energy=?, coins=?, beanz=?, updated_at=? WHERE user_id=?`,
      [energy, coins, beanz, now, userId],
      (err2) => {
        if (err2) return res.status(500).json({ error: 'Failed to cheat' });

        db.get(`SELECT * FROM user_stats WHERE user_id=?`, [userId], (err3, row) => {
          if (err3) return res.status(500).json({ error: 'Failed to fetch stats' });
          return res.json(toClientStats(row));
        });
      }
    );
  });
});

// ---------- inventory/items ----------
app.get('/api/users/:id/inventory', authenticateToken, (req, res) => {
  const userId = req.params.id;

  if (req.user.id != userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.all(
    `
    SELECT i.id, i.quantity, it.name, it.type, it.model_name, it.rarity
    FROM inventory i
    JOIN items it ON i.item_id = it.id
    WHERE i.user_id = ?
  `,
    [userId],
    (err, rows) => {
      if (err) {
        console.error('Error fetching inventory:', err.message);
        return res.status(500).json({ error: 'Failed to fetch inventory' });
      }

      return res.json({ user_id: userId, items: rows });
    }
  );
});

app.get('/api/items', (req, res) => {
  db.all('SELECT * FROM items', [], (err, rows) => {
    if (err) {
      console.error('Error fetching items:', err.message);
      return res.status(500).json({ error: 'Failed to fetch items' });
    }
    return res.json(rows);
  });
});

// ---------- seed (без lvl/xp/coins/beanz в users) ----------
app.get('/api/seed', (req, res) => {
  db.serialize(() => {
    db.run(
      `
      INSERT OR IGNORE INTO users (username, password, email)
      VALUES 
        ('player1', '$2b$10$abcdefghijklmnopqrstuv', 'player1@test.com'),
        ('player2', '$2b$10$abcdefghijklmnopqrstuv', 'player2@test.com'),
        ('player3', '$2b$10$abcdefghijklmnopqrstuv', 'player3@test.com')
    `,
      (err) => {
        if (err) console.error('Error inserting users:', err.message);
      }
    );

    db.run(
      `
      INSERT OR IGNORE INTO items (name, type, model_name, rarity, price)
      VALUES 
        ('Golden Head', 'head', 'golden_head.png', 'epic', 500),
        ('Silver Head', 'head', 'silver_head.png', 'rare', 300),
        ('Red Body', 'body', 'red_body.png', 'common', 100),
        ('Blue Body', 'body', 'blue_body.png', 'rare', 250),
        ('Black Boots', 'boots', 'black_boots.png', 'common', 50),
        ('Golden Boots', 'boots', 'golden_boots.png', 'legendary', 1000),
        ('Purple Cape', 'cape', 'purple_cape.png', 'epic', 400)
    `,
      (err) => {
        if (err) console.error('Error inserting items:', err.message);
      }
    );

    db.run(
      `
      INSERT OR IGNORE INTO inventory (user_id, item_id, quantity)
      VALUES 
        (1, 1, 1),
        (1, 3, 1),
        (1, 5, 1),
        (2, 2, 1),
        (2, 4, 1),
        (3, 1, 1),
        (3, 6, 1),
        (3, 7, 1)
    `,
      (err) => {
        if (err) console.error('Error inserting inventory:', err.message);
      }
    );

    // гарантируем user_stats/user_meta для первых трёх пользователей
    ensureUserState(1, () => {});
    ensureUserState(2, () => {});
    ensureUserState(3, () => {});
  });

  return res.status(200).json({
    code: 200,
    message: 'Database seeded successfully!',
    data: { users: 3, items: 7, inventory_entries: 8 },
  });
});

app.listen(PORT, () => {
  console.log(`[~] Server running on http://127.0.0.1:${PORT}`);
});
