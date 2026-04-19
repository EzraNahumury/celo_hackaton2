import cron from "node-cron";
import { supabase } from "../config/supabase";
import { cancelMatch } from "../services/escrowService";
import { logger } from "../utils/logger";

export function startExpireGamesCron(): void {
  // Every minute: expire waiting games past their expires_at
  cron.schedule("* * * * *", async () => {
    try {
      const { data, error } = await supabase
        .from("games")
        .update({
          status: "expired",
          ended_at: new Date().toISOString(),
        })
        .eq("status", "waiting")
        .lt("expires_at", new Date().toISOString())
        .select();

      if (error) {
        logger.error("Expire games cron error", { error: error.message });
        return;
      }

      if (data && data.length > 0) {
        logger.info(`Expired ${data.length} stale games`);

        for (const game of data) {
          // cancelMatch only works for Pending state (no playerB yet).
          // If onchain_game_id is present the match was created on-chain and
          // can be cancelled while still Pending (waiting for playerB to join).
          if (game.onchain_game_id && game.white_address) {
            await cancelMatch(
              game.id,
              BigInt(game.onchain_game_id),
              game.white_address as `0x${string}`
            );
          }
        }
      }
    } catch (err) {
      logger.error("Expire games cron failed", { error: (err as Error).message });
    }
  });

  logger.info("Expire games cron started (every minute)");
}
