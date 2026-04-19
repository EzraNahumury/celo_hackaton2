export type GameStatus = "waiting" | "active" | "completed" | "cancelled" | "expired";
export type GameResult = "white_win" | "black_win" | "draw" | "abort";
export type GameMode = "pvp" | "bot";
export type TxType = "deposit" | "payout" | "refund" | "fee";
export type TxStatus = "pending" | "confirmed" | "failed";

export interface Player {
  wallet_address: string;
  username: string | null;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  total_earned: number;
  created_at: string;
  last_seen: string;
}

export interface Game {
  id: string;
  onchain_game_id: string | null;
  white_address: string | null;
  black_address: string | null;
  status: GameStatus;
  result: GameResult | null;
  mode: GameMode;
  stake_amount: number;
  time_control: string;
  fen: string;
  white_time_ms: number | null;
  black_time_ms: number | null;
  move_count: number;
  winner_address: string | null;
  end_reason: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  expires_at: string | null;
}

export interface Move {
  id: string;
  game_id: string;
  player_address: string;
  move_number: number;
  uci_move: string;
  fen_after: string;
  time_remaining_ms: number | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  game_id: string | null;
  player_address: string;
  tx_type: TxType;
  tx_hash: string | null;
  amount: number;
  status: TxStatus;
  created_at: string;
  confirmed_at: string | null;
}

export interface Puzzle {
  id: string;
  fen: string;
  to_move: string;
  solution: string[];
  prize_pool: number;
  participants: number;
  puzzle_date: string;
  expires_at: string;
  created_at: string;
}

export interface PuzzleAttempt {
  id: string;
  puzzle_id: string;
  player_address: string;
  submitted_moves: string[];
  correct: boolean;
  solve_time_ms: number | null;
  rank: number | null;
  reward: number;
  created_at: string;
}

export interface MoveResult {
  valid: boolean;
  reason?: string;
  fen?: string;
  whiteTimeMs?: number;
  blackTimeMs?: number;
  moveNumber?: number;
  gameOver?: boolean;
  result?: GameResult;
  isBotGame?: boolean;
}

export interface JWTPayload {
  wallet_address: string;
  iat: number;
  exp: number;
}

export const ERRORS = {
  AUTH_REQUIRED: { code: "AUTH_REQUIRED", status: 401, message: "Authentication required" },
  AUTH_INVALID: { code: "AUTH_INVALID", status: 403, message: "Invalid authentication" },
  GAME_NOT_FOUND: { code: "GAME_NOT_FOUND", status: 404, message: "Game not found" },
  GAME_FULL: { code: "GAME_FULL", status: 409, message: "Game is full" },
  GAME_EXPIRED: { code: "GAME_EXPIRED", status: 410, message: "Game has expired" },
  STAKE_NOT_DEPOSITED: { code: "STAKE_NOT_DEPOSITED", status: 402, message: "Stake not deposited" },
  INVALID_MOVE: { code: "INVALID_MOVE", status: 422, message: "Invalid move" },
  NOT_YOUR_TURN: { code: "NOT_YOUR_TURN", status: 422, message: "Not your turn" },
  GAME_ALREADY_ENDED: { code: "GAME_ALREADY_ENDED", status: 409, message: "Game already ended" },
  PUZZLE_EXPIRED: { code: "PUZZLE_EXPIRED", status: 410, message: "Puzzle has expired" },
  PUZZLE_ALREADY_SUBMITTED: { code: "PUZZLE_ALREADY_SUBMITTED", status: 409, message: "Puzzle already submitted" },
  RATE_LIMIT: { code: "RATE_LIMIT", status: 429, message: "Rate limit exceeded" },
  SERVER_ERROR: { code: "SERVER_ERROR", status: 500, message: "Internal server error" },
} as const;
