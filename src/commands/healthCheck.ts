/**
 * healthCheck command — validates all credentials and connections.
 * Run with: npm run health-check
 */

import { runHealthCheck } from "../services/health.js";
import { logger } from "../utils/logger.js";

async function run(): Promise<void> {
  logger.info("🏥 Rahasya Social Distribution Engine — Health Check\n");

  const status = await runHealthCheck();

  if (!status.healthy) {
    logger.error("\n❌ UNHEALTHY — Fix the errors above before running the publisher.");
    logger.error("\nCommon fixes:");
    logger.error("  • Facebook/Instagram token expired → regenerate at developers.facebook.com");
    logger.error("  • Threads token expired → re-authenticate via Threads API");
    logger.error("  • Supabase connection failed → check SUPABASE_URL and SERVICE_ROLE_KEY");
    process.exit(1);
  }

  logger.info("\n✅ All systems go! Ready to publish.");
  process.exit(0);
}

run().catch((err) => {
  logger.error("Health check threw an exception", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
