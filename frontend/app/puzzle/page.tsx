"use client";

import { Chess, type Color, type Square } from "chess.js";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatUnits } from "viem";
import { Chessboard } from "@/components/chessboard";
import { BoltIcon, ChevronLeft, SparkleIcon } from "@/components/icons";
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
  const { address, isConnected, connect } = useWallet();
  const { token } = useSession();
  const toast = useToast();

  // On-chain pool data
  const { data: dayRaw } = useTodayIndex();
  const today = dayRaw as bigint | undefined;
  const { data: pendingRaw } = usePuzzlePoolBalance();
  const pending = pendingRaw as bigint | undefined;
  const { data: roundRaw } = useRound(today);
  const { data: alreadyClaimed } = useHasClaimed(today, address);
  const { claim, isPending: claiming, hash } = useClaimPuzzle();
  const { status } = useTxStatus(hash);

  // Puzzle data
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [puzzleErr, setPuzzleErr] = useState<string | null>(null);

  // Board state
  const [boardFen, setBoardFen] = useState<string | null>(null);
  const prevFenRef = useRef<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);

  // Puzzle progression — solutionStep is the index in solution[] for the player's current turn
  const [solutionStep, setSolutionStep] = useState(0);
  const [playerMoves, setPlayerMoves] = useState<string[]>([]);

  // Interaction state
  const [isAnimating, setIsAnimating] = useState(false); // board locked during validation / opponent animation
  const [isWrong, setIsWrong] = useState(false);         // red flash after wrong move
  const [isCorrect, setIsCorrect] = useState(false);     // brief green flash after correct move

  // Timer
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);

  // Hint
  const [usedHint, setUsedHint] = useState(false);
  const [showHintWarning, setShowHintWarning] = useState(false);
  const [hintHighlight, setHintHighlight] = useState<{ from: Square; to: Square } | null>(null);

  // Submission
  const [completedMoves, setCompletedMoves] = useState<string[] | null>(null); // set when puzzle is solved
  const [result, setResult] = useState<SubmitPuzzleResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  // Load puzzle
  useEffect(() => {
    api
      .getDailyPuzzle()
      .then((p) => {
        setPuzzle(p);
        setBoardFen(p.fen);
        prevFenRef.current = p.fen;
      })
      .catch((e) => {
        setPuzzleErr((e as Error).message);
        toast.showError(e);
      });
  }, [toast]);

  // Timer
  useEffect(() => {
    if (!started || completedMoves || result) return;
    const t = setInterval(() => {
      setElapsed((e) => {
        elapsedRef.current = e + 1;
        return e + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [started, completedMoves, result]);

  const playerColor: Color = puzzle?.to_move === "black" ? "b" : "w";

  const chess = useMemo(() => {
    if (!boardFen) return null;
    try {
      return new Chess(boardFen);
    } catch {
      return null;
    }
  }, [boardFen]);

  const boardDisabled =
    isAnimating || isWrong || !!completedMoves || chess?.turn() !== playerColor;

  // ---- Submit ----
  const doSubmit = useCallback(
    async (moves: string[], hintUsed: boolean) => {
      if (!puzzle) return;
      if (!isConnected) {
        connect();
        toast.show({
          title: "Connect your wallet",
          message: "Connect MiniPay to record your result.",
          tone: "info",
        });
        return;
      }
      if (!token) {
        toast.show({
          title: "Session not ready",
          message: "Wait a moment and try again.",
          tone: "info",
        });
        return;
      }
      setSubmitting(true);
      try {
        const r = await api.submitPuzzle(puzzle.id, moves, elapsedRef.current * 1000, hintUsed);
        setResult(r);
      } catch (e) {
        const code = (e as { code?: string }).code;
        const s = (e as { status?: number }).status;
        if (code === "PUZZLE_ALREADY_SUBMITTED" || s === 409) {
          setAlreadySubmitted(true);
        }
        toast.showError(e);
      } finally {
        setSubmitting(false);
      }
    },
    [puzzle, isConnected, connect, token, toast],
  );

  // ---- Move handler ----
  const tryMove = useCallback(
    (from: Square, to: Square): boolean => {
      if (!chess || !boardFen || boardDisabled) return false;

      // Check legality with chess.js
      const next = new Chess(boardFen);
      let move;
      try {
        move = next.move({ from, to, promotion: "q" });
      } catch {
        return false;
      }
      if (!move) return false;

      const uci = `${from}${to}${move.promotion ?? ""}`;

      // Capture values to avoid stale closures inside the async IIFE
      const capturedStep = solutionStep;
      const capturedPlayerMoves = playerMoves;
      const capturedUsedHint = usedHint;
      prevFenRef.current = boardFen;

      // Optimistic update — show the move immediately
      setBoardFen(next.fen());
      setLastMove({ from: move.from as Square, to: move.to as Square });
      setHintHighlight(null);
      setIsAnimating(true);
      if (!started) setStarted(true);

      // Async validation against the backend
      (async () => {
        try {
          const resp = await api.validatePuzzleMove(puzzle!.id, capturedStep, uci);

          if (!resp.correct) {
            // Wrong move — flash red then revert
            setIsWrong(true);
            setTimeout(() => {
              setBoardFen(prevFenRef.current);
              setLastMove(null);
              setIsWrong(false);
              setIsAnimating(false);
            }, 700);
            return;
          }

          // Correct move — brief green flash
          setIsCorrect(true);
          setTimeout(() => setIsCorrect(false), 400);

          const newPlayerMoves = [...capturedPlayerMoves, uci];

          if (resp.puzzleComplete || !resp.opponentMove) {
            // All player moves done
            setPlayerMoves(newPlayerMoves);
            setCompletedMoves(newPlayerMoves);
            setIsAnimating(false);
            await doSubmit(newPlayerMoves, capturedUsedHint);
            return;
          }

          // Play the opponent's forced response after a short delay
          const opFen = new Chess(next.fen());
          let opMoveParsed;
          try {
            opMoveParsed = opFen.move({
              from: resp.opponentMove.slice(0, 2) as Square,
              to: resp.opponentMove.slice(2, 4) as Square,
              promotion: (resp.opponentMove[4] as "q" | "r" | "b" | "n") ?? "q",
            });
          } catch {
            // Opponent move is invalid chess — skip it and let player continue
          }

          setTimeout(() => {
            if (opMoveParsed) {
              setBoardFen(opFen.fen());
              setLastMove({
                from: opMoveParsed.from as Square,
                to: opMoveParsed.to as Square,
              });
            }
            setSolutionStep(capturedStep + 2);
            setPlayerMoves(newPlayerMoves);
            setIsAnimating(false);
          }, 500);
        } catch (err) {
          // Network error — revert
          setBoardFen(prevFenRef.current);
          setLastMove(null);
          setIsAnimating(false);
          toast.showError(err);
        }
      })();

      return true;
    },
    [chess, boardFen, boardDisabled, started, solutionStep, playerMoves, usedHint, puzzle, doSubmit, toast],
  );

  const legalMovesFrom = useCallback(
    (sq: Square): Square[] => {
      if (!chess || chess.turn() !== playerColor) return [];
      return chess.moves({ square: sq, verbose: true }).map((m) => m.to as Square);
    },
    [chess, playerColor],
  );

  // ---- Hint ----
  const onHintConfirm = async () => {
    setShowHintWarning(false);
    if (!puzzle) return;
    setUsedHint(true);
    try {
      const hint = await api.getPuzzleHint(puzzle.id, solutionStep);
      const hFrom = hint.move.slice(0, 2) as Square;
      const hTo = hint.move.slice(2, 4) as Square;
      setHintHighlight({ from: hFrom, to: hTo });
    } catch (e) {
      toast.showError(e);
    }
  };

  // ---- Reset ----
  const resetPuzzle = () => {
    if (!puzzle) return;
    setBoardFen(puzzle.fen);
    prevFenRef.current = puzzle.fen;
    setLastMove(null);
    setSolutionStep(0);
    setPlayerMoves([]);
    setIsAnimating(false);
    setIsWrong(false);
    setIsCorrect(false);
    setStarted(false);
    setElapsed(0);
    elapsedRef.current = 0;
    setHintHighlight(null);
    setCompletedMoves(null);
    setResult(null);
  };

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const round = roundRaw as readonly [`0x${string}`, bigint, bigint, boolean] | undefined;
  const prizeWei = round?.[1];
  const distributed = round?.[3] ?? false;

  const onClaim = async () => {
    if (!address) { connect(); return; }
    if (today === undefined) {
      toast.show({ title: "Puzzle data not ready", message: "Try again in a moment.", tone: "info" });
      return;
    }
    try {
      const { amount, proof } = await api.getPuzzleProofToday(address);
      await claim({ day: today, amountWei: BigInt(amount), proof });
      toast.show({ title: "Claim submitted", message: "Wait for on-chain confirmation.", tone: "info" });
    } catch (e) {
      const s = (e as { status?: number }).status;
      if (s === 404) {
        toast.show({ title: "Can't claim yet", message: "You're not a top finisher or the round isn't finalized.", tone: "warning" });
      } else {
        toast.showError(e);
      }
    }
  };

  // Status text for the info bar
  const statusText = result
    ? result.correct
      ? usedHint
        ? "Solved (hint used · no prize)"
        : `Correct! Rank #${result.rank ?? "—"}`
      : "Wrong solution"
    : isWrong
    ? "Wrong move — try again"
    : isAnimating && !isWrong
    ? "Thinking…"
    : started
    ? fmtTime(elapsed)
    : puzzle?.to_move === "black"
    ? "Black to move"
    : "White to move";

  return (
    <main className="flex-1">
      {/* Hero header */}
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
              ? `${puzzle.participants} players · ${puzzle.puzzle_date}`
              : "Loading…"}
          </p>
        </section>
      </div>

      <div className="px-4 pb-8">
        {/* Board card */}
        <div className="card -mt-5 p-3 relative z-10">
          <div
            className={[
              "relative rounded-[18px] overflow-hidden transition-shadow duration-200",
              isWrong
                ? "ring-4 ring-red-500"
                : isCorrect
                ? "ring-4 ring-green-500"
                : "",
            ].join(" ")}
          >
            {boardFen ? (
              <Chessboard
                fen={boardFen}
                orientation={playerColor === "b" ? "black" : "white"}
                turn={chess?.turn() ?? "w"}
                playerColor={playerColor}
                disabled={boardDisabled}
                onMove={tryMove}
                legalMovesFrom={legalMovesFrom}
                lastMove={hintHighlight ?? lastMove ?? undefined}
              />
            ) : (
              <div className="aspect-square flex items-center justify-center text-sm text-[color:var(--color-ink-2)]">
                {puzzleErr ? `Failed to load: ${puzzleErr}` : "Loading puzzle…"}
              </div>
            )}

            {/* Wrong move overlay */}
            {isWrong && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[18px] bg-red-500/10">
                <span className="rounded-xl bg-red-500/85 px-4 py-2 text-base font-bold text-white">
                  Wrong move
                </span>
              </div>
            )}

            {/* Submitting overlay */}
            {submitting && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[18px] bg-white/60">
                <span className="h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--color-primary)]/30 border-t-[color:var(--color-primary)]" />
              </div>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="card mt-4 flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-2)]">
              {puzzle?.to_move === "black" ? "Black to move" : "White to move"}
              {usedHint && " · hint used"}
            </p>
            <p
              className={[
                "text-sm font-bold",
                isWrong
                  ? "text-red-500"
                  : result?.correct
                  ? "text-[color:var(--color-success)]"
                  : "text-[color:var(--color-ink-0)]",
              ].join(" ")}
            >
              {statusText}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-[color:var(--color-primary-50)] px-3 py-1.5 text-[color:var(--color-primary)]">
            <SparkleIcon size={14} />
            <span className="text-xs font-bold">
              {puzzle ? `${puzzle.participants} solves` : "—"}
            </span>
          </div>
        </div>

        {/* Bottom action area */}
        {result ? (
          <div className="card mt-4 p-4">
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
              {result.correct
                ? usedHint
                  ? "Solved — hint used, no prize"
                  : `Solved! Rank #${result.rank ?? "—"} of ${result.totalParticipants}`
                : "Wrong solution submitted"}
            </p>
            {result.correct && !usedHint && result.rank && result.rank <= 10 && (
              <p className="mt-1 text-[11px] text-[color:var(--color-ink-2)]">
                You're in the top 10! Prize will be claimable after round finalization.
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={resetPuzzle}
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
              One attempt per wallet per day. Come back after <b>00:00 UTC</b>.
            </p>
            <Link
              href="/home"
              className="mt-3 inline-block rounded-full bg-[color:var(--color-primary)] px-5 py-2 text-xs font-bold text-white"
            >
              Back to Home
            </Link>
          </div>
        ) : completedMoves && !result ? (
          // Puzzle solved but submit not yet done (e.g. wallet not connected)
          <div className="card mt-4 p-4">
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
              Puzzle solved! Connect wallet to record your result.
            </p>
            <button
              type="button"
              onClick={() => doSubmit(completedMoves, usedHint)}
              disabled={submitting}
              className="mt-3 w-full rounded-2xl bg-[color:var(--color-primary)] py-3 text-sm font-bold text-white shadow-[var(--shadow-glow-primary)] disabled:opacity-60"
            >
              {submitting ? "Submitting…" : isConnected ? "Submit result" : "Connect to submit"}
            </button>
          </div>
        ) : distributed ? (
          <div className="card mt-4 p-4">
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
              Round finalized ✓
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--color-ink-2)]">
              Total prize: {prizeWei ? weiToLocal(prizeWei) : "—"}.
            </p>
            {alreadyClaimed ? (
              <p className="mt-3 rounded-xl bg-[color:var(--color-success-soft)] px-3 py-2 text-[11px] font-bold text-[color:var(--color-success)]">
                You already claimed ✓
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
          // Hint button (shown while puzzle is in progress)
          boardFen && (
            <button
              type="button"
              onClick={() => !usedHint && setShowHintWarning(true)}
              disabled={usedHint || isAnimating}
              className={[
                "mt-4 w-full rounded-2xl border py-3 text-sm font-bold transition-colors",
                usedHint
                  ? "cursor-not-allowed border-[color:var(--color-border)] text-[color:var(--color-ink-3)] opacity-50"
                  : "border-amber-400 text-amber-600 active:bg-amber-50",
              ].join(" ")}
            >
              {usedHint ? "Hint used · no prize eligibility" : "💡 Hint (disqualifies from prize)"}
            </button>
          )
        )}

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[color:var(--color-ink-2)]">
          <BoltIcon size={12} className="text-[color:var(--color-amber)]" />
          Free to play · resets daily at 00:00 UTC
        </p>
      </div>

      {/* Hint warning modal */}
      {showHintWarning && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-[color:var(--color-ink-0)]">
              Use a hint?
            </h2>
            <p className="mt-2 text-sm text-[color:var(--color-ink-2)]">
              Using a hint will{" "}
              <strong className="text-red-600">
                disqualify you from today's prize pool
              </strong>
              . The correct move will be highlighted on the board.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setShowHintWarning(false)}
                className="flex-1 rounded-2xl border border-[color:var(--color-border)] py-3 text-sm font-bold text-[color:var(--color-ink-1)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onHintConfirm}
                className="flex-1 rounded-2xl bg-amber-500 py-3 text-sm font-bold text-white"
              >
                Show hint
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
