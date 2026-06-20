/**
 * BasePublisher — abstract base class for all platform publishers.
 *
 * Every publisher (Facebook, Instagram, Threads, Pinterest, Twitter, etc.)
 * must extend this class and implement publish(), validate(), and retry().
 *
 * This architecture ensures:
 * - Consistent behavior across platforms
 * - Easy addition of new platforms
 * - Shared idempotency, logging, and analytics
 */

import {
  SocialAsset,
  Platform,
  PublishResult,
} from "../types/socialAsset";
import {
  isAlreadyPublished,
  markPlatformPublished,
  writePostLog,
  handlePublishFailure,
} from "../services/supabase";
import { trackPublishSuccess, trackPublishFailure } from "../services/analytics";
import { validateAsset } from "../utils/validation";
import { validateImage } from "../utils/imageValidation";
import { logger } from "../utils/logger";
import { env } from "../config/env";

export abstract class BasePublisher {
  abstract readonly platform: Platform;

  // ── Abstract methods — must implement per platform ─────────────────────

  /**
   * Perform the actual API call to publish the asset.
   * Called only after all guards pass.
   */
  protected abstract publishToAPI(
    asset: SocialAsset
  ): Promise<{ postId: string; postUrl: string }>;

  /**
   * Platform-specific validation (caption length, image format, etc.).
   * Return null if valid, error message string if invalid.
   */
  protected abstract validateForPlatform(asset: SocialAsset): string | null;

  // ── Main publish flow ──────────────────────────────────────────────────

  /**
   * Publish an asset to this platform.
   * Handles idempotency, validation, logging, and error handling.
   */
  async publish(asset: SocialAsset): Promise<PublishResult> {
    const { id: assetId } = asset;

    // ── Guard 1: Basic asset validation ─────────────────────────────────

    const { valid: assetValid, errors } = validateAsset(asset);
    if (!assetValid) {
      const error = `Asset validation failed: ${errors.join(", ")}`;
      logger.publishFailure(this.platform, assetId, error);
      return this.skipResult(assetId, error);
    }

    // ── Guard 2: Idempotency check ───────────────────────────────────────

    const alreadyPublished = await isAlreadyPublished(assetId, this.platform);
    if (alreadyPublished) {
      logger.publishSkip(
        this.platform,
        assetId,
        "Already published (idempotency guard)"
      );
      return this.skipResult(assetId, "Already published");
    }

    // ── Guard 3: Dry run mode ────────────────────────────────────────────

    if (env.IS_DRY_RUN) {
      logger.info(`[DRY RUN] Would publish to ${this.platform}`, { assetId });
      return this.skipResult(assetId, "Dry run mode");
    }

    // ── Guard 4: Platform-specific validation ───────────────────────────

    const platformError = this.validateForPlatform(asset);
    if (platformError) {
      logger.publishFailure(this.platform, assetId, platformError);
      await trackPublishFailure(assetId, this.platform, platformError);
      return this.failResult(assetId, platformError);
    }

    // ── Guard 5: Image validation ────────────────────────────────────────

    const imageValidation = await validateImage(asset.image_url);
    if (!imageValidation.valid) {
      const error = `Image validation failed: ${imageValidation.error}`;
      logger.publishFailure(this.platform, assetId, error);
      await trackPublishFailure(assetId, this.platform, error);
      return this.failResult(assetId, error);
    }

    // ── Publish ──────────────────────────────────────────────────────────

    logger.publishStart(this.platform, assetId);

    try {
      const { postId, postUrl } = await this.publishToAPI(asset);

      // Mark published in DB
      await markPlatformPublished(assetId, this.platform);

      // Record success in logs
      const result: PublishResult = {
        success: true,
        platform: this.platform,
        assetId,
        postId,
        postUrl,
      };

      await trackPublishSuccess(result);
      logger.publishSuccess(this.platform, assetId, postId);

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown publish error";

      logger.publishFailure(this.platform, assetId, message);

      // Record failure + queue retry
      await handlePublishFailure(assetId, this.platform, message, 0);

      return this.failResult(assetId, message);
    }
  }

  /**
   * Retry a failed publish (called from retryFailed workflow).
   * Same as publish() but with incremented retry count.
   */
  async retry(asset: SocialAsset, retryCount: number): Promise<PublishResult> {
    const { id: assetId } = asset;

    // Re-check idempotency (may have been published by another process)
    const alreadyPublished = await isAlreadyPublished(assetId, this.platform);
    if (alreadyPublished) {
      return this.skipResult(assetId, "Already published during retry");
    }

    logger.info(`🔄 Retrying ${this.platform} (attempt ${retryCount + 1})`, {
      assetId,
    });

    try {
      const { postId, postUrl } = await this.publishToAPI(asset);
      await markPlatformPublished(assetId, this.platform);

      const result: PublishResult = {
        success: true,
        platform: this.platform,
        assetId,
        postId,
        postUrl,
      };

      await writePostLog({
        asset_id: assetId,
        platform: this.platform,
        status: "success",
        post_id: postId,
        post_url: postUrl,
        published_at: new Date().toISOString(),
        error_message: null,
        retry_count: retryCount,
      });

      logger.publishSuccess(this.platform, assetId, postId);
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown retry error";

      logger.publishFailure(this.platform, assetId, message);
      await handlePublishFailure(assetId, this.platform, message, retryCount);

      return this.failResult(assetId, message);
    }
  }

  // ── Helper result factories ────────────────────────────────────────────

  protected skipResult(assetId: number, reason: string): PublishResult {
    return {
      success: false,
      platform: this.platform,
      assetId,
      skipped: true,
      skipReason: reason,
    };
  }

  protected failResult(assetId: number, error: string): PublishResult {
    return {
      success: false,
      platform: this.platform,
      assetId,
      error,
      skipped: false,
    };
  }
}
