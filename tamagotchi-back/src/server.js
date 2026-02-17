const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const db = require('./database/db');
const cors = require('cors');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key_change_this';

// Middleware для парсинга JSON
app.use(express.json());

app.use(cors({
  origin(origin, cb) {
    // запросы без origin (curl, postman) — разрешаем
    if (!origin) return cb(null, true);

    const ok =
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:');

    cb(ok ? null : new Error('Not allowed by CORS'), ok);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.options(/.*/, cors());

// Middleware для проверки токена
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

app.get('/api/heartbeat', (req, res) => {
  return res.status(200).send({
    code: 200,
    message: 'Healthy!',
  });
})

// Регистрация
app.post('/api/auth/register', (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  // Валидация
  if (!username || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  // Хешируем пароль
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      console.error('Error hashing password:', err.message);
      return res.status(500).json({ error: 'Failed to hash password' });
    }

    // Добавляем пользователя в БД
    db.run(
      `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
      [username, email, hashedPassword],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Username or email already exists' });
          }
          console.error('Error registering user:', err.message);
          return res.status(500).json({ error: 'Failed to register user' });
        }

        const token = jwt.sign(
          { id: this.lastID, username },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        return res.status(201).json({
          code: 201,
          message: 'User registered successfully',
          user: {
            id: this.lastID,
            username,
            email
          },
          token
        });
      }
    );
  });
});

// Авторизация
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  db.get(
    `SELECT * FROM users WHERE username = ?`,
    [username],
    (err, user) => {
      if (err) {
        console.error('Error fetching user:', err.message);
        return res.status(500).json({ error: 'Failed to authenticate' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Проверяем пароль
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
          console.error('Error comparing passwords:', err.message);
          return res.status(500).json({ error: 'Failed to authenticate' });
        }

        if (!isMatch) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign(
          { id: user.id, username: user.username },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        return res.status(200).json({
          code: 200,
          message: 'Login successful',
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            lvl: user.lvl,
            xp: user.xp,
            coins: user.coins,
            beanz: user.beanz
          },
          token
        });
      });
    }
  );
});

// Получить профиль текущего пользователя (защищено токеном)
app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get(
    `SELECT id, username, email, created_at FROM users WHERE id = ?`,
    [req.user.id],
    (err, user) => {
      if (err) {
        console.error('Error fetching user:', err.message);
        return res.status(500).json({ error: 'Failed to fetch user' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json(user);
    }
  );
});

app.get('/api/stats', (req, res) => {
  db.all('SELECT * FROM user_stats', [], (err, rows) => {
    if (err) {
      console.error('Error fetching stats:', err.message);
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }

    return res.json(rows);
  });
});

// Тестовый метод для заполнения БД
app.get('/api/seed', (req, res) => {
  db.serialize(() => {
    db.run(`
      INSERT OR IGNORE INTO users (username, password, email, lvl, xp, coins, beanz)
      VALUES 
        ('player1', 'hashed_pass_1', 'player1@test.com', 5, 1500, 5000, 100),
        ('player2', 'hashed_pass_2', 'player2@test.com', 3, 800, 2000, 50),
        ('player3', 'hashed_pass_3', 'player3@test.com', 10, 5000, 15000, 300)
    `, (err) => {
      if (err) console.error('Error inserting users:', err.message);
    });

    db.run(`
      INSERT OR IGNORE INTO items (name, type, model_name, rarity, price)
      VALUES 
        ('Golden Head', 'head', 'golden_head.png', 'epic', 500),
        ('Silver Head', 'head', 'silver_head.png', 'rare', 300),
        ('Red Body', 'body', 'red_body.png', 'common', 100),
        ('Blue Body', 'body', 'blue_body.png', 'rare', 250),
        ('Black Boots', 'boots', 'black_boots.png', 'common', 50),
        ('Golden Boots', 'boots', 'golden_boots.png', 'legendary', 1000),
        ('Purple Cape', 'cape', 'purple_cape.png', 'epic', 400)
    `, (err) => {
      if (err) console.error('Error inserting items:', err.message);
    });

    db.run(`
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
    `, (err) => {
      if (err) console.error('Error inserting inventory:', err.message);
    });
  });

  return res.status(200).json({
    code: 200,
    message: 'Database seeded successfully!',
    data: {
      users: 3,
      items: 7,
      inventory_entries: 8
    }
  });
});

// Метод для получения инвентаря пользователя (защищено токеном)
app.get('/api/users/:id/inventory', authenticateToken, (req, res) => {
  const userId = req.params.id;

  // Проверяем, может ли пользователь просмотреть инвентарь
  if (req.user.id != userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.all(`
    SELECT i.id, i.quantity, it.name, it.type, it.model_name, it.rarity
    FROM inventory i
    JOIN items it ON i.item_id = it.id
    WHERE i.user_id = ?
  `, [userId], (err, rows) => {
    if (err) {
      console.error('Error fetching inventory:', err.message);
      return res.status(500).json({ error: 'Failed to fetch inventory' });
    }

    return res.json({
      user_id: userId,
      items: rows
    });
  });
});

// Метод для получения всех предметов
app.get('/api/items', (req, res) => {
  db.all('SELECT * FROM items', [], (err, rows) => {
    if (err) {
      console.error('Error fetching items:', err.message);
      return res.status(500).json({ error: 'Failed to fetch items' });
    }

    return res.json(rows);
  });
});
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

// tick: пересчитать пассивку на основании last_tick_at
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

      if (delta === 0) return cb(null); // ничего делать не надо

      // --- правила под твои интервалы ---
      const energyLoss = Math.floor(delta / 100); // 1 energy / 100 sec
      const beanzTicks = Math.floor(delta / 1.5); // каждые 1.5 sec
      const coinTicks = Math.floor(delta / 100);  // каждые 100 sec

      let energy = row.energy;
      energy = Math.max(0, energy - energyLoss);

      // coins: добываем только если есть энергия (>0)
      let coins = row.coins;
      if (energy > 0 && coinTicks > 0) {
        // coins_rate_x100 это "монет за тик" *100
        const coinsPerTick = row.coins_rate_x100 / 100;
        coins += Math.floor(coinTicks * coinsPerTick);
      }

      // cap
      coins = Math.min(coins, row.coins_cap);

      // beanz
      let beanz = row.beanz;
      const beanzPerTick = row.beanz_rate_x1000 / 1000;
      if (beanzTicks > 0 && beanzPerTick > 0) {
        beanz += Math.floor(beanzTicks * beanzPerTick);
      }

      // сохранить
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

app.listen(PORT, () => {
  console.log(`[~] Server running on http://127.0.0.1:${PORT}`);
})