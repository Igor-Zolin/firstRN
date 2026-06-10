const crypto = require('crypto');

function invalid(message) {
  return Object.assign(new Error(message), { code: 'TELEGRAM_AUTH_INVALID' });
}

function validateTelegramInitData(
  initData,
  botToken,
  { maxAgeSeconds = 86400, nowSeconds = Math.floor(Date.now() / 1000) } = {}
) {
  if (typeof initData !== 'string' || !initData.trim()) {
    throw invalid('Telegram initData is required');
  }
  if (typeof botToken !== 'string' || !botToken.trim()) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
    throw invalid('Telegram initData hash is missing or malformed');
  }

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest();
  const receivedHash = Buffer.from(hash, 'hex');

  if (
    receivedHash.length !== expectedHash.length ||
    !crypto.timingSafeEqual(receivedHash, expectedHash)
  ) {
    throw invalid('Telegram initData signature is invalid');
  }

  const authDate = Number(params.get('auth_date'));
  if (!Number.isSafeInteger(authDate) || authDate <= 0) {
    throw invalid('Telegram auth_date is invalid');
  }
  if (authDate > nowSeconds + 60) {
    throw invalid('Telegram auth_date is in the future');
  }
  if (maxAgeSeconds > 0 && nowSeconds - authDate > maxAgeSeconds) {
    throw invalid('Telegram initData has expired');
  }

  const rawUser = params.get('user');
  if (!rawUser) throw invalid('Telegram user data is missing');

  let user;
  try {
    user = JSON.parse(rawUser);
  } catch {
    throw invalid('Telegram user data is malformed');
  }

  const userId = Number(user?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw invalid('Telegram user id is invalid');
  }

  return {
    authDate,
    queryId: params.get('query_id') || null,
    startParam: params.get('start_param') || null,
    user: {
      id: userId,
      username: typeof user.username === 'string' ? user.username : null,
      firstName: typeof user.first_name === 'string' ? user.first_name : '',
      lastName: typeof user.last_name === 'string' ? user.last_name : '',
      languageCode:
        typeof user.language_code === 'string' ? user.language_code : null,
      photoUrl: typeof user.photo_url === 'string' ? user.photo_url : null,
    },
  };
}

module.exports = { validateTelegramInitData };
