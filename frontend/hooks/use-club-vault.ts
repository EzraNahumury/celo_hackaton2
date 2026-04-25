"use client";

import { erc20Abi, parseEther } from "viem";
import { usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { clubVaultAbi } from "@/lib/abis/club-vault";
import { ACTIVE_CHAIN, CONTRACTS, CONTRACTS_CONFIGURED, STAKE_TOKEN, type ClubState } from "@/lib/contracts";
import { useEnsureChain } from "./use-ensure-chain";

export type ChainClub = {
  creator: `0x${string}`;
  buyIn: bigint;
  maxMembers: bigint;
  weekStart: bigint;
  pot: bigint;
  state: ClubState;
};

export type ClubTxPhase = "approve" | "approve_wait" | "write";

function useWaitForTxReceipt() {
  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN.id });

  return async (hash: `0x${string}`) => {
    if (!publicClient) throw new Error("Public client unavailable");
    await publicClient.waitForTransactionReceipt({ hash });
  };
}

export function useCreateClub() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { ensure } = useEnsureChain();
  const waitForReceipt = useWaitForTxReceipt();
  const createClub = async (opts: { maxMembers: number; buyIn: number }) => {
    if (!CONTRACTS_CONFIGURED) throw new Error("Contracts not deployed");
    if (opts.maxMembers < 4 || opts.maxMembers > 8)
      throw new Error("maxMembers must be 4–8");
    await ensure();
    const amountWei = parseEther(opts.buyIn.toString());
    const approveHash = await writeContractAsync({
      chainId: ACTIVE_CHAIN.id,
      address: STAKE_TOKEN.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [CONTRACTS.clubVault, amountWei],
    });
    await waitForReceipt(approveHash);
    return writeContractAsync({
      chainId: ACTIVE_CHAIN.id,
      address: CONTRACTS.clubVault,
      abi: clubVaultAbi,
      functionName: "createClub",
      args: [BigInt(opts.maxMembers), amountWei],
    });
  };
  return { createClub, isPending, error, hash: data };
}

export function useJoinClub() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { ensure } = useEnsureChain();
  const waitForReceipt = useWaitForTxReceipt();
  const joinClub = async (opts: {
    clubId: bigint;
    buyIn: number;
    onPhaseChange?: (phase: ClubTxPhase) => void;
  }) => {
    if (!CONTRACTS_CONFIGURED) throw new Error("Contracts not deployed");
    await ensure();
    const amountWei = parseEther(opts.buyIn.toString());
    opts.onPhaseChange?.("approve");
    const approveHash = await writeContractAsync({
      chainId: ACTIVE_CHAIN.id,
      address: STAKE_TOKEN.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [CONTRACTS.clubVault, amountWei],
    });
    opts.onPhaseChange?.("approve_wait");
    await waitForReceipt(approveHash);
    opts.onPhaseChange?.("write");
    return writeContractAsync({
      chainId: ACTIVE_CHAIN.id,
      address: CONTRACTS.clubVault,
      abi: clubVaultAbi,
      functionName: "joinClub",
      args: [opts.clubId],
    });
  };
  return { joinClub, isPending, error, hash: data };
}

export function useStartNewWeek() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { ensure } = useEnsureChain();
  const waitForReceipt = useWaitForTxReceipt();
  const startNewWeek = async (opts: { clubId: bigint; buyIn: number }) => {
    if (!CONTRACTS_CONFIGURED) throw new Error("Contracts not deployed");
    await ensure();
    const amountWei = parseEther(opts.buyIn.toString());
    const approveHash = await writeContractAsync({
      chainId: ACTIVE_CHAIN.id,
      address: STAKE_TOKEN.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [CONTRACTS.clubVault, amountWei],
    });
    await waitForReceipt(approveHash);
    return writeContractAsync({
      chainId: ACTIVE_CHAIN.id,
      address: CONTRACTS.clubVault,
      abi: clubVaultAbi,
      functionName: "startNewWeek",
      args: [opts.clubId],
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
    query: {
      enabled: CONTRACTS_CONFIGURED && clubId !== undefined,
      select: (data): ChainClub => ({
        creator: data[0],
        buyIn: data[1],
        maxMembers: data[2],
        weekStart: data[3],
        pot: data[4],
        state: data[5] as ClubState,
      }),
    },
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
