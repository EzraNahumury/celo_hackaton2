"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BoltIcon, ChevronLeft, PlayIcon, SparkleIcon } from "@/components/icons";
import { formatCUsd, formatLocal } from "@/lib/format";

const STAKES = [
  { value: 0.5, label: "0.50" },
  { value: 1.0, label: "1.00" },
  { value: 2.0, label: "2.00" },
] as const;

const TIME_CONTROLS = [
  { value: "1+0", label: "Bullet", sub: "1 mnt" },
  { value: "3+0", label: "Blitz", sub: "3 mnt" },
  { value: "3+2", label: "Blitz+2", sub: "3 + 2" },
  { value: "5+3", label: "Rapid", sub: "5 + 3" },
] as const;

const FEE = 0.03;

export default function PlayPage() {
  const router = useRouter();
  const [stake, setStake] = useState<number>(1.0);
  const [tc, setTc] = useState<string>("3+0");
  const [starting, setStarting] = useState(false);

  const potential = stake * 2 * (1 - FEE);

  const onStart = () => {
    setStarting(true);
    setTimeout(() => router.push(`/game?stake=${stake}&tc=${tc}`), 450);
  };

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
          <p className="text-sm font-bold">Main 1v1</p>
          <span className="h-9 w-9" />
        </header>

        <section className="mt-6 text-center fade-in-up">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/80">
            Kalau menang
          </p>
          <h1 className="mt-1 text-5xl font-extrabold tracking-tight">
            {formatLocal(potential, "IDR")}
          </h1>
          <p className="mt-1 text-xs text-white/80">
            Pot {formatCUsd(stake * 2)} · dipotong 3% fee
          </p>
        </section>
      </div>

      <div className="px-5 pb-8">
        <section className="card -mt-5 p-5 relative z-10">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-2)]">
            Pilih Stake
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {STAKES.map((s) => {
              const active = s.value === stake;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStake(s.value)}
                  className={`rounded-2xl border-2 px-3 py-4 text-left transition-all ${
                    active
                      ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-50)] shadow-[var(--shadow-glow-primary)]"
                      : "border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] hover:border-[color:var(--color-primary-200)]"
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-2)]">
                    Stake
                  </p>
                  <p
                    className={`mt-1 text-lg font-bold ${
                      active ? "text-[color:var(--color-primary)]" : "text-[color:var(--color-ink-0)]"
                    }`}
                  >
                    {s.label} cUSD
                  </p>
                  <p className="text-[11px] text-[color:var(--color-ink-2)]">
                    {formatLocal(s.value, "IDR")}
                  </p>
                </button>
              );
            })}
          </div>

          <h2 className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-2)]">
            Kecepatan
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {TIME_CONTROLS.map((t) => {
              const active = t.value === tc;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTc(t.value)}
                  className={`rounded-full border px-4 py-2 text-sm transition-all ${
                    active
                      ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white"
                      : "border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] text-[color:var(--color-ink-1)] hover:border-[color:var(--color-primary-200)]"
                  }`}
                >
                  <span className="font-semibold">{t.label}</span>
                  <span
                    className={`ml-1.5 text-[11px] ${
                      active ? "text-white/80" : "text-[color:var(--color-ink-2)]"
                    }`}
                  >
                    {t.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="card mt-4 p-4">
          <div className="flex items-center gap-2">
            <SparkleIcon size={16} className="text-[color:var(--color-primary)]" />
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
              Cara Kerja
            </p>
          </div>
          <ul className="mt-2 space-y-1 text-[11px] text-[color:var(--color-ink-2)]">
            <li>· Kedua pemain deposit stake ke MatchEscrow di Celo</li>
            <li>· Pemenang ambil pot minus fee 3%</li>
            <li>· Refund penuh kalau tidak dapat lawan dalam 5 menit</li>
          </ul>
        </section>

        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-primary)] py-4 text-base font-bold text-white shadow-[var(--shadow-glow-primary)] transition-all active:scale-[0.99] disabled:opacity-70"
        >
          {starting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Mencari lawan…
            </>
          ) : (
            <>
              <PlayIcon size={18} />
              Main untuk {formatLocal(stake, "IDR")}
            </>
          )}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[color:var(--color-ink-2)]">
          <BoltIcon size={12} className="text-[color:var(--color-amber)]" />
          Rata-rata dapat lawan · 4 detik
        </p>
      </div>
    </main>
  );
}
