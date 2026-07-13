/**
 * FacebookPublisher — publishes Rahasya assets to Facebook Pages.
 * Uses the AI-generated marketing content stored in social_assets.
 */

import { BasePublisher } from "./BasePublisher";
import { SocialAsset, Platform } from "../types/socialAsset";
import { publishToFacebook } from "../services/facebook";

export class FacebookPublisher extends BasePublisher {
  readonly platform: Platform = "facebook";

  /**
   * Platform-specific validation for Facebook.
   */
  protected validateForPlatform(asset: SocialAsset): string | null {
    const hashtags = (asset.hashtags ?? []).map(tag =>
      tag.startsWith("#") ? tag : `#${tag.replace(/\s+/g, "")}`
    );

    const message = [
      asset.card_hook ?? "",
      "",
      asset.caption ?? "",
      "",
      hashtags.join(" "),
    ]
      .filter(Boolean)
      .join("\n");

    if (message.length > 63206) {
      return `Facebook caption too long: ${message.length} chars (max 63,206)`;
    }

    return null;
  }

  /**
   * Publish the image + AI-generated caption.
   */
  protected async publishToAPI(
    asset: SocialAsset
  ): Promise<{ postId: string; postUrl: string
