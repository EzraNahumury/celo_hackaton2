import cron from "node-cron";
import { generateDailyPuzzle } from "../services/puzzleService";
import { logger } from "../utils/logger";

export function startDailyPuzzleCron(): void {
  // Every day at 00:00 UTC
  cron.schedule("0 0 * * *", async () => {
    try {
      await generateDailyPuzzle();
      logger.info("Daily puzzle generated via cron");
    } catch (err) {
      logger.error("Daily puzzle cron failed", { error: (err as Error).message });
    }
  });

  // Also generate on startup if none exists for today
  generateDailyPuzzle().catch((err) => {
    logger.warn("Startup puzzle generation failed", { error: (err as Error).message });
  });

  logger.info("Daily puzzle cron started (00:00 UTC)");
}
