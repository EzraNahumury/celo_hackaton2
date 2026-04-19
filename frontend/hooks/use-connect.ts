"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import type { Connector } from "wagmi";
import { useConnectDialog } from "@/providers/web3-provider";

export function useWallet() {
  const { address, isConnected, chain, connector } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { openPicker } = useConnectDialog();

  const connectWith = (c: Connector) => connect({ connector: c });

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
