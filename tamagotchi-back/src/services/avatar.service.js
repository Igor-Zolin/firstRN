const path = require('path');
const { Worker } = require('worker_threads');

const WIDTH = 3000;
const HEIGHT = 3000;
const LAYER_ORDER = ['background', 'weapon', 'eyes', 'cloth', 'hat'];

function createAvatarService(db) {
  const ITEMS_DIR = path.join(__dirname, '..', '..', 'public', 'items');
  const WORKER_PATH = path.join(__dirname, 'avatar.worker.js');

  function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
  }

  function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
  }

  function renderInWorker(layerPaths) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(WORKER_PATH);
      let settled = false;

      const safeTerminate = () => worker.terminate().catch(() => {});

      worker.once('message', (msg) => {
        if (settled) return;
        settled = true;

        if (!msg || msg.ok !== true || !msg.png) {
          safeTerminate();
          return reject(new Error(msg?.error || 'Avatar worker failed'));
        }

        const png = Buffer.isBuffer(msg.png) ? msg.png : Buffer.from(msg.png);
        safeTerminate();
        return resolve(png);
      });

      worker.once('error', (err) => {
        if (settled) return;
        settled = true;
        safeTerminate();
        reject(err);
      });

      worker.once('exit', (code) => {
        if (settled) return;
        settled = true;
        if (code === 0) reject(new Error('Avatar worker exited unexpectedly'));
        else reject(new Error(`Avatar worker exited with code ${code}`));
      });

      worker.postMessage({
        width: WIDTH,
        height: HEIGHT,
        layerPaths,
      });
    });
  }

  async function renderEquippedPngBuffer(userId) {
    const eq = await dbGet(
      `SELECT background_item_id, weapon_item_id, eyes_item_id, cloth_item_id, hat_item_id
       FROM user_equipped
       WHERE user_id = ?`,
      [userId]
    );

    if (!eq) {
      const e = new Error('Equipped not found');
      e.code = 404;
      throw e;
    }

    const slotToId = {
      background: eq.background_item_id,
      weapon: eq.weapon_item_id,
      eyes: eq.eyes_item_id,
      cloth: eq.cloth_item_id,
      hat: eq.hat_item_id,
    };

    const orderedIds = LAYER_ORDER
      .map((slot) => slotToId[slot])
      .filter((id) => Number.isInteger(id) && id > 0);

    if (orderedIds.length === 0) return renderInWorker([]);

    const placeholders = orderedIds.map(() => '?').join(',');
    const items = await dbAll(
      `SELECT id, model_name
       FROM items
       WHERE id IN (${placeholders})`,
      orderedIds
    );

    const byId = new Map(items.map((r) => [r.id, r.model_name]));
    const layerPaths = orderedIds
      .map((id) => byId.get(id))
      .filter((modelName) => typeof modelName === 'string' && modelName.length > 0)
      .map((modelName) => path.join(ITEMS_DIR, modelName));

    return renderInWorker(layerPaths);
  }

  return {
    renderEquippedPngBuffer,
  };
}

module.exports = { createAvatarService };
