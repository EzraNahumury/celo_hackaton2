"use client";

import { useWriteContract, useReadContract } from "wagmi";
import { dailyPuzzlePoolAbi } from "@/lib/abis/daily-puzzle-pool";
import { ACTIVE_CHAIN } from "@/lib/contracts";
import { useEnsureChain } from "./use-ensure-chain";

function getPoolAddress(): `0x${string}` | undefined {
  const addr = process.env.NEXT_PUBLIC_DAILY_PUZZLE_POOL;
  return addr && addr.length === 42 ? (addr as `0x${string}`) : undefined;
}

export function useClaimDailyPuzzle() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { ensure } = useEnsureChain();

  const claim = async (opts: {
    contractAddress: `0x${string}`;
    day: bigint;
    nonce: `0x${string}`;
    amountWei: bigint;
    signature: `0x${string}`;
  }) => {
    await ensure();
    return writeContractAsync({
      chainId: ACTIVE_CHAIN.id,
      address: opts.contractAddress,
      abi: dailyPuzzlePoolAbi,
      functionName: "claim",
      args: [opts.day, opts.nonce, opts.amountWei, opts.signature],
    });
  };

  return { claim, isPending, error, hash: data };
}

export function useDailyPuzzlePoolBalance() {
  const address = getPoolAddress();
  return useReadContract({
    chainId: ACTIVE_CHAIN.id,
    address,
    abi: dailyPuzzlePoolAbi,
    functionName: "poolBalance",
    query: { enabled: !!address },
  });
}

export function useClaimsToday(player: `0x${string}` | undefined) {
  const address = getPoolAddress();
  return useReadContract({
    chainId: ACTIVE_CHAIN.id,
    address,
    abi: dailyPuzzlePoolAbi,
    functionName: "claimsToday",
    args: player ? [player] : undefined,
    query: { enabled: !!address && !!player },
  });
}
