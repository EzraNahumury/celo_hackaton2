"use client";

import Image from "next/image";
import Link from "next/link";
import { formatUnits } from "viem";
import { useBalance } from "wagmi";
import { BottomNav } from "@/components/bottom-nav";
import { BoltIcon, BotIcon, ClubIcon, PuzzleIcon, SparkleIcon, TrophyIcon } from "@/components/icons";
import { useStakeTokenBalance } from "@/hooks/use-stake-token";
import { useWallet } from "@/hooks/use-connect";
import { usePlayerHistory } from "@/hooks/use-player-history";
import { usePlayerStats } from "@/hooks/use-player-stats";
import { usePuzzleHistory } from "@/hooks/use-puzzle-history";
import { ACTIVE_CHAIN, STAKE_TOKEN } from "@/lib/contracts";
import { formatCeloWei, formatCusd, truncateAddress } from "@/lib/format";
import type { PlayerGameRow, PlayerTransactionRow, PuzzleSessionRow } from "@/types/api";

export default function HomePage() {
  const { address, isConnected, connect, isConnecting } = useWallet();

  const { data: gasBal } = useBalance({
    address,
    query: { enabled: !!address },
  });
  const { data: stakeBal } = useStakeTokenBalance(address);
  const { entry: stats } = usePlayerStats(address);
  const { games, transactions } = usePlayerHistory(address, 5);
  const { sessions: puzzleSessions } = usePuzzleHistory(address, 5);
  const stakeAmount = stakeBal !== undefined ? Number(formatUnits(stakeBal, 18)) : null;

  // Merge recent matches + puzzle sessions, sort newest first, take 5
  type ActivityItem =
    | { kind: "match"; date: string; game: PlayerGameRow; txs: PlayerTransactionRow[] }
    | { kind: "puzzle"; date: string; session: PuzzleSessionRow };

  const recentActivity: ActivityItem[] = isConnected
    ? [
        ...games.map((g) => ({ kind: "match" as const, date: g.created_at, game: g, txs: transactions })),
        ...puzzleSessions.filter((s) => s.prize_paid).map((s) => ({ kind: "puzzle" as const, date: s.created_at, session: s })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5)
    : [];

  return (
    <>
      <div className="bg-hero rounded-b-[32px] px-5 pt-[max(env(safe-area-inset-top),20px)] pb-8 text-white">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center justify-self-start gap-2">
            <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-300" : "bg-amber-300"}`} />
            <span className="text-xs font-medium">{ACTIVE_CHAIN.name}</span>
          </div>
          <p className="text-center text-lg font-extrabold tracking-tight">Gambit</p>
          <Link
            href="/profile"
            aria-label="Profile"
            className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white justify-self-end">
            <Image src="/logo-new.png" alt="Gambit" width={56} height={56} priority className="h-full w-full scale-125 object-contain" />
          </Link>
        </header>

        <section className="mt-6 text-center fade-in-up">
          <p className="text-sm font-medium text-white/85">{STAKE_TOKEN.symbol} Balance</p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight">{stakeAmount !== null ? formatCusd(stakeAmount, 2) : "-"}</h1>
          </div>
          <p className="mt-1 text-[11px] text-white/75">
            {STAKE_TOKEN.name} · {ACTIVE_CHAIN.name}
          </p>

          {!isConnected ? (
            <button
              type="button"
              onClick={connect}
              disabled={isConnecting}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-[color:var(--color-primary-dark)]">
              {isConnecting ? "Connecting..." : "Connect MiniPay"}
            </button>
          ) : (
            <>
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/10 px-4 py-2 font-mono text-[11px] font-medium backdrop-blur-sm">
                {truncateAddress(address!)}
              </p>

              {/* <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-3 py-2 font-semibold text-white/90">
                  <BoltIcon size={12} />
                  Gas: {gasBal ? formatCeloWei(gasBal.value, 3) : "-"}
                </span>
              </div> */}
            </>
          )}
        </section>
      </div>

      <main className="flex-1 px-5 pb-4">
        <section className="card relative z-10 -mt-6 p-4 fade-in-up">
          <div className="grid grid-cols-3 gap-2">
            <QuickLink href="/vs-master" label="vs Master" Icon={BotIcon} variant="primary" />
            <QuickLink href="/puzzle" label="Puzzle" Icon={PuzzleIcon} variant="sky" />
            <QuickLink href="/club" label="Club" Icon={ClubIcon} variant="primary" />
          </div>
        </section>

        {/* <section className="mt-6">
          <h2 className="text-base font-bold text-[color:var(--color-ink-0)]">Gambit Contracts</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <ContractTile name="DailyPuzzlePool" desc="AI & Puzzle prizes" href="/vs-master" />
            <ContractTile name="PuzzlePool" desc="Daily Merkle claim" href="/puzzle" />
            <ContractTile name="ClubVault" desc="Weekly 4-8 members" href="/club" />
            <ContractTile name="GambitBadges" desc="Soulbound ERC-5192" href="/profile" />
          </div>
        </section> */}

        {isConnected && (
          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[color:var(--color-ink-0)]">Recent Activity</h2>
            </div>
            <div className="card mt-3 overflow-hidden divide-y divide-[color:var(--color-border)]">
              {recentActivity.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center">
                  <SparkleIcon size={22} className="text-[color:var(--color-ink-3)]" />
                  <p className="text-xs text-[color:var(--color-ink-2)]">No activity yet. Play a match or solve a puzzle!</p>
                </div>
              ) : (
                recentActivity.map((item, i) =>
                  item.kind === "match" ? (
                    <RecentMatchRow key={`m-${item.game.id}`} game={item.game} txs={item.txs} address={address!} />
                  ) : (
                    <RecentPuzzleRow key={`p-${item.session.id}`} session={item.session} />
                  )
                )
              )}
              <Link
                href="/history"
                className="flex items-center justify-center py-3 text-xs font-bold text-[color:var(--color-primary)]"
              >
                See all activity →
              </Link>
            </div>
          </section>
        )}
      </main>
      <BottomNav />
    </>
  );
}

function RecentMatchRow({
  game,
  txs,
  address,
}: {
  game: PlayerGameRow;
  txs: PlayerTransactionRow[];
  address: string;
}) {
  const related = txs.filter((t) => t.game_id === game.id);
  const payoutTx = related.find((t) => t.tx_type === "payout");
  const depositTx = related.find((t) => t.tx_type === "deposit");

  let kind: "win" | "lose" | "draw" | "pending" = "pending";
  if (game.status === "completed") {
    if (game.result === "draw" || game.result === "abort") kind = "draw";
    else if (
      game.winner_address?.toLowerCase() === address.toLowerCase() ||
      (game.result === "white_win" && game.playerColor === "white") ||
      (game.result === "black_win" && game.playerColor === "black")
    ) kind = "win";
    else kind = "lose";
  } else if (game.status === "cancelled" || game.status === "expired") {
    kind = "draw";
  }

  const chipClass =
    kind === "win" ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
    : kind === "lose" ? "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]"
    : "bg-[color:var(--color-surface-soft)] text-[color:var(--color-ink-2)]";

  const deposit = Number(depositTx?.amount ?? (game.mode === "bot" ? 0 : game.stake_amount ?? 0));
  const payout = Number(payoutTx?.amount ?? 0);
  const net = kind === "win" ? payout - deposit : kind === "lose" ? -deposit : 0;

  const label = game.mode === "bot"
    ? `vs Bot · ${game.time_control}`
    : `1v1 vs ${game.opponent ? truncateAddress(game.opponent) : "—"}`;

  const statusLabel = kind === "win" ? "Win" : kind === "lose" ? "Loss" : kind === "draw" ? "Draw" : game.status;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${chipClass}`}>
        <TrophyIcon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[color:var(--color-ink-0)]">{label}</p>
        <p className="text-[11px] text-[color:var(--color-ink-2)]">{statusLabel}</p>
      </div>
      {net !== 0 && (
        <p className={`text-xs font-bold ${net > 0 ? "text-[color:var(--color-success)]" : "text-[color:var(--color-danger)]"}`}>
          {net > 0 ? "+" : "−"}{formatCusd(Math.abs(net))}
        </p>
      )}
    </div>
  );
}

function RecentPuzzleRow({ session }: { session: PuzzleSessionRow }) {
  const { correct, prize_paid, used_hint } = session;
  const chipClass = prize_paid
    ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
    : correct
      ? "bg-[color:var(--color-primary-50)] text-[color:var(--color-primary)]"
      : "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]";

  const statusLabel = prize_paid
    ? "Prize earned"
    : correct && used_hint
      ? "Correct (hint)"
      : correct
        ? "Correct"
        : "Incorrect";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${chipClass}`}>
        <PuzzleIcon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[color:var(--color-ink-0)]">Daily Puzzle</p>
        <p className="text-[11px] text-[color:var(--color-ink-2)]">{statusLabel}</p>
      </div>
      {prize_paid && (
        <p className="text-xs font-bold text-[color:var(--color-success)]">
          +{formatCusd(0.01)}
        </p>
      )}
    </div>
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
    <Link href={href} className="flex flex-col items-center gap-1.5 transition-transform active:scale-[0.96]">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
          variant === "primary" ? "bg-[color:var(--color-primary)] text-white" : "bg-[color:var(--color-primary-100)] text-[color:var(--color-primary-dark)]"
        }`}>
        <Icon size={22} />
      </span>
      <span className="text-center text-[11px] font-semibold leading-tight text-[color:var(--color-ink-1)]">{label}</span>
    </Link>
  );
}

function ContractTile({ name, desc, href }: { name: string; desc: string; href: string }) {
  return (
    <Link href={href} className="card flex flex-col gap-1 p-4 transition-transform active:scale-[0.98]">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-primary)]">{name}.sol</p>
      <p className="text-[11px] text-[color:var(--color-ink-2)]">{desc}</p>
    </Link>
  );
}
