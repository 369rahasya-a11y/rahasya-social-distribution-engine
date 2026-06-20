/**
 * InstagramPublisher — publishes Rahasya horoscope assets to Instagram.
 * Extends BasePublisher for consistent idempotency, logging, and retry behavior.
 */

import { BasePublisher } from "./BasePublisher";
import { SocialAsset, Platform } from "../types/socialAsset";
import { publishToInstagram } from "../services/instagram";
import { generateCaption } from "../utils/captionGenerator";

export class InstagramPublisher extends BasePublisher {
  readonly platform: Platform = "instagram";

  /**
   * Platform-specific validation for Instagram.
   * Instagram caption limit: 2,200 characters.
   * Instagram image must be JPEG or PNG.
   */
  protected validateForPlatform(asset: SocialAsset): string | null {
    const caption = generateCaption(
      asset.id,
      asset.sign,
      asset.mood,
      asset.quote,
      "instagram"
    );

    if (caption.text.length > 2200) {
      return `Instagram caption too long: ${caption.text.length} chars (max 2,200)`;
    }

    // Instagram requires HTTPS image URL
    if (!asset.image_url.startsWith("https://")) {
      return "Instagram requires HTTPS image URLs";
    }

    return null; // valid
  }

  /**
   * Call the Instagram Graph API to publish the image + caption.
   */
  protected async publishToAPI(
    asset: SocialAsset
  ): Promise<{ postId: string; postUrl: string }> {
    const caption = generateCaption(
      asset.id,
      asset.sign,
      asset.mood,
      asset.quote,
      "instagram"
    );

    return publishToInstagram({
      caption: caption.text,
      imageUrl: asset.image_url,
    });
  }
}
