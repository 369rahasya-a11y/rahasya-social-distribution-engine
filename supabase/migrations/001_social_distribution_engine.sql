-- =============================================================
-- Rahasya Social Distribution Engine — Database Migration
-- Run this once in your Supabase SQL Editor
-- =============================================================

-- ─── 1. Add locking columns to existing social_assets table ──────────────

ALTER TABLE social_assets
  ADD COLUMN IF NOT EXISTS processing        BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

-- Index for efficient lock queries
CREATE INDEX IF NOT EXISTS idx_social_assets_processing
  ON social_assets (processing, processing_started_at);

-- Index for unpublished asset queries  
CREATE INDEX IF NOT EXISTS idx_social_assets_unpublished
  ON social_assets (facebook_published, instagram_published, threads_published, created_at);

-- ─── 2. Create social_post_logs table ────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_post_logs (
  id              BIGSERIAL     PRIMARY KEY,
  asset_id        BIGINT        NOT NULL REFERENCES social_assets(id) ON DELETE CASCADE,
  platform        TEXT          NOT NULL CHECK (platform IN ('facebook', 'instagram', 'threads', 'pinterest', 'twitter')),
  status          TEXT          NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  post_id         TEXT,
  post_url        TEXT,
  published_at    TIMESTAMPTZ,
  error_message   TEXT,
  retry_count     INTEGER       NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes for analytics and idempotency checks
CREATE INDEX IF NOT EXISTS idx_post_logs_asset_platform
  ON social_post_logs (asset_id, platform, status);

CREATE INDEX IF NOT EXISTS idx_post_logs_created_at
  ON social_post_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_logs_platform_status
  ON social_post_logs (platform, status, created_at DESC);

-- ─── 3. Create social_queue table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_queue (
  id              BIGSERIAL     PRIMARY KEY,
  asset_id        BIGINT        NOT NULL REFERENCES social_assets(id) ON DELETE CASCADE,
  platform        TEXT          NOT NULL CHECK (platform IN ('facebook', 'instagram', 'threads', 'pinterest', 'twitter')),
  status          TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count     INTEGER       NOT NULL DEFAULT 0,
  next_retry_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_social_queue_status_retry
  ON social_queue (status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_social_queue_asset_platform
  ON social_queue (asset_id, platform);

-- ─── 4. Row Level Security ────────────────────────────────────────────────
-- The service role key bypasses RLS, so we enable it for safety
-- but the engine uses the service role key which bypasses these policies.

ALTER TABLE social_post_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_queue ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by the engine)
CREATE POLICY "Service role full access to post_logs"
  ON social_post_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to queue"
  ON social_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 5. Verification query ────────────────────────────────────────────────
-- Run this after migration to verify everything was created:
-- SELECT table_name FROM information_schema.tables 
--   WHERE table_schema = 'public' 
--   ORDER BY table_name;
