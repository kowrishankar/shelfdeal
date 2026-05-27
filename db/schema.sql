CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  canonical_name TEXT NOT NULL,
  barcode TEXT,
  image_url TEXT,
  category TEXT,
  source_query TEXT NOT NULL,
  search_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON products USING gin (canonical_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_barcode_idx ON products (barcode) WHERE barcode IS NOT NULL;

CREATE TABLE IF NOT EXISTS retailer_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  retailer_id TEXT NOT NULL,
  url TEXT NOT NULL,
  retailer_product_name TEXT,
  image_url TEXT,
  last_sort_price NUMERIC(10, 2),
  last_prices JSONB,
  last_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, retailer_id)
);

CREATE INDEX IF NOT EXISTS retailer_listings_product_idx ON retailer_listings (product_id);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES retailer_listings (id) ON DELETE CASCADE,
  sort_price NUMERIC(10, 2) NOT NULL,
  prices JSONB NOT NULL,
  in_stock BOOLEAN NOT NULL DEFAULT true,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_snapshots_listing_fetched_idx ON price_snapshots (listing_id, fetched_at DESC);

-- Product intelligence (see src/lib/intelligence/)
CREATE TABLE IF NOT EXISTS market_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  signal_key TEXT NOT NULL,
  signal_value NUMERIC,
  signal_text TEXT,
  metadata JSONB DEFAULT '{}',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, signal_key)
);

CREATE TABLE IF NOT EXISTS product_intelligence (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  popularity_score INT NOT NULL CHECK (popularity_score BETWEEN 0 AND 100),
  sell_speed TEXT NOT NULL,
  estimated_turnover TEXT NOT NULL,
  confidence_score NUMERIC(4, 3) NOT NULL,
  risk_level TEXT NOT NULL,
  profit_potential TEXT NOT NULL,
  trend_direction TEXT NOT NULL,
  buyer_types JSONB NOT NULL DEFAULT '[]',
  seasonality TEXT NOT NULL,
  summary TEXT NOT NULL,
  wholesale_cost NUMERIC(10, 2),
  estimated_resale NUMERIC(10, 2),
  margin_percent NUMERIC(5, 2),
  opportunity_score INT NOT NULL CHECK (opportunity_score BETWEEN 0 AND 100),
  signals_snapshot JSONB NOT NULL DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS product_embeddings (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  embedding vector(1536),
  model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_normalized TEXT NOT NULL UNIQUE,
  product_id UUID REFERENCES products (id) ON DELETE SET NULL,
  hit_count INT NOT NULL DEFAULT 1,
  last_searched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
