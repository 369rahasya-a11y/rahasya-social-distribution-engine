/**
 * dailyReport workflow — generates a daily publishing summary.
 * Outputs to logs for GitHub Actions visibility and debugging.
 */

import { fetchRecentPostLogs } from "../services/supabase";
import { SocialPostLog, Platform } from "../types/socialAsset";
import { logger } from "../utils/logger";

const PLATFORMS: Platform[] = ["facebook", "instagram", "threads"];

/**
 * Generate and log the daily publishing report.
 */
export async function runDailyReport(): Promise<void> {
  logger.info("📊 Generating daily publishing report...");

  const logs = await fetchRecentPostLogs(25); // Last 25 hours

  const divider = "═".repeat(60);

  logger.info("\n" + divider);
  logger.info("📈 RAHASYA DAILY SOCIAL PUBLISHING REPORT");
  logger.info(`   Generated: ${new Date().toISOString()}`);
  logger.info(divider);

  for (const platform of PLATFORMS) {
    const platformLogs = logs.filter((l) => l.platform === platform);
    const published = platformLogs.filter((l) => l.status === "success");
    const failed = platformLogs.filter((l) => l.status === "failed");

    const icon = platform === "facebook" ? "📘"
      : platform === "instagram" ? "📸"
      : "🧵";

    logger.info(`\n${icon} ${platform.toUpperCase()}`);
    logger.info(`   Published: ${published.length} ✅`);
    logger.info(`   Failed:    ${failed.length} ❌`);

    if (published.length > 0) {
      logger.info("   Recent posts:");
      for (const post of published.slice(0, 3)) {
        logger.info(`     • Asset ${post.asset_id} → ${post.post_url || post.post_id || "no URL"}`);
      }
    }

    if (failed.length > 0) {
      logger.info("   Failures:");
      for (const post of failed.slice(0, 3)) {
        logger.error(`     • Asset ${post.asset_id}: ${post.error_message || "unknown error"}`);
      }
    }
  }

  // Total summary
  const totalPublished = logs.filter((l) => l.status === "success").length;
  const totalFailed = logs.filter((l) => l.status === "failed").length;
  const totalAttempts = logs.length;

  logger.info(`\n${divider}`);
  logger.info(`TOTAL: ${totalAttempts} attempts | ${totalPublished} published | ${totalFailed} failed`);
  
  const successRate = totalAttempts > 0
    ? Math.round((totalPublished / totalAttempts) * 100)
    : 0;
  logger.info(`Success Rate: ${successRate}%`);
  logger.info(divider);

  // Retry candidates
  const retryPending = logs.filter(
    (l) => l.status === "failed" && l.retry_count < 3
  );
  if (retryPending.length > 0) {
    logger.info(
      `\n⏳ ${retryPending.length} post(s) queued for retry`
    );
  }
}

// ── Entry point ───────────────────────────────────────────────────────────

if (require.main === module) {
  runDailyReport()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("❌ Daily report error", {
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    });
}
