"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
  PlayerGameRow,
  PlayerTransactionRow,
  WalletAddress,
} from "@/types/api";

// Fetch games + transactions in parallel and join them by game_id so each
// row can show both game metadata (opponent, stake, result) and the tx hash
// for the matching payout/deposit. BE returns fresh rows every call; we just
// refetch on address change.
export function usePlayerHistory(
  address: WalletAddress | undefined,
  limit = 20,
) {
  const [games, setGames] = useState<PlayerGameRow[]>([]);
  const [transactions, setTransactions] = useState<PlayerTransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setGames([]);
      setTransactions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.getPlayerGames(address, { limit }),
      api.getPlayerTransactions(address, { limit: limit * 4 }),
    ])
      .then(([g, t]) => {
        if (cancelled) return;
        setGames(g.games);
        setTransactions(t.transactions);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, limit]);

  return { games, transactions, loading, error };
}
