/**
 * Hashtag engine for Rahasya social posts.
 * Generates platform-optimized hashtag sets per zodiac sign.
 *
 * V2 — Engagement-first strategy: hashtag counts deliberately reduced.
 * Heavy hashtag blocks read as spammy and suppress reach on new accounts.
 * A tight, relevant set performs better for discovery and algorithmic trust.
 */

import { Platform, ZodiacSign } from "../types/socialAsset";

// ── Core brand hashtags ───────────────────────────────────────────────────

const BRAND_HASHTAGS = ["#Rahasya"];

const ASTROLOGY_HASHTAGS = ["#Horoscope", "#Astrology", "#ZodiacSigns"];

// ── Sign-specific hashtags ────────────────────────────────────────────────

const SIGN_HASHTAGS: Record<ZodiacSign, string[]> = {
  aries: ["#Aries", "#AriesSeason"],
  taurus: ["#Taurus", "#TaurusSeason"],
  gemini: ["#Gemini", "#GeminiSeason"],
  cancer: ["#Cancer", "#CancerSeason"],
  leo: ["#Leo", "#LeoSeason"],
  virgo: ["#Virgo", "#VirgoSeason"],
  libra: ["#Libra", "#LibraSeason"],
  scorpio: ["#Scorpio", "#ScorpioSeason"],
  sagittarius: ["#Sagittarius", "#SagittariusSeason"],
  capricorn: ["#Capricorn", "#CapricornSeason"],
  aquarius: ["#Aquarius", "#AquariusSeason"],
  pisces: ["#Pisces", "#PiscesSeason"],
};

// ── Platform-specific hashtag counts ─────────────────────────────────────
// Instagram: 3-5 | Facebook: 3-5 | Threads: 2-3
// Lower counts read as intentional, not spammy, and perform better on new accounts.

const PLATFORM_HASHTAG_LIMITS: Record<Platform, number> = {
  instagram: 5,
  facebook: 5,
  threads: 3,
};

/**
 * Generate hashtags for a given sign and platform.
 * Returns an array of hashtag strings.
 */
export function generateHashtags(sign: ZodiacSign, platform: Platform): string[] {
  const signTags = SIGN_HASHTAGS[sign] || [];
  const limit = PLATFORM_HASHTAG_LIMITS[platform];

  if (platform === "threads") {
    // Threads: tightest — sign + one astrology + brand
    return [signTags[0] || "", ASTROLOGY_HASHTAGS[0] || "", BRAND_HASHTAGS[0] || ""]
      .filter(Boolean)
      .slice(0, limit);
  }

  // Facebook + Instagram: sign + astrology + brand, deduplicated
  const all = [...signTags, ...ASTROLOGY_HASHTAGS, ...BRAND_HASHTAGS];
  const unique = [...new Set(all)];
  return unique.slice(0, limit);
}

/**
 * Format hashtags as a string block for appending to captions.
 */
export function formatHashtags(hashtags: string[]): string {
  return hashtags.join(" ");
}
