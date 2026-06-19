/**
 * ThreadsPublisher — publishes Rahasya horoscope assets to Threads.
 * Extends BasePublisher for consistent idempotency, logging, and retry behavior.
 */

import { BasePublisher } from "./BasePublisher.js";
import { SocialAsset, Platform } from "../types/socialAsset.js";
import { publishToThreads } from "../services/threads.js";
import { generateCaption } from "../utils/captionGenerator.js";

export class ThreadsPublisher extends BasePublisher {
  readonly platform: Platform = "threads";

  /**
   * Platform-specific validation for Threads.
   * Threads text limit: 500 characters.
   */
  protected validateForPlatform(asset: SocialAsset): string | null {
    const caption = generateCaption(
      asset.id,
      asset.sign,
      asset.mood,
      asset.quote,
      "threads"
    );

    if (caption.text.length > 500) {
      return `Threads caption too long: ${caption.text.length} chars (max 500). Will truncate.`;
    }

    return null; // valid
  }

  /**
   * Call the Threads API to publish the image + text.
   */
  protected async publishToAPI(
    asset: SocialAsset
  ): Promise<{ postId: string; postUrl: string }> {
    const caption = generateCaption(
      asset.id,
      asset.sign,
      asset.mood,
      asset.quote,
      "threads"
    );

    return publishToThreads({
      text: caption.text,
      imageUrl: asset.image_url,
    });
  }
}
