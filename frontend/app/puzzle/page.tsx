"use client";

import { Chess, type Color, type Square } from "chess.js";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { Chessboard } from "@/components/chessboard";
import { BoltIcon, ChevronLeft, PlayIcon, SparkleIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { TxExplorerLink, useTxStatus } from "@/components/tx-status";
import { useWallet } from "@/hooks/use-connect";
import {
  useClaimPuzzle,
  useHasClaimed,
  usePuzzlePoolBalance,
  useRound,
  useTodayIndex,
} from "@/hooks/use-puzzle-pool";
import { useSession } from "@/hooks/use-session";
import { api } from "@/lib/api";
import { formatLocal, weiToLocal } from "@/lib/format";
import type { DailyPuzzle, SubmitPuzzleResponse } from "@/types/api";

export default function PuzzlePage() {
  const { address, isConnected, connect, isConnecting } = useWallet();
  const { token } = useSession();
  const toast = useToast();

  // On-chain pool data (prize pool, sponsor state).
  const { data: dayRaw } = useTodayIndex();
  const today = dayRaw as bigint | undefined;
  const { data: pendingRaw } = usePuzzlePoolBalance();
  const pending = pendingRaw as bigint | undefined;
  const { data: roundRaw } = useRound(today);
  const { data: alreadyClaimed } = useHasClaimed(today, address);

  const { claim, isPending: claiming, hash } = useClaimPuzzle();
  const { status } = useTxStatus(hash);

  // BE puzzle state.
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [puzzleErr, setPuzzleErr] = useState<string | null>(null);
  const [fen, setFen] = useState<string | null>(null);
  const [moves, setMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<SubmitPuzzleResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // BE returns 409 PUZZLE_ALREADY_SUBMITTED if the wallet already tried
  // today. Flip this flag so we stop showing the Submit button.
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    api
      .getDailyPuzzle()
      .then((p) => {
        setPuzzle(p);
        setFen(p.fen);
      })
      .catch((e) => {
        setPuzzleErr((e as Error).message);
        toast.showError(e);
      });
  }, [toast]);

  useEffect(() => {
    if (!started || result) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [started, result]);

  const chess = useMemo(() => {
    if (!fen) return null;
    try {
      return new Chess(fen);
    } catch {
      return null;
    }
  }, [fen]);

  const playerColor: Color | undefined =
    puzzle?.to_move === "black" ? "b" : "w";

  const tryMove = useCallback(
    (from: Square, to: Square): boolean => {
      if (!chess || !fen || result) return false;
      if (chess.turn() !== playerColor) return false;
      const next = new Chess(fen);
      let move;
      try {
        move = next.move({ from, to, promotion: "q" });
      } catch {
        return false;
      }
      if (!move) return false;
      const uci = `${from}${to}${move.promotion ?? ""}`;
      setMoves((m) => [...m, uci]);
      setLastMove({ from: move.from as Square, to: move.to as Square });
      setFen(next.fen());
      if (!started) setStarted(true);
      return true;
    },
    [chess, fen, playerColor, result, started],
  );

  const legalMovesFrom = useCallback(
    (sq: Square): Square[] => {
      if (!chess) return [];
      if (chess.turn() !== playerColor) return [];
      return chess.moves({ square: sq, verbose: true }).map((m) => m.to as Square);
    },
    [chess, playerColor],
  );

  const resetAttempt = () => {
    if (!puzzle) return;
    setFen(puzzle.fen);
    setMoves([]);
    setLastMove(null);
    setElapsed(0);
    setStarted(false);
    setResult(null);
  };

  const onSubmit = async () => {
    if (!puzzle || moves.length === 0) return;
    if (!isConnected) return connect();
    if (!token) {
      toast.show({
        title: "Session not ready",
        message: "Wait for backend login to finish then try again.",
        tone: "info",
      });
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.submitPuzzle(puzzle.id, moves, elapsed * 1000);
      setResult(r);
    } catch (e) {
      // 409 PUZZLE_ALREADY_SUBMITTED isn't a bug — it's the daily guard.
      // Convert to an in-UI "already done" state so we don't re-prompt the
      // user to resubmit.
      const code = (e as { code?: string }).code;
      const status = (e as { status?: number }).status;
      if (code === "PUZZLE_ALREADY_SUBMITTED" || status === 409) {
        setAlreadySubmitted(true);
      }
      toast.showError(e);
    } finally {
      setSubmitting(false);
    }
  };

  const round = roundRaw as
    | readonly [`0x${string}`, bigint, bigint, boolean]
    | undefined;
  const prizeWei = round?.[1];
  const distributed = round?.[3] ?? false;

  const onClaim = async () => {
    if (!address) {
      connect();
      return;
    }
    if (today === undefined) {
      toast.show({
        title: "Puzzle data not ready",
        message: "Contract hasn't responded yet, try again.",
        tone: "info",
      });
      return;
    }
    try {
      // Fetch Merkle proof from BE — returns 404 if user isn't a winner
      // or the round isn't finalized yet.
      const { amount, proof } = await api.getPuzzleProofToday(address);
      await claim({
        day: today,
        amountWei: BigInt(amount),
        proof,
      });
      toast.show({
        title: "Claim submitted",
        message: "Wait for on-chain confirmation.",
        tone: "info",
      });
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 404) {
        toast.show({
          title: "Can't claim yet",
          message: "You're not a top finisher or the round isn't finalized.",
          tone: "warning",
        });
      } else {
        toast.showError(e);
      }
    }
  };

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

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
          <p className="text-sm font-bold">Daily Puzzle</p>
          <span className="h-9 w-9" />
        </header>

        <section className="mt-6 text-center fade-in-up">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/80">
            Today's Prize Pool
          </p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight">
            {pending
              ? weiToLocal(pending)
              : puzzle
              ? formatLocal(Number(puzzle.prize_pool), "IDR")
              : formatLocal(5, "IDR")}
          </h1>
          <p className="mt-1 text-[11px] text-white/80">
            {pending
              ? `${formatUnits(pending, 18)} CELO on-chain`
              : puzzle
              ? `${puzzle.participants} players · day ${puzzle.puzzle_date}`
              : "Loading…"}
          </p>
        </section>
      </div>

      <div className="px-4 pb-8">
        <div className="card -mt-5 p-3 relative z-10">
          {fen ? (
            <Chessboard
              fen={fen}
              orientation={playerColor === "b" ? "black" : "white"}
              turn={chess?.turn() ?? "w"}
              playerColor={playerColor ?? "w"}
              disabled={!!result}
              onMove={tryMove}
              legalMovesFrom={legalMovesFrom}
              lastMove={lastMove ?? undefined}
            />
          ) : (
            <div className="aspect-square flex items-center justify-center text-sm text-[color:var(--color-ink-2)]">
              {puzzleErr ? `Failed to load puzzle: ${puzzleErr}` : "Loading puzzle…"}
            </div>
          )}
        </div>

        <div className="card mt-4 flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-2)]">
              {puzzle?.to_move === "black" ? "Black to move" : "White to move"} ·{" "}
              {moves.length} moves played
            </p>
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
              {result
                ? result.correct
                  ? `Correct · rank #${result.rank}`
                  : "Not quite right"
                : started
                ? `Timer · ${fmtTime(elapsed)}`
                : "Ready to start"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-[color:var(--color-primary-50)] px-3 py-1.5 text-[color:var(--color-primary)]">
            <SparkleIcon size={14} />
            <span className="text-xs font-bold">
              {puzzle ? `${puzzle.participants} solves` : "—"}
            </span>
          </div>
        </div>

        {result ? (
          <div className="card mt-4 p-4">
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
              {result.correct ? "🎉 Correct solution" : "Not quite, try again"}
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--color-ink-2)]">
              Rank #{result.rank ?? "—"} of {result.totalParticipants} solvers · reward{" "}
              {result.reward.toFixed(2)} CELO
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={resetAttempt}
                className="flex-1 rounded-2xl border border-[color:var(--color-border)] py-3 text-sm font-bold text-[color:var(--color-ink-1)]"
              >
                Reset
              </button>
              <Link
                href="/home"
                className="flex-1 rounded-2xl bg-[color:var(--color-primary)] py-3 text-center text-sm font-bold text-white"
              >
                Back to Home
              </Link>
            </div>
          </div>
        ) : alreadySubmitted ? (
          <div className="card mt-4 p-4 text-center">
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
              You already submitted today ✓
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--color-ink-2)]">
              One attempt per wallet per day. Come back after{" "}
              <b>00:00 UTC</b> for the next puzzle.
            </p>
            <Link
              href="/home"
              className="mt-3 inline-block rounded-full bg-[color:var(--color-primary)] px-5 py-2 text-xs font-bold text-white"
            >
              Back to Home
            </Link>
          </div>
        ) : distributed ? (
          <div className="card mt-4 p-4">
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
              Round day {today?.toString()} is finalized ✓
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--color-ink-2)]">
              Total prize: {prizeWei ? weiToLocal(prizeWei) : "—"}. If you're in the top 10,
              the backend provides a Merkle proof — then call <code>claim(day, amount, proof)</code>.
            </p>
            {alreadyClaimed ? (
              <p className="mt-3 rounded-xl bg-[color:var(--color-success-soft)] px-3 py-2 text-[11px] font-bold text-[color:var(--color-success)]">
                You already claimed today ✓
              </p>
            ) : (
              <button
                type="button"
                onClick={onClaim}
                disabled={claiming || status === "pending"}
                className="mt-3 w-full rounded-2xl bg-[color:var(--color-primary)] py-3 text-sm font-bold text-white shadow-[var(--shadow-glow-primary)]"
              >
                {claiming || status === "pending"
                  ? "Submitting…"
                  : isConnected
                  ? "Claim Prize"
                  : "Connect MiniPay"}
              </button>
            )}
            {hash && (
              <p className="mt-2 text-center">
                <TxExplorerLink hash={hash} />
              </p>
            )}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting || moves.length === 0 || !puzzle}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-primary)] py-4 text-base font-bold text-white shadow-[var(--shadow-glow-primary)] active:scale-[0.99] disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Submitting…
                </>
              ) : moves.length === 0 ? (
                <>
                  <PlayIcon size={18} />
                  Make a move to start
                </>
              ) : (
                <>
                  <PlayIcon size={18} />
                  {isConnected ? `Submit ${moves.length} moves` : "Connect to submit"}
                </>
              )}
            </button>

            {moves.length > 0 && (
              <button
                type="button"
                onClick={resetAttempt}
                className="mt-2 w-full rounded-2xl border border-[color:var(--color-border)] py-2 text-xs font-bold text-[color:var(--color-ink-2)]"
              >
                Reset attempt
              </button>
            )}
          </>
        )}

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[color:var(--color-ink-2)]">
          <BoltIcon size={12} className="text-[color:var(--color-amber)]" />
          Free to play · resets daily at 00:00 UTC
        </p>
      </div>
    </main>
  );
}
