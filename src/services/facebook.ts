/**
 * Facebook Graph API service.
 * Wraps the official Meta Graph API for page posts with images.
 * API Version: v21.0
 */

import { env, API_URLS } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { validateGraphAPIResponse } from "../utils/validation.js";

interface FacebookPostParams {
  message: string;
  imageUrl: string;
}

interface FacebookPostResult {
  postId: string;
  postUrl: string;
}

/**
 * Publish a photo post to a Facebook Page.
 * Uses /page/photos endpoint which simultaneously uploads and publishes.
 */
export async function publishToFacebook(
  params: FacebookPostParams
): Promise<FacebookPostResult> {
  const { message, imageUrl } = params;
  const { FACEBOOK_PAGE_ID, FACEBOOK_ACCESS_TOKEN } = env;

  logger.debug("Calling Facebook Graph API", {
    endpoint: `/${FACEBOOK_PAGE_ID}/photos`,
  });

  const url = `${API_URLS.GRAPH_API}/${FACEBOOK_PAGE_ID}/photos`;

  const body = new URLSearchParams({
    url: imageUrl,
    message,
    access_token: FACEBOOK_ACCESS_TOKEN,
    published: "true",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    validateGraphAPIResponse(data, "Facebook photos API");
    throw new Error(`Facebook API HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  validateGraphAPIResponse(data, "Facebook photos API");

  const postId = data.post_id || data.id;
  if (!postId) {
    throw new Error(
      `Facebook API did not return a post ID. Response: ${JSON.stringify(data)}`
    );
  }

  // Construct post URL
  const postUrl = `https://www.facebook.com/${postId.replace("_", "/posts/")}`;

  logger.debug("Facebook post created", { postId, postUrl });

  return { postId, postUrl };
}

/**
 * Validate Facebook credentials by calling /me on the access token.
 */
export async function validateFacebookCredentials(): Promise<{
  ok: boolean;
  error?: string;
  pageId?: string;
  pageName?: string;
}> {
  try {
    const url = `${API_URLS.GRAPH_API}/${env.FACEBOOK_PAGE_ID}?fields=id,name&access_token=${env.FACEBOOK_ACCESS_TOKEN}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return {
        ok: false,
        error: `${data.error.type} (${data.error.code}): ${data.error.message}`,
      };
    }

    return { ok: true, pageId: data.id, pageName: data.name };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
