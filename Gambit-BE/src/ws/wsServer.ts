import { Server as HTTPServer } from "http";
import WebSocket, { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { joinRoom, leaveRoom } from "./gameRoom";
import { handleMessage } from "./handlers";
import { logger } from "../utils/logger";
import { JWTPayload } from "../types";

interface GameWebSocket extends WebSocket {
  gameId?: string;
  playerAddress?: string;
  isAlive?: boolean;
}

export function setupWebSocket(server: HTTPServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    try {
      const url = new URL(req.url || "", `http://localhost:${env.PORT}`);
      const gameId = url.searchParams.get("gameId");
      const token = url.searchParams.get("token");

      if (!gameId || !token) {
        socket.destroy();
        return;
      }

      let decoded: JWTPayload;
      try {
        decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
      } catch {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        const gameWs = ws as GameWebSocket;
        gameWs.gameId = gameId;
        gameWs.playerAddress = decoded.wallet_address;
        gameWs.isAlive = true;
        wss.emit("connection", gameWs, req);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on("connection", (ws: GameWebSocket) => {
    if (ws.gameId) {
      joinRoom(ws.gameId, ws);
      logger.info("WS connected", { gameId: ws.gameId, player: ws.playerAddress });
    }

    ws.on("message", (data) => handleMessage(ws, data));

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("close", () => {
      if (ws.gameId) {
        leaveRoom(ws.gameId, ws);
        logger.info("WS disconnected", { gameId: ws.gameId, player: ws.playerAddress });
      }
    });

    ws.on("error", (err) => {
      logger.error("WS error", { error: err.message });
    });

    // Send connected confirmation
    ws.send(JSON.stringify({ event: "connected", gameId: ws.gameId }));
  });

  // Heartbeat - ping every 30 seconds
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      const gameWs = ws as GameWebSocket;
      if (!gameWs.isAlive) {
        gameWs.terminate();
        return;
      }
      gameWs.isAlive = false;
      gameWs.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(heartbeat));

  logger.info("WebSocket server ready");
  return wss;
}
