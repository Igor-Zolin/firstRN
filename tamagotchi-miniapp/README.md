# Tamagotchi Telegram Mini App

React + TypeScript + Vite клиент, подготовленный для запуска внутри Telegram.

## Что интегрировано

- официальный `telegram-web-app.js`;
- вызовы `ready()` и `expand()`;
- Telegram theme, viewport и content safe area;
- нативная кнопка Back для внутренних маршрутов;
- автоматическая авторизация через подписанный `initData`;
- обычная форма входа как fallback для локальной браузерной разработки.

`initDataUnsafe` не используется для авторизации. Клиент передаёт исходную строку
`initData` серверу, а сервер проверяет HMAC-подпись с помощью токена бота.

## Локальный запуск

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

По умолчанию API ожидается на `http://localhost:3000`. Для другого адреса:

```env
VITE_API_BASE_URL=https://api.example.com
```

## Production build

```powershell
npm run lint
npm run build
```

Разместите содержимое `dist` на HTTPS-хостинге. Telegram production Mini Apps
должны открываться по публичному HTTPS URL. Если фронтенд и API находятся на
разных доменах, задайте `VITE_API_BASE_URL` до сборки.

Хостинг должен возвращать `index.html` для неизвестных путей, потому что клиент
использует `BrowserRouter`.

## Backend

В `tamagotchi-back/.env` обязательны:

```env
NODE_ENV=production
JWT_SECRET=long-random-secret
TELEGRAM_BOT_TOKEN=123456789:token-from-botfather
TELEGRAM_AUTH_MAX_AGE_SECONDS=86400
CORS_ALLOWED_ORIGINS=https://miniapp.example.com
```

Токен бота нельзя добавлять в React env, JavaScript bundle или git.

## Настройка в BotFather

1. Создайте бота или выберите существующего через `/mybots`.
2. Откройте `Bot Settings > Configure Mini App > Enable Mini App`.
3. Укажите публичный HTTPS URL собранного React-приложения.
4. Настройте Main Mini App, чтобы в профиле появилась кнопка запуска.
5. При необходимости задайте Menu Button командой `/setmenubutton`.

Главное Mini App открывается ссылкой:

```text
https://t.me/<bot_username>?startapp
```

Параметр запуска можно передать так:

```text
https://t.me/<bot_username>?startapp=campaign_1
```

## Проверка на телефоне

Для локальной разработки поднимите Vite и API, затем опубликуйте их через HTTPS
туннель. URL фронтенда укажите в BotFather, URL API укажите в
`VITE_API_BASE_URL`, а origin фронтенда добавьте в `CORS_ALLOWED_ORIGINS`.

Отладка WebView включается в настройках Telegram согласно официальной
документации Mini Apps.
