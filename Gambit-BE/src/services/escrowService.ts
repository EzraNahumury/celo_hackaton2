import { walletClient, publicClient } from "../config/blockchain";
import { env } from "../config/env";
import { supabase } from "../config/supabase";
import { logger } from "../utils/logger";
import ChessEscrowABI from "../contracts/ChessEscrow.json";

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

async function retryTx<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      logger.warn(`TX retry ${i + 1}/${MAX_RETRIES}`, { error: lastError.message });
      if (i < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

export async function resolveGame(
  gameId: string,
  onchainGameId: `0x${string}`,
  winner: `0x${string}`,
  player1: `0x${string}`,
  player2: `0x${string}`,
  winnerPayout: number
): Promise<{ txHash: string | null }> {
  if (!walletClient || !env.CHESS_ESCROW_ADDRESS) {
    logger.warn("Blockchain not configured, skipping resolveGame on-chain");
    return { txHash: null };
  }

  try {
    const txHash = await retryTx(() =>
      walletClient!.writeContract({
        address: env.CHESS_ESCROW_ADDRESS!,
        abi: ChessEscrowABI,
        functionName: "resolveGame",
        args: [onchainGameId, winner, player1, player2],
      })
    );

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    logger.info("Game resolved on-chain", {
      txHash,
      status: receipt.status,
      gasUsed: receipt.gasUsed.toString(),
    });

    await supabase.from("transactions").insert({
      game_id: gameId,
      player_address: winner.toLowerCase(),
      tx_type: "payout",
      tx_hash: txHash,
      amount: winnerPayout,
      status: receipt.status === "success" ? "confirmed" : "failed",
      confirmed_at: receipt.status === "success" ? new Date().toISOString() : null,
    });

    return { txHash };
  } catch (err) {
    logger.error("resolveGame failed", { error: (err as Error).message });
    return { txHash: null };
  }
}

export async function refundStake(
  gameId: string,
  onchainGameId: `0x${string}`,
  player: `0x${string}`
): Promise<{ txHash: string | null }> {
  if (!walletClient || !env.CHESS_ESCROW_ADDRESS) {
    logger.warn("Blockchain not configured, skipping refundStake");
    return { txHash: null };
  }

  try {
    const txHash = await retryTx(() =>
      walletClient!.writeContract({
        address: env.CHESS_ESCROW_ADDRESS!,
        abi: ChessEscrowABI,
        functionName: "refundStake",
        args: [onchainGameId, player],
      })
    );

    logger.info("Stake refunded", { txHash, player });

    await supabase.from("transactions").insert({
      game_id: gameId,
      player_address: player.toLowerCase(),
      tx_type: "refund",
      tx_hash: txHash,
      amount: 0,
      status: "pending",
    });

    return { txHash };
  } catch (err) {
    logger.error("refundStake failed", { error: (err as Error).message });
    return { txHash: null };
  }
}

export function watchDeposits(): void {
  if (!env.CHESS_ESCROW_ADDRESS) {
    logger.info("No escrow address configured, skipping deposit watcher");
    return;
  }

  publicClient.watchContractEvent({
    address: env.CHESS_ESCROW_ADDRESS,
    abi: ChessEscrowABI,
    eventName: "StakeDeposited",
    onLogs: async (logs) => {
      for (const log of logs) {
        const args = (log as any).args;
        if (!args) continue;
        const { gameId, player, amount } = args;
        logger.info("Deposit received", { gameId, player, amount: amount?.toString() });
        // TODO: Update game status when both deposits confirmed
      }
    },
  });

  logger.info("Watching for StakeDeposited events");
}
