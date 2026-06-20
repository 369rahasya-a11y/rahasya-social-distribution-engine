/**
 * FacebookPublisher — publishes Rahasya horoscope assets to Facebook Pages.
 * Extends BasePublisher for consistent idempotency, logging, and retry behavior.
 */

import { BasePublisher } from "./BasePublisher";
import { SocialAsset, Platform } from "../types/socialAsset";
import { publishToFacebook } from "../services/facebook";
import { generateCaption } from "../utils/captionGenerator";

export class FacebookPublisher extends BasePublisher {
  readonly platform: Platform = "facebook";

  /**
   * Platform-specific validation for Facebook.
   * Facebook caption limit: 63,206 characters.
   */
  protected validateForPlatform(asset: SocialAsset): string | null {
    const caption = generateCaption(
      asset.id,
      asset.sign,
      asset.mood,
      asset.quote,
      "facebook"
    );

    if (caption.text.length > 63206) {
      return `Facebook caption too long: ${caption.text.length} chars (max 63,206)`;
    }

    return null; // valid
  }

  /**
   * Call the Facebook Graph API to publish the image + caption.
   */
  protected async publishToAPI(
    asset: SocialAsset
  ): Promise<{ postId: string; postUrl: string }> {
    const caption = generateCaption(
      asset.id,
      asset.sign,
      asset.mood,
      asset.quote,
      "facebook"
    );

    return publishToFacebook({
      message: caption.text,
      imageUrl: asset.image_url,
    });
  }
}
