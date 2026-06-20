/**
 * retryFailed workflow — processes the retry queue for failed publishes.
 *
 * Implements the retry schedule:
 *   Attempt 1: Immediate
 *   Attempt 2: 15 minutes
 *   Attempt 3: 1 hour
 *   Attempt 4: 6 hours
 */

import { fetchRetryQueue, updateQueueItem, fetchAssetById } from "../services/supabase";
import { FacebookPublisher } from "../publishers/FacebookPublisher";
import { InstagramPublisher } from "../publishers/InstagramPublisher";
import { ThreadsPublisher } from "../publishers/ThreadsPublisher";
import { Platform } from "../types/socialAsset";
import { logger } from "../utils/logger";

const publishers = {
  facebook: new FacebookPublisher(),
  instagram: new InstagramPublisher(),
  threads: new ThreadsPublisher(),
};

/**
 * Process all items in the retry queue that are due for retry.
 */
export async function runRetryWorkflow(): Promise<void> {
  logger.info("🔄 Running retry workflow...");

  const queueItems = await fetchRetryQueue();

  if (queueItems.length === 0) {
    logger.info("✅ Retry queue is empty");
    return;
  }

  logger.info(`📋 Found ${queueItems.length} item(s) in retry queue`);

  let retried = 0;
  let succeeded = 0;
  let failed = 0;

  for (const item of queueItems) {
    const { id, asset_id, platform, retry_count } = item;

    // Mark as processing
    await updateQueueItem(id, "processing");

    // Fetch the asset
    const asset = await fetchAssetById(asset_id);
    if (!asset) {
      logger.warn(`Queue item ${id}: Asset ${asset_id} not found, removing from queue`);
      await updateQueueItem(id, "failed");
      continue;
    }

    // Get the publisher
    const publisher = publishers[platform as Platform];
    if (!publisher) {
      logger.warn(`Queue item ${id}: Unknown platform ${platform}`);
      await updateQueueItem(id, "failed");
      continue;
    }

    // Retry
    retried++;
    logger.info(`🔄 Retrying ${platform} for asset ${asset_id} (attempt ${retry_count + 1})`);

    const result = await publisher.retry(asset, retry_count);

    if (result.success) {
      succeeded++;
      await updateQueueItem(id, "completed");
      logger.info(`✅ Retry succeeded: ${platform} for asset ${asset_id}`);
    } else if (result.skipped) {
      // Already published — treat as success
      await updateQueueItem(id, "completed");
    } else {
      failed++;
      await updateQueueItem(id, "failed");
      logger.error(`❌ Retry failed: ${platform} for asset ${asset_id}`);
    }
  }

  logger.info(`\n🔄 Retry summary: ${retried} retried, ${succeeded} succeeded, ${failed} failed`);
}

// ── Entry point ───────────────────────────────────────────────────────────

if (require.main === module) {
  runRetryWorkflow()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("❌ Fatal retry workflow error", {
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    });
}
