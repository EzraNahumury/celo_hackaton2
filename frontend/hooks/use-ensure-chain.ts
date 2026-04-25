"use client";

import { useCallback } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { ACTIVE_CHAIN } from "@/lib/contracts";

// Some users leave their wallet on Base/Ethereum/etc. If they click an
// on-chain action while on the wrong network, the tx would either fail or
// (worse) execute on the wrong chain. This hook exposes a helper that the
// write hooks call right before `writeContractAsync` to force a switch
// request to Celo first.
export function useEnsureChain() {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const ensure = useCallback(async () => {
    if (chainId === ACTIVE_CHAIN.id) return;
    await switchChainAsync({ chainId: ACTIVE_CHAIN.id });
  }, [chainId, switchChainAsync]);

  return {
    ensure,
    onCorrectChain: chainId === ACTIVE_CHAIN.id,
    currentChainId: chainId,
  };
}
