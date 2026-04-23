/**
 * Approve + fund the DailyPuzzlePool with cUSD.
 * Run: npx ts-node scripts/fund-daily-puzzle-pool.ts [amount_cusd]
 * Default: 1 cUSD (covers 100 prizes at 0.01 each)
 */

import dotenv from "dotenv";
dotenv.config();

import { createWalletClient, createPublicClient, http, defineChain, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.ankr.com/celo_sepolia"] } },
});

const ERC20_ABI = [
  { name: "approve",     type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }] },
  { name: "balanceOf",   type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const POOL_ABI = [
  { name: "fund",        type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "poolBalance", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }] },
  // Read the cUSD address the contract was deployed with
  { name: "cusd",        type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "address" }] },
] as const;

async function main() {
  const pk         = process.env.SERVER_WALLET_PRIVATE_KEY;
  const poolAddr   = process.env.DAILY_PUZZLE_POOL_ADDRESS as `0x${string}` | undefined;
  const amountCusd = parseFloat(process.argv[2] ?? "1");

  if (!pk || !poolAddr) {
    console.error("Missing: SERVER_WALLET_PRIVATE_KEY / DAILY_PUZZLE_POOL_ADDRESS");
    process.exit(1);
  }

  const account = privateKeyToAccount(pk as `0x${string}`);
  const isProd  = process.env.NODE_ENV === "production";
  const rpcUrl  = isProd
    ? (process.env.CELO_RPC_URL ?? "https://forno.celo.org")
    : (process.env.CELO_TESTNET_RPC_URL ?? "https://rpc.ankr.com/celo_sepolia");
  const chain   = isProd
    ? defineChain({ id: 42220, name: "Celo", nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } })
    : celoSepolia;

  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  const amountWei = parseUnits(String(amountCusd), 18);

  // Read the cUSD address the contract was deployed with
  const cusdAddr = await publicClient.readContract({
    address: poolAddr,
    abi: POOL_ABI,
    functionName: "cusd",
  }) as `0x${string}`;

  console.log("Wallet      :", account.address);
  console.log("Pool        :", poolAddr);
  console.log("cUSD (contract):", cusdAddr);
  console.log("Fund amount :", amountCusd, "cUSD");

  // Current balances
  const walletBal = await publicClient.readContract({ address: cusdAddr, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address] });
  const poolBal   = await publicClient.readContract({ address: poolAddr, abi: POOL_ABI, functionName: "poolBalance" });

  console.log("\nWallet cUSD balance :", formatUnits(walletBal, 18));
  console.log("Pool cUSD balance   :", formatUnits(poolBal, 18));

  if (walletBal < amountWei) {
    console.error(`\n✗ Insufficient balance. Need ${amountCusd} cUSD, have ${formatUnits(walletBal, 18)}`);
    process.exit(1);
  }

  // 1. Approve
  console.log("\nStep 1: Approving pool to spend cUSD...");
  const approveTx = await walletClient.writeContract({
    address: cusdAddr,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [poolAddr, amountWei],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  console.log("  tx:", approveTx, "✓");

  // 2. Fund
  console.log("Step 2: Funding pool...");
  const fundTx = await walletClient.writeContract({
    address: poolAddr,
    abi: POOL_ABI,
    functionName: "fund",
    args: [amountWei],
  });
  await publicClient.waitForTransactionReceipt({ hash: fundTx });
  console.log("  tx:", fundTx, "✓");

  // Verify
  const newPoolBal = await publicClient.readContract({ address: poolAddr, abi: POOL_ABI, functionName: "poolBalance" });
  console.log("\n✓ Pool balance now:", formatUnits(newPoolBal, 18), "cUSD");
  console.log("  Covers", Math.floor(Number(formatUnits(newPoolBal, 18)) / 0.01), "prizes at 0.01 cUSD each");
}

main().catch((err) => { console.error(err); process.exit(1); });
