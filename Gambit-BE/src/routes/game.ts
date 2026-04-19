import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  createGame,
  joinGame,
  getGame,
  getLobby,
  makeMove,
  resignGame,
  getGameMoves,
} from "../services/gameService";
import { isValidStake, isValidTimeControl } from "../utils/helpers";
import { ERRORS } from "../types";
import { logger } from "../utils/logger";

const router = Router();

/**
 * @openapi
 * /game/create:
 *   post:
 *     tags: [Game]
 *     summary: Create a new game
 *     description: Creates a new chess game. For PvP mode, the game starts in "waiting" status. For bot mode, it starts immediately as "active".
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stake]
 *             properties:
 *               stake:
 *                 type: string
 *                 enum: ["0.50", "1.00", "2.00"]
 *                 description: Stake amount in cUSD
 *               timeControl:
 *                 type: string
 *                 default: "3+0"
 *                 description: "Time control (e.g. 3+0, 5+3, 10+0)"
 *               color:
 *                 type: string
 *                 enum: [white, black, random]
 *                 default: random
 *               mode:
 *                 type: string
 *                 enum: [pvp, bot]
 *                 default: pvp
 *     responses:
 *       201:
 *         description: Game created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gameId:
 *                   type: string
 *                   format: uuid
 *                 onchainGameId:
 *                   type: string
 *                 status:
 *                   type: string
 *                 depositTx:
 *                   type: object
 *                   properties:
 *                     to:
 *                       type: string
 *                     functionName:
 *                       type: string
 *                     args:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Invalid stake or time control
 *       401:
 *         description: Authentication required
 */
router.post("/create", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stake, timeControl = "3+0", color = "random", mode = "pvp" } = req.body;
    const stakeNum = parseFloat(stake);

    if (!isValidStake(stakeNum)) {
      res.status(400).json({ error: "Invalid stake. Must be 0.50, 1.00, or 2.00" });
      return;
    }
    if (!isValidTimeControl(timeControl)) {
      res.status(400).json({ error: "Invalid time control" });
      return;
    }

    const game = await createGame(req.playerAddress!, stakeNum, timeControl, color, mode);

    res.status(201).json({
      gameId: game.id,
      onchainGameId: game.onchain_game_id,
      status: game.status,
      depositTx: {
        to: process.env.CHESS_ESCROW_ADDRESS || null,
        functionName: "depositStake",
        args: [game.onchain_game_id, stake],
      },
    });
  } catch (err) {
    logger.error("Create game failed", { error: (err as Error).message, stack: (err as Error).stack });
    res.status(500).json(ERRORS.SERVER_ERROR);
  }
});

/**
 * @openapi
 * /game/join:
 *   post:
 *     tags: [Game]
 *     summary: Join a waiting game
 *     description: Join an existing PvP game that is in "waiting" status. The joining player is assigned the remaining color.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gameId]
 *             properties:
 *               gameId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Joined game successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gameId:
 *                   type: string
 *                 white:
 *                   type: string
 *                 black:
 *                   type: string
 *                 stake:
 *                   type: number
 *                 depositTx:
 *                   type: object
 *       404:
 *         description: Game not found
 *       409:
 *         description: Game is full or already joined
 */
router.post("/join", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId } = req.body;
    if (!gameId) {
      res.status(400).json({ error: "gameId required" });
      return;
    }

    const game = await joinGame(gameId, req.playerAddress!);

    res.json({
      gameId: game.id,
      white: game.white_address,
      black: game.black_address,
      stake: game.stake_amount,
      depositTx: {
        to: process.env.CHESS_ESCROW_ADDRESS || null,
        functionName: "depositStake",
        args: [game.onchain_game_id, game.stake_amount.toString()],
      },
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "GAME_NOT_FOUND") {
      res.status(ERRORS.GAME_NOT_FOUND.status).json(ERRORS.GAME_NOT_FOUND);
    } else if (msg === "GAME_FULL") {
      res.status(ERRORS.GAME_FULL.status).json(ERRORS.GAME_FULL);
    } else {
      res.status(500).json(ERRORS.SERVER_ERROR);
    }
  }
});

/**
 * @openapi
 * /game/lobby:
 *   get:
 *     tags: [Game]
 *     summary: List waiting games
 *     description: Returns all PvP games with "waiting" status that haven't expired yet. Can be filtered by stake and time control.
 *     parameters:
 *       - in: query
 *         name: stake
 *         schema:
 *           type: number
 *           enum: [0.50, 1.00, 2.00]
 *         description: Filter by stake amount
 *       - in: query
 *         name: timeControl
 *         schema:
 *           type: string
 *         description: Filter by time control (e.g. "3+0")
 *     responses:
 *       200:
 *         description: List of waiting games
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 games:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Game'
 */
router.get("/lobby", async (req: Request, res: Response): Promise<void> => {
  try {
    const stake = req.query.stake ? parseFloat(req.query.stake as string) : undefined;
    const timeControl = req.query.timeControl as string | undefined;

    const games = await getLobby(stake, timeControl);
    res.json({ games });
  } catch (err) {
    res.status(500).json(ERRORS.SERVER_ERROR);
  }
});

/**
 * @openapi
 * /game/{gameId}:
 *   get:
 *     tags: [Game]
 *     summary: Get game state
 *     description: Returns the full game state including current FEN, clock times, and move history.
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Game state with moves
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Game'
 *                 - type: object
 *                   properties:
 *                     moves:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Move'
 *       404:
 *         description: Game not found
 */
router.get("/:gameId", async (req: Request, res: Response): Promise<void> => {
  try {
    const gameId = req.params.gameId as string;
    const game = await getGame(gameId);
    if (!game) {
      res.status(ERRORS.GAME_NOT_FOUND.status).json(ERRORS.GAME_NOT_FOUND);
      return;
    }

    const moves = await getGameMoves(game.id);
    res.json({ ...game, moves });
  } catch (err) {
    res.status(500).json(ERRORS.SERVER_ERROR);
  }
});

/**
 * @openapi
 * /game/{gameId}/move:
 *   post:
 *     tags: [Game]
 *     summary: Make a move
 *     description: Submit a chess move in UCI format (e.g. "e2e4", "e1g1" for castling). In bot mode, the bot's response move is included in the response.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [move]
 *             properties:
 *               move:
 *                 type: string
 *                 example: "e2e4"
 *                 description: Move in UCI format
 *     responses:
 *       200:
 *         description: Move result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MoveResult'
 *       401:
 *         description: Authentication required
 *       422:
 *         description: Invalid move or not your turn
 */
router.post("/:gameId/move", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { move } = req.body;
    if (!move) {
      res.status(400).json({ error: "move required" });
      return;
    }

    const result = await makeMove(req.params.gameId as string, req.playerAddress!, move);

    if (!result.valid) {
      res.status(ERRORS.INVALID_MOVE.status).json({
        ...ERRORS.INVALID_MOVE,
        reason: result.reason,
      });
      return;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json(ERRORS.SERVER_ERROR);
  }
});

/**
 * @openapi
 * /game/{gameId}/resign:
 *   post:
 *     tags: [Game]
 *     summary: Resign from a game
 *     description: The authenticated player resigns, awarding the win to the opponent. Updates ELO ratings and triggers smart contract payout.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Resignation accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   enum: [white_win, black_win]
 *                 payoutTxHash:
 *                   type: string
 *                   nullable: true
 *       404:
 *         description: Game not found
 *       409:
 *         description: Game already ended
 */
router.post("/:gameId/resign", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await resignGame(req.params.gameId as string, req.playerAddress!);
    res.json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "GAME_NOT_FOUND") {
      res.status(ERRORS.GAME_NOT_FOUND.status).json(ERRORS.GAME_NOT_FOUND);
    } else if (msg === "GAME_ALREADY_ENDED") {
      res.status(ERRORS.GAME_ALREADY_ENDED.status).json(ERRORS.GAME_ALREADY_ENDED);
    } else {
      res.status(500).json(ERRORS.SERVER_ERROR);
    }
  }
});

export default router;
