"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePublicClient } from "wagmi";
import { TxExplorerLink, useTxStatus } from "@/components/tx-status";
import { BoltIcon, ChevronLeft, PlayIcon, SparkleIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { useWallet } from "@/hooks/use-connect";
import { useCreateMatch } from "@/hooks/use-match-escrow";
import { useSession } from "@/hooks/use-session";
import { useApproveStakeToken } from "@/hooks/use-stake-token";
import { api } from "@/lib/api";
import { ACTIVE_CHAIN, CONTRACTS, MATCH_FEE_BPS, STAKE_TOKEN, tcLabelToSeconds } from "@/lib/contracts";
import { formatCusd, formatStableLocal, truncateAddress } from "@/lib/format";
import type { StakeAmount, TimeControl } from "@/types/api";

const STAKES = [
  { value: 0.5, label: "0.50", code: "0.50" as StakeAmount },
  { value: 1.0, label: "1.00", code: "1.00" as StakeAmount },
  { value: 2.0, label: "2.00", code: "2.00" as StakeAmount },
] as const;

const TIME_CONTROLS = [
  { value: "1+0", label: "Bullet", sub: "1 min" },
  { value: "3+0", label: "Blitz", sub: "3 min" },
  { value: "3+2", label: "Blitz+2", sub: "3 + 2" },
  { value: "5+3", label: "Rapid", sub: "5 + 3" },
] as const;

type Phase = "idle" | "approve" | "deposit";

export default function PlayPage() {
  const router = useRouter();
  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN.id });
  const { address, isConnected, connect, isConnecting } = useWallet();
  const { token, loading: authLoading } = useSession();
  const { approve, isPending: approving } = useApproveStakeToken();
  const { createMatch, isPending: creating } = useCreateMatch();
  const toast = useToast();

  const [stake, setStake] = useState<number>(1.0);
  const [tc, setTc] = useState<string>("3+0");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { status } = useTxStatus(txHash);

  const pot = stake * 2;
  const fee = (pot * MATCH_FEE_BPS) / 10_000;
  const potential = pot - fee;

  const waitForReceipt = async (hash: `0x${string}`) => {
    if (!publicClient) throw new Error("Wallet RPC client is not ready");
    await publicClient.waitForTransactionReceipt({ hash });
  };

  const onCreate = async () => {
    if (!isConnected) {
      connect();
      return;
    }
    if (!token) {
      toast.show({
        title: "Session not ready",
        message: "Wait for backend login to finish then try again.",
        tone: "info",
      });
      return;
    }

    const stakeCode = STAKES.find((s) => s.value === stake)?.code ?? "1.00";
    setBusy(true);
    setPhase("idle");

    try {
      const game = await api.createGame({
        stake: stakeCode,
        timeControl: tc as TimeControl,
        color: "random",
        mode: "pvp",
      });

      const depositTx = game.depositTx;
      if (!depositTx || depositTx.functionName !== "createMatch") {
        throw new Error("Backend did not return createMatch instructions");
      }

      const escrowAddress = depositTx.to ?? CONTRACTS.matchEscrow;
      const timeControlSeconds = Number(depositTx.args[0]);

      if (!escrowAddress || escrowAddress.length !== 42 || escrowAddress === "0x") {
        throw new Error("MatchEscrow address is missing");
      }
      if (!Number.isFinite(timeControlSeconds) || timeControlSeconds <= 0) {
        throw new Error("Backend returned an invalid time control");
      }

      setPhase("approve");
      const approveHash = await approve({
        tokenAddress: depositTx.tokenAddress,
        spender: escrowAddress,
        amountWei: BigInt(depositTx.amount),
      });
      setTxHash(approveHash);
      await waitForReceipt(approveHash);

      setPhase("deposit");
      const createHash = await createMatch({
        escrowAddress,
        timeControlSeconds,
      });
      setTxHash(createHash);
      await waitForReceipt(createHash);

      router.push(`/game?id=${encodeURIComponent(game.gameId)}`);
    } catch (e) {
      const err = e as { code?: string; data?: { gameId?: string } };
      if (err.code === "ACTIVE_GAME_EXISTS" && err.data?.gameId) {
        router.push(`/game?id=${encodeURIComponent(err.data.gameId)}`);
        return;
      }
      toast.showError(e);
    } finally {
      setPhase("idle");
      setBusy(false);
    }
  };

  const working =
    busy || approving || creating || isConnecting || authLoading || status === "pending";

  const btnLabel = !isConnected
    ? "Connect MiniPay"
    : authLoading
    ? "Signing in..."
    : phase === "approve" && status === "pending"
    ? "Approval pending..."
    : phase === "approve" || approving
    ? `Approving ${STAKE_TOKEN.symbol}...`
    : phase === "deposit" && status === "pending"
    ? "Deposit pending..."
    : phase === "deposit"
    ? "Confirm deposit in wallet..."
    : busy || creating
    ? "Creating match..."
    : `Create match - ${formatStableLocal(stake, "IDR")}`;

  return (
    <main className="flex-1">
      <div className="bg-hero rounded-b-[32px] px-5 pt-[max(env(safe-area-inset-top),18px)] pb-8 text-white">
        <header className="flex items-center justify-between">
          <Link
            href="/home"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
            aria-label="Back"
          >
            <ChevronLeft size={18} />
          </Link>
          <p className="text-sm font-bold">1v1 Match</p>
          <Link
            href="/lobby"
            className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold"
          >
            Lobby
          </Link>
        </header>

        <section className="mt-6 text-center fade-in-up">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/80">
            If you win
          </p>
          <h1 className="mt-1 text-5xl font-extrabold tracking-tight">
            {formatStableLocal(potential, "IDR")}
          </h1>
          <p className="mt-1 text-xs text-white/80">
            Pot {formatCusd(pot)} - {(MATCH_FEE_BPS / 100).toFixed(0)}% fee
          </p>
        </section>
      </div>

      <div className="px-5 pb-8">
        <section className="card relative z-10 -mt-5 p-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-2)]">
            Pick Stake ({STAKE_TOKEN.symbol})
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
                    {s.label} {STAKE_TOKEN.symbol}
                  </p>
                  <p className="text-[11px] text-[color:var(--color-ink-2)]">
                    {formatStableLocal(s.value, "IDR")}
                  </p>
                </button>
              );
            })}
          </div>

          <h2 className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-2)]">
            Time control (on-chain: {tcLabelToSeconds(tc)}s)
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
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">On-chain flow</p>
          </div>
          <ol className="mt-2 space-y-1 text-[11px] text-[color:var(--color-ink-2)]">
            <li>1. Register match on backend and receive depositTx instructions.</li>
            <li>2. Approve {STAKE_TOKEN.symbol} for MatchEscrow using the BE amount.</li>
            <li>3. Call MatchEscrow.createMatch(timeControlSeconds) without msg.value.</li>
            <li>4. Opponent approves + joins from Lobby, then oracle settles the result.</li>
          </ol>
        </section>

        {address && (
          <p className="mt-3 text-center text-[11px] text-[color:var(--color-ink-2)]">
            Wallet: <span className="font-mono">{truncateAddress(address)}</span>
          </p>
        )}

        <button
          type="button"
          onClick={onCreate}
          disabled={working}
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

        {txHash && (
          <p className="mt-3 text-center">
            <TxExplorerLink hash={txHash} />
          </p>
        )}

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[color:var(--color-ink-2)]">
          <BoltIcon size={12} className="text-[color:var(--color-amber)]" />
          Stake held in MatchEscrow - {STAKE_TOKEN.symbol}
        </p>
      </div>
    </main>
  );
}
