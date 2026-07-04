# Yaser Mall Stock

Internal inventory audit system for Yaser Mall.

## Setup

1. Copy `.env.example` to `.env` and set PostgreSQL `DATABASE_URL`.
2. Run `pnpm install`.
3. Run `pnpm db:migrate`.
4. Run `pnpm db:seed`.
5. Start with `pnpm dev`.

Seeded users use password `YaserMall@2026`:

- `admin@yasermall.local`
- `supervisor@yasermall.local`
- `employee@yasermall.local`

## Scraper

Run `pnpm scrape`. It starts at `https://yasermallonline.com/en/home`, discovers categories, visits product pages, extracts names, price, image, brand, category, and URL, then upserts products by `productUrl`.
