import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import {
  ClubIcon,
  PuzzleIcon,
  SparkleIcon,
  SwordsIcon,
  TrophyIcon,
} from "@/components/icons";
import { formatCUsd, formatLocal } from "@/lib/format";

const MOCK_BALANCE_CUSD = 5.2;

const RECENT = [
  { id: 1, label: "Menang vs 0x8f…22a1", delta: 0.97, tag: "1v1 · 3+0", kind: "win" as const },
  { id: 2, label: "Puzzle harian terselesaikan", delta: 0.5, tag: "Peringkat #7", kind: "puzzle" as const },
];

export default function HomePage() {
  return (
    <>
      <div className="bg-hero rounded-b-[32px] px-5 pt-[max(env(safe-area-inset-top),20px)] pb-8 text-white">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            <span className="text-xs font-medium">Online</span>
          </div>
          <p className="text-lg font-extrabold tracking-tight">Gambit</p>
          <button
            type="button"
            aria-label="Notifikasi"
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
          >
            <BellIcon />
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--color-danger)] text-[9px] font-bold text-white">
              3
            </span>
          </button>
        </header>

        <section className="mt-6 text-center fade-in-up">
          <p className="text-sm font-medium text-white/85">Saldo Dompet</p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight">
              {formatLocal(MOCK_BALANCE_CUSD, "IDR")}
            </h1>
            <EyeIcon />
          </div>
          <p className="mt-1 text-[11px] text-white/75">≈ {formatCUsd(MOCK_BALANCE_CUSD)} · Celo Mainnet</p>
          <Link
            href="/profile"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/10 px-4 py-2 text-xs font-medium backdrop-blur-sm"
          >
            Dompet Lain
          </Link>
        </section>
      </div>

      <main className="flex-1 px-5 pb-4">
        <section className="card -mt-6 p-4 relative z-10 fade-in-up">
          <div className="grid grid-cols-4 gap-2">
            <QuickLink href="/play" label="Main 1v1" Icon={SwordsIcon} variant="primary" />
            <QuickLink href="/puzzle" label="Puzzle" Icon={PuzzleIcon} variant="sky" />
            <QuickLink href="/club" label="Klub" Icon={ClubIcon} variant="primary" />
            <QuickLink href="/history" label="Riwayat" Icon={TrophyIcon} variant="sky" />
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-bold text-[color:var(--color-ink-0)]">Dompet Digital</h2>
          <div className="mt-3 flex gap-3 overflow-x-auto scrollbar-none">
            <WalletCard name="MiniPay" status="Terhubung" tone="connected" />
            <WalletCard name="cUSD" status="Saldo" tone="balance" value={formatCUsd(MOCK_BALANCE_CUSD)} />
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[color:var(--color-ink-0)]">Catatan Main</h2>
            <Link href="/history" className="text-xs font-medium text-[color:var(--color-primary)]">
              Lihat Detail
            </Link>
          </div>
          <div className="card mt-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCell
                tone="success"
                label="Menang"
                value="23"
                sub={`+${formatLocal(12.5, "IDR")}`}
              />
              <StatCell
                tone="danger"
                label="Kalah"
                value="11"
                sub={`−${formatLocal(4.2, "IDR")}`}
              />
            </div>
            <div className="mt-3 rounded-2xl bg-[color:var(--color-sky-50)] px-4 py-3 text-center">
              <p className="text-[11px] text-[color:var(--color-ink-2)]">Total Selisih</p>
              <p className="mt-0.5 text-lg font-bold text-[color:var(--color-primary)]">
                +{formatLocal(8.3, "IDR")}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-bold text-[color:var(--color-ink-0)]">Aktivitas Terakhir</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {RECENT.map((r) => (
              <li
                key={r.id}
                className="card flex items-center gap-3 px-4 py-3"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    r.kind === "win"
                      ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
                      : "bg-[color:var(--color-primary-50)] text-[color:var(--color-primary)]"
                  }`}
                >
                  {r.kind === "win" ? <TrophyIcon size={18} /> : <SparkleIcon size={18} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-[color:var(--color-ink-0)]">
                    {r.label}
                  </p>
                  <p className="text-[11px] text-[color:var(--color-ink-2)]">{r.tag}</p>
                </div>
                <p className="text-sm font-bold text-[color:var(--color-success)]">
                  +{formatLocal(r.delta, "IDR")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <BottomNav />
    </>
  );
}

function QuickLink({
  href,
  label,
  Icon,
  variant,
}: {
  href: string;
  label: string;
  Icon: (p: { size?: number; className?: string }) => React.ReactElement;
  variant: "primary" | "sky";
}) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5 active:scale-[0.96] transition-transform">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
          variant === "primary"
            ? "bg-[color:var(--color-primary)] text-white"
            : "bg-[color:var(--color-primary-100)] text-[color:var(--color-primary-dark)]"
        }`}
      >
        <Icon size={22} />
      </span>
      <span className="text-[11px] font-semibold text-[color:var(--color-ink-1)] leading-tight text-center">
        {label}
      </span>
    </Link>
  );
}

function WalletCard({
  name,
  status,
  tone,
  value,
}: {
  name: string;
  status: string;
  tone: "connected" | "balance";
  value?: string;
}) {
  return (
    <div className="card flex min-w-[240px] items-center gap-3 px-4 py-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--color-primary-50)] text-[color:var(--color-primary)]">
        <WalletIcon />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[color:var(--color-ink-0)]">{name}</p>
        <p
          className={`text-[11px] font-medium ${
            tone === "connected"
              ? "text-[color:var(--color-primary)]"
              : "text-[color:var(--color-ink-2)]"
          }`}
        >
          {value ?? status}
        </p>
      </div>
    </div>
  );
}

function StatCell({
  tone,
  label,
  value,
  sub,
}: {
  tone: "success" | "danger";
  label: string;
  value: string;
  sub: string;
}) {
  const color =
    tone === "success"
      ? "text-[color:var(--color-success)]"
      : "text-[color:var(--color-danger)]";
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] px-4 py-3">
      <div className="flex items-center gap-1 text-[11px] font-medium text-[color:var(--color-ink-2)]">
        <span className={color}>{tone === "success" ? "↓" : "↑"}</span>
        {label}
      </div>
      <p className="mt-1 text-lg font-bold text-[color:var(--color-ink-0)]">{value}</p>
      <p className={`text-[11px] font-semibold ${color}`}>{sub}</p>
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9Z" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h13v4H5a2 2 0 0 1-2-2Z" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8H5" />
      <circle cx="17" cy="13" r="1.2" fill="currentColor" />
    </svg>
  );
}
