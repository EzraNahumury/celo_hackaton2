import { validateMove } from "./chessEngine";
import { logger } from "../utils/logger";

const SKILL_LEVELS: Record<number, { skillLevel: number; depth: number }> = {
  1: { skillLevel: 0, depth: 1 },
  2: { skillLevel: 5, depth: 3 },
  3: { skillLevel: 10, depth: 5 },
  4: { skillLevel: 15, depth: 8 },
  5: { skillLevel: 20, depth: 12 },
};

// Simple bot that picks a random legal move with depth-based filtering
// Real Stockfish WASM integration would use worker_threads
export async function getBestMove(fen: string, difficulty: number = 3): Promise<string> {
  const { Chess } = await import("chess.js");
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });

  if (moves.length === 0) {
    throw new Error("No legal moves available");
  }

  const config = SKILL_LEVELS[difficulty] || SKILL_LEVELS[3];

  // For lower difficulties, pick more randomly
  // For higher difficulties, prefer captures and checks
  let selectedMove;

  if (config.skillLevel >= 15) {
    // Prefer checkmates, then checks, then captures
    const checkmates = moves.filter((m) => {
      const test = new Chess(fen);
      test.move(m);
      return test.isCheckmate();
    });
    if (checkmates.length > 0) {
      selectedMove = checkmates[0];
    } else {
      const checks = moves.filter((m) => m.san.includes("+"));
      const captures = moves.filter((m) => m.captured);
      const preferred = [...checks, ...captures];
      selectedMove =
        preferred.length > 0 && Math.random() > 0.3
          ? preferred[Math.floor(Math.random() * preferred.length)]
          : moves[Math.floor(Math.random() * moves.length)];
    }
  } else {
    selectedMove = moves[Math.floor(Math.random() * moves.length)];
  }

  const uciMove =
    selectedMove.from +
    selectedMove.to +
    (selectedMove.promotion || "");

  logger.debug("Bot move generated", { fen, difficulty, move: uciMove });
  return uciMove;
}
