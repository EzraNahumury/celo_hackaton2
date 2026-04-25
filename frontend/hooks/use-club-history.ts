"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { usePublicClient } from "wagmi";
import { clubVaultAbi } from "@/lib/abis/club-vault";
import { ACTIVE_CHAIN, CONTRACTS, CONTRACTS_CONFIGURED } from "@/lib/contracts";
import type { WalletAddress } from "@/types/api";

export type ClubActivityKind = "created" | "joined" | "won" | "placed2nd";

export type ClubActivityRow = {
  id: string;
  clubId: bigint;
  kind: ClubActivityKind;
  buyIn: number;
  net: number;
  blockNumber: bigint;
  txHash: `0x${string}`;
};

const CLUB_CREATED_EVENT = clubVaultAbi.find(
  (e) => e.type === "event" && e.name === "ClubCreated",
)!;
const MEMBER_JOINED_EVENT = clubVaultAbi.find(
  (e) => e.type === "event" && e.name === "MemberJoined",
)!;
const CLUB_SETTLED_EVENT = clubVaultAbi.find(
  (e) => e.type === "event" && e.name === "ClubSettled",
)!;

export function useClubHistory(address: WalletAddress | undefined) {
  const [rows, setRows] = useState<ClubActivityRow[]>([]);
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

        // Fetch events where user is creator or member (both are indexed)
        const [createdLogs, joinedLogs] = await Promise.all([
          publicClient.getLogs({
            address: contractAddress,
            event: CLUB_CREATED_EVENT as Parameters<typeof publicClient.getLogs>[0]["event"],
            args: { creator: address },
            fromBlock: 0n,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: contractAddress,
            event: MEMBER_JOINED_EVENT as Parameters<typeof publicClient.getLogs>[0]["event"],
            args: { member: address },
            fromBlock: 0n,
            toBlock: "latest",
          }),
        ]);

        if (cancelled) return;

        // MemberJoined is emitted alongside ClubCreated in the same tx — skip duplicates
        const createdTxHashes = new Set(createdLogs.map((l) => l.transactionHash));
        const joinedOnlyLogs = joinedLogs.filter(
          (l) => !createdTxHashes.has(l.transactionHash),
        );

        // All unique club IDs the user participated in
        const allClubIds = [
          ...new Set([
            ...createdLogs.map((l) => (l.args as { clubId: bigint }).clubId),
            ...joinedLogs.map((l) => (l.args as { clubId: bigint }).clubId),
          ]),
        ];

        if (allClubIds.length === 0) {
          if (!cancelled) {
            setRows([]);
            setLoading(false);
          }
          return;
        }

        // Fetch settled events and club data in parallel
        const [settledLogsPerClub, clubsData] = await Promise.all([
          Promise.all(
            allClubIds.map((clubId) =>
              publicClient.getLogs({
                address: contractAddress,
                event: CLUB_SETTLED_EVENT as Parameters<typeof publicClient.getLogs>[0]["event"],
                args: { clubId },
                fromBlock: 0n,
                toBlock: "latest",
              }),
            ),
          ),
          Promise.all(
            allClubIds.map((id) =>
              publicClient.readContract({
                address: contractAddress,
                abi: clubVaultAbi,
                functionName: "clubs",
                args: [id],
              }),
            ),
          ),
        ]);

        if (cancelled) return;

        const clubBuyInMap = new Map<bigint, number>(
          allClubIds.map((id, i) => [id, Number(formatUnits(clubsData[i][1], 18))]),
        );

        const activity: ClubActivityRow[] = [];

        // Created rows
        for (const log of createdLogs) {
          const { clubId, buyIn } = log.args as { clubId: bigint; buyIn: bigint };
          const buyInNum = Number(formatUnits(buyIn, 18));
          activity.push({
            id: `created-${log.transactionHash}`,
            clubId,
            kind: "created",
            buyIn: buyInNum,
            net: -buyInNum,
            blockNumber: log.blockNumber ?? 0n,
            txHash: (log.transactionHash ?? "0x") as `0x${string}`,
          });
        }

        // Joined rows (excluding the creator's auto-join in same tx as create)
        for (const log of joinedOnlyLogs) {
          const { clubId } = log.args as { clubId: bigint };
          const buyIn = clubBuyInMap.get(clubId) ?? 0;
          activity.push({
            id: `joined-${log.transactionHash}`,
            clubId,
            kind: "joined",
            buyIn,
            net: -buyIn,
            blockNumber: log.blockNumber ?? 0n,
            txHash: (log.transactionHash ?? "0x") as `0x${string}`,
          });
        }

        // Settled rows — first/second are not indexed, check in JS
        for (let i = 0; i < allClubIds.length; i++) {
          const clubId = allClubIds[i];
          for (const log of settledLogsPerClub[i]) {
            const { first, second, roll } = log.args as {
              first: `0x${string}`;
              second: `0x${string}`;
              roll: bigint;
            };
            const addrLower = address.toLowerCase();
            const isFirst = first.toLowerCase() === addrLower;
            const isSecond = second.toLowerCase() === addrLower;
            if (!isFirst && !isSecond) continue;

            // roll = 10% of afterFee, so toFirst = roll*7, toSecond = roll*2
            const payout = isFirst ? roll * 7n : roll * 2n;
            const net = Number(formatUnits(payout, 18));
            const buyIn = clubBuyInMap.get(clubId) ?? 0;

            activity.push({
              id: `settled-${log.transactionHash}-${clubId}`,
              clubId,
              kind: isFirst ? "won" : "placed2nd",
              buyIn,
              net,
              blockNumber: log.blockNumber ?? 0n,
              txHash: (log.transactionHash ?? "0x") as `0x${string}`,
            });
          }
        }

        if (!cancelled) {
          setRows(activity.sort((a, b) => Number(b.blockNumber - a.blockNumber)));
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, publicClient]);

  return { rows, loading, error };
}
