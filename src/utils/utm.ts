/**
 * UTM parameter builder for tracking social traffic back to Rahasya.
 * Ensures every link drives attributable website visits.
 */

import { Platform } from "../types/socialAsset.js";

interface UTMParams {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
}

const PLATFORM_UTM: Record<Platform, UTMParams> = {
  facebook: {
    source: "facebook",
    medium: "social",
    campaign: "daily_horoscope",
  },
  instagram: {
    source: "instagram",
    medium: "social",
    campaign: "daily_horoscope",
  },
  threads: {
    source: "threads",
    medium: "social",
    campaign: "daily_horoscope",
  },
};

/**
 * Build a UTM-tagged URL for a given platform.
 * 
 * @param baseUrl - The base URL to append UTM parameters to
 * @param platform - The social platform
 * @param sign - Optional zodiac sign for content tracking
 * @returns Full URL with UTM parameters
 */
export function buildUTMUrl(
  baseUrl: string,
  platform: Platform,
  sign?: string
): string {
  const params = PLATFORM_UTM[platform];

  const url = new URL(baseUrl);
  url.searchParams.set("utm_source", params.source);
  url.searchParams.set("utm_medium", params.medium);
  url.searchParams.set("utm_campaign", params.campaign);

  if (sign) {
    url.searchParams.set("utm_content", sign.toLowerCase());
  }

  return url.toString();
}

/**
 * The canonical Rahasya app URL.
 * Update this to point to your actual landing page or App Store link.
 */
export const RAHASYA_BASE_URL = "https://rahasya.app";

/**
 * Get the full Rahasya URL with UTM tracking for a platform.
 */
export function getRahasyaUTMUrl(platform: Platform, sign?: string): string {
  return buildUTMUrl(RAHASYA_BASE_URL, platform, sign);
}
