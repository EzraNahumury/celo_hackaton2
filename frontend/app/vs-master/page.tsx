"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, PlayIcon, SparkleIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { useWallet } from "@/hooks/use-connect";
import { useSession } from "@/hooks/use-session";
import { api } from "@/lib/api";

const DIFFICULTIES = [
  {
    level: 1,
    name: "Easy",
    label: "Beginner",
    piece: "♟",
    description: "Random moves — great for beginners",
    prize: "0.01",
    prizeLabel: "$0.01 cUSD",
    activeBorder: "border-emerald-500",
    activeBg: "bg-emerald-50",
    activeText: "text-emerald-700",
    activeBadge: "bg-emerald-100 text-emerald-700",
    activeAmount: "text-emerald-600",
  },
  {
    level: 2,
    name: "Medium",
    label: "Intermediate",
    piece: "♞",
    description: "Tactical awareness — a real challenge",
    prize: "0.05",
    prizeLabel: "$0.05 cUSD",
    activeBorder: "border-amber-500",
    activeBg: "bg-amber-50",
    activeText: "text-amber-700",
    activeBadge: "bg-amber-100 text-amber-700",
    activeAmount: "text-amber-600",
  },
  {
    level: 3,
    name: "Hard",
    label: "Master",
    piece: "♛",
    description: "Expert tactics — maximum reward",
    prize: "0.10",
    prizeLabel: "$0.10 cUSD",
    activeBorder: "border-red-500",
    activeBg: "bg-red-50",
    activeText: "text-red-700",
    activeBadge: "bg-red-100 text-red-700",
    activeAmount: "text-red-600",
  },
] as const;

export default function VsMasterPage() {
  const router = useRouter();
  const { isConnected, connect, isConnecting } = useWallet();
  const { token, loading: authLoading } = useSession();
  const toast = useToast();

  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = DIFFICULTIES.find((d) => d.level === selectedLevel);

  const onStart = async () => {
    if (!isConnected) {
      connect();
      return;
    }
    if (!token) {
      toast.show({
        title: "Session not ready",
        message: "Wait for sign-in to complete then try again.",
        tone: "info",
      });
      return;
    }
    if (!selectedLevel) {
      toast.show({
        title: "Select difficulty",
        message: "Pick a difficulty level to start.",
        tone: "info",
      });
      return;
    }

    setBusy(true);
    try {
      const game = await api.createGame({
        stake: "0.50",
        timeControl: "5+3",
        color: "random",
        mode: "bot",
        difficulty: selectedLevel,
      });
      router.push(
        `/game?id=${encodeURIComponent(game.gameId)}&vsmaster=1&difficulty=${selectedLevel}`
      );
    } catch (e) {
      const err = e as { code?: string; data?: { gameId?: string } };
      if (err.code === "ACTIVE_GAME_EXISTS" && err.data?.gameId) {
        router.push(`/game?id=${encodeURIComponent(err.data.gameId)}`);
        return;
      }
      toast.showError(e);
    } finally {
      setBusy(false);
    }
  };

  const working = busy || isConnecting || authLoading;

  const btnLabel = !isConnected
    ? "Connect MiniPay"
    : authLoading
    ? "Signing in…"
    : busy
    ? "Starting game…"
    : selected
    ? `Play ${selected.name} — Win ${selected.prizeLabel}`
    : "Select a difficulty";

  return (
    <main className="flex-1">
      {/* Hero */}
      <div className="bg-hero rounded-b-[32px] px-5 pt-[max(env(safe-area-inset-top),18px)] pb-8 text-white">
        <header className="flex items-center justify-between">
          <Link
            href="/home"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
            aria-label="Back"
          >
            <ChevronLeft size={18} />
          </Link>
          <p className="text-sm font-bold">vs Master Chess</p>
          <span className="h-9 w-9" />
        </header>

        <section className="mt-6 text-center fade-in-up">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/80">
            AI Challenge
          </p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Beat the Bot</h1>
          <p className="mt-1 text-sm text-white/80">
            Win vs the AI, earn cUSD — claimed instantly on-chain
          </p>
          {selected && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur-sm">
              <SparkleIcon size={14} />
              Win {selected.prizeLabel} on {selected.name} difficulty
            </div>
          )}
        </section>
      </div>

      <div className="px-5 pb-8">
        {/* Difficulty cards */}
        <section className="card relative z-10 -mt-5 p-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-2)]">
            Choose Difficulty
          </h2>

          <div className="mt-3 flex flex-col gap-3">
            {DIFFICULTIES.map((d) => {
              const isActive = selectedLevel === d.level;
              return (
                <button
                  key={d.level}
                  type="button"
                  onClick={() => setSelectedLevel(d.level)}
                  className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] ${
                    isActive
                      ? `${d.activeBorder} ${d.activeBg}`
                      : "border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] hover:border-[color:var(--color-primary-200)]"
                  }`}
                >
                  {/* Icon */}
                  <span className="flex-shrink-0 text-4xl leading-none w-10 text-center">{d.piece}</span>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm font-bold ${isActive ? d.activeText : "text-[color:var(--color-ink-0)]"}`}>
                          {d.name}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isActive ? d.activeBadge : "bg-[color:var(--color-sky-100)] text-[color:var(--color-ink-2)]"}`}>
                          {d.label}
                        </span>
                      </div>
                      <p className={`flex-shrink-0 text-base font-extrabold tabular-nums ${isActive ? d.activeAmount : "text-[color:var(--color-ink-2)]"}`}>
                        {d.prizeLabel}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-[11px] text-[color:var(--color-ink-2)]">{d.description}</p>
                      <p className="flex-shrink-0 text-[10px] text-[color:var(--color-ink-3)] ml-2">prize on win</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* How it works */}
        <section className="card mt-4 p-4">
          <div className="flex items-center gap-2">
            <SparkleIcon size={16} className="text-[color:var(--color-primary)]" />
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">How it works</p>
          </div>
          <ol className="mt-2 space-y-1 text-[11px] text-[color:var(--color-ink-2)]">
            <li>1. Pick a difficulty and start a free game vs the AI bot.</li>
            <li>2. Checkmate the bot to win — higher difficulty = bigger prize.</li>
            <li>3. Prize is automatically claimed on-chain after you win.</li>
          </ol>
        </section>

        {/* CTA */}
        <button
          type="button"
          onClick={onStart}
          disabled={working || (isConnected && !selectedLevel)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-primary)] py-4 text-base font-bold text-white shadow-[var(--shadow-glow-primary)] transition-all active:scale-[0.99] disabled:opacity-70"
        >
          {working ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              {btnLabel}
            </>
          ) : (
            <>
              <PlayIcon size={18} />
              {btnLabel}
            </>
          )}
        </button>

        <p className="mt-3 text-center text-[11px] text-[color:var(--color-ink-2)]">
          No stake required · prizes from DailyPuzzlePool contract
        </p>
      </div>
    </main>
  );
}
