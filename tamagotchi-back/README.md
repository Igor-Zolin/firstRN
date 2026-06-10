# Tamagotchi Backend

Express API for the mobile client and Telegram Mini App. PostgreSQL is the only runtime database. The old `db.sqlite` is used only as a source for the one-time migration script.

## Architecture

```text
Expo app / Telegram Mini App
            |
          HTTPS
            |
        Express API
            |
        PostgreSQL
```

Do not connect a mobile app or Mini App directly to PostgreSQL. `DATABASE_URL` and database credentials must exist only on the backend.

## Requirements

- Node.js 20+
- PostgreSQL 14+ or Docker

## Environment

Copy `.env.example` to `.env` and set at least:

```env
PORT=3000
JWT_SECRET=replace_with_a_long_random_secret
DATABASE_URL=postgresql://tamagotchi:tamagotchi@localhost:5432/tamagotchi
TELEGRAM_BOT_TOKEN=123456789:token-from-botfather
TELEGRAM_AUTH_MAX_AGE_SECONDS=86400
DATABASE_SSL=false
```

For a managed PostgreSQL provider, use its connection string. If it requires TLS:

```env
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=true
```

Use `DATABASE_SSL_REJECT_UNAUTHORIZED=false` only when the provider explicitly requires it.

## Local start

Start PostgreSQL with Docker:

```bash
docker compose up -d postgres
```

Install dependencies and initialize the schema:

```bash
npm ci
npm run db:init
```

Start the API:

```bash
npm run dev
```

The server initializes missing tables and indexes before accepting requests.

## Migrate existing SQLite data

The repository currently has a local `db.sqlite`. The migration preserves IDs, relationships, TON columns, market listings and serial sequences.

Validate the SQLite source without connecting to PostgreSQL:

```bash
npm run db:migrate:sqlite -- --dry-run
```

Run against an empty PostgreSQL database:

```bash
npm run db:migrate:sqlite
```

Use another source file:

```bash
npm run db:migrate:sqlite -- --source=C:\path\to\db.sqlite
```

The script refuses to write into a non-empty PostgreSQL database. To deliberately replace all destination data:

```bash
npm run db:migrate:sqlite -- --truncate
```

`--truncate` deletes all existing PostgreSQL application data before importing.

## Import item assets

To add PNG files from `public/items` without creating duplicate `model_name` values:

```bash
npm run db:import-items
```

## Commands

- `npm start` - start the API
- `npm run dev` - start with nodemon
- `npm test` - run backend unit tests
- `npm run db:init` - create missing PostgreSQL tables and indexes
- `npm run db:migrate:sqlite` - migrate the old SQLite data
- `npm run db:import-items` - import item metadata from PNG files

## Production notes

- Use a managed PostgreSQL instance with backups and TLS.
- Set `NODE_ENV=production` and a strong `JWT_SECRET`.
- Set `CORS_ALLOWED_ORIGINS` to the deployed Mini App and web origins.
- Keep dev routes disabled in production.
- Run the API behind HTTPS.
- Keep `TELEGRAM_BOT_TOKEN` only on the backend and rotate it if it is exposed.

## Main API groups

- `/api/auth/*` - registration, login, current user
- `/api/stats/*` and `/api/actions/*` - game state and upgrades
- `/api/shop/*` - item catalog and purchases
- `/api/market/*` - player marketplace
- `/api/inventory/*` and `/api/equip/*` - inventory and equipped items
- `/api/snapshot/*` - aggregated client snapshots
- `/api/heartbeat` - API and database readiness

`POST /api/auth/telegram` accepts raw Telegram `initData`, validates its HMAC
signature and age, creates or updates the linked user, then returns the same JWT
used by the rest of the API.
