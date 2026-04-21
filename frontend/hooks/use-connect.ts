"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import type { Connector } from "wagmi";
import { clearAuth } from "@/lib/auth";
import { DISCONNECT_FLAG, useConnectDialog } from "@/providers/web3-provider";

export function useWallet() {
  const account = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { openPicker } = useConnectDialog();

  // Hydration guard. Wagmi reads connector state from localStorage on
  // mount, so `isConnected` flips from false (server) to true (client) in
  // the same render — Next.js 16 + Turbopack treats that as a hydration
  // error and tears the subtree down, which surfaces as "This page
  // couldn't load" on mobile. Gate the real values behind a mount flag
  // so the initial client render matches the server's "not connected"
  // snapshot, then the real state appears on the next paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const address = mounted ? account.address : undefined;
  const isConnected = mounted ? account.isConnected : false;
  const chain = mounted ? account.chain : undefined;
  const connector = mounted ? account.connector : undefined;

  const clearDisconnectFlag = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DISCONNECT_FLAG);
    }
  };

  // Explicit user disconnect: set a flag so AutoReconnect won't silently
  // re-attach on next render/refresh. Also wipe wagmi's own persisted
  // state (which is what re-hydrates on reload) and the backend JWT.
  const disconnect = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISCONNECT_FLAG, "1");
      // Nuke every wagmi.* key so the next mount starts clean. Keys vary
      // by wagmi version (wagmi.store, wagmi.recentConnectorId,
      // wagmi.injected.shimDisconnect, etc) so we sweep the prefix.
      try {
        const keys: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith("wagmi.")) keys.push(k);
        }
        keys.forEach((k) => window.localStorage.removeItem(k));
      } catch {
        // localStorage can throw in private mode — fine to ignore.
      }
    }
    clearAuth();
    wagmiDisconnect();
  }, [wagmiDisconnect]);

  const connectWith = (c: Connector) => {
    clearDisconnectFlag();
    return connect({ connector: c });
  };

  return {
    address,
    isConnected,
    chain,
    connector,
    connectors,
    connect: openPicker,
    connectWith,
    disconnect,
    isConnecting: isPending,
    error,
  };
}
