import { encodePacked, keccak256, parseUnits, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { supabase } from "../config/supabase";
import { walletClient, publicClient } from "../config/blockchain";
import { env } from "../config/env";
import { normalizeAddress } from "../utils/helpers";
import { logger } from "../utils/logger";
import { fetchLichessPuzzle, getRandomFallbackPuzzle } from "./lichessService";
import { addPlayerEarnings } from "./playerService";
import ERC20_ABI from "../contracts/erc20.json";

// ── Constants ─────────────────────────────────────────────────────────────────

export const PRIZE_AMOUNT_CUSD = 0.01;
export const MAX_DAILY_PRIZES = 3;

// cUSD uses 18 decimals (same as ETH)
const PRIZE_WEI = parseUnits(String(PRIZE_AMOUNT_CUSD), 18);

// ── Oracle signer ─────────────────────────────────────────────────────────────

/**
 * Lazy-load oracle account for signing claim vouchers.
 * Uses ORACLE_PRIVATE_KEY if set, falls back to SERVER_WALLET_PRIVATE_KEY.
 */
function getOracleAccount() {
  const pk = env.ORACLE_PRIVATE_KEY ?? env.SERVER_WALLET_PRIVATE_KEY;
  if (!pk) return null;
  try {
    return privateKeyToAccount(pk);
  } catch {
    return null;
  }
}

/**
 * Compute the unique nonce for a player+puzzle combination.
 * Matches the backend computation expected by DailyPuzzlePool.claim().
 * nonce = keccak256(keccak256(puzzleId), playerAddress)
 */
function claimNonce(puzzleId: string, playerAddress: `0x${string}`): `0x${string}` {
  return keccak256(encodePacked(
    ["bytes32", "address"],
    [keccak256(toBytes(puzzleId)), playerAddress]
  ));
}

/**
 * Sign a claim voucher for DailyPuzzlePool.claim().
 * Message: keccak256(abi.encodePacked(player, day, nonce, amount))
 */
async function signClaimVoucher(
  playerAddress: `0x${string}`,
  dayIndex: bigint,
  nonce: `0x${string}`,
  amountWei: bigint
): Promise<`0x${string}` | null> {
  const oracle = getOracleAccount();
  if (!oracle) return null;

  const msgHash = keccak256(encodePacked(
    ["address", "uint256", "bytes32", "uint256"],
    [playerAddress, dayIndex, nonce, amountWei]
  ));

  // signMessage adds "\x19Ethereum Signed Message:\n32" prefix — matches toEthSignedMessageHash
  return oracle.signMessage({ message: { raw: toBytes(msgHash) } });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayUtcStart(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// ── Public service functions ──────────────────────────────────────────────────

/**
 * Get the next unseen Lichess puzzle for a player.
 *
 * Priority:
 *  1. Cached lichess_puzzles the player hasn't solved today
 *  2. Fresh fetch from Lichess API (cached for reuse)
 *  3. Local fallback hardcoded puzzles
 */
export async function getNextPuzzle(playerAddress: string) {
  const address = normalizeAddress(playerAddress);

  // Puzzle IDs already attempted by this player today
  const { data: seenRows } = await supabase
    .from("puzzle_sessions")
    .select("puzzle_id")
    .eq("player_address", address)
    .gte("created_at", todayUtcStart());

  const seenIds: string[] = (seenRows ?? []).map((r: any) => r.puzzle_id);

  // Try a cached puzzle not yet seen by this player
  let cachedQuery = supabase
    .from("lichess_puzzles")
    .select("id, fen, to_move, rating")
    .order("fetched_at", { ascending: false })
    .limit(1);

  if (seenIds.length > 0) {
    cachedQuery = cachedQuery.not(
      "id",
      "in",
      `(${seenIds.join(",")})`
    );
  }

  const { data: cached } = await cachedQuery.single();

  if (cached) {
    return {
      id: cached.id as string,
      fen: cached.fen as string,
      to_move: cached.to_move as "white" | "black",
      rating: cached.rating as number,
    };
  }

  // Nothing cached — try Lichess API
  const lichess = await fetchLichessPuzzle();

  if (lichess) {
    await supabase.from("lichess_puzzles").upsert({
      id: lichess.id,
      fen: lichess.fen,
      to_move: lichess.to_move,
      solution: lichess.solution,
      rating: lichess.rating,
      themes: lichess.themes,
    });
    logger.info("Fetched & cached Lichess puzzle", { id: lichess.id });
    return {
      id: lichess.id,
      fen: lichess.fen,
      to_move: lichess.to_move,
      rating: lichess.rating,
    };
  }

  // Fallback: local hardcoded puzzle
  const fallback = getRandomFallbackPuzzle(seenIds);
  await supabase.from("lichess_puzzles").upsert({
    id: fallback.id,
    fen: fallback.fen,
    to_move: fallback.to_move,
    solution: fallback.solution,
    rating: fallback.rating,
    themes: fallback.themes ?? [],
  });
  return {
    id: fallback.id,
    fen: fallback.fen,
    to_move: fallback.to_move,
    rating: fallback.rating,
  };
}

/**
 * Validate a single player move against the puzzle solution (step-by-step).
 * moveIndex is the position in the full solution array for the player's turn (0, 2, 4...).
 */
export async function validatePuzzleMove(
  puzzleId: string,
  moveIndex: number,
  move: string
): Promise<{ correct: boolean; opponentMove?: string; puzzleComplete: boolean }> {
  const { data: puzzle } = await supabase
    .from("lichess_puzzles")
    .select("solution")
    .eq("id", puzzleId)
    .single();

  if (!puzzle) throw new Error("PUZZLE_NOT_FOUND");

  const solution = puzzle.solution as string[];

  if (move !== solution[moveIndex]) {
    return { correct: false, puzzleComplete: false };
  }

  const opponentMove = solution[moveIndex + 1] as string | undefined;
  const puzzleComplete = moveIndex + 2 >= solution.length;

  return {
    correct: true,
    opponentMove: opponentMove || undefined,
    puzzleComplete,
  };
}

/**
 * Return the correct move for a step so the frontend can highlight it as a hint.
 * Using a hint disqualifies the player from the prize (enforced on submit).
 */
export async function getPuzzleHint(
  puzzleId: string,
  moveIndex: number
): Promise<{ move: string }> {
  const { data: puzzle } = await supabase
    .from("lichess_puzzles")
    .select("solution")
    .eq("id", puzzleId)
    .single();

  if (!puzzle) throw new Error("PUZZLE_NOT_FOUND");

  const solution = puzzle.solution as string[];
  const move = solution[moveIndex];
  if (!move) throw new Error("INVALID_MOVE_INDEX");

  return { move };
}

/**
 * Get today's prize status for a player.
 */
export async function getDailyPrizeStatus(playerAddress: string) {
  const address = normalizeAddress(playerAddress);

  const { count: earned } = await supabase
    .from("puzzle_sessions")
    .select("*", { count: "exact", head: true })
    .eq("player_address", address)
    .eq("prize_paid", true)
    .gte("created_at", todayUtcStart());

  const { count: played } = await supabase
    .from("puzzle_sessions")
    .select("*", { count: "exact", head: true })
    .eq("player_address", address)
    .gte("created_at", todayUtcStart());

  const prizesEarned = earned ?? 0;

  return {
    prizesEarned,
    prizesRemaining: Math.max(0, MAX_DAILY_PRIZES - prizesEarned),
    totalPlayedToday: played ?? 0,
    maxDailyPrizes: MAX_DAILY_PRIZES,
    prizeAmountCusd: PRIZE_AMOUNT_CUSD,
  };
}

/**
 * Submit completed puzzle moves.
 * - Validates player moves against the solution.
 * - Pays 0.01 cUSD if correct, not a hint, and under the 3-prize daily limit.
 * - Records the session regardless of outcome.
 */
export async function submitPuzzle(
  puzzleId: string,
  playerAddress: string,
  playerMoves: string[],
  timeMs: number,
  usedHint: boolean
): Promise<{
  correct: boolean;
  prizeEarned: boolean;
  prizeAmountCusd: number;
  txHash: string | null;
  prizesEarned: number;
  prizesRemaining: number;
  /** Present when DailyPuzzlePool is configured — FE calls claim() with these params. */
  claimData: {
    contractAddress: `0x${string}`;
    day: string;
    nonce: `0x${string}`;
    amountWei: string;
    signature: `0x${string}`;
  } | null;
}> {
  const address = normalizeAddress(playerAddress);

  // Fetch puzzle solution
  const { data: puzzle } = await supabase
    .from("lichess_puzzles")
    .select("solution")
    .eq("id", puzzleId)
    .single();

  if (!puzzle) throw new Error("PUZZLE_NOT_FOUND");

  // Validate: player moves must match even-indexed solution entries
  const solution = puzzle.solution as string[];
  const solutionPlayerMoves = solution.filter((_, i) => i % 2 === 0);
  const correct = JSON.stringify(playerMoves) === JSON.stringify(solutionPlayerMoves);

  // Count today's paid prizes BEFORE this attempt
  const { count: prizesBefore } = await supabase
    .from("puzzle_sessions")
    .select("*", { count: "exact", head: true })
    .eq("player_address", address)
    .eq("prize_paid", true)
    .gte("created_at", todayUtcStart());

  const prizeEligible =
    correct && !usedHint && (prizesBefore ?? 0) < MAX_DAILY_PRIZES;

  logger.info("Puzzle submit eligibility", {
    address,
    puzzleId,
    correct,
    usedHint,
    prizesBefore: prizesBefore ?? 0,
    prizeEligible,
  });

  // Prize payout
  let txHash: string | null = null;
  let prizePaid = false;
  let claimData: {
    contractAddress: `0x${string}`;
    day: string;
    nonce: `0x${string}`;
    amountWei: string;
    signature: `0x${string}`;
  } | null = null;

  if (prizeEligible) {
    if (env.DAILY_PUZZLE_POOL_ADDRESS) {
      // ── DailyPuzzlePool flow: oracle signs voucher, FE calls claim() ──────────
      try {
        const dayIndex = BigInt(Math.floor(Date.now() / 1000 / 86400));
        const nonce = claimNonce(puzzleId, address as `0x${string}`);
        const signature = await signClaimVoucher(address as `0x${string}`, dayIndex, nonce, PRIZE_WEI);

        if (signature) {
          prizePaid = true;
          claimData = {
            contractAddress: env.DAILY_PUZZLE_POOL_ADDRESS,
            day: dayIndex.toString(),
            nonce,
            amountWei: PRIZE_WEI.toString(),
            signature,
          };
          logger.info("Claim voucher signed", { player: address, puzzleId, day: dayIndex.toString() });
        } else {
          logger.warn("Oracle key not configured — prize skipped", { address, puzzleId });
        }
      } catch (err) {
        logger.error("Claim voucher signing failed", {
          error: (err as Error).message, address, puzzleId,
        });
      }
    } else if (walletClient && env.CUSD_ADDRESS) {
      // ── Fallback: direct ERC-20 transfer from server wallet ──────────────────
      try {
        txHash = await walletClient.writeContract({
          address: env.CUSD_ADDRESS,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [address as `0x${string}`, PRIZE_WEI],
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
        prizePaid = true;
        logger.info("cUSD prize paid (direct transfer)", {
          to: address, puzzleId, amount: PRIZE_AMOUNT_CUSD, txHash,
        });
      } catch (err) {
        logger.error("cUSD prize transfer failed", {
          error: (err as Error).message, address, puzzleId,
        });
      }
    } else {
      logger.warn("Prize skipped: DAILY_PUZZLE_POOL_ADDRESS and CUSD_ADDRESS not configured", {
        address, puzzleId,
      });
    }
  }

  // Update total_earned if prize was paid
  if (prizePaid) {
    await addPlayerEarnings(address, PRIZE_AMOUNT_CUSD);
  }

  // Record session
  await supabase.from("puzzle_sessions").insert({
    puzzle_id: puzzleId,
    player_address: address,
    submitted_moves: playerMoves,
    correct,
    used_hint: usedHint,
    prize_paid: prizePaid,
    tx_hash: txHash,
    solve_time_ms: timeMs,
  });

  const prizesEarned = (prizesBefore ?? 0) + (prizePaid ? 1 : 0);

  return {
    correct,
    prizeEarned: prizePaid,
    prizeAmountCusd: prizePaid ? PRIZE_AMOUNT_CUSD : 0,
    txHash,
    prizesEarned,
    prizesRemaining: Math.max(0, MAX_DAILY_PRIZES - prizesEarned),
    claimData,
  };
}
