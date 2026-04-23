"use client";

import { Chess, type Color, type Move, type Square } from "chess.js";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "@/components/chessboard";
import { BoltIcon, ChevronLeft, SparkleIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { useWallet } from "@/hooks/use-connect";
import { useSession } from "@/hooks/use-session";
import { useClaimDailyPuzzle } from "@/hooks/use-daily-puzzle-pool";
import { api } from "@/lib/api";
import type { NextPuzzle, PuzzleStatus, SubmitPuzzleResponse } from "@/types/api";

type Phase =
  | "idle"        // wallet not connected
  | "loading"     // fetching puzzle
  | "playing"     // player's turn
  | "wrong"       // brief red flash after wrong move
  | "animating"   // opponent response animating
  | "submitting"  // submit in flight
  | "result"      // result received
  | "error";      // load failed

export default function PuzzlePage() {
  const { isConnected, connect } = useWallet();
  const { token, loading: sessionLoading } = useSession();
  const toast = useToast();
  const { claim: claimPrize } = useClaimDailyPuzzle();


  // Puzzle data
  const [puzzle, setPuzzle] = useState<NextPuzzle | null>(null);
  const puzzleRef = useRef<NextPuzzle | null>(null);
  const [status, setStatus] = useState<PuzzleStatus | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  // Board state
  const [boardFen, setBoardFen] = useState<string | null>(null);
  const prevFenRef = useRef<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);

  // Puzzle progression
  const [solutionStep, setSolutionStep] = useState(0);
  const solutionStepRef = useRef(0);
  const [playerMoves, setPlayerMoves] = useState<string[]>([]);
  const playerMovesRef = useRef<string[]>([]);

  // Timer
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);

  // Hint
  const [usedHint, setUsedHint] = useState(false);
  const usedHintRef = useRef(false);
  const [showHintWarning, setShowHintWarning] = useState(false);
  const [hintHighlight, setHintHighlight] = useState<{ from: Square; to: Square } | null>(null);

  // Result
  const [result, setResult] = useState<SubmitPuzzleResponse | null>(null);

  // ── Load puzzle ──────────────────────────────────────────────────────────────
  // Use a ref so we can call loadPuzzle inside effects without adding it as a dep
  const loadPuzzle = useCallback(async () => {
    setPhase("loading");
    setPuzzle(null);
    puzzleRef.current = null;
    setBoardFen(null);
    setLastMove(null);
    setSolutionStep(0);
    solutionStepRef.current = 0;
    setPlayerMoves([]);
    playerMovesRef.current = [];
    setStarted(false);
    setElapsed(0);
    elapsedRef.current = 0;
    setUsedHint(false);
    usedHintRef.current = false;
    setHintHighlight(null);
    setResult(null);

    try {
      const [p, s] = await Promise.all([
        api.getNextPuzzle(),
        api.getPuzzleStatus(),
      ]);
      setPuzzle(p);
      puzzleRef.current = p;
      setStatus(s);
      setBoardFen(p.fen);
      prevFenRef.current = p.fen;
      setPhase("playing");
    } catch (e) {
      toast.showError(e);
      setPhase("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable — toast accessed via ref below

  // Keep a stable ref to loadPuzzle so effects don't re-run when it recreates
  const loadPuzzleRef = useRef(loadPuzzle);
  useEffect(() => { loadPuzzleRef.current = loadPuzzle; });

  // Load puzzle when auth token first becomes available
  const tokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isConnected) {
      setPhase("idle");
      return;
    }
    if (sessionLoading) {
      setPhase("loading");
      return;
    }
    if (!token) return;
    // Only load once when token first appears (not on every re-render)
    if (token !== tokenRef.current) {
      tokenRef.current = token;
      loadPuzzleRef.current();
    }
  }, [token, isConnected, sessionLoading]);

  // Timer
  useEffect(() => {
    if (!started || phase !== "playing") return;
    const t = setInterval(() => {
      setElapsed((e) => { elapsedRef.current = e + 1; return e + 1; });
    }, 1000);
    return () => clearInterval(t);
  }, [started, phase]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const playerColor: Color = puzzle?.to_move === "black" ? "b" : "w";

  const chess = useMemo(() => {
    if (!boardFen) return null;
    try { return new Chess(boardFen); } catch { return null; }
  }, [boardFen]);

  const boardDisabled = phase !== "playing" || chess?.turn() !== playerColor;

  // ── Submit ────────────────────────────────────────────────────────────────────
  const doSubmit = useCallback(async (moves: string[], hintUsed: boolean) => {
    const currentPuzzle = puzzleRef.current;
    if (!currentPuzzle) return;
    setPhase("submitting");
    try {
      const r = await api.submitPuzzle(currentPuzzle.id, moves, elapsedRef.current * 1000, hintUsed);

      // DailyPuzzlePool flow: oracle signed a voucher → player claims on-chain
      if (r.claimData) {
        try {
          const claimTxHash = await claimPrize({
            contractAddress: r.claimData.contractAddress,
            day: BigInt(r.claimData.day),
            nonce: r.claimData.nonce,
            amountWei: BigInt(r.claimData.amountWei),
            signature: r.claimData.signature,
          });
          setResult({ ...r, txHash: claimTxHash });
        } catch (claimErr) {
          // Wallet rejected or TX failed — show result without txHash
          setResult(r);
          toast.showError(claimErr);
        }
      } else {
        setResult(r);
      }

      setPhase("result");
      api.getPuzzleStatus().then(setStatus).catch(() => {});
    } catch (e) {
      toast.showError(e);
      setPhase("result");
    }
  }, [toast, claimPrize]);

  // ── Move handler ──────────────────────────────────────────────────────────────
  const tryMove = useCallback((from: Square, to: Square): boolean => {
    if (!chess || !boardFen || boardDisabled) return false;

    const next = new Chess(boardFen);
    let move;
    try { move = next.move({ from, to, promotion: "q" }); } catch { return false; }
    if (!move) return false;

    const uci = `${from}${to}${move.promotion ?? ""}`;

    // Snapshot mutable refs before async call
    const capturedStep = solutionStepRef.current;
    const capturedMoves = [...playerMovesRef.current];
    const capturedHint = usedHintRef.current;
    const capturedFen = boardFen;
    prevFenRef.current = boardFen;

    // Optimistic update
    setBoardFen(next.fen());
    setLastMove({ from: move.from as Square, to: move.to as Square });
    setHintHighlight(null);
    setPhase("animating");
    if (!started) setStarted(true);

    const currentPuzzleId = puzzleRef.current?.id;
    if (!currentPuzzleId) return false;

    (async () => {
      try {
        const resp = await api.validatePuzzleMove(currentPuzzleId, capturedStep, uci);

        if (!resp.correct) {
          setPhase("wrong");
          setTimeout(() => {
            setBoardFen(capturedFen);
            prevFenRef.current = capturedFen;
            setLastMove(null);
            setPhase("playing");
          }, 700);
          return;
        }

        const newMoves = [...capturedMoves, uci];
        playerMovesRef.current = newMoves;
        setPlayerMoves(newMoves);

        if (resp.puzzleComplete || !resp.opponentMove) {
          await doSubmit(newMoves, capturedHint);
          return;
        }

        // Animate opponent response
        const opFen = new Chess(next.fen());
        let opMove: Move | undefined;
        try {
          const opPromo = resp.opponentMove[4] as "q" | "r" | "b" | "n" | undefined;
          opMove = opFen.move({
            from: resp.opponentMove.slice(0, 2) as Square,
            to: resp.opponentMove.slice(2, 4) as Square,
            ...(opPromo ? { promotion: opPromo } : {}),
          });
        } catch { opMove = undefined; /* invalid opponent move — skip */ }

        setTimeout(() => {
          if (opMove) {
            setBoardFen(opFen.fen());
            setLastMove({ from: opMove.from as Square, to: opMove.to as Square });
          }
          const nextStep = capturedStep + 2;
          solutionStepRef.current = nextStep;
          setSolutionStep(nextStep);
          setPhase("playing");
        }, 500);

      } catch (err) {
        setBoardFen(capturedFen);
        prevFenRef.current = capturedFen;
        setLastMove(null);
        setPhase("playing");
        toast.showError(err);
      }
    })();

    return true;
  }, [chess, boardFen, boardDisabled, started, doSubmit, toast]);

  const legalMovesFrom = useCallback((sq: Square): Square[] => {
    if (!chess || chess.turn() !== playerColor) return [];
    return chess.moves({ square: sq, verbose: true }).map((m) => m.to as Square);
  }, [chess, playerColor]);

  // ── Hint ──────────────────────────────────────────────────────────────────────
  const onHintConfirm = async () => {
    setShowHintWarning(false);
    const currentPuzzle = puzzleRef.current;
    if (!currentPuzzle) return;
    setUsedHint(true);
    usedHintRef.current = true;
    try {
      const hint = await api.getPuzzleHint(currentPuzzle.id, solutionStepRef.current);
      setHintHighlight({
        from: hint.move.slice(0, 2) as Square,
        to: hint.move.slice(2, 4) as Square,
      });
    } catch (e) { toast.showError(e); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const fmtTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const statusText =
    phase === "wrong"      ? "Wrong move — try again"
    : phase === "submitting" ? "Submitting…"
    : result?.correct      ? result.prizeEarned ? `+$${result.prizeAmountCusd} cUSD!` : "Solved!"
    : result               ? "Wrong solution"
    : started              ? fmtTime(elapsed)
    : puzzle?.to_move === "black" ? "Black to move" : "White to move";

  const prizeLabel = status
    ? status.prizesRemaining > 0
      ? `${status.prizesRemaining} prize${status.prizesRemaining > 1 ? "s" : ""} left today`
      : "No prizes left today"
    : "max 3 prizes/day";

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <main className="flex-1">
      {/* Hero */}
      <div className="bg-hero rounded-b-[32px] px-5 pt-[max(env(safe-area-inset-top),18px)] pb-8 text-white">
        <header className="flex items-center justify-between">
          <Link href="/home" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15" aria-label="Back">
            <ChevronLeft size={18} />
          </Link>
          <p className="text-sm font-bold">Chess Puzzle</p>
          <span className="h-9 w-9" />
        </header>
        <section className="mt-6 text-center fade-in-up">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/80">Prize per correct answer</p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight">$0.01 cUSD</h1>
          <p className="mt-1 text-[11px] text-white/80">{prizeLabel}</p>
        </section>
      </div>

      <div className="px-4 pb-8">
        {/* Board card */}
        <div className="card -mt-5 p-3 relative z-10">
          <div className={[
            "relative rounded-[18px] overflow-hidden transition-shadow duration-200",
            phase === "wrong" ? "ring-4 ring-red-500" : "",
          ].join(" ")}>

            {/* Not connected */}
            {phase === "idle" && (
              <div className="aspect-square flex flex-col items-center justify-center gap-4 bg-[color:var(--color-surface)]">
                <p className="text-sm font-semibold text-[color:var(--color-ink-1)]">Connect wallet to play</p>
                <button
                  type="button"
                  onClick={connect}
                  className="rounded-2xl bg-[color:var(--color-primary)] px-6 py-3 text-sm font-bold text-white shadow-[var(--shadow-glow-primary)]"
                >
                  Connect MiniPay
                </button>
              </div>
            )}

            {/* Loading / authenticating */}
            {(phase === "loading") && (
              <div className="aspect-square flex flex-col items-center justify-center gap-3 bg-[color:var(--color-surface)]">
                <span className="h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--color-primary)]/30 border-t-[color:var(--color-primary)]" />
                <p className="text-xs text-[color:var(--color-ink-2)]">
                  {sessionLoading ? "Authenticating…" : "Loading puzzle…"}
                </p>
              </div>
            )}

            {/* Error */}
            {phase === "error" && (
              <div className="aspect-square flex flex-col items-center justify-center gap-4 bg-[color:var(--color-surface)]">
                <p className="text-sm text-[color:var(--color-ink-2)]">Failed to load puzzle</p>
                <button
                  type="button"
                  onClick={() => loadPuzzleRef.current()}
                  className="rounded-2xl bg-[color:var(--color-primary)] px-6 py-3 text-sm font-bold text-white"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Board */}
            {boardFen && phase !== "idle" && phase !== "loading" && phase !== "error" && (
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
            )}

            {/* Wrong move overlay */}
            {phase === "wrong" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[18px] bg-red-500/10">
                <span className="rounded-xl bg-red-500/85 px-4 py-2 text-base font-bold text-white">Wrong move</span>
              </div>
            )}

            {/* Submitting overlay */}
            {phase === "submitting" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[18px] bg-white/60">
                <span className="h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--color-primary)]/30 border-t-[color:var(--color-primary)]" />
              </div>
            )}
          </div>
        </div>

        {/* Status bar */}
        {puzzle && (
          <div className="card mt-4 flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-2)]">
                {puzzle.to_move === "black" ? "Black to move" : "White to move"}
                {puzzle.rating ? ` · Rating ${puzzle.rating}` : ""}
                {usedHint ? " · hint used" : ""}
              </p>
              <p className={[
                "text-sm font-bold",
                phase === "wrong" ? "text-red-500"
                : result?.prizeEarned ? "text-green-600"
                : "text-[color:var(--color-ink-0)]",
              ].join(" ")}>
                {statusText}
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-[color:var(--color-primary-50)] px-3 py-1.5 text-[color:var(--color-primary)]">
              <SparkleIcon size={14} />
              <span className="text-xs font-bold">
                {status ? `${status.prizesEarned}/${status.maxDailyPrizes}` : "—"}
              </span>
            </div>
          </div>
        )}

        {/* Result card */}
        {phase === "result" && result && (
          <div className={[
            "card mt-4 p-4",
            result.prizeEarned ? "border-2 border-green-200 bg-green-50" : "",
          ].join(" ")}>
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
              {result.correct
                ? result.prizeEarned
                  ? `Solved! +$${result.prizeAmountCusd} cUSD sent to your wallet`
                  : usedHint
                  ? "Solved — hint used, no prize"
                  : "Solved! (No more prizes today)"
                : "Wrong solution — try the next puzzle!"}
            </p>
            {result.prizeEarned && result.txHash && (
              <p className="mt-1 truncate text-[11px] text-[color:var(--color-ink-2)]">
                Tx: {result.txHash.slice(0, 12)}…{result.txHash.slice(-8)}
              </p>
            )}
            {result.correct && (
              <p className="mt-1 text-[11px] text-[color:var(--color-ink-2)]">
                {result.prizesRemaining > 0
                  ? `${result.prizesRemaining} prize${result.prizesRemaining > 1 ? "s" : ""} remaining today`
                  : "All 3 prizes claimed. Keep playing for fun!"}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => loadPuzzleRef.current()}
                className="flex-1 rounded-2xl bg-[color:var(--color-primary)] py-3 text-sm font-bold text-white shadow-[var(--shadow-glow-primary)]"
              >
                Next Puzzle
              </button>
              <Link
                href="/home"
                className="flex-1 rounded-2xl border border-[color:var(--color-border)] py-3 text-center text-sm font-bold text-[color:var(--color-ink-1)]"
              >
                Home
              </Link>
            </div>
          </div>
        )}

        {/* Hint button */}
        {(phase === "playing" || phase === "animating") && (
          <button
            type="button"
            onClick={() => !usedHint && setShowHintWarning(true)}
            disabled={usedHint || phase === "animating"}
            className={[
              "mt-4 w-full rounded-2xl border py-3 text-sm font-bold transition-colors",
              usedHint
                ? "cursor-not-allowed border-[color:var(--color-border)] text-[color:var(--color-ink-3)] opacity-50"
                : "border-amber-400 text-amber-600 active:bg-amber-50",
            ].join(" ")}
          >
            {usedHint ? "Hint used · no prize for this puzzle" : "💡 Hint (disqualifies from prize)"}
          </button>
        )}

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[color:var(--color-ink-2)]">
          <BoltIcon size={12} className="text-[color:var(--color-amber)]" />
          Max 3 prizes/day · resets at 00:00 UTC
        </p>
      </div>

      {/* Hint warning modal */}
      {showHintWarning && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-[color:var(--color-ink-0)]">Use a hint?</h2>
            <p className="mt-2 text-sm text-[color:var(--color-ink-2)]">
              Using a hint will{" "}
              <strong className="text-red-600">disqualify you from the $0.01 cUSD prize</strong>{" "}
              for this puzzle.
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
