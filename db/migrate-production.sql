-- Run this in the Neon SQL editor if the database was created before May 2026.
-- Fixes 500 errors on /api/intelligence/* (missing column + pgvector).

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL UNIQUE,
  aliases JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, normalized_name)
);

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES product_families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  flavor TEXT,
  sugar_free BOOLEAN,
  size_ml INT,
  size_unit TEXT NOT NULL DEFAULT 'ml',
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fingerprint)
);

CREATE TABLE IF NOT EXISTS pack_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  pack_count INT NOT NULL DEFAULT 1,
  is_multipack BOOLEAN NOT NULL DEFAULT false,
  unit_type TEXT NOT NULL DEFAULT 'unit',
  fingerprint TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listing_match_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES retailer_listings(id) ON DELETE CASCADE,
  pack_variant_id UUID NOT NULL REFERENCES pack_variants(id) ON DELETE CASCADE,
  confidence_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  confidence_label TEXT NOT NULL DEFAULT 'low',
  decision TEXT NOT NULL DEFAULT 'auto',
  reasons JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id)
);

CREATE INDEX IF NOT EXISTS product_families_brand_idx ON product_families (brand_id);
CREATE INDEX IF NOT EXISTS product_variants_family_idx ON product_variants (family_id);
CREATE INDEX IF NOT EXISTS pack_variants_variant_idx ON pack_variants (product_variant_id);
CREATE INDEX IF NOT EXISTS listing_match_links_pack_idx ON listing_match_links (pack_variant_id);
