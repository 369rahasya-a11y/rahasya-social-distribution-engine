/**
 * Health check service — validates all external dependencies.
 */

import { testSupabaseConnection } from "./supabase.js";
import { validateFacebookCredentials } from "./facebook.js";
import { validateInstagramCredentials } from "./instagram.js";
import { validateThreadsCredentials } from "./threads.js";
import { logger } from "../utils/logger.js";

export interface HealthStatus {
  healthy: boolean;
  supabase: { ok: boolean; error?: string };
  facebook: { ok: boolean; error?: string; pageName?: string };
  instagram: { ok: boolean; error?: string; username?: string };
  threads: { ok: boolean; error?: string; username?: string };
  checkedAt: string;
}

/**
 * Run a full health check across all services.
 */
export async function runHealthCheck(): Promise<HealthStatus> {
  logger.info("🏥 Running health checks...");

  const [supabase, facebook, instagram, threads] = await Promise.allSettled([
    testSupabaseConnection(),
    validateFacebookCredentials(),
    validateInstagramCredentials(),
    validateThreadsCredentials(),
  ]);

  const status: HealthStatus = {
    healthy: false,
    supabase: supabase.status === "fulfilled"
      ? supabase.value
      : { ok: false, error: "Check threw an exception" },
    facebook: facebook.status === "fulfilled"
      ? facebook.value
      : { ok: false, error: "Check threw an exception" },
    instagram: instagram.status === "fulfilled"
      ? instagram.value
      : { ok: false, error: "Check threw an exception" },
    threads: threads.status === "fulfilled"
      ? threads.value
      : { ok: false, error: "Check threw an exception" },
    checkedAt: new Date().toISOString(),
  };

  status.healthy =
    status.supabase.ok &&
    status.facebook.ok &&
    status.instagram.ok &&
    status.threads.ok;

  // Log results
  const tick = (ok: boolean) => (ok ? "✅" : "❌");

  logger.info("Health check results:", {
    supabase: `${tick(status.supabase.ok)} ${status.supabase.error || "OK"}`,
    facebook: `${tick(status.facebook.ok)} ${status.facebook.error || `Page: ${status.facebook.pageName || "OK"}`}`,
    instagram: `${tick(status.instagram.ok)} ${status.instagram.error || `@${status.instagram.username || "OK"}`}`,
    threads: `${tick(status.threads.ok)} ${status.threads.error || `@${status.threads.username || "OK"}`}`,
  });

  if (!status.healthy) {
    logger.error("❌ Health check FAILED — some services are unhealthy");
  } else {
    logger.info("✅ All services healthy");
  }

  return status;
}
