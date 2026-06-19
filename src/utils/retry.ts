/**
 * Retry utility with configurable backoff.
 * Used internally by publishers for transient API failures.
 */

import { logger } from "./logger.js";

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
  label?: string;
}

/**
 * Retry an async operation with exponential backoff.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
    label = "operation",
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error)) {
        break;
      }

      const waitMs = delayMs * Math.pow(backoffMultiplier, attempt - 1);
      logger.warn(`⏳ ${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${waitMs}ms`, {
        error: error instanceof Error ? error.message : String(error),
      });

      await sleep(waitMs);
    }
  }

  throw lastError;
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine if an API error is a token/auth issue (don't retry these).
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("token") ||
      msg.includes("expired") ||
      msg.includes("invalid_token") ||
      msg.includes("oauth") ||
      msg.includes("unauthorized") ||
      msg.includes("permission") ||
      msg.includes("190") || // FB error code: invalid token
      msg.includes("102") // FB error code: session expired
    );
  }
  return false;
}

/**
 * Determine if an API error is rate limiting (retry with longer delay).
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("rate limit") ||
      msg.includes("too many requests") ||
      msg.includes("32") || // FB error code: rate limit
      msg.includes("4")    // FB error code: application level rate limit
    );
  }
  return false;
}
