import crypto from "crypto";
import { keccak256, toHex } from "viem";

export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

export function generateNonce(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateOnchainGameId(gameId: string): `0x${string}` {
  return keccak256(toHex(gameId));
}

export function parseTimeControl(tc: string): { timeMs: number; incrementMs: number } {
  const parts = tc.split("+");
  const minutes = parseInt(parts[0], 10) || 3;
  const increment = parseInt(parts[1], 10) || 0;
  return {
    timeMs: minutes * 60 * 1000,
    incrementMs: increment * 1000,
  };
}

export function isValidStake(amount: number): boolean {
  return [0.5, 1.0, 2.0].includes(amount);
}

export function isValidTimeControl(tc: string): boolean {
  const valid = ["1+0", "3+0", "3+2", "5+0", "5+3", "10+0", "10+5"];
  return valid.includes(tc);
}
