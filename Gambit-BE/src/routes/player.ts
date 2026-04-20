import { Router, Request, Response } from "express";
import { supabase } from "../config/supabase";
import { normalizeAddress } from "../utils/helpers";
import { ERRORS } from "../types";
import { getOnlineCount } from "../ws/wsServer";

const router = Router();

/**
 * @openapi
 * /player/{address}/games:
 *   get:
 *     tags: [Player]
 *     summary: Get match history for a player
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Player wallet address
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [waiting, active, completed, cancelled, expired]
 *     responses:
 *       200:
 *         description: List of games for the player
 */
router.get("/:address/games", async (req: Request, res: Response): Promise<void> => {
  try {
    const address = normalizeAddress(req.params.address as string);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string | undefined;

    let query = supabase
      .from("games")
      .select(
        "id, onchain_game_id, white_address, black_address, status, result, mode, stake_amount, time_control, move_count, winner_address, end_reason, started_at, ended_at, created_at"
      )
      .or(`white_address.eq.${address},black_address.eq.${address}`)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Shape each game: add opponent field for convenience
    const games = (data || []).map((g) => ({
      ...g,
      opponent: g.white_address === address ? g.black_address : g.white_address,
      playerColor: g.white_address === address ? "white" : "black",
    }));

    res.json({ games, total: count ?? games.length, limit, offset });
  } catch (err) {
    res.status(500).json(ERRORS.SERVER_ERROR);
  }
});

/**
 * @openapi
 * /player/{address}/transactions:
 *   get:
 *     tags: [Player]
 *     summary: Get transaction history for a player
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of transactions
 */
router.get("/:address/transactions", async (req: Request, res: Response): Promise<void> => {
  try {
    const address = normalizeAddress(req.params.address as string);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const { data, error } = await supabase
      .from("transactions")
      .select("id, game_id, tx_type, tx_hash, amount, status, created_at, confirmed_at")
      .eq("player_address", address)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({ transactions: data || [], limit, offset });
  } catch (err) {
    res.status(500).json(ERRORS.SERVER_ERROR);
  }
});

/**
 * @openapi
 * /player/online:
 *   get:
 *     tags: [Player]
 *     summary: Get current number of online players (active WS connections)
 *     responses:
 *       200:
 *         description: Online player count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 online:
 *                   type: integer
 */
router.get("/online", (_req: Request, res: Response): void => {
  res.json({ online: getOnlineCount() });
});

export default router;
