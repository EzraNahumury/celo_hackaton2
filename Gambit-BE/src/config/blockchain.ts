import { createWalletClient, createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "./env";
import { logger } from "../utils/logger";

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

export const publicClient = createPublicClient({
  chain: celo,
  transport: http(env.CELO_RPC_URL),
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
      chain: celo,
      transport: http(env.CELO_RPC_URL),
    });
  } catch (err) {
    logger.warn("Invalid SERVER_WALLET_PRIVATE_KEY — blockchain writes disabled");
    return null;
  }
}

export const walletClient = createWallet();
