/**
 * Engagement question generator.
 *
 * Produces a varied, mood-aware question to drive comments and replies.
 * Used by the HOOK → QUOTE → QUESTION → CTA → HASHTAGS caption structure.
 *
 * Variation is deterministic per asset (seeded by assetId) so reruns of the
 * same asset always produce the same question — this keeps idempotent
 * retries from generating different captions for the same post.
 */

const GENERIC_QUESTIONS = [
  "Does this resonate with you?",
  "Have you felt this recently?",
  "Can you relate?",
  "Is this accurate for you today?",
  "What do you think?",
  "Has this happened to you lately?",
  "Does this describe your current situation?",
  "Is this hitting close to home?",
];

// Mood-specific questions add relevance when the mood maps to a known tone.
// Falls back to GENERIC_QUESTIONS for any mood not listed here.
const MOOD_QUESTIONS: Record<string, string[]> = {
  confident: [
    "Where is this confidence showing up for you today?",
    "Do you feel this energy right now?",
  ],
  nostalgic: [
    "What memory came to mind just now?",
    "Have you been thinking about the past lately?",
  ],
  lonely: [
    "Have you been feeling this too?",
    "Does this hit close to home today?",
  ],
  anxious: [
    "Is this weighing on you right now?",
    "Have you been carrying this feeling lately?",
  ],
  hopeful: [
    "What are you hoping for right now?",
    "Does this feel true for you today?",
  ],
  motivated: [
    "What's driving you forward today?",
    "Do you feel this pull right now?",
  ],
  reflective: [
    "What's been on your mind lately?",
    "Does this match how you've been feeling?",
  ],
};

/**
 * Deterministic pseudo-random index, seeded by assetId + offset.
 * Same asset always produces the same question (idempotency-safe).
 */
function seededIndex(assetId: number, seed: number, max: number): number {
  return (assetId + seed) % max;
}

/**
 * Generate an engagement question for a given asset and mood.
 * Different seed offsets per platform ensure FB/IG/Threads don't all
 * ask the identical question for the same asset.
 */
export function generateEngagementQuestion(
  assetId: number,
  mood: string,
  platformSeed: number
): string {
  const moodKey = mood.trim().toLowerCase();
  const moodPool = MOOD_QUESTIONS[moodKey];

  if (moodPool && moodPool.length > 0) {
    const combinedPool = [...moodPool, ...GENERIC_QUESTIONS];
    const idx = seededIndex(assetId, platformSeed, combinedPool.length);
    return combinedPool[idx] as string;
  }

  const idx = seededIndex(assetId, platformSeed, GENERIC_QUESTIONS.length);
  return GENERIC_QUESTIONS[idx] as string;
}
