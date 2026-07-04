# Run Yaser Mall Stock locally

The app will not open at http://localhost:3000 until dependencies are installed and the dev server is running.

## 1. Open this folder

`C:\Users\ADMIN\Documents\Codex\2026-07-01\you-are-a-senior-full-stack\outputs\yaser-mall-stock`

## 2. Install dependencies

`pnpm install`

If pnpm is not installed, run:

`npm install -g pnpm`

## 3. Start PostgreSQL

If you use Docker Desktop:

`docker compose up -d`

Otherwise, make sure PostgreSQL is running with this database URL in `.env`:

`postgresql://postgres:postgres@localhost:5432/yaser_mall_stock?schema=public`

## 4. Prepare database

`pnpm db:migrate`
`pnpm db:seed`

## 5. Start app

`pnpm dev`

Then open http://localhost:3000.

Login password for seeded users: `YaserMall@2026`.
