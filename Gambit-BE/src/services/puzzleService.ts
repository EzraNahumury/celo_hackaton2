import { supabase } from "../config/supabase";
import { normalizeAddress } from "../utils/helpers";
import { logger } from "../utils/logger";
import { buildPuzzleTree, buildProofFromWinners, Winner } from "./merkleService";
import { walletClient, publicClient } from "../config/blockchain";
import { env } from "../config/env";
import PuzzlePoolABI from "../contracts/PuzzlePool.json";

// Top-N correct solvers who win a share of the prize pool
const MAX_WINNERS = 10;

export async function getDailyPuzzle() {
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("puzzles")
    .select("id, fen, to_move, prize_pool, participants, puzzle_date, expires_at, created_at")
    .eq("puzzle_date", today)
    .single();

  return data;
}

export async function submitPuzzleAttempt(
  puzzleId: string,
  playerAddress: string,
  moves: string[],
  timeMs: number,
  usedHint: boolean = false
): Promise<{
  correct: boolean;
  rank: number | null;
  totalParticipants: number;
  reward: number;
}> {
  const address = normalizeAddress(playerAddress);

  // Get puzzle with solution
  const { data: puzzle } = await supabase
    .from("puzzles")
    .select("*")
    .eq("id", puzzleId)
    .single();

  if (!puzzle) throw new Error("PUZZLE_NOT_FOUND");

  if (new Date(puzzle.expires_at) < new Date()) {
    throw new Error("PUZZLE_EXPIRED");
  }

  // Check if already submitted
  const { data: existing } = await supabase
    .from("puzzle_attempts")
    .select("id")
    .eq("puzzle_id", puzzleId)
    .eq("player_address", address)
    .single();

  if (existing) throw new Error("PUZZLE_ALREADY_SUBMITTED");

  // Validate player moves against solution.
  // Solution format: [playerMove0, opponentMove0, playerMove1, opponentMove1, ...]
  // Player moves are at even indices (0, 2, 4...).
  const solution = puzzle.solution as string[];
  const solutionPlayerMoves = solution.filter((_, i) => i % 2 === 0);
  const correct = JSON.stringify(moves) === JSON.stringify(solutionPlayerMoves);

  // Rank only awarded when correct AND no hint was used
  let rank: number | null = null;
  if (correct && !usedHint) {
    const { count } = await supabase
      .from("puzzle_attempts")
      .select("*", { count: "exact", head: true })
      .eq("puzzle_id", puzzleId)
      .eq("correct", true);
    rank = (count || 0) + 1;
  }

  // Insert attempt
  await supabase.from("puzzle_attempts").insert({
    puzzle_id: puzzleId,
    player_address: address,
    submitted_moves: moves,
    correct,
    solve_time_ms: timeMs,
    rank,
    reward: 0,
  });

  // Update participants count
  await supabase
    .from("puzzles")
    .update({ participants: puzzle.participants + 1 })
    .eq("id", puzzleId);

  return {
    correct,
    rank,
    totalParticipants: puzzle.participants + 1,
    reward: 0,
  };
}

/**
 * Validate a single player move against the puzzle solution.
 * moveIndex is the position in the solution array for the player's turn (0, 2, 4...).
 * Returns the opponent's response move if there is one, and whether the puzzle is now complete.
 */
export async function validatePuzzleMove(
  puzzleId: string,
  moveIndex: number,
  move: string
): Promise<{ correct: boolean; opponentMove?: string; puzzleComplete: boolean }> {
  const { data: puzzle } = await supabase
    .from("puzzles")
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
 * Return the correct move for a given step so the frontend can show it as a hint.
 * Calling this endpoint disqualifies the player from the prize (handled on submit).
 */
export async function getPuzzleHint(
  puzzleId: string,
  moveIndex: number
): Promise<{ move: string }> {
  const { data: puzzle } = await supabase
    .from("puzzles")
    .select("solution")
    .eq("id", puzzleId)
    .single();

  if (!puzzle) throw new Error("PUZZLE_NOT_FOUND");

  const solution = puzzle.solution as string[];
  const move = solution[moveIndex];
  if (!move) throw new Error("INVALID_MOVE_INDEX");

  return { move };
}

export async function generateDailyPuzzle(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const puzzleId = `puzzle-${today}`;

  // Check if already exists
  const { data: existing } = await supabase
    .from("puzzles")
    .select("id")
    .eq("id", puzzleId)
    .single();

  if (existing) return;

  // Sample puzzles - in production, fetch from lichess API.
  // Solution format: [playerMove, opponentResponse, playerMove, opponentResponse, ...]
  // Player moves are at even indices (0, 2, 4...), opponent at odd indices (1, 3, 5...).
  const puzzles = [
    {
      // Scholar's Mate: Qxf7# (1 player move — immediate checkmate)
      fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
      to_move: "white",
      solution: ["h5f7"],
    },
    {
      // Ne5 fork then Bxf7+ (2 player moves, 1 opponent response)
      // 1. Nxe5 (captures pawn, knight fork)
      // 2. Nc6xe5 (opponent recaptures — forced)
      // 3. Bxf7+ (bishop captures f7, checks king)
      fen: "r1b1k2r/ppppqppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 5",
      to_move: "white",
      solution: ["f3e5", "c6e5", "c4f7"],
    },
    {
      // Fool's Mate: Qh4# (1 player move — immediate checkmate)
      fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2",
      to_move: "black",
      solution: ["d8h4"],
    },
  ];

  const puzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
  const expiresAt = new Date();
  expiresAt.setUTCHours(23, 59, 59, 999);

  await supabase.from("puzzles").insert({
    id: puzzleId,
    fen: puzzle.fen,
    to_move: puzzle.to_move,
    solution: puzzle.solution,
    prize_pool: 5.0,
    participants: 0,
    puzzle_date: today,
    expires_at: expiresAt.toISOString(),
  });

  logger.info("Daily puzzle generated", { puzzleId });
}

/**
 * Finalize a puzzle round:
 *  1. Fetch top-MAX_WINNERS correct solvers sorted by solve_time_ms (fastest first)
 *  2. Compute equal share of prize_pool for each winner (in wei)
 *  3. Build Merkle tree and submit root to PuzzlePool.finalizeRound on-chain
 *  4. Persist merkle_root + individual reward amounts back to DB
 *
 * Idempotent: if merkle_root is already set on the puzzle row, skips on-chain submit.
 */
export async function finalizePuzzleRound(
  puzzleDate: string
): Promise<{ winners: number; merkleRoot: string | null }> {
  const puzzleId = `puzzle-${puzzleDate}`;

  const { data: puzzle } = await supabase
    .from("puzzles")
    .select("id, prize_pool, merkle_root")
    .eq("id", puzzleId)
    .single();

  if (!puzzle) {
    logger.warn("finalizePuzzleRound: puzzle not found", { puzzleId });
    return { winners: 0, merkleRoot: null };
  }

  // Already finalized — return existing root without re-submitting
  if ((puzzle as any).merkle_root) {
    logger.info("finalizePuzzleRound: already finalized", {
      puzzleId,
      merkleRoot: (puzzle as any).merkle_root,
    });
    return { winners: 0, merkleRoot: (puzzle as any).merkle_root };
  }

  // Fetch top-N correct attempts sorted fastest first
  const { data: attempts } = await supabase
    .from("puzzle_attempts")
    .select("player_address, solve_time_ms")
    .eq("puzzle_id", puzzleId)
    .eq("correct", true)
    .order("solve_time_ms", { ascending: true })
    .limit(MAX_WINNERS);

  if (!attempts || attempts.length === 0) {
    logger.info("finalizePuzzleRound: no correct solvers", { puzzleId });
    return { winners: 0, merkleRoot: null };
  }

  // Equal share (in wei); prize_pool is in CELO with up to 2 decimal places
  const prizePool = Number(puzzle.prize_pool);
  const shareWei = BigInt(
    Math.floor((prizePool / attempts.length) * 1e18)
  );

  const winners: Winner[] = attempts.map((a) => ({
    address: a.player_address,
    amountWei: shareWei,
  }));

  const tree = buildPuzzleTree(winners);
  const merkleRoot = tree.root as `0x${string}`;

  // Submit on-chain
  let txHash: string | null = null;
  if (walletClient && env.PUZZLE_POOL_ADDRESS) {
    try {
      txHash = await walletClient.writeContract({
        address: env.PUZZLE_POOL_ADDRESS,
        abi: PuzzlePoolABI,
        functionName: "finalizeRound",
        args: [merkleRoot],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
      logger.info("PuzzlePool.finalizeRound submitted", {
        puzzleDate,
        merkleRoot,
        winners: winners.length,
        txHash,
      });
    } catch (err) {
      logger.error("PuzzlePool.finalizeRound on-chain failed", {
        error: (err as Error).message,
        puzzleDate,
      });
      // Continue — persist root to DB anyway so proofs still work off-chain
    }
  } else {
    logger.warn("PUZZLE_POOL_ADDRESS not configured — skipping on-chain finalizeRound");
  }

  // Persist merkle_root to puzzles row
  await supabase
    .from("puzzles")
    .update({ merkle_root: merkleRoot })
    .eq("id", puzzleId);

  // Persist individual reward amounts to puzzle_attempts
  const shareDisplay = prizePool / attempts.length;
  for (const winner of winners) {
    await supabase
      .from("puzzle_attempts")
      .update({ reward: shareDisplay })
      .eq("puzzle_id", puzzleId)
      .eq("player_address", winner.address);
  }

  logger.info("finalizePuzzleRound complete", {
    puzzleId,
    winners: winners.length,
    merkleRoot,
    txHash,
  });

  return { winners: winners.length, merkleRoot };
}

/**
 * Get the Merkle proof for a specific address for a given puzzle day.
 * Returns null if the round hasn't been finalized or the address didn't win.
 */
export async function getPuzzleProof(
  puzzleDate: string,
  playerAddress: string
): Promise<{ amount: string; proof: string[] } | null> {
  const puzzleId = `puzzle-${puzzleDate}`;
  const address = normalizeAddress(playerAddress);

  // Fetch all winning attempts for this puzzle (correct=true, reward>0)
  const { data: attempts } = await supabase
    .from("puzzle_attempts")
    .select("player_address, reward")
    .eq("puzzle_id", puzzleId)
    .eq("correct", true)
    .gt("reward", 0)
    .order("solve_time_ms", { ascending: true })
    .limit(MAX_WINNERS);

  if (!attempts || attempts.length === 0) return null;

  const winners: Winner[] = attempts.map((a) => ({
    address: a.player_address,
    amountWei: BigInt(Math.round(Number(a.reward) * 1e18)),
  }));

  const result = buildProofFromWinners(winners, address);
  if (!result) return null;

  return {
    amount: result.amountWei.toString(),
    proof: result.proof,
  };
}
