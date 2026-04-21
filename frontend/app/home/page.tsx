"use client";

import Image from "next/image";
import Link from "next/link";
import { useBalance } from "wagmi";
import { BottomNav } from "@/components/bottom-nav";
import {
  ClubIcon,
  PuzzleIcon,
  SwordsIcon,
  TrophyIcon,
} from "@/components/icons";
import { useWallet } from "@/hooks/use-connect";
import { usePlayerStats } from "@/hooks/use-player-stats";
import { ACTIVE_CHAIN } from "@/lib/contracts";
import { formatCeloWei, truncateAddress, weiToLocal } from "@/lib/format";

export default function HomePage() {
  const { address, isConnected, connect, isConnecting } = useWallet();
  const { data: bal } = useBalance({
    address,
    query: { enabled: !!address },
  });
  const { entry: stats } = usePlayerStats(address);

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
            aria-label="Profile"
            className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white justify-self-end"
          >
            <Image
              src="/logo.png"
              alt="Gambit"
              width={56}
              height={56}
              priority
              className="h-full w-full scale-125 object-contain"
            />
          </Link>
        </header>

        <section className="mt-6 text-center fade-in-up">
          <p className="text-sm font-medium text-white/85">Wallet Balance</p>
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
              {isConnecting ? "Connecting…" : "Connect MiniPay"}
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
            <QuickLink href="/play" label="1v1 Match" Icon={SwordsIcon} variant="primary" />
            <QuickLink href="/lobby" label="Lobby" Icon={TrophyIcon} variant="sky" />
            <QuickLink href="/puzzle" label="Puzzle" Icon={PuzzleIcon} variant="primary" />
            <QuickLink href="/club" label="Club" Icon={ClubIcon} variant="sky" />
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-bold text-[color:var(--color-ink-0)]">
            Gambit Contracts
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <ContractTile name="MatchEscrow" desc="1v1 stake + payout" href="/play" />
            <ContractTile name="PuzzlePool" desc="Daily Merkle claim" href="/puzzle" />
            <ContractTile name="ClubVault" desc="Weekly 4–8 members" href="/club" />
            <ContractTile name="GambitBadges" desc="Soulbound ERC-5192" href="/profile" />
          </div>
        </section>

        {isConnected && stats && (
          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[color:var(--color-ink-0)]">
                Statistics
              </h2>
              <Link
                href="/history"
                className="text-xs font-medium text-[color:var(--color-primary)]"
              >
                See All
              </Link>
            </div>
            <div className="card mt-3 flex items-center gap-3 px-4 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--color-primary-50)] text-[color:var(--color-primary)]">
                <TrophyIcon size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
                  Rating {stats.rating} · Rank #{stats.rank}
                </p>
                <p className="text-[11px] text-[color:var(--color-ink-2)]">
                  {stats.wins}W · {stats.draws}D · {stats.losses}L
                </p>
              </div>
              <p className="text-sm font-bold text-[color:var(--color-success)]">
                {Number(stats.totalEarned).toFixed(2)} CELO
              </p>
            </div>
          </section>
        )}
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
