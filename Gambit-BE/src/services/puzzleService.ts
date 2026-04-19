import { supabase } from "../config/supabase";
import { normalizeAddress } from "../utils/helpers";
import { logger } from "../utils/logger";

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
  timeMs: number
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

  // Validate solution
  const solution = puzzle.solution as string[];
  const correct =
    JSON.stringify(moves) === JSON.stringify(solution);

  // Get rank (for correct answers only)
  let rank: number | null = null;
  if (correct) {
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

  // Sample puzzles - in production, fetch from lichess API
  const puzzles = [
    {
      fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
      to_move: "white",
      solution: ["h5f7"],
    },
    {
      fen: "r1b1k2r/ppppqppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 5",
      to_move: "white",
      solution: ["f3e5"],
    },
    {
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
