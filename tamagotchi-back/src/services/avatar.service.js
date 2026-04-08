const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

const WIDTH = 3000;
const HEIGHT = 3000;
const LAYER_ORDER = ['background', 'weapon', 'eyes', 'cloth', 'hat'];

function createAvatarService(db) {
  const ITEMS_DIR = path.join(__dirname, '..', '..', 'public', 'items');

  async function renderEquippedPngBuffer(userId) {
    const eq = await new Promise((resolve, reject) => {
      db.get(
        `SELECT background_item_id, weapon_item_id, eyes_item_id, cloth_item_id, hat_item_id
         FROM user_equipped
         WHERE user_id = ?`,
        [userId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });

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

    const base = new Jimp({ width: WIDTH, height: HEIGHT, color: 0x00000000 });
    if (orderedIds.length === 0) {
      return base.getBuffer('image/png');
    }

    const placeholders = orderedIds.map(() => '?').join(',');
    const items = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, model_name
         FROM items
         WHERE id IN (${placeholders})`,
        orderedIds,
        (err, rows) => (err ? reject(err) : resolve(rows))
      );
    });

    const byId = new Map(items.map((r) => [r.id, r.model_name]));

    for (const id of orderedIds) {
      const modelName = byId.get(id);
      if (!modelName) continue;

      const filePath = path.join(ITEMS_DIR, modelName);
      if (!fs.existsSync(filePath)) {
        console.warn('[avatar] missing file:', filePath);
        continue;
      }

      const buf = fs.readFileSync(filePath);
      const layerImg = await Jimp.read(buf);
      base.composite(layerImg, 0, 0);
    }

    return base.getBuffer('image/png');
  }

  return {
    renderEquippedPngBuffer,
  };
}

module.exports = { createAvatarService };
