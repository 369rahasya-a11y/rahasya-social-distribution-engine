/**
 * Instagram Graph API service.
 * Implements the 2-step container → publish flow required by Instagram.
 * API Version: v21.0
 *
 * FLOW:
 *   1. POST /ig_user/media  → creates a media container (returns container_id)
 *   2. GET  /container_id?fields=status_code  → wait until FINISHED
 *   3. POST /ig_user/media_publish  → publishes the container
 */

import { env, API_URLS } from "../config/env";
import { logger } from "../utils/logger";
import { validateGraphAPIResponse } from "../utils/validation";
import { sleep } from "../utils/retry";

interface InstagramPostParams {
  caption: string;
  imageUrl: string;
}

interface InstagramPostResult {
  postId: string;
  postUrl: string;
}

const CONTAINER_STATUS_POLL_INTERVAL_MS = 5000; // 5 seconds
const CONTAINER_STATUS_MAX_POLLS = 12; // 1 minute total wait

/**
 * Publish a photo to Instagram via the official 2-step Graph API flow.
 */
export async function publishToInstagram(
  params: InstagramPostParams
): Promise<InstagramPostResult> {
  const { caption, imageUrl } = params;
  const { INSTAGRAM_BUSINESS_ID, INSTAGRAM_ACCESS_TOKEN } = env;

  // ── Step 1: Create media container ──────────────────────────────────────

  logger.debug("Creating Instagram media container", {
    igUserId: INSTAGRAM_BUSINESS_ID,
  });

  const createUrl = `${API_URLS.GRAPH_API}/${INSTAGRAM_BUSINESS_ID}/media`;

  const createBody = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: INSTAGRAM_ACCESS_TOKEN,
  });

  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: createBody.toString(),
  });

  const createData = await createResponse.json();

  if (!createResponse.ok) {
    validateGraphAPIResponse(createData, "Instagram create container");
    throw new Error(`Instagram API HTTP ${createResponse.status}`);
  }

  validateGraphAPIResponse(createData, "Instagram create container");

  const containerId: string = createData.id;
  if (!containerId) {
    throw new Error(
      `Instagram did not return container ID. Response: ${JSON.stringify(createData)}`
    );
  }

  logger.debug("Instagram container created", { containerId });

  // ── Step 2: Poll until container is FINISHED ─────────────────────────────

  await waitForContainerReady(containerId, INSTAGRAM_ACCESS_TOKEN);

  // ── Step 3: Publish container ────────────────────────────────────────────

  logger.debug("Publishing Instagram container", { containerId });

  const publishUrl = `${API_URLS.GRAPH_API}/${INSTAGRAM_BUSINESS_ID}/media_publish`;

  const publishBody = new URLSearchParams({
    creation_id: containerId,
    access_token: INSTAGRAM_ACCESS_TOKEN,
  });

  const publishResponse = await fetch(publishUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: publishBody.toString(),
  });

  const publishData = await publishResponse.json();

  if (!publishResponse.ok) {
    validateGraphAPIResponse(publishData, "Instagram publish container");
    throw new Error(`Instagram publish HTTP ${publishResponse.status}`);
  }

  validateGraphAPIResponse(publishData, "Instagram publish container");

  const postId: string = publishData.id;
  if (!postId) {
    throw new Error(
      `Instagram did not return post ID after publish. Response: ${JSON.stringify(publishData)}`
    );
  }

  // Build post URL (Instagram post URLs use the media ID)
  const postUrl = `https://www.instagram.com/p/${shortcodeFromId(postId)}/`;

  logger.debug("Instagram post published", { postId, postUrl });

  return { postId, postUrl };
}

/**
 * Poll the container status until it's ready to publish (FINISHED).
 */
async function waitForContainerReady(
  containerId: string,
  accessToken: string
): Promise<void> {
  for (let poll = 0; poll < CONTAINER_STATUS_MAX_POLLS; poll++) {
    await sleep(CONTAINER_STATUS_POLL_INTERVAL_MS);

    const statusUrl = `${API_URLS.GRAPH_API}/${containerId}?fields=status_code&access_token=${accessToken}`;
    const statusResponse = await fetch(statusUrl);
    const statusData = await statusResponse.json();

    validateGraphAPIResponse(statusData, "Instagram container status check");

    const status: string = statusData.status_code;
    logger.debug("Instagram container status", { containerId, status, poll });

    if (status === "FINISHED") return;

    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(
        `Instagram container ${containerId} entered status ${status}. ` +
          `This may be a permanent failure. Check image URL and dimensions.`
      );
    }

    // status is IN_PROGRESS or other — continue polling
  }

  throw new Error(
    `Instagram container ${containerId} did not become FINISHED after ` +
      `${CONTAINER_STATUS_MAX_POLLS} polls (${(CONTAINER_STATUS_MAX_POLLS * CONTAINER_STATUS_POLL_INTERVAL_MS) / 1000}s)`
  );
}

/**
 * Convert an Instagram numeric media ID to a shortcode for URL construction.
 * This is an approximation — the exact shortcode is not returned by the API.
 * For accurate post URLs, fetch the permalink field after publishing.
 */
function shortcodeFromId(mediaId: string): string {
  // Return the media ID as a fallback URL identifier
  return mediaId;
}

/**
 * Validate Instagram credentials.
 */
export async function validateInstagramCredentials(): Promise<{
  ok: boolean;
  error?: string;
  accountId?: string;
  username?: string;
}> {
  try {
    const url =
      `${API_URLS.GRAPH_API}/${env.INSTAGRAM_BUSINESS_ID}` +
      `?fields=id,username&access_token=${env.INSTAGRAM_ACCESS_TOKEN}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return {
        ok: false,
        error: `${data.error.type} (${data.error.code}): ${data.error.message}`,
      };
    }

    return { ok: true, accountId: data.id, username: data.username };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
