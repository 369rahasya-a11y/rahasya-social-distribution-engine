/**
 * dryRun command — validates assets and captions without publishing.
 * Run with: npm run dry-run
 *
 * Safe to run at any time. Makes no API calls, no DB writes (except reads).
 */

import { fetchUnpublishedAssets } from "../services/supabase.js";
import { validateImage } from "../utils/imageValidation.js";
import { generateCaption } from "../utils/captionGenerator.js";
import { validateAsset } from "../utils/validation.js";
import { logger } from "../utils/logger.js";
import { Platform, ZodiacSign } from "../types/socialAsset.js";

const PLATFORMS: Platform[] = ["facebook", "instagram", "threads"];

async function runDryRun(): Promise<void> {
  // Force dry-run mode
  process.env["DRY_RUN"] = "true";

  logger.info("🔍 DRY RUN MODE — No posts will be published\n");

  const assets = await fetchUnpublishedAssets(20);

  if (assets.length === 0) {
    logger.info("No unpublished assets found.");
    return;
  }

  logger.info(`Found ${assets.length} unpublished asset(s)\n`);

  let validAssets = 0;
  let invalidAssets = 0;

  for (const asset of assets) {
    logger.info(`\n${"─".repeat(50)}`);
    logger.info(`Asset ${asset.id} | ${asset.sign} | ${asset.horoscope_date}`);
    logger.info(`Mood: ${asset.mood}`);
    logger.info(`Image: ${asset.image_url}`);

    // Asset validation
    const { valid, errors } = validateAsset(asset);
    if (!valid) {
      logger.error(`  ❌ Asset invalid: ${errors.join(", ")}`);
      invalidAssets++;
      continue;
    }

    // Image validation
    logger.info("  🖼️  Validating image...");
    const imgResult = await validateImage(asset.image_url);
    if (!imgResult.valid) {
      logger.error(`  ❌ Image invalid: ${imgResult.error}`);
      invalidAssets++;
      continue;
    }
    logger.info(
      `  ✅ Image OK (${imgResult.contentType || "unknown type"}, ${
        imgResult.sizeBytes
          ? Math.round(imgResult.sizeBytes / 1024) + "KB"
          : "size unknown"
      })`
    );

    // Caption generation
    for (const platform of PLATFORMS) {
      const caption = generateCaption(
        asset.id,
        asset.sign as ZodiacSign,
        asset.mood,
        asset.quote,
        platform
      );

      logger.info(`\n  📝 ${platform.toUpperCase()} Caption (${caption.text.length} chars):`);
      logger.info("  " + "─".repeat(40));
      // Show first 200 chars for readability
      const preview = caption.text.slice(0, 200);
      logger.info("  " + preview.replace(/\n/g, "\n  "));
      if (caption.text.length > 200) {
        logger.info(`  ... [${caption.text.length - 200} more chars]`);
      }
      logger.info(`  Hashtags: ${caption.hashtags.join(" ")}`);
    }

    validAssets++;
  }

  logger.info(`\n${"═".repeat(50)}`);
  logger.info(
    `DRY RUN COMPLETE: ${validAssets} valid, ${invalidAssets} invalid`
  );
  logger.info("No posts were published.");
}

runDryRun()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error("Dry run failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });
