"use client";

import Link from "next/link";
import { useState } from "react";
import { Chessboard } from "@/components/chessboard";
import { BoltIcon, ChevronLeft, PlayIcon, SparkleIcon } from "@/components/icons";
import { formatLocal } from "@/lib/format";

const PUZZLE_FEN = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR";

export default function PuzzlePage() {
  const [started, setStarted] = useState(false);

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
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight">{formatLocal(5, "IDR")}</h1>
          <p className="mt-1 text-xs text-white/80">
            Top 10 dapat bagian · reset 00:00 UTC
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
              Putih jalan
            </p>
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">Skakmat dalam 2</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-[color:var(--color-primary-50)] px-3 py-1.5 text-[color:var(--color-primary)]">
            <SparkleIcon size={14} />
            <span className="text-xs font-bold">42 solve</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setStarted((s) => !s)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-primary)] py-4 text-base font-bold text-white shadow-[var(--shadow-glow-primary)] active:scale-[0.99]"
        >
          {started ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full bg-white animate-pulse" />
              Timer jalan · 00:04
            </>
          ) : (
            <>
              <PlayIcon size={18} />
              Mulai Puzzle
            </>
          )}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[color:var(--color-ink-2)]">
          <BoltIcon size={12} className="text-[color:var(--color-amber)]" />
          Gratis main · reward auto-bayar saat reset
        </p>
      </div>
    </main>
  );
}
