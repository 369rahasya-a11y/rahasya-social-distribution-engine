/**
 * Caption generator for Rahasya social posts.
 * Produces platform-optimized captions with duplicate protection via variations.
 */

import { Platform, PlatformCaption, ZodiacSign } from "../types/socialAsset.js";
import { generateHashtags, formatHashtags } from "./hashtags.js";
import { getRahasyaUTMUrl } from "./utm.js";

// ── Zodiac emoji map ──────────────────────────────────────────────────────

const ZODIAC_EMOJI: Record<ZodiacSign, string> = {
  aries: "♈",
  taurus: "♉",
  gemini: "♊",
  cancer: "♋",
  leo: "♌",
  virgo: "♍",
  libra: "♎",
  scorpio: "♏",
  sagittarius: "♐",
  capricorn: "♑",
  aquarius: "♒",
  pisces: "♓",
};

// ── Engagement questions for Threads ──────────────────────────────────────

const THREADS_QUESTIONS = [
  "Does this resonate with you today? 💬",
  "What's the universe saying to you right now? ✨",
  "How does this message land for you? Share below! 👇",
  "Is your cosmic energy aligned today? Let us know! 🌟",
  "Drop a ✨ if this speaks to your soul!",
  "Tag a friend who needs to hear this today! 💫",
  "How are the stars treating you this week? 🌠",
  "Does this feel true for your sign? React below! 🔮",
];

// ── Facebook openers (conversational variety) ─────────────────────────────

const FACEBOOK_OPENERS = [
  "🌟 Good morning, beautiful souls!",
  "✨ The cosmos have a message for you today.",
  "🔮 Your daily cosmic guidance has arrived.",
  "🌙 The stars are speaking — are you listening?",
  "💫 Welcome to your daily horoscope reading.",
  "⭐ The universe sends you a message today.",
  "🌌 Your celestial forecast is ready.",
  "🪐 Today's cosmic alignment brings you this.",
];

const FACEBOOK_CLOSERS = [
  "Follow Rahasya for daily cosmic insights that guide your journey.",
  "Get your personalised daily horoscope — download the Rahasya app.",
  "More wisdom awaits you in the Rahasya app. Your stars, decoded daily.",
  "Start every morning with your stars. The Rahasya app is your guide.",
  "Discover what the cosmos have planned for you. Rahasya — your daily astrology companion.",
];

/**
 * Get a deterministic variation index based on asset ID and date.
 * This ensures variation while keeping reruns consistent (idempotent captions).
 */
function getVariationIndex(assetId: number, seed: number, max: number): number {
  return (assetId + seed) % max;
}

/**
 * Generate a Facebook caption — long, conversational, engagement-focused.
 */
function generateFacebookCaption(
  assetId: number,
  sign: ZodiacSign,
  mood: string,
  quote: string
): string {
  const emoji = ZODIAC_EMOJI[sign];
  const signName = sign.charAt(0).toUpperCase() + sign.slice(1);
  const utmUrl = getRahasyaUTMUrl("facebook", sign);

  const opener = FACEBOOK_OPENERS[getVariationIndex(assetId, 0, FACEBOOK_OPENERS.length)];
  const closer = FACEBOOK_CLOSERS[getVariationIndex(assetId, 1, FACEBOOK_CLOSERS.length)];
  const hashtags = generateHashtags(sign, "facebook");

  return [
    `${opener}`,
    ``,
    `${emoji} Today's message for ${signName}:`,
    ``,
    `✨ Mood: ${mood}`,
    ``,
    `"${quote}"`,
    ``,
    `The stars have aligned to bring you this wisdom. Whether you're navigating challenges or celebrating victories, let this cosmic guidance illuminate your path today. Trust in the energy of the universe and your own inner strength.`,
    ``,
    `🔗 Get your full personalized reading: ${utmUrl}`,
    ``,
    closer,
    ``,
    formatHashtags(hashtags),
  ].join("\n");
}

/**
 * Generate an Instagram caption — punchy, hashtag-optimized.
 */
function generateInstagramCaption(
  assetId: number,
  sign: ZodiacSign,
  mood: string,
  quote: string
): string {
  const emoji = ZODIAC_EMOJI[sign];
  const signName = sign.charAt(0).toUpperCase() + sign.slice(1);
  const utmUrl = getRahasyaUTMUrl("instagram", sign);
  const hashtags = generateHashtags(sign, "instagram");

  // Variation in the opening line
  const openers = [
    `${emoji} ${signName} Daily`,
    `${emoji} For every ${signName}`,
    `${emoji} ${signName} energy today`,
    `${emoji} Hey ${signName}!`,
  ];
  const opener = openers[getVariationIndex(assetId, 2, openers.length)];

  return [
    `${opener} ✨`,
    ``,
    `Mood: ${mood}`,
    `"${quote}"`,
    ``,
    `🔗 Full reading: ${utmUrl}`,
    ``,
    formatHashtags(hashtags),
  ].join("\n");
}

/**
 * Generate a Threads caption — engaging, conversational, question-driven.
 */
function generateThreadsCaption(
  assetId: number,
  sign: ZodiacSign,
  mood: string,
  quote: string
): string {
  const emoji = ZODIAC_EMOJI[sign];
  const signName = sign.charAt(0).toUpperCase() + sign.slice(1);
  const utmUrl = getRahasyaUTMUrl("threads", sign);
  const hashtags = generateHashtags(sign, "threads");

  const question = THREADS_QUESTIONS[getVariationIndex(assetId, 3, THREADS_QUESTIONS.length)];

  return [
    `${emoji} ${signName} horoscope for today`,
    ``,
    `Mood: ${mood}`,
    `"${quote}"`,
    ``,
    question,
    ``,
    `Full reading 👉 ${utmUrl}`,
    ``,
    formatHashtags(hashtags),
  ].join("\n");
}

// ── Caption length limits ─────────────────────────────────────────────────

const CAPTION_LIMITS: Record<Platform, number> = {
  facebook: 63206,   // Facebook: very generous
  instagram: 2200,   // Instagram: 2200 chars
  threads: 500,      // Threads: 500 chars
};

/**
 * Truncate caption to platform limit, preserving hashtags.
 */
function truncateCaption(caption: string, limit: number): string {
  if (caption.length <= limit) return caption;

  // Find hashtag block (starts with #)
  const hashtagStart = caption.lastIndexOf("\n\n#");
  if (hashtagStart > 0) {
    const body = caption.slice(0, hashtagStart);
    const tags = caption.slice(hashtagStart);
    const truncatedBody = body.slice(0, limit - tags.length - 3) + "...";
    return truncatedBody + tags;
  }

  return caption.slice(0, limit - 3) + "...";
}

/**
 * Generate a platform-specific caption for a social asset.
 * This is the main entry point.
 */
export function generateCaption(
  assetId: number,
  sign: ZodiacSign,
  mood: string,
  quote: string,
  platform: Platform
): PlatformCaption {
  let text: string;

  switch (platform) {
    case "facebook":
      text = generateFacebookCaption(assetId, sign, mood, quote);
      break;
    case "instagram":
      text = generateInstagramCaption(assetId, sign, mood, quote);
      break;
    case "threads":
      text = generateThreadsCaption(assetId, sign, mood, quote);
      break;
  }

  const limit = CAPTION_LIMITS[platform];
  const finalText = truncateCaption(text, limit);
  const hashtags = generateHashtags(sign, platform);

  return {
    platform,
    text: finalText,
    hashtags,
  };
}
