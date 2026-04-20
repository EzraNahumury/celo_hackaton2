export type WalletAddress = `0x${string}`;
export type UCIMove = string;
export type GameId = string;
export type OnchainGameId = string;
export type FEN = string;
export type Timestamp = string;

export const GameStatus = {
  WAITING: "waiting",
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
} as const;
export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

export const GameResult = {
  WHITE_WIN: "white_win",
  BLACK_WIN: "black_win",
  DRAW: "draw",
  ABORT: "abort",
} as const;
export type GameResult = (typeof GameResult)[keyof typeof GameResult];

export const GameMode = {
  PVP: "pvp",
  BOT: "bot",
} as const;
export type GameMode = (typeof GameMode)[keyof typeof GameMode];

export const StakeAmount = {
  SMALL: "0.05",
  MEDIUM: "0.10",
  LARGE: "0.20",
} as const;
export type StakeAmount = (typeof StakeAmount)[keyof typeof StakeAmount];

export const TimeControl = {
  BULLET_1_0: "1+0",
  BLITZ_3_0: "3+0",
  BLITZ_3_2: "3+2",
  RAPID_5_0: "5+0",
  RAPID_5_3: "5+3",
  CLASSIC_10_0: "10+0",
  CLASSIC_10_5: "10+5",
} as const;
export type TimeControl = (typeof TimeControl)[keyof typeof TimeControl];

// BE returns depositTx for on-chain MatchEscrow.createMatch / joinMatch.
// `value` is a decimal-string in wei. `args` holds either [tcSeconds] (create) or [matchId] (join).
export type DepositTx = {
  to: WalletAddress | null;
  functionName: "createMatch" | "joinMatch";
  args: [number] | [string];
  value: string;
};

// ---- Auth ----
export type AuthNonceResponse = { nonce: string; expiresAt: Timestamp };
export type AuthVerifyResponse = { token: string; expiresIn: number };

// ---- Game ----
export type CreateGameRequest = {
  stake: StakeAmount;
  timeControl: TimeControl;
  color?: "white" | "black" | "random";
  mode?: GameMode;
};

export type CreateGameResponse = {
  gameId: GameId;
  status: GameStatus;
  depositTx?: DepositTx;
};

export type JoinGameResponse = {
  gameId: GameId;
  white: WalletAddress | null;
  black: WalletAddress | null;
  stake: number;
  depositTx?: DepositTx;
};

// Single move row as stored in DB.
export type MoveRow = {
  id: string;
  game_id: string;
  player_address: WalletAddress;
  move_number: number;
  uci_move: UCIMove;
  fen_after: FEN;
  time_remaining_ms: number | null;
  created_at: Timestamp;
};

// GET /game/:gameId returns full DB row + moves[] (snake_case).
export type GameState = {
  id: GameId;
  onchain_game_id: string | null;
  white_address: WalletAddress | null;
  black_address: WalletAddress | null;
  status: GameStatus;
  result: GameResult | null;
  mode: GameMode;
  stake_amount: number;
  time_control: TimeControl;
  fen: FEN;
  white_time_ms: number | null;
  black_time_ms: number | null;
  move_count: number;
  winner_address: WalletAddress | null;
  end_reason: string | null;
  created_at: Timestamp;
  started_at: Timestamp | null;
  ended_at: Timestamp | null;
  expires_at: Timestamp | null;
  moves: MoveRow[];
};

// Lobby entry mirrors DB row shape returned by GET /game/lobby.
export type LobbyEntry = {
  id: GameId;
  white_address: WalletAddress | null;
  black_address: WalletAddress | null;
  stake_amount: number;
  time_control: TimeControl;
  status: GameStatus;
  expires_at: Timestamp;
  created_at: Timestamp;
};

export type MoveResult =
  | {
      valid: true;
      fen: FEN;
      whiteTimeMs: number;
      blackTimeMs: number;
      moveNumber: number;
      gameOver: boolean;
      isBotGame: boolean;
      result?: GameResult;
    }
  | {
      valid: false;
      reason: string;
    };

export type ResignResponse = {
  result: GameResult;
  payoutTxHash: string | null;
};

// ---- Puzzle ----
export type DailyPuzzle = {
  id: string;
  fen: FEN;
  to_move: "white" | "black";
  prize_pool: number;
  participants: number;
  puzzle_date: string;
  expires_at: Timestamp;
  created_at: Timestamp;
};

export type SubmitPuzzleResponse = {
  correct: boolean;
  rank: number | null;
  totalParticipants: number;
  reward: number;
};

// ---- Player history ----
// Row returned by GET /player/:address/games. Shape is DB row + BE adds
// `opponent` and `playerColor` for the caller's perspective.
export type PlayerGameRow = {
  id: GameId;
  onchain_game_id: string | null;
  white_address: WalletAddress | null;
  black_address: WalletAddress | null;
  status: GameStatus;
  result: GameResult | null;
  mode: GameMode;
  stake_amount: number;
  time_control: TimeControl;
  move_count: number;
  winner_address: WalletAddress | null;
  end_reason: string | null;
  started_at: Timestamp | null;
  ended_at: Timestamp | null;
  created_at: Timestamp;
  opponent: WalletAddress | null;
  playerColor: "white" | "black";
};

export type PlayerGamesResponse = {
  games: PlayerGameRow[];
  total: number;
  limit: number;
  offset: number;
};

export type TxType = "deposit" | "payout" | "refund" | "fee";
export type TxStatus = "pending" | "confirmed" | "failed";

export type PlayerTransactionRow = {
  id: string;
  game_id: GameId | null;
  tx_type: TxType;
  tx_hash: string | null;
  amount: number;
  status: TxStatus;
  created_at: Timestamp;
  confirmed_at: Timestamp | null;
};

export type PlayerTransactionsResponse = {
  transactions: PlayerTransactionRow[];
  limit: number;
  offset: number;
};

export type OnlineCountResponse = { online: number };

export type PlayerProfile = {
  wallet_address: WalletAddress;
  username: string | null;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  total_earned: number;
  created_at: Timestamp;
  last_seen: Timestamp;
  rank: number;
};

// Shape returned by /puzzle/daily/proof or /puzzle/:day/proof.
// `amount` is a decimal-string in wei (pass directly to PuzzlePool.claim).
export type PuzzleProofResponse = {
  amount: string;
  proof: `0x${string}`[];
};

// ---- Leaderboard ----
export type LeaderboardEntry = {
  rank: number;
  address: WalletAddress;
  username: string | null;
  wins: number;
  losses: number;
  draws: number;
  rating: number;
  totalEarned: number;
};

export type LeaderboardResponse = {
  period: string;
  entries: LeaderboardEntry[];
};

// ---- WebSocket ----
// BE connection: ws://host?gameId=<uuid>&token=<jwt>
// Events are JSON messages with an `event` discriminator.
export type WsClientEvent =
  | { event: "move:send"; move: UCIMove }
  | { event: "draw:offer" }
  | { event: "draw:accept" }
  | { event: "game:resign" };

export type WsServerEvent =
  | { event: "connected"; gameId: GameId }
  | {
      event: "move:made";
      gameId: GameId;
      move: UCIMove;
      fen: FEN;
      whiteTimeMs: number;
      blackTimeMs: number;
      moveNumber: number;
    }
  | { event: "move:invalid"; reason: string }
  | { event: "draw:offered"; by: WalletAddress }
  | { event: "draw:accepted"; by: WalletAddress }
  | {
      event: "game:end";
      gameId: GameId;
      result: GameResult;
      reason?: string;
    }
  | { event: "error"; message: string };
