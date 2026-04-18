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

export const StakeAmount = {
  SMALL: "0.50",
  MEDIUM: "1.00",
  LARGE: "2.00",
} as const;
export type StakeAmount = (typeof StakeAmount)[keyof typeof StakeAmount];

export const TimeControl = {
  BULLET_1_0: "1+0",
  BLITZ_3_0: "3+0",
  BLITZ_3_2: "3+2",
  RAPID_5_3: "5+3",
} as const;
export type TimeControl = (typeof TimeControl)[keyof typeof TimeControl];

export type DepositTx = {
  to: WalletAddress;
  functionName: "depositStake";
  args: [OnchainGameId, string];
};

export type CreateGameRequest = {
  stake: StakeAmount;
  timeControl: TimeControl;
  color: "white" | "black" | "random";
};

export type CreateGameResponse = {
  gameId: GameId;
  onchainGameId: OnchainGameId;
  status: GameStatus;
  stake: StakeAmount;
  timeControl: TimeControl;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  depositTx: DepositTx;
};

export type GameState = {
  gameId: GameId;
  status: GameStatus;
  white: WalletAddress;
  black: WalletAddress;
  stake: StakeAmount;
  timeControl: TimeControl;
  fen: FEN;
  moves: UCIMove[];
  whiteTimeMs: number;
  blackTimeMs: number;
  lastMoveAt: Timestamp;
  result: GameResult | null;
};

export type LobbyEntry = {
  gameId: GameId;
  creator: WalletAddress;
  stake: StakeAmount;
  timeControl: TimeControl;
  createdAt: Timestamp;
};

export type DailyPuzzle = {
  puzzleId: string;
  fen: FEN;
  toMove: "white" | "black";
  solution: UCIMove[] | null;
  prizePool: string;
  participants: number;
  expiresAt: Timestamp;
};

export type LeaderboardEntry = {
  rank: number;
  address: WalletAddress;
  wins: number;
  losses: number;
  draws: number;
  totalEarned: string;
  rating: number;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
  };
};

export type WsClientEvent =
  | { event: "game:join"; gameId: GameId }
  | { event: "move:send"; gameId: GameId; move: UCIMove }
  | { event: "draw:offer"; gameId: GameId }
  | { event: "draw:accept"; gameId: GameId }
  | { event: "draw:decline"; gameId: GameId }
  | { event: "game:resign"; gameId: GameId };

export type WsServerEvent =
  | {
      event: "game:start";
      gameId: GameId;
      white: WalletAddress;
      black: WalletAddress;
      fen: FEN;
    }
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
  | {
      event: "game:end";
      gameId: GameId;
      result: GameResult;
      reason:
        | "checkmate"
        | "timeout"
        | "resignation"
        | "draw_agreement"
        | "stalemate"
        | "insufficient"
        | "threefold"
        | "fifty_moves";
      payoutTxHash: string;
      winnerPayout: string;
      loserPayout: string;
    }
  | { event: "draw:offered"; gameId: GameId; by: WalletAddress }
  | { event: "opponent:disconnected"; gameId: GameId; timeoutAt: Timestamp }
  | { event: "clock:sync"; whiteTimeMs: number; blackTimeMs: number };
