"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type {
  PlayerGameRow,
  PlayerTransactionRow,
  WalletAddress,
} from "@/types/api";

const POLL_MS = 12_000;

export function usePlayerHistory(
  address: WalletAddress | undefined,
  limit = 20,
) {
  const [games, setGames] = useState<PlayerGameRow[]>([]);
  const [transactions, setTransactions] = useState<PlayerTransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!address) {
      setGames([]);
      setTransactions([]);
      return;
    }

    cancelRef.current = false;
    let firstLoad = true;

    const fetch = () => {
      if (firstLoad) setLoading(true);
      setError(null);
      Promise.all([
        api.getPlayerGames(address, { limit }),
        api.getPlayerTransactions(address, { limit: limit * 4 }),
      ])
        .then(([g, t]) => {
          if (cancelRef.current) return;
          setGames(g.games);
          setTransactions(t.transactions);
        })
        .catch((e) => {
          if (!cancelRef.current) setError((e as Error).message);
        })
        .finally(() => {
          if (!cancelRef.current && firstLoad) {
            setLoading(false);
            firstLoad = false;
          }
        });
    };

    fetch();
    const interval = setInterval(fetch, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") fetch();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelRef.current = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [address, limit]);

  return { games, transactions, loading, error };
}
