import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || "3001", 10),
  NODE_ENV: process.env.NODE_ENV || "development",

  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY!,

  CELO_RPC_URL: process.env.CELO_RPC_URL || "https://forno.celo.org",
  CELO_TESTNET_RPC_URL:
    process.env.CELO_TESTNET_RPC_URL ||
    "https://alfajores-forno.celo-testnet.org",
  SERVER_WALLET_PRIVATE_KEY: process.env.SERVER_WALLET_PRIVATE_KEY as
    | `0x${string}`
    | undefined,
  CHESS_ESCROW_ADDRESS: process.env.CHESS_ESCROW_ADDRESS as
    | `0x${string}`
    | undefined,
  CUSD_ADDRESS: (process.env.CUSD_ADDRESS ||
    "0x765DE816845861e75A25fCA122bb6898B8B1282a") as `0x${string}`,

  JWT_SECRET: process.env.JWT_SECRET || "dev-secret-change-me-in-production",

  STOCKFISH_PATH: process.env.STOCKFISH_PATH || "./stockfish-wasm",

  GAME_TIMEOUT_MS: parseInt(process.env.GAME_TIMEOUT_MS || "300000", 10),
  DISCONNECT_TIMEOUT_MS: parseInt(
    process.env.DISCONNECT_TIMEOUT_MS || "60000",
    10
  ),
  CLOCK_SYNC_INTERVAL_MS: parseInt(
    process.env.CLOCK_SYNC_INTERVAL_MS || "10000",
    10
  ),
};
