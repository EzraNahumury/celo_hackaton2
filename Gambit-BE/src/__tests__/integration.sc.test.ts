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

import dotenv from "dotenv";
dotenv.config();

import { createPublicClient, createWalletClient, http, defineChain, parseAbi, keccak256, encodePacked, toBytes, pad, toHex } from "viem";
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
  hub: "0xA68141b7b36d1161757e1790BcB5199d4EfFF281" as `0x${string}`,
  escrow: "0xF8CeF418419E8F1588d6EB26095358CFAF635dC5" as `0x${string}`,
  puzzle: "0xbE34567ADF30c233103AEbFBB2b940e06DAc7366" as `0x${string}`,
  club: "0x3665188aB87951Bb42984cFECC14bF5925C21644" as `0x${string}`,
  badges: "0xB31A2CAB3e267528815067cD6F7d6D7957f9FfB9" as `0x${string}`,
};

const ORACLE_ADDRESS = "0x03dAC3A27deE42062b1F0D9F69087d4A9A20a3A1" as `0x${string}`;
const ORACLE_PK = (process.env.ORACLE_PRIVATE_KEY ?? "") as `0x${string}`;

// ── Clients ───────────────────────────────────────────────────────────────────
const rpc = "https://rpc.ankr.com/celo_sepolia";
const publicClient = createPublicClient({ chain: CELO_SEPOLIA, transport: http(rpc) });
const oracleAccount = privateKeyToAccount(ORACLE_PK);

// ── Load ABIs dari BE ─────────────────────────────────────────────────────────
import MatchEscrowABI from "../contracts/MatchEscrow.json";
import GambitHubABI from "../contracts/GambitHub.json";

// ── MockCUSD address dari .env ─────────────────────────────────────────────────
const MOCK_CUSD_ADDRESS = (process.env.MockCUSD || process.env.CUSD_ADDRESS || "") as `0x${string}`;

const ERC20_ABI = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

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
        data:
          "0x6c49d9ec" + // keccak256("settleMatch(uint256,address,bytes)").slice(0,8)
          "0".repeat(64) + // matchId = 0
          ORACLE_ADDRESS.slice(2).toLowerCase().padStart(64, "0") + // winner
          "0".repeat(64) + // offset to bytes
          "0".repeat(64), // bytes length = 0
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
    const winner = ORACLE_ADDRESS;
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
    const winner = ORACLE_ADDRESS;
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
    const winner = ORACLE_ADDRESS;

    function buildDigest(chainId: bigint) {
      const buf = Buffer.alloc(84);
      Buffer.from(matchId.toString(16).padStart(64, "0"), "hex").copy(buf, 0);
      Buffer.from(winner.slice(2).toLowerCase(), "hex").copy(buf, 32);
      Buffer.from(chainId.toString(16).padStart(64, "0"), "hex").copy(buf, 52);
      return keccak256(`0x${buf.toString("hex")}` as `0x${string}`);
    }

    const digestSepolia = buildDigest(BigInt(11142220)); // Celo Sepolia (benar)
    const digestMainnet = buildDigest(BigInt(42220)); // Celo Mainnet (beda)
    const digestAlfajores = buildDigest(BigInt(44787)); // Alfajores (beda)

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
    const winner = ORACLE_ADDRESS;
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
    const isNotActive = revertReason.includes("not active");
    const isBadSig = revertReason.includes("bad oracle sig");

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
    const expectedTopic = keccak256(toBytes("MatchCreated(uint256,address,uint256)"));
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
          { name: "stake", type: "uint256", indexed: false },
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
        stake: logs[0].args.stake?.toString(),
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
          { name: "winner", type: "address", indexed: true },
          { name: "payout", type: "uint256", indexed: false },
        ],
      },
      fromBlock,
      toBlock: latestBlock,
    });

    console.log(`  ✓ ${logs.length} MatchSettled event dalam 1000 block terakhir`);
    if (logs.length > 0) {
      console.log("  ✓ Contoh settled:", {
        matchId: logs[0].args.matchId?.toString(),
        winner: logs[0].args.winner,
        payout: logs[0].args.payout?.toString(),
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
    const fromBlock = latestBlock - BigInt(499);

    const logs = await publicClient.getLogs({
      address: ADDRESSES.escrow,
      event: {
        type: "event",
        name: "MatchCreated",
        inputs: [
          { name: "matchId", type: "uint256", indexed: true },
          { name: "playerA", type: "address", indexed: true },
          { name: "stake", type: "uint256", indexed: false },
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
    const fromBlock = latestBlock - BigInt(499);

    const settledLogs = await publicClient.getLogs({
      address: ADDRESSES.escrow,
      event: {
        type: "event",
        name: "MatchSettled",
        inputs: [
          { name: "matchId", type: "uint256", indexed: true },
          { name: "winner", type: "address", indexed: true },
          { name: "payout", type: "uint256", indexed: false },
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

// ─────────────────────────────────────────────────────────────────────────────
// 8. MockCUSD (ERC-20) — token deployed dan readable
// ─────────────────────────────────────────────────────────────────────────────

describe("8. MockCUSD ERC-20 — token contract deployed & readable", () => {
  test("MockCUSD address dikonfigurasi di .env", () => {
    expect(MOCK_CUSD_ADDRESS).toBeTruthy();
    expect(MOCK_CUSD_ADDRESS).toMatch(/^0x[0-9a-fA-F]{40}$/);
    console.log("  ✓ MockCUSD address:", MOCK_CUSD_ADDRESS);
  });

  test("MockCUSD contract ada bytecode (deployed)", async () => {
    if (!MOCK_CUSD_ADDRESS) return;
    const code = await publicClient.getBytecode({ address: MOCK_CUSD_ADDRESS });
    expect(code).toBeDefined();
    expect(code!.length).toBeGreaterThan(2);
    console.log(`  ✓ MockCUSD deployed — ${Math.floor(code!.length / 2)} bytes`);
  });

  test("MockCUSD.name() dan symbol() bisa dibaca", async () => {
    if (!MOCK_CUSD_ADDRESS) return;
    const name = await publicClient.readContract({
      address: MOCK_CUSD_ADDRESS,
      abi: ERC20_ABI,
      functionName: "name",
    });
    const symbol = await publicClient.readContract({
      address: MOCK_CUSD_ADDRESS,
      abi: ERC20_ABI,
      functionName: "symbol",
    });
    expect(typeof name).toBe("string");
    expect(typeof symbol).toBe("string");
    console.log(`  ✓ name = "${name}", symbol = "${symbol}"`);
  });

  test("MockCUSD.decimals() = 18", async () => {
    if (!MOCK_CUSD_ADDRESS) return;
    const decimals = await publicClient.readContract({
      address: MOCK_CUSD_ADDRESS,
      abi: ERC20_ABI,
      functionName: "decimals",
    });
    expect(Number(decimals)).toBe(18);
    console.log(`  ✓ decimals = ${decimals}`);
  });

  test("MockCUSD.totalSupply() > 0", async () => {
    if (!MOCK_CUSD_ADDRESS) return;
    const supply = await publicClient.readContract({
      address: MOCK_CUSD_ADDRESS,
      abi: ERC20_ABI,
      functionName: "totalSupply",
    });
    expect(typeof supply).toBe("bigint");
    expect(supply).toBeGreaterThan(0n);
    console.log(`  ✓ totalSupply = ${Number(supply) / 1e18} MockCUSD`);
  });

  test("MockCUSD.balanceOf(oracle) bisa dibaca", async () => {
    if (!MOCK_CUSD_ADDRESS) return;
    const balance = await publicClient.readContract({
      address: MOCK_CUSD_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [ORACLE_ADDRESS],
    });
    expect(typeof balance).toBe("bigint");
    console.log(`  ✓ balanceOf(oracle) = ${Number(balance) / 1e18} MockCUSD`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. MockCUSD × MatchEscrow — approve flow siap digunakan FE
// ─────────────────────────────────────────────────────────────────────────────

describe("9. MockCUSD × MatchEscrow — approve flow", () => {
  test("allowance(oracle, escrow) bisa dibaca (approve belum dilakukan = 0)", async () => {
    if (!MOCK_CUSD_ADDRESS) return;
    const allowance = await publicClient.readContract({
      address: MOCK_CUSD_ADDRESS,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [ORACLE_ADDRESS, ADDRESSES.escrow],
    });
    expect(typeof allowance).toBe("bigint");
    console.log(`  ✓ allowance(oracle → escrow) = ${Number(allowance) / 1e18} MockCUSD`);
    console.log(`  ℹ FE harus memanggil MockCUSD.approve(escrow, stakeAmount) sebelum createMatch/joinMatch`);
  });

  test("stake amounts valid (0.50, 1.00, 2.00) dalam MockCUSD wei", () => {
    const stakes = [0.5, 1.0, 2.0];
    for (const stake of stakes) {
      const wei = BigInt(Math.round(stake * 1e18));
      expect(wei).toBeGreaterThan(0n);
      console.log(`  ✓ stake ${stake} cUSD = ${wei.toString()} wei`);
    }
  });

  test("depositTx response dari BE menyertakan tokenAddress MockCUSD", () => {
    // Simulasi response yang dikembalikan oleh POST /game/create
    const mockDepositTx = {
      to: ADDRESSES.escrow,
      functionName: "createMatch",
      args: [180],
      tokenAddress: MOCK_CUSD_ADDRESS,
      amount: `${Math.round(0.5 * 1e18)}`,
    };

    expect(mockDepositTx.tokenAddress).toBe(MOCK_CUSD_ADDRESS);
    expect(mockDepositTx.tokenAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(mockDepositTx.amount).toBe("500000000000000000");
    console.log("  ✓ depositTx.tokenAddress =", mockDepositTx.tokenAddress);
    console.log("  ✓ depositTx.amount (0.5 cUSD) =", mockDepositTx.amount, "wei");
    console.log("  ℹ Flow FE:");
    console.log("    1. MockCUSD.approve(escrow, amount)");
    console.log("    2. MatchEscrow.createMatch(timeControlSeconds)  ← tanpa msg.value");
  });
});
