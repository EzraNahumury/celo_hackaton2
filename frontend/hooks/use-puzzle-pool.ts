"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { puzzlePoolAbi } from "@/lib/abis/puzzle-pool";
import { CONTRACTS, CONTRACTS_CONFIGURED } from "@/lib/contracts";
import { celoToWei } from "@/lib/format";

export function useSponsorDeposit() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const sponsorDeposit = (amountCelo: number) => {
    if (!CONTRACTS_CONFIGURED) throw new Error("Contracts belum di-deploy");
    return writeContractAsync({
      address: CONTRACTS.puzzlePool,
      abi: puzzlePoolAbi,
      functionName: "sponsorDeposit",
      value: celoToWei(amountCelo),
    });
  };
  return { sponsorDeposit, isPending, error, hash: data };
}

export function useClaimPuzzle() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const claim = (opts: {
    day: bigint;
    amountWei: bigint;
    proof: `0x${string}`[];
  }) => {
    if (!CONTRACTS_CONFIGURED) throw new Error("Contracts belum di-deploy");
    return writeContractAsync({
      address: CONTRACTS.puzzlePool,
      abi: puzzlePoolAbi,
      functionName: "claim",
      args: [opts.day, opts.amountWei, opts.proof],
    });
  };
  return { claim, isPending, error, hash: data };
}

export function usePuzzlePoolBalance() {
  return useReadContract({
    address: CONTRACTS.puzzlePool,
    abi: puzzlePoolAbi,
    functionName: "pendingBalance",
    query: { enabled: CONTRACTS_CONFIGURED },
  });
}

export function useTodayIndex() {
  return useReadContract({
    address: CONTRACTS.puzzlePool,
    abi: puzzlePoolAbi,
    functionName: "todayIndex",
    query: { enabled: CONTRACTS_CONFIGURED },
  });
}

export function useRound(day: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.puzzlePool,
    abi: puzzlePoolAbi,
    functionName: "rounds",
    args: day !== undefined ? [day] : undefined,
    query: { enabled: CONTRACTS_CONFIGURED && day !== undefined },
  });
}

export function useHasClaimed(day: bigint | undefined, player: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.puzzlePool,
    abi: puzzlePoolAbi,
    functionName: "hasClaimed",
    args: day !== undefined && player !== undefined ? [day, player] : undefined,
    query: { enabled: CONTRACTS_CONFIGURED && day !== undefined && !!player },
  });
}
