import type {
  CreateGameRequest,
  CreateGameResponse,
  DailyPuzzle,
  GameState,
  LeaderboardEntry,
  LobbyEntry,
  StakeAmount,
  TimeControl,
} from "@/types/api";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function authHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const addr = window.localStorage.getItem("gambit:addr");
  return addr ? { Authorization: `Bearer ${addr}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const code = body?.error?.code ?? `HTTP_${res.status}`;
    const message = body?.error?.message ?? res.statusText;
    throw new ApiError(code, message, res.status);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export const api = {
  createGame(body: CreateGameRequest) {
    return request<CreateGameResponse>("/game/create", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  joinGame(gameId: string) {
    return request<GameState & { depositTx: CreateGameResponse["depositTx"] }>(
      "/game/join",
      { method: "POST", body: JSON.stringify({ gameId }) },
    );
  },
  getGame(gameId: string) {
    return request<GameState>(`/game/${gameId}`);
  },
  getLobby(params: { stake?: StakeAmount; timeControl?: TimeControl }) {
    const q = new URLSearchParams();
    if (params.stake) q.set("stake", params.stake);
    if (params.timeControl) q.set("timeControl", params.timeControl);
    return request<{ games: LobbyEntry[] }>(`/game/lobby?${q.toString()}`);
  },
  getDailyPuzzle() {
    return request<DailyPuzzle>("/puzzle/daily");
  },
  getLeaderboard(period: "weekly" | "alltime" = "weekly", limit = 20) {
    return request<{ period: string; entries: LeaderboardEntry[] }>(
      `/leaderboard?period=${period}&limit=${limit}`,
    );
  },
};
