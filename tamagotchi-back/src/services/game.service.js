function createGameService(db) {
  const START_ITEMS = [37, 70, 84, 97];
  const XP_BY_RARITY = {
    common: 10,
    uncommon: 25,
    rare: 50,
    epic: 100,
    legendary: 250,
  };
  const EQUIPPED_ITEM_COLUMNS = [
    'background_item_id',
    'weapon_item_id',
    'eyes_item_id',
    'cloth_item_id',
    'hat_item_id',
  ];

  const nowSec = () => Math.floor(Date.now() / 1000);
  const utcDay = () => Math.floor(Date.now() / 1000 / 86400);
  const rounded = (number, roundTo) => +number.toFixed(roundTo);

  function xpToNext(level) {
    return 50 + level * level * 10;
  }

  function recalcLevel(xp, level, beanz) {
    let curXp = Math.max(0, Math.floor(xp));
    let curLevel = Math.max(1, Math.floor(level));
    let curBeanz = Math.max(0, Math.floor(beanz));

    while (curXp >= xpToNext(curLevel)) {
      curXp -= xpToNext(curLevel);
      curLevel += 1;
      curBeanz += 10;
    }

    return { level: curLevel, xp: curXp, beanz: curBeanz };
  }

  function toClientStats(row) {
    const need = xpToNext(row.level);
    return {
      energy: row.energy,
      energyCap: row.energy_cap,
      coins: row.coins,
      coinsCap: row.coins_cap,
      beanz: row.beanz,
      level: row.level,
      xp: row.xp,
      xpToNext: need,
      xpProgress: need > 0 ? row.xp / need : 0,
      tapMult: row.tap_mult_x100 / 100,
      coinsRate: row.coins_rate_x100 / 100,
      beanzRate: row.beanz_rate_x1000 / 1000,
      upg_beanz_level: row.upg_beanz_level,
      upg_tap_level: row.upg_tap_level,
      upg_coins_level: row.upg_coins_level,
      upg_energy_cap_level: row.upg_energy_cap_level,
    };
  }

  function countEquippedCopies(equippedRow, itemId) {
    if (!equippedRow || !Number.isInteger(itemId)) return 0;
    let count = 0;
    for (const col of EQUIPPED_ITEM_COLUMNS) {
      if (Number(equippedRow[col]) === itemId) count += 1;
    }
    return count;
  }

  function grantStarterItems(userId, cb) {
    db.serialize(() => {
      const stmt = db.prepare(
        `INSERT INTO inventory (user_id, item_id, quantity)
         VALUES (?, ?, 1)
         ON CONFLICT (user_id, item_id) DO NOTHING`
      );

      for (const itemId of START_ITEMS) {
        stmt.run([userId, itemId]);
      }

      stmt.finalize((err) => cb(err || null));
    });
  }

  function ensureUserState(userId, cb) {
    const now = nowSec();

    db.serialize(() => {
      db.run(
        `INSERT INTO user_stats (user_id, updated_at) VALUES (?, ?)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, now],
        (e1) => {
          if (e1) return cb(e1);

          db.run(
            `INSERT INTO user_meta (user_id, last_tick_at, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT (user_id) DO NOTHING`,
            [userId, now, now],
            (e2) => {
              if (e2) return cb(e2);

              db.run(
                `INSERT INTO user_equipped (
                  user_id,
                  background_item_id,
                  weapon_item_id,
                  eyes_item_id,
                  cloth_item_id,
                  hat_item_id,
                  updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (user_id) DO NOTHING`,
                [userId, 37, null, 84, 70, 97, now],
                (e3) => {
                  if (e3) return cb(e3);
                  grantStarterItems(userId, (e4) => cb(e4 || null));
                }
              );
            }
          );
        }
      );
    });
  }

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

        const ENERGY_INTERVAL = 60;
        const COIN_INTERVAL = 60;
        const BEANZ_INTERVAL = 600;

        const energyTicks = Math.floor(delta / ENERGY_INTERVAL);
        const coinTicks = Math.floor(delta / COIN_INTERVAL);
        const beanzTicks = Math.floor(delta / BEANZ_INTERVAL);

        if (energyTicks === 0 && coinTicks === 0 && beanzTicks === 0) {
          return cb(null);
        }

        let energy = row.energy;
        energy = Math.max(0, energy - energyTicks);

        let coins = row.coins;
        if (energy > 0 && coinTicks > 0) {
          const coinsPerTick = row.coins_rate_x100 / 100;
          coins += coinTicks * coinsPerTick;
        }
        coins = Math.min(rounded(coins, 2), row.coins_cap);

        let beanz = row.beanz;
        const beanzPerTick = row.beanz_rate_x1000 / 1000;
        if (beanzTicks > 0 && beanzPerTick > 0) {
          beanz += Math.floor(beanzTicks * beanzPerTick);
        }

        let consumed = Infinity;
        if (energyTicks > 0) consumed = Math.min(consumed, energyTicks * ENERGY_INTERVAL);
        if (coinTicks > 0) consumed = Math.min(consumed, coinTicks * COIN_INTERVAL);
        if (beanzTicks > 0) consumed = Math.min(consumed, beanzTicks * BEANZ_INTERVAL);

        const newLast = last + consumed;

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
            [newLast, now, userId],
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

  return {
    START_ITEMS,
    XP_BY_RARITY,
    EQUIPPED_ITEM_COLUMNS,
    nowSec,
    utcDay,
    rounded,
    xpToNext,
    recalcLevel,
    toClientStats,
    countEquippedCopies,
    grantStarterItems,
    ensureUserState,
    applyTick,
    getFreshStats,
  };
}

module.exports = { createGameService };
