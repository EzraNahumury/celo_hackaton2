import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { getDailyPuzzle, submitPuzzleAttempt } from "../services/puzzleService";
import { ERRORS } from "../types";

const router = Router();

/**
 * @openapi
 * /puzzle/daily:
 *   get:
 *     tags: [Puzzle]
 *     summary: Get today's daily puzzle
 *     description: Returns the daily chess puzzle. The solution is NOT included in the response.
 *     responses:
 *       200:
 *         description: Daily puzzle
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Puzzle'
 *       404:
 *         description: No puzzle available today
 */
router.get("/daily", async (_req: Request, res: Response): Promise<void> => {
  try {
    const puzzle = await getDailyPuzzle();
    if (!puzzle) {
      res.status(404).json({ error: "No puzzle available today" });
      return;
    }
    res.json(puzzle);
  } catch (err) {
    res.status(500).json(ERRORS.SERVER_ERROR);
  }
});

/**
 * @openapi
 * /puzzle/daily/submit:
 *   post:
 *     tags: [Puzzle]
 *     summary: Submit puzzle answer
 *     description: Submit your solution for the daily puzzle. Each player can only submit once per puzzle.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [puzzleId, moves]
 *             properties:
 *               puzzleId:
 *                 type: string
 *                 example: "puzzle-2026-04-18"
 *               moves:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["h5f7"]
 *                 description: Solution moves in UCI format
 *               timeMs:
 *                 type: integer
 *                 description: Time taken to solve in milliseconds
 *     responses:
 *       200:
 *         description: Submission result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 correct:
 *                   type: boolean
 *                 rank:
 *                   type: integer
 *                 totalParticipants:
 *                   type: integer
 *                 reward:
 *                   type: number
 *       409:
 *         description: Already submitted
 *       410:
 *         description: Puzzle expired
 */
router.post("/daily/submit", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { puzzleId, moves, timeMs } = req.body;
    if (!puzzleId || !moves) {
      res.status(400).json({ error: "puzzleId and moves required" });
      return;
    }

    const result = await submitPuzzleAttempt(puzzleId, req.playerAddress!, moves, timeMs || 0);
    res.json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "PUZZLE_EXPIRED") {
      res.status(ERRORS.PUZZLE_EXPIRED.status).json(ERRORS.PUZZLE_EXPIRED);
    } else if (msg === "PUZZLE_ALREADY_SUBMITTED") {
      res.status(ERRORS.PUZZLE_ALREADY_SUBMITTED.status).json(ERRORS.PUZZLE_ALREADY_SUBMITTED);
    } else {
      res.status(500).json(ERRORS.SERVER_ERROR);
    }
  }
});

export default router;
