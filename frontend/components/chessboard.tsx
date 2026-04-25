"use client";

import { useMemo, useState } from "react";
import type { Color, Square } from "chess.js";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Always use the solid (filled) glyph for both colors.
// White Unicode pieces (♔♕…) are outline-only glyphs — they render hollow.
// Using solid glyphs (♚♛…) for whites lets us fill them properly with CSS color.
const UNICODE: Record<string, string> = {
  K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

function parseFen(fen: string): (string | null)[][] {
  const placement = fen.split(" ")[0];
  const rows = placement.split("/");
  return rows.map((row) => {
    const cells: (string | null)[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) cells.push(null);
      } else {
        cells.push(ch);
      }
    }
    return cells;
  });
}

function rcToSquare(r: number, c: number, orientation: "white" | "black"): Square {
  const file = orientation === "white" ? c : 7 - c;
  const rank = orientation === "white" ? 7 - r : r;
  return `${String.fromCharCode(97 + file)}${rank + 1}` as Square;
}

function squareToRc(sq: Square, orientation: "white" | "black"): [number, number] {
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]) - 1;
  const c = orientation === "white" ? file : 7 - file;
  const r = orientation === "white" ? 7 - rank : rank;
  return [r, c];
}

type ChessboardProps = {
  fen?: string;
  orientation?: "white" | "black";
  lastMove?: { from: Square; to: Square };
  turn?: Color;
  playerColor?: Color;
  disabled?: boolean;
  onMove?: (from: Square, to: Square) => boolean;
  legalMovesFrom?: (sq: Square) => Square[];
  inCheckSquare?: Square | null;
};

export function Chessboard({
  fen = START_FEN,
  orientation = "white",
  lastMove,
  turn = "w",
  playerColor = "w",
  disabled = false,
  onMove,
  legalMovesFrom,
  inCheckSquare,
}: ChessboardProps) {
  const [selected, setSelected] = useState<Square | null>(null);

  const board = useMemo(() => {
    const parsed = parseFen(fen);
    if (orientation === "black") {
      return [...parsed].reverse().map((r) => [...r].reverse());
    }
    return parsed;
  }, [fen, orientation]);

  const legalTargets = useMemo(() => {
    if (!selected || !legalMovesFrom) return new Set<Square>();
    return new Set(legalMovesFrom(selected));
  }, [selected, legalMovesFrom]);

  const canInteract = !disabled && onMove && legalMovesFrom && turn === playerColor;

  const handleSquareClick = (sq: Square, piece: string | null) => {
    if (!canInteract) return;
    const isOwnPiece =
      !!piece && (playerColor === "w" ? piece === piece.toUpperCase() : piece === piece.toLowerCase());

    if (selected && selected !== sq && legalTargets.has(sq)) {
      const ok = onMove!(selected, sq);
      setSelected(null);
      if (!ok && isOwnPiece) setSelected(sq);
      return;
    }

    if (isOwnPiece) {
      setSelected((cur) => (cur === sq ? null : sq));
      return;
    }

    setSelected(null);
  };

  const selectedRc = selected ? squareToRc(selected, orientation) : null;
  const checkRc = inCheckSquare ? squareToRc(inCheckSquare, orientation) : null;
  const lastFromRc = lastMove ? squareToRc(lastMove.from, orientation) : null;
  const lastToRc = lastMove ? squareToRc(lastMove.to, orientation) : null;

  return (
    <div className="relative mx-auto aspect-square w-[min(100%,440px)]">
      <div
        aria-hidden
        className="absolute -inset-2 -z-10 rounded-[28px] blur-2xl opacity-70"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 50%, rgba(30,111,217,0.25) 0%, rgba(74,144,226,0.15) 50%, transparent 80%)",
        }}
      />
      <div
        className="grid h-full w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-[22px] border border-[color:var(--color-border-strong)] bg-white"
        style={{ boxShadow: "var(--shadow-raised)" }}
      >
        {board.map((row, r) =>
          row.map((piece, c) => {
            const dark = (r + c) % 2 === 1;
            const sq = rcToSquare(r, c, orientation);
            const isSelected = !!selectedRc && selectedRc[0] === r && selectedRc[1] === c;
            const isLastFrom = !!lastFromRc && lastFromRc[0] === r && lastFromRc[1] === c;
            const isLastTo = !!lastToRc && lastToRc[0] === r && lastToRc[1] === c;
            const isCheck = !!checkRc && checkRc[0] === r && checkRc[1] === c;
            const isLegalTarget = legalTargets.has(sq);
            const isWhite = piece && piece === piece.toUpperCase();
            const interactive = canInteract;

            // Square background: light=#dce9f8 dark=#3d6db5, adapted to app blue theme
            // Last-move highlight: amber (#f5b118) tint — warm accent on cool board
            const squareBg = isCheck
              ? (dark ? "#9b2a22" : "#fde9e7")
              : isSelected
              ? (dark ? "#1a4f9c" : "#b8d8ff")
              : isLastFrom || isLastTo
              ? (dark ? "#8a6830" : "#f0d88a")
              : dark
              ? "#3d6db5"
              : "#dce9f8";

            return (
              <button
                type="button"
                key={`${r}-${c}`}
                onClick={() => handleSquareClick(sq, piece)}
                disabled={!interactive}
                aria-label={sq}
                style={{ backgroundColor: squareBg }}
                className={[
                  "relative flex items-center justify-center text-[36px] leading-none select-none",
                  "transition-colors",
                  interactive ? "cursor-pointer active:brightness-90" : "cursor-default",
                ].join(" ")}
              >
                {piece && (
                  <span
                    style={
                      isWhite
                        ? {
                            color: "#ffffff",
                            WebkitTextStroke: "1px #1a1a1a",
                            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
                          }
                        : {
                            color: "#1a1a1a",
                            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))",
                          }
                    }
                  >
                    {UNICODE[piece]}
                  </span>
                )}

                {isLegalTarget && !piece && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute h-[28%] w-[28%] rounded-full"
                    style={{ backgroundColor: "rgba(0,0,0,0.20)" }}
                  />
                )}
                {isLegalTarget && piece && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-none"
                    style={{ boxShadow: "inset 0 0 0 4px rgba(0,0,0,0.30)" }}
                  />
                )}

                {c === 0 && (
                  <span
                    className={`absolute text-[9px] font-bold leading-none ${r === 0 ? "left-2 top-2" : "left-0.5 top-0.5"}`}
                    style={{ color: dark ? "#dce9f8" : "#3d6db5" }}
                  >
                    {orientation === "white" ? 8 - r : r + 1}
                  </span>
                )}
                {r === 7 && (
                  <span
                    className={`absolute text-[9px] font-bold leading-none ${c === 7 ? "right-2 bottom-2" : "right-0.5 bottom-0.5"}`}
                    style={{ color: dark ? "#dce9f8" : "#3d6db5" }}
                  >
                    {String.fromCharCode(97 + (orientation === "white" ? c : 7 - c))}
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
