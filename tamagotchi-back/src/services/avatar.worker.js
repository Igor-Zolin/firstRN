const fs = require('fs/promises');
const { parentPort } = require('worker_threads');
const { Jimp } = require('jimp');

async function composeAvatarPng({ width, height, layerPaths }) {
  const safeWidth = Number.isInteger(width) && width > 0 ? width : 3000;
  const safeHeight = Number.isInteger(height) && height > 0 ? height : 3000;
  const safeLayerPaths = Array.isArray(layerPaths) ? layerPaths : [];

  const base = new Jimp({ width: safeWidth, height: safeHeight, color: 0x00000000 });

  for (const filePath of safeLayerPaths) {
    if (typeof filePath !== 'string' || filePath.length === 0) continue;

    try {
      const fileBuffer = await fs.readFile(filePath);
      const layerImage = await Jimp.read(fileBuffer);
      base.composite(layerImage, 0, 0);
    } catch (err) {
      if (err?.code === 'ENOENT') {
        console.warn('[avatar-worker] missing layer file:', filePath);
      } else {
        console.warn('[avatar-worker] failed to process layer:', filePath, err?.message || err);
      }
    }
  }

  return base.getBuffer('image/png');
}

parentPort.on('message', async (payload) => {
  try {
    const png = await composeAvatarPng(payload);
    parentPort.postMessage({ ok: true, png });
  } catch (err) {
    parentPort.postMessage({
      ok: false,
      error: err?.message || 'Avatar render failed',
    });
  }
});
