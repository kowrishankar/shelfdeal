-- Run this in the Neon SQL editor if the database was created before May 2026.
-- Fixes 500 errors on /api/intelligence/* (missing column + pgvector).

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
