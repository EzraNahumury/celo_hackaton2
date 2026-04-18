import { BottomNav } from "@/components/bottom-nav";
import { SparkleIcon, TrophyIcon } from "@/components/icons";
import { formatLocal } from "@/lib/format";

const ROWS = [
  { id: 1, kind: "win", label: "1v1 vs 0x8f…22a1", tag: "3+0 · Blitz", delta: 0.97 },
  { id: 2, kind: "puzzle", label: "Puzzle Harian #112", tag: "Peringkat #7", delta: 0.5 },
  { id: 3, kind: "lose", label: "1v1 vs 0x12…e4b0", tag: "3+2 · Blitz", delta: -1.0 },
  { id: 4, kind: "win", label: "1v1 vs 0x5a…9c22", tag: "5+3 · Rapid", delta: 1.94 },
  { id: 5, kind: "puzzle", label: "Puzzle Harian #111", tag: "Peringkat #34", delta: 0.12 },
];

export default function HistoryPage() {
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
        <div className="card -mt-6 grid grid-cols-3 gap-0 overflow-hidden relative z-10 p-4">
          <Stat label="Menang" value="23" accent="text-[color:var(--color-success)]" />
          <Divider />
          <Stat label="Kalah" value="11" accent="text-[color:var(--color-danger)]" />
          <Divider />
          <Stat label="Seri" value="2" accent="text-[color:var(--color-ink-0)]" />
        </div>

        <ul className="mt-6 flex flex-col gap-2">
          {ROWS.map((r) => (
            <li key={r.id} className="card flex items-center gap-3 px-4 py-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  r.kind === "puzzle"
                    ? "bg-[color:var(--color-primary-50)] text-[color:var(--color-primary)]"
                    : r.kind === "win"
                    ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
                    : "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]"
                }`}
              >
                {r.kind === "puzzle" ? <SparkleIcon size={18} /> : <TrophyIcon size={18} />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-bold text-[color:var(--color-ink-0)]">{r.label}</p>
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
            </li>
          ))}
        </ul>
      </main>
      <BottomNav />
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-2)]">
        {label}
      </p>
      <p className={`mt-1 text-xl font-extrabold ${accent}`}>{value}</p>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="mx-auto h-8 w-px self-center bg-[color:var(--color-border)]" />;
}
