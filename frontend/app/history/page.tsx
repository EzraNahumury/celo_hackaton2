"use client";

import { useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { ChevronRight, SparkleIcon, TrophyIcon } from "@/components/icons";
import { formatLocal } from "@/lib/format";

type Row = {
  id: number;
  kind: "win" | "lose" | "puzzle";
  label: string;
  tag: string;
  delta: number;
  detail: {
    date: string;
    moves?: number;
    duration?: string;
    opening?: string;
    result?: string;
    txHash: string;
    stakeCelo?: number;
    prizeCelo?: number;
  };
};

const ROWS: Row[] = [
  {
    id: 1,
    kind: "win",
    label: "1v1 vs 0x8f…22a1",
    tag: "3+0 · Blitz",
    delta: 0.97,
    detail: {
      date: "18 Apr 2026 · 20:14",
      moves: 42,
      duration: "4m 12s",
      opening: "Sicilian Defense",
      result: "Checkmate",
      stakeCelo: 0.5,
      prizeCelo: 0.97,
      txHash: "0x9a1f…c3d2",
    },
  },
  {
    id: 2,
    kind: "puzzle",
    label: "Puzzle Harian #112",
    tag: "Peringkat #7",
    delta: 0.5,
    detail: {
      date: "18 Apr 2026 · 09:02",
      duration: "1m 48s",
      result: "Solved 5/5",
      prizeCelo: 0.5,
      txHash: "0x44ea…71ab",
    },
  },
  {
    id: 3,
    kind: "lose",
    label: "1v1 vs 0x12…e4b0",
    tag: "3+2 · Blitz",
    delta: -1.0,
    detail: {
      date: "17 Apr 2026 · 21:40",
      moves: 31,
      duration: "3m 05s",
      opening: "Queen's Gambit",
      result: "Resigned",
      stakeCelo: 1.0,
      txHash: "0x7f22…90cc",
    },
  },
  {
    id: 4,
    kind: "win",
    label: "1v1 vs 0x5a…9c22",
    tag: "5+3 · Rapid",
    delta: 1.94,
    detail: {
      date: "17 Apr 2026 · 18:22",
      moves: 58,
      duration: "8m 47s",
      opening: "London System",
      result: "Checkmate",
      stakeCelo: 1.0,
      prizeCelo: 1.94,
      txHash: "0xb301…5e8f",
    },
  },
  {
    id: 5,
    kind: "puzzle",
    label: "Puzzle Harian #111",
    tag: "Peringkat #34",
    delta: 0.12,
    detail: {
      date: "16 Apr 2026 · 10:18",
      duration: "3m 02s",
      result: "Solved 4/5",
      prizeCelo: 0.12,
      txHash: "0x58cd…a112",
    },
  },
];

export default function HistoryPage() {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <>
      <div className="bg-hero rounded-b-[32px] px-5 pt-[max(env(safe-area-inset-top),18px)] pb-10 text-white">
        <header className="flex items-center justify-center">
          <p className="text-sm font-bold">Aktivitas</p>
        </header>
        <div className="mt-6 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/80">
            Total Pendapatan
          </p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight">
            +{formatLocal(12.5, "IDR")}
          </h1>
          <p className="mt-1 text-xs text-white/80">bulan ini · di Celo Mainnet</p>
        </div>
      </div>

      <main className="flex-1 px-5 pb-6">
        <div className="card -mt-6 flex items-center overflow-hidden relative z-10 p-4">
          <Stat label="Menang" value="23" accent="text-[color:var(--color-success)]" />
          <Divider />
          <Stat label="Seri" value="2" accent="text-[color:var(--color-ink-0)]" />
          <Divider />
          <Stat label="Kalah" value="11" accent="text-[color:var(--color-danger)]" />
        </div>

        <ul className="mt-6 flex flex-col gap-2">
          {ROWS.map((r) => {
            const isOpen = openId === r.id;
            return (
              <li key={r.id} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : r.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      r.kind === "puzzle"
                        ? "bg-[color:var(--color-primary-50)] text-[color:var(--color-primary)]"
                        : r.kind === "win"
                        ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
                        : "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]"
                    }`}
                  >
                    {r.kind === "puzzle" ? <SparkleIcon size={18} /> : <TrophyIcon size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[color:var(--color-ink-0)]">
                      {r.label}
                    </p>
                    <p className="text-[11px] text-[color:var(--color-ink-2)]">{r.tag}</p>
                  </div>
                  <p
                    className={`text-sm font-bold ${
                      r.delta >= 0
                        ? "text-[color:var(--color-success)]"
                        : "text-[color:var(--color-danger)]"
                    }`}
                  >
                    {r.delta >= 0 ? "+" : "−"}
                    {formatLocal(Math.abs(r.delta), "IDR")}
                  </p>
                  <span
                    aria-hidden
                    className={`ml-1 text-[color:var(--color-ink-2)] transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  >
                    <ChevronRight size={16} />
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] px-4 py-3">
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
                      <DetailRow label="Tanggal" value={r.detail.date} />
                      {r.detail.result && <DetailRow label="Hasil" value={r.detail.result} />}
                      {r.detail.duration && <DetailRow label="Durasi" value={r.detail.duration} />}
                      {r.detail.moves !== undefined && (
                        <DetailRow label="Langkah" value={`${r.detail.moves}`} />
                      )}
                      {r.detail.opening && <DetailRow label="Pembukaan" value={r.detail.opening} />}
                      {r.detail.stakeCelo !== undefined && (
                        <DetailRow label="Taruhan" value={`${r.detail.stakeCelo} CELO`} />
                      )}
                      {r.detail.prizeCelo !== undefined && (
                        <DetailRow label="Hadiah" value={`${r.detail.prizeCelo} CELO`} />
                      )}
                      <DetailRow label="Tx Hash" value={r.detail.txHash} mono />
                    </dl>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </main>
      <BottomNav />
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-2)]">
        {label}
      </p>
      <p className={`mt-1 text-xl font-extrabold ${accent}`}>{value}</p>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="h-8 w-px shrink-0 bg-[color:var(--color-border)]" />;
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-[color:var(--color-ink-2)]">{label}</dt>
      <dd
        className={`truncate text-right font-semibold text-[color:var(--color-ink-0)] ${
          mono ? "font-mono text-[11px]" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
