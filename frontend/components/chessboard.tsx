"use client";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

const UNICODE: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

function parseFen(fen: string): (string | null)[][] {
  const rows = fen.split("/");
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

export function Chessboard({
  fen = START_FEN,
  orientation = "white",
  lastMove,
}: {
  fen?: string;
  orientation?: "white" | "black";
  lastMove?: { from: [number, number]; to: [number, number] };
}) {
  let board = parseFen(fen);
  if (orientation === "black") {
    board = [...board].reverse().map((r) => [...r].reverse());
  }

  return (
    <div className="relative aspect-square w-full">
      <div
        aria-hidden
        className="absolute -inset-2 -z-10 rounded-[28px] blur-2xl opacity-70"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 50%, rgba(30,111,217,0.25) 0%, rgba(74,144,226,0.15) 50%, transparent 80%)",
        }}
      />
      <div
        className="grid h-full w-full grid-cols-8 overflow-hidden rounded-[22px] border border-[color:var(--color-border-strong)] bg-white"
        style={{ boxShadow: "var(--shadow-raised)" }}
      >
        {board.map((row, r) =>
          row.map((piece, c) => {
            const dark = (r + c) % 2 === 1;
            const isLast =
              lastMove &&
              ((lastMove.from[0] === r && lastMove.from[1] === c) ||
                (lastMove.to[0] === r && lastMove.to[1] === c));
            const isWhite = piece && piece === piece.toUpperCase();
            return (
              <div
                key={`${r}-${c}`}
                className={[
                  "relative flex items-center justify-center text-[7.5vw] sm:text-[34px] leading-none select-none",
                  dark ? "bg-[#b6d0f2]" : "bg-[#f0f7ff]",
                  isLast ? "ring-2 ring-[color:var(--color-primary)] ring-inset" : "",
                ].join(" ")}
              >
                {piece && (
                  <span
                    className={`${
                      isWhite
                        ? "text-white drop-shadow-[0_2px_0_rgba(10,42,92,0.4)]"
                        : "text-[#0a2a5c] drop-shadow-[0_1px_0_rgba(255,255,255,0.55)]"
                    }`}
                  >
                    {UNICODE[piece]}
                  </span>
                )}
                {c === 0 && (
                  <span className="absolute left-1 top-0.5 text-[9px] font-semibold text-[color:var(--color-ink-2)]/75">
                    {orientation === "white" ? 8 - r : r + 1}
                  </span>
                )}
                {r === 7 && (
                  <span className="absolute right-1 bottom-0.5 text-[9px] font-semibold text-[color:var(--color-ink-2)]/75">
                    {String.fromCharCode(97 + (orientation === "white" ? c : 7 - c))}
                  </span>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
