import { Router, Request, Response } from "express";
import { supabase } from "../config/supabase";
import { ERRORS } from "../types";

const router = Router();

/**
 * @openapi
 * /leaderboard:
 *   get:
 *     tags: [Leaderboard]
 *     summary: Get player leaderboard
 *     description: Returns ranked list of players sorted by ELO rating. Can be filtered by time period.
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [weekly, monthly, all]
 *           default: all
 *         description: Time period filter
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of entries to return
 *     responses:
 *       200:
 *         description: Leaderboard entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 period:
 *                   type: string
 *                 entries:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LeaderboardEntry'
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const period = (req.query.period as string) || "all";
    const limit = parseInt((req.query.limit as string) || "20", 10);

    // Try RPC first, fallback to direct query
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_leaderboard", {
      p_period: period,
      p_limit: limit,
    });

    if (!rpcError && rpcData) {
      res.json({ period, entries: rpcData });
      return;
    }

    // Fallback: direct query
    const { data, error } = await supabase
      .from("players")
      .select("wallet_address, username, rating, wins, losses, draws, total_earned")
      .order("rating", { ascending: false })
      .limit(limit);

    if (error) {
      res.status(500).json(ERRORS.SERVER_ERROR);
      return;
    }

    const entries = (data || []).map((p, i) => ({
      rank: i + 1,
      address: p.wallet_address,
      username: p.username,
      wins: p.wins,
      losses: p.losses,
      draws: p.draws,
      rating: p.rating,
      totalEarned: p.total_earned,
    }));

    res.json({ period, entries });
  } catch (err) {
    res.status(500).json(ERRORS.SERVER_ERROR);
  }
});

export default router;
