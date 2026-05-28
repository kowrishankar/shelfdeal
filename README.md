# Shelf Deal

Mobile-friendly UK retailer price comparison for independent shops, corner stores, and convenience retailers.

## Features

### Price comparison
- **Search any product** — discovers listings across Tesco, ASDA, Booker, Amazon, Costco, and Sainsbury's
- **Progressive results** — prices stream in as each retailer responds; full comparison when all fetches finish
- **Neon Postgres** — products, retailer URLs, and price history saved for faster repeat searches
- **Tesco Clubcard** — regular vs Clubcard price
- **Booker wholesale** — trade ex-VAT and inc-VAT
- **Barcode search** — enter 8–14 digit EAN (e.g. `5000299212936`)

### AI Product Intelligence (`/intelligence`)
- **Opportunity score** (0–100) — weighted popularity, margin, risk, sell speed, trend
- **Deterministic scoring** from real signals: search volume, price history, retailer coverage, Booker wholesale vs retail margin, category heuristics
- **OpenAI summaries** (optional) — structured JSON narrative when `OPENAI_API_KEY` is set; template fallback otherwise
- **pgvector** — similar product recommendations
- Dashboard: trending, low-risk, high-margin sections · filters & sorting

## Setup

1. Copy environment file and add your [Neon](https://neon.tech) connection string:

```bash
cp .env.example .env.local
```

2. Apply schema in the [Neon SQL editor](https://console.neon.tech):

```bash
# New database: run all of db/schema.sql, then db/schema-auth.sql
# Existing database: also run db/migrate-production.sql (adds category + pgvector)
```

3. Install and run:

```bash
npm install
npm run dev
```

4. Optional — seed the Chivas example and compute intelligence:

```bash
npm run db:seed
npm run db:intelligence
```

5. Optional — enable AI-written summaries:

```bash
# In .env.local
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

6. Optional — **Amazon live prices in production** (recommended on Vercel):

Amazon blocks datacenter HTML scraping, so product pages often show “Price hidden” without the Creators API.

```bash
# In .env.local / Vercel env — from Associates Central → Tools → Creators API
AMAZON_CREATORS_CREDENTIAL_ID=...
AMAZON_CREATORS_CREDENTIAL_SECRET=...
AMAZON_CREATORS_VERSION=2.2          # EU/UK
AMAZON_PARTNER_TAG=yourstore-21
AMAZON_MARKETPLACE=www.amazon.co.uk
```

Requires an [Amazon Associates](https://affiliate-program.amazon.co.uk) account approved for the Creators API (typically 10 qualifying sales in the last 30 days). Verify after deploy: `/api/debug/amazon-price`.

Open [http://localhost:3000](http://localhost:3000).

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/search?q=` | DB lookup + suggest new discovery |
| `GET /api/compare/stream?q=&productId=` | SSE stream of prices (`listing`, `done` events) |
| `GET /api/intelligence` | Intelligence dashboard (filters: `q`, `sort`, `section`) |
| `GET /api/intelligence/[id]?detailed=1` | Full product intel + similar products + buying advice |

## Architecture

```
Search → DB cache hit? → stream cached prices → refresh live in parallel
       → miss? → discover on 6 retailers → save product + URLs → stream live prices
```

Price snapshots are stored in `price_snapshots` for history (ready for alerts UI).

## Limitations

- Some retailers block bots (Sainsbury's; Amazon on Vercel without Creators API credentials)
- ASDA uses Algolia catalogue API (not HTML scrape)
- Booker requires a trade account at checkout
- Always confirm prices on the retailer site before ordering
