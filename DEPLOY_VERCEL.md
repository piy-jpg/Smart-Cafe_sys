# SmartCafe on Vercel

## What changed

- Frontend is built from `frontend/`
- API is exposed through `api/index.js`
- The backend now supports:
  - local `sqlite` for development
  - hosted `mysql`/`mariadb` through `DATABASE_URL` for Vercel
- Realtime sockets are disabled by default on non-local deployments
- Local JSON writes use `/tmp` on Vercel so the app does not fail on a read-only filesystem

## Recommended production setup

Use a hosted MySQL-compatible database for Vercel.

Examples:

- PlanetScale
- Railway MySQL
- Aiven MySQL
- Any managed MySQL/MariaDB URL

## Required Vercel environment variables

- `DATABASE_URL`
  Example: `mysql://USER:PASSWORD@HOST:3306/DATABASE`
- `DB_DIALECT`
  Value: `mysql`
- `JWT_SECRET`
  Use a strong random string

## Optional environment variables

- `DB_SSL`
  Set to `true` if your managed database requires SSL
- `VITE_API_BASE_URL`
  Leave empty when frontend and API are deployed in the same Vercel project
- `VITE_ENABLE_REALTIME`
  Set `true` only if you move realtime to a socket-capable host
- `PUBLIC_ORDER_APP_URL`
  Public base URL used for QR links if you want to force a specific customer app URL
- `PUBLIC_RESTAURANT_CODE`
  Defaults to `smartcafe_main`
- `DATA_DIR`
  Optional writable folder override for auth activity and owner control JSON

## Important Vercel note

This project will deploy and run on Vercel, but native Socket.IO realtime is not recommended on Vercel serverless functions.

Because of that:

- the frontend now falls back to polling-style refresh behavior in production
- kitchen/manager/public flows still work, but websocket-style realtime should be hosted separately if you need true live sockets at scale

## Deploy steps

1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. Keep the project root as the repository root.
4. Add the environment variables above.
5. Deploy.

## Local development

Local development still uses SQLite by default and keeps realtime sockets enabled.
