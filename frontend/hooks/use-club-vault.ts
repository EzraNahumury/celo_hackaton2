"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { clubVaultAbi } from "@/lib/abis/club-vault";
import { ACTIVE_CHAIN, CONTRACTS, CONTRACTS_CONFIGURED, type ClubState } from "@/lib/contracts";
import { celoToWei } from "@/lib/format";
import { useEnsureChain } from "./use-ensure-chain";

export type ChainClub = {
  creator: `0x${string}`;
  buyIn: bigint;
  maxMembers: bigint;
  weekStart: bigint;
  pot: bigint;
  state: ClubState;
};

export function useCreateClub() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { ensure } = useEnsureChain();
  const createClub = async (opts: { maxMembers: number; buyInCelo: number }) => {
    if (!CONTRACTS_CONFIGURED) throw new Error("Contracts not deployed");
    if (opts.maxMembers < 4 || opts.maxMembers > 8)
      throw new Error("maxMembers must be 4–8");
    await ensure();
    return writeContractAsync({
      chainId: ACTIVE_CHAIN.id,
      address: CONTRACTS.clubVault,
      abi: clubVaultAbi,
      functionName: "createClub",
      args: [BigInt(opts.maxMembers)],
      value: celoToWei(opts.buyInCelo),
    });
  };
  return { createClub, isPending, error, hash: data };
}

export function useJoinClub() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { ensure } = useEnsureChain();
  const joinClub = async (opts: { clubId: bigint; buyInCelo: number }) => {
    if (!CONTRACTS_CONFIGURED) throw new Error("Contracts not deployed");
    await ensure();
    return writeContractAsync({
      chainId: ACTIVE_CHAIN.id,
      address: CONTRACTS.clubVault,
      abi: clubVaultAbi,
      functionName: "joinClub",
      args: [opts.clubId],
      value: celoToWei(opts.buyInCelo),
    });
  };
  return { joinClub, isPending, error, hash: data };
}

export function useStartNewWeek() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { ensure } = useEnsureChain();
  const startNewWeek = async (opts: { clubId: bigint; buyInCelo: number }) => {
    if (!CONTRACTS_CONFIGURED) throw new Error("Contracts not deployed");
    await ensure();
    return writeContractAsync({
      chainId: ACTIVE_CHAIN.id,
      address: CONTRACTS.clubVault,
      abi: clubVaultAbi,
      functionName: "startNewWeek",
      args: [opts.clubId],
      value: celoToWei(opts.buyInCelo),
    });
  };
  return { startNewWeek, isPending, error, hash: data };
}

export function useClub(clubId: bigint | undefined) {
  return useReadContract({
    chainId: ACTIVE_CHAIN.id,
    address: CONTRACTS.clubVault,
    abi: clubVaultAbi,
    functionName: "clubs",
    args: clubId !== undefined ? [clubId] : undefined,
    query: { enabled: CONTRACTS_CONFIGURED && clubId !== undefined },
  });
}

export function useClubMembers(clubId: bigint | undefined) {
  return useReadContract({
    chainId: ACTIVE_CHAIN.id,
    address: CONTRACTS.clubVault,
    abi: clubVaultAbi,
    functionName: "getMembers",
    args: clubId !== undefined ? [clubId] : undefined,
    query: { enabled: CONTRACTS_CONFIGURED && clubId !== undefined },
  });
}

export function useClubCount() {
  return useReadContract({
    chainId: ACTIVE_CHAIN.id,
    address: CONTRACTS.clubVault,
    abi: clubVaultAbi,
    functionName: "clubCount",
    query: { enabled: CONTRACTS_CONFIGURED },
  });
}
