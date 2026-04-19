import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "./env";
import { logger } from "../utils/logger";

// Celo Sepolia testnet (chainId 11142220) — not in viem/chains by default
const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.ankr.com/celo_sepolia"] },
  },
  blockExplorers: {
    default: { name: "Celoscan Sepolia", url: "https://sepolia.celoscan.io" },
  },
  testnet: true,
});

// ── Oracle account (holds ORACLE_ROLE in GambitHub) ───────────────────────────
// Used to sign match results for settleMatch. Must be the same address granted
// ORACLE_ROLE when GambitHub was deployed.
function createOracle() {
  const pk = env.ORACLE_PRIVATE_KEY;
  if (!pk || !pk.startsWith("0x") || pk.length < 66) {
    logger.warn(
      "ORACLE_PRIVATE_KEY not configured — oracle signing disabled (settleMatch will fail)"
    );
    return null;
  }
  try {
    return privateKeyToAccount(pk);
  } catch {
    logger.warn("Invalid ORACLE_PRIVATE_KEY — oracle signing disabled");
    return null;
  }
}

export const oracleAccount = createOracle();

const chain = env.NODE_ENV === "production" ? celo : celoSepolia;
const rpcUrl =
  env.NODE_ENV === "production" ? env.CELO_RPC_URL : env.CELO_TESTNET_RPC_URL;

export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

function createWallet() {
  const pk = env.SERVER_WALLET_PRIVATE_KEY;
  if (!pk || !pk.startsWith("0x") || pk.length < 66) {
    logger.warn("SERVER_WALLET_PRIVATE_KEY not configured — blockchain writes disabled");
    return null;
  }
  try {
    const account = privateKeyToAccount(pk);
    return createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });
  } catch (err) {
    logger.warn("Invalid SERVER_WALLET_PRIVATE_KEY — blockchain writes disabled");
    return null;
  }
}

export const walletClient = createWallet();
