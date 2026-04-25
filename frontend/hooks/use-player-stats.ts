"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { WalletAddress } from "@/types/api";

const POLL_MS = 12_000;

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

export function usePlayerStats(address: WalletAddress | undefined) {
  const [entry, setEntry] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!address) {
      setEntry(null);
      return;
    }

    cancelRef.current = false;
    let firstLoad = true;

    const fetch = () => {
      if (firstLoad) setLoading(true);
      setError(null);
      api
        .getPlayer(address)
        .then((p) => {
          if (cancelRef.current) return;
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
          if (cancelRef.current) return;
          if ((e as { status?: number }).status === 404) {
            setEntry(null);
          } else {
            setError((e as Error).message);
          }
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
  }, [address]);

  return { entry, loading, error };
}
