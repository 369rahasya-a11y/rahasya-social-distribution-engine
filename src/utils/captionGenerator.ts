/**
 * Caption generator for Rahasya social posts — V2 Engagement Strategy.
 *
 * Structure: HOOK → QUOTE → QUESTION → CTA → HASHTAGS
 *
 * Optimized for reach, comments, shares, saves, and follower growth on
 * new accounts with near-zero followers. Website traffic is secondary.
 *
 * Key changes from V1:
 * - No direct URLs in any caption (platforms suppress reach on outbound links).
 * - "Link in bio" / "via Rahasya profile" replaces tracked URLs.
 * - Strong emotional hook opens every caption instead of a flat label line.
 * - A dynamically generated, mood-aware question drives comments.
 * - Hashtag counts cut to 3-5 (IG/FB) and 2-3 (Threads) — see hashtags.ts.
 * - Idempotent variation: same assetId always regenerates the same caption,
 *   so retries never produce a different post for an already-failed asset.
 */

import { Platform, PlatformCaption, ZodiacSign } from "../types/socialAsset";
import { generateHashtags, formatHashtags } from "./hashtags";
import { generateEngagementQuestion } from "./engagementQuestions";

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

/**
 * Deterministic variation index based on asset ID and a seed offset.
 * Ensures variety across assets while keeping reruns of the same asset
 * idempotent (same caption every time for the same assetId).
 */
function getVariationIndex(assetId: number, seed: number, max: number): number {
  return (assetId + seed) % max;
}

function capitalize(sign: string): string {
  return sign.charAt(0).toUpperCase() + sign.slice(1);
}

// ── Hook pools (platform-specific tone) ────────────────────────────────────

const INSTAGRAM_HOOKS = [
  (emoji: string, sign: string) => `${emoji} ${sign}, this message found you for a reason.`,
  (emoji: string, sign: string) => `${emoji} ${sign}, the universe has something to tell you.`,
  (emoji: string, sign: string) => `${emoji} Stop scrolling, ${sign}. This one's for you.`,
  (emoji: string, sign: string) => `${emoji} ${sign}, you weren't meant to miss this today.`,
  (emoji: string, sign: string) => `${emoji} A message for every ${sign} out there.`,
];

const THREADS_HOOKS = [
  (emoji: string, sign: string) => `${emoji} ${sign}`,
  (emoji: string, sign: string) => `${emoji} For every ${sign} reading this`,
  (emoji: string, sign: string) => `${emoji} ${sign}, read this slowly.`,
  (emoji: string, sign: string) => `${emoji} A note for ${sign} today`,
];

const FACEBOOK_HOOKS = [
  (emoji: string, sign: string) => `${emoji} ${sign}\nYou needed this message today.`,
  (emoji: string, sign: string) => `${emoji} ${sign}\nThis one found you at the right time.`,
  (emoji: string, sign: string) => `${emoji} ${sign}\nRead this before you start your day.`,
  (emoji: string, sign: string) => `${emoji} ${sign}\nSomething to sit with today.`,
];

// ── CTA pools (no URLs — bio/profile only) ─────────────────────────────────

const INSTAGRAM_CTAS = [
  "✨ Explore all 15 moods via the link in bio.",
  "✨ More moods waiting for you — link in bio.",
  "✨ Your full reading is one tap away — link in bio.",
];

const THREADS_CTAS = [
  "✨ Full reading in bio.",
  "✨ More like this in bio.",
  "✨ All 15 moods — link in bio.",
];

const FACEBOOK_CTAS = [
  "✨ Explore all 15 moods via the Rahasya profile.",
  "✨ Find your full reading on the Rahasya page.",
  "✨ More daily moods waiting on our profile.",
];

// ── Instagram ───────────────────────────────────────────────────────────────

function generateInstagramCaption(
  assetId: number,
  sign: ZodiacSign,
  mood: string,
  quote: string
): string {
  const emoji = ZODIAC_EMOJI[sign];
  const signName = capitalize(sign);

  const hookFn = INSTAGRAM_HOOKS[getVariationIndex(assetId, 0, INSTAGRAM_HOOKS.length)] as (
    e: string,
    s: string
  ) => string;
  const hook = hookFn(emoji, signName);

  const question = generateEngagementQuestion(assetId, mood, 10);
  const cta = INSTAGRAM_CTAS[getVariationIndex(assetId, 1, INSTAGRAM_CTAS.length)];
  const hashtags = generateHashtags(sign, "instagram");

  return [
    hook,
    ``,
    `"${quote}"`,
    ``,
    question,
    `👇 Tell me YES or NO below.`,
    ``,
    cta,
    ``,
    formatHashtags(hashtags),
  ].join("\n");
}

// ── Threads ─────────────────────────────────────────────────────────────────

function generateThreadsCaption(
  assetId: number,
  sign: ZodiacSign,
  mood: string,
  quote: string
): string {
  const emoji = ZODIAC_EMOJI[sign];
  const signName = capitalize(sign);

  const hookFn = THREADS_HOOKS[getVariationIndex(assetId, 2, THREADS_HOOKS.length)] as (
    e: string,
    s: string
  ) => string;
  const hook = hookFn(emoji, signName);

  const question = generateEngagementQuestion(assetId, mood, 20);
  const cta = THREADS_CTAS[getVariationIndex(assetId, 3, THREADS_CTAS.length)];
  const hashtags = generateHashtags(sign, "threads");

  return [
    hook,
    ``,
    `"${quote}"`,
    ``,
    question,
    `👇 Tell me below.`,
    ``,
    cta,
    ``,
    formatHashtags(hashtags),
  ].join("\n");
}

// ── Facebook ────────────────────────────────────────────────────────────────

function generateFacebookCaption(
  assetId: number,
  sign: ZodiacSign,
  mood: string,
  quote: string
): string {
  const emoji = ZODIAC_EMOJI[sign];
  const signName = capitalize(sign);

  const hookFn = FACEBOOK_HOOKS[getVariationIndex(assetId, 4, FACEBOOK_HOOKS.length)] as (
    e: string,
    s: string
  ) => string;
  const hook = hookFn(emoji, signName);

  const question = generateEngagementQuestion(assetId, mood, 30);
  const cta = FACEBOOK_CTAS[getVariationIndex(assetId, 5, FACEBOOK_CTAS.length)];
  const hashtags = generateHashtags(sign, "facebook");

  return [
    hook,
    ``,
    `"${quote}"`,
    ``,
    question,
    ``,
    cta,
    ``,
    formatHashtags(hashtags),
  ].join("\n");
}

// ── Caption length limits ─────────────────────────────────────────────────

const CAPTION_LIMITS: Record<Platform, number> = {
  facebook: 63206,
  instagram: 2200,
  threads: 500,
};

/**
 * Truncate caption to platform limit, preserving the trailing hashtag line.
 */
function truncateCaption(caption: string, limit: number): string {
  if (caption.length <= limit) return caption;

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
 * Main entry point — unchanged signature, callers (publishers) need no changes.
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
