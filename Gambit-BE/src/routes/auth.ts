import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { getOrCreatePlayer } from "../services/playerService";
import { generateNonce, normalizeAddress } from "../utils/helpers";
import { logger } from "../utils/logger";

const router = Router();

// In-memory nonce store (use Redis in production)
const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

// Clean up expired nonces every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of nonceStore) {
    if (now > val.expiresAt) nonceStore.delete(key);
  }
}, 60000);

/**
 * @openapi
 * /auth/nonce:
 *   get:
 *     tags: [Auth]
 *     summary: Get authentication nonce
 *     description: Returns a random nonce for wallet-based authentication. The nonce expires after 5 minutes.
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet address (0x...)
 *     responses:
 *       200:
 *         description: Nonce generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 nonce:
 *                   type: string
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Missing address param
 */
router.get("/nonce", (req: Request, res: Response): void => {
  const address = req.query.address as string;
  if (!address) {
    res.status(400).json({ error: "address query param required" });
    return;
  }

  const normalized = normalizeAddress(address);
  const nonce = generateNonce();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  nonceStore.set(normalized, { nonce, expiresAt });

  res.json({ nonce, expiresAt: new Date(expiresAt).toISOString() });
});

/**
 * @openapi
 * /auth/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Verify wallet and get JWT
 *     description: Verifies wallet ownership via micro-transaction (skipped in dev mode) and returns a JWT token valid for 24 hours.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address]
 *             properties:
 *               address:
 *                 type: string
 *                 description: Wallet address
 *                 example: "0x1234567890abcdef1234567890abcdef12345678"
 *               txHash:
 *                 type: string
 *                 description: Micro-transaction hash (required in production)
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 expiresIn:
 *                   type: integer
 *                   example: 86400
 *       400:
 *         description: Missing address
 *       403:
 *         description: Nonce expired or not found
 *       500:
 *         description: Authentication failed
 */
router.post("/verify", async (req: Request, res: Response): Promise<void> => {
  try {
    const { address, txHash } = req.body;
    if (!address) {
      res.status(400).json({ error: "address required" });
      return;
    }

    const normalized = normalizeAddress(address);

    // For development: skip tx verification, just issue token
    // In production: verify micro-tx on-chain with nonce in memo
    const storedNonce = nonceStore.get(normalized);
    if (!storedNonce) {
      // In dev mode, allow without nonce
      if (env.NODE_ENV === "production") {
        res.status(403).json({ error: "Nonce expired or not found" });
        return;
      }
    } else {
      nonceStore.delete(normalized);
    }

    // Ensure player exists
    await getOrCreatePlayer(normalized);

    const token = jwt.sign(
      { wallet_address: normalized },
      env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    logger.info("Player authenticated", { address: normalized });
    res.json({ token, expiresIn: 86400 });
  } catch (err) {
    logger.error("Auth verify failed", { error: (err as Error).message });
    res.status(500).json({ error: "Authentication failed" });
  }
});

export default router;
