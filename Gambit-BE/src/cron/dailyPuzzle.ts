import cron from "node-cron";
import { generateDailyPuzzle, finalizePuzzleRound } from "../services/puzzleService";
import { logger } from "../utils/logger";

export function startDailyPuzzleCron(): void {
  // Every day at 00:00 UTC: finalize yesterday's round, then generate today's puzzle
  cron.schedule("0 0 * * *", async () => {
    // Finalize yesterday
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    try {
      const result = await finalizePuzzleRound(yesterday);
      logger.info("Puzzle round finalized via cron", {
        puzzleDate: yesterday,
        winners: result.winners,
        merkleRoot: result.merkleRoot,
      });
    } catch (err) {
      logger.error("Puzzle finalization cron failed", {
        puzzleDate: yesterday,
        error: (err as Error).message,
      });
    }

    // Generate today's new puzzle
    try {
      await generateDailyPuzzle();
      logger.info("Daily puzzle generated via cron");
    } catch (err) {
      logger.error("Daily puzzle generation cron failed", { error: (err as Error).message });
    }
  });

  // Also generate on startup if none exists for today
  generateDailyPuzzle().catch((err) => {
    logger.warn("Startup puzzle generation failed", { error: (err as Error).message });
  });

  logger.info("Daily puzzle cron started (00:00 UTC — finalizes yesterday + generates today)");
}
