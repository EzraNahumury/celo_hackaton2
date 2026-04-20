"use client";

import { useEffect, useRef } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { ACTIVE_CHAIN } from "@/lib/contracts";
import { useToast } from "./toast";

// Headless guard: when the wallet is connected on a different chain, call
// switchChain automatically. The wallet itself shows its own native
// permission prompt, so no in-app banner is needed. A toast only fires if
// the user rejects the switch so they know why nothing happened.
export function ChainBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const toast = useToast();
  const attempted = useRef<number | null>(null);

  useEffect(() => {
    if (!isConnected) {
      attempted.current = null;
      return;
    }
    if (chainId === ACTIVE_CHAIN.id) {
      attempted.current = null;
      return;
    }
    if (isPending) return;
    // Avoid re-prompting forever if the user rejects; only try once per
    // distinct wrong-chain value until they manually switch or reconnect.
    if (attempted.current === chainId) return;
    attempted.current = chainId ?? null;

    switchChain(
      { chainId: ACTIVE_CHAIN.id },
      {
        onError: (e) => {
          const msg = (e as Error).message || "";
          if (/reject|denied/i.test(msg)) {
            toast.show({
              title: "Wrong network",
              message: `Please switch your wallet to ${ACTIVE_CHAIN.name} to play.`,
              tone: "warning",
            });
          }
        },
      },
    );
  }, [isConnected, chainId, isPending, switchChain, toast]);

  return null;
}
