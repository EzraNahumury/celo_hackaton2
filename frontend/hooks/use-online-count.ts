"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Lightweight polling hook for the online player counter the BE exposes at
// GET /player/online. Polls every 15s to keep the landing page fresh without
// hammering the server.
export function useOnlineCount(intervalMs = 15_000) {
  const [online, setOnline] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      api
        .getOnlineCount()
        .then((r) => {
          if (!cancelled) setOnline(r.online);
        })
        .catch((e) => {
          if (!cancelled) setError((e as Error).message);
        });
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { online, error };
}
