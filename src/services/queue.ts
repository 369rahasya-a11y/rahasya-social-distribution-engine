/**
 * Queue service — manages the retry queue for failed publishes.
 */

import {
  fetchRetryQueue,
  updateQueueItem,
  fetchAssetById,
} from "./supabase.js";
import { SocialQueueItem } from "../types/socialAsset.js";
import { logger } from "../utils/logger.js";

export { fetchRetryQueue, updateQueueItem };

/**
 * Enrich queue items with their associated assets.
 */
export async function enrichQueueWithAssets(
  items: SocialQueueItem[]
): Promise<Array<SocialQueueItem & { asset: Awaited<ReturnType<typeof fetchAssetById>> }>> {
  const enriched = await Promise.all(
    items.map(async (item) => {
      const asset = await fetchAssetById(item.asset_id);
      return { ...item, asset };
    })
  );

  return enriched.filter((item) => {
    if (!item.asset) {
      logger.warn("Queue item references missing asset", {
        queueId: item.id,
        assetId: item.asset_id,
      });
      return false;
    }
    return true;
  });
}
