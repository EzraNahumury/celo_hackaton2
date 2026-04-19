import WebSocket from "ws";

const gameRooms = new Map<string, Set<WebSocket>>();

export function joinRoom(gameId: string, ws: WebSocket): void {
  if (!gameRooms.has(gameId)) {
    gameRooms.set(gameId, new Set());
  }
  gameRooms.get(gameId)!.add(ws);
}

export function leaveRoom(gameId: string, ws: WebSocket): void {
  const room = gameRooms.get(gameId);
  if (!room) return;
  room.delete(ws);
  if (room.size === 0) gameRooms.delete(gameId);
}

export function broadcastToGame(
  gameId: string,
  event: object,
  exclude?: WebSocket
): void {
  const room = gameRooms.get(gameId);
  if (!room) return;
  const msg = JSON.stringify(event);
  room.forEach((ws) => {
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  });
}

export function getRoomSize(gameId: string): number {
  return gameRooms.get(gameId)?.size || 0;
}
