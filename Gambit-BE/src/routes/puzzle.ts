import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { getDailyPuzzle, submitPuzzleAttempt, getPuzzleProof, validatePuzzleMove, getPuzzleHint } from "../services/puzzleService";
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
    const { puzzleId, moves, timeMs, usedHint } = req.body;
    if (!puzzleId || !moves) {
      res.status(400).json({ error: "puzzleId and moves required" });
      return;
    }

    const result = await submitPuzzleAttempt(puzzleId, req.playerAddress!, moves, timeMs || 0, !!usedHint);
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

/**
 * POST /puzzle/daily/move
 * Validate a single player move against the puzzle solution (no auth required).
 * Returns the opponent's response move if the move is correct, and whether the puzzle is complete.
 * Body: { puzzleId: string, moveIndex: number, move: string (UCI) }
 */
router.post("/daily/move", async (req: Request, res: Response): Promise<void> => {
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
 * GET /puzzle/daily/hint?puzzleId=...&step=N
 * Returns the correct move for the current step so the frontend can highlight it.
 * No auth required — but using a hint disqualifies the player from the prize (handled on submit).
 */
router.get("/daily/hint", async (req: Request, res: Response): Promise<void> => {
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
 * @openapi
 * /puzzle/daily/proof:
 *   get:
 *     tags: [Puzzle]
 *     summary: Get Merkle proof for today's puzzle prize claim
 *     description: >
 *       Shorthand for /puzzle/{today}/proof — the frontend calls this after
 *       the round is finalized. Returns proof + amount (wei) for
 *       PuzzlePool.claim(day, amount, proof).
 *     parameters:
 *       - in: query
 *         name: addr
 *         required: true
 *         schema:
 *           type: string
 *         description: Player wallet address
 *     responses:
 *       200:
 *         description: Proof data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 amount:
 *                   type: string
 *                   example: "500000000000000000"
 *                 proof:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Missing addr query param
 *       404:
 *         description: Round not finalized yet or address is not a winner
 */
router.get("/daily/proof", async (req: Request, res: Response): Promise<void> => {
  try {
    // Accept both `addr` (FE convention) and `address` (REST convention)
    const address = (req.query.addr || req.query.address) as string | undefined;

    if (!address) {
      res.status(400).json({ error: "addr query param required" });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const result = await getPuzzleProof(today, address);
    if (!result) {
      res.status(404).json({ error: "Not a winner or round not yet finalized" });
      return;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json(ERRORS.SERVER_ERROR);
  }
});

/**
 * @openapi
 * /puzzle/{day}/proof:
 *   get:
 *     tags: [Puzzle]
 *     summary: Get Merkle proof for claiming puzzle prize
 *     description: >
 *       Returns the Merkle proof and amount (in wei) needed to call
 *       PuzzlePool.claim(day, amount, proof) on-chain.
 *       Returns 404 if the round hasn't been finalized yet or the address
 *       is not a winner.
 *     parameters:
 *       - in: path
 *         name: day
 *         required: true
 *         schema:
 *           type: string
 *           example: "2026-04-19"
 *         description: Puzzle date (YYYY-MM-DD)
 *       - in: query
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Player wallet address
 *     responses:
 *       200:
 *         description: Proof data for on-chain claim
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 amount:
 *                   type: string
 *                   description: Prize amount in wei (pass directly to PuzzlePool.claim)
 *                   example: "500000000000000000"
 *                 proof:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Merkle proof array of bytes32 hex strings
 *       400:
 *         description: Missing address query param or invalid date
 *       404:
 *         description: Round not finalized yet or address is not a winner
 */
router.get("/:day/proof", async (req: Request, res: Response): Promise<void> => {
  try {
    const { day } = req.params as { day: string };
    const address = req.query.address as string | undefined;

    if (!address) {
      res.status(400).json({ error: "address query param required" });
      return;
    }

    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      res.status(400).json({ error: "day must be in YYYY-MM-DD format" });
      return;
    }

    const result = await getPuzzleProof(day, address);
    if (!result) {
      res.status(404).json({
        error: "Not a winner or round not yet finalized",
      });
      return;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json(ERRORS.SERVER_ERROR);
  }
});

export default router;
