import { Chess } from "chess.js";

export function createGame(fen?: string): Chess {
  return fen ? new Chess(fen) : new Chess();
}

export function validateMove(
  fen: string,
  uciMove: string
): { valid: boolean; newFen?: string; reason?: string; gameOver?: boolean; result?: string } {
  const chess = new Chess(fen);

  const from = uciMove.substring(0, 2);
  const to = uciMove.substring(2, 4);
  const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

  try {
    const move = chess.move({ from, to, promotion });
    if (!move) {
      return { valid: false, reason: "Illegal move" };
    }

    let gameOver = false;
    let result: string | undefined;

    if (chess.isCheckmate()) {
      gameOver = true;
      result = chess.turn() === "w" ? "black_win" : "white_win";
    } else if (chess.isStalemate() || chess.isDraw()) {
      gameOver = true;
      result = "draw";
    }

    return { valid: true, newFen: chess.fen(), gameOver, result };
  } catch {
    return { valid: false, reason: "Invalid move format" };
  }
}

export function getTurn(fen: string): "white" | "black" {
  const chess = new Chess(fen);
  return chess.turn() === "w" ? "white" : "black";
}

export function isGameOver(fen: string): { over: boolean; result?: string } {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) {
    return { over: true, result: chess.turn() === "w" ? "black_win" : "white_win" };
  }
  if (chess.isStalemate() || chess.isDraw()) {
    return { over: true, result: "draw" };
  }
  return { over: false };
}
