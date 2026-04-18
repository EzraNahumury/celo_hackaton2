import Link from "next/link";
import { ChevronLeft, ClubIcon, TrophyIcon } from "@/components/icons";
import { formatCUsd, formatLocal } from "@/lib/format";

const MEMBERS = [
  { name: "Daniel", w: 3, l: 0, earn: 2.8, self: false },
  { name: "Kamu", w: 2, l: 1, earn: 0.8, self: true },
  { name: "Maria", w: 2, l: 1, earn: 0, self: false },
  { name: "Raj", w: 1, l: 2, earn: 0, self: false },
  { name: "Kofi", w: 0, l: 4, earn: 0, self: false },
];

export default function ClubPage() {
  return (
    <main className="flex-1">
      <div className="bg-hero rounded-b-[32px] px-5 pt-[max(env(safe-area-inset-top),18px)] pb-10 text-white">
        <header className="flex items-center justify-between">
          <Link
            href="/home"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
            aria-label="Kembali"
          >
            <ChevronLeft size={18} />
          </Link>
          <p className="text-sm font-bold">Chess Club</p>
          <span className="h-9 w-9" />
        </header>

        <div className="mt-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
            <ClubIcon size={26} />
          </div>
          <h1 className="mt-3 text-2xl font-extrabold">Mathare Knights</h1>
          <p className="text-xs text-white/80">5 / 8 anggota · minggu ke-12</p>
        </div>
      </div>

      <div className="px-5 pb-8">
        <section className="card -mt-6 p-5 relative z-10">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Buy-in" value={formatCUsd(1)} sub={formatLocal(1, "IDR")} />
            <Stat label="Pot" value={formatCUsd(5)} sub={formatLocal(5, "IDR")} />
            <Stat label="Tutup" value="2h 4j" sub="Min 23:59" />
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[color:var(--color-ink-0)]">Klasemen</h2>
            <span className="text-[11px] font-semibold text-[color:var(--color-ink-2)]">
              Split 70 / 20 / 10
            </span>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {MEMBERS.map((m, i) => (
              <li
                key={m.name}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                  m.self
                    ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-50)]"
                    : "border-[color:var(--color-border)] bg-white"
                }`}
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold ${
                    i === 0
                      ? "bg-[color:var(--color-amber-soft)] text-[color:var(--color-amber)]"
                      : "bg-[color:var(--color-sky-100)] text-[color:var(--color-ink-2)]"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-bold text-[color:var(--color-ink-0)]">
                    {m.name}
                  </p>
                  <p className="text-[11px] text-[color:var(--color-ink-2)]">
                    {m.w}M · {m.l}K
                  </p>
                </div>
                {m.earn > 0 && (
                  <p className="flex items-center gap-1 text-sm font-bold text-[color:var(--color-success)]">
                    <TrophyIcon size={14} />+{formatLocal(m.earn, "IDR")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <button
          type="button"
          className="mt-7 w-full rounded-2xl bg-[color:var(--color-primary)] py-4 text-base font-bold text-white shadow-[var(--shadow-glow-primary)] active:scale-[0.99]"
        >
          Main Babak Berikutnya
        </button>
      </div>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-[color:var(--color-surface-soft)] px-3 py-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-2)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-[color:var(--color-ink-0)]">{value}</p>
      <p className="text-[10px] text-[color:var(--color-ink-2)]">{sub}</p>
    </div>
  );
}
