import type {
  AuthNonceResponse,
  AuthVerifyResponse,
  CreateGameRequest,
  CreateGameResponse,
  DailyPuzzle,
  GameState,
  GameStatus,
  JoinGameResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  LobbyEntry,
  MoveResult,
  OnlineCountResponse,
  PlayerGamesResponse,
  PlayerProfile,
  PlayerTransactionsResponse,
  PuzzleHintResponse,
  PuzzleMoveResponse,
  PuzzleProofResponse,
  ResignResponse,
  StakeAmount,
  SubmitPuzzleResponse,
  TimeControl,
  WalletAddress,
} from "@/types/api";
import { getAuthToken } from "./auth";

// Resolve the API origin at call time rather than baking `localhost` in.
// On a phone, `localhost` is the phone itself — the dev-machine backend is
// unreachable. When NEXT_PUBLIC_API_URL still points at localhost but the
// page was opened from a LAN IP / tunnel host, rewrite the hostname so API
// calls go to the same machine serving the frontend (port 3001).
function resolveApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  if (typeof window === "undefined") return configured;
  try {
    const pageHost = window.location.hostname;
    const apiUrl = new URL(configured);
    const apiHostIsLocal =
      apiUrl.hostname === "localhost" || apiUrl.hostname === "127.0.0.1";
    const pageHostIsLocal =
      pageHost === "localhost" || pageHost === "127.0.0.1";
    if (apiHostIsLocal && !pageHostIsLocal) {
      apiUrl.hostname = pageHost;
      return apiUrl.toString().replace(/\/$/, "");
    }
  } catch {
    // fall through to configured
  }
  return configured;
}

const API_URL = /* @__PURE__ */ (() => resolveApiUrl())();

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOpts = RequestInit & { auth?: boolean };

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { auth, headers: h, ...init } = opts;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(h as Record<string, string> | undefined),
  };
  if (auth) {
    const token = getAuthToken();
    if (!token) throw new ApiError("AUTH_REQUIRED", "Not authenticated", 401);
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const code = body?.code ?? body?.error?.code ?? `HTTP_${res.status}`;
    const message = body?.message ?? body?.error?.message ?? body?.error ?? res.statusText;
    throw new ApiError(String(code), String(message), res.status);
  }
  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // ---- Auth ----
  getNonce(address: WalletAddress) {
    return request<AuthNonceResponse>(
      `/auth/nonce?address=${encodeURIComponent(address)}`,
    );
  },
  verifyAuth(address: WalletAddress, txHash?: string) {
    return request<AuthVerifyResponse>("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ address, txHash }),
    });
  },

  // ---- Game ----
  createGame(body: CreateGameRequest) {
    return request<CreateGameResponse>("/game/create", {
      method: "POST",
      auth: true,
      body: JSON.stringify(body),
    });
  },
  joinGame(gameId: string) {
    return request<JoinGameResponse>("/game/join", {
      method: "POST",
      auth: true,
      body: JSON.stringify({ gameId }),
    });
  },
  getGame(gameId: string) {
    return request<GameState>(`/game/${encodeURIComponent(gameId)}`);
  },
  getLobby(params: { stake?: StakeAmount | number; timeControl?: TimeControl } = {}) {
    const q = new URLSearchParams();
    if (params.stake !== undefined) q.set("stake", String(params.stake));
    if (params.timeControl) q.set("timeControl", params.timeControl);
    const qs = q.toString();
    return request<{ games: LobbyEntry[] }>(`/game/lobby${qs ? `?${qs}` : ""}`);
  },
  makeMove(gameId: string, move: string) {
    return request<MoveResult>(`/game/${encodeURIComponent(gameId)}/move`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({ move }),
    });
  },
  resignGame(gameId: string) {
    return request<ResignResponse>(`/game/${encodeURIComponent(gameId)}/resign`, {
      method: "POST",
      auth: true,
    });
  },

  // ---- Puzzle ----
  getDailyPuzzle() {
    return request<DailyPuzzle>("/puzzle/daily");
  },
  // Validate a single player move step-by-step (no auth required).
  // moveIndex is the index in the full solution array for the player's current turn (0, 2, 4...).
  validatePuzzleMove(puzzleId: string, moveIndex: number, move: string) {
    return request<PuzzleMoveResponse>("/puzzle/daily/move", {
      method: "POST",
      body: JSON.stringify({ puzzleId, moveIndex, move }),
    });
  },
  // Fetch the correct move for the current step to show as a hint.
  // Using a hint disqualifies the player from the prize.
  getPuzzleHint(puzzleId: string, step: number) {
    return request<PuzzleHintResponse>(
      `/puzzle/daily/hint?puzzleId=${encodeURIComponent(puzzleId)}&step=${step}`,
    );
  },
  submitPuzzle(puzzleId: string, moves: string[], timeMs: number, usedHint = false) {
    return request<SubmitPuzzleResponse>("/puzzle/daily/submit", {
      method: "POST",
      auth: true,
      body: JSON.stringify({ puzzleId, moves, timeMs, usedHint }),
    });
  },
  // Get Merkle proof for today's puzzle prize claim. Returns 404 if round
  // not finalized yet or the caller isn't a winner.
  getPuzzleProofToday(address: WalletAddress) {
    return request<PuzzleProofResponse>(
      `/puzzle/daily/proof?addr=${encodeURIComponent(address)}`,
    );
  },
  // Get proof for a specific day (YYYY-MM-DD) — useful for past rounds.
  getPuzzleProof(day: string, address: WalletAddress) {
    return request<PuzzleProofResponse>(
      `/puzzle/${encodeURIComponent(day)}/proof?address=${encodeURIComponent(address)}`,
    );
  },

  // ---- Leaderboard ----
  getLeaderboard(period: "weekly" | "monthly" | "all" = "all", limit = 20) {
    return request<LeaderboardResponse>(
      `/leaderboard?period=${period}&limit=${limit}`,
    );
  },

  // ---- Player ----
  getPlayer(address: WalletAddress) {
    return request<PlayerProfile>(
      `/player/${encodeURIComponent(address)}`,
    );
  },
  getPlayerGames(
    address: WalletAddress,
    params: { limit?: number; offset?: number; status?: GameStatus } = {},
  ) {
    const q = new URLSearchParams();
    if (params.limit !== undefined) q.set("limit", String(params.limit));
    if (params.offset !== undefined) q.set("offset", String(params.offset));
    if (params.status) q.set("status", params.status);
    const qs = q.toString();
    return request<PlayerGamesResponse>(
      `/player/${encodeURIComponent(address)}/games${qs ? `?${qs}` : ""}`,
    );
  },
  getPlayerTransactions(
    address: WalletAddress,
    params: { limit?: number; offset?: number } = {},
  ) {
    const q = new URLSearchParams();
    if (params.limit !== undefined) q.set("limit", String(params.limit));
    if (params.offset !== undefined) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<PlayerTransactionsResponse>(
      `/player/${encodeURIComponent(address)}/transactions${qs ? `?${qs}` : ""}`,
    );
  },
  getOnlineCount() {
    return request<OnlineCountResponse>("/player/online");
  },
};

export type { LeaderboardEntry };
