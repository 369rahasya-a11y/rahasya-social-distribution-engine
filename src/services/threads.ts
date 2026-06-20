/**
 * Threads API service.
 * Implements the official Threads Graph API (graph.threads.net).
 * Uses the same 2-step container → publish flow as Instagram.
 *
 * FLOW:
 *   1. POST /user/threads  → creates a container (returns container_id)
 *   2. GET  /container?fields=status  → poll until FINISHED
 *   3. POST /user/threads_publish  → publishes the container
 */

import { env, API_URLS } from "../config/env";
import { logger } from "../utils/logger";
import { validateThreadsAPIResponse } from "../utils/validation";
import { sleep } from "../utils/retry";

interface ThreadsPostParams {
  text: string;
  imageUrl: string;
}

interface ThreadsPostResult {
  postId: string;
  postUrl: string;
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 12;

/**
 * Publish a post to Threads via the official API.
 */
export async function publishToThreads(
  params: ThreadsPostParams
): Promise<ThreadsPostResult> {
  const { text, imageUrl } = params;
  const { THREADS_USER_ID, THREADS_ACCESS_TOKEN } = env;

  // ── Step 1: Create media container ──────────────────────────────────────

  logger.debug("Creating Threads media container", {
    userId: THREADS_USER_ID,
  });

  const createUrl = `${API_URLS.THREADS_API}/${THREADS_USER_ID}/threads`;

  const createBody = new URLSearchParams({
    media_type: "IMAGE",
    image_url: imageUrl,
    text,
    access_token: THREADS_ACCESS_TOKEN,
  });

  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: createBody.toString(),
  });

  const createData = await createResponse.json();

  if (!createResponse.ok) {
    validateThreadsAPIResponse(createData, "Threads create container");
    throw new Error(`Threads API HTTP ${createResponse.status}`);
  }

  validateThreadsAPIResponse(createData, "Threads create container");

  const containerId: string = createData.id;
  if (!containerId) {
    throw new Error(
      `Threads did not return container ID. Response: ${JSON.stringify(createData)}`
    );
  }

  logger.debug("Threads container created", { containerId });

  // ── Step 2: Poll container status ────────────────────────────────────────

  await waitForThreadsContainerReady(containerId, THREADS_ACCESS_TOKEN);

  // ── Step 3: Publish container ────────────────────────────────────────────

  logger.debug("Publishing Threads container", { containerId });

  const publishUrl = `${API_URLS.THREADS_API}/${THREADS_USER_ID}/threads_publish`;

  const publishBody = new URLSearchParams({
    creation_id: containerId,
    access_token: THREADS_ACCESS_TOKEN,
  });

  const publishResponse = await fetch(publishUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: publishBody.toString(),
  });

  const publishData = await publishResponse.json();

  if (!publishResponse.ok) {
    validateThreadsAPIResponse(publishData, "Threads publish container");
    throw new Error(`Threads publish HTTP ${publishResponse.status}`);
  }

  validateThreadsAPIResponse(publishData, "Threads publish container");

  const postId: string = publishData.id;
  if (!postId) {
    throw new Error(
      `Threads did not return post ID. Response: ${JSON.stringify(publishData)}`
    );
  }

  // Build post URL
  const postUrl = `https://www.threads.net/@rahasya/post/${postId}`;

  logger.debug("Threads post published", { postId, postUrl });

  return { postId, postUrl };
}

/**
 * Poll Threads container status until ready.
 */
async function waitForThreadsContainerReady(
  containerId: string,
  accessToken: string
): Promise<void> {
  for (let poll = 0; poll < MAX_POLLS; poll++) {
    await sleep(POLL_INTERVAL_MS);

    const statusUrl =
      `${API_URLS.THREADS_API}/${containerId}` +
      `?fields=status,error_message&access_token=${accessToken}`;

    const response = await fetch(statusUrl);
    const data = await response.json();

    validateThreadsAPIResponse(data, "Threads container status");

    const status: string = data.status;
    logger.debug("Threads container status", { containerId, status, poll });

    if (status === "FINISHED") return;

    if (status === "ERROR") {
      throw new Error(
        `Threads container ${containerId} failed: ${data.error_message || "Unknown error"}`
      );
    }

    if (status === "EXPIRED") {
      throw new Error(
        `Threads container ${containerId} expired before publishing.`
      );
    }
    // IN_PROGRESS → continue polling
  }

  throw new Error(
    `Threads container ${containerId} did not become FINISHED after ${MAX_POLLS} polls`
  );
}

/**
 * Validate Threads credentials.
 */
export async function validateThreadsCredentials(): Promise<{
  ok: boolean;
  error?: string;
  userId?: string;
  username?: string;
}> {
  try {
    const url =
      `${API_URLS.THREADS_API}/${env.THREADS_USER_ID}` +
      `?fields=id,username&access_token=${env.THREADS_ACCESS_TOKEN}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return {
        ok: false,
        error: `${data.error.code}: ${data.error.message}`,
      };
    }

    return { ok: true, userId: data.id, username: data.username };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
