/**
 * backfill command — publishes all historical unpublished assets.
 * Run with: npm run backfill
 *
 * Processes assets in chronological order with rate limiting.
 * Safe to interrupt and rerun (idempotent).
 */

import { fetchUnpublishedAssets } from "../services/supabase.js";
import { runPublishWorkflow } from "../workflows/publishSocial.js";
import { logger } from "../utils/logger.js";

const BACKFILL_BATCH_SIZE = 5; // Process 5 assets at a time
const BATCH_DELAY_MS = 10000; // 10 second delay between batches

async function runBackfill(): Promise<void> {
  logger.info("📦 Starting backfill of historical unpublished assets...");
  logger.info("⚠️  This will publish ALL unpublished assets. Rate limits apply.");
  logger.info("    Safe to interrupt — progress is saved after each asset.\n");

  let totalProcessed = 0;
  let batchNumber = 0;

  // Keep fetching and processing batches until nothing left
  while (true) {
    batchNumber++;
    logger.info(`\n📦 Batch ${batchNumber} (${BACKFILL_BATCH_SIZE} assets)...`);

    // Check if there's anything left
    const remaining = await fetchUnpublishedAssets(1);
    if (remaining.length === 0) {
      logger.info("✅ No more unpublished assets. Backfill complete!");
      break;
    }

    // Process one batch
    const summary = await runPublishWorkflow(BACKFILL_BATCH_SIZE);
    totalProcessed += summary.assetsProcessed;

    if (summary.assetsProcessed === 0) {
      // Safety: if workflow returned 0 but we saw remaining, something's wrong
      logger.warn("Workflow processed 0 assets despite having pending items. Stopping.");
      break;
    }

    // Delay between batches to respect rate limits
    logger.info(`⏱️  Waiting ${BATCH_DELAY_MS / 1000}s before next batch...`);
    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  logger.info(`\n🎉 Backfill complete. Total assets processed: ${totalProcessed}`);
}

runBackfill()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error("Backfill failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });
