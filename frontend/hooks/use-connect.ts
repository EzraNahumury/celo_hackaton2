"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export function useWallet() {
  const { address, isConnected, chain } = useAccount();
  const { connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  const connectMiniPay = () => connect({ connector: injected({ shimDisconnect: true }) });

  return {
    address,
    isConnected,
    chain,
    connect: connectMiniPay,
    disconnect,
    isConnecting: isPending,
    error,
  };
}
