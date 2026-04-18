"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { Chessboard } from "@/components/chessboard";
import { BoltIcon, ChevronLeft, PlayIcon, SparkleIcon } from "@/components/icons";
import { TxExplorerLink, useTxStatus } from "@/components/tx-status";
import { useWallet } from "@/hooks/use-connect";
import {
  useClaimPuzzle,
  useHasClaimed,
  usePuzzlePoolBalance,
  useRound,
  useTodayIndex,
} from "@/hooks/use-puzzle-pool";
import { formatLocal, weiToLocal } from "@/lib/format";

const PUZZLE_FEN = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR";

export default function PuzzlePage() {
  const { address, isConnected, connect, isConnecting } = useWallet();
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const { data: dayRaw } = useTodayIndex();
  const today = dayRaw as bigint | undefined;
  const { data: pendingRaw } = usePuzzlePoolBalance();
  const pending = pendingRaw as bigint | undefined;
  const { data: roundRaw } = useRound(today);
  const { data: alreadyClaimed } = useHasClaimed(today, address);

  const { claim, isPending: claiming, hash } = useClaimPuzzle();
  const { status } = useTxStatus(hash);

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [started]);

  const round = roundRaw as
    | readonly [`0x${string}`, bigint, bigint, boolean]
    | undefined;
  const prizeWei = round?.[1];
  const distributed = round?.[3] ?? false;

  const onClaimDemo = async () => {
    if (!isConnected) return connect();
    alert(
      "Butuh Merkle proof dari backend (GET /puzzle/daily/proof?addr=...). Demo skip transaksi.",
    );
  };

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <main className="flex-1">
      <div className="bg-hero rounded-b-[32px] px-5 pt-[max(env(safe-area-inset-top),18px)] pb-8 text-white">
        <header className="flex items-center justify-between">
          <Link
            href="/home"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
            aria-label="Kembali"
          >
            <ChevronLeft size={18} />
          </Link>
          <p className="text-sm font-bold">Puzzle Harian</p>
          <span className="h-9 w-9" />
        </header>

        <section className="mt-6 text-center fade-in-up">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/80">
            Prize Pool Hari Ini
          </p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight">
            {pending ? weiToLocal(pending) : formatLocal(5, "IDR")}
          </h1>
          <p className="mt-1 text-[11px] text-white/80">
            {pending ? `${formatUnits(pending, 18)} CELO on-chain` : "PuzzlePool.pendingBalance()"}
            {today !== undefined ? ` · day ${today.toString()}` : ""}
          </p>
        </section>
      </div>

      <div className="px-4 pb-8">
        <div className="card -mt-5 p-3 relative z-10">
          <Chessboard fen={PUZZLE_FEN} />
        </div>

        <div className="card mt-4 flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-2)]">
              Putih jalan · Mate in 2
            </p>
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
              {started ? `Timer · ${fmtTime(elapsed)}` : "Siap mulai"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-[color:var(--color-primary-50)] px-3 py-1.5 text-[color:var(--color-primary)]">
            <SparkleIcon size={14} />
            <span className="text-xs font-bold">42 solve</span>
          </div>
        </div>

        {distributed ? (
          <div className="card mt-4 p-4">
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
              Round day {today?.toString()} sudah difinalisasi ✓
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--color-ink-2)]">
              Total prize: {prizeWei ? weiToLocal(prizeWei) : "—"}. Kalau kamu top 10 tercepat,
              backend kasih Merkle proof — lalu panggil <code>claim(day, amount, proof)</code>.
            </p>
            {alreadyClaimed ? (
              <p className="mt-3 rounded-xl bg-[color:var(--color-success-soft)] px-3 py-2 text-[11px] font-bold text-[color:var(--color-success)]">
                Kamu sudah claim hari ini ✓
              </p>
            ) : (
              <button
                type="button"
                onClick={onClaimDemo}
                disabled={claiming || status === "pending"}
                className="mt-3 w-full rounded-2xl bg-[color:var(--color-primary)] py-3 text-sm font-bold text-white shadow-[var(--shadow-glow-primary)]"
              >
                {claiming || status === "pending"
                  ? "Submitting…"
                  : isConnected
                  ? "Claim Prize"
                  : "Connect MiniPay"}
              </button>
            )}
            {hash && (
              <p className="mt-2 text-center">
                <TxExplorerLink hash={hash} />
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setStarted((s) => !s)}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-primary)] py-4 text-base font-bold text-white shadow-[var(--shadow-glow-primary)] active:scale-[0.99]"
          >
            {started ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full bg-white animate-pulse" />
                Timer jalan · {fmtTime(elapsed)}
              </>
            ) : (
              <>
                <PlayIcon size={18} />
                Mulai Puzzle
              </>
            )}
          </button>
        )}

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[color:var(--color-ink-2)]">
          <BoltIcon size={12} className="text-[color:var(--color-amber)]" />
          Gratis main · reset {today !== undefined ? `day ${(today + 1n).toString()} 00:00 UTC` : "00:00 UTC"}
        </p>
      </div>
    </main>
  );
}
