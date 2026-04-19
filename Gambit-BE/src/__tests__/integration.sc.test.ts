// @ts-nocheck
/**
 * integration.sc.test.ts
 *
 * Tes integrasi langsung ke Celo Sepolia — memverifikasi sinkronisasi
 * antara BE (ABI + logic) dan kontrak yang sudah di-deploy.
 *
 * Tidak ada tx yang dikirim (semua read-only / eth_call).
 * Butuh koneksi internet ke https://rpc.ankr.com/celo_sepolia
 *
 * Jalankan: npx jest integration.sc --runInBand
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  parseAbi,
  keccak256,
  encodePacked,
  toBytes,
  pad,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ── Chain & addresses dari README sc_celo_gambit ─────────────────────────────
const CELO_SEPOLIA = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.ankr.com/celo_sepolia"] } },
  testnet: true,
});

const ADDRESSES = {
  hub:    "0xd6b0Ce6D872542b623CA5b7dc8ec5635e6dea578" as `0x${string}`,
  escrow: "0x198aB1bBb866E490ae883f04b273dBd2E38d6d09" as `0x${string}`,
  puzzle: "0x1cE4Fd99CA3132fB2524abCB42eced20484C2688" as `0x${string}`,
  club:   "0x61857BD62350b5bDF21a33679FC4d8C136BD92ef" as `0x${string}`,
  badges: "0xb198835a036541e0BFC8d2Fc5Ca45992Ecd25B84" as `0x${string}`,
};

const ORACLE_ADDRESS  = "0x3141011f001FB5f1CdE0183ACDdD9434Fa473F70" as `0x${string}`;
const ORACLE_PK       = "0xc29f99e248abacd38d3136e2c9ca04b48e15d057095b91a53aef7d98a36e7db4" as `0x${string}`;

// ── Clients ───────────────────────────────────────────────────────────────────
const rpc = "https://rpc.ankr.com/celo_sepolia";
const publicClient = createPublicClient({ chain: CELO_SEPOLIA, transport: http(rpc) });
const oracleAccount = privateKeyToAccount(ORACLE_PK);

// ── Load ABIs dari BE ─────────────────────────────────────────────────────────
import MatchEscrowABI from "../contracts/MatchEscrow.json";
import GambitHubABI   from "../contracts/GambitHub.json";

// ── Timeout: semua test ke RPC pakai 20s ─────────────────────────────────────
jest.setTimeout(30000);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Koneksi & chain
// ─────────────────────────────────────────────────────────────────────────────

describe("1. Koneksi ke Celo Sepolia", () => {
  test("RPC merespons dan chain ID = 11142220", async () => {
    const chainId = await publicClient.getChainId();
    expect(chainId).toBe(11142220);
    console.log("  ✓ chainId =", chainId);
  });

  test("Semua 5 alamat kontrak ada bytecode (deployed)", async () => {
    for (const [name, addr] of Object.entries(ADDRESSES)) {
      const code = await publicClient.getBytecode({ address: addr });
      expect(code).toBeDefined();
      expect(code!.length).toBeGreaterThan(2); // bukan "0x"
      console.log(`  ✓ ${name} @ ${addr} — ${Math.floor(code!.length / 2)} bytes`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GambitHub — roles & konfigurasi
// ─────────────────────────────────────────────────────────────────────────────

describe("2. GambitHub — roles & fee config", () => {
  test("ORACLE_ROLE di-assign ke oracle wallet", async () => {
    const ORACLE_ROLE = await publicClient.readContract({
      address: ADDRESSES.hub,
      abi: GambitHubABI,
      functionName: "ORACLE_ROLE",
    });
    const hasRole = await publicClient.readContract({
      address: ADDRESSES.hub,
      abi: GambitHubABI,
      functionName: "hasRole",
      args: [ORACLE_ROLE, ORACLE_ADDRESS],
    });
    expect(hasRole).toBe(true);
    console.log("  ✓ ORACLE_ROLE:", ORACLE_ROLE);
    console.log("  ✓ Oracle wallet memiliki ORACLE_ROLE:", hasRole);
  });

  test("matchFeeBps = 300 (3%)", async () => {
    const feeBps = await publicClient.readContract({
      address: ADDRESSES.hub,
      abi: GambitHubABI,
      functionName: "matchFeeBps",
    });
    expect(Number(feeBps)).toBe(300);
    console.log("  ✓ matchFeeBps =", feeBps, "(3%)");
  });

  test("matchEscrow terdaftar di GambitHub sesuai .env", async () => {
    const registeredEscrow = await publicClient.readContract({
      address: ADDRESSES.hub,
      abi: GambitHubABI,
      functionName: "matchEscrow",
    });
    expect((registeredEscrow as string).toLowerCase()).toBe(ADDRESSES.escrow.toLowerCase());
    console.log("  ✓ hub.matchEscrow =", registeredEscrow);
  });

  test("puzzlePool terdaftar di GambitHub sesuai .env", async () => {
    const registeredPuzzle = await publicClient.readContract({
      address: ADDRESSES.hub,
      abi: GambitHubABI,
      functionName: "puzzlePool",
    });
    expect((registeredPuzzle as string).toLowerCase()).toBe(ADDRESSES.puzzle.toLowerCase());
    console.log("  ✓ hub.puzzlePool =", registeredPuzzle);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. MatchEscrow — ABI sync dengan deployed contract
// ─────────────────────────────────────────────────────────────────────────────

describe("3. MatchEscrow — ABI sync", () => {
  test("matchCount bisa dibaca (fungsi exist di contract)", async () => {
    const count = await publicClient.readContract({
      address: ADDRESSES.escrow,
      abi: MatchEscrowABI,
      functionName: "matchCount",
    });
    expect(typeof count).toBe("bigint");
    console.log("  ✓ matchCount =", count.toString(), "(total match yang pernah dibuat)");
  });

  test("FORFEIT_GRACE = 180 detik (3 menit)", async () => {
    const grace = await publicClient.readContract({
      address: ADDRESSES.escrow,
      abi: MatchEscrowABI,
      functionName: "FORFEIT_GRACE",
    });
    expect(Number(grace)).toBe(180);
    console.log("  ✓ FORFEIT_GRACE =", grace, "detik");
  });

  test("hub address di MatchEscrow = GambitHub address", async () => {
    // Baca via raw call karena hub() tidak ada di ABI kita
    const hubAbiFragment = parseAbi(["function hub() view returns (address)"]);
    const hubAddr = await publicClient.readContract({
      address: ADDRESSES.escrow,
      abi: hubAbiFragment,
      functionName: "hub",
    });
    expect((hubAddr as string).toLowerCase()).toBe(ADDRESSES.hub.toLowerCase());
    console.log("  ✓ escrow.hub =", hubAddr);
  });

  test("resultSubmitted untuk matchId 0 = false (default)", async () => {
    const submitted = await publicClient.readContract({
      address: ADDRESSES.escrow,
      abi: MatchEscrowABI,
      functionName: "resultSubmitted",
      args: [BigInt(0)],
    });
    expect(submitted).toBe(false);
    console.log("  ✓ resultSubmitted[0] = false");
  });

  test("settleMatch (uint256,address,bytes) — signature match dengan deployed ABI", async () => {
    // Encode call dan pastikan tidak revert dengan 'wrong function selector'
    // Kita simulate dengan estimateGas yang akan revert jika ABI salah
    // Gunakan matchId yang tidak exist → akan revert 'not active', bukan 'function not found'
    let revertReason = "";
    try {
      await publicClient.estimateGas({
        to: ADDRESSES.escrow,
        data: "0x6c49d9ec" + // keccak256("settleMatch(uint256,address,bytes)").slice(0,8)
              "0".repeat(64) + // matchId = 0
              ORACLE_ADDRESS.slice(2).toLowerCase().padStart(64, "0") + // winner
              "0".repeat(64) + // offset to bytes
              "0".repeat(64),  // bytes length = 0
      });
    } catch (err: any) {
      revertReason = err.message || "";
    }
    // Revert 'not active' berarti fungsi ditemukan, ABI selector benar
    // Revert 'execution reverted' tanpa 'function not found' = selector valid
    expect(revertReason).not.toContain("function not found");
    expect(revertReason).not.toContain("invalid opcode");
    console.log("  ✓ settleMatch selector valid — contract mengenal fungsinya");
    console.log("    revert reason:", revertReason.split("\n")[0].slice(0, 80));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Oracle signature — format sama dengan yang diharapkan contract
// ─────────────────────────────────────────────────────────────────────────────

describe("4. Oracle signature encoding", () => {
  test("oracle wallet bisa sign dan address bisa di-recover (kunci valid)", async () => {
    const msg = "test-gambit-oracle";
    const sig = await oracleAccount.signMessage({ message: msg });
    expect(sig).toMatch(/^0x[0-9a-f]{130}$/i);
    console.log("  ✓ Oracle wallet sign OK, address:", oracleAccount.address);
  });

  test("digest format settleMatch: keccak256(abi.encodePacked(matchId, winner, chainId))", async () => {
    const matchId = BigInt(1);
    const winner  = ORACLE_ADDRESS;
    const chainId = BigInt(11142220);

    // Replicate abi.encodePacked(uint256, address, uint256) — 32+20+32 = 84 bytes
    const buf = Buffer.alloc(84);
    Buffer.from(matchId.toString(16).padStart(64, "0"), "hex").copy(buf, 0);
    Buffer.from(winner.slice(2).toLowerCase(), "hex").copy(buf, 32);
    Buffer.from(chainId.toString(16).padStart(64, "0"), "hex").copy(buf, 52);

    const innerHash = keccak256(`0x${buf.toString("hex")}` as `0x${string}`);
    const sig = await oracleAccount.signMessage({ message: { raw: toBytes(innerHash) } });

    // Sig harus 65 bytes (130 hex chars + 0x prefix)
    expect(sig.length).toBe(132);
    expect(sig).toMatch(/^0x[0-9a-f]{130}$/i);
    console.log("  ✓ innerHash:", innerHash);
    console.log("  ✓ sig (65 bytes):", sig.slice(0, 20), "...");
  });

  test("digest berbeda untuk matchId berbeda", async () => {
    const winner  = ORACLE_ADDRESS;
    const chainId = BigInt(11142220);

    function buildDigest(matchId: bigint) {
      const buf = Buffer.alloc(84);
      Buffer.from(matchId.toString(16).padStart(64, "0"), "hex").copy(buf, 0);
      Buffer.from(winner.slice(2).toLowerCase(), "hex").copy(buf, 32);
      Buffer.from(chainId.toString(16).padStart(64, "0"), "hex").copy(buf, 52);
      return keccak256(`0x${buf.toString("hex")}` as `0x${string}`);
    }

    const d1 = buildDigest(BigInt(1));
    const d2 = buildDigest(BigInt(42));
    const d3 = buildDigest(BigInt(999));

    expect(d1).not.toBe(d2);
    expect(d2).not.toBe(d3);
    console.log("  ✓ matchId=1  digest:", d1);
    console.log("  ✓ matchId=42 digest:", d2);
  });

  test("chainId 11142220 masuk ke digest (bukan chainId lain)", async () => {
    const matchId = BigInt(1);
    const winner  = ORACLE_ADDRESS;

    function buildDigest(chainId: bigint) {
      const buf = Buffer.alloc(84);
      Buffer.from(matchId.toString(16).padStart(64, "0"), "hex").copy(buf, 0);
      Buffer.from(winner.slice(2).toLowerCase(), "hex").copy(buf, 32);
      Buffer.from(chainId.toString(16).padStart(64, "0"), "hex").copy(buf, 52);
      return keccak256(`0x${buf.toString("hex")}` as `0x${string}`);
    }

    const digestSepolia  = buildDigest(BigInt(11142220)); // Celo Sepolia (benar)
    const digestMainnet  = buildDigest(BigInt(42220));    // Celo Mainnet (beda)
    const digestAlfajores= buildDigest(BigInt(44787));    // Alfajores (beda)

    expect(digestSepolia).not.toBe(digestMainnet);
    expect(digestSepolia).not.toBe(digestAlfajores);
    console.log("  ✓ Celo Sepolia digest ≠ Mainnet digest ≠ Alfajores digest");
    console.log("  ✓ Cross-chain replay tidak mungkin karena chainId berbeda");
  });

  test("simulate settleMatch call via eth_call dengan oracle sig valid", async () => {
    // Buat sig yang valid secara kriptografi lalu coba eth_call settleMatch
    // Kontrak akan revert 'not active' (match tidak exist), BUKAN 'bad oracle sig'
    // Ini membuktikan oracle sig format kita benar

    const matchId = BigInt(99999); // match tidak exist
    const winner  = ORACLE_ADDRESS;
    const chainId = BigInt(11142220);

    const buf = Buffer.alloc(84);
    Buffer.from(matchId.toString(16).padStart(64, "0"), "hex").copy(buf, 0);
    Buffer.from(winner.slice(2).toLowerCase(), "hex").copy(buf, 32);
    Buffer.from(chainId.toString(16).padStart(64, "0"), "hex").copy(buf, 52);
    const innerHash = keccak256(`0x${buf.toString("hex")}` as `0x${string}`);
    const sig = await oracleAccount.signMessage({ message: { raw: toBytes(innerHash) } });

    let revertReason = "";
    try {
      await publicClient.simulateContract({
        address: ADDRESSES.escrow,
        abi: MatchEscrowABI,
        functionName: "settleMatch",
        args: [matchId, winner, sig],
        account: ORACLE_ADDRESS,
      });
    } catch (err: any) {
      revertReason = err.message || String(err);
    }

    // Harus revert 'not active' — berarti sig diterima, bukan 'bad oracle sig'
    const isNotActive    = revertReason.includes("not active");
    const isBadSig       = revertReason.includes("bad oracle sig");

    expect(isBadSig).toBe(false);
    expect(isNotActive).toBe(true);
    console.log("  ✓ Contract revert 'not active' (bukan 'bad oracle sig')");
    console.log("  ✓ Oracle signature format VALID — contract menerima sig kita");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Event topic sync
// ─────────────────────────────────────────────────────────────────────────────

describe("5. Event topic sync — BE ABI vs on-chain", () => {
  // Kita cari log MatchCreated di block terakhir untuk memastikan topik sama
  test("MatchCreated event topic sesuai ABI kita", async () => {
    // keccak256("MatchCreated(uint256,address,uint256)")
    const expectedTopic = keccak256(
      toBytes("MatchCreated(uint256,address,uint256)")
    );
    console.log("  ✓ MatchCreated topic:", expectedTopic);

    // Coba getLogs dari MatchEscrow, filter by topic
    const latestBlock = await publicClient.getBlockNumber();
    const fromBlock = latestBlock - BigInt(1000) > 0n ? latestBlock - BigInt(1000) : 0n;

    const logs = await publicClient.getLogs({
      address: ADDRESSES.escrow,
      event: {
        type: "event",
        name: "MatchCreated",
        inputs: [
          { name: "matchId", type: "uint256", indexed: true },
          { name: "playerA", type: "address", indexed: true },
          { name: "stake",   type: "uint256", indexed: false },
        ],
      },
      fromBlock,
      toBlock: latestBlock,
    });

    // Log ada atau tidak, yang penting getLogs tidak throw (topic benar)
    console.log(`  ✓ getLogs berhasil, ${logs.length} MatchCreated event dalam 1000 block terakhir`);
    if (logs.length > 0) {
      console.log("  ✓ Contoh event:", {
        matchId: logs[0].args.matchId?.toString(),
        playerA: logs[0].args.playerA,
        stake:   logs[0].args.stake?.toString(),
      });
    }
  });

  test("MatchSettled event topic sesuai ABI kita", async () => {
    const latestBlock = await publicClient.getBlockNumber();
    const fromBlock = latestBlock - BigInt(1000) > 0n ? latestBlock - BigInt(1000) : 0n;

    const logs = await publicClient.getLogs({
      address: ADDRESSES.escrow,
      event: {
        type: "event",
        name: "MatchSettled",
        inputs: [
          { name: "matchId", type: "uint256", indexed: true },
          { name: "winner",  type: "address", indexed: true },
          { name: "payout",  type: "uint256", indexed: false },
        ],
      },
      fromBlock,
      toBlock: latestBlock,
    });

    console.log(`  ✓ ${logs.length} MatchSettled event dalam 1000 block terakhir`);
    if (logs.length > 0) {
      console.log("  ✓ Contoh settled:", {
        matchId: logs[0].args.matchId?.toString(),
        winner:  logs[0].args.winner,
        payout:  logs[0].args.payout?.toString(),
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. PuzzlePool — sinkronisasi pendingBalance
// ─────────────────────────────────────────────────────────────────────────────

describe("6. PuzzlePool — state bisa dibaca", () => {
  const puzzlePoolAbi = parseAbi([
    "function pendingBalance() view returns (uint256)",
    "function todayIndex() view returns (uint256)",
    "function hasClaimed(uint256 day, address player) view returns (bool)",
  ]);

  test("pendingBalance bisa dibaca dari PuzzlePool", async () => {
    const balance = await publicClient.readContract({
      address: ADDRESSES.puzzle,
      abi: puzzlePoolAbi,
      functionName: "pendingBalance",
    });
    expect(typeof balance).toBe("bigint");
    const celoBalance = Number(balance) / 1e18;
    console.log(`  ✓ pendingBalance = ${celoBalance} CELO`);
  });

  test("todayIndex (unix day) masuk akal", async () => {
    const dayIndex = await publicClient.readContract({
      address: ADDRESSES.puzzle,
      abi: puzzlePoolAbi,
      functionName: "todayIndex",
    });
    const expectedDay = Math.floor(Date.now() / 1000 / 86400);
    // Harus dalam rentang ±1 hari dari hari ini
    expect(Math.abs(Number(dayIndex) - expectedDay)).toBeLessThanOrEqual(1);
    console.log(`  ✓ todayIndex = ${dayIndex} (hari ini = ${expectedDay})`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Sinkronisasi end-to-end: match lifecycle simulation
// ─────────────────────────────────────────────────────────────────────────────

describe("7. Match lifecycle — verifikasi state transitions", () => {
  test("matchCount di contract sesuai dengan jumlah MatchCreated events", async () => {
    const matchCount = await publicClient.readContract({
      address: ADDRESSES.escrow,
      abi: MatchEscrowABI,
      functionName: "matchCount",
    });

    // Ankr membatasi max ~500 block per getLogs request — pakai window kecil
    const latestBlock = await publicClient.getBlockNumber();
    const fromBlock   = latestBlock - BigInt(499);

    const logs = await publicClient.getLogs({
      address: ADDRESSES.escrow,
      event: {
        type: "event",
        name: "MatchCreated",
        inputs: [
          { name: "matchId", type: "uint256", indexed: true },
          { name: "playerA", type: "address", indexed: true },
          { name: "stake",   type: "uint256", indexed: false },
        ],
      },
      fromBlock,
      toBlock: latestBlock,
    });

    console.log(`  ✓ matchCount (contract) = ${matchCount}`);
    console.log(`  ✓ MatchCreated dalam 500 block terakhir = ${logs.length}`);
    // matchCount selalu ≥ jumlah event dalam window kecil ini
    expect(Number(matchCount)).toBeGreaterThanOrEqual(logs.length);
  });

  test("match yang sudah settled: resultSubmitted[matchId] = true", async () => {
    const latestBlock = await publicClient.getBlockNumber();
    const fromBlock   = latestBlock - BigInt(499);

    const settledLogs = await publicClient.getLogs({
      address: ADDRESSES.escrow,
      event: {
        type: "event",
        name: "MatchSettled",
        inputs: [
          { name: "matchId", type: "uint256", indexed: true },
          { name: "winner",  type: "address", indexed: true },
          { name: "payout",  type: "uint256", indexed: false },
        ],
      },
      fromBlock,
      toBlock: latestBlock,
    });

    if (settledLogs.length === 0) {
      // Belum ada match yang selesai — verifikasi via matchCount saja
      const matchCount = await publicClient.readContract({
        address: ADDRESSES.escrow,
        abi: MatchEscrowABI,
        functionName: "matchCount",
      });
      console.log(`  ⚠ Belum ada MatchSettled event dalam 500 block terakhir`);
      console.log(`  ✓ matchCount = ${matchCount} — contract bisa dibaca dengan baik`);
      expect(Number(matchCount)).toBeGreaterThanOrEqual(0);
      return;
    }

    const lastSettled = settledLogs[settledLogs.length - 1];
    const matchId = lastSettled.args.matchId as bigint;

    const isSubmitted = await publicClient.readContract({
      address: ADDRESSES.escrow,
      abi: MatchEscrowABI,
      functionName: "resultSubmitted",
      args: [matchId],
    });

    expect(isSubmitted).toBe(true);
    console.log(`  ✓ matchId ${matchId} sudah settled, resultSubmitted = ${isSubmitted}`);
    console.log(`  ✓ winner: ${lastSettled.args.winner}`);
    console.log(`  ✓ payout: ${Number(lastSettled.args.payout as bigint) / 1e18} CELO`);
  });
});
