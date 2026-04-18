import { defineChain } from "viem";

export const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "Celo", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.ankr.com/celo_sepolia"] },
  },
  blockExplorers: {
    default: { name: "Celoscan", url: "https://celo-sepolia.blockscout.com" },
  },
  testnet: true,
});

export const celoMainnet = defineChain({
  id: 42220,
  name: "Celo",
  nativeCurrency: { name: "Celo", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://forno.celo.org"] },
  },
  blockExplorers: {
    default: { name: "Celoscan", url: "https://celoscan.io" },
  },
});

export const ACTIVE_CHAIN =
  process.env.NEXT_PUBLIC_CELO_NETWORK === "mainnet" ? celoMainnet : celoSepolia;

export const CONTRACTS = {
  hub: (process.env.NEXT_PUBLIC_GAMBIT_HUB ?? "") as `0x${string}`,
  matchEscrow: (process.env.NEXT_PUBLIC_MATCH_ESCROW ?? "") as `0x${string}`,
  puzzlePool: (process.env.NEXT_PUBLIC_PUZZLE_POOL ?? "") as `0x${string}`,
  clubVault: (process.env.NEXT_PUBLIC_CLUB_VAULT ?? "") as `0x${string}`,
  badges: (process.env.NEXT_PUBLIC_GAMBIT_BADGES ?? "") as `0x${string}`,
} as const;

export const CONTRACTS_CONFIGURED = Object.values(CONTRACTS).every(
  (a) => a && a.length === 42 && a !== "0x",
);

export const MATCH_FEE_BPS = 300;
export const CLUB_FEE_BPS = 200;
export const CLUB_FIRST_BPS = 7000;
export const CLUB_SECOND_BPS = 2000;
export const CLUB_ROLL_BPS = 1000;
export const FORFEIT_GRACE_SEC = 3 * 60;

export const BADGE_TYPE = {
  FIRST_WIN: 1,
  PUZZLE_STREAK_7: 2,
  CLUB_CHAMPION: 3,
  RATING_1400: 4,
  FAIR_PLAY_HOLD: 5,
} as const;
export type BadgeType = (typeof BADGE_TYPE)[keyof typeof BADGE_TYPE];

export const BADGE_META: Record<BadgeType, { label: string; desc: string; emoji: string }> = {
  1: { label: "First Win", desc: "Menang match 1v1 pertamamu.", emoji: "🏆" },
  2: { label: "Puzzle Streak 7", desc: "Solve puzzle harian 7 hari berturut.", emoji: "✨" },
  3: { label: "Club Champion", desc: "Juara weekly round-robin klub.", emoji: "👑" },
  4: { label: "1400 Club", desc: "Rating tembus 1400.", emoji: "📈" },
  5: { label: "Fair Play Hold", desc: "Akun ditahan karena terdeteksi anomali fair-play.", emoji: "🚫" },
};

export const MATCH_STATE = {
  Pending: 0,
  Active: 1,
  Settled: 2,
  Disputed: 3,
  Cancelled: 4,
} as const;
export type MatchState = (typeof MATCH_STATE)[keyof typeof MATCH_STATE];

export const CLUB_STATE = {
  Active: 0,
  Closed: 1,
} as const;
export type ClubState = (typeof CLUB_STATE)[keyof typeof CLUB_STATE];

export function tcLabelToSeconds(tc: string): number {
  const [m, s] = tc.split("+").map(Number);
  return (m || 3) * 60 + (s || 0);
}

export function tcSecondsToLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}+${s}`;
}
