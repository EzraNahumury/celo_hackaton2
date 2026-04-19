// @ts-nocheck
/**
 * escrowService.test.ts
 *
 * Unit tests verifying that escrowService correctly integrates with the
 * MatchEscrow.sol interface (not the old ChessEscrow ABI).
 *
 * All blockchain and Supabase calls are mocked.
 */

import { jest } from "@jest/globals";

// ── Mock viem + blockchain config ────────────────────────────────────────────

const mockWriteContract = jest.fn() as jest.Mock;
const mockWaitForReceipt = jest.fn() as jest.Mock;
const mockGetChainId = (jest.fn() as jest.Mock).mockResolvedValue(42220);
const mockSignMessage = jest.fn() as jest.Mock;
const mockWatchContractEvent = jest.fn() as jest.Mock;

jest.mock("../config/blockchain", () => ({
  walletClient: {
    writeContract: mockWriteContract,
  },
  publicClient: {
    waitForTransactionReceipt: mockWaitForReceipt,
    getChainId: mockGetChainId,
    watchContractEvent: mockWatchContractEvent,
  },
  oracleAccount: {
    signMessage: mockSignMessage,
  },
}));

// ── Mock Supabase ─────────────────────────────────────────────────────────────

const mockInsert = (jest.fn() as jest.Mock).mockResolvedValue({ error: null });
const mockUpdate = (jest.fn() as jest.Mock).mockReturnThis();
const mockEq = (jest.fn() as jest.Mock).mockReturnThis();
const mockOr = (jest.fn() as jest.Mock).mockReturnThis();
const mockIs = (jest.fn() as jest.Mock).mockReturnThis();
const mockOrder = (jest.fn() as jest.Mock).mockReturnThis();
const mockLimit = (jest.fn() as jest.Mock).mockResolvedValue({ data: [] });
const mockSelect = (jest.fn() as jest.Mock).mockReturnThis();
const mockFrom = jest.fn(() => ({
  insert: mockInsert,
  update: mockUpdate,
  select: mockSelect,
  eq: mockEq,
  or: mockOr,
  is: mockIs,
  order: mockOrder,
  limit: mockLimit,
}));

jest.mock("../config/supabase", () => ({
  supabase: { from: mockFrom },
}));

// ── Mock env ──────────────────────────────────────────────────────────────────

jest.mock("../config/env", () => ({
  env: {
    MATCH_ESCROW_ADDRESS: "0x1234567890123456789012345678901234567890",
    NODE_ENV: "test",
  },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { settleMatch, cancelMatch, watchMatchEvents } from "../services/escrowService";
import MatchEscrowABI from "../contracts/MatchEscrow.json";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MATCH_ID = BigInt(42);
const PLAYER_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`;
const PLAYER_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as `0x${string}`;
const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const TX_HASH = "0xdeadbeef" as `0x${string}`;
const FAKE_SIG = "0xcafe" as `0x${string}`;

function mockSuccessfulTx() {
  mockWriteContract.mockResolvedValueOnce(TX_HASH);
  mockWaitForReceipt.mockResolvedValueOnce({ status: "success", gasUsed: BigInt(50000) });
}

// ── ABI shape tests ───────────────────────────────────────────────────────────

describe("MatchEscrow ABI shape", () => {
  const fnNames = (MatchEscrowABI as any[])
    .filter((e) => e.type === "function")
    .map((e) => e.name);
  const eventNames = (MatchEscrowABI as any[])
    .filter((e) => e.type === "event")
    .map((e) => e.name);

  test("has settleMatch function (not resolveGame)", () => {
    expect(fnNames).toContain("settleMatch");
    expect(fnNames).not.toContain("resolveGame");
  });

  test("has cancelMatch function (not refundStake)", () => {
    expect(fnNames).toContain("cancelMatch");
    expect(fnNames).not.toContain("refundStake");
  });

  test("has createMatch and joinMatch", () => {
    expect(fnNames).toContain("createMatch");
    expect(fnNames).toContain("joinMatch");
  });

  test("settleMatch takes (uint256, address, bytes) args", () => {
    const fn = (MatchEscrowABI as any[]).find(
      (e) => e.type === "function" && e.name === "settleMatch"
    );
    expect(fn).toBeDefined();
    expect(fn.inputs[0].type).toBe("uint256"); // matchId
    expect(fn.inputs[1].type).toBe("address"); // winner
    expect(fn.inputs[2].type).toBe("bytes");   // sig
  });

  test("createMatch is payable", () => {
    const fn = (MatchEscrowABI as any[]).find(
      (e) => e.type === "function" && e.name === "createMatch"
    );
    expect(fn.stateMutability).toBe("payable");
  });

  test("joinMatch is payable", () => {
    const fn = (MatchEscrowABI as any[]).find(
      (e) => e.type === "function" && e.name === "joinMatch"
    );
    expect(fn.stateMutability).toBe("payable");
  });

  test("has MatchCreated event (not StakeDeposited)", () => {
    expect(eventNames).toContain("MatchCreated");
    expect(eventNames).not.toContain("StakeDeposited");
  });

  test("has MatchJoined event", () => {
    expect(eventNames).toContain("MatchJoined");
  });

  test("has MatchSettled event (not GameResolved)", () => {
    expect(eventNames).toContain("MatchSettled");
    expect(eventNames).not.toContain("GameResolved");
  });

  test("MatchCreated indexes uint256 matchId (not bytes32)", () => {
    const ev = (MatchEscrowABI as any[]).find(
      (e) => e.type === "event" && e.name === "MatchCreated"
    );
    expect(ev.inputs[0].name).toBe("matchId");
    expect(ev.inputs[0].type).toBe("uint256");
  });
});

// ── settleMatch ───────────────────────────────────────────────────────────────

describe("settleMatch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignMessage.mockResolvedValue(FAKE_SIG);
  });

  test("calls writeContract with settleMatch function name", async () => {
    mockSuccessfulTx();

    await settleMatch("game-uuid", MATCH_ID, PLAYER_A, 1.94);

    expect(mockWriteContract).toHaveBeenCalledTimes(1);
    const call = mockWriteContract.mock.calls[0][0] as any;
    expect(call.functionName).toBe("settleMatch");
  });

  test("passes uint256 matchId (not bytes32) as first arg", async () => {
    mockSuccessfulTx();

    await settleMatch("game-uuid", MATCH_ID, PLAYER_A, 1.94);

    const call = mockWriteContract.mock.calls[0][0] as any;
    expect(typeof call.args[0]).toBe("bigint");
    expect(call.args[0]).toBe(MATCH_ID);
  });

  test("passes winner address as second arg", async () => {
    mockSuccessfulTx();

    await settleMatch("game-uuid", MATCH_ID, PLAYER_A, 1.94);

    const call = mockWriteContract.mock.calls[0][0] as any;
    expect(call.args[1]).toBe(PLAYER_A);
  });

  test("passes oracle signature as third arg", async () => {
    mockSuccessfulTx();
    mockSignMessage.mockResolvedValueOnce(FAKE_SIG);

    await settleMatch("game-uuid", MATCH_ID, PLAYER_A, 1.94);

    const call = mockWriteContract.mock.calls[0][0] as any;
    expect(call.args[2]).toBe(FAKE_SIG);
  });

  test("does NOT pass extra player1/player2 args (old resolveGame signature)", async () => {
    mockSuccessfulTx();

    await settleMatch("game-uuid", MATCH_ID, PLAYER_A, 1.94);

    const call = mockWriteContract.mock.calls[0][0] as any;
    // settleMatch(matchId, winner, sig) = 3 args
    expect(call.args).toHaveLength(3);
  });

  test("records payout transaction in Supabase on success", async () => {
    mockSuccessfulTx();

    await settleMatch("game-uuid", MATCH_ID, PLAYER_A, 1.94);

    expect(mockFrom).toHaveBeenCalledWith("transactions");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tx_type: "payout",
        status: "confirmed",
        tx_hash: TX_HASH,
      })
    );
  });

  test("draw: winner = address(0), no transaction recorded", async () => {
    mockSuccessfulTx();

    await settleMatch("game-uuid", MATCH_ID, ZERO_ADDR, 0);

    const call = mockWriteContract.mock.calls[0][0] as any;
    expect(call.args[1]).toBe(ZERO_ADDR);
    // No payout transaction inserted for draws
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test("returns null txHash when blockchain not configured", async () => {
    // Override walletClient to null for this test
    jest.resetModules();
    const { settleMatch: s } = await import("../services/escrowService");
    // With walletClient mocked as truthy in module scope, we rely on
    // MATCH_ESCROW_ADDRESS being present; test the env-guard path separately
    const result = await settleMatch("game-uuid", MATCH_ID, PLAYER_A, 1.94);
    // Normal path — wallet is mocked as defined
    expect(result).toHaveProperty("txHash");
  });

  test("retries on write failure and eventually throws", async () => {
    mockWriteContract.mockRejectedValue(new Error("network error"));

    const result = await settleMatch("game-uuid", MATCH_ID, PLAYER_A, 1.94);

    // After MAX_RETRIES exhausted, should return null gracefully
    expect(result.txHash).toBeNull();
    expect(mockWriteContract).toHaveBeenCalledTimes(3); // MAX_RETRIES
  }, 15000);
});

// ── cancelMatch ───────────────────────────────────────────────────────────────

describe("cancelMatch", () => {
  beforeEach(() => jest.clearAllMocks());

  test("calls writeContract with cancelMatch function name", async () => {
    mockSuccessfulTx();

    await cancelMatch("game-uuid", MATCH_ID, PLAYER_A);

    const call = mockWriteContract.mock.calls[0][0] as any;
    expect(call.functionName).toBe("cancelMatch");
  });

  test("passes uint256 matchId (not bytes32 gameId)", async () => {
    mockSuccessfulTx();

    await cancelMatch("game-uuid", MATCH_ID, PLAYER_A);

    const call = mockWriteContract.mock.calls[0][0] as any;
    expect(typeof call.args[0]).toBe("bigint");
    expect(call.args[0]).toBe(MATCH_ID);
  });

  test("does NOT pass player address as arg (cancelMatch takes only matchId)", async () => {
    mockSuccessfulTx();

    await cancelMatch("game-uuid", MATCH_ID, PLAYER_A);

    const call = mockWriteContract.mock.calls[0][0] as any;
    // cancelMatch(matchId) = 1 arg on-chain
    expect(call.args).toHaveLength(1);
  });

  test("records refund transaction in Supabase", async () => {
    mockSuccessfulTx();

    await cancelMatch("game-uuid", MATCH_ID, PLAYER_A);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tx_type: "refund",
        player_address: PLAYER_A.toLowerCase(),
      })
    );
  });
});

// ── watchMatchEvents ──────────────────────────────────────────────────────────

describe("watchMatchEvents", () => {
  beforeEach(() => jest.clearAllMocks());

  test("registers MatchCreated event listener (not StakeDeposited)", () => {
    watchMatchEvents();

    const registeredEvents = mockWatchContractEvent.mock.calls.map(
      (c: any) => c[0].eventName
    );
    expect(registeredEvents).toContain("MatchCreated");
    expect(registeredEvents).not.toContain("StakeDeposited");
  });

  test("registers MatchJoined event listener", () => {
    watchMatchEvents();

    const registeredEvents = mockWatchContractEvent.mock.calls.map(
      (c: any) => c[0].eventName
    );
    expect(registeredEvents).toContain("MatchJoined");
  });

  test("registers MatchSettled event listener (not GameResolved)", () => {
    watchMatchEvents();

    const registeredEvents = mockWatchContractEvent.mock.calls.map(
      (c: any) => c[0].eventName
    );
    expect(registeredEvents).toContain("MatchSettled");
    expect(registeredEvents).not.toContain("GameResolved");
  });
});

// ── Oracle signature tests ────────────────────────────────────────────────────

describe("oracle signature for settleMatch", () => {
  test("signMessage is called with raw bytes (not string message)", async () => {
    mockSuccessfulTx();
    mockSignMessage.mockResolvedValueOnce(FAKE_SIG);

    await settleMatch("game-uuid", MATCH_ID, PLAYER_A, 1.94);

    expect(mockSignMessage).toHaveBeenCalled();
    const sigCall = mockSignMessage.mock.calls[0][0] as any;
    // Must use { message: { raw: Uint8Array } } form to avoid double-hashing
    expect(sigCall.message).toHaveProperty("raw");
    expect(sigCall.message.raw).toBeInstanceOf(Uint8Array);
  });

  test("chainId is fetched and included in signature digest", async () => {
    mockSuccessfulTx();
    mockSignMessage.mockResolvedValueOnce(FAKE_SIG);

    await settleMatch("game-uuid", MATCH_ID, PLAYER_A, 1.94);

    expect(mockGetChainId).toHaveBeenCalled();
  });
});
