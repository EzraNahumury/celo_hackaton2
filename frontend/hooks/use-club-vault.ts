"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { clubVaultAbi } from "@/lib/abis/club-vault";
import { CONTRACTS, CONTRACTS_CONFIGURED, type ClubState } from "@/lib/contracts";
import { celoToWei } from "@/lib/format";

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
  const createClub = (opts: { maxMembers: number; buyInCelo: number }) => {
    if (!CONTRACTS_CONFIGURED) throw new Error("Contracts belum di-deploy");
    if (opts.maxMembers < 4 || opts.maxMembers > 8)
      throw new Error("maxMembers harus 4–8");
    return writeContractAsync({
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
  const joinClub = (opts: { clubId: bigint; buyInCelo: number }) => {
    if (!CONTRACTS_CONFIGURED) throw new Error("Contracts belum di-deploy");
    return writeContractAsync({
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
  const startNewWeek = (opts: { clubId: bigint; buyInCelo: number }) => {
    if (!CONTRACTS_CONFIGURED) throw new Error("Contracts belum di-deploy");
    return writeContractAsync({
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
    address: CONTRACTS.clubVault,
    abi: clubVaultAbi,
    functionName: "clubs",
    args: clubId !== undefined ? [clubId] : undefined,
    query: { enabled: CONTRACTS_CONFIGURED && clubId !== undefined },
  });
}

export function useClubMembers(clubId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.clubVault,
    abi: clubVaultAbi,
    functionName: "getMembers",
    args: clubId !== undefined ? [clubId] : undefined,
    query: { enabled: CONTRACTS_CONFIGURED && clubId !== undefined },
  });
}

export function useClubCount() {
  return useReadContract({
    address: CONTRACTS.clubVault,
    abi: clubVaultAbi,
    functionName: "clubCount",
    query: { enabled: CONTRACTS_CONFIGURED },
  });
}
