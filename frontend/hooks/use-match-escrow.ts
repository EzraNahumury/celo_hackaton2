"use client";

import { useWriteContract, useReadContract } from "wagmi";
import { matchEscrowAbi } from "@/lib/abis/match-escrow";
import { CONTRACTS, CONTRACTS_CONFIGURED, type MatchState } from "@/lib/contracts";
import { celoToWei } from "@/lib/format";

export type ChainMatch = {
  playerA: `0x${string}`;
  playerB: `0x${string}`;
  stake: bigint;
  createdAt: bigint;
  timeControl: bigint;
  state: MatchState;
  winner: `0x${string}`;
  feesForwarded: boolean;
};

export function useCreateMatch() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();

  const createMatch = async (opts: { timeControlSeconds: number; stakeCelo: number }) => {
    if (!CONTRACTS_CONFIGURED) throw new Error("Contracts belum di-deploy");
    return writeContractAsync({
      address: CONTRACTS.matchEscrow,
      abi: matchEscrowAbi,
      functionName: "createMatch",
      args: [BigInt(opts.timeControlSeconds)],
      value: celoToWei(opts.stakeCelo),
    });
  };

  return { createMatch, isPending, error, hash: data };
}

export function useJoinMatch() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();

  const joinMatch = async (opts: { matchId: bigint; stakeCelo: number }) => {
    if (!CONTRACTS_CONFIGURED) throw new Error("Contracts belum di-deploy");
    return writeContractAsync({
      address: CONTRACTS.matchEscrow,
      abi: matchEscrowAbi,
      functionName: "joinMatch",
      args: [opts.matchId],
      value: celoToWei(opts.stakeCelo),
    });
  };

  return { joinMatch, isPending, error, hash: data };
}

export function useCancelMatch() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const cancelMatch = (matchId: bigint) => {
    if (!CONTRACTS_CONFIGURED) throw new Error("Contracts belum di-deploy");
    return writeContractAsync({
      address: CONTRACTS.matchEscrow,
      abi: matchEscrowAbi,
      functionName: "cancelMatch",
      args: [matchId],
    });
  };
  return { cancelMatch, isPending, error, hash: data };
}

export function useClaimForfeit() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const claimForfeit = (matchId: bigint, sig: `0x${string}`) => {
    if (!CONTRACTS_CONFIGURED) throw new Error("Contracts belum di-deploy");
    return writeContractAsync({
      address: CONTRACTS.matchEscrow,
      abi: matchEscrowAbi,
      functionName: "claimForfeit",
      args: [matchId, sig],
    });
  };
  return { claimForfeit, isPending, error, hash: data };
}

export function useMatch(matchId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.matchEscrow,
    abi: matchEscrowAbi,
    functionName: "matches",
    args: matchId !== undefined ? [matchId] : undefined,
    query: { enabled: CONTRACTS_CONFIGURED && matchId !== undefined },
  });
}

export function useMatchCount() {
  return useReadContract({
    address: CONTRACTS.matchEscrow,
    abi: matchEscrowAbi,
    functionName: "matchCount",
    query: { enabled: CONTRACTS_CONFIGURED },
  });
}
