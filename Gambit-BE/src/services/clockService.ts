import { logger } from "../utils/logger";
import { parseTimeControl } from "../utils/helpers";

interface ClockState {
  whiteTimeMs: number;
  blackTimeMs: number;
  incrementMs: number;
  activeColor: "white" | "black";
  lastTickAt: number;
  interval: NodeJS.Timeout | null;
  onTimeout?: (color: "white" | "black") => void;
}

const activeClocks = new Map<string, ClockState>();

export function startClock(
  gameId: string,
  timeControl: string,
  onTimeout: (color: "white" | "black") => void
): { whiteTimeMs: number; blackTimeMs: number } {
  const { timeMs, incrementMs } = parseTimeControl(timeControl);

  const state: ClockState = {
    whiteTimeMs: timeMs,
    blackTimeMs: timeMs,
    incrementMs,
    activeColor: "white",
    lastTickAt: Date.now(),
    interval: null,
    onTimeout,
  };

  state.interval = setInterval(() => tickClock(gameId), 1000);
  activeClocks.set(gameId, state);

  return { whiteTimeMs: timeMs, blackTimeMs: timeMs };
}

function tickClock(gameId: string): void {
  const state = activeClocks.get(gameId);
  if (!state) return;

  const now = Date.now();
  const elapsed = now - state.lastTickAt;
  state.lastTickAt = now;

  if (state.activeColor === "white") {
    state.whiteTimeMs -= elapsed;
    if (state.whiteTimeMs <= 0) {
      state.whiteTimeMs = 0;
      stopClock(gameId);
      state.onTimeout?.("white");
      return;
    }
  } else {
    state.blackTimeMs -= elapsed;
    if (state.blackTimeMs <= 0) {
      state.blackTimeMs = 0;
      stopClock(gameId);
      state.onTimeout?.("black");
      return;
    }
  }
}

export function switchTurn(gameId: string): { whiteTimeMs: number; blackTimeMs: number } | null {
  const state = activeClocks.get(gameId);
  if (!state) return null;

  // Deduct elapsed time for current player
  const now = Date.now();
  const elapsed = now - state.lastTickAt;

  if (state.activeColor === "white") {
    state.whiteTimeMs -= elapsed;
    state.whiteTimeMs += state.incrementMs;
  } else {
    state.blackTimeMs -= elapsed;
    state.blackTimeMs += state.incrementMs;
  }

  state.activeColor = state.activeColor === "white" ? "black" : "white";
  state.lastTickAt = now;

  return { whiteTimeMs: state.whiteTimeMs, blackTimeMs: state.blackTimeMs };
}

export function getTimeRemaining(gameId: string): { whiteTimeMs: number; blackTimeMs: number } | null {
  const state = activeClocks.get(gameId);
  if (!state) return null;

  // Calculate real-time remaining
  const now = Date.now();
  const elapsed = now - state.lastTickAt;
  const whiteTimeMs =
    state.activeColor === "white" ? state.whiteTimeMs - elapsed : state.whiteTimeMs;
  const blackTimeMs =
    state.activeColor === "black" ? state.blackTimeMs - elapsed : state.blackTimeMs;

  return { whiteTimeMs: Math.max(0, whiteTimeMs), blackTimeMs: Math.max(0, blackTimeMs) };
}

export function stopClock(gameId: string): void {
  const state = activeClocks.get(gameId);
  if (!state) return;
  if (state.interval) clearInterval(state.interval);
  activeClocks.delete(gameId);
}
