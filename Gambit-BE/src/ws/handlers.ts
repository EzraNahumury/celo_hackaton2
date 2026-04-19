import WebSocket from "ws";
import { makeMove, resignGame } from "../services/gameService";
import { broadcastToGame } from "./gameRoom";
import { logger } from "../utils/logger";

interface GameWebSocket extends WebSocket {
  gameId?: string;
  playerAddress?: string;
}

export function handleMessage(ws: GameWebSocket, raw: WebSocket.RawData): void {
  let msg: any;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    ws.send(JSON.stringify({ event: "error", message: "Invalid JSON" }));
    return;
  }

  switch (msg.event) {
    case "move:send":
      handleMove(ws, msg);
      break;
    case "draw:offer":
      handleDrawOffer(ws, msg);
      break;
    case "draw:accept":
      handleDrawAccept(ws, msg);
      break;
    case "game:resign":
      handleResign(ws, msg);
      break;
    default:
      ws.send(JSON.stringify({ event: "error", message: "Unknown event" }));
  }
}

async function handleMove(ws: GameWebSocket, msg: any): Promise<void> {
  if (!ws.gameId || !ws.playerAddress) return;

  try {
    const result = await makeMove(ws.gameId, ws.playerAddress, msg.move);

    if (result.valid) {
      broadcastToGame(ws.gameId, {
        event: "move:made",
        gameId: ws.gameId,
        move: msg.move,
        fen: result.fen,
        whiteTimeMs: result.whiteTimeMs,
        blackTimeMs: result.blackTimeMs,
        moveNumber: result.moveNumber,
      });

      if (result.gameOver) {
        broadcastToGame(ws.gameId, {
          event: "game:end",
          gameId: ws.gameId,
          result: result.result,
        });
      }
    } else {
      ws.send(JSON.stringify({ event: "move:invalid", reason: result.reason }));
    }
  } catch (err) {
    logger.error("WS move handler error", { error: (err as Error).message });
    ws.send(JSON.stringify({ event: "error", message: "Move failed" }));
  }
}

function handleDrawOffer(ws: GameWebSocket, _msg: any): void {
  if (!ws.gameId || !ws.playerAddress) return;
  broadcastToGame(
    ws.gameId,
    { event: "draw:offered", by: ws.playerAddress },
    ws
  );
}

function handleDrawAccept(ws: GameWebSocket, _msg: any): void {
  if (!ws.gameId || !ws.playerAddress) return;
  // TODO: implement draw acceptance logic
  broadcastToGame(ws.gameId, {
    event: "draw:accepted",
    by: ws.playerAddress,
  });
}

async function handleResign(ws: GameWebSocket, _msg: any): Promise<void> {
  if (!ws.gameId || !ws.playerAddress) return;

  try {
    const result = await resignGame(ws.gameId, ws.playerAddress);
    broadcastToGame(ws.gameId, {
      event: "game:end",
      gameId: ws.gameId,
      result: result.result,
      reason: "resignation",
    });
  } catch (err) {
    ws.send(JSON.stringify({ event: "error", message: "Resign failed" }));
  }
}
