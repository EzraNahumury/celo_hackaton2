/**
 * escrowService.ts
 *
 * Integrates with MatchEscrow.sol (and GambitHub.sol) on Celo.
 *
 * Key design notes:
 *  - MatchEscrow uses uint256 matchId (auto-increment), NOT bytes32.
 *  - Stakes are in native CELO (msg.value), NOT cUSD ERC-20.
 *  - settleMatch requires an oracle ECDSA signature:
 *      digest = keccak256(abi.encodePacked(matchId, winner, block.chainid))
 *    The oracle account must hold ORACLE_ROLE in GambitHub.
 *  - cancelMatch only works while MatchState == Pending (before playerB joins).
 *    Once Active the only on-chain exit is settleMatch or claimForfeit.
 */

import {
  walletClient,
  publicClient,
  oracleAccount,
} from "../config/blockchain";
import { env } from "../config/env";
import { supabase } from "../config/supabase";
import { logger } from "../utils/logger";
import MatchEscrowABI from "../contracts/MatchEscrow.json";
import { encodeAbiParameters, keccak256, toBytes } from "viem";

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

// ── Retry helper ─────────────────────────────────────────────────────────────

async function retryTx<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      logger.warn(`TX retry ${i + 1}/${MAX_RETRIES}`, {
        error: lastError.message,
      });
      if (i < MAX_RETRIES - 1) {
        await new Promise((r) =>
          setTimeout(r, RETRY_BASE_MS * Math.pow(2, i))
        );
      }
    }
  }
  throw lastError;
}

// ── Oracle signature builder ──────────────────────────────────────────────────

/**
 * Build the oracle signature for settleMatch.
 *
 * Solidity: MessageHashUtils.toEthSignedMessageHash(
 *   keccak256(abi.encodePacked(matchId, winner, block.chainid))
 * )
 * The packed encoding uses abi.encodePacked which is tight (no padding),
 * but viem's encodeAbiParameters uses padded encoding. We replicate tight
 * packing via manual Buffer concatenation.
 */
async function buildSettleSig(
  matchId: bigint,
  winner: `0x${string}`
): Promise<`0x${string}`> {
  if (!oracleAccount) throw new Error("Oracle private key not configured");

  const chainId = await publicClient.getChainId();

  // Replicate abi.encodePacked: uint256 (32 bytes) + address (20 bytes) + uint256 (32 bytes)
  const buf = Buffer.alloc(84);
  // matchId as big-endian uint256
  const matchIdHex = matchId.toString(16).padStart(64, "0");
  Buffer.from(matchIdHex, "hex").copy(buf, 0);
  // winner address (20 bytes, strip 0x prefix)
  Buffer.from(winner.slice(2).toLowerCase(), "hex").copy(buf, 32);
  // chainId as big-endian uint256
  const chainIdHex = BigInt(chainId).toString(16).padStart(64, "0");
  Buffer.from(chainIdHex, "hex").copy(buf, 52);

  const innerHash = keccak256(`0x${buf.toString("hex")}` as `0x${string}`);

  // signMessage applies the "\x19Ethereum Signed Message:\n32" prefix (EIP-191)
  const sig = await oracleAccount.signMessage({
    message: { raw: toBytes(innerHash) },
  });
  return sig;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Settle a match on-chain with an oracle-signed result.
 *
 * winner = "0x0000000000000000000000000000000000000000" for draws.
 * Requires ORACLE_ROLE on the oracle account (ORACLE_PRIVATE_KEY env var).
 */
export async function settleMatch(
  gameId: string,
  matchId: bigint,
  winner: `0x${string}`,
  winnerPayout: number
): Promise<{ txHash: string | null }> {
  if (!walletClient || !env.MATCH_ESCROW_ADDRESS) {
    logger.warn("Blockchain not configured, skipping settleMatch on-chain");
    return { txHash: null };
  }

  try {
    const sig = await buildSettleSig(matchId, winner);

    const txHash = await retryTx(() =>
      walletClient!.writeContract({
        address: env.MATCH_ESCROW_ADDRESS!,
        abi: MatchEscrowABI,
        functionName: "settleMatch",
        args: [matchId, winner, sig],
      })
    );

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });
    logger.info("Match settled on-chain", {
      txHash,
      matchId: matchId.toString(),
      winner,
      status: receipt.status,
      gasUsed: receipt.gasUsed.toString(),
    });

    const isDraw =
      winner === "0x0000000000000000000000000000000000000000";
    if (!isDraw) {
      await supabase.from("transactions").insert({
        game_id: gameId,
        player_address: winner.toLowerCase(),
        tx_type: "payout",
        tx_hash: txHash,
        amount: winnerPayout,
        status: receipt.status === "success" ? "confirmed" : "failed",
        confirmed_at:
          receipt.status === "success" ? new Date().toISOString() : null,
      });
    }

    return { txHash };
  } catch (err) {
    logger.error("settleMatch failed", { error: (err as Error).message });
    return { txHash: null };
  }
}

/**
 * Cancel a Pending match (before playerB joins) and refund playerA.
 *
 * Only works while MatchState == Pending. If the match is already Active,
 * use settleMatch with winner = address(0) (draw/abort) instead.
 */
export async function cancelMatch(
  gameId: string,
  matchId: bigint,
  playerAddress: `0x${string}`
): Promise<{ txHash: string | null }> {
  if (!walletClient || !env.MATCH_ESCROW_ADDRESS) {
    logger.warn("Blockchain not configured, skipping cancelMatch");
    return { txHash: null };
  }

  try {
    const txHash = await retryTx(() =>
      walletClient!.writeContract({
        address: env.MATCH_ESCROW_ADDRESS!,
        abi: MatchEscrowABI,
        functionName: "cancelMatch",
        args: [matchId],
      })
    );

    logger.info("Match cancelled on-chain", {
      txHash,
      matchId: matchId.toString(),
      player: playerAddress,
    });

    await supabase.from("transactions").insert({
      game_id: gameId,
      player_address: playerAddress.toLowerCase(),
      tx_type: "refund",
      tx_hash: txHash,
      amount: 0,
      status: "pending",
    });

    return { txHash };
  } catch (err) {
    logger.error("cancelMatch failed", { error: (err as Error).message });
    return { txHash: null };
  }
}

/**
 * Watch MatchEscrow events to track deposits and match state transitions.
 *
 * MatchCreated  → playerA deposited, game waiting for playerB
 * MatchJoined   → playerB deposited, game now Active on-chain
 * MatchSettled  → payout complete
 * MatchCancelled→ refund complete
 */
export function watchMatchEvents(): void {
  if (!env.MATCH_ESCROW_ADDRESS) {
    logger.info("No escrow address configured, skipping event watcher");
    return;
  }

  publicClient.watchContractEvent({
    address: env.MATCH_ESCROW_ADDRESS,
    abi: MatchEscrowABI,
    eventName: "MatchCreated",
    onLogs: async (logs) => {
      for (const log of logs) {
        const args = (log as any).args;
        if (!args) continue;
        const { matchId, playerA, stake } = args;
        logger.info("MatchCreated event", {
          matchId: matchId?.toString(),
          playerA,
          stake: stake?.toString(),
        });
        await handleMatchCreated(matchId as bigint, playerA as string);
      }
    },
  });

  publicClient.watchContractEvent({
    address: env.MATCH_ESCROW_ADDRESS,
    abi: MatchEscrowABI,
    eventName: "MatchJoined",
    onLogs: async (logs) => {
      for (const log of logs) {
        const args = (log as any).args;
        if (!args) continue;
        const { matchId, playerB } = args;
        logger.info("MatchJoined event", {
          matchId: matchId?.toString(),
          playerB,
        });
        await handleMatchJoined(matchId as bigint);
      }
    },
  });

  publicClient.watchContractEvent({
    address: env.MATCH_ESCROW_ADDRESS,
    abi: MatchEscrowABI,
    eventName: "MatchSettled",
    onLogs: (logs) => {
      for (const log of logs) {
        const args = (log as any).args;
        if (!args) continue;
        logger.info("MatchSettled event", {
          matchId: args.matchId?.toString(),
          winner: args.winner,
          payout: args.payout?.toString(),
        });
      }
    },
  });

  logger.info("Watching MatchEscrow events");
}

// ── Internal event handlers ───────────────────────────────────────────────────

async function handleMatchCreated(
  matchId: bigint,
  playerA: string
): Promise<void> {
  // Find the most recent waiting game for this player that has no on-chain matchId yet.
  const { data: games } = await supabase
    .from("games")
    .select("id")
    .eq("status", "waiting")
    .or(
      `white_address.eq.${playerA.toLowerCase()},black_address.eq.${playerA.toLowerCase()}`
    )
    .is("onchain_game_id", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!games || games.length === 0) {
    logger.warn("MatchCreated: no waiting game found for player", { playerA });
    return;
  }

  // Store matchId as decimal string (onchain_game_id is TEXT in schema)
  await supabase
    .from("games")
    .update({ onchain_game_id: matchId.toString() })
    .eq("id", games[0].id);

  logger.info("Linked on-chain matchId to game", {
    gameId: games[0].id,
    matchId: matchId.toString(),
  });
}

async function handleMatchJoined(matchId: bigint): Promise<void> {
  const { data: games } = await supabase
    .from("games")
    .select("id")
    .eq("onchain_game_id", matchId.toString())
    .eq("status", "waiting")
    .limit(1);

  if (!games || games.length === 0) return;

  await supabase
    .from("games")
    .update({
      status: "active",
      started_at: new Date().toISOString(),
    })
    .eq("id", games[0].id);

  logger.info("Game activated via MatchJoined event", {
    gameId: games[0].id,
    matchId: matchId.toString(),
  });
}
