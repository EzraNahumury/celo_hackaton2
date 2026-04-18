"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Chessboard } from "@/components/chessboard";
import { ChevronLeft, FlagIcon, TrophyIcon } from "@/components/icons";
import { formatCUsd, formatLocal } from "@/lib/format";

type Result = "win" | "lose" | "draw";

const FEE = 0.03;

function parseTc(tc: string): { base: number; inc: number } {
  const [m, s] = tc.split("+").map(Number);
  return { base: (m || 3) * 60, inc: s || 0 };
}

function fmtClock(secs: number): string {
  const s = Math.max(0, Math.ceil(secs));
  const mm = Math.floor(s / 60).toString().padStart(1, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function GameScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const stake = Number(params.get("stake") ?? "1");
  const tc = params.get("tc") ?? "3+0";
  const { base } = parseTc(tc);

  const [whiteTime, setWhiteTime] = useState(base);
  const [blackTime, setBlackTime] = useState(base);
  const [turn, setTurn] = useState<"w" | "b">("w");
  const [result, setResult] = useState<Result | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (result) return;
    tickRef.current = setInterval(() => {
      if (turn === "w") setWhiteTime((t) => Math.max(0, t - 1));
      else setBlackTime((t) => Math.max(0, t - 1));
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [turn, result]);

  const passTurn = () => {
    setTurn((t) => (t === "w" ? "b" : "w"));
    setMoveCount((n) => n + 1);
  };

  const onResign = () => setResult("lose");
  const potential = stake * 2 * (1 - FEE);

  return (
    <main className="flex-1">
      <div className="bg-hero px-4 pt-[max(env(safe-area-inset-top),14px)] pb-4 text-white">
        <header className="flex items-center justify-between">
          <Link
            href="/play"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
            aria-label="Kembali"
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
            <span className="text-[11px] font-semibold tracking-wide">Live · {tc}</span>
          </div>
          <button
            type="button"
            onClick={onResign}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
            aria-label="Menyerah"
          >
            <FlagIcon size={16} />
          </button>
        </header>
      </div>

      <div className="px-4 pb-6">
        <PlayerBar
          color="black"
          name="Lawan · 0x5a…9c"
          rating={1412}
          time={blackTime}
          active={turn === "b"}
        />

        <div className="mt-3">
          <Chessboard orientation="white" />
        </div>

        <PlayerBar
          color="white"
          name="Kamu"
          rating={1380}
          time={whiteTime}
          active={turn === "w"}
        />

        <div className="card mt-4 flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-2)]">
              Menang dapat
            </p>
            <p className="text-lg font-bold text-[color:var(--color-primary)]">
              {formatLocal(potential, "IDR")}
            </p>
            <p className="text-[11px] text-[color:var(--color-ink-2)]">
              Stake {formatCUsd(stake)} · di escrow
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={passTurn}
              className="rounded-full bg-[color:var(--color-sky-100)] px-4 py-2 text-xs font-bold text-[color:var(--color-ink-1)] hover:bg-[color:var(--color-primary-100)]"
            >
              Move ({moveCount})
            </button>
            <button
              type="button"
              onClick={() => setResult("win")}
              className="rounded-full bg-[color:var(--color-primary)] px-4 py-2 text-xs font-bold text-white shadow-[var(--shadow-glow-primary)]"
            >
              Demo · Menang
            </button>
          </div>
        </div>
      </div>

      {result && (
        <ResultModal
          result={result}
          amount={result === "win" ? potential : result === "lose" ? -stake : 0}
          onPlayAgain={() => router.push("/play")}
          onClose={() => setResult(null)}
        />
      )}
    </main>
  );
}

function PlayerBar({
  color,
  name,
  rating,
  time,
  active,
}: {
  color: "white" | "black";
  name: string;
  rating: number;
  time: number;
  active: boolean;
}) {
  const low = time < 30;
  return (
    <div
      className={`mt-3 flex items-center justify-between rounded-2xl border px-3 py-2.5 transition-colors ${
        active
          ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-50)]"
          : "border-[color:var(--color-border)] bg-white"
      }`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
            color === "white"
              ? "bg-white text-[color:var(--color-ink-0)] border border-[color:var(--color-border-strong)]"
              : "bg-[color:var(--color-ink-0)] text-white"
          }`}
        >
          {color === "white" ? "♙" : "♟"}
        </span>
        <div>
          <p className="text-xs font-semibold leading-none text-[color:var(--color-ink-0)]">{name}</p>
          <p className="mt-1 text-[10px] text-[color:var(--color-ink-2)]">Rating {rating}</p>
        </div>
      </div>
      <div
        className={`rounded-xl px-3 py-1 font-mono text-base font-bold tabular-nums ${
          active
            ? low
              ? "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]"
              : "bg-[color:var(--color-primary)] text-white"
            : "bg-[color:var(--color-sky-100)] text-[color:var(--color-ink-2)]"
        }`}
      >
        {fmtClock(time)}
      </div>
    </div>
  );
}

function ResultModal({
  result,
  amount,
  onPlayAgain,
  onClose,
}: {
  result: Result;
  amount: number;
  onPlayAgain: () => void;
  onClose: () => void;
}) {
  const isWin = result === "win";
  const isDraw = result === "draw";
  const title = isWin ? "Kamu Menang" : isDraw ? "Seri" : "Kamu Kalah";
  const accentClass = isWin
    ? "text-[color:var(--color-success)]"
    : isDraw
    ? "text-[color:var(--color-ink-1)]"
    : "text-[color:var(--color-danger)]";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--color-ink-0)]/60 px-4 pb-6 backdrop-blur-sm">
      <div className="w-full max-w-[430px] fade-in-up rounded-[32px] bg-white p-6 shadow-[var(--shadow-raised)]">
        <div className="flex flex-col items-center text-center">
          <span
            className={`flex h-16 w-16 items-center justify-center rounded-full ${
              isWin
                ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)] pulse-ring"
                : isDraw
                ? "bg-[color:var(--color-primary-50)] text-[color:var(--color-primary)]"
                : "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]"
            }`}
          >
            <TrophyIcon size={30} />
          </span>
          <p
            className={`mt-4 text-xs font-bold uppercase tracking-[0.24em] ${accentClass}`}
          >
            {isWin ? "Menang" : isDraw ? "Seri" : "Kalah"}
          </p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-[color:var(--color-ink-0)]">
            {title}
          </h2>
          <p className={`mt-3 text-4xl font-extrabold tracking-tight ${accentClass}`}>
            {amount > 0 ? "+" : amount < 0 ? "−" : ""}
            {formatLocal(Math.abs(amount), "IDR")}
          </p>
          <p className="mt-1 text-xs text-[color:var(--color-ink-2)]">
            Settled di Celo · 0x9e…4f2 ↗
          </p>
        </div>

        <button
          type="button"
          onClick={onPlayAgain}
          className="mt-6 w-full rounded-2xl bg-[color:var(--color-primary)] py-4 text-base font-bold text-white shadow-[var(--shadow-glow-primary)] active:scale-[0.99]"
        >
          Main Lagi
        </button>
        <div className="mt-3 flex items-center justify-between text-[11px] text-[color:var(--color-ink-2)]">
          <button type="button" onClick={onClose} className="px-2 py-1 hover:text-[color:var(--color-primary)]">
            Tutup
          </button>
          <Link href="/history" className="px-2 py-1 hover:text-[color:var(--color-primary)]">
            Lihat Riwayat
          </Link>
        </div>
      </div>
    </div>
  );
}
