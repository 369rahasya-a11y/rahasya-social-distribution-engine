/**
 * Environment configuration with strict validation.
 * All required env vars are validated at startup — fail fast, never silently.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(
      `❌ Missing required environment variable: ${key}\n` +
        `   Add it to your .env file or GitHub Secrets.\n` +
        `   See .env.example for reference.`
    );
  }
  return value.trim();
}

function optionalEnv(key: string, defaultValue = ""): string {
  return (process.env[key] || defaultValue).trim();
}

// Load .env in non-production environments
if (process.env["NODE_ENV"] !== "production") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    (require("dotenv") as any).config();
  } catch {
    // dotenv is optional — GitHub Actions uses secrets directly
  }
}

export const env = {
  // ── Supabase ────────────────────────────────────────────────
  SUPABASE_URL: requireEnv("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),

  // ── Facebook ────────────────────────────────────────────────
  FACEBOOK_PAGE_ID: requireEnv("FACEBOOK_PAGE_ID"),
  FACEBOOK_ACCESS_TOKEN: requireEnv("FACEBOOK_ACCESS_TOKEN"),

  // ── Instagram ───────────────────────────────────────────────
  INSTAGRAM_BUSINESS_ID: requireEnv("INSTAGRAM_BUSINESS_ID"),
  // Instagram uses the same Facebook access token (linked account)
  get INSTAGRAM_ACCESS_TOKEN(): string {
    return this.FACEBOOK_ACCESS_TOKEN;
  },

  // ── Threads ─────────────────────────────────────────────────
  THREADS_USER_ID: requireEnv("THREADS_USER_ID"),
  THREADS_ACCESS_TOKEN: requireEnv("THREADS_ACCESS_TOKEN"),

  // ── Runtime ─────────────────────────────────────────────────
  NODE_ENV: optionalEnv("NODE_ENV", "production"),
  LOG_LEVEL: optionalEnv("LOG_LEVEL", "info"),
  IS_DRY_RUN: process.env["DRY_RUN"] === "true",
} as const;

// ── API base URLs ────────────────────────────────────────────────────────

export const API_URLS = {
  GRAPH_API: "https://graph.facebook.com/v21.0",
  THREADS_API: "https://graph.threads.net/v1.0",
} as const;

// ── Retry configuration ──────────────────────────────────────────────────

export const RETRY_CONFIG = {
  delays: [0, 15 * 60 * 1000, 60 * 60 * 1000, 6 * 60 * 60 * 1000], // 0, 15m, 1h, 6h
  maxAttempts: 4,
  lockTimeoutMs: 10 * 60 * 1000, // 10 minutes — stale lock threshold
} as const;

// ── Rate limits (conservative) ────────────────────────────────────────────

export const RATE_LIMITS = {
  delayBetweenPlatformsMs: 5000,
  delayBetweenAssetsMs: 15000,
} as const;
