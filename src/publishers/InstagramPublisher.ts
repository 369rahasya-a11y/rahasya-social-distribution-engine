/**
 * InstagramPublisher — publishes Rahasya assets to Instagram.
 * Uses the AI-generated marketing content stored in social_assets.
 */

import { BasePublisher } from "./BasePublisher";
import { SocialAsset, Platform } from "../types/socialAsset";
import { publishToInstagram } from "../services/instagram";

export class InstagramPublisher extends BasePublisher {
  readonly platform: Platform = "instagram";

  /**
   * Build the final Instagram caption from the stored marketing content.
   */
  private buildCaption(asset: SocialAsset): string {
    const hashtags = (asset.hashtags ?? []).map(tag =>
      tag.startsWith("#") ? tag : `#${tag.replace(/\s+/g, "")}`
    );

    return [
      asset.card_hook ?? "",
      "",
      asset.caption ?? "",
      "",
      hashtags.join(" "),
    ]
      .filter(Boolean)
      .join("\n");
  }

  /**
   * Platform-specific validation.
   */
  protected validateForPlatform(asset: SocialAsset): string | null {
    const caption = this.buildCaption(asset);

    if (caption.length > 2200) {
      return `Instagram caption too long: ${caption.length} chars (max 2,200)`;
    }

    if (!asset.image_url.startsWith("https://")) {
      return "Instagram requires HTTPS image URLs";
    }

    return null;
  }

  /**
   * Publish the image + AI-generated caption.
   */
  protected async publishToAPI(
    asset: SocialAsset
  ): Promise<{ postId: string; postUrl: string }> {

    const caption = this.buildCaption(asset);

    return publishToInstagram({
      caption,
      imageUrl: asset.image_url,
    });
  }
}
