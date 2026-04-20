// @ts-nocheck
/**
 * player.routes.test.ts
 *
 * Unit tests for the three new player endpoints:
 *   GET /player/:address/games        — match history
 *   GET /player/:address/transactions — tx history
 *   GET /player/online                — live WS count
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mocks (must be before any imports that pull in the mocked modules)
// ─────────────────────────────────────────────────────────────────────────────

const ALICE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BOB   = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

// --- Supabase in-memory state ---
let dbGames: any[]        = [];
let dbTransactions: any[] = [];

function resetDb() {
  dbGames = [
    {
      id: "game-1",
      onchain_game_id: "0x01",
      white_address: ALICE,
      black_address: BOB,
      status: "completed",
      result: "white_win",
      mode: "pvp",
      stake_amount: 1.00,
      time_control: "3+0",
      move_count: 20,
      winner_address: ALICE,
      end_reason: "checkmate",
      started_at: "2026-04-20T10:00:00Z",
      ended_at:   "2026-04-20T10:15:00Z",
      created_at: "2026-04-20T09:59:00Z",
    },
    {
      id: "game-2",
      onchain_game_id: "0x02",
      white_address: BOB,
      black_address: ALICE,
      status: "completed",
      result: "black_win",
      mode: "pvp",
      stake_amount: 0.50,
      time_control: "5+0",
      move_count: 30,
      winner_address: ALICE,
      end_reason: "resignation",
      started_at: "2026-04-20T11:00:00Z",
      ended_at:   "2026-04-20T11:20:00Z",
      created_at: "2026-04-20T10:59:00Z",
    },
    {
      id: "game-3",
      onchain_game_id: null,
      white_address: "0xcccccccccccccccccccccccccccccccccccccccc",
      black_address: null,
      status: "waiting",
      result: null,
      mode: "pvp",
      stake_amount: 2.00,
      time_control: "10+0",
      move_count: 0,
      winner_address: null,
      end_reason: null,
      started_at: null,
      ended_at: null,
      created_at: "2026-04-20T12:00:00Z",
    },
  ];

  dbTransactions = [
    {
      id: "tx-1",
      game_id: "game-1",
      player_address: ALICE,
      tx_type: "deposit",
      tx_hash: "0xhash1",
      amount: "1.000000",
      status: "confirmed",
      created_at: "2026-04-20T09:59:30Z",
      confirmed_at: "2026-04-20T10:00:00Z",
    },
    {
      id: "tx-2",
      game_id: "game-1",
      player_address: ALICE,
      tx_type: "payout",
      tx_hash: "0xhash2",
      amount: "1.950000",
      status: "confirmed",
      created_at: "2026-04-20T10:15:05Z",
      confirmed_at: "2026-04-20T10:15:10Z",
    },
  ];
}

// Minimal chainable Supabase builder
function makeQueryBuilder(table: string) {
  const b: any = {
    _table: table,
    _filters: [] as [string, any][],
    _orFilter: null as string | null,
    _orderField: null as string | null,
    _orderAsc: true,
    _rangeFrom: 0,
    _rangeTo: 19,
    _single: false,

    select()          { return this; },
    eq(col: string, val: any) { this._filters.push([col, val]); return this; },
    or(expr: string)  { this._orFilter = expr; return this; },
    order(col: string, opts?: any) {
      this._orderField = col;
      this._orderAsc = opts?.ascending ?? true;
      return this;
    },
    range(from: number, to: number) { this._rangeFrom = from; this._rangeTo = to; return this; },
    single() { this._single = true; return this; },

    then(resolve: any) { return Promise.resolve(this._execute()).then(resolve); },
    _execute() {
      const t = this._table;

      if (t === "games") {
        let rows = [...dbGames];
        // eq filters
        for (const [col, val] of this._filters) {
          rows = rows.filter(r => r[col] === val);
        }
        // or filter: "white_address.eq.0x...,black_address.eq.0x..."
        if (this._orFilter) {
          rows = rows.filter(r =>
            this._orFilter!.split(",").some((part: string) => {
              const [col, op, val] = part.split(".");
              return op === "eq" && r[col] === val;
            })
          );
        }
        if (this._orderField) {
          rows.sort((a, b) =>
            this._orderAsc
              ? a[this._orderField!] > b[this._orderField!] ? 1 : -1
              : a[this._orderField!] < b[this._orderField!] ? 1 : -1
          );
        }
        rows = rows.slice(this._rangeFrom, this._rangeTo + 1);
        return { data: rows, error: null };
      }

      if (t === "transactions") {
        let rows = [...dbTransactions];
        for (const [col, val] of this._filters) {
          rows = rows.filter(r => r[col] === val);
        }
        if (this._orderField) {
          rows.sort((a, b) =>
            this._orderAsc
              ? a[this._orderField!] > b[this._orderField!] ? 1 : -1
              : a[this._orderField!] < b[this._orderField!] ? 1 : -1
          );
        }
        rows = rows.slice(this._rangeFrom, this._rangeTo + 1);
        return { data: rows, error: null };
      }

      return { data: [], error: null };
    },
  };
  return b;
}

const mockSupabase = { from: jest.fn((t: string) => makeQueryBuilder(t)) };
jest.mock("../config/supabase", () => ({ supabase: mockSupabase }));

// Stub blockchain + env so the server can import without real keys
jest.mock("../config/blockchain", () => ({
  walletClient:  { writeContract: jest.fn() },
  publicClient:  { waitForTransactionReceipt: jest.fn(), getChainId: jest.fn(), watchContractEvent: jest.fn() },
  oracleAccount: { signMessage: jest.fn() },
}));

jest.mock("../config/env", () => ({
  env: {
    PORT: 3001, NODE_ENV: "test",
    SUPABASE_URL: "http://localhost", SUPABASE_SERVICE_KEY: "test",
    JWT_SECRET: "test-secret",
    MATCH_ESCROW_ADDRESS: "0x0000000000000000000000000000000000000001",
    CELO_RPC_URL: "https://forno.celo.org",
    CELO_TESTNET_RPC_URL: "https://alfajores-forno.celo-testnet.org",
    GAME_TIMEOUT_MS: 300000, DISCONNECT_TIMEOUT_MS: 60000, CLOCK_SYNC_INTERVAL_MS: 10000,
  },
}));

// Stub cron/watcher so the server doesn't actually start timers
jest.mock("../cron/expireGames",  () => ({ startExpireGamesCron: jest.fn() }));
jest.mock("../cron/dailyPuzzle",  () => ({ startDailyPuzzleCron: jest.fn() }));
jest.mock("../services/escrowService", () => ({
  watchMatchEvents: jest.fn(),
  settleMatch: jest.fn(),
  cancelMatch: jest.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports (after mocks)
// ─────────────────────────────────────────────────────────────────────────────

import request from "supertest";
import express from "express";
import playerRouter from "../routes/player";

// Build a minimal Express app with only the player router
const app = express();
app.use(express.json());
app.use("/player", playerRouter);

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetDb();
  mockSupabase.from.mockClear();
  mockSupabase.from.mockImplementation((t: string) => makeQueryBuilder(t));
});

describe("GET /player/:address/games", () => {
  it("returns games where the player is white or black", async () => {
    const res = await request(app).get(`/player/${ALICE}/games`);
    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(2);
    const ids = res.body.games.map((g: any) => g.id);
    expect(ids).toContain("game-1");
    expect(ids).toContain("game-2");
  });

  it("adds opponent and playerColor convenience fields", async () => {
    const res = await request(app).get(`/player/${ALICE}/games`);
    const game1 = res.body.games.find((g: any) => g.id === "game-1");
    expect(game1.opponent).toBe(BOB);
    expect(game1.playerColor).toBe("white");

    const game2 = res.body.games.find((g: any) => g.id === "game-2");
    expect(game2.opponent).toBe(BOB);
    expect(game2.playerColor).toBe("black");
  });

  it("normalizes address to lowercase", async () => {
    const upperAlice = ALICE.toUpperCase();
    const res = await request(app).get(`/player/${upperAlice}/games`);
    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(2);
  });

  it("returns empty array for a player with no games", async () => {
    const res = await request(app).get("/player/0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef/games");
    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(0);
  });

  it("filters by status query param", async () => {
    // Add a waiting game for ALICE
    dbGames.push({
      id: "game-4",
      white_address: ALICE,
      black_address: null,
      status: "waiting",
      result: null,
      mode: "pvp",
      stake_amount: 1.00,
      time_control: "3+0",
      move_count: 0,
      winner_address: null,
      end_reason: null,
      created_at: "2026-04-20T13:00:00Z",
    });

    const res = await request(app).get(`/player/${ALICE}/games?status=waiting`);
    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(1);
    expect(res.body.games[0].id).toBe("game-4");
  });

  it("respects limit and offset", async () => {
    const res = await request(app).get(`/player/${ALICE}/games?limit=1&offset=0`);
    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(1);
    expect(res.body.limit).toBe(1);
    expect(res.body.offset).toBe(0);
  });

  it("caps limit at 100", async () => {
    const res = await request(app).get(`/player/${ALICE}/games?limit=9999`);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
  });
});

describe("GET /player/:address/transactions", () => {
  it("returns transactions for the given player", async () => {
    const res = await request(app).get(`/player/${ALICE}/transactions`);
    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(2);
    const types = res.body.transactions.map((t: any) => t.tx_type);
    expect(types).toContain("deposit");
    expect(types).toContain("payout");
  });

  it("returns empty array for a player with no transactions", async () => {
    const res = await request(app).get(`/player/${BOB}/transactions`);
    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(0);
  });

  it("normalizes address to lowercase", async () => {
    const upperAlice = ALICE.toUpperCase();
    const res = await request(app).get(`/player/${upperAlice}/transactions`);
    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(2);
  });

  it("respects limit and offset", async () => {
    const res = await request(app).get(`/player/${ALICE}/transactions?limit=1&offset=0`);
    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.limit).toBe(1);
  });

  it("returns tx_hash field for each transaction", async () => {
    const res = await request(app).get(`/player/${ALICE}/transactions`);
    for (const tx of res.body.transactions) {
      expect(tx).toHaveProperty("tx_hash");
      expect(tx).toHaveProperty("amount");
      expect(tx).toHaveProperty("created_at");
    }
  });
});

describe("GET /player/online", () => {
  it("returns online count as a number", async () => {
    const res = await request(app).get("/player/online");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("online");
    expect(typeof res.body.online).toBe("number");
  });

  it("returns 0 when no WS server is set up", async () => {
    // wsServer._wss is null in this isolated test (no setupWebSocket called)
    const res = await request(app).get("/player/online");
    expect(res.status).toBe(200);
    expect(res.body.online).toBe(0);
  });
});
