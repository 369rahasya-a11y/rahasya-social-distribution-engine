/**
 * ThreadsPublisher — publishes Rahasya assets to Threads.
 * Uses the AI-generated marketing content stored in social_assets.
 */

import { BasePublisher } from "./BasePublisher";
import { SocialAsset, Platform } from "../types/socialAsset";
import { publishToThreads } from "../services/threads";

export class ThreadsPublisher extends BasePublisher {
  readonly platform: Platform = "threads";

  /**
   * Build the Threads post from the stored marketing content.
   */
  private buildText(asset: SocialAsset): string {
    const hashtags = (asset.hashtags ?? []).map(tag =>
      tag.startsWith("#") ? tag : `#${tag.replace(/\s+/g, "")}`
    );

    let text = [
      asset.caption ?? "",
      "",
      hashtags.join(" "),
    ]
      .filter(Boolean)
      .join("\n");

    // Threads limit: 500 characters
    if (text.length > 500) {
      text = text.slice(0, 497) + "...";
    }

    return text;
  }

  /**
   * Platform-specific validation.
   */
  protected validateForPlatform(asset: SocialAsset): string | null {
    return null;
  }

  /**
   * Publish the image + AI-generated text.
   */
  protected async publishToAPI(
    asset: SocialAsset
  ): Promise<{ postId: string; postUrl: string }> {

    const text = this.buildText(asset);

    return publishToThreads({
      text,
      imageUrl: asset.image_url,
    });
  }
}
