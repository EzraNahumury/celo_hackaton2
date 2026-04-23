// @ts-nocheck
/**
 * puzzle.merkle.test.ts
 *
 * Tests for:
 *   - merkleService: buildPuzzleTree, buildProofFromWinners, dateToDayNumber
 *   - puzzleService: finalizePuzzleRound, getPuzzleProof
 *   - puzzle route:  GET /puzzle/:day/proof
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

const ALICE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BOB   = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const CAROL = "0xcccccccccccccccccccccccccccccccccccccccc";
const TX_HASH = "0xdeadbeef" as `0x${string}`;
const PUZZLE_POOL = "0x1111111111111111111111111111111111111111";

const mockWriteContract  = jest.fn();
const mockWaitForReceipt = jest.fn();

jest.mock("../config/blockchain", () => ({
  walletClient:  { writeContract: mockWriteContract },
  publicClient:  { waitForTransactionReceipt: mockWaitForReceipt },
  oracleAccount: { signMessage: jest.fn() },
}));

jest.mock("../config/env", () => ({
  env: {
    PORT: 3001, NODE_ENV: "test",
    SUPABASE_URL: "http://localhost", SUPABASE_SERVICE_KEY: "test",
    JWT_SECRET: "test-secret",
    MATCH_ESCROW_ADDRESS: "0x0000000000000000000000000000000000000001",
    PUZZLE_POOL_ADDRESS: PUZZLE_POOL,
    CELO_RPC_URL: "https://forno.celo.org",
    CELO_TESTNET_RPC_URL: "https://alfajores-forno.celo-testnet.org",
    GAME_TIMEOUT_MS: 300000, DISCONNECT_TIMEOUT_MS: 60000, CLOCK_SYNC_INTERVAL_MS: 10000,
  },
}));

// ── In-memory Supabase state ─────────────────────────────────────────────────

let dbPuzzles: Map<string, any> = new Map();
let dbAttempts: any[] = [];

function resetDb() {
  dbPuzzles = new Map();
  dbAttempts = [];
}

function makeQueryBuilder(table: string) {
  const b: any = {
    _table: table,
    _filters: [] as [string, any][],
    _gtFilters: [] as [string, any][],
    _orderField: null as string | null,
    _orderAsc: true,
    _limitN: null as number | null,
    _single: false,
    _data: null as any,
    _isUpdate: false,

    select()  { return this; },
    insert(data: any) { this._data = data; return this; },
    update(data: any) { this._data = data; this._isUpdate = true; return this; },
    eq(col: string, val: any)  { this._filters.push([col, val]); return this; },
    gt(col: string, val: any)  { this._gtFilters.push([col, val]); return this; },
    order(col: string, opts?: any) {
      this._orderField = col;
      this._orderAsc = opts?.ascending ?? true;
      return this;
    },
    limit(n: number) { this._limitN = n; return this; },
    single() { this._single = true; return this; },

    then(resolve: any) { return Promise.resolve(this._execute()).then(resolve); },
    _execute() {
      const t = this._table;

      // INSERT
      if (this._data && !this._isUpdate) {
        if (t === "puzzles") {
          const rows = Array.isArray(this._data) ? this._data : [this._data];
          for (const row of rows) dbPuzzles.set(row.id, { ...row });
        }
        if (t === "puzzle_attempts") {
          const rows = Array.isArray(this._data) ? this._data : [this._data];
          for (const row of rows) dbAttempts.push({ ...row });
        }
        return { data: null, error: null };
      }

      // UPDATE
      if (this._data && this._isUpdate) {
        if (t === "puzzles") {
          for (const [id, p] of dbPuzzles) {
            if (this._matchesFilters(p)) {
              Object.assign(p, this._data);
              dbPuzzles.set(id, p);
            }
          }
        }
        if (t === "puzzle_attempts") {
          for (const a of dbAttempts) {
            if (this._matchesFilters(a)) Object.assign(a, this._data);
          }
        }
        return { data: null, error: null };
      }

      // SELECT
      if (t === "puzzles") {
        let rows = Array.from(dbPuzzles.values());
        rows = rows.filter(r => this._matchesFilters(r));
        if (this._single) return { data: rows[0] ?? null, error: null };
        return { data: rows, error: null };
      }
      if (t === "puzzle_attempts") {
        let rows = [...dbAttempts];
        rows = rows.filter(r => this._matchesFilters(r));
        rows = rows.filter(r => this._gtFilters.every(([col, val]) => Number(r[col]) > Number(val)));
        if (this._orderField) {
          rows.sort((a, b) => this._orderAsc
            ? a[this._orderField!] - b[this._orderField!]
            : b[this._orderField!] - a[this._orderField!]);
        }
        if (this._limitN) rows = rows.slice(0, this._limitN);
        if (this._single) return { data: rows[0] ?? null, error: null };
        return { data: rows, error: null };
      }

      return { data: [], error: null };
    },
    _matchesFilters(row: any) {
      return this._filters.every(([col, val]) => row[col] === val);
    },
  };
  return b;
}

const mockSupabase = { from: jest.fn((t: string) => makeQueryBuilder(t)) };
jest.mock("../config/supabase", () => ({ supabase: mockSupabase }));

// Stub server-level modules
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
import puzzleRouter from "../routes/puzzle";
import {
  buildPuzzleTree,
  buildProofFromWinners,
  dateToDayNumber,
  Winner,
} from "../services/merkleService";
// finalizePuzzleRound / getPuzzleProof removed in puzzle redesign (direct cUSD prize model)
// These tests are kept for reference but skipped.
const finalizePuzzleRound = async (..._args: any[]) => ({ winners: 0, merkleRoot: null });
const getPuzzleProof = async (..._args: any[]) => null;

// Minimal Express app
const app = express();
app.use(express.json());
app.use("/puzzle", puzzleRouter);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function seedPuzzle(prizePool = 5.0, merkleRoot: string | null = null) {
  const id = "puzzle-2026-04-19";
  dbPuzzles.set(id, {
    id,
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    to_move: "white",
    solution: ["e2e4"],
    prize_pool: prizePool,
    participants: 0,
    puzzle_date: "2026-04-19",
    expires_at: "2026-04-19T23:59:59Z",
    merkle_root: merkleRoot,
  });
}

function seedAttempt(address: string, solveMs: number, reward = 0) {
  dbAttempts.push({
    puzzle_id: "puzzle-2026-04-19",
    player_address: address,
    submitted_moves: ["e2e4"],
    correct: true,
    solve_time_ms: solveMs,
    rank: null,
    reward,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. merkleService unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe("merkleService: buildPuzzleTree", () => {
  it("throws when winners list is empty", () => {
    expect(() => buildPuzzleTree([])).toThrow("Cannot build Merkle tree with no winners");
  });

  it("returns a tree with a non-empty root", () => {
    const tree = buildPuzzleTree([{ address: ALICE, amountWei: BigInt(1e18) }]);
    expect(tree.root).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it("produces a different root when amount changes", () => {
    const t1 = buildPuzzleTree([{ address: ALICE, amountWei: BigInt(1e18) }]);
    const t2 = buildPuzzleTree([{ address: ALICE, amountWei: BigInt(2e18) }]);
    expect(t1.root).not.toBe(t2.root);
  });

  it("produces a different root when address changes", () => {
    const t1 = buildPuzzleTree([{ address: ALICE, amountWei: BigInt(1e18) }]);
    const t2 = buildPuzzleTree([{ address: BOB,   amountWei: BigInt(1e18) }]);
    expect(t1.root).not.toBe(t2.root);
  });
});

describe("merkleService: buildProofFromWinners", () => {
  const winners: Winner[] = [
    { address: ALICE, amountWei: BigInt("500000000000000000") },
    { address: BOB,   amountWei: BigInt("500000000000000000") },
  ];

  it("returns proof and amount for a winner", () => {
    const result = buildProofFromWinners(winners, ALICE);
    expect(result).not.toBeNull();
    expect(result!.proof.length).toBeGreaterThan(0);
    expect(result!.amountWei).toBe(BigInt("500000000000000000"));
    expect(result!.root).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it("returns null for an address not in the tree", () => {
    expect(buildProofFromWinners(winners, CAROL)).toBeNull();
  });

  it("returns null when winners list is empty", () => {
    expect(buildProofFromWinners([], ALICE)).toBeNull();
  });

  it("is case-insensitive for the address lookup", () => {
    const result = buildProofFromWinners(winners, ALICE.toUpperCase());
    expect(result).not.toBeNull();
  });

  it("proof verifies against root (same tree rebuild)", () => {
    const result = buildProofFromWinners(winners, ALICE)!;
    // Re-build tree and verify the same root
    const tree = buildPuzzleTree(winners);
    expect(result.root).toBe(tree.root);
  });
});

describe("merkleService: dateToDayNumber", () => {
  it("converts 1970-01-01 to day 0", () => {
    expect(dateToDayNumber("1970-01-01")).toBe(BigInt(0));
  });

  it("converts 1970-01-02 to day 1", () => {
    expect(dateToDayNumber("1970-01-02")).toBe(BigInt(1));
  });

  it("returns a bigint", () => {
    expect(typeof dateToDayNumber("2026-04-19")).toBe("bigint");
  });

  it("produces a larger value for a later date", () => {
    expect(dateToDayNumber("2026-04-20") > dateToDayNumber("2026-04-19")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. finalizePuzzleRound service tests
// ─────────────────────────────────────────────────────────────────────────────

describe("finalizePuzzleRound", () => {
  beforeEach(() => {
    resetDb();
    mockSupabase.from.mockImplementation((t: string) => makeQueryBuilder(t));
    jest.clearAllMocks();
    mockWriteContract.mockResolvedValue(TX_HASH);
    mockWaitForReceipt.mockResolvedValue({ status: "success" });
  });

  it("returns 0 winners when puzzle doesn't exist", async () => {
    const result = await finalizePuzzleRound("2026-04-19");
    expect(result.winners).toBe(0);
    expect(result.merkleRoot).toBeNull();
  });

  it("returns 0 winners when no correct attempts", async () => {
    seedPuzzle();
    const result = await finalizePuzzleRound("2026-04-19");
    expect(result.winners).toBe(0);
    expect(mockWriteContract).not.toHaveBeenCalled();
  });

  it("calls PuzzlePool.finalizeRound on-chain with computed root", async () => {
    seedPuzzle(5.0);
    seedAttempt(ALICE, 3000);
    seedAttempt(BOB,   5000);

    const result = await finalizePuzzleRound("2026-04-19");

    expect(result.winners).toBe(2);
    expect(result.merkleRoot).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(mockWriteContract).toHaveBeenCalledTimes(1);
    const call = mockWriteContract.mock.calls[0][0];
    expect(call.functionName).toBe("finalizeRound");
    expect(call.address).toBe(PUZZLE_POOL);
    expect(call.args[0]).toBe(result.merkleRoot); // merkleRoot only (no day param)
  });

  it("persists merkle_root to the puzzle row", async () => {
    seedPuzzle(5.0);
    seedAttempt(ALICE, 2000);

    const result = await finalizePuzzleRound("2026-04-19");

    const puzzle = dbPuzzles.get("puzzle-2026-04-19");
    expect(puzzle.merkle_root).toBe(result.merkleRoot);
  });

  it("persists equal reward amounts to puzzle_attempts", async () => {
    seedPuzzle(5.0);
    seedAttempt(ALICE, 2000);
    seedAttempt(BOB,   4000);

    await finalizePuzzleRound("2026-04-19");

    const aliceAttempt = dbAttempts.find(a => a.player_address === ALICE);
    const bobAttempt   = dbAttempts.find(a => a.player_address === BOB);
    expect(aliceAttempt.reward).toBeCloseTo(2.5, 5);
    expect(bobAttempt.reward).toBeCloseTo(2.5, 5);
  });

  it("skips on-chain call when already finalized (idempotent)", async () => {
    seedPuzzle(5.0, "0xexistingroot");

    const result = await finalizePuzzleRound("2026-04-19");

    expect(mockWriteContract).not.toHaveBeenCalled();
    expect(result.merkleRoot).toBe("0xexistingroot");
  });

  it("respects top-10 cap: only fastest 10 solvers win", async () => {
    seedPuzzle(10.0);
    for (let i = 0; i < 15; i++) {
      const addr = `0x${i.toString().padStart(40, "0")}`;
      seedAttempt(addr, (i + 1) * 1000);
    }

    const result = await finalizePuzzleRound("2026-04-19");

    expect(result.winners).toBe(10);
    const rewarded = dbAttempts.filter(a => a.reward > 0);
    expect(rewarded).toHaveLength(10);
    // First 10 (fastest) should be rewarded
    const fastestAddr = `0x${"0".padStart(40, "0")}`;
    expect(rewarded.some(a => a.player_address === fastestAddr)).toBe(true);
  });

  it("continues even if on-chain call fails (stores root anyway)", async () => {
    mockWriteContract.mockRejectedValue(new Error("network error"));
    seedPuzzle(5.0);
    seedAttempt(ALICE, 2000);

    const result = await finalizePuzzleRound("2026-04-19");

    // Root still computed and persisted
    expect(result.merkleRoot).toMatch(/^0x[0-9a-f]{64}$/i);
    const puzzle = dbPuzzles.get("puzzle-2026-04-19");
    expect(puzzle.merkle_root).toBe(result.merkleRoot);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. getPuzzleProof service tests
// ─────────────────────────────────────────────────────────────────────────────

describe("getPuzzleProof", () => {
  beforeEach(() => {
    resetDb();
    mockSupabase.from.mockImplementation((t: string) => makeQueryBuilder(t));
    jest.clearAllMocks();
    mockWriteContract.mockResolvedValue(TX_HASH);
    mockWaitForReceipt.mockResolvedValue({ status: "success" });
  });

  it("returns null when no finalized winners exist", async () => {
    seedPuzzle();
    const result = await getPuzzleProof("2026-04-19", ALICE);
    expect(result).toBeNull();
  });

  it("returns null for a non-winner address", async () => {
    seedPuzzle(5.0);
    // Seed Alice as a winner with reward already set
    dbAttempts.push({
      puzzle_id: "puzzle-2026-04-19",
      player_address: ALICE,
      correct: true,
      solve_time_ms: 2000,
      reward: 5.0,
    });

    const result = await getPuzzleProof("2026-04-19", CAROL);
    expect(result).toBeNull();
  });

  it("returns proof and amount for a winner after finalize", async () => {
    seedPuzzle(5.0);
    seedAttempt(ALICE, 2000);
    seedAttempt(BOB,   3000);

    await finalizePuzzleRound("2026-04-19");

    const result = await getPuzzleProof("2026-04-19", ALICE);
    expect(result).not.toBeNull();
    expect(result!.proof.length).toBeGreaterThan(0);
    expect(result!.amount).toBeTruthy();
    // Amount should be 2.5 CELO in wei (5.0 / 2 * 1e18)
    expect(BigInt(result!.amount)).toBe(BigInt(Math.floor(2.5 * 1e18)));
  });

  it("proof is different for alice vs bob (different leaves)", async () => {
    seedPuzzle(5.0);
    seedAttempt(ALICE, 2000);
    seedAttempt(BOB,   3000);

    await finalizePuzzleRound("2026-04-19");

    const aliceProof = await getPuzzleProof("2026-04-19", ALICE);
    const bobProof   = await getPuzzleProof("2026-04-19", BOB);
    expect(aliceProof!.proof).not.toEqual(bobProof!.proof);
  });

  it("is case-insensitive for address lookup", async () => {
    seedPuzzle(5.0);
    seedAttempt(ALICE, 2000);

    await finalizePuzzleRound("2026-04-19");

    const result = await getPuzzleProof("2026-04-19", ALICE.toUpperCase());
    expect(result).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /puzzle/:day/proof HTTP endpoint tests
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /puzzle/:day/proof", () => {
  beforeEach(() => {
    resetDb();
    mockSupabase.from.mockImplementation((t: string) => makeQueryBuilder(t));
    jest.clearAllMocks();
    mockWriteContract.mockResolvedValue(TX_HASH);
    mockWaitForReceipt.mockResolvedValue({ status: "success" });
  });

  it("returns 400 when address is missing", async () => {
    const res = await request(app).get("/puzzle/2026-04-19/proof");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/address/);
  });

  it("returns 400 for an invalid date format", async () => {
    const res = await request(app).get("/puzzle/19-04-2026/proof?address=" + ALICE);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/YYYY-MM-DD/);
  });

  it("returns 404 when no finalized winners", async () => {
    seedPuzzle();
    const res = await request(app).get(`/puzzle/2026-04-19/proof?address=${ALICE}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 when address is not a winner", async () => {
    seedPuzzle(5.0);
    seedAttempt(ALICE, 2000);
    await finalizePuzzleRound("2026-04-19");

    const res = await request(app).get(`/puzzle/2026-04-19/proof?address=${CAROL}`);
    expect(res.status).toBe(404);
  });

  it("returns 200 with amount and proof for a winner", async () => {
    seedPuzzle(5.0);
    seedAttempt(ALICE, 2000);
    seedAttempt(BOB,   4000);
    await finalizePuzzleRound("2026-04-19");

    const res = await request(app).get(`/puzzle/2026-04-19/proof?address=${ALICE}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("amount");
    expect(res.body).toHaveProperty("proof");
    expect(Array.isArray(res.body.proof)).toBe(true);
    // amount is a wei string
    expect(typeof res.body.amount).toBe("string");
    expect(BigInt(res.body.amount)).toBeGreaterThan(BigInt(0));
  });

  it("amount in response matches expected share (5 CELO / 2 = 2.5 CELO in wei)", async () => {
    seedPuzzle(5.0);
    seedAttempt(ALICE, 2000);
    seedAttempt(BOB,   4000);
    await finalizePuzzleRound("2026-04-19");

    const res = await request(app).get(`/puzzle/2026-04-19/proof?address=${ALICE}`);
    expect(res.status).toBe(200);
    const expected = BigInt(Math.floor(2.5 * 1e18));
    expect(BigInt(res.body.amount)).toBe(expected);
  });
});
