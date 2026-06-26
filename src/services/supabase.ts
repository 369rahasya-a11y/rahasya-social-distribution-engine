/**
 * Supabase service — all database interactions for the distribution engine.
 * Handles asset fetching, locking, idempotency, and log writes.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env, RETRY_CONFIG } from "../config/env";
import {
  SocialAsset,
  SocialPostLog,
  SocialPostLogInsert,
  SocialQueueItem,
  SocialQueueItemInsert,
  Platform,
  PostStatus,
} from "../types/socialAsset";
import { logger } from "../utils/logger";

// ── Singleton Supabase client ─────────────────────────────────────────────

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return _client;
}

// ── Asset Fetching ────────────────────────────────────────────────────────

/**
 * Fetch assets that need publishing on at least one platform.
 * Excludes assets currently being processed (locked).
 * Excludes assets with stale locks (older than lockTimeoutMs).
 */
export async function fetchUnpublishedAssets(
  limit = 10
): Promise<SocialAsset[]> {
  const db = getSupabaseClient();

  const staleLockThreshold = new Date(
    Date.now() - RETRY_CONFIG.lockTimeoutMs
  ).toISOString();

  const { data, error } = await db
    .from("social_assets")
    .select("*")
    .or(
      "facebook_published.eq.false,instagram_published.eq.false,threads_published.eq.false"
    )
    .or(
      `processing.eq.false,processing_started_at.lt.${staleLockThreshold},processing_started_at.is.null`
    )
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch unpublished assets: ${error.message}`);
  }

  return (data as SocialAsset[]) || [];
}

/**
 * Fetch up to `limit` assets not yet published to a specific platform.
 * Facebook, Instagram, and Threads each get their own independent queue
 * of unpublished assets — publishing on one platform does not consume
 * slots for another.
 */
export async function fetchUnpublishedAssetsForPlatform(
  platform: Platform,
  limit = 10
): Promise<SocialAsset[]> {
  const db = getSupabaseClient();

  const staleLockThreshold = new Date(
    Date.now() - RETRY_CONFIG.lockTimeoutMs
  ).toISOString();

  const { data, error } = await db
    .from("social_assets")
    .select("*")
    .eq(`${platform}_published`, false)
    .or(
      `processing.eq.false,processing_started_at.lt.${staleLockThreshold},processing_started_at.is.null`
    )
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to fetch unpublished assets for ${platform}: ${error.message}`
    );
  }

  return (data as SocialAsset[]) || [];
}

/**
 * Fetch a single asset by ID.
 */
export async function fetchAssetById(id: number): Promise<SocialAsset | null> {
  const db = getSupabaseClient();

  const { data, error } = await db
    .from("social_assets")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw new Error(`Failed to fetch asset ${id}: ${error.message}`);
  }

  return data as SocialAsset;
}

// ── Asset Locking ─────────────────────────────────────────────────────────

/**
 * Acquire a processing lock on an asset.
 * Returns true if the lock was acquired, false if another process beat us.
 */
export async function lockAsset(assetId: number): Promise<boolean> {
  const db = getSupabaseClient();

  const staleLockThreshold = new Date(
    Date.now() - RETRY_CONFIG.lockTimeoutMs
  ).toISOString();

  // Atomic lock: only update if not currently locked (or lock is stale)
  const { data, error } = await db
    .from("social_assets")
    .update({
      processing: true,
      processing_started_at: new Date().toISOString(),
    })
    .eq("id", assetId)
    .or(
      `processing.eq.false,processing_started_at.lt.${staleLockThreshold},processing_started_at.is.null`
    )
    .select("id");

  if (error) {
    logger.error("Failed to acquire asset lock", {
      assetId,
      error: error.message,
    });
    return false;
  }

  const acquired = (data && data.length > 0) ?? false;
  if (!acquired) {
    logger.warn("Asset lock already held by another process", { assetId });
  }
  return acquired;
}

/**
 * Release the processing lock on an asset.
 */
export async function unlockAsset(assetId: number): Promise<void> {
  const db = getSupabaseClient();

  const { error } = await db
    .from("social_assets")
    .update({ processing: false, processing_started_at: null })
    .eq("id", assetId);

  if (error) {
    logger.error("Failed to release asset lock", {
      assetId,
      error: error.message,
    });
  }
}

// ── Platform Flag Updates ─────────────────────────────────────────────────

/**
 * Mark a platform as successfully published on a social asset.
 */
export async function markPlatformPublished(
  assetId: number,
  platform: Platform
): Promise<void> {
  const db = getSupabaseClient();

  const update: Record<string, unknown> = {
    [`${platform}_published`]: true,
    [`${platform}_published_at`]: new Date().toISOString(),
  };

  const { error } = await db
    .from("social_assets")
    .update(update)
    .eq("id", assetId);

  if (error) {
    throw new Error(
      `Failed to mark ${platform} published for asset ${assetId}: ${error.message}`
    );
  }
}

// ── Idempotency Check ─────────────────────────────────────────────────────

/**
 * Check if an asset has already been published to a platform.
 * Checks both the platform flag AND the post logs for double safety.
 */
export async function isAlreadyPublished(
  assetId: number,
  platform: Platform
): Promise<boolean> {
  const db = getSupabaseClient();

  // Check the asset flag first (fast)
  const { data: asset, error: assetError } = await db
    .from("social_assets")
    .select(`${platform}_published`)
    .eq("id", assetId)
    .single();

  if (assetError) {
    logger.warn("Could not check asset publish flag", {
      assetId,
      platform,
      error: assetError.message,
    });
    return false;
  }

  const flagKey = `${platform}_published` as keyof typeof asset;
  if (asset && asset[flagKey] === true) {
    return true;
  }

  // Double-check the post logs
  const { data: log, error: logError } = await db
    .from("social_post_logs")
    .select("id")
    .eq("asset_id", assetId)
    .eq("platform", platform)
    .eq("status", "success")
    .limit(1);

  if (logError) {
    logger.warn("Could not check post logs", {
      assetId,
      platform,
      error: logError.message,
    });
    return false;
  }

  return (log && log.length > 0) ?? false;
}

// ── Post Log ──────────────────────────────────────────────────────────────

/**
 * Write an entry to the social_post_logs table.
 */
export async function writePostLog(
  entry: SocialPostLogInsert
): Promise<SocialPostLog | null> {
  const db = getSupabaseClient();

  const { data, error } = await db
    .from("social_post_logs")
    .insert(entry)
    .select()
    .single();

  if (error) {
    logger.error("Failed to write post log", {
      assetId: entry.asset_id,
      platform: entry.platform,
      error: error.message,
    });
    return null;
  }

  return data as SocialPostLog;
}

/**
 * Fetch recent post logs for the daily report.
 */
export async function fetchRecentPostLogs(
  sinceHours = 25
): Promise<SocialPostLog[]> {
  const db = getSupabaseClient();
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("social_post_logs")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch post logs: ${error.message}`);
  }

  return (data as SocialPostLog[]) || [];
}

// ── Queue Management ──────────────────────────────────────────────────────

/**
 * Add an item to the retry queue.
 */
export async function enqueueRetry(
  item: SocialQueueItemInsert
): Promise<void> {
  const db = getSupabaseClient();

  const { error } = await db.from("social_queue").insert(item);

  if (error) {
    logger.error("Failed to enqueue retry", {
      assetId: item.asset_id,
      platform: item.platform,
      error: error.message,
    });
  }
}

/**
 * Fetch queue items ready for retry.
 */
export async function fetchRetryQueue(): Promise<SocialQueueItem[]> {
  const db = getSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from("social_queue")
    .select("*")
    .eq("status", "pending")
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    throw new Error(`Failed to fetch retry queue: ${error.message}`);
  }

  return (data as SocialQueueItem[]) || [];
}

/**
 * Update a queue item's status.
 */
export async function updateQueueItem(
  id: number,
  status: "processing" | "completed" | "failed",
  nextRetryAt?: string
): Promise<void> {
  const db = getSupabaseClient();

  const update: Record<string, unknown> = { status };
  if (nextRetryAt) update["next_retry_at"] = nextRetryAt;

  const { error } = await db
    .from("social_queue")
    .update(update)
    .eq("id", id);

  if (error) {
    logger.error("Failed to update queue item", { id, error: error.message });
  }
}

/**
 * Test Supabase connectivity. Returns true if healthy.
 */
export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const db = getSupabaseClient();
    const { error } = await db
      .from("social_assets")
      .select("id")
      .limit(1);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Write a failed publish attempt to logs and queue it for retry.
 */
export async function handlePublishFailure(
  assetId: number,
  platform: Platform,
  error: string,
  retryCount: number
): Promise<void> {
  const { RETRY_CONFIG: rc } = await import("../config/env");

  // Write to post log
  const status: PostStatus = "failed";
  await writePostLog({
    asset_id: assetId,
    platform,
    status,
    post_id: null,
    post_url: null,
    published_at: null,
    error_message: error,
    retry_count: retryCount,
  });

  // Queue for retry if not exhausted
  if (retryCount < rc.maxAttempts - 1) {
    const nextDelayMs = rc.delays[retryCount + 1] || 0;
    const nextRetryAt = nextDelayMs > 0
      ? new Date(Date.now() + nextDelayMs).toISOString()
      : null;

    await enqueueRetry({
      asset_id: assetId,
      platform,
      status: "pending",
      retry_count: retryCount + 1,
      next_retry_at: nextRetryAt,
    });

    logger.info(`⏳ Queued for retry (attempt ${retryCount + 1})`, {
      assetId,
      platform,
      nextRetryAt,
    });
  } else {
    logger.error(`🚫 Max retries exhausted for asset`, { assetId, platform });
  }
}
