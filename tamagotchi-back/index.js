// import express from "express";

// const app = express();
// app.use(express.json());

// /**
//  * Простое хранилище состояния по userId.
//  * В реальности userId берётся из JWT/сессии.
//  */
// const store = new Map();

// function defaultState() {
//   return {
//     energy: 0,
//     maxEnergy: 100,
//     multiply: 1,

//     beanz: 0,
//     beanzMining: 0,

//     coin: 0,
//     maxCoins: 501,
//     multiplyCoins: 1,

//     xp: 0,

//     // для пересчёта “временных” процессов
//     lastUpdateAt: Date.now(),
//   };
// }

// function getUserId(req) {
//   // для примера: /state?userId=igor
//   return String(req.query.userId || req.headers["x-user-id"] || "guest");
// }

// function getState(userId) {
//   if (!store.has(userId)) store.set(userId, defaultState());
//   return store.get(userId);
// }

// /**
//  * Пересчёт ресурсов по времени.
//  * Вместо setInterval, считаем сколько “тиков” прошло.
//  *
//  * У тебя было:
//  * - энергия убывает: 1 раз в 100000ms (-1)
//  * - монеты растут, пока energy > 0: 1 раз в 100000ms (+multiplyCoins)
//  * - beanz растут, если beanzMining > 0: 1 раз в 1500ms (+beanzMining)
//  */
// function applyTick(state) {
//   const now = Date.now();
//   const elapsed = now - state.lastUpdateAt;
//   if (elapsed <= 0) return;

//   // 1) Beanz mining
//   if (state.beanzMining > 0) {
//     const beanzTickMs = 1500;
//     const beanzTicks = Math.floor(elapsed / beanzTickMs);
//     if (beanzTicks > 0) {
//       state.beanz += beanzTicks * state.beanzMining;
//     }
//   }

//   // 2) Energy decay + Coin gain (каждые 100000ms)
//   const bigTickMs = 100000;
//   const bigTicks = Math.floor(elapsed / bigTickMs);
//   if (bigTicks > 0) {
//     for (let i = 0; i < bigTicks; i++) {
//       // энергия убывает
//       if (state.energy > 0) {
//         state.energy = state.energy <= 1 ? 0 : state.energy - 1;
//       }

//       // монеты растут только если энергия > 0 (как у тебя)
//       if (state.energy > 0) {
//         state.coin += state.multiplyCoins;
//       }

//       // лимит монет
//       if (state.coin > state.maxCoins) state.coin = state.maxCoins;
//     }
//   }

//   // clamp energy
//   if (state.energy > state.maxEnergy) state.energy = state.maxEnergy;
//   if (state.energy < 0) state.energy = 0;

//   state.lastUpdateAt = now;
// }

// /** Утилита: ошибки */
// function fail(res, message, status = 400) {
//   return res.status(status).json({ ok: false, error: message });
// }

// /** Middleware: загрузить state и применить tick */
// function withState(req, res, next) {
//   const userId = getUserId(req);
//   const state = getState(userId);
//   applyTick(state);
//   req.userId = userId;
//   req.state = state;
//   next();
// }

// app.get("/state", withState, (req, res) => {
//   const { lastUpdateAt, ...publicState } = req.state;
//   res.json({ ok: true, state: publicState });
// });

// app.post("/reset", withState, (req, res) => {
//   store.set(req.userId, defaultState());
//   const state = getState(req.userId);
//   const { lastUpdateAt, ...publicState } = state;
//   res.json({ ok: true, state: publicState });
// });

// app.post("/cheat", withState, (req, res) => {
//   const s = req.state;
//   s.energy = 50;
//   s.coin = 500;
//   s.beanz = 50;
//   // clamp
//   if (s.energy > s.maxEnergy) s.energy = s.maxEnergy;
//   if (s.coin > s.maxCoins) s.coin = s.maxCoins;

//   const { lastUpdateAt, ...publicState } = s;
//   res.json({ ok: true, state: publicState });
// });

// app.post("/tap", withState, (req, res) => {
//   const s = req.state;
//   if (s.energy < s.maxEnergy) {
//     s.energy += s.multiply;
//     if (s.energy > s.maxEnergy) s.energy = s.maxEnergy;
//   }
//   const { lastUpdateAt, ...publicState } = s;
//   res.json({ ok: true, state: publicState });
// });

// // Апгрейды
// app.post("/upgrade/step", withState, (req, res) => {
//   const s = req.state;
//   if (s.coin < 50) return fail(res, "Недостаточно монет для улучшения!");
//   s.coin -= 50;
//   s.multiply += 1;
//   const { lastUpdateAt, ...publicState } = s;
//   res.json({ ok: true, state: publicState });
// });

// app.post("/upgrade/multi", withState, (req, res) => {
//   const s = req.state;
//   if (s.coin < 100) return fail(res, "Недостаточно монет для улучшения!");
//   s.coin -= 100;
//   s.multiply = Number((s.multiply * 1.5).toFixed(4));
//   const { lastUpdateAt, ...publicState } = s;
//   res.json({ ok: true, state: publicState });
// });

// app.post("/upgrade/cap", withState, (req, res) => {
//   const s = req.state;
//   // у тебя это бесплатно. Если нужно — добавь стоимость.
//   s.maxEnergy += 25;
//   const { lastUpdateAt, ...publicState } = s;
//   res.json({ ok: true, state: publicState });
// });

// app.post("/upgrade/coinrate", withState, (req, res) => {
//   const s = req.state;
//   // у тебя это бесплатно. Если нужно — добавь стоимость.
//   s.multiplyCoins = Number((s.multiplyCoins + 0.1).toFixed(4));
//   const { lastUpdateAt, ...publicState } = s;
//   res.json({ ok: true, state: publicState });
// });

// // Майнинг
// app.post("/mining/plus", withState, (req, res) => {
//   const s = req.state;
//   if (s.coin < 20) return fail(res, "Недостаточно монет для улучшения!");
//   s.coin -= 20;
//   s.beanzMining += 1;
//   const { lastUpdateAt, ...publicState } = s;
//   res.json({ ok: true, state: publicState });
// });

// app.listen(3000, () => {
//   console.log("API running on http://localhost:3000");
// });
