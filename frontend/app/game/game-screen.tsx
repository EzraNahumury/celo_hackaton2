"use client";

import { Chess, type Color, type Square } from "chess.js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "@/components/chessboard";
import { ChevronLeft, FlagIcon, TrophyIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { useWallet } from "@/hooks/use-connect";
import { useSession } from "@/hooks/use-session";
import { api } from "@/lib/api";
import { formatCelo, formatLocal, truncateAddress } from "@/lib/format";
import { connectGameWs, type GameSocket } from "@/lib/ws";
import type { GameResult, GameState, WsServerEvent } from "@/types/api";

type UiResult = "win" | "lose" | "draw";

const FEE = 0.03;
const BOT_POLL_MS = 600;
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function parseTc(tc: string): { base: number; inc: number } {
  const [m, s] = tc.split("+").map(Number);
  return { base: (m || 3) * 60, inc: s || 0 };
}

function fmtClock(secs: number): string {
  const s = Math.max(0, Math.ceil(secs));
  const mm = Math.floor(s / 60).toString().padStart(1, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function findKingSquare(chess: Chess, color: Color): Square | null {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (cell && cell.type === "k" && cell.color === color) {
        return `${String.fromCharCode(97 + c)}${8 - r}` as Square;
      }
    }
  }
  return null;
}

function uiResultFromGame(result: GameResult, myColor: Color): UiResult {
  if (result === "draw" || result === "abort") return "draw";
  const whiteWon = result === "white_win";
  return whiteWon === (myColor === "w") ? "win" : "lose";
}

export function GameScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const gameId = params.get("id");
  const previewStake = Number(params.get("stake") ?? "1");
  const previewTc = params.get("tc") ?? "3+0";

  // If no id is present we fall back to the old offline bot demo (used when
  // contracts are not deployed — /play sends stake+tc+preview).
  if (!gameId) {
    return <OfflineBotScreen stake={previewStake} tc={previewTc} />;
  }
  return <LiveGame gameId={gameId} router={router} />;
}

function LiveGame({
  gameId,
  router,
}: {
  gameId: string;
  router: ReturnType<typeof useRouter>;
}) {
  const { address } = useWallet();
  const { token } = useSession();
  const toast = useToast();

  const [game, setGame] = useState<GameState | null>(null);
  const [fen, setFen] = useState<string>(START_FEN);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [whiteMs, setWhiteMs] = useState<number>(0);
  const [blackMs, setBlackMs] = useState<number>(0);
  const [result, setResult] = useState<UiResult | null>(null);
  const [endReason, setEndReason] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendingMove, setSendingMove] = useState(false);
  const [drawOfferedBy, setDrawOfferedBy] = useState<string | null>(null);

  const wsRef = useRef<GameSocket | null>(null);

  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);
  const turn = chess.turn();

  const myColor: Color | null = useMemo(() => {
    if (!game || !address) return null;
    const a = address.toLowerCase();
    if (game.white_address?.toLowerCase() === a) return "w";
    if (game.black_address?.toLowerCase() === a) return "b";
    return null;
  }, [game, address]);

  const isBot = game?.mode === "bot";
  const orientation: "white" | "black" = myColor === "b" ? "black" : "white";
  const opponentAddress = myColor === "w" ? game?.black_address : game?.white_address;

  const inCheckSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    return findKingSquare(chess, chess.turn());
  }, [chess]);

  const tc = game?.time_control ?? "3+0";
  const { inc } = parseTc(tc);
  const stake = game?.stake_amount ?? 0;
  const potential = stake * 2 * (1 - FEE);

  // 1. Initial fetch of game state.
  const loadGame = useCallback(async () => {
    try {
      const g = await api.getGame(gameId);
      setGame(g);
      setFen(g.fen || START_FEN);
      setWhiteMs(g.white_time_ms ?? parseTc(g.time_control).base * 1000);
      setBlackMs(g.black_time_ms ?? parseTc(g.time_control).base * 1000);
      const lastDbMove = g.moves?.[g.moves.length - 1];
      if (lastDbMove?.uci_move && lastDbMove.uci_move.length >= 4) {
        setLastMove({
          from: lastDbMove.uci_move.slice(0, 2) as Square,
          to: lastDbMove.uci_move.slice(2, 4) as Square,
        });
      }
      if (g.status === "completed" && g.result && address) {
        const a = address.toLowerCase();
        const mine: Color | null =
          g.white_address?.toLowerCase() === a
            ? "w"
            : g.black_address?.toLowerCase() === a
            ? "b"
            : null;
        if (mine) setResult(uiResultFromGame(g.result, mine));
        setEndReason(g.end_reason);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLoadError(msg);
      toast.showError(e);
    }
  }, [gameId, address, toast]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  // 2. Live updates — WebSocket for PvP, polling for bot mode.
  useEffect(() => {
    if (!game || !token) return;
    if (game.status !== "active" && game.status !== "waiting") return;
    if (isBot) {
      // Bot games don't need WS — REST /move returns both moves synchronously.
      return;
    }

    setStatusMsg("Connecting WebSocket…");
    const ws = connectGameWs(gameId, token, {
      onOpen: () => setStatusMsg(null),
      onConnected: () => setStatusMsg(null),
      onMoveMade: (payload) => {
        setFen(payload.fen);
        setWhiteMs(payload.whiteTimeMs);
        setBlackMs(payload.blackTimeMs);
        const m = payload.move;
        if (m && m.length >= 4) {
          setLastMove({ from: m.slice(0, 2) as Square, to: m.slice(2, 4) as Square });
        }
      },
      onMoveInvalid: (reason) =>
        toast.show({ title: "Move rejected", message: reason, tone: "warning" }),
      onDrawOffered: (by) => setDrawOfferedBy(by),
      onDrawAccepted: () => setStatusMsg("Draw accepted — waiting for settlement"),
      onGameEnd: (payload) => handleGameEnd(payload),
      onError: (m) => toast.showError(m),
      onClose: () => setStatusMsg("Connection lost"),
    });
    wsRef.current = ws;

    return () => {
      ws.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, token, game?.status, isBot]);

  const handleGameEnd = useCallback(
    (payload: Extract<WsServerEvent, { event: "game:end" }>) => {
      if (!myColor) return;
      setResult(uiResultFromGame(payload.result, myColor));
      if (payload.reason) setEndReason(payload.reason);
    },
    [myColor],
  );

  // 3. Client clock tick — decrements whoever has the move. Server authoritative
  // values arrive via WS move:made, so this is just smooth UI between updates.
  useEffect(() => {
    if (!game || game.status !== "active" || result) return;
    const id = setInterval(() => {
      if (turn === "w") setWhiteMs((t) => Math.max(0, t - 1000));
      else setBlackMs((t) => Math.max(0, t - 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [turn, game?.status, result, game]);

  const tryMove = useCallback(
    (from: Square, to: Square): boolean => {
      if (result) return false;
      if (!myColor || turn !== myColor) return false;
      if (sendingMove) return false;

      // Optimistic validation (and auto-queen promotion).
      const probe = new Chess(fen);
      let move;
      try {
        move = probe.move({ from, to, promotion: "q" });
      } catch {
        return false;
      }
      if (!move) return false;

      const uci = `${from}${to}${move.promotion ?? ""}`;
      setSendingMove(true);

      if (isBot) {
        // REST path — BE returns server-validated FEN and bot's reply, then
        // we re-fetch to pick up the latest move (fen includes bot's response).
        api
          .makeMove(gameId, uci)
          .then((r) => {
            if (!r.valid) {
              toast.show({
                title: "Move rejected",
                message: r.reason,
                tone: "warning",
              });
              return;
            }
            // Wait a tick so the BE has written the bot move, then refresh.
            setTimeout(loadGame, BOT_POLL_MS);
          })
          .catch((e) => toast.showError(e))
          .finally(() => setSendingMove(false));
      } else {
        // PvP path — WS broadcasts move:made to both clients.
        wsRef.current?.sendMove(uci);
        setSendingMove(false);
      }
      return true;
    },
    [result, myColor, turn, sendingMove, fen, isBot, gameId, loadGame, toast],
  );

  const legalMovesFrom = useCallback(
    (sq: Square): Square[] => {
      if (!myColor || turn !== myColor) return [];
      return chess.moves({ square: sq, verbose: true }).map((m) => m.to as Square);
    },
    [chess, myColor, turn],
  );

  const onResign = async () => {
    if (!game || result) return;
    if (!confirm("Resign this game? Your stake goes to your opponent.")) return;
    if (!isBot && wsRef.current) {
      wsRef.current.resign();
      return;
    }
    try {
      const r = await api.resignGame(gameId);
      if (myColor) setResult(uiResultFromGame(r.result, myColor));
      setEndReason("resignation");
    } catch (e) {
      toast.showError(e);
    }
  };

  const onOfferDraw = () => {
    if (!game || result || isBot) return;
    wsRef.current?.offerDraw();
    setStatusMsg("Draw offer sent");
  };

  const onAcceptDraw = () => {
    wsRef.current?.acceptDraw();
    setDrawOfferedBy(null);
  };

  const moveCount = chess.history().length;

  if (!game) {
    return (
      <main className="flex-1 px-4 pt-[max(env(safe-area-inset-top),14px)] pb-6">
        <div className="mt-8 flex flex-col items-center justify-center gap-3 text-[color:var(--color-ink-2)]">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--color-primary)]/20 border-t-[color:var(--color-primary)]" />
          <p className="text-sm">Loading game…</p>
          {loadError && (
            <p className="text-[11px] text-[color:var(--color-danger)]">{loadError}</p>
          )}
        </div>
      </main>
    );
  }

  const waiting = game.status === "waiting";

  return (
    <main className="flex-1">
      <div className="bg-hero px-4 pt-[max(env(safe-area-inset-top),14px)] pb-4 text-white">
        <header className="flex items-center justify-between">
          <Link
            href="/lobby"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
            aria-label="Back"
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                waiting ? "bg-amber-300 animate-pulse" : "bg-emerald-300 animate-pulse"
              }`}
            />
            <span className="text-[11px] font-semibold tracking-wide">
              {waiting ? "Waiting for opponent" : `Live · ${tc}`}
            </span>
          </div>
          <button
            type="button"
            onClick={onResign}
            disabled={!!result || waiting}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 disabled:opacity-50"
            aria-label="Resign"
          >
            <FlagIcon size={16} />
          </button>
        </header>
      </div>

      <div className="px-4 pb-6">
        <PlayerBar
          color={orientation === "white" ? "black" : "white"}
          name={
            opponentAddress
              ? `Opponent · ${truncateAddress(opponentAddress)}`
              : isBot
              ? "Stockfish Bot"
              : "Waiting…"
          }
          time={orientation === "white" ? blackMs / 1000 : whiteMs / 1000}
          active={
            !result &&
            !waiting &&
            ((orientation === "white" && turn === "b") ||
              (orientation === "black" && turn === "w"))
          }
        />

        <div className="mt-3">
          <Chessboard
            fen={fen}
            orientation={orientation}
            turn={turn}
            playerColor={myColor ?? "w"}
            disabled={!!result || waiting || !myColor || turn !== myColor}
            onMove={tryMove}
            legalMovesFrom={legalMovesFrom}
            lastMove={lastMove ?? undefined}
            inCheckSquare={inCheckSquare}
          />
        </div>

        <PlayerBar
          color={orientation}
          name={address ? `You · ${truncateAddress(address)}` : "You"}
          time={orientation === "white" ? whiteMs / 1000 : blackMs / 1000}
          active={!result && !waiting && myColor !== null && turn === myColor}
        />

        <div className="card mt-4 flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-2)]">
              If you win
            </p>
            <p className="text-lg font-bold text-[color:var(--color-primary)]">
              {formatLocal(potential, "IDR")}
            </p>
            <p className="text-[11px] text-[color:var(--color-ink-2)]">
              Stake {formatCelo(stake)} · in escrow
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-full bg-[color:var(--color-sky-100)] px-3 py-1 text-[11px] font-semibold text-[color:var(--color-ink-1)]">
              Move {Math.ceil(moveCount / 2) || 1} ·{" "}
              {turn === myColor ? "You" : "Opponent"}
            </span>
            {chess.inCheck() && !result && (
              <span className="rounded-full bg-[color:var(--color-danger-soft)] px-3 py-1 text-[11px] font-bold text-[color:var(--color-danger)]">
                Check!
              </span>
            )}
            {!isBot && !waiting && !result && (
              <button
                type="button"
                onClick={onOfferDraw}
                className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[11px] font-bold text-[color:var(--color-ink-1)]"
              >
                Offer Draw
              </button>
            )}
          </div>
        </div>

        {drawOfferedBy && (
          <div className="card mt-3 flex items-center justify-between px-4 py-3">
            <p className="text-xs font-bold text-[color:var(--color-ink-0)]">
              Opponent offered a draw
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onAcceptDraw}
                className="rounded-full bg-[color:var(--color-primary)] px-3 py-1.5 text-[11px] font-bold text-white"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => setDrawOfferedBy(null)}
                className="rounded-full border border-[color:var(--color-border)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--color-ink-1)]"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {statusMsg && (
          <p className="mt-3 text-center text-[11px] text-[color:var(--color-ink-2)]">
            {statusMsg}
          </p>
        )}
      </div>

      {result && (
        <ResultModal
          result={result}
          reason={endReason}
          amount={result === "win" ? potential : result === "lose" ? -stake : 0}
          onPlayAgain={() => router.push("/play")}
          onClose={() => setResult(null)}
        />
      )}
    </main>
  );
}

function PlayerBar({
  color,
  name,
  time,
  active,
}: {
  color: "white" | "black";
  name: string;
  time: number;
  active: boolean;
}) {
  const low = time < 30;
  return (
    <div
      className={`mt-3 flex items-center justify-between rounded-2xl border px-3 py-2.5 transition-colors ${
        active
          ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-50)]"
          : "border-[color:var(--color-border)] bg-white"
      }`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
            color === "white"
              ? "bg-white text-[color:var(--color-ink-0)] border border-[color:var(--color-border-strong)]"
              : "bg-[color:var(--color-ink-0)] text-white"
          }`}
        >
          {color === "white" ? "♙" : "♟"}
        </span>
        <div>
          <p className="text-xs font-semibold leading-none text-[color:var(--color-ink-0)]">{name}</p>
          <p className="mt-1 text-[10px] text-[color:var(--color-ink-2)]">
            {color === "white" ? "White" : "Black"}
          </p>
        </div>
      </div>
      <div
        className={`rounded-xl px-3 py-1 font-mono text-base font-bold tabular-nums ${
          active
            ? low
              ? "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]"
              : "bg-[color:var(--color-primary)] text-white"
            : "bg-[color:var(--color-sky-100)] text-[color:var(--color-ink-2)]"
        }`}
      >
        {fmtClock(time)}
      </div>
    </div>
  );
}

function ResultModal({
  result,
  reason,
  amount,
  onPlayAgain,
  onClose,
}: {
  result: UiResult;
  reason: string | null;
  amount: number;
  onPlayAgain: () => void;
  onClose: () => void;
}) {
  const isWin = result === "win";
  const isDraw = result === "draw";
  const title = isWin ? "You Win" : isDraw ? "Draw" : "You Lose";
  const accentClass = isWin
    ? "text-[color:var(--color-success)]"
    : isDraw
    ? "text-[color:var(--color-ink-1)]"
    : "text-[color:var(--color-danger)]";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--color-ink-0)]/60 px-4 pb-6 backdrop-blur-sm">
      <div className="w-full max-w-[430px] fade-in-up rounded-[32px] bg-white p-6 shadow-[var(--shadow-raised)]">
        <div className="flex flex-col items-center text-center">
          <span
            className={`flex h-16 w-16 items-center justify-center rounded-full ${
              isWin
                ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)] pulse-ring"
                : isDraw
                ? "bg-[color:var(--color-primary-50)] text-[color:var(--color-primary)]"
                : "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]"
            }`}
          >
            <TrophyIcon size={30} />
          </span>
          <p
            className={`mt-4 text-xs font-bold uppercase tracking-[0.24em] ${accentClass}`}
          >
            {isWin ? "Win" : isDraw ? "Draw" : "Loss"}
          </p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-[color:var(--color-ink-0)]">
            {title}
          </h2>
          <p className={`mt-3 text-4xl font-extrabold tracking-tight ${accentClass}`}>
            {amount > 0 ? "+" : amount < 0 ? "−" : ""}
            {formatLocal(Math.abs(amount), "IDR")}
          </p>
          <p className="mt-1 text-xs text-[color:var(--color-ink-2)]">
            {reason ? `Ended · ${reason}` : "Settled on Celo"}
          </p>
        </div>

        <button
          type="button"
          onClick={onPlayAgain}
          className="mt-6 w-full rounded-2xl bg-[color:var(--color-primary)] py-4 text-base font-bold text-white shadow-[var(--shadow-glow-primary)] active:scale-[0.99]"
        >
          Play Again
        </button>
        <div className="mt-3 flex items-center justify-between text-[11px] text-[color:var(--color-ink-2)]">
          <button type="button" onClick={onClose} className="px-2 py-1 hover:text-[color:var(--color-primary)]">
            Close
          </button>
          <Link href="/history" className="px-2 py-1 hover:text-[color:var(--color-primary)]">
            See History
          </Link>
        </div>
      </div>
    </div>
  );
}

// --- Offline bot demo (fallback when contracts aren't configured) ---------------

function OfflineBotScreen({ stake, tc }: { stake: number; tc: string }) {
  const router = useRouter();
  const { base, inc } = parseTc(tc);

  const PLAYER_COLOR: Color = "w";
  const BOT_THINK_MS = 650;

  const [fen, setFen] = useState<string>(START_FEN);
  const [whiteTime, setWhiteTime] = useState(base);
  const [blackTime, setBlackTime] = useState(base);
  const [result, setResult] = useState<UiResult | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);

  const chess = useMemo(() => new Chess(fen), [fen]);
  const turn = chess.turn();
  const moveCount = chess.history().length;

  const inCheckSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    return findKingSquare(chess, chess.turn());
  }, [chess]);

  const detect = (next: Chess): UiResult | null => {
    if (next.isCheckmate()) return next.turn() === PLAYER_COLOR ? "lose" : "win";
    if (
      next.isStalemate() ||
      next.isInsufficientMaterial() ||
      next.isThreefoldRepetition() ||
      next.isDraw()
    ) {
      return "draw";
    }
    return null;
  };

  const tryMove = useCallback(
    (from: Square, to: Square): boolean => {
      if (result) return false;
      if (chess.turn() !== PLAYER_COLOR) return false;
      const next = new Chess(chess.fen());
      let move;
      try {
        move = next.move({ from, to, promotion: "q" });
      } catch {
        return false;
      }
      if (!move) return false;
      setWhiteTime((t) => t + inc);
      setLastMove({ from: move.from as Square, to: move.to as Square });
      setFen(next.fen());
      const r = detect(next);
      if (r) setResult(r);
      return true;
    },
    [chess, result, inc],
  );

  const legalMovesFrom = useCallback(
    (sq: Square): Square[] => {
      if (chess.turn() !== PLAYER_COLOR) return [];
      return chess.moves({ square: sq, verbose: true }).map((m) => m.to as Square);
    },
    [chess],
  );

  useEffect(() => {
    if (result || chess.turn() === PLAYER_COLOR || chess.isGameOver()) return;
    const t = setTimeout(() => {
      const next = new Chess(chess.fen());
      const moves = next.moves({ verbose: true });
      if (moves.length === 0) return;
      const pick = moves[Math.floor(Math.random() * moves.length)];
      next.move({ from: pick.from, to: pick.to, promotion: "q" });
      setBlackTime((t2) => t2 + inc);
      setLastMove({ from: pick.from as Square, to: pick.to as Square });
      setFen(next.fen());
      const r = detect(next);
      if (r) setResult(r);
    }, BOT_THINK_MS);
    return () => clearTimeout(t);
  }, [chess, result, inc]);

  useEffect(() => {
    if (result) return;
    const id = setInterval(() => {
      if (chess.turn() === "w") {
        setWhiteTime((t) => (t <= 1 ? (setResult("lose"), 0) : t - 1));
      } else {
        setBlackTime((t) => (t <= 1 ? (setResult("win"), 0) : t - 1));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [chess, result]);

  const potential = stake * 2 * (1 - FEE);

  return (
    <main className="flex-1">
      <div className="bg-hero px-4 pt-[max(env(safe-area-inset-top),14px)] pb-4 text-white">
        <header className="flex items-center justify-between">
          <Link href="/play" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15" aria-label="Back">
            <ChevronLeft size={18} />
          </Link>
          <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
            <span className="text-[11px] font-semibold tracking-wide">Preview · {tc}</span>
          </div>
          <button type="button" onClick={() => setResult("lose")} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15" aria-label="Resign">
            <FlagIcon size={16} />
          </button>
        </header>
      </div>

      <div className="px-4 pb-6">
        <PlayerBar color="black" name="Random Bot" time={blackTime} active={turn === "b" && !result} />
        <div className="mt-3">
          <Chessboard
            fen={fen}
            orientation="white"
            turn={turn}
            playerColor={PLAYER_COLOR}
            disabled={!!result}
            onMove={tryMove}
            legalMovesFrom={legalMovesFrom}
            lastMove={lastMove ?? undefined}
            inCheckSquare={inCheckSquare}
          />
        </div>
        <PlayerBar color="white" name="You" time={whiteTime} active={turn === "w" && !result} />

        <div className="card mt-4 flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-2)]">
              If you win
            </p>
            <p className="text-lg font-bold text-[color:var(--color-primary)]">
              {formatLocal(potential, "IDR")}
            </p>
            <p className="text-[11px] text-[color:var(--color-ink-2)]">Stake {formatCelo(stake)} · preview</p>
          </div>
          <span className="rounded-full bg-[color:var(--color-sky-100)] px-3 py-1 text-[11px] font-semibold text-[color:var(--color-ink-1)]">
            Move {Math.ceil(moveCount / 2) || 1} · {turn === "w" ? "You" : "Bot"}
          </span>
        </div>
      </div>

      {result && (
        <ResultModal
          result={result}
          reason="preview mode"
          amount={result === "win" ? potential : result === "lose" ? -stake : 0}
          onPlayAgain={() => router.push("/play")}
          onClose={() => setResult(null)}
        />
      )}
    </main>
  );
}
