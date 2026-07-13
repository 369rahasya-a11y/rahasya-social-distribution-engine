/**
 * FacebookPublisher — publishes Rahasya assets to Facebook Pages.
 * Uses the AI-generated marketing content stored in social_assets.
 */

import { BasePublisher } from "./BasePublisher";
import { SocialAsset, Platform } from "../types/socialAsset";
import { publishToFacebook } from "../services/facebook";

export class FacebookPublisher extends BasePublisher {
  readonly platform: Platform = "facebook";

  private buildMessage(asset: SocialAsset): string {
    const hashtags = (asset.hashtags ?? []).map(tag =>
      tag.startsWith("#") ? tag : `#${tag.replace(/\s+/g, "")}`
    );

    return [
      asset.caption ?? "",
      "",
      hashtags.join(" "),
    ]
      .filter(Boolean)
      .join("\n");
  }

  protected validateForPlatform(asset: SocialAsset): string | null {
    const message = this.buildMessage(asset);

    if (message.length > 63206) {
      return `Facebook caption too long: ${message.length} chars (max 63,206)`;
    }

    return null;
  }

  protected async publishToAPI(
    asset: SocialAsset
  ): Promise<{ postId: string; postUrl: string }> {

    const message = this.buildMessage(asset);

    return publishToFacebook({
      message,
      imageUrl: asset.image_url,
    });
  }
}
