/**
 * Structured logger for the Rahasya Social Distribution Engine.
 * Outputs JSON-friendly logs suitable for GitHub Actions and log aggregators.
 */

import { env } from "../config/env.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const ICONS: Record<LogLevel, string> = {
  debug: "🔍",
  info: "ℹ️ ",
  warn: "⚠️ ",
  error: "❌",
};

function getCurrentLevel(): number {
  const level = (env.LOG_LEVEL || "info").toLowerCase() as LogLevel;
  return LEVELS[level] ?? LEVELS["info"];
}

function formatMessage(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): string {
  const ts = new Date().toISOString();
  const icon = ICONS[level];
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  return `${ts} ${icon} [${level.toUpperCase()}] ${message}${contextStr}`;
}

function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): void {
  if (LEVELS[level] < getCurrentLevel()) return;

  const formatted = formatMessage(level, message, context);

  if (level === "error" || level === "warn") {
    console.error(formatted);
  } else {
    console.log(formatted);
  }
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) =>
    log("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) =>
    log("error", msg, ctx),

  // Convenience: log publish start
  publishStart: (platform: string, assetId: number) =>
    log("info", `📤 Publishing to ${platform}`, { assetId, platform }),

  // Convenience: log publish success
  publishSuccess: (platform: string, assetId: number, postId: string) =>
    log("info", `✅ Published to ${platform}`, { assetId, platform, postId }),

  // Convenience: log publish failure
  publishFailure: (platform: string, assetId: number, error: string) =>
    log("error", `❌ Failed to publish to ${platform}`, {
      assetId,
      platform,
      error,
    }),

  // Convenience: log skip
  publishSkip: (platform: string, assetId: number, reason: string) =>
    log("info", `⏭️  Skipped ${platform}`, { assetId, platform, reason }),
};
