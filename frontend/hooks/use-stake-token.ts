"use client";

import { erc20Abi } from "viem";
import { useReadContract, useWriteContract } from "wagmi";
import { ACTIVE_CHAIN, STAKE_TOKEN, STAKE_TOKEN_CONFIGURED } from "@/lib/contracts";
import type { WalletAddress } from "@/types/api";
import { useEnsureChain } from "./use-ensure-chain";

const faucetAbi = [
  {
    type: "function",
    name: "faucet",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

function resolveTokenAddress(tokenAddress?: WalletAddress | null): WalletAddress {
  const resolved = tokenAddress ?? STAKE_TOKEN.address;
  if (!resolved || resolved.length !== 42 || resolved === "0x") {
    throw new Error("cUSD token address is not configured");
  }
  return resolved;
}

export function useApproveStakeToken() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { ensure } = useEnsureChain();

  const approve = async (opts: {
    tokenAddress?: WalletAddress | null;
    spender: WalletAddress;
    amountWei: bigint;
  }) => {
    const tokenAddress = resolveTokenAddress(opts.tokenAddress);
    await ensure();
    return writeContractAsync({
      chainId: ACTIVE_CHAIN.id,
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [opts.spender, opts.amountWei],
    });
  };

  return { approve, isPending, error, hash: data };
}

export function useStakeTokenFaucet() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { ensure } = useEnsureChain();

  const requestFaucet = async () => {
    if (!STAKE_TOKEN_CONFIGURED || !STAKE_TOKEN.faucetEnabled) {
      throw new Error("cUSD faucet is unavailable on this network");
    }
    await ensure();
    return writeContractAsync({
      chainId: ACTIVE_CHAIN.id,
      address: STAKE_TOKEN.address,
      abi: faucetAbi,
      functionName: "faucet",
      args: [],
    });
  };

  return { requestFaucet, isPending, error, hash: data };
}

export function useStakeTokenBalance(
  address: WalletAddress | undefined,
  refetchInterval?: number | false,
) {
  return useReadContract({
    chainId: ACTIVE_CHAIN.id,
    address: STAKE_TOKEN.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && STAKE_TOKEN_CONFIGURED,
      refetchInterval: refetchInterval ?? false,
    },
  });
}
