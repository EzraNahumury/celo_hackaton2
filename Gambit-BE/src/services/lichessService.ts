import { Chess } from "chess.js";
import { logger } from "../utils/logger";

export interface LichessPuzzleData {
  id: string;
  fen: string;
  to_move: "white" | "black";
  solution: string[]; // [playerMove, opponentMove, playerMove, ...] UCI
  rating: number;
  themes: string[];
}

// Local fallback pool used when Lichess API is unavailable
export const FALLBACK_PUZZLES: LichessPuzzleData[] = [
  {
    id: "local-001",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    to_move: "white",
    solution: ["h5f7"],
    rating: 1200,
    themes: ["mateIn1", "scholar"],
  },
  {
    id: "local-002",
    fen: "r1b1k2r/ppppqppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 5",
    to_move: "white",
    solution: ["f3e5", "c6e5", "c4f7"],
    rating: 1400,
    themes: ["fork", "sacrifice"],
  },
  {
    id: "local-003",
    fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2",
    to_move: "black",
    solution: ["d8h4"],
    rating: 1000,
    themes: ["mateIn1", "foolsMate"],
  },
  {
    id: "local-004",
    fen: "r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 0 9",
    to_move: "white",
    solution: ["d4c6", "b7c6", "d2d6"],
    rating: 1500,
    themes: ["fork", "advantage"],
  },
  {
    id: "local-005",
    fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
    to_move: "white",
    solution: ["d1d8"],
    rating: 900,
    themes: ["mateIn1", "backRank"],
  },
];

/**
 * Replay a PGN string to the position after `initialPly` half-moves.
 * Returns the FEN string at that position.
 */
function fenFromPgnAtPly(pgn: string, initialPly: number): string {
  try {
    // Load entire game to get the move history
    const loader = new Chess();
    loader.loadPgn(pgn);
    const history = loader.history({ verbose: true });

    const replay = new Chess();
    for (let i = 0; i < Math.min(initialPly + 1, history.length); i++) {
      const m = history[i];
      replay.move({ from: m.from, to: m.to, promotion: m.promotion });
    }
    return replay.fen();
  } catch (err) {
    logger.warn("fenFromPgnAtPly failed — returning start FEN", {
      error: (err as Error).message,
    });
    return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  }
}

/**
 * Fetch a random puzzle from the Lichess public API.
 * Returns null on any network/parse error so callers can fall back gracefully.
 */
export async function fetchLichessPuzzle(): Promise<LichessPuzzleData | null> {
  try {
    const res = await fetch("https://lichess.org/api/puzzle/next", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      logger.warn("Lichess API non-OK", { status: res.status });
      return null;
    }

    const data = await res.json();
    const { game, puzzle } = data ?? {};

    if (
      !game?.pgn ||
      !Array.isArray(puzzle?.solution) ||
      puzzle.solution.length === 0 ||
      puzzle.initialPly === undefined
    ) {
      logger.warn("Lichess API response missing required fields");
      return null;
    }

    const fen = fenFromPgnAtPly(game.pgn, puzzle.initialPly);
    const to_move = fen.split(" ")[1] === "w" ? "white" : "black";

    return {
      id: String(puzzle.id),
      fen,
      to_move: to_move as "white" | "black",
      solution: puzzle.solution as string[],
      rating: Number(puzzle.rating) || 1500,
      themes: Array.isArray(puzzle.themes) ? puzzle.themes : [],
    };
  } catch (err) {
    logger.warn("fetchLichessPuzzle error", { error: (err as Error).message });
    return null;
  }
}

/** Pick a random fallback puzzle, preferring ones not in `excludeIds`. */
export function getRandomFallbackPuzzle(excludeIds: string[] = []): LichessPuzzleData {
  const available = FALLBACK_PUZZLES.filter((p) => !excludeIds.includes(p.id));
  const pool = available.length > 0 ? available : FALLBACK_PUZZLES;
  return pool[Math.floor(Math.random() * pool.length)];
}
