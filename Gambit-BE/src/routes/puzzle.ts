import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  getNextPuzzle,
  validatePuzzleMove,
  getPuzzleHint,
  getDailyPrizeStatus,
  submitPuzzle,
} from "../services/puzzleService";
import { ERRORS } from "../types";

const router = Router();

/**
 * GET /puzzle/next
 * Get the next unseen Lichess puzzle for the authenticated player.
 * Falls back to cached or local puzzles if Lichess API is unavailable.
 */
router.get("/next", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const puzzle = await getNextPuzzle(req.playerAddress!);
    res.json(puzzle);
  } catch (err) {
    res.status(500).json(ERRORS.SERVER_ERROR);
  }
});

/**
 * GET /puzzle/status
 * Get today's prize status for the authenticated player.
 * { prizesEarned, prizesRemaining, totalPlayedToday, maxDailyPrizes, prizeAmountCusd }
 */
router.get("/status", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const status = await getDailyPrizeStatus(req.playerAddress!);
    res.json(status);
  } catch (err) {
    res.status(500).json(ERRORS.SERVER_ERROR);
  }
});

/**
 * POST /puzzle/move
 * Validate a single player move step-by-step (no auth required — does not record anything).
 * Body: { puzzleId: string, moveIndex: number, move: string (UCI) }
 * Response: { correct: boolean, opponentMove?: string, puzzleComplete: boolean }
 */
router.post("/move", async (req: Request, res: Response): Promise<void> => {
  try {
    const { puzzleId, moveIndex, move } = req.body;
    if (!puzzleId || move === undefined || moveIndex === undefined) {
      res.status(400).json({ error: "puzzleId, moveIndex, and move are required" });
      return;
    }
    const result = await validatePuzzleMove(puzzleId, Number(moveIndex), String(move));
    res.json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "PUZZLE_NOT_FOUND") {
      res.status(404).json({ error: "Puzzle not found" });
    } else {
      res.status(500).json(ERRORS.SERVER_ERROR);
    }
  }
});

/**
 * GET /puzzle/hint
 * Return the correct move for the current step (disqualifies from prize on submit).
 * Query: puzzleId=...&step=N
 */
router.get("/hint", async (req: Request, res: Response): Promise<void> => {
  try {
    const puzzleId = req.query.puzzleId as string | undefined;
    const step = req.query.step as string | undefined;
    if (!puzzleId || step === undefined) {
      res.status(400).json({ error: "puzzleId and step query params are required" });
      return;
    }
    const result = await getPuzzleHint(puzzleId, Number(step));
    res.json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "PUZZLE_NOT_FOUND") {
      res.status(404).json({ error: "Puzzle not found" });
    } else if (msg === "INVALID_MOVE_INDEX") {
      res.status(400).json({ error: "Invalid step index" });
    } else {
      res.status(500).json(ERRORS.SERVER_ERROR);
    }
  }
});

/**
 * POST /puzzle/submit
 * Submit completed puzzle moves. Pays 0.01 cUSD if correct and under daily limit.
 * Body: { puzzleId, moves: string[], timeMs: number, usedHint?: boolean }
 * Response: { correct, prizeEarned, prizeAmountCusd, txHash, prizesEarned, prizesRemaining }
 */
router.post("/submit", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { puzzleId, moves, timeMs, usedHint } = req.body;
    if (!puzzleId || !Array.isArray(moves)) {
      res.status(400).json({ error: "puzzleId and moves[] are required" });
      return;
    }
    const result = await submitPuzzle(
      puzzleId,
      req.playerAddress!,
      moves,
      Number(timeMs) || 0,
      !!usedHint
    );
    res.json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "PUZZLE_NOT_FOUND") {
      res.status(404).json({ error: "Puzzle not found" });
    } else {
      res.status(500).json(ERRORS.SERVER_ERROR);
    }
  }
});

export default router;
