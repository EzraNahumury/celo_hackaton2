/**
 * Grant OPERATOR_ROLE on GambitHub to the server wallet, then fund PuzzlePool.
 * Run once: npx ts-node scripts/grant-puzzle-operator.ts
 *
 * Requirements:
 *  - SERVER_WALLET_PRIVATE_KEY in .env (must be the deployer → has DEFAULT_ADMIN_ROLE)
 *  - GAMBIT_HUB_ADDRESS and PUZZLE_POOL_ADDRESS in .env
 */

import dotenv from "dotenv";
dotenv.config();

import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
} from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ── ABIs ──────────────────────────────────────────────────────────────────────

const HUB_ABI = [
  {
    name: "OPERATOR_ROLE",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    name: "hasRole",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "grantRole",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [],
  },
] as const;

const POOL_ABI = [
  {
    name: "pendingBalance",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "sponsorDeposit",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const;

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const serverPk   = process.env.SERVER_WALLET_PRIVATE_KEY;
  // DEPLOYER_PRIVATE_KEY = key yang dipakai saat `forge script Deploy.s.sol`
  // Pemilik DEFAULT_ADMIN_ROLE pada GambitHub.
  // Jika sama dengan server wallet, cukup set SERVER_WALLET_PRIVATE_KEY.
  const deployerPk = process.env.DEPLOYER_PRIVATE_KEY ?? serverPk;

  const hubAddress  = process.env.GAMBIT_HUB_ADDRESS  as `0x${string}` | undefined;
  const poolAddress = process.env.PUZZLE_POOL_ADDRESS as `0x${string}` | undefined;

  if (!serverPk || !deployerPk || !hubAddress || !poolAddress) {
    console.error("Missing env vars:");
    console.error("  DEPLOYER_PRIVATE_KEY  (private key that deployed GambitHub)");
    console.error("  SERVER_WALLET_PRIVATE_KEY");
    console.error("  GAMBIT_HUB_ADDRESS");
    console.error("  PUZZLE_POOL_ADDRESS");
    process.exit(1);
  }

  const serverAccount   = privateKeyToAccount(serverPk   as `0x${string}`);
  const deployerAccount = privateKeyToAccount(deployerPk as `0x${string}`);
  const account = serverAccount; // kept for compat below
  console.log("Server wallet :", account.address);
  console.log("GambitHub     :", hubAddress);
  console.log("PuzzlePool    :", poolAddress);

  const rpcUrl = process.env.CELO_RPC_URL ?? "https://forno.celo.org";
  const chain  = celo;

  const publicClient   = createPublicClient({ chain, transport: http(rpcUrl) });
  const deployerWallet = createWalletClient({ account: deployerAccount, chain, transport: http(rpcUrl) });
  const serverWallet   = createWalletClient({ account: serverAccount,   chain, transport: http(rpcUrl) });

  console.log("Deployer wallet:", deployerAccount.address);
  console.log("Server wallet  :", serverAccount.address);

  // 1. Read OPERATOR_ROLE value from GambitHub
  const OPERATOR_ROLE = await publicClient.readContract({
    address: hubAddress,
    abi: HUB_ABI,
    functionName: "OPERATOR_ROLE",
  });
  console.log("\nOPERATOR_ROLE :", OPERATOR_ROLE);

  // 2. Check current role on server wallet
  const isOperator = await publicClient.readContract({
    address: hubAddress,
    abi: HUB_ABI,
    functionName: "hasRole",
    args: [OPERATOR_ROLE, serverAccount.address],
  });
  console.log("serverWallet hasOperator:", isOperator);

  // 3. Grant if missing — must be called FROM deployerWallet (DEFAULT_ADMIN_ROLE)
  if (!isOperator) {
    console.log(`\nGranting OPERATOR_ROLE to ${serverAccount.address} via deployer ${deployerAccount.address}...`);
    const txHash = await deployerWallet.writeContract({
      address: hubAddress,
      abi: HUB_ABI,
      functionName: "grantRole",
      args: [OPERATOR_ROLE, serverAccount.address],
    });
    console.log("  tx :", txHash);
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    const granted = await publicClient.readContract({
      address: hubAddress,
      abi: HUB_ABI,
      functionName: "hasRole",
      args: [OPERATOR_ROLE, serverAccount.address],
    });
    console.log(granted ? "  ✓ OPERATOR_ROLE granted!" : "  ✗ Grant failed");
  } else {
    console.log("\n✓ Already has OPERATOR_ROLE — skipping grant.");
  }

  // 4. Fund PuzzlePool if pendingBalance is low (server wallet sponsors)
  const pending = await publicClient.readContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "pendingBalance",
  });
  console.log("\nPuzzlePool pendingBalance:", pending.toString(), "wei");

  const MIN_BALANCE = parseEther("0.05"); // 0.05 CELO — covers 5 prizes at 0.01 each
  if (pending < MIN_BALANCE) {
    const deposit = parseEther("0.1"); // deposit 0.1 CELO
    console.log(`Funding PuzzlePool with 0.1 CELO from server wallet...`);
    const txHash = await serverWallet.writeContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: "sponsorDeposit",
      value: deposit,
    });
    console.log("  tx :", txHash);
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    const newBalance = await publicClient.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: "pendingBalance",
    });
    console.log("  ✓ New pendingBalance:", newBalance.toString(), "wei");
  } else {
    console.log("✓ PuzzlePool already funded — skipping deposit.");
  }

  console.log("\nDone! Server wallet is ready to call finalizeRound.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
