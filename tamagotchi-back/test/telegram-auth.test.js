const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { validateTelegramInitData } = require('../src/services/telegram-auth.service');

const BOT_TOKEN = '123456789:test-token';
const NOW = 1_800_000_000;

function createInitData(overrides = {}) {
  const fields = {
    auth_date: String(NOW - 30),
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    user: JSON.stringify({
      id: 123456789,
      first_name: 'Test',
      last_name: 'User',
      username: 'test_user',
      language_code: 'en',
    }),
    ...overrides,
  };
  const dataCheckString = Object.entries(fields)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return new URLSearchParams({ ...fields, hash }).toString();
}

test('validates signed Telegram Mini App data', () => {
  const result = validateTelegramInitData(createInitData(), BOT_TOKEN, {
    nowSeconds: NOW,
    maxAgeSeconds: 300,
  });

  assert.deepEqual(result.user, {
    id: 123456789,
    username: 'test_user',
    firstName: 'Test',
    lastName: 'User',
    languageCode: 'en',
    photoUrl: null,
  });
});

test('rejects tampered Telegram Mini App data', () => {
  const initData = createInitData().replace('test_user', 'attacker');

  assert.throws(
    () =>
      validateTelegramInitData(initData, BOT_TOKEN, {
        nowSeconds: NOW,
        maxAgeSeconds: 300,
      }),
    /signature is invalid/
  );
});

test('rejects expired Telegram Mini App data', () => {
  const initData = createInitData({ auth_date: String(NOW - 600) });

  assert.throws(
    () =>
      validateTelegramInitData(initData, BOT_TOKEN, {
        nowSeconds: NOW,
        maxAgeSeconds: 300,
      }),
    /has expired/
  );
});
