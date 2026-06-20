/**
 * publishAsset command — manually publish a single asset by ID.
 * Run with: npm run publish:asset -- --id=123
 *
 * Useful for testing, debugging, and ad-hoc publishing.
 */

import { fetchAssetById } from "../services/supabase";
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

const PLATFORMS: Platform[] = ["facebook", "instagram", "threads"];

/**
 * Parse --id=123 from command line args.
 */
function parseAssetId(): number | null {
  const args = process.argv.slice(2);
  for (const arg of args) {
    const match = arg.match(/^--id=(\d+)$/);
    if (match) return parseInt(match[1], 10);
    // Also support: -- 123
    if (/^\d+$/.test(arg)) return parseInt(arg, 10);
  }
  return null;
}

/**
 * Parse --platform=facebook from command line args.
 */
function parsePlatform(): Platform | null {
  const args = process.argv.slice(2);
  for (const arg of args) {
    const match = arg.match(/^--platform=(\w+)$/);
    if (match) {
      const p = match[1] as Platform;
      if (PLATFORMS.includes(p)) return p;
    }
  }
  return null;
}

async function run(): Promise<void> {
  const assetId = parseAssetId();

  if (!assetId) {
    logger.error(
      "Usage: npm run publish:asset -- --id=<asset_id> [--platform=<facebook|instagram|threads>]"
    );
    process.exit(1);
  }

  const targetPlatform = parsePlatform();
  const platforms = targetPlatform ? [targetPlatform] : PLATFORMS;

  logger.info(`🎯 Manual publish: Asset ${assetId} → ${platforms.join(", ")}`);

  const asset = await fetchAssetById(assetId);
  if (!asset) {
    logger.error(`Asset ${assetId} not found in database`);
    process.exit(1);
  }

  logger.info(`Found asset: ${asset.sign} | ${asset.horoscope_date} | mood: ${asset.mood}`);

  let succeeded = 0;
  let failed = 0;

  for (const platform of platforms) {
    const publisher = publishers[platform];
    const result = await publisher.publish(asset);

    if (result.success) {
      succeeded++;
      logger.info(`✅ ${platform}: ${result.postUrl || result.postId}`);
    } else if (result.skipped) {
      logger.info(`⏭️  ${platform}: ${result.skipReason}`);
    } else {
      failed++;
      logger.error(`❌ ${platform}: ${result.error}`);
    }
  }

  logger.info(`\nDone: ${succeeded} published, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  logger.error("Fatal error in publish:asset", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
