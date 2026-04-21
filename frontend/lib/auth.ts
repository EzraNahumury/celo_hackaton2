"use client";

import type { WalletAddress } from "@/types/api";

const TOKEN_KEY = "gambit:token";
const ADDR_KEY = "gambit:addr";
const EXPIRES_KEY = "gambit:expires";

// See lib/api.ts for the rationale — when the frontend is opened from a
// phone or LAN host, a hardcoded `localhost` target points at the device
// itself and every auth call fails. Mirror that host-rewrite here.
function resolveApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  if (typeof window === "undefined") return configured;
  try {
    const pageHost = window.location.hostname;
    const apiUrl = new URL(configured);
    const apiHostIsLocal =
      apiUrl.hostname === "localhost" || apiUrl.hostname === "127.0.0.1";
    const pageHostIsLocal =
      pageHost === "localhost" || pageHost === "127.0.0.1";
    if (apiHostIsLocal && !pageHostIsLocal) {
      apiUrl.hostname = pageHost;
      return apiUrl.toString().replace(/\/$/, "");
    }
  } catch {
    // fall through to configured
  }
  return configured;
}

const API_URL = resolveApiUrl();

function now() {
  return Math.floor(Date.now() / 1000);
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(TOKEN_KEY);
  const expires = Number(window.localStorage.getItem(EXPIRES_KEY) || 0);
  if (!token) return null;
  if (expires && now() > expires) {
    clearAuth();
    return null;
  }
  return token;
}

export function getAuthAddress(): WalletAddress | null {
  if (typeof window === "undefined") return null;
  return (window.localStorage.getItem(ADDR_KEY) as WalletAddress | null) ?? null;
}

export function hasSessionFor(address: WalletAddress | undefined | null): boolean {
  if (!address) return false;
  const stored = getAuthAddress();
  return (
    !!getAuthToken() && !!stored && stored.toLowerCase() === address.toLowerCase()
  );
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ADDR_KEY);
  window.localStorage.removeItem(EXPIRES_KEY);
}

// Perform BE auth flow: GET /auth/nonce → POST /auth/verify.
// Dev BE skips tx verification, so we send no txHash.
export async function login(address: WalletAddress): Promise<string> {
  const nonceRes = await fetch(
    `${API_URL}/auth/nonce?address=${encodeURIComponent(address)}`,
  );
  if (!nonceRes.ok) throw new Error(`Nonce fetch failed (${nonceRes.status})`);
  await nonceRes.json().catch(() => ({}));

  const verifyRes = await fetch(`${API_URL}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!verifyRes.ok) throw new Error(`Verify failed (${verifyRes.status})`);
  const { token, expiresIn } = (await verifyRes.json()) as {
    token: string;
    expiresIn: number;
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(ADDR_KEY, address);
    window.localStorage.setItem(EXPIRES_KEY, String(now() + expiresIn - 60));
  }
  return token;
}

// Ensure the stored session matches the given wallet. Logs in when missing/stale.
export async function ensureSession(
  address: WalletAddress | undefined,
): Promise<string | null> {
  if (!address) return null;
  if (hasSessionFor(address)) return getAuthToken();
  clearAuth();
  return await login(address);
}
