"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useBalance } from "wagmi";
import { BottomNav } from "@/components/bottom-nav";
import { TxExplorerLink, useTxStatus } from "@/components/tx-status";
import { useToast } from "@/components/toast";
import { BoltIcon, ClubIcon, PuzzleIcon, SwordsIcon, TrophyIcon } from "@/components/icons";
import { useStakeTokenBalance, useStakeTokenFaucet } from "@/hooks/use-stake-token";
import { useWallet } from "@/hooks/use-connect";
import { usePlayerStats } from "@/hooks/use-player-stats";
import { ACTIVE_CHAIN, STAKE_TOKEN, STAKE_TOKEN_CONFIGURED } from "@/lib/contracts";
import { formatCeloWei, formatCusd, formatStableLocal, truncateAddress } from "@/lib/format";

export default function HomePage() {
  const { address, isConnected, connect, isConnecting } = useWallet();
  const toast = useToast();
  const { requestFaucet, isPending: faucetPending } = useStakeTokenFaucet();
  const [faucetHash, setFaucetHash] = useState<`0x${string}` | undefined>();
  const { status: faucetStatus } = useTxStatus(faucetHash);

  const { data: gasBal } = useBalance({
    address,
    query: { enabled: !!address },
  });
  const { data: stakeBal, refetch: refetchBalance } = useStakeTokenBalance(address);
  const { entry: stats } = usePlayerStats(address);
  const stakeAmount = stakeBal !== undefined ? Number(formatUnits(stakeBal, 18)) : null;

  useEffect(() => {
    if (faucetStatus === "success") {
      refetchBalance();
    }
  }, [faucetStatus, refetchBalance]);

  const onRequestFaucet = async () => {
    if (!isConnected) {
      connect();
      return;
    }
    try {
      const hash = await requestFaucet();
      setFaucetHash(hash);
      toast.show({
        title: "Faucet requested",
        message: `${STAKE_TOKEN.faucetAmount} ${STAKE_TOKEN.symbol} is being minted to your wallet.`,
        hint: "Wait for the transaction to confirm, then the balance will refresh.",
        tone: "info",
      });
    } catch (e) {
      toast.showError(e);
    }
  };

  return (
    <>
      <div className="bg-hero rounded-b-[32px] px-5 pt-[max(env(safe-area-inset-top),20px)] pb-8 text-white">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center justify-self-start gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-emerald-300" : "bg-amber-300"
              }`}
            />
            <span className="text-xs font-medium">{ACTIVE_CHAIN.name}</span>
          </div>
          <p className="text-center text-lg font-extrabold tracking-tight">Gambit</p>
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
          <p className="text-sm font-medium text-white/85">{STAKE_TOKEN.symbol} Balance</p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight">
              {stakeAmount !== null ? formatCusd(stakeAmount, 2) : "-"}
            </h1>
          </div>
          <p className="mt-1 text-[11px] text-white/75">
            {stakeAmount !== null
              ? `~ ${formatStableLocal(stakeAmount, "IDR")}`
              : `${STAKE_TOKEN.name} - ${ACTIVE_CHAIN.name}`}
          </p>

          {!isConnected ? (
            <button
              type="button"
              onClick={connect}
              disabled={isConnecting}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-[color:var(--color-primary-dark)]"
            >
              {isConnecting ? "Connecting..." : "Connect MiniPay"}
            </button>
          ) : (
            <>
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/10 px-4 py-2 font-mono text-[11px] font-medium backdrop-blur-sm">
                {truncateAddress(address!)}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-3 py-2 font-semibold text-white/90">
                  <BoltIcon size={12} />
                  Gas: {gasBal ? formatCeloWei(gasBal.value, 3) : "-"}
                </span>

                {STAKE_TOKEN.faucetEnabled && STAKE_TOKEN_CONFIGURED && (
                  <button
                    type="button"
                    onClick={onRequestFaucet}
                    disabled={faucetPending || faucetStatus === "pending"}
                    className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-[color:var(--color-primary-dark)] disabled:opacity-70"
                  >
                    {faucetPending || faucetStatus === "pending"
                      ? "Requesting faucet..."
                      : `Claim ${STAKE_TOKEN.faucetAmount} ${STAKE_TOKEN.symbol}`}
                  </button>
                )}
              </div>

              {STAKE_TOKEN.faucetEnabled && (
                <p className="mt-2 text-[11px] text-white/75">
                  Sepolia faucet: {STAKE_TOKEN.faucetAmount} {STAKE_TOKEN.symbol} per wallet every 24h
                </p>
              )}

              {faucetHash && (
                <p className="mt-2 text-center">
                  <TxExplorerLink hash={faucetHash} />
                </p>
              )}
            </>
          )}
        </section>
      </div>

      <main className="flex-1 px-5 pb-4">
        <section className="card relative z-10 -mt-6 p-4 fade-in-up">
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
            <ContractTile name="MatchEscrow" desc="1v1 cUSD stake + payout" href="/play" />
            <ContractTile name="PuzzlePool" desc="Daily Merkle claim" href="/puzzle" />
            <ContractTile name="ClubVault" desc="Weekly 4-8 members" href="/club" />
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
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
                  Rating {stats.rating} - Rank #{stats.rank}
                </p>
                <p className="text-[11px] text-[color:var(--color-ink-2)]">
                  {stats.wins}W - {stats.draws}D - {stats.losses}L
                </p>
              </div>
              <p className="text-sm font-bold text-[color:var(--color-success)]">
                {Number(stats.totalEarned).toFixed(2)} {STAKE_TOKEN.symbol}
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
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 transition-transform active:scale-[0.96]"
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
          variant === "primary"
            ? "bg-[color:var(--color-primary)] text-white"
            : "bg-[color:var(--color-primary-100)] text-[color:var(--color-primary-dark)]"
        }`}
      >
        <Icon size={22} />
      </span>
      <span className="text-center text-[11px] font-semibold leading-tight text-[color:var(--color-ink-1)]">
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
