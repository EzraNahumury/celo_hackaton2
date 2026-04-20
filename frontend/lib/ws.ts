"use client";

import type {
  GameId,
  UCIMove,
  WsClientEvent,
  WsServerEvent,
} from "@/types/api";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";

export type WsHandlers = {
  onConnected?: (gameId: GameId) => void;
  onMoveMade?: (payload: Extract<WsServerEvent, { event: "move:made" }>) => void;
  onMoveInvalid?: (reason: string) => void;
  onDrawOffered?: (by: string) => void;
  onDrawAccepted?: (by: string) => void;
  onGameEnd?: (payload: Extract<WsServerEvent, { event: "game:end" }>) => void;
  onError?: (message: string) => void;
  onOpen?: () => void;
  onClose?: (code: number) => void;
};

export type GameSocket = {
  send: (msg: WsClientEvent) => void;
  sendMove: (move: UCIMove) => void;
  offerDraw: () => void;
  acceptDraw: () => void;
  resign: () => void;
  close: () => void;
  readyState: () => number;
};

export function connectGameWs(
  gameId: GameId,
  token: string,
  handlers: WsHandlers,
): GameSocket {
  const url = `${WS_URL}?gameId=${encodeURIComponent(
    gameId,
  )}&token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);

  ws.onopen = () => handlers.onOpen?.();
  ws.onclose = (e) => handlers.onClose?.(e.code);
  ws.onerror = () => handlers.onError?.("WebSocket error");
  ws.onmessage = (e) => {
    let msg: WsServerEvent;
    try {
      msg = JSON.parse(String(e.data));
    } catch {
      return;
    }
    switch (msg.event) {
      case "connected":
        handlers.onConnected?.(msg.gameId);
        break;
      case "move:made":
        handlers.onMoveMade?.(msg);
        break;
      case "move:invalid":
        handlers.onMoveInvalid?.(msg.reason);
        break;
      case "draw:offered":
        handlers.onDrawOffered?.(msg.by);
        break;
      case "draw:accepted":
        handlers.onDrawAccepted?.(msg.by);
        break;
      case "game:end":
        handlers.onGameEnd?.(msg);
        break;
      case "error":
        handlers.onError?.(msg.message);
        break;
    }
  };

  const send = (msg: WsClientEvent) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(msg));
  };

  return {
    send,
    sendMove: (move) => send({ event: "move:send", move }),
    offerDraw: () => send({ event: "draw:offer" }),
    acceptDraw: () => send({ event: "draw:accept" }),
    resign: () => send({ event: "game:resign" }),
    close: () => ws.close(),
    readyState: () => ws.readyState,
  };
}
