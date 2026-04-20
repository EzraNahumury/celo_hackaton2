"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { WalletAddress } from "@/types/api";

// Normalized stats shape consumers expect (kept in camelCase to match the
// old leaderboard response shape — single-player endpoint uses snake_case,
// so we remap here to avoid churn in every consumer).
export type PlayerStats = {
  address: WalletAddress;
  username: string | null;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  totalEarned: number;
  rank: number;
};

// Fetch stats for a single wallet via /player/:address. Works for any
// player regardless of leaderboard rank. Returns null when the BE has no
// record yet (404 — player hasn't played any game or signed in).
export function usePlayerStats(address: WalletAddress | undefined) {
  const [entry, setEntry] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setEntry(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getPlayer(address)
      .then((p) => {
        if (cancelled) return;
        setEntry({
          address: p.wallet_address,
          username: p.username,
          rating: p.rating,
          wins: p.wins,
          losses: p.losses,
          draws: p.draws,
          totalEarned: Number(p.total_earned ?? 0),
          rank: p.rank,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        // 404 just means the player isn't in the DB yet — treat as "no stats".
        if ((e as { status?: number }).status === 404) {
          setEntry(null);
        } else {
          setError((e as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return { entry, loading, error };
}
