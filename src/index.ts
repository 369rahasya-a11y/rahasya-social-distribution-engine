/**
 * Rahasya Social Distribution Engine
 * Main entry point.
 *
 * By default, runs the full publish workflow.
 * Use the npm scripts for specific commands.
 */

import { runPublishWorkflow } from "./workflows/publishSocial.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  logger.info("🌟 Rahasya Social Distribution Engine starting...");
  const summary = await runPublishWorkflow();
  process.exit(summary.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  logger.error("Fatal error", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
