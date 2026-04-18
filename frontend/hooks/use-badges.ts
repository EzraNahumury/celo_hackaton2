"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { gambitBadgesAbi } from "@/lib/abis/gambit-badges";
import {
  BADGE_META,
  BADGE_TYPE,
  CONTRACTS,
  CONTRACTS_CONFIGURED,
  type BadgeType,
} from "@/lib/contracts";

const ALL_BADGES: BadgeType[] = [
  BADGE_TYPE.FIRST_WIN,
  BADGE_TYPE.PUZZLE_STREAK_7,
  BADGE_TYPE.CLUB_CHAMPION,
  BADGE_TYPE.RATING_1400,
  BADGE_TYPE.FAIR_PLAY_HOLD,
];

export function usePlayerBadges(player: `0x${string}` | undefined) {
  const contracts = useMemo(
    () =>
      ALL_BADGES.map((b) => ({
        address: CONTRACTS.badges,
        abi: gambitBadgesAbi,
        functionName: "hasBadge" as const,
        args: player ? [player, b] : undefined,
      })),
    [player],
  );

  const { data, isLoading, error } = useReadContracts({
    contracts,
    query: { enabled: CONTRACTS_CONFIGURED && !!player },
  });

  const badges = useMemo(
    () =>
      ALL_BADGES.map((b, i) => ({
        type: b,
        label: BADGE_META[b].label,
        desc: BADGE_META[b].desc,
        emoji: BADGE_META[b].emoji,
        owned: data?.[i]?.status === "success" ? Boolean(data[i].result) : false,
      })),
    [data],
  );

  return { badges, isLoading, error };
}
