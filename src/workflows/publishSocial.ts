/**
 * publishSocial workflow — the main daily publishing pipeline.
 *
 * Fetches unpublished assets from Supabase, acquires locks,
 * and publishes to Facebook, Instagram, and Threads in sequence.
 *
 * Called by GitHub Actions on schedule and via workflow_dispatch.
 */

import { fetchUnpublishedAssetsForPlatform, lockAsset, unlockAsset } from "../services/supabase";
import { FacebookPublisher } from "../publishers/FacebookPublisher";
import { InstagramPublisher } from "../publishers/InstagramPublisher";
import { ThreadsPublisher } from "../publishers/ThreadsPublisher";
import { PublishResult, SocialAsset, Platform } from "../types/socialAsset";
import { logger } from "../utils/logger";
import { sleep } from "../utils/retry";
import { RATE_LIMITS } from "../config/env";

// ── Publisher registry ────────────────────────────────────────────────────

const publishers = {
  facebook: new FacebookPublisher(),
  instagram: new InstagramPublisher(),
  threads: new ThreadsPublisher(),
};

const PLATFORMS: Platform[] = ["facebook", "instagram", "threads"];

// ── Workflow ──────────────────────────────────────────────────────────────

interface WorkflowSummary {
  assetsProcessed: number;
  results: PublishResult[];
  errors: string[];
  durationMs: number;
}

/**
 * Main publish workflow.
 * Each platform independently fetches its own batch of up to `batchSize`
 * unpublished assets, so Facebook, Instagram, and Threads each always see
 * their own 10 items regardless of what has been published on the others.
 */
export async function runPublishWorkflow(
  batchSize = 10
): Promise<WorkflowSummary> {
  const startTime = Date.now();

  logger.info("🚀 Starting Rahasya Social Distribution Engine");
  logger.info(`📋 Fetching up to ${batchSize} unpublished assets per platform...`);

  const allResults: PublishResult[] = [];
  const errors: string[] = [];
  let totalAssetsProcessed = 0;

  for (const platform of PLATFORMS) {
    logger.info(`\n📱 Platform: ${platform.toUpperCase()}`);

    const platformBatchSize =
  platform === "instagram" ? 1 : batchSize;

const assets = await fetchUnpublishedAssetsForPlatform(
  platform,
  platformBatchSize
);

    if (assets.length === 0) {
      logger.info(`✨ No unpublished assets for ${platform}. All caught up!`);
      continue;
    }

    logger.info(`📦 Found ${assets.length} asset(s) to process for ${platform}`);
    totalAssetsProcessed += assets.length;

    for (const asset of assets) {
      const assetResults = await processAsset(asset, platform);
      allResults.push(...assetResults);

      // Collect errors
      for (const r of assetResults) {
        if (!r.success && !r.skipped && r.error) {
          errors.push(`Asset ${r.assetId} on ${r.platform}: ${r.error}`);
        }
      }

      // Rate limit: pause between assets
      if (assets.indexOf(asset) < assets.length - 1) {
        await sleep(RATE_LIMITS.delayBetweenAssetsMs);
      }
    }

    // Rate limit: pause between platforms
    if (PLATFORMS.indexOf(platform) < PLATFORMS.length - 1) {
      await sleep(RATE_LIMITS.delayBetweenPlatformsMs);
    }
  }

  const summary: WorkflowSummary = {
    assetsProcessed: totalAssetsProcessed,
    results: allResults,
    errors,
    durationMs: Date.now() - startTime,
  };

  logWorkflowSummary(summary);

  return summary;
}

/**
 * Process a single asset for a single platform.
 */
async function processAsset(asset: SocialAsset, platform: Platform): Promise<PublishResult[]> {
  const { id: assetId } = asset;
  const results: PublishResult[] = [];

  logger.info(`\n📝 Processing asset ${assetId} (${asset.sign} - ${asset.horoscope_date})`);

  // Acquire lock
  const locked = await lockAsset(assetId);
  if (!locked) {
    logger.warn(`⏭️  Skipping asset ${assetId} — locked by another process`);
    return [];
  }

  try {
    const publisher = publishers[platform];
    const result = await publisher.publish(asset);
    results.push(result);
  } finally {
    // Always release the lock, even on error
    await unlockAsset(assetId);
  }

  return results;
}

/**
 * Log a human-readable workflow summary.
 */
function logWorkflowSummary(summary: WorkflowSummary): void {
  const { assetsProcessed, results, errors, durationMs } = summary;

  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success && !r.skipped);
  const skipped = results.filter((r) => r.skipped);

  logger.info("\n" + "═".repeat(60));
  logger.info("📊 WORKFLOW SUMMARY");
  logger.info("═".repeat(60));
  logger.info(`Assets processed: ${assetsProcessed}`);
  logger.info(`Published: ${successes.length} ✅`);
  logger.info(`Failed:    ${failures.length} ❌`);
  logger.info(`Skipped:   ${skipped.length} ⏭️`);
  logger.info(`Duration:  ${Math.round(durationMs / 1000)}s`);

  if (errors.length > 0) {
    logger.error("\n⚠️  Errors:");
    for (const err of errors) {
      logger.error(`  • ${err}`);
    }
  }

  logger.info("═".repeat(60));
}

// ── Entry point ───────────────────────────────────────────────────────────

if (require.main === module) {
  runPublishWorkflow()
    .then((summary) => {
      const hasErrors = summary.errors.length > 0;
      process.exit(hasErrors ? 1 : 0);
    })
    .catch((err) => {
      logger.error("❌ Fatal workflow error", {
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    });
}
