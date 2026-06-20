/**
 * Analytics service — tracks publish events for future reporting.
 * Designed so analytics can be extended without touching publishers.
 */

import { Platform, PublishResult } from "../types/socialAsset";
import { writePostLog } from "./supabase";
import { logger } from "../utils/logger";

/**
 * Record a successful publish event.
 * Call this after every successful publish to enable future analytics.
 */
export async function trackPublishSuccess(
  result: PublishResult
): Promise<void> {
  if (!result.success || !result.postId) return;

  await writePostLog({
    asset_id: result.assetId,
    platform: result.platform,
    status: "success",
    post_id: result.postId,
    post_url: result.postUrl || null,
    published_at: new Date().toISOString(),
    error_message: null,
    retry_count: 0,
  });
}

/**
 * Record a failed publish event.
 */
export async function trackPublishFailure(
  assetId: number,
  platform: Platform,
  error: string,
  retryCount = 0
): Promise<void> {
  await writePostLog({
    asset_id: assetId,
    platform,
    status: "failed",
    post_id: null,
    post_url: null,
    published_at: null,
    error_message: error,
    retry_count: retryCount,
  });
}

/**
 * Record a skipped publish (already published, idempotency).
 */
export async function trackPublishSkip(
  assetId: number,
  platform: Platform,
  reason: string
): Promise<void> {
  logger.debug("Tracking skipped publish", { assetId, platform, reason });
  // Skips are logged to console only — no DB write to avoid log spam on reruns
}
