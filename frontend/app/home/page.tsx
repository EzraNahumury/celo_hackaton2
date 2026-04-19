"use client";

import Link from "next/link";
import { useBalance } from "wagmi";
import { BottomNav } from "@/components/bottom-nav";
import {
  ClubIcon,
  PuzzleIcon,
  SparkleIcon,
  SwordsIcon,
  TrophyIcon,
} from "@/components/icons";
import { useWallet } from "@/hooks/use-connect";
import { ACTIVE_CHAIN } from "@/lib/contracts";
import { formatCeloWei, truncateAddress, weiToLocal } from "@/lib/format";

const MOCK_RECENT = [
  { id: 1, label: "Menang vs 0x8f…22a1", tag: "MatchEscrow · #12", kind: "win" as const, deltaCelo: 0.97 },
  { id: 2, label: "Claim Puzzle day 19834", tag: "PuzzlePool", kind: "puzzle" as const, deltaCelo: 0.5 },
];

export default function HomePage() {
  const { address, isConnected, connect, isConnecting } = useWallet();
  const { data: bal } = useBalance({
    address,
    query: { enabled: !!address },
  });

  return (
    <>
      <div className="bg-hero rounded-b-[32px] px-5 pt-[max(env(safe-area-inset-top),20px)] pb-8 text-white">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center gap-2 justify-self-start">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-emerald-300" : "bg-amber-300"
              }`}
            />
            <span className="text-xs font-medium">
              {ACTIVE_CHAIN.name}
            </span>
          </div>
          <p className="text-lg font-extrabold tracking-tight text-center">Gambit</p>
          <Link
            href="/profile"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold justify-self-end"
          >
            {address ? address.slice(2, 4).toUpperCase() : "—"}
          </Link>
        </header>

        <section className="mt-6 text-center fade-in-up">
          <p className="text-sm font-medium text-white/85">Saldo Wallet</p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight">
              {bal ? weiToLocal(bal.value) : "—"}
            </h1>
          </div>
          <p className="mt-1 text-[11px] text-white/75">
            {bal ? `≈ ${formatCeloWei(bal.value, 3)}` : "MiniPay · Celo"}
          </p>
          {!isConnected ? (
            <button
              type="button"
              onClick={connect}
              disabled={isConnecting}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-[color:var(--color-primary-dark)]"
            >
              {isConnecting ? "Menghubungkan…" : "Connect MiniPay"}
            </button>
          ) : (
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/10 px-4 py-2 text-[11px] font-medium backdrop-blur-sm font-mono">
              {truncateAddress(address!)}
            </p>
          )}
        </section>
      </div>

      <main className="flex-1 px-5 pb-4">
        <section className="card -mt-6 p-4 relative z-10 fade-in-up">
          <div className="grid grid-cols-4 gap-2">
            <QuickLink href="/play" label="Main 1v1" Icon={SwordsIcon} variant="primary" />
            <QuickLink href="/lobby" label="Lobby" Icon={TrophyIcon} variant="sky" />
            <QuickLink href="/puzzle" label="Puzzle" Icon={PuzzleIcon} variant="primary" />
            <QuickLink href="/club" label="Klub" Icon={ClubIcon} variant="sky" />
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-bold text-[color:var(--color-ink-0)]">
            Kontrak Gambit
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <ContractTile name="MatchEscrow" desc="Stake 1v1 + payout" href="/play" />
            <ContractTile name="PuzzlePool" desc="Merkle claim harian" href="/puzzle" />
            <ContractTile name="ClubVault" desc="Weekly 4–8 member" href="/club" />
            <ContractTile name="GambitBadges" desc="Soulbound ERC-5192" href="/profile" />
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[color:var(--color-ink-0)]">Aktivitas Terakhir</h2>
            <Link href="/history" className="text-xs font-medium text-[color:var(--color-primary)]">
              Lihat Semua
            </Link>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {MOCK_RECENT.map((r) => (
              <li key={r.id} className="card flex items-center gap-3 px-4 py-3">
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
                  <p className="truncate text-sm font-bold text-[color:var(--color-ink-0)]">
                    {r.label}
                  </p>
                  <p className="text-[11px] text-[color:var(--color-ink-2)]">{r.tag}</p>
                </div>
                <p className="text-sm font-bold text-[color:var(--color-success)]">
                  +{r.deltaCelo.toFixed(2)} CELO
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

function ContractTile({ name, desc, href }: { name: string; desc: string; href: string }) {
  return (
    <Link
      href={href}
      className="card flex flex-col gap-1 p-4 transition-transform active:scale-[0.98]"
    >
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-primary)]">
        {name}.sol
      </p>
      <p className="text-[11px] text-[color:var(--color-ink-2)]">{desc}</p>
    </Link>
  );
}
