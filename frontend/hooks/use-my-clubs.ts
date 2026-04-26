"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { usePublicClient } from "wagmi";
import { clubVaultAbi } from "@/lib/abis/club-vault";
import { ACTIVE_CHAIN, CONTRACTS, CONTRACTS_CONFIGURED, CONTRACTS_DEPLOY_BLOCK } from "@/lib/contracts";
import type { WalletAddress } from "@/types/api";
import type { ChainClub } from "./use-club-vault";

export type MyClubEntry = {
  clubId: bigint;
  isCreator: boolean;
  data: ChainClub;
  memberCount: number;
};

const CLUB_CREATED_EVENT = clubVaultAbi.find(
  (e) => e.type === "event" && e.name === "ClubCreated",
)!;
const MEMBER_JOINED_EVENT = clubVaultAbi.find(
  (e) => e.type === "event" && e.name === "MemberJoined",
)!;

export function useMyClubs(address: WalletAddress | undefined) {
  const [clubs, setClubs] = useState<MyClubEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN.id });

  useEffect(() => {
    if (!address || !publicClient || !CONTRACTS_CONFIGURED) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const contractAddress = CONTRACTS.clubVault;

        const [createdLogs, joinedLogs] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          publicClient.getLogs({ address: contractAddress, event: CLUB_CREATED_EVENT as any, args: { creator: address }, fromBlock: CONTRACTS_DEPLOY_BLOCK, toBlock: "latest" }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          publicClient.getLogs({ address: contractAddress, event: MEMBER_JOINED_EVENT as any, args: { member: address }, fromBlock: CONTRACTS_DEPLOY_BLOCK, toBlock: "latest" }),
        ]);

        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const createdIds = new Set(createdLogs.map((l) => (l as any).args.clubId as bigint));
        const allIds = [
          ...new Set([
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...createdLogs.map((l) => (l as any).args.clubId as bigint),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...joinedLogs.map((l) => (l as any).args.clubId as bigint),
          ]),
        ];

        if (allIds.length === 0) {
          if (!cancelled) { setClubs([]); setLoading(false); }
          return;
        }

        const [clubsRaw, memberCounts] = await Promise.all([
          Promise.all(
            allIds.map((id) =>
              publicClient.readContract({
                address: contractAddress,
                abi: clubVaultAbi,
                functionName: "clubs",
                args: [id],
              }),
            ),
          ),
          Promise.all(
            allIds.map((id) =>
              publicClient.readContract({
                address: contractAddress,
                abi: clubVaultAbi,
                functionName: "memberCount",
                args: [id],
              }),
            ),
          ),
        ]);

        if (cancelled) return;

        const result: MyClubEntry[] = allIds.map((clubId, i) => {
          const raw = clubsRaw[i] as readonly [string, bigint, bigint, bigint, bigint, number];
          return {
            clubId,
            isCreator: createdIds.has(clubId),
            data: {
              creator: raw[0] as `0x${string}`,
              buyIn: raw[1],
              maxMembers: raw[2],
              weekStart: raw[3],
              pot: raw[4],
              state: raw[5] as 0 | 1,
            },
            memberCount: Number(memberCounts[i]),
          };
        });

        // Active clubs first, then by clubId desc (newest first)
        result.sort((a, b) =>
          a.data.state !== b.data.state
            ? a.data.state - b.data.state
            : Number(b.clubId - a.clubId),
        );

        if (!cancelled) { setClubs(result); setLoading(false); }
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [address, publicClient]);

  return { clubs, loading, error };
}
