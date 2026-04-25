"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clearAuth, ensureSession, getAuthToken, hasSessionFor } from "@/lib/auth";
import { useWallet } from "./use-connect";

// Keeps a BE JWT in sync with the connected wallet.
// Auto logs-in when wallet connects; clears on disconnect.
export function useSession() {
  const { address, isConnected } = useWallet();
  const [token, setToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : getAuthToken(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isConnected || !address) {
      // Delay clearing auth to survive brief reconnects during navigation
      clearTimerRef.current = setTimeout(() => {
        clearAuth();
        setToken(null);
      }, 3000);
      return () => {
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      };
    }
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    if (hasSessionFor(address)) {
      setToken(getAuthToken());
      return;
    }
    setLoading(true);
    setError(null);
    ensureSession(address)
      .then((t) => {
        if (!cancelled) setToken(t);
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
  }, [address, isConnected]);

  const refresh = useCallback(async () => {
    if (!address) return null;
    clearAuth();
    const t = await ensureSession(address);
    setToken(t);
    return t;
  }, [address]);

  return { token, address, isConnected, loading, error, refresh };
}
