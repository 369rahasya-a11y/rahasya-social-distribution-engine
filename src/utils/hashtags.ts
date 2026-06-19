/**
 * Hashtag engine for Rahasya social posts.
 * Generates platform-optimized hashtag sets per zodiac sign.
 */

import { Platform, ZodiacSign } from "../types/socialAsset.js";

// ── Core brand hashtags ───────────────────────────────────────────────────

const BRAND_HASHTAGS = ["#Rahasya", "#RahasyaApp"];

const ASTROLOGY_HASHTAGS = [
  "#Horoscope",
  "#DailyHoroscope",
  "#Astrology",
  "#Zodiac",
  "#AstrologyDaily",
];

const ENGAGEMENT_HASHTAGS = [
  "#DailyInspiration",
  "#MorningVibes",
  "#SpiritualGuidance",
  "#CosmicEnergy",
];

// ── Sign-specific hashtags ────────────────────────────────────────────────

const SIGN_HASHTAGS: Record<ZodiacSign, string[]> = {
  aries: ["#Aries", "#AriesDaily", "#AriesHoroscope", "#AriesSeason", "#AriesZodiac"],
  taurus: ["#Taurus", "#TaurusDaily", "#TaurusHoroscope", "#TaurusSeason", "#TaurusZodiac"],
  gemini: ["#Gemini", "#GeminiDaily", "#GeminiHoroscope", "#GeminiSeason", "#GeminiZodiac"],
  cancer: ["#Cancer", "#CancerDaily", "#CancerHoroscope", "#CancerSeason", "#CancerZodiac"],
  leo: ["#Leo", "#LeoDaily", "#LeoHoroscope", "#LeoSeason", "#LeoZodiac"],
  virgo: ["#Virgo", "#VirgoDaily", "#VirgoHoroscope", "#VirgoSeason", "#VirgoZodiac"],
  libra: ["#Libra", "#LibraDaily", "#LibraHoroscope", "#LibraSeason", "#LibraZodiac"],
  scorpio: ["#Scorpio", "#ScorpioDaily", "#ScorpioHoroscope", "#ScorpioSeason", "#ScorpioZodiac"],
  sagittarius: ["#Sagittarius", "#SagittariusDaily", "#SagittariusHoroscope", "#SagittariusSeason", "#SagittariusZodiac"],
  capricorn: ["#Capricorn", "#CapricornDaily", "#CapricornHoroscope", "#CapricornSeason", "#CapricornZodiac"],
  aquarius: ["#Aquarius", "#AquariusDaily", "#AquariusHoroscope", "#AquariusSeason", "#AquariusZodiac"],
  pisces: ["#Pisces", "#PiscesDaily", "#PiscesHoroscope", "#PiscesSeason", "#PiscesZodiac"],
};

// ── Platform-specific hashtag counts ─────────────────────────────────────
// Instagram: 20-30 optimal | Facebook: 3-5 optimal | Threads: 5-10 optimal

const PLATFORM_HASHTAG_LIMITS: Record<Platform, number> = {
  instagram: 25,
  facebook: 5,
  threads: 8,
};

/**
 * Generate hashtags for a given sign and platform.
 * Returns an array of hashtag strings.
 */
export function generateHashtags(sign: ZodiacSign, platform: Platform): string[] {
  const signTags = SIGN_HASHTAGS[sign] || [];
  const limit = PLATFORM_HASHTAG_LIMITS[platform];

  if (platform === "facebook") {
    // Facebook: minimal hashtags — brand + sign + one astrology
    return [
      ...BRAND_HASHTAGS.slice(0, 1),
      ...ASTROLOGY_HASHTAGS.slice(0, 2),
      signTags[0] || "",
      signTags[1] || "",
    ]
      .filter(Boolean)
      .slice(0, limit);
  }

  if (platform === "threads") {
    // Threads: moderate — sign focus + astrology
    return [
      ...signTags.slice(0, 3),
      ...ASTROLOGY_HASHTAGS.slice(0, 3),
      ...BRAND_HASHTAGS.slice(0, 1),
      ENGAGEMENT_HASHTAGS[0] || "",
    ]
      .filter(Boolean)
      .slice(0, limit);
  }

  // Instagram: maximum reach — all categories
  const all = [
    ...signTags,
    ...ASTROLOGY_HASHTAGS,
    ...ENGAGEMENT_HASHTAGS,
    ...BRAND_HASHTAGS,
  ];

  // Deduplicate
  const unique = [...new Set(all)];
  return unique.slice(0, limit);
}

/**
 * Format hashtags as a string block for appending to captions.
 */
export function formatHashtags(hashtags: string[]): string {
  return hashtags.join(" ");
}
