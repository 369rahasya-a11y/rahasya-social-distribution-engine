/**
 * Input and response validation utilities.
 */

import { SocialAsset } from "../types/socialAsset.js";
import { logger } from "./logger.js";

/**
 * Validate that a social asset has all required fields for publishing.
 */
export function validateAsset(asset: SocialAsset): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!asset.id) errors.push("Missing asset ID");
  if (!asset.sign) errors.push("Missing zodiac sign");
  if (!asset.mood) errors.push("Missing mood");
  if (!asset.quote) errors.push("Missing quote");
  if (!asset.image_url) errors.push("Missing image_url");
  if (!asset.horoscope_date) errors.push("Missing horoscope_date");

  if (errors.length > 0) {
    logger.warn("Asset validation failed", { assetId: asset.id, errors });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a Facebook/Instagram Graph API response.
 * Throws a descriptive error for common failure modes.
 */
export function validateGraphAPIResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  context: string
): void {
  if (!data) {
    throw new Error(`${context}: Empty API response`);
  }

  if (data.error) {
    const err = data.error;
    const code = err.code || "unknown";
    const type = err.type || "unknown";
    const message = err.message || "No message";

    // Token errors — actionable messages for the founder
    if (code === 190 || type === "OAuthException") {
      throw new Error(
        `${context}: Access token is invalid or expired (code ${code}). ` +
          `Regenerate your token at developers.facebook.com. Error: ${message}`
      );
    }

    // Permission errors
    if (code === 200 || code === 10 || code === 3) {
      throw new Error(
        `${context}: Missing API permission (code ${code}). ` +
          `Check your app's required permissions. Error: ${message}`
      );
    }

    // Rate limiting
    if (code === 4 || code === 17 || code === 32) {
      throw new Error(
        `${context}: Rate limit reached (code ${code}). ` +
          `Will retry with backoff. Error: ${message}`
      );
    }

    throw new Error(`${context}: API error (code ${code}, type ${type}): ${message}`);
  }
}

/**
 * Validate a Threads API response.
 */
export function validateThreadsAPIResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  context: string
): void {
  if (!data) {
    throw new Error(`${context}: Empty API response`);
  }

  if (data.error) {
    const err = data.error;
    throw new Error(
      `${context}: Threads API error (${err.code || "unknown"}): ${err.message || JSON.stringify(err)}`
    );
  }
}
