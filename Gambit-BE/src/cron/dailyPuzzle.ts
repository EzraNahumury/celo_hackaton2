import cron from "node-cron";
import { fetchLichessPuzzle, getRandomFallbackPuzzle } from "../services/lichessService";
import { supabase } from "../config/supabase";
import { logger } from "../utils/logger";

/**
 * Pre-fetch a batch of Lichess puzzles every day at 00:00 UTC so players
 * always have fresh puzzles available even if the Lichess API is slow.
 */
async function prefetchPuzzles(): Promise<void> {
  const BATCH_SIZE = 10;
  let fetched = 0;

  for (let i = 0; i < BATCH_SIZE; i++) {
    const puzzle = await fetchLichessPuzzle();
    if (!puzzle) {
      // Lichess unavailable — seed fallback puzzles instead
      const fallback = getRandomFallbackPuzzle();
      await supabase.from("lichess_puzzles").upsert({
        id: fallback.id,
        fen: fallback.fen,
        to_move: fallback.to_move,
        solution: fallback.solution,
        rating: fallback.rating,
        themes: fallback.themes ?? [],
      });
      fetched++;
      break; // no point retrying Lichess if it's down
    }

    const { error } = await supabase.from("lichess_puzzles").upsert({
      id: puzzle.id,
      fen: puzzle.fen,
      to_move: puzzle.to_move,
      solution: puzzle.solution,
      rating: puzzle.rating,
      themes: puzzle.themes,
    });

    if (!error) fetched++;
    // Small delay to be polite to the Lichess API
    await new Promise((r) => setTimeout(r, 300));
  }

  logger.info("Puzzle prefetch complete", { fetched });
}

export function startDailyPuzzleCron(): void {
  // Every day at 00:00 UTC: pre-fetch fresh puzzles for the new day
  cron.schedule("0 0 * * *", async () => {
    try {
      await prefetchPuzzles();
      logger.info("Daily puzzle prefetch done via cron");
    } catch (err) {
      logger.error("Daily puzzle prefetch cron failed", { error: (err as Error).message });
    }
  });

  // Also pre-fetch on startup so puzzles are available immediately
  prefetchPuzzles().catch((err) => {
    logger.warn("Startup puzzle prefetch failed", { error: (err as Error).message });
  });

  logger.info("Daily puzzle cron started (prefetches Lichess puzzles at 00:00 UTC)");
}
