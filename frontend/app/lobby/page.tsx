"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatUnits } from "viem";
import { useReadContracts } from "wagmi";
import { ChevronLeft, SwordsIcon } from "@/components/icons";
import { TxExplorerLink, useTxStatus } from "@/components/tx-status";
import { useJoinMatch, useMatchCount } from "@/hooks/use-match-escrow";
import { useWallet } from "@/hooks/use-connect";
import { matchEscrowAbi } from "@/lib/abis/match-escrow";
import {
  CONTRACTS,
  CONTRACTS_CONFIGURED,
  MATCH_STATE,
  tcSecondsToLabel,
} from "@/lib/contracts";
import { formatLocal, truncateAddress, weiToLocal } from "@/lib/format";

const PAGE_SIZE = 10;

export default function LobbyPage() {
  const { address, isConnected, connect, isConnecting } = useWallet();
  const { data: countRaw } = useMatchCount();
  const count = countRaw ? Number(countRaw) : 0;

  const ids = useMemo(() => {
    const recent = Math.max(0, count - PAGE_SIZE);
    return Array.from({ length: count - recent }).map((_, i) => BigInt(count - i));
  }, [count]);

  const { data: matchesRaw, isLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      address: CONTRACTS.matchEscrow,
      abi: matchEscrowAbi,
      functionName: "matches" as const,
      args: [id],
    })),
    query: { enabled: CONTRACTS_CONFIGURED && ids.length > 0 },
  });

  const pending = useMemo(() => {
    if (!matchesRaw) return [] as {
      id: bigint;
      playerA: `0x${string}`;
      stake: bigint;
      tcSec: bigint;
    }[];
    return matchesRaw
      .map((r, i) => ({ raw: r, id: ids[i] }))
      .filter((x) => x.raw.status === "success")
      .map((x) => {
        const v = x.raw.result as readonly [
          `0x${string}`,
          `0x${string}`,
          bigint,
          bigint,
          bigint,
          number,
          `0x${string}`,
          boolean,
        ];
        return {
          id: x.id,
          playerA: v[0],
          stake: v[2],
          tcSec: v[4],
          state: v[5],
        };
      })
      .filter((m) => m.state === MATCH_STATE.Pending);
  }, [matchesRaw, ids]);

  return (
    <main className="flex-1">
      <div className="bg-hero rounded-b-[32px] px-5 pt-[max(env(safe-area-inset-top),18px)] pb-8 text-white">
        <header className="flex items-center justify-between">
          <Link
            href="/play"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
            aria-label="Kembali"
          >
            <ChevronLeft size={18} />
          </Link>
          <p className="text-sm font-bold">Lobby</p>
          <Link
            href="/play"
            className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold"
          >
            Buat Baru
          </Link>
        </header>
        <div className="mt-5 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/80">
            Match menunggu
          </p>
          <h1 className="mt-1 text-4xl font-extrabold">{pending.length}</h1>
          <p className="mt-1 text-xs text-white/80">on-chain · menunggu opponent</p>
        </div>
      </div>

      <div className="px-5 pb-6">
        {!isConnected && (
          <button
            type="button"
            onClick={connect}
            disabled={isConnecting}
            className="mt-4 w-full rounded-2xl bg-[color:var(--color-primary)] py-3 text-sm font-bold text-white shadow-[var(--shadow-glow-primary)]"
          >
            {isConnecting ? "Menghubungkan…" : "Connect MiniPay untuk join"}
          </button>
        )}

        {isLoading ? (
          <div className="mt-6 flex items-center justify-center py-10 text-sm text-[color:var(--color-ink-2)]">
            Memuat dari chain…
          </div>
        ) : pending.length === 0 ? (
          <div className="card mt-4 flex flex-col items-center gap-2 p-8 text-center">
            <SwordsIcon size={28} className="text-[color:var(--color-primary)]" />
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
              Belum ada match menunggu
            </p>
            <p className="text-[11px] text-[color:var(--color-ink-2)]">
              Buat match sendiri — pertama yang buka lobby biasanya cepat dapat lawan.
            </p>
            <Link
              href="/play"
              className="mt-2 rounded-full bg-[color:var(--color-primary)] px-5 py-2 text-xs font-bold text-white"
            >
              Buat Match
            </Link>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {pending.map((m) => (
              <MatchRow
                key={m.id.toString()}
                id={m.id}
                playerA={m.playerA}
                stake={m.stake}
                tcSec={m.tcSec}
                isSelf={address?.toLowerCase() === m.playerA.toLowerCase()}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function MatchRow({
  id,
  playerA,
  stake,
  tcSec,
  isSelf,
}: {
  id: bigint;
  playerA: `0x${string}`;
  stake: bigint;
  tcSec: bigint;
  isSelf: boolean;
}) {
  const { joinMatch, isPending, hash } = useJoinMatch();
  const { status } = useTxStatus(hash);

  const stakeCelo = Number(formatUnits(stake, 18));
  const busy = isPending || status === "pending";

  const onJoin = async () => {
    try {
      await joinMatch({ matchId: id, stakeCelo });
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <li className="card flex items-center gap-3 px-4 py-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--color-primary-50)] text-[color:var(--color-primary)]">
        <SwordsIcon size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-bold text-[color:var(--color-ink-0)]">
          Match #{id.toString()} ·{" "}
          <span className="text-[color:var(--color-primary)]">
            {tcSecondsToLabel(Number(tcSec))}
          </span>
        </p>
        <p className="text-[11px] text-[color:var(--color-ink-2)]">
          {isSelf ? "Kamu" : truncateAddress(playerA)} · stake {stakeCelo.toFixed(2)} CELO
        </p>
        {hash && (
          <div className="mt-1">
            <TxExplorerLink hash={hash} />
          </div>
        )}
      </div>
      {isSelf ? (
        <span className="rounded-full bg-[color:var(--color-amber-soft)] px-3 py-1 text-[10px] font-bold text-[color:var(--color-amber)]">
          MILIKMU
        </span>
      ) : (
        <button
          type="button"
          onClick={onJoin}
          disabled={busy}
          className="rounded-full bg-[color:var(--color-primary)] px-4 py-2 text-xs font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-70"
        >
          {busy ? "…" : `Join ${formatLocal(stakeCelo, "IDR")}`}
        </button>
      )}
    </li>
  );
}
