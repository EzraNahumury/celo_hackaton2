import { createWalletClient, createPublicClient, http } from "viem";
import { celo, celoAlfajores } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "./env";
import { logger } from "../utils/logger";

const chain = env.NODE_ENV === "production" ? celo : celoAlfajores;
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
