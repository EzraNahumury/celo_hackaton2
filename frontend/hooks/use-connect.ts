"use client";

import { useCallback } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import type { Connector } from "wagmi";
import { clearAuth } from "@/lib/auth";
import { DISCONNECT_FLAG, useConnectDialog } from "@/providers/web3-provider";

export function useWallet() {
  const { address, isConnected, chain, connector } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { openPicker } = useConnectDialog();

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
