"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { PuzzleSessionRow, WalletAddress } from "@/types/api";

const POLL_MS = 12_000;

export function usePuzzleHistory(address: WalletAddress | undefined, limit = 30) {
  const [sessions, setSessions] = useState<PuzzleSessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!address) {
      setSessions([]);
      return;
    }

    cancelRef.current = false;
    let firstLoad = true;

    const fetch = () => {
      if (firstLoad) setLoading(true);
      setError(null);
      api
        .getPlayerPuzzleSessions(address, { limit })
        .then((r) => {
          if (cancelRef.current) return;
          setSessions(r.sessions);
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

  return { sessions, loading, error };
}
